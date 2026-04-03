import { createImageDataUri, AUDIO_TONE_DATA_URI } from "@/lib/questions/media";
import type {
  AgeBand,
  AnswerKey,
  AnswerType,
  Category,
  Question,
  QuestionDifficulty,
  QuestionModality,
} from "@/types/game";

interface SeedCategory {
  slug: string;
  name: string;
  icon: string;
  items: Array<{
    subject: string;
    clue: string;
    correct: string;
    distractors: [string, string, string];
    fact: string;
  }>;
}

const now = "2026-04-02T00:00:00.000Z";

const seedCategories: SeedCategory[] = [
  {
    slug: "math",
    name: "Math",
    icon: "➗",
    items: [
      { subject: "triangle", clue: "a shape with three sides", correct: "Triangle", distractors: ["Square", "Circle", "Pentagon"], fact: "Triangles always have three angles." },
      { subject: "double", clue: "2 multiplied by 6", correct: "12", distractors: ["8", "10", "14"], fact: "Doubling 6 gives 12." },
      { subject: "half", clue: "one half of 18", correct: "9", distractors: ["6", "8", "10"], fact: "Half means divide by 2." },
      { subject: "odd number", clue: "a number that is not even", correct: "Odd number", distractors: ["Prime number", "Fraction", "Multiple"], fact: "Odd numbers end in 1, 3, 5, 7, or 9." },
      { subject: "quarters", clue: "four equal parts of a whole", correct: "Quarters", distractors: ["Halves", "Thirds", "Tenths"], fact: "A quarter is one part out of four equal parts." },
      { subject: "perimeter", clue: "the distance all the way around a shape", correct: "Perimeter", distractors: ["Area", "Volume", "Radius"], fact: "Perimeter measures the boundary." },
      { subject: "multiple of 5", clue: "a number ending in 0 or 5", correct: "Multiple of 5", distractors: ["Even number", "Prime number", "Square number"], fact: "Skip counting by fives lands on multiples of 5." },
      { subject: "right angle", clue: "an angle measuring 90 degrees", correct: "Right angle", distractors: ["Acute angle", "Obtuse angle", "Straight angle"], fact: "A square corner is a right angle." },
      { subject: "product", clue: "the answer to a multiplication problem", correct: "Product", distractors: ["Sum", "Difference", "Quotient"], fact: "Multiplication produces a product." },
      { subject: "fraction", clue: "a number that shows part of a whole", correct: "Fraction", distractors: ["Decimal", "Equation", "Pattern"], fact: "Fractions compare a part to a whole." },
    ],
  },
  {
    slug: "science",
    name: "Science",
    icon: "🔬",
    items: [
      { subject: "planet", clue: "a world that moves around a star", correct: "Planet", distractors: ["Comet", "Moon", "Asteroid"], fact: "Planets orbit stars." },
      { subject: "evaporation", clue: "liquid water turning into gas", correct: "Evaporation", distractors: ["Condensation", "Freezing", "Melting"], fact: "Heat can turn liquid water into vapor." },
      { subject: "mammal", clue: "an animal that feeds milk to its babies", correct: "Mammal", distractors: ["Reptile", "Fish", "Insect"], fact: "Mammals are warm-blooded vertebrates." },
      { subject: "gravity", clue: "the force that pulls things toward Earth", correct: "Gravity", distractors: ["Magnetism", "Friction", "Electricity"], fact: "Gravity keeps us on the ground." },
      { subject: "photosynthesis", clue: "how plants make food from sunlight", correct: "Photosynthesis", distractors: ["Respiration", "Pollination", "Digestion"], fact: "Plants use sunlight, water, and carbon dioxide to make sugar." },
      { subject: "solid", clue: "matter with a fixed shape", correct: "Solid", distractors: ["Gas", "Liquid", "Plasma"], fact: "Solids keep their own shape." },
      { subject: "habitat", clue: "the natural home of a living thing", correct: "Habitat", distractors: ["Predator", "Population", "Migration"], fact: "Habitats supply food, water, and shelter." },
      { subject: "vertebrate", clue: "an animal with a backbone", correct: "Vertebrate", distractors: ["Amphibian", "Arthropod", "Invertebrate"], fact: "Backbones protect the spinal cord." },
      { subject: "ecosystem", clue: "living things and their environment working together", correct: "Ecosystem", distractors: ["Organ", "Galaxy", "Molecule"], fact: "An ecosystem includes plants, animals, and nonliving parts." },
      { subject: "renewable energy", clue: "energy from sources that can be naturally replaced", correct: "Renewable energy", distractors: ["Fossil fuel", "Battery power", "Nuclear waste"], fact: "Solar and wind are renewable resources." },
    ],
  },
  {
    slug: "geography",
    name: "Geography",
    icon: "🗺️",
    items: [
      { subject: "Nile", clue: "the famous river flowing through northeastern Africa", correct: "Nile", distractors: ["Amazon", "Danube", "Yangtze"], fact: "The Nile flows through countries like Egypt and Sudan." },
      { subject: "continent", clue: "one of Earth's large landmasses", correct: "Continent", distractors: ["Ocean", "Country", "Capital"], fact: "There are seven continents." },
      { subject: "equator", clue: "the imaginary line around the middle of Earth", correct: "Equator", distractors: ["Prime Meridian", "Tropic of Cancer", "Hemisphere"], fact: "The equator divides the planet into the Northern and Southern Hemispheres." },
      { subject: "capital city", clue: "the city where a country's government is based", correct: "Capital city", distractors: ["Village", "Harbor", "Suburb"], fact: "Capitals often hold important national buildings." },
      { subject: "desert", clue: "a very dry region with little rainfall", correct: "Desert", distractors: ["Rainforest", "Tundra", "Wetland"], fact: "Deserts can be hot or cold." },
      { subject: "island", clue: "land surrounded by water", correct: "Island", distractors: ["Peninsula", "Valley", "Plateau"], fact: "Islands can be large like Greenland or small like coral cays." },
      { subject: "mountain range", clue: "a chain of connected mountains", correct: "Mountain range", distractors: ["Canyon", "Plain", "Delta"], fact: "The Himalayas are a mountain range." },
      { subject: "map scale", clue: "a tool that shows real distance on a map", correct: "Map scale", distractors: ["Compass rose", "Legend", "Border"], fact: "Map scales help compare map distance to real-world distance." },
      { subject: "hemisphere", clue: "half of Earth", correct: "Hemisphere", distractors: ["Longitude", "Climate", "Region"], fact: "Earth can be split into Northern and Southern Hemispheres." },
      { subject: "archipelago", clue: "a group of islands", correct: "Archipelago", distractors: ["Volcano", "Harbor", "Glacier"], fact: "Indonesia is a large archipelago nation." },
    ],
  },
  {
    slug: "history",
    name: "History",
    icon: "🏛️",
    items: [
      { subject: "timeline", clue: "a tool used to place events in order", correct: "Timeline", distractors: ["Map key", "Ledger", "Compass"], fact: "Timelines help historians see what happened first and last." },
      { subject: "ancient Egypt", clue: "the civilization known for pyramids and pharaohs", correct: "Ancient Egypt", distractors: ["Ancient Rome", "Maya civilization", "Viking Age"], fact: "Ancient Egypt flourished along the Nile." },
      { subject: "artifact", clue: "an object made or used by people in the past", correct: "Artifact", distractors: ["Equation", "Forecast", "Ingredient"], fact: "Artifacts give clues about daily life long ago." },
      { subject: "democracy", clue: "a system in which people vote for leaders", correct: "Democracy", distractors: ["Monarchy", "Empire", "Dictatorship"], fact: "Ancient Athens is often linked with early democracy." },
      { subject: "Industrial Revolution", clue: "a period when machines changed how goods were made", correct: "Industrial Revolution", distractors: ["Stone Age", "Renaissance", "Middle Ages"], fact: "Factories grew rapidly during the Industrial Revolution." },
      { subject: "explorer", clue: "a person who travels to learn about new places", correct: "Explorer", distractors: ["Inventor", "Farmer", "Poet"], fact: "Explorers recorded routes, plants, and cultures." },
      { subject: "constitution", clue: "a document explaining how a government works", correct: "Constitution", distractors: ["Diary", "Passport", "Newspaper"], fact: "Constitutions outline laws and powers." },
      { subject: "archaeologist", clue: "a scientist who studies human history through remains", correct: "Archaeologist", distractors: ["Meteorologist", "Biologist", "Cartographer"], fact: "Archaeologists excavate sites to find evidence." },
      { subject: "Renaissance", clue: "a time of renewed learning and art in Europe", correct: "Renaissance", distractors: ["Bronze Age", "Cold War", "Ice Age"], fact: "The Renaissance encouraged creativity and scientific thinking." },
      { subject: "oral history", clue: "stories about the past told by people who remember it", correct: "Oral history", distractors: ["Blueprint", "Census", "Timeline"], fact: "Oral histories preserve firsthand memories." },
    ],
  },
  {
    slug: "art",
    name: "Art",
    icon: "🎨",
    items: [
      { subject: "palette", clue: "the surface where a painter mixes colors", correct: "Palette", distractors: ["Easel", "Brush", "Canvas"], fact: "Palettes help artists blend paints." },
      { subject: "sculpture", clue: "art made in three dimensions", correct: "Sculpture", distractors: ["Mural", "Sketch", "Print"], fact: "Sculptures can be carved, modeled, or assembled." },
      { subject: "portrait", clue: "art that shows a person", correct: "Portrait", distractors: ["Landscape", "Still life", "Collage"], fact: "Portraits focus on a person or group." },
      { subject: "primary color", clue: "a basic color used to mix other colors", correct: "Primary color", distractors: ["Neutral color", "Pastel", "Tint"], fact: "Red, yellow, and blue are common primary colors in art class." },
      { subject: "texture", clue: "how something feels or looks like it feels", correct: "Texture", distractors: ["Balance", "Contrast", "Perspective"], fact: "Artists can show rough, smooth, or bumpy texture." },
      { subject: "mosaic", clue: "art made from many small pieces", correct: "Mosaic", distractors: ["Watercolor", "Poster", "Origami"], fact: "Mosaics can be made from tile, glass, or paper." },
      { subject: "horizon line", clue: "where land or sea seems to meet the sky in a picture", correct: "Horizon line", distractors: ["Vanishing point", "Border", "Outline"], fact: "The horizon line helps place perspective." },
      { subject: "contrast", clue: "a strong difference between things in art", correct: "Contrast", distractors: ["Pattern", "Scale", "Shade"], fact: "Contrast can make a focal point stand out." },
      { subject: "collage", clue: "art made by arranging and sticking pieces together", correct: "Collage", distractors: ["Fresco", "Pottery", "Weaving"], fact: "Collage combines materials into one image." },
      { subject: "ceramics", clue: "art made from clay and fired in heat", correct: "Ceramics", distractors: ["Ink wash", "Charcoal", "Engraving"], fact: "Ceramic works include bowls, tiles, and sculptures." },
    ],
  },
  {
    slug: "movies",
    name: "Movies",
    icon: "🎬",
    items: [
      { subject: "director", clue: "the person who guides how a film is made", correct: "Director", distractors: ["Cashier", "Audience", "Usher"], fact: "Directors shape performances and scenes." },
      { subject: "animation", clue: "movies created from drawn or computer-made frames", correct: "Animation", distractors: ["Documentary", "Trailer", "Musical"], fact: "Animation creates motion from many images shown quickly." },
      { subject: "soundtrack", clue: "the music and songs used in a film", correct: "Soundtrack", distractors: ["Subtitle", "Poster", "Stunt"], fact: "Soundtracks help set a movie's mood." },
      { subject: "sequel", clue: "a movie that continues an earlier story", correct: "Sequel", distractors: ["Premiere", "Audition", "Parody"], fact: "Sequels revisit familiar characters and worlds." },
      { subject: "credits", clue: "the list of people who worked on the movie", correct: "Credits", distractors: ["Props", "Scene", "Script"], fact: "Credits often appear at the beginning or end." },
      { subject: "genre", clue: "the type or style of a movie story", correct: "Genre", distractors: ["Ticket", "Camera", "Stage"], fact: "Comedy, mystery, and adventure are genres." },
      { subject: "screenplay", clue: "the written plan for dialogue and action in a film", correct: "Screenplay", distractors: ["Storyboard", "Trailer", "Wardrobe"], fact: "Screenplays guide actors and crew." },
      { subject: "close-up", clue: "a camera shot that shows a subject from very near", correct: "Close-up", distractors: ["Wide shot", "Pan shot", "Freeze frame"], fact: "Close-ups highlight emotion or detail." },
      { subject: "special effects", clue: "techniques that create movie magic beyond ordinary filming", correct: "Special effects", distractors: ["Box office", "Concession stand", "Premiere"], fact: "Effects can be practical or digital." },
      { subject: "documentary", clue: "a movie based on real people, places, or events", correct: "Documentary", distractors: ["Fantasy", "Musical", "Sitcom"], fact: "Documentaries aim to inform or explore real topics." },
    ],
  },
  {
    slug: "music",
    name: "Music",
    icon: "🎵",
    items: [
      { subject: "rhythm", clue: "the repeating beat pattern in music", correct: "Rhythm", distractors: ["Volume", "Tempo", "Harmony"], fact: "Rhythm organizes when sounds happen." },
      { subject: "melody", clue: "a tune made of notes", correct: "Melody", distractors: ["Silence", "Echo", "Pitch"], fact: "A melody is the singable part of a song." },
      { subject: "tempo", clue: "how fast or slow the music goes", correct: "Tempo", distractors: ["Timbre", "Chorus", "Scale"], fact: "A conductor may set the tempo." },
      { subject: "percussion", clue: "instruments played by striking, shaking, or scraping", correct: "Percussion", distractors: ["Strings", "Woodwinds", "Brass"], fact: "Drums are percussion instruments." },
      { subject: "chorus", clue: "the repeated section of a song", correct: "Chorus", distractors: ["Verse", "Bridge", "Solo"], fact: "The chorus often carries the main hook." },
      { subject: "pitch", clue: "how high or low a sound is", correct: "Pitch", distractors: ["Rhythm", "Beat", "Echo"], fact: "Pitch changes when note frequency changes." },
      { subject: "scale", clue: "a sequence of notes in order", correct: "Scale", distractors: ["Concert", "Lyric", "Chord"], fact: "Musicians practice scales to learn note patterns." },
      { subject: "conductor", clue: "the leader of an orchestra", correct: "Conductor", distractors: ["Narrator", "Producer", "Composer"], fact: "Conductors use gestures to guide musicians." },
      { subject: "harmony", clue: "notes sounding together to support a melody", correct: "Harmony", distractors: ["Solo", "Applause", "Pause"], fact: "Harmony adds richness to music." },
      { subject: "brass", clue: "the instrument family including trumpet and trombone", correct: "Brass", distractors: ["Strings", "Percussion", "Keyboard"], fact: "Brass instruments buzz through mouthpieces." },
    ],
  },
  {
    slug: "sports",
    name: "Sports",
    icon: "🏅",
    items: [
      { subject: "referee", clue: "the official who enforces rules during a game", correct: "Referee", distractors: ["Captain", "Coach", "Mascot"], fact: "Referees keep play fair." },
      { subject: "relay race", clue: "a race where teammates take turns", correct: "Relay race", distractors: ["Marathon", "Sprint", "Dive"], fact: "Batons are passed in many relay races." },
      { subject: "defense", clue: "the side trying to stop the other team from scoring", correct: "Defense", distractors: ["Timeout", "Warmup", "Tournament"], fact: "Defense protects the goal or basket." },
      { subject: "scoreboard", clue: "the display showing points and time", correct: "Scoreboard", distractors: ["Locker room", "Whistle", "Uniform"], fact: "Scoreboards help fans follow the game." },
      { subject: "gymnastics", clue: "a sport involving balance, strength, and flexible routines", correct: "Gymnastics", distractors: ["Cycling", "Rowing", "Baseball"], fact: "Gymnastics includes events like floor and beam." },
      { subject: "serve", clue: "the action that starts play in tennis or volleyball", correct: "Serve", distractors: ["Dribble", "Tackle", "Kickoff"], fact: "A strong serve can create an advantage." },
      { subject: "teammate", clue: "someone on your side in a sport", correct: "Teammate", distractors: ["Opponent", "Spectator", "Announcer"], fact: "Teams depend on communication and teamwork." },
      { subject: "goalkeeper", clue: "the player guarding the goal", correct: "Goalkeeper", distractors: ["Pitcher", "Quarterback", "Runner"], fact: "Goalkeepers often use their hands inside a special area." },
      { subject: "stamina", clue: "the ability to keep going for a long time", correct: "Stamina", distractors: ["Balance", "Style", "Uniform"], fact: "Endurance sports require stamina." },
      { subject: "medal", clue: "an award given to top finishers", correct: "Medal", distractors: ["Net", "Helmet", "Whistle"], fact: "Gold, silver, and bronze medals mark places." },
    ],
  },
  {
    slug: "computer-science",
    name: "Computer Science",
    icon: "💻",
    items: [
      { subject: "algorithm", clue: "a step-by-step set of instructions to solve a problem", correct: "Algorithm", distractors: ["Battery", "Monitor", "Sticker"], fact: "Algorithms can be written in code or plain language." },
      { subject: "debugging", clue: "finding and fixing mistakes in a program", correct: "Debugging", distractors: ["Downloading", "Printing", "Browsing"], fact: "Debugging improves how a program works." },
      { subject: "variable", clue: "a named place that stores a value in code", correct: "Variable", distractors: ["Browser", "Folder", "Keyboard"], fact: "Variables help programs remember information." },
      { subject: "loop", clue: "code that repeats actions", correct: "Loop", distractors: ["Mouse", "Pixel", "Cable"], fact: "Loops are useful when the same task happens many times." },
      { subject: "input", clue: "information sent into a computer or program", correct: "Input", distractors: ["Output", "Battery", "Speaker"], fact: "Typing or clicking gives a program input." },
      { subject: "output", clue: "information a computer sends back", correct: "Output", distractors: ["Storage", "Login", "Cursor"], fact: "Screens and speakers present output." },
      { subject: "binary", clue: "a number system using only 0 and 1", correct: "Binary", distractors: ["Decimal", "Roman numerals", "Fraction"], fact: "Computers use binary at a low level." },
      { subject: "program", clue: "a set of instructions a computer can run", correct: "Program", distractors: ["Monitor", "Modem", "Battery"], fact: "Apps and games are programs." },
      { subject: "network", clue: "computers linked so they can share information", correct: "Network", distractors: ["Compass", "Sketch", "Bookmark"], fact: "The internet is a giant network." },
      { subject: "function", clue: "a reusable block of code that does a job", correct: "Function", distractors: ["Cable", "Window", "Password"], fact: "Functions help keep code organized." },
    ],
  },
  {
    slug: "logic",
    name: "Logic",
    icon: "🧠",
    items: [
      { subject: "pattern", clue: "something arranged in a repeated way", correct: "Pattern", distractors: ["Secret", "Accident", "Mistake"], fact: "Patterns help us predict what comes next." },
      { subject: "clue", clue: "a piece of information that helps solve a puzzle", correct: "Clue", distractors: ["Prize", "Shortcut", "Warning"], fact: "Good clues narrow down possibilities." },
      { subject: "sequence", clue: "things placed in a particular order", correct: "Sequence", distractors: ["Estimate", "Shortcut", "Guess"], fact: "Sequences can be numbers, letters, or actions." },
      { subject: "deduction", clue: "using facts to figure out an answer", correct: "Deduction", distractors: ["Decoration", "Imagination", "Repetition"], fact: "Deduction relies on evidence." },
      { subject: "analogy", clue: "a comparison that shows how two things are alike", correct: "Analogy", distractors: ["Contradiction", "Diagram", "Equation"], fact: "Analogies help explain relationships." },
      { subject: "riddle", clue: "a puzzle asked as a clever question", correct: "Riddle", distractors: ["Recipe", "Reminder", "Report"], fact: "Riddles often rely on wordplay." },
      { subject: "strategy", clue: "a plan for reaching a goal", correct: "Strategy", distractors: ["Luck", "Weather", "Decoration"], fact: "Good strategies break big problems into smaller ones." },
      { subject: "inference", clue: "a conclusion based on evidence and reasoning", correct: "Inference", distractors: ["Illustration", "Reaction", "Measurement"], fact: "Readers make inferences from clues in a text." },
      { subject: "elimination", clue: "crossing off choices that cannot be right", correct: "Elimination", distractors: ["Celebration", "Estimation", "Translation"], fact: "Elimination is a strong puzzle-solving tactic." },
      { subject: "condition", clue: "a rule that must be true before something happens", correct: "Condition", distractors: ["Emotion", "Decoration", "Direction"], fact: "Logic puzzles often include if-then conditions." },
    ],
  },
];

