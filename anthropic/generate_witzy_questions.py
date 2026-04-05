#!/usr/bin/env python3
"""
Witzy IB Question Bank Generator — Batch API Edition
=====================================================
Model  : claude-sonnet-4-6
Mode   : Anthropic Batch API  (50% cost discount, async processing)
Cost   : ~$17 for 8,400 questions
Time   : 30–90 minutes  (server-side, you don't need to watch it)

Usage:
    ANTHROPIC_API_KEY=sk-ant-... python3 generate_witzy_questions.py

Re-run at any time — batch ID and questions are saved to disk, so the
script always resumes from wherever it left off.

State files (safe to delete to start fresh):
    witzy_batch_state.json   tracks the in-flight batch ID per pass
    witzy_checkpoint.json    accumulated clean questions across passes

Output:
    witzy-question-bank.json  ready for: corepack pnpm import:questions
"""

import hashlib
import json
import os
import sys
import time
import uuid
from collections import Counter, defaultdict
from pathlib import Path

try:
    import anthropic
except ImportError:
    sys.exit("ERROR: pip install anthropic")

# ── CONFIG ────────────────────────────────────────────────────────────────────

MODEL      = "claude-sonnet-4-6"
TARGET     = 50
BATCH_SIZE = 10
MAX_PASSES = 4
POLL_SECS  = 30

CHECKPOINT  = Path("witzy_checkpoint.json")
BATCH_STATE = Path("witzy_batch_state.json")
OUTPUT      = Path("witzy-question-bank.json")
EXISTING_Q  = Path("questions.jsonl")
EXISTING_C  = Path("categories.jsonl")

# ── IB CATEGORIES ─────────────────────────────────────────────────────────────

