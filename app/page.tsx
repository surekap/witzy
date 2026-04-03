import Image from "next/image";
import Link from "next/link";

import { primaryButtonClass, secondaryButtonClass } from "@/components/ui";

const pathways = [
  {
    number: "01",
    title: "Host a game",
    description: "Spin up a room, set the rules, and control the pace of each live round.",
    href: "/host",
    cardClass: "pathway-card pathway-card-coral",
    numColor: "var(--coral)",
    linkColor: "var(--coral)",
  },
  {
    number: "02",
    title: "Join a game",
    description: "Enter a room code, pick your age band, and get your personalized challenge.",
    href: "/join",
    cardClass: "pathway-card pathway-card-forest",
    numColor: "var(--forest)",
    linkColor: "var(--forest)",
  },
  {
    number: "03",
    title: "Practice mode",
    description: "Play a 10-question solo run with adaptive difficulty and instant feedback.",
    href: "/solo",
    cardClass: "pathway-card pathway-card-warm",
    numColor: "var(--warm-deep)",
    linkColor: "var(--warm-deep)",
  },
] as const;

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* ── Nav ── */}
      <header className="flex items-center justify-between pt-2">
        <Link href="/" className="flex items-center gap-2.5" style={{ textDecoration: "none" }}>
          <Image
            src="/media/logo.png"
            alt="Witzy logo"
            width={36}
            height={36}
            className="rounded-lg"
            unoptimized
          />
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 800,
              fontSize: "1.0625rem",
              color: "var(--ink)",
              letterSpacing: "-0.01em",
            }}
          >
            Witzy
          </span>
        </Link>
        <Link href="/join" className="btn btn-secondary btn-sm">
          Join a room →
        </Link>
      </header>

      {/* ── Hero ── */}
      <section className="space-y-6 py-4">
        <p className="section-eyebrow">Live multiplayer quiz and solo practice</p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "clamp(2.75rem, 7vw, 4.25rem)",
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
            maxWidth: "700px",
          }}
        >
          Shared category.
          <br />
          Private difficulty.
          <br />
          <span style={{ color: "var(--coral)" }}>Big family energy.</span>
        </h1>
        <p
          style={{
            fontSize: "1.125rem",
            color: "var(--ink-muted)",
            maxWidth: "520px",
            lineHeight: 1.65,
          }}
        >
          Kids answer simultaneously on their own devices. Everyone gets the same category
          — but each question is tuned to their level. Or jump into practice mode for a quick solo session.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link className={primaryButtonClass} href="/host">
            Host a game
          </Link>
          <Link className={secondaryButtonClass} href="/join">
            Join a room
          </Link>
          <Link className={secondaryButtonClass} href="/solo">
            Practice solo
          </Link>
        </div>
      </section>

      {/* ── Pathways ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {pathways.map((p) => (
          <Link key={p.title} href={p.href} className={p.cardClass}>
            <div>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: "2.25rem",
                  lineHeight: 1,
                  color: p.numColor,
                  opacity: 0.35,
                }}
              >
                {p.number}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "1.1875rem",
                  marginTop: "0.5rem",
                  color: "var(--ink)",
                }}
              >
                {p.title}
              </p>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--ink-muted)",
                  marginTop: "0.375rem",
                  lineHeight: 1.55,
                }}
              >
                {p.description}
              </p>
            </div>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "0.875rem",
                color: p.linkColor,
              }}
            >
              Open →
            </p>
          </Link>
        ))}
      </div>

      {/* ── Feature callouts ── */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Live rooms",
            text: "Hosts control pacing with lobby sync, countdowns, reveals, and rematches.",
          },
          {
            label: "Equal challenge",
            text: "Age bands and adaptive difficulty keep every round fair — without using the same question twice.",
          },
          {
            label: "Media ready",
            text: "Text, image, and audio questions all work inside the same round loop.",
          },
          {
            label: "Practice mode",
            text: "Solo players can warm up with adaptive questions and instant answer explanations.",
          },
        ].map(({ label, text }) => (
          <div key={label} className="feature-callout">
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "0.9375rem",
                color: "var(--ink)",
              }}
            >
              {label}
            </p>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--ink-muted)",
                marginTop: "0.375rem",
                lineHeight: 1.55,
              }}
            >
              {text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