const tones = ["#ea580c", "#0f766e", "#2563eb", "#be185d", "#7c3aed", "#0891b2"];

const promptTemplates: Record<QuestionDifficulty, string[]> = {
  easy: [
    'Which answer best matches this clue about {category}? {clue}',
    'Pick the best {category} answer for this clue: {clue}',
    'Warm-up clue: in {category}, which choice fits best? {clue}',
  ],
  medium: [
    'True or false: {statement}',
    'Decide whether this {category} statement is true or false: {statement}',
    'Quick check: true or false? {statement}',
  ],
  hard: [
    'Advanced clue: {fact} Which answer fits best?',
    'Challenge round: use this fact to choose the strongest {category} answer. {fact}',
    'Think carefully: {fact} Which option is the best match?',
  ],
};

const ageRangeVariantsByDifficulty: Record<QuestionDifficulty, Array<{ min: AgeBand; max: AgeBand }>> = {
  easy: [
    { min: "6_to_8", max: "6_to_8" },
    { min: "6_to_8", max: "9_to_11" },
    { min: "6_to_8", max: "12_to_14" },
    { min: "9_to_11", max: "9_to_11" },
  ],
  medium: [
    { min: "6_to_8", max: "9_to_11" },
    { min: "9_to_11", max: "9_to_11" },
    { min: "9_to_11", max: "12_to_14" },
    { min: "6_to_8", max: "12_to_14" },
    { min: "9_to_11", max: "15_plus" },
  ],
  hard: [
    { min: "9_to_11", max: "12_to_14" },
    { min: "12_to_14", max: "12_to_14" },
    { min: "12_to_14", max: "15_plus" },
    { min: "9_to_11", max: "15_plus" },
    { min: "15_plus", max: "15_plus" },
  ],
};