CATEGORIES = [
    dict(slug="who-we-are", name="Who We Are", icon="🧠",
         ctx="IB PYP Who We Are: identity, beliefs, physical/mental/social health, human relationships, rights and responsibilities. MYP/DP: psychology, philosophy of self, ethical reasoning, neuroscience basics, cultural identity, growth mindset, wellbeing frameworks."),
    dict(slug="how-world-works", name="How the World Works", icon="🔬",
         ctx="IB PYP: scientific principles, natural world — physics, chemistry, biology, earth science, ecology. MYP/DP: systems thinking, experimental design, scientific method, interdependencies, climate systems, quantum basics, evolution, genetics, thermodynamics."),
    dict(slug="express-ourselves", name="How We Express Ourselves", icon="🎭",
         ctx="IB PYP: ways humans express ideas — creativity, aesthetics, cultural expression, art, music, drama, literature, media. MYP/DP: semiotics, rhetoric, aesthetic theory, cross-cultural comparison of artistic movements, media literacy, propaganda analysis."),
    dict(slug="sharing-planet", name="Sharing the Planet", icon="🌍",
         ctx="IB PYP: rights/responsibilities for shared resources, peace/conflict, environmental stewardship. MYP/DP: SDGs, environmental policy, resource scarcity, geopolitics of climate change, biodiversity economics, tragedy of the commons, circular economy."),
    dict(slug="place-and-time", name="Where We Are in Place and Time", icon="🗺️",
         ctx="IB PYP: history, geography, civilisations, migrations, heritage. MYP/DP: historiography, primary vs secondary sources, cartographic analysis, causes of historical turning points, comparing ancient/modern empires, colonialism, decolonisation."),
    dict(slug="organize-ourselves", name="How We Organize Ourselves", icon="🏛️",
         ctx="IB PYP: human-made systems — economic, political, social communities. MYP/DP: government structures, market economies, global institutions (UN, WTO, IMF), rule of law, civic participation, organisational theory, social contracts."),
    dict(slug="global-perspectives", name="Global Perspectives", icon="🌐",
         ctx="IB MYP global contexts: Globalisation and Sustainability, Fairness and Development. Cross-cultural comparison, world religions, international relations, global inequalities, development economics, migration, multiculturalism."),
    dict(slug="systems-societies", name="Systems & Societies", icon="⚙️",
         ctx="IB MYP Individuals and Societies: political systems (democracy, authoritarianism, federalism), economic systems (market, planned, mixed), social structures, power and authority, revolutions. DP: political philosophy (Locke, Rousseau, Rawls), market failures, constitutional democracy, comparative governance, international law."),
    dict(slug="language-literacy", name="Language & Literacy", icon="📖",
         ctx="IB Language & Literature: grammar, comprehension, vocabulary, narrative structure, poetry analysis, inference, figurative language. MYP/DP: literary devices, author intent, comparative textual analysis, rhetoric, semantics, etymology, close reading, intertextuality."),
    dict(slug="language-craft", name="Language & Craft", icon="✍️",
         ctx="IB Language production skills: effective writing, sentence construction, register, tone, voice, persuasion, argumentation. MYP/DP: essay structure, logical fallacies, academic writing conventions, rhetorical strategies, editing for precision."),
    dict(slug="math-masterminds", name="Math Masterminds", icon="📐",
         ctx="IB Mathematics: PYP — number sense, operations, fractions, geometry, measurement. MYP — algebra, probability, statistics, sequences, functions, coordinate geometry. DP — proof by induction, vectors, calculus, complex numbers, matrices. Top-decile: push into IB SL/HL level thinking."),
    dict(slug="logical-inquirers", name="Logical Inquirers", icon="🧩",
         ctx="IB ATL Thinking Skills: logic, reasoning, argument evaluation, hypothesis testing, pattern recognition, deductive/inductive reasoning. MYP/DP: formal logic, syllogisms, Venn diagrams, counterfactual reasoning, research methodology, epistemology (Theory of Knowledge), cognitive biases."),
    dict(slug="creative-expression", name="Creative Expression", icon="🎨",
         ctx="IB Arts — Visual Arts, Music, Drama: elements and principles of design, art history, artworks analysis, music theory basics, performance. MYP/DP: art movements and socio-political context, compositional techniques, performance theory, aesthetics philosophy."),
    dict(slug="design-innovation", name="Design & Innovation", icon="💡",
         ctx="IB Design/MYP Design: design thinking (empathise, define, ideate, prototype, test), materials and properties, ergonomics, sustainability. DP/MYP: systems engineering, UX research methods, innovation economics, tech ethics, lifecycle assessment, intellectual property."),
]

SLUG_SET    = {c["slug"] for c in CATEGORIES}
CAT_BY_SLUG = {c["slug"]: c for c in CATEGORIES}
AGE_BANDS   = ["6_to_8", "9_to_11", "12_to_14", "15_plus"]
DIFFS       = ["easy", "medium", "hard"]
AGE_ORD     = {a: i for i, a in enumerate(AGE_BANDS)}
AGE_MAX_EASY = {
    "6_to_8":   "9_to_11",
    "9_to_11":  "12_to_14",
    "12_to_14": "15_plus",
    "15_plus":  "15_plus",
}

AGE_NOTES = {
    "6_to_8":
        "IB PYP Years 1–3. TOP-DECILE 6–8 year olds: strong readers, handle 2–3 step "
        "reasoning, familiar with IB central ideas and lines of inquiry. Questions must be "
        "concept-led — not trivially obvious. All 4 distractors MUST be plausible — "
        "absolutely no joke or physically impossible options.",
    "9_to_11":
        "IB PYP Years 4–5 / MYP Year 1. TOP-DECILE 9–11 year olds: apply concepts to "
        "unfamiliar contexts, understand multi-step cause-and-effect chains, beginning to "
        "evaluate. Use PYP key concepts: form, function, causation, change, connection, "
        "perspective, responsibility, reflection.",
    "12_to_14":
        "IB MYP Years 2–4. TOP-DECILE 12–14 year olds: strong analytical thinkers, "
        "fluent with MYP global contexts and ATL skills. Questions MUST require evaluation "
        "or application to unfamiliar scenarios. Use MYP command terms: analyse, compare, "
        "evaluate, justify, discuss, examine.",
    "15_plus":
        "IB MYP Year 5 / DP Year 1. TOP-DECILE 15+ year olds: near DP level. Questions "
        "can draw on DP content — Maths (calculus, vectors, proof), Theory of Knowledge, "
        "DP Sciences, DP History. Use DP command terms: evaluate, synthesise, to what "
        "extent, critically assess. Distractors must represent genuine misconceptions that "
        "a confident but misinformed student would choose.",
}

DIFF_NOTES = {
    "easy":
        "EASY for top-decile IB students: direct recall or single-step application of a "
        "concept they have definitely studied. Still challenging — NOT trivially obvious. "
        "All 4 options must be plausible. Rotate correctAnswer evenly across A, B, C, D.",
    "medium":
        "MEDIUM: requires applying knowledge to a new context OR connecting two distinct "
        "concepts OR spotting a nuanced distinction. At least 2 distractors must represent "
        "genuine student misconceptions. Should require genuine thought.",
    "hard":
        "HARD: requires multi-step reasoning, evaluation of competing claims, or precise "
        "recall of a non-obvious detail. ALL distractors must be plausible for a "
        "well-studied student who hasn't fully grasped the nuance. Never let the answer "
        "be obvious from the question wording.",
}

SILLY_WORDS = [
    "can fly", "made of chalk", "turn to wood", "go swimming", "can shrink",
    "can vanish", "clouds are thinking", "shoe is faster", "soup tastes",
    "paint them invisible", "extra slippery", "magically disappear",
]

# ── UTILITIES ─────────────────────────────────────────────────────────────────

def fingerprint(text):
    return hashlib.md5((text or "").lower().strip().encode()).hexdigest()

def cell_key(slug, age, diff):
    return f"{slug}|{age}|{diff}"

def make_custom_id(slug, age, diff, pass_num, seq):
    return f"{slug}__{age}__{diff}__p{pass_num}__{seq}"

def parse_custom_id(cid):
    slug, age, diff, p, seq = cid.split("__")
    return slug, age, diff, int(p[1:]), int(seq)

# ── PROMPT BUILDER ────────────────────────────────────────────────────────────

def build_prompt(cat, age, diff, count, used_prompts):
    age_band_max = age if diff in ("medium", "hard") else AGE_MAX_EASY[age]
    avoid = ""
    if used_prompts:
        avoid = (
            "\n\nDo NOT repeat or closely rephrase any of these already-used prompts:\n"
            + "\n".join(f"- {p}" for p in used_prompts[-20:])
        )
    return (
        f"Generate exactly {count} multiple-choice quiz questions for a children's IB curriculum quiz app.\n"
        f"Output a JSON array ONLY — no markdown, no preamble, no commentary outside the array.\n\n"
        f"CATEGORY: {cat['name']}\n"
        f"IB CONTEXT: {cat['ctx']}\n\n"
        f"AGE BAND: {age.replace('_', ' ').replace(' to ', '–')} years\n"
        f"{AGE_NOTES[age]}\n\n"
        f"DIFFICULTY: {diff.upper()}\n"
        f"{DIFF_NOTES[diff]}\n\n"
        f"Each object in the array must have EXACTLY these fields:\n"
        f'{{\n'
        f'  "categorySlug": "{cat["slug"]}",\n'
        f'  "title": "<3–6 word topic label>",\n'
        f'  "prompt": "<question text, 1–3 sentences, varied phrasing>",\n'
        f'  "modality": "text",\n'
        f'  "difficulty": "{diff}",\n'
        f'  "ageBandMin": "{age}",\n'
        f'  "ageBandMax": "{age_band_max}",\n'
        f'  "answerType": "multiple_choice",\n'
        f'  "options": {{"A": "...", "B": "...", "C": "...", "D": "..."}},\n'
        f'  "correctAnswer": "<A|B|C|D>",\n'
        f'  "explanation": "<2–3 sentences: (a) why correct is right with a specific fact, (b) why top distractor is wrong>",\n'
        f'  "estimatedSeconds": <integer 20–90>,\n'
        f'  "active": true,\n'
        f'  "tags": ["{cat["slug"]}", "<subtopic1>", "<subtopic2>"]\n'
        f'}}\n\n'
        f"HARD CONSTRAINTS:\n"
        f"1. All 4 options MUST be plausible. No joke options. No physically impossible answers.\n"
        f"2. correctAnswer: across {count} questions, A/B/C/D must each appear ~{count // 4} times.\n"
        f"3. No two questions may share identical option texts.\n"
        f"4. estimatedSeconds = max(20, floor(total_word_count × 0.9)), cap 90.\n"
        f"5. Explanation: (a) WHY correct is right with a specific fact, (b) WHY top distractor is wrong.\n"
        f"6. Questions must genuinely challenge a TOP-DECILE IB student.\n"
        f'7. Vary formats: "Why does...", "A student claims X. Evaluate.", '
        f'"What would happen if...", "Compare X and Y...", "Identify the error in:", etc.\n'
        f"8. Cover DIFFERENT sub-topics within the category across the {count} questions."
        f"{avoid}\n\n"
        f"Output the JSON array now."
    )