const imageMediaCategories = new Set(["geography", "art", "movies", "history"]);
const audioMediaCategories = new Set(["music", "movies"]);

function buildCategoryId(index: number) {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}

function buildQuestionId(categoryIndex: number, itemIndex: number, variantIndex: number) {
  return `10000000-${categoryIndex.toString().padStart(4, "0")}-4000-${itemIndex
    .toString()
    .padStart(4, "0")}-${variantIndex.toString().padStart(12, "0")}`;
}

function rotateOptions(correct: string, distractors: [string, string, string], variantIndex: number) {
  const keys: AnswerKey[] = ["A", "B", "C", "D"];
  const values = [correct, ...distractors];
  const offset = variantIndex % values.length;
  const rotated = values.slice(offset).concat(values.slice(0, offset));
  const correctAnswer = keys[rotated.indexOf(correct)];

  return {
    options: {
      A: rotated[0],
      B: rotated[1],
      C: rotated[2],
      D: rotated[3],
    } satisfies Partial<Record<AnswerKey, string>>,
    correctAnswer,
  };
}

function buildDistractorSet(category: SeedCategory, itemIndex: number, variantIndex: number): [string, string, string] {
  const otherAnswers = category.items
    .filter((_, candidateIndex) => candidateIndex !== itemIndex)
    .map((candidate) => candidate.correct);
  const combinations: [string, string, string][] = [];

  for (let first = 0; first < otherAnswers.length - 2; first += 1) {
    for (let second = first + 1; second < otherAnswers.length - 1; second += 1) {
      for (let third = second + 1; third < otherAnswers.length; third += 1) {
        combinations.push([otherAnswers[first], otherAnswers[second], otherAnswers[third]]);
      }
    }
  }

  return combinations[variantIndex % combinations.length];
}