# ── VALIDATOR ─────────────────────────────────────────────────────────────────

def validate_batch(raw, cat, age, diff):
    if not isinstance(raw, list):
        return []
    valid = []
    for q in raw:
        try:
            assert isinstance(q, dict)
            assert q.get("categorySlug") == cat["slug"]
            assert q.get("difficulty") == diff
            assert len(q.get("prompt", "").strip()) >= 15
            opts = q.get("options", {})
            assert set(opts.keys()) >= {"A", "B", "C", "D"}
            ca = q.get("correctAnswer")
            assert ca in opts
            assert len(q.get("explanation", "")) >= 25
            secs = q.get("estimatedSeconds")
            assert isinstance(secs, int) and 5 <= secs <= 120
            amin = AGE_ORD.get(q.get("ageBandMin"), -1)
            amax = AGE_ORD.get(q.get("ageBandMax"), -1)
            assert 0 <= amin <= amax
            valid.append(q)
        except AssertionError:
            pass
    return valid

def parse_response_text(text):
    text = text.strip()
    if text.startswith("```"):
        s, e = text.find("["), text.rfind("]")
        if s != -1 and e != -1:
            text = text[s:e + 1]
    return json.loads(text)

# ── SALVAGE ───────────────────────────────────────────────────────────────────

def load_salvageable():
    if not EXISTING_Q.exists():
        print("  No questions.jsonl found — starting fresh.")
        return []
    raw = [json.loads(l) for l in EXISTING_Q.read_text().splitlines() if l.strip()]
    id_to_slug = {}
    if EXISTING_C.exists():
        for l in EXISTING_C.read_text().splitlines():
            if l.strip():
                c = json.loads(l)
                id_to_slug[c["id"]] = c["slug"]
    for q in raw:
        q["_slug"] = id_to_slug.get(q.get("categoryId", ""), q.get("categorySlug", ""))
    bad = set()
    for q in raw:
        if "best matches the concept" in (q.get("explanation") or ""):
            bad.add(q["id"])
    seen = {}
    for q in raw:
        fp = fingerprint(q["prompt"])
        if fp in seen:
            bad.add(q["id"])
        else:
            seen[fp] = q["id"]
    cell_opt = defaultdict(Counter)
    for q in raw:
        k = f"{q['ageBandMin']}|{q['difficulty']}"
        ok = tuple(sorted((q.get("options") or {}).items()))
        cell_opt[k][ok] += 1
    seen_tmpl = defaultdict(set)
    for q in sorted(raw, key=lambda x: x.get("createdAt", "")):
        k = f"{q['ageBandMin']}|{q['difficulty']}"
        ok = tuple(sorted((q.get("options") or {}).items()))
        if cell_opt[k].get(ok, 0) >= 3:
            if ok in seen_tmpl[k]:
                bad.add(q["id"])
            else:
                seen_tmpl[k].add(ok)
    for q in raw:
        wrong = [v.lower() for kk, v in (q.get("options") or {}).items() if kk != q.get("correctAnswer")]
        if any(any(s in w for s in SILLY_WORDS) for w in wrong):
            bad.add(q["id"])
    good = [q for q in raw if q["id"] not in bad and q["_slug"] in SLUG_SET]
    print(f"  Loaded {len(raw)} existing → kept {len(good)} ({len(bad)} removed)")
    return [{
        "categorySlug": q["_slug"], "title": q.get("title", ""), "prompt": q["prompt"],
        "modality": q.get("modality", "text"), "difficulty": q["difficulty"],
        "ageBandMin": q["ageBandMin"], "ageBandMax": q.get("ageBandMax", q["ageBandMin"]),
        "answerType": q.get("answerType", "multiple_choice"), "options": q["options"],
        "correctAnswer": q["correctAnswer"], "explanation": q.get("explanation", ""),
        "estimatedSeconds": q.get("estimatedSeconds", 25), "active": True, "tags": q.get("tags", []),
    } for q in good]

# ── CHECKPOINT ────────────────────────────────────────────────────────────────

def load_checkpoint():
    if CHECKPOINT.exists():
        cp = json.loads(CHECKPOINT.read_text())
        print(f"  Checkpoint: {len(cp['questions'])} questions accumulated.")
        return cp
    return {"questions": [], "fps": []}

def save_checkpoint(questions, fps):
    CHECKPOINT.write_text(json.dumps({"questions": questions, "fps": list(fps)}, ensure_ascii=False))

def load_batch_state():
    if BATCH_STATE.exists():
        return json.loads(BATCH_STATE.read_text())
    return None

def save_batch_state(state):
    BATCH_STATE.write_text(json.dumps(state, ensure_ascii=False, indent=2))

def clear_batch_state():
    if BATCH_STATE.exists():
        BATCH_STATE.unlink()

# ── BATCH BUILD + SUBMIT ──────────────────────────────────────────────────────

def build_batch_requests(cell_needs, questions_by_cat, pass_num):
    requests = []
    for ck, need in cell_needs.items():
        slug, age, diff = ck.split("|")
        cat = CAT_BY_SLUG[slug]
        used = questions_by_cat.get(slug, [])
        n_calls = (need + BATCH_SIZE - 1) // BATCH_SIZE
        for seq in range(n_calls):
            this_need = min(BATCH_SIZE, need - seq * BATCH_SIZE)
            if this_need <= 0:
                break
            requests.append({
                "custom_id": make_custom_id(slug, age, diff, pass_num, seq),
                "params": {
                    "model": MODEL,
                    "max_tokens": 6000,
                    "temperature": 1.0,
                    "messages": [{"role": "user", "content": build_prompt(cat, age, diff, this_need, used)}],
                },
            })
    return requests

def submit_batch(client, requests):
    print(f"  Submitting {len(requests)} requests…")
    for attempt in range(5):
        try:
            batch = client.beta.messages.batches.create(requests=requests)
            print(f"  Batch ID : {batch.id}")
            print(f"  Expires  : {batch.expires_at}")
            return batch.id
        except Exception as e:
            if attempt == 4:
                raise
            wait = 15 * (2 ** attempt)
            print(f"  [attempt {attempt+1}/5] Error: {e} — retrying in {wait}s…")
            time.sleep(wait)

# ── POLLING ───────────────────────────────────────────────────────────────────