function getItemByAnswer(category: SeedCategory, answer: string) {
  const item = category.items.find((candidate) => candidate.correct === answer);

  if (!item) {
    throw new Error(`Missing seed item for answer "${answer}" in ${category.slug}`);
  }

  return item;
}

function buildTrueFalseOptions(isTrueStatement: boolean, variantIndex: number) {
  const truthFirst = variantIndex % 2 === 0;
  const options = truthFirst
    ? ({ A: "True", B: "False" } satisfies Partial<Record<AnswerKey, string>>)
    : ({ A: "False", B: "True" } satisfies Partial<Record<AnswerKey, string>>);

  const correctAnswer: AnswerKey = isTrueStatement
    ? truthFirst
      ? "A"
      : "B"
    : truthFirst
      ? "B"
      : "A";

  return { options, correctAnswer };
}

function resolveAgeRange(difficulty: QuestionDifficulty, variantIndex: number) {
  const ranges = ageRangeVariantsByDifficulty[difficulty];
  return ranges[variantIndex % ranges.length];
}

function interpolateTemplate(
  template: string,
  values: Record<"category" | "clue" | "fact" | "statement", string>,
) {
  return template
    .replaceAll("{category}", values.category)
    .replaceAll("{clue}", values.clue)
    .replaceAll("{fact}", values.fact)
    .replaceAll("{statement}", values.statement);
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildAnswerVariants(answer: string) {
  const variants = new Set<string>([answer]);

  if (answer.endsWith("y")) {
    variants.add(`${answer.slice(0, -1)}ies`);
  }

  variants.add(`${answer}s`);
  variants.add(`${answer}es`);

  return [...variants].sort((left, right) => right.length - left.length);
}

function sanitizePromptReference(text: string, answer: string) {
  return buildAnswerVariants(answer).reduce((current, variant) => {
    const pattern = new RegExp(`\\b${escapeRegExp(variant)}\\b`, "gi");
    return current.replace(pattern, "this concept");
  }, text);
}

function buildPairOptions(
  category: SeedCategory,
  itemIndex: number,
  distractors: [string, string, string],
  variantIndex: number,
) {
  const item = category.items[itemIndex];
  const [distractorOne, distractorTwo, distractorThree] = distractors.map((answer) =>
    getItemByAnswer(category, answer),
  );
  const keys: AnswerKey[] = ["A", "B", "C", "D"];
  const pairCards = [
    `${item.correct} — ${item.fact}`,
    `${distractorOne.correct} — ${item.fact}`,
    `${item.correct} — ${distractorTwo.fact}`,
    `${distractorThree.correct} — ${distractorOne.clue}`,
  ];
  const offset = variantIndex % pairCards.length;
  const rotated = pairCards.slice(offset).concat(pairCards.slice(0, offset));
  const correctAnswer = keys[rotated.indexOf(pairCards[0])];

  return {
    options: {
      A: rotated[0],
      B: rotated[1],
      C: rotated[2],
      D: rotated[3],
    } satisfies Partial<Record<AnswerKey, string>>,
    correctAnswer,
  };
}

function buildDifficultyVariant(
  category: SeedCategory,
  categoryIndex: number,
  categoryId: string,
  itemIndex: number,
  difficulty: QuestionDifficulty,
  variantIndex: number,
) {
  const item = category.items[itemIndex];
  const distractors = buildDistractorSet(category, itemIndex, variantIndex);
  const candidateSetText = [item.correct, ...distractors].join(", ");
  const tone = tones[(categoryIndex + itemIndex) % tones.length];
  const mediaPreference = audioMediaCategories.has(category.slug)
    ? "audio"
    : imageMediaCategories.has(category.slug)
      ? "image"
      : "text";

  let answerType: AnswerType = "multiple_choice";
  let modality: QuestionModality = "text";
  let prompt = "";
  let explanation = `${item.fact} That makes "${item.correct}" the best match.`;
  let { options, correctAnswer }: { options: Partial<Record<AnswerKey, string>>; correctAnswer: AnswerKey } =
    rotateOptions(item.correct, distractors, variantIndex);
  let mediaUrl: string | null = null;
  let mediaAltText: string | null = null;
  const variantFamily = Math.floor(variantIndex / difficultyOrder.length);
  const sanitizedClue = sanitizePromptReference(item.clue, item.correct);
  const sanitizedFact = sanitizePromptReference(item.fact, item.correct);
  const templateValues = {
    category: category.name.toLowerCase(),
    clue: sanitizedClue,
    fact: sanitizedFact,
    statement: "",
  };

  if (difficulty === "medium") {
    answerType = "true_false";
    const wrongItem = getItemByAnswer(category, distractors[variantIndex % distractors.length]);
    const mediumStyle = variantFamily % 4;
    const isTrueStatement = variantIndex % 2 === 0;
    const statement =
      mediumStyle === 0
        ? isTrueStatement
          ? `${item.correct} matches this clue: ${item.clue}.`
          : `${wrongItem.correct} matches this clue: ${item.clue}.`
        : mediumStyle === 1
          ? isTrueStatement
            ? `${item.correct} is best described by this fact: ${item.fact}.`
            : `${item.correct} is best described by this fact: ${wrongItem.fact}.`
          : mediumStyle === 2
            ? isTrueStatement
              ? `${item.fact} is a true fact about ${item.correct}.`
              : `${wrongItem.fact} is a true fact about ${item.correct}.`
            : isTrueStatement
              ? `${item.correct} belongs with both this clue and fact: ${item.clue}; ${item.fact}`
              : `${wrongItem.correct} belongs with both this clue and fact: ${item.clue}; ${item.fact}`;
    templateValues.statement = statement;
    prompt = interpolateTemplate(
      promptTemplates.medium[variantIndex % promptTemplates.medium.length],
      templateValues,
    );
    prompt = `${prompt} Candidates in play: ${candidateSetText}.`;
    ({ options, correctAnswer } = buildTrueFalseOptions(isTrueStatement, variantIndex));
    explanation = isTrueStatement
      ? `${item.fact} So "True" is correct.`
      : `${item.fact} The clue actually points to "${item.correct}", so "False" is correct.`;
  } else {
    const easyOrHardStyle = variantFamily % 4;
    prompt =
      difficulty === "easy"
        ? easyOrHardStyle === 0
            ? interpolateTemplate(
              promptTemplates.easy[variantIndex % promptTemplates.easy.length],
              templateValues,
            )
          : easyOrHardStyle === 1
            ? `Which ${category.name.toLowerCase()} answer is best described by this fact? ${sanitizedFact}`
            : easyOrHardStyle === 2
              ? `Which answer fits both this clue and fact? ${sanitizedClue} ${sanitizedFact}`
              : `Classroom note: "${sanitizedClue}" and "${sanitizedFact}" point to which answer?`
        : easyOrHardStyle === 0
          ? interpolateTemplate(
              promptTemplates.hard[variantIndex % promptTemplates.hard.length],
              templateValues,
            )
          : easyOrHardStyle === 1
            ? `Challenge clue: use both hints to choose the best answer. ${sanitizedClue} ${sanitizedFact}`
            : easyOrHardStyle === 2
              ? "Which option keeps the term and description correctly matched?"
              : `Only one answer truly fits this advanced note about ${category.name.toLowerCase()}: ${sanitizedFact}`;
  }

  if (difficulty === "hard") {
    explanation = `${item.fact} The strongest answer is "${item.correct}".`;

    if (variantFamily % 4 === 2) {
      ({ options, correctAnswer } = buildPairOptions(category, itemIndex, distractors, variantIndex));
    }

    if (mediaPreference === "image" && variantIndex % 2 === 0) {
      modality = "image";
      answerType = variantFamily % 4 === 2 ? "multiple_choice" : "single_tap_image";
      mediaUrl = createImageDataUri(item.subject, category.name, tone);
      mediaAltText = `Illustrated clue card for ${item.subject} in ${category.name}`;
      prompt = `Study the clue card and choose the best ${category.name.toLowerCase()} match.`;
    }

    if (mediaPreference === "audio" && variantIndex % 2 === 0) {
      modality = "audio";
      mediaUrl = AUDIO_TONE_DATA_URI;
      mediaAltText = `Short demo audio stinger for ${item.subject} in ${category.name}`;
      prompt = `Listen to the short demo stinger, then use the clue "${sanitizedClue}" to choose the best answer.`;
      explanation = `${item.fact} The audio clip is included as a lightweight demo cue.`;
    }
  }

  if (difficulty === "easy" && mediaPreference === "image" && variantIndex % 5 === 0) {
    modality = "image";
    mediaUrl = createImageDataUri(item.subject, category.name, tone);
    mediaAltText = `Colorful clue card for ${item.subject} in ${category.name}`;
    prompt = `Look at the clue card and pick the best answer.`;
  }

  if (difficulty === "easy" && mediaPreference === "audio" && variantIndex % 5 === 0) {
    modality = "audio";
    mediaUrl = AUDIO_TONE_DATA_URI;
    mediaAltText = `Short demo audio stinger for ${item.subject} in ${category.name}`;
    prompt = `Play the short demo stinger, then use the clue "${sanitizedClue}" to choose the best answer.`;
  }

  if (difficulty === "medium" && mediaPreference === "image" && variantIndex % 7 === 0) {
    modality = "image";
    mediaUrl = createImageDataUri(item.subject, category.name, tone);
    mediaAltText = `Illustrated medium clue card for ${item.subject} in ${category.name}`;
  }

  if (difficulty === "medium" && mediaPreference === "audio" && variantIndex % 7 === 0) {
    modality = "audio";
    mediaUrl = AUDIO_TONE_DATA_URI;
    mediaAltText = `Medium audio clue for ${item.subject} in ${category.name}`;
  }

  const ageRange = resolveAgeRange(difficulty, variantIndex);

  return {
    id: buildQuestionId(categoryIndex + 1, itemIndex + 1, variantIndex + 1),
    categoryId,
    title: `${category.name} ${difficulty} ${itemIndex + 1}.${variantIndex + 1}`,
    prompt,
    modality,
    difficulty,
    ageBandMin: ageRange.min,
    ageBandMax: ageRange.max,
    answerType,
    options,
    correctAnswer,
    explanation,
    mediaUrl,
    mediaAltText,
    estimatedSeconds: difficulty === "easy" ? 10 + (variantIndex % 3) : difficulty === "medium" ? 15 + (variantIndex % 4) : 20 + (variantIndex % 5),
    active: true,
    tags: [category.slug, difficulty, item.subject, ageRange.min, ageRange.max, modality, `family_${variantFamily % 4}`],
    createdAt: now,
    updatedAt: now,
  } satisfies Question;
}

export function buildSeedData(options?: { targetQuestionCount?: number }) {
  const categories: Category[] = seedCategories.map((category) => ({
    id: buildCategoryId(seedCategories.findIndex((entry) => entry.slug === category.slug) + 1),
    slug: category.slug,
    name: category.name,
    icon: category.icon,
    active: true,
  }));

  const totalSeedItems = seedCategories.reduce((total, category) => total + category.items.length, 0);
  const targetQuestionCount = options?.targetQuestionCount ?? totalSeedItems * difficultyOrder.length;
  const variantsPerItem = Math.max(1, Math.ceil(targetQuestionCount / totalSeedItems));
  const questions: Question[] = [];

  for (const [categoryIndex, category] of seedCategories.entries()) {
    const categoryId = buildCategoryId(categoryIndex + 1);

    for (const [itemIndex] of category.items.entries()) {
      for (let variantIndex = 0; variantIndex < variantsPerItem; variantIndex += 1) {
        if (questions.length >= targetQuestionCount) {
          break;
        }

        const difficulty = difficultyOrder[variantIndex % difficultyOrder.length];
        questions.push(
          buildDifficultyVariant(
            category,
            categoryIndex,
            categoryId,
            itemIndex,
            difficulty,
            variantIndex,
          ),
        );
      }
    }
  }

  return {
    categories,
    questions,
  };
}

export const difficultyOrder: QuestionDifficulty[] = ["easy", "medium", "hard"];