def poll_until_done(client, batch_id):
    print(f"  Polling every {POLL_SECS}s (Ctrl+C is safe — re-run to resume)\n")
    t0 = time.time()
    while True:
        batch = client.beta.messages.batches.retrieve(batch_id)
        rc = batch.request_counts
        elapsed = int(time.time() - t0)
        total = rc.processing + rc.succeeded + rc.errored + rc.canceled + rc.expired
        done  = rc.succeeded + rc.errored + rc.canceled + rc.expired
        pct   = int(100 * done / total) if total else 0
        print(f"  [{elapsed:5d}s]  {batch.processing_status:11}  {pct:3d}%  "
              f"✓{rc.succeeded}  ✗{rc.errored}  ⏳{rc.processing}")
        if batch.processing_status == "ended":
            print(f"\n  Batch complete — succeeded={rc.succeeded}  errored={rc.errored}")
            return
        time.sleep(POLL_SECS)

# ── RESULT PROCESSING ─────────────────────────────────────────────────────────

def process_results(client, batch_id, fp_set):
    new_questions = []
    seen_in_batch = set()
    for result in client.beta.messages.batches.results(batch_id):
        if result.result.type != "succeeded":
            print(f"  [SKIP] {result.custom_id} — {result.result.type}")
            continue
        slug, age, diff, _, _ = parse_custom_id(result.custom_id)
        if slug not in CAT_BY_SLUG:
            continue
        cat = CAT_BY_SLUG[slug]
        text = result.result.message.content[0].text
        try:
            raw = parse_response_text(text)
        except (json.JSONDecodeError, ValueError) as e:
            print(f"  [JSON ERR] {result.custom_id}: {e}")
            continue
        valid = validate_batch(raw, cat, age, diff)
        for q in valid:
            fp = fingerprint(q["prompt"])
            if fp not in fp_set and fp not in seen_in_batch:
                fp_set.add(fp)
                seen_in_batch.add(fp)
                q["id"] = str(uuid.uuid4())
                new_questions.append(q)
    return new_questions

# ── COVERAGE REPORT ───────────────────────────────────────────────────────────

def print_coverage(counts):
    total = len(CATEGORIES) * len(AGE_BANDS) * len(DIFFS)
    full  = sum(1 for c in CATEGORIES for a in AGE_BANDS for d in DIFFS
                if counts[cell_key(c["slug"], a, d)] >= TARGET)
    print(f"\n  Cells at target ({TARGET}+): {full}/{total}\n")
    col_w = 6
    AGE_LABELS = {"6_to_8":"6-8","9_to_11":"9-11","12_to_14":"12-14","15_plus":"15+"}
    hdr = f"  {'':32}" + "".join(
        f"{AGE_LABELS[a]}/{d[0].upper()}".ljust(col_w)
        for a in AGE_BANDS for d in DIFFS
    )
    print(hdr)
    for cat in CATEGORIES:
        row = f"  {cat['name']:<32}"
        for age in AGE_BANDS:
            for diff in DIFFS:
                n = counts[cell_key(cat["slug"], age, diff)]
                sym = "✓  " if n >= TARGET else f"{n:<3}"
                row += sym.ljust(col_w)
        print(row)
    print()

# ── MAIN ──────────────────────────────────────────────────────────────────────

def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        sys.exit(
            "ERROR: ANTHROPIC_API_KEY not set.\n"
            "Usage: ANTHROPIC_API_KEY=sk-ant-... python3 generate_witzy_questions.py"
        )

    client = anthropic.Anthropic(api_key=api_key)

    print("=" * 65)
    print(f"  Witzy IB Question Bank — Batch API  |  {MODEL}")
    print(f"  Target: {TARGET}/cell  |  Batch size: {BATCH_SIZE}/request  |  Max passes: {MAX_PASSES}")
    print("=" * 65)

    # Load state
    print("\n[1] Loading questions…")
    cp           = load_checkpoint()
    all_questions = cp["questions"]
    fp_set        = set(cp["fps"])

    if not all_questions and EXISTING_Q.exists():
        for q in load_salvageable():
            fp = fingerprint(q["prompt"])
            if fp not in fp_set:
                fp_set.add(fp)
                all_questions.append(q)
        print(f"  Starting with {len(all_questions)} salvaged questions.")
    elif all_questions:
        print(f"  Loaded {len(all_questions)} from checkpoint.")

    # Multi-pass generation loop
    for pass_num in range(1, MAX_PASSES + 1):

        cell_counts = Counter(
            cell_key(q["categorySlug"], q["ageBandMin"], q["difficulty"])
            for q in all_questions
        )
        cell_needs = {
            cell_key(c["slug"], a, d): TARGET - cell_counts[cell_key(c["slug"], a, d)]
            for c in CATEGORIES for a in AGE_BANDS for d in DIFFS
            if cell_counts[cell_key(c["slug"], a, d)] < TARGET
        }

        if not cell_needs:
            print(f"\n  All cells at target — done after {pass_num - 1} pass(es)!")
            break

        n_requests = sum((n + BATCH_SIZE - 1) // BATCH_SIZE for n in cell_needs.values())
        print(f"\n[Pass {pass_num}]  {len(cell_needs)} cells short  |  "
              f"~{sum(cell_needs.values())} questions needed  |  {n_requests} API requests")

        # Resume or start batch
        state = load_batch_state()
        if state and state.get("pass_num") == pass_num:
            batch_id = state["batch_id"]
            print(f"  Resuming batch {batch_id}")
        else:
            print(f"\n[2] Building requests…")
            by_cat = defaultdict(list)
            for q in all_questions:
                by_cat[q["categorySlug"]].append(q["prompt"])
            reqs = build_batch_requests(cell_needs, by_cat, pass_num)
            print(f"\n[3] Submitting…")
            batch_id = submit_batch(client, reqs)
            save_batch_state({"batch_id": batch_id, "pass_num": pass_num})

        # Poll
        print(f"\n[4] Waiting for batch…")
        try:
            poll_until_done(client, batch_id)
        except KeyboardInterrupt:
            print(f"\n  Interrupted. Batch {batch_id} runs server-side — re-run to resume.")
            save_checkpoint(all_questions, fp_set)
            return

        # Process
        print(f"\n[5] Processing results…")
        new_qs = process_results(client, batch_id, fp_set)
        all_questions.extend(new_qs)
        print(f"  +{len(new_qs)} questions  (total: {len(all_questions):,})")

        save_checkpoint(all_questions, fp_set)
        clear_batch_state()

        cell_counts = Counter(
            cell_key(q["categorySlug"], q["ageBandMin"], q["difficulty"])
            for q in all_questions
        )
        print_coverage(cell_counts)

    # Write output
    print(f"\n[Final] Writing {OUTPUT}…")
    out_cats = [{"slug": c["slug"], "name": c["name"], "icon": c["icon"], "active": True}
                for c in CATEGORIES]
    out_qs   = [{k: v for k, v in q.items() if not k.startswith("_")} for q in all_questions]
    OUTPUT.write_text(json.dumps({"categories": out_cats, "questions": out_qs}, ensure_ascii=False, indent=2))

    cell_counts = Counter(cell_key(q["categorySlug"], q["ageBandMin"], q["difficulty"]) for q in out_qs)
    full = sum(1 for c in CATEGORIES for a in AGE_BANDS for d in DIFFS
               if cell_counts[cell_key(c["slug"], a, d)] >= TARGET)

    print(f"\n{'=' * 65}")
    print(f"  ✅  Done!")
    print(f"  Output     : {OUTPUT}")
    print(f"  Categories : {len(out_cats)}")
    print(f"  Questions  : {len(out_qs):,}")
    print(f"  Cells full : {full}/{len(CATEGORIES) * len(AGE_BANDS) * len(DIFFS)}")
    print(f"\n  Import: corepack pnpm import:questions {OUTPUT}")
    print("=" * 65)

    clear_batch_state()
    if CHECKPOINT.exists():
        CHECKPOINT.unlink()


if __name__ == "__main__":
    main()
