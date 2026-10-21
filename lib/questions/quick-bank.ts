import type { AgeBand, Category, Question, QuestionDifficulty } from "@/types/game";
import { questionQualityIssues } from "@/lib/questions/quality";

type Item = [AgeBand, QuestionDifficulty, string, string, string, string, string, string];
// Authored starter material with explicit prerequisites. The legacy bank is not
// relabelled or truncated. Educators can expand these pools through reviewed imports.
const science: Item[] = [
  ["6_to_8", "easy", "What does an ice cube become when it melts?", "Water", "Steam", "Snow", "Salt", "Melting changes solid ice into liquid water."],
  ["6_to_8", "easy", "Which part of a plant takes in water from soil?", "Roots", "Flowers", "Leaves", "Seeds", "Roots absorb water from the soil."],
  ["6_to_8", "medium", "Which material usually lets you see through it?", "Clear glass", "Cardboard", "Wood", "Metal", "Clear glass lets light pass through so you can see objects behind it."],
  ["9_to_11", "easy", "Which force pulls a dropped ball towards Earth?", "Gravity", "Friction", "Magnetism", "Tension", "Gravity attracts the ball towards Earth."],
  ["9_to_11", "medium", "Two identical wet towels hang outside. Which should dry faster?", "One in moving air", "One in still air", "One folded tightly", "One inside a bag", "Moving air carries water vapour away, helping evaporation."],
  ["9_to_11", "hard", "To test whether light affects plant growth, what should stay the same?", "Water given", "Light received", "Plant height measured", "Growth observed", "Keep water and other conditions equal while changing light."],
  ["12_to_14", "easy", "Which change forms a new substance?", "Iron rusting", "Ice melting", "Glass breaking", "Water boiling", "Rusting produces iron oxides, which are new substances."],
  ["12_to_14", "medium", "A sealed syringe contains air. Pushing its plunger increases pressure because particles do what?", "Hit walls more often", "Become much larger", "Lose all motion", "Turn into a liquid", "Less space means more frequent collisions with the walls."],
  ["12_to_14", "hard", "A car doubles its speed. At constant mass, its kinetic energy becomes how large?", "Four times as large", "Twice as large", "Half as large", "Eight times as large", "Kinetic energy is proportional to speed squared."],
  ["15_plus", "easy", "Which quantity is conserved in an isolated collision?", "Total momentum", "Each object's speed", "Each object's kinetic energy", "Total volume", "An isolated system has no net external force, so total momentum is conserved."],
  ["15_plus", "medium", "Enzyme activity falls sharply above its optimum temperature. What usually explains this?", "Active site changes shape", "Substrate gains extra mass", "Products become enzymes", "All collisions stop", "Heat can denature the enzyme, changing its active site."],
  ["15_plus", "hard", "A reaction has a positive enthalpy change. Which description follows?", "It absorbs heat", "It releases heat", "It must be fast", "It cannot occur", "A positive enthalpy change means the reaction absorbs heat at constant pressure."],
];
const language: Item[] = [
  ["6_to_8", "easy", "Which word means the opposite of hot?", "Cold", "Warm", "Dry", "Bright", "Cold is the opposite of hot."],
  ["6_to_8", "medium", "Which word names an action?", "Jump", "Chair", "Blue", "Soft", "Jump is a verb: it tells what someone does."],
  ["6_to_8", "hard", "Sam put on boots and opened an umbrella. What is the weather probably like?", "Rainy", "Sunny", "Snowy", "Foggy", "An umbrella and boots are clues that Sam expects rain."],
  ["9_to_11", "easy", "Which sentence uses an adjective?", "The red kite flies", "The kite flies", "Kites can fly", "Fly the kite", "Red describes the kite, so it is an adjective."],
  ["9_to_11", "medium", "Which phrase is a simile?", "Quiet as a mouse", "The wind whispered", "Time is money", "A mountain of work", "A simile compares things using like or as."],
  ["9_to_11", "hard", "Mia said she was fine, but her hands shook. What does this suggest?", "She may feel nervous", "She is certainly bored", "She has fallen asleep", "She wants more food", "Shaking hands suggest nervousness despite what Mia says."],
  ["12_to_14", "easy", "Which sentence uses passive voice?", "The window was broken", "Ben broke the window", "Ben opens the window", "The window faces north", "In passive voice, the subject receives the action."],
  ["12_to_14", "medium", "A narrator contradicts facts other characters confirm. What should a reader question?", "The narrator's reliability", "The book's page count", "The story's font", "The author's spelling", "Contradictions can signal an unreliable narrator."],
  ["12_to_14", "hard", "A story opens with a broken lock that matters later. Which technique is used?", "Foreshadowing", "Onomatopoeia", "Alliteration", "Hyperbole", "An early clue to a later event is foreshadowing."],
  ["15_plus", "easy", "Which claim is easiest to verify objectively?", "The train left at noon", "The journey was wonderful", "The seats were beautiful", "The station felt welcoming", "Departure time can be checked against records."],
  ["15_plus", "medium", "An argument attacks a speaker's appearance instead of their evidence. Which fallacy is this?", "Ad hominem", "False dilemma", "Circular reasoning", "Slippery slope", "Ad hominem attacks the person rather than addressing the argument."],
  ["15_plus", "hard", "A writer repeats 'We will' at the start of successive sentences. Which device is used?", "Anaphora", "Irony", "Euphemism", "Oxymoron", "Anaphora repeats a word or phrase at the beginning of successive clauses."],
];
const society: Item[] = [
  ["6_to_8", "easy", "Two children want the same swing. What gives both a fair chance?", "Take turns", "Push ahead", "Hide the swing", "Shout louder", "Taking turns gives each child time to play."],
  ["6_to_8", "medium", "Your friend says a game hurts their feelings. What should you do first?", "Listen to them", "Laugh at them", "Ignore them", "Blame someone else", "Listening helps you understand what upset your friend."],
  ["9_to_11", "easy", "What is the main purpose of a school fire drill?", "Practise leaving safely", "Choose class leaders", "Test sports skills", "Count library books", "A drill teaches everyone the safe route and meeting place."],
  ["9_to_11", "medium", "A class votes on a trip. What makes the vote fair?", "Each pupil gets one vote", "Friends get extra votes", "Only winners may vote", "Votes change after counting", "Equal voting rules give everyone an equal voice."],
  ["12_to_14", "easy", "A budget's spending exceeds its income. What does it show?", "A deficit", "A surplus", "A profit", "A balance", "A deficit occurs when spending is greater than income."],
  ["12_to_14", "medium", "A survey asks only a football team's fans about the best team. What is its main weakness?", "Biased sample", "Too many questions", "Random selection", "Identical results", "Fans of one team do not represent all football viewers."],
  ["15_plus", "medium", "A tax on pollution aims to make producers account for what?", "Costs imposed on others", "Only their wage costs", "Their past sales revenue", "Only imported materials", "Pollution creates external costs that market prices may not reflect."],
  ["15_plus", "hard", "A price ceiling below equilibrium usually creates what, other things equal?", "A shortage", "A surplus", "Unlimited supply", "No demand", "At the lower price, quantity demanded exceeds quantity supplied."],
];
const history: Item[] = [
  ["6_to_8", "easy", "Which tells you what happened before you were born?", "An old family photo", "Tomorrow's lunch menu", "A blank page", "A new shopping list", "An old photo records a moment from the past."],
  ["6_to_8", "medium", "Which comes first in this order: morning, afternoon, evening?", "Morning", "Afternoon", "Evening", "Midnight", "Morning comes before afternoon and evening."],
  ["9_to_11", "easy", "Which is a primary source about a past journey?", "The traveller's diary", "A modern textbook", "A later film review", "A recent encyclopedia", "A diary written by the traveller is a firsthand source."],
  ["9_to_11", "medium", "Why might two witnesses describe the same event differently?", "They noticed different details", "Events have no facts", "Only one can remember", "All memories are identical", "Witnesses see events from different positions and perspectives."],
  ["12_to_14", "easy", "Which invention helped spread printed books in fifteenth-century Europe?", "Movable-type printing press", "Steam locomotive", "Electric telegraph", "Mechanical refrigerator", "Gutenberg's press made producing many copies of books easier."],
  ["12_to_14", "medium", "Before using a wartime poster as evidence, what should a historian consider?", "Its intended audience", "Its frame's price", "Its current wall colour", "Its storage box size", "Audience and purpose help reveal persuasion or bias."],
  ["15_plus", "medium", "Two independent contemporary sources agree about an event. This mainly strengthens what?", "Corroboration", "Chronology", "Censorship", "Anachronism", "Independent agreement provides corroborating evidence, though it does not guarantee truth."],
  ["15_plus", "hard", "A historian explains an ancient decision using only modern values. What risk arises?", "Presentism", "Corroboration", "Periodisation", "Preservation", "Presentism judges the past without enough attention to its historical context."],
];
const art: Item[] = [
  ["6_to_8", "easy", "Which tool is used to spread paint?", "Brush", "Ruler", "Scissors", "Stapler", "A brush holds and spreads paint."],
  ["6_to_8", "medium", "Which artwork is made by sticking pieces of paper together?", "Collage", "Sculpture", "Sketch", "Print", "A collage combines pieces of material on a surface."],
  ["9_to_11", "easy", "Which word means how fast music is played?", "Tempo", "Pitch", "Volume", "Timbre", "Tempo describes musical speed."],
  ["9_to_11", "medium", "An artist places a bright shape on a dark background. What helps it stand out?", "Contrast", "Symmetry", "Repetition", "Perspective", "The difference between light and dark creates contrast."],
  ["12_to_14", "easy", "Parallel lines seem to meet in a drawing. What is that meeting point called?", "Vanishing point", "Midpoint", "Focal length", "Colour wheel", "Linear perspective uses vanishing points to suggest depth."],
  ["12_to_14", "medium", "A film cuts between two events happening at once. Which technique is this?", "Cross-cutting", "Slow motion", "Freeze frame", "Voice-over", "Cross-cutting alternates between actions, often suggesting simultaneity."],
  ["15_plus", "medium", "A composer shifts a piece from one key to another. What is this called?", "Modulation", "Syncopation", "Articulation", "Orchestration", "Modulation is a change of musical key."],
  ["15_plus", "hard", "A filmmaker leaves a character outside the frame while their voice continues. Which space is used?", "Off-screen space", "Negative exposure", "Deep focus", "Slow motion", "Off-screen space contains action or sound beyond the visible frame."],
];
const planet: Item[] = [
  ["6_to_8", "easy", "What should you turn off while brushing your teeth to save water?", "The tap", "The mirror", "The toothbrush", "The towel", "Turning off a running tap saves water."],
  ["6_to_8", "medium", "Which animal can breathe underwater using gills?", "Trout", "Rabbit", "Pigeon", "Lizard", "Trout are fish and use gills to take oxygen from water."],
  ["9_to_11", "easy", "Which source of energy is renewable?", "Sunlight", "Coal", "Petrol", "Natural gas", "Sunlight is replenished naturally, unlike fossil fuels."],
  ["9_to_11", "medium", "In grass, rabbit, fox, which is the producer?", "Grass", "Rabbit", "Fox", "All three", "Grass makes its own food using sunlight."],
  ["12_to_14", "easy", "Which gas do plants absorb during photosynthesis?", "Carbon dioxide", "Oxygen", "Hydrogen", "Helium", "Plants use carbon dioxide and water to make sugars."],
  ["12_to_14", "medium", "Fertiliser enters a lake and algae grow rapidly. What may happen as the algae decay?", "Dissolved oxygen decreases", "Dissolved oxygen always doubles", "All bacteria disappear", "Water becomes pure", "Decomposers use oxygen while breaking down dead algae."],
  ["15_plus", "medium", "Why does greater biodiversity often improve ecosystem resilience?", "Species can fill overlapping roles", "Every species needs identical food", "Predators always disappear", "Climate stops changing", "Overlapping ecological roles can buffer the loss or decline of one species."],
  ["15_plus", "hard", "Which change is a positive climate feedback?", "Melting ice reduces reflectivity", "Clouds reflect more incoming sunlight", "Extra plant growth stores carbon", "Warmer surfaces radiate more heat", "Less reflective ice exposes darker surfaces, increasing absorption and further warming."],
];
const logic: Item[] = [
  ["6_to_8", "easy", "What comes next: red, blue, red, blue?", "Red", "Green", "Yellow", "Blue", "The two colours alternate, so red comes next."],
  ["6_to_8", "medium", "All three boxes contain toys. You open one box. What must be inside?", "A toy", "A book", "A fruit", "A shoe", "The rule says every box contains toys."],
  ["9_to_11", "easy", "What comes next: 3, 6, 12, 24?", "48", "27", "36", "42", "Each number is double the previous number."],
  ["9_to_11", "medium", "All squares are rectangles. Which statement must be true?", "A square is a rectangle", "Every rectangle is a square", "No square has equal sides", "All rectangles have equal sides", "The statement applies to all squares, not to all rectangles."],
  ["12_to_14", "easy", "A program repeats a step until a condition is met. What is this structure?", "Loop", "Variable", "Comment", "Constant", "A loop repeats instructions according to a condition."],
  ["12_to_14", "medium", "If it rains, the path gets wet. The path is wet. What can you conclude?", "Rain is one possible cause", "It definitely rained", "Rain is impossible", "The rule is false", "Other causes, such as a hose, can also make the path wet."],
  ["15_plus", "medium", "Which search method halves a sorted search range at each step?", "Binary search", "Linear search", "Random search", "Exhaustive search", "Binary search repeatedly divides a sorted range in half."],
  ["15_plus", "hard", "What is the logical negation of 'Every bird can fly'?", "At least one bird cannot fly", "No bird can fly", "Every bird can fly", "Some birds can fly", "One counterexample is sufficient to negate a universal statement."],
];

science.push(
  ["6_to_8", "easy", "Which sense do you use to hear a bell?", "Hearing", "Taste", "Smell", "Touch", "Your ears detect the sound of the bell."],
  ["6_to_8", "medium", "Which object is usually attracted to a magnet?", "Iron nail", "Wooden spoon", "Glass marble", "Plastic cup", "Iron is a magnetic material."],
  ["9_to_11", "easy", "Which organ pumps blood around the body?", "Heart", "Lungs", "Stomach", "Brain", "The heart pumps blood through blood vessels."],
  ["9_to_11", "medium", "Which material is usually the best electrical conductor?", "Copper", "Rubber", "Glass", "Dry wood", "Metals such as copper allow electric current to flow easily."],
  ["12_to_14", "easy", "In a typical animal cell, which structure holds most of the genetic information?", "Nucleus", "Cell membrane", "Cytoplasm", "Ribosome", "In a typical animal cell, most DNA is in the nucleus."],
  ["12_to_14", "medium", "A solution has pH 3. How is it classified?", "Acidic", "Neutral", "Alkaline", "Insoluble", "A pH below 7 indicates an acidic solution."],
  ["15_plus", "medium", "What is the resistance of a component carrying 2 A with 12 V across it?", "6 ohms", "24 ohms", "10 ohms", "14 ohms", "Using R = V/I gives 12/2 = 6 ohms."],
  ["15_plus", "hard", "A radioactive sample has a half-life of two hours. What fraction remains after six hours?", "One eighth", "One sixth", "One quarter", "One half", "Three half-lives leave (1/2) cubed, or one eighth."],
);
language.push(
  ["6_to_8", "easy", "Which word rhymes with cat?", "Hat", "Cup", "Dog", "Car", "Cat and hat have the same ending sound."],
  ["6_to_8", "medium", "Choose the missing word: Yesterday, I ___ to school.", "Walked", "Walk", "Walking", "Walks", "Yesterday calls for the past tense, walked."],
  ["9_to_11", "easy", "Which punctuation mark ends a direct question?", "Question mark", "Comma", "Full stop", "Colon", "A direct question ends with a question mark."],
  ["9_to_11", "medium", "Which word best joins contrasting ideas: 'It was cold, ___ we went swimming'?", "But", "Because", "So", "Therefore", "But introduces a contrast between the cold weather and swimming."],
  ["12_to_14", "easy", "Which phrase gives a human action to something non-human?", "The wind whispered", "The cold wind", "A strong wind", "Wind from the west", "Describing the wind as whispering is personification."],
  ["12_to_14", "medium", "Which sentence gives evidence rather than an unsupported opinion?", "The report measured 200 samples", "The report is wonderful", "The report feels convincing", "The report must be right", "A stated sample count is checkable evidence about the study."],
  ["15_plus", "medium", "A character's words mean the opposite of their literal meaning. Which device may be present?", "Verbal irony", "Alliteration", "Onomatopoeia", "Assonance", "Verbal irony creates a contrast between literal and intended meaning."],
  ["15_plus", "hard", "Which argument assumes its own conclusion?", "It is true because it is true", "Two sources report the same date", "The measurement was repeated twice", "The result differs from the prediction", "Repeating the conclusion as its justification is circular reasoning."],
);
society.push(
  ["6_to_8", "easy", "Who helps pupils learn in a classroom?", "Teacher", "Pilot", "Farmer", "Dentist", "Teaching pupils is a teacher's main classroom role."],
  ["6_to_8", "medium", "You find a lost lunchbox at school. What should you do?", "Give it to a teacher", "Throw it away", "Hide it outside", "Take it home", "A teacher can help return the lunchbox to its owner."],
  ["6_to_8", "easy", "Which is something everyone needs to stay healthy?", "Clean water", "A new toy", "A gold ring", "A game console", "Clean drinking water is a basic human need."],
  ["9_to_11", "easy", "Which service helps people borrow books?", "Library", "Fire station", "Post office", "Airport", "Libraries lend books and other learning materials."],
  ["9_to_11", "medium", "You have 20 coins and spend 7. How many can you save?", "13", "27", "7", "14", "Subtract spending from the starting amount: 20 - 7 = 13."],
  ["9_to_11", "hard", "A group must decide fairly. What should happen before the decision?", "Everyone can share a view", "Only one friend speaks", "The loudest person chooses", "The leader hides the choices", "Hearing everyone's views supports a fair group decision."],
  ["12_to_14", "easy", "Which is an example of a public service?", "Waste collection", "A private birthday party", "A personal diary", "A family holiday", "Waste collection is a service organised for the community."],
  ["12_to_14", "medium", "Demand rises while supply stays unchanged. What usually happens to the market price?", "It rises", "It falls", "It must be zero", "It cannot change", "With supply unchanged, stronger demand generally raises the equilibrium price."],
  ["12_to_14", "hard", "Which survey method is least likely to favour one friendship group?", "Randomly select pupils", "Ask only your friends", "Ask only club leaders", "Ask only the first row", "Random selection reduces selection bias when done properly."],
  ["15_plus", "easy", "What does opportunity cost describe?", "The best alternative forgone", "Every possible expense", "The money already spent", "The total tax paid", "Opportunity cost is the value of the next-best alternative you give up."],
  ["15_plus", "medium", "A study finds a correlation between two variables. What does this alone establish?", "An association", "A causal mechanism", "A perfect prediction", "A universal law", "Correlation shows association but does not by itself demonstrate causation."],
  ["15_plus", "hard", "Which good is both non-rival and non-excludable?", "National defence", "A cinema seat", "A restaurant meal", "A private bicycle", "National defence is a standard example of a public good."],
);
history.push(
  ["6_to_8", "easy", "Which word means the day before today?", "Yesterday", "Tomorrow", "Next week", "Tonight", "Yesterday is the day immediately before today."],
  ["6_to_8", "medium", "Which item helps show how your height changed?", "Dated height marks", "A blank ruler", "Tomorrow's timetable", "An empty envelope", "Marks with dates let you compare your height over time."],
  ["6_to_8", "easy", "What does a map show?", "Where places are", "How food tastes", "How loud sounds are", "What songs mean", "Maps represent the locations of places and features."],
  ["9_to_11", "easy", "Which tool puts past events in date order?", "Timeline", "Compass", "Thermometer", "Balance", "A timeline arranges events chronologically."],
  ["9_to_11", "medium", "Which source directly records what a person said in an interview?", "An audio recording", "A guessed summary", "A later painting", "An unrelated map", "A recording preserves the interviewee's spoken words."],
  ["9_to_11", "hard", "An old coin is found at a site. What can it directly help researchers identify?", "The coin's place of origin", "Every resident's name", "Tomorrow's weather", "The exact population", "A coin's markings can identify where it was issued, though further evidence is needed about the site."],
  ["12_to_14", "easy", "Which term describes the movement of people to a new place to live?", "Migration", "Rotation", "Erosion", "Inflation", "Migration is movement from one place to another to live."],
  ["12_to_14", "medium", "Why should historians compare sources written by opposing sides?", "To examine different perspectives", "To avoid checking facts", "To guarantee identical accounts", "To remove all dates", "Comparing perspectives can reveal disagreement, omissions and bias."],
  ["12_to_14", "hard", "Which claim confuses sequence with causation?", "B followed A, so A caused B", "A and B occurred together", "A happened before B", "B was recorded after A", "An event occurring after another does not prove a causal link."],
  ["15_plus", "easy", "Which term describes an object placed in the wrong historical period?", "Anachronism", "Archive", "Chronology", "Artifact", "An anachronism is inconsistent with the time period shown."],
  ["15_plus", "medium", "A source is written decades after an event. Which limitation is especially relevant?", "Memory may have changed", "It cannot contain any facts", "It must be a forgery", "Its author cannot be identified", "Memory can change over time; later accounts still need careful evaluation."],
  ["15_plus", "hard", "A new primary source challenges an accepted account. What is the best historical response?", "Reassess the interpretation", "Discard the source automatically", "Accept every detail immediately", "Stop comparing other sources", "Historians evaluate new evidence and revise interpretations when warranted."],
);
art.push(
  ["6_to_8", "easy", "Which instrument is usually played by hitting it with sticks?", "Drum", "Flute", "Violin", "Trumpet", "A drum makes sound when its surface is struck."],
  ["6_to_8", "medium", "Which colour usually results from mixing yellow and blue paint?", "Green", "Orange", "Purple", "Red", "Yellow and blue paint are commonly mixed to make green."],
  ["6_to_8", "easy", "Which artwork shows a person's face?", "Portrait", "Landscape", "Still life", "Map", "A portrait represents a person, often focusing on the face."],
  ["9_to_11", "easy", "Which word describes how high or low a musical note sounds?", "Pitch", "Tempo", "Volume", "Rhythm", "Pitch describes a sound's perceived highness or lowness."],
  ["9_to_11", "medium", "Which artwork has three dimensions?", "Sculpture", "Pencil sketch", "Printed poster", "Photograph", "A sculpture has physical height, width and depth."],
  ["9_to_11", "hard", "A camera moves closer to show a character's eyes. What does this best reveal?", "Facial emotion", "The entire landscape", "The city's size", "The building's height", "A close-up highlights details such as facial expressions."],
  ["12_to_14", "easy", "Which term describes the quality that distinguishes a violin from a flute playing the same note?", "Timbre", "Tempo", "Duration", "Silence", "Timbre is the characteristic quality or colour of a sound."],
  ["12_to_14", "medium", "An artist repeats a shape across a design. Which principle is most directly used?", "Repetition", "Perspective", "Anatomy", "Foreshortening", "Repeating shapes creates visual repetition and can establish rhythm."],
  ["12_to_14", "hard", "A film shows a clock between shots of someone running. What does this most likely build?", "Time pressure", "A change of season", "A different language", "A wider landscape", "Repeated clock shots can emphasise a deadline and build tension."],
  ["15_plus", "easy", "Which musical term means gradually getting louder?", "Crescendo", "Diminuendo", "Ritardando", "Staccato", "Crescendo directs performers to increase loudness gradually."],
  ["15_plus", "medium", "A painting uses only variations of one hue. Which palette is this?", "Monochromatic", "Complementary", "Triadic", "Polychromatic", "A monochromatic palette uses shades, tints and tones of a single hue."],
  ["15_plus", "hard", "A film's background music is heard by viewers but not by its characters. What is it?", "Non-diegetic sound", "Diegetic dialogue", "Location noise", "On-screen speech", "Non-diegetic sound exists outside the story world's audible environment."],
);
planet.push(
  ["6_to_8", "easy", "Which place is mostly covered by water?", "Ocean", "Desert", "Mountain", "Field", "An ocean is a very large body of salt water."],
  ["6_to_8", "medium", "Which can you use again instead of throwing it away?", "A refillable bottle", "A used tissue", "A banana peel", "A broken egg shell", "A refillable bottle can be washed and used many times."],
  ["6_to_8", "easy", "Which animal is most suited to living in a pond?", "Frog", "Camel", "Lion", "Goat", "Frogs commonly live in or near freshwater ponds."],
  ["9_to_11", "easy", "Which ocean is the largest?", "Pacific", "Atlantic", "Indian", "Arctic", "The Pacific is the largest ocean by surface area."],
  ["9_to_11", "medium", "Which action helps protect a river from litter?", "Put rubbish in bins", "Drop wrappers in drains", "Leave bags on banks", "Throw bottles in water", "Proper disposal keeps litter from entering waterways."],
  ["9_to_11", "hard", "If bees disappear from an orchard, what is most directly affected?", "Flower pollination", "Rock formation", "Day length", "Wind direction", "Bees transfer pollen between flowers and help many fruit trees reproduce."],
  ["12_to_14", "easy", "Which line divides Earth into Northern and Southern Hemispheres?", "Equator", "Prime meridian", "Arctic Circle", "Tropic of Capricorn", "The equator lies halfway between the poles."],
  ["12_to_14", "medium", "What is a likely effect of removing trees from a steep hillside?", "More soil erosion", "Less rain runoff", "Stronger root networks", "More soil protection", "Without roots and cover, soil is more easily washed away."],
  ["12_to_14", "hard", "Why can a toxin become more concentrated higher in a food chain?", "Predators eat many contaminated prey", "Toxins always evaporate immediately", "Predators never store chemicals", "Plants manufacture every toxin", "Persistent toxins can accumulate as predators consume many contaminated organisms."],
  ["15_plus", "easy", "Which measure describes the variety of living species in an area?", "Species richness", "Air pressure", "Soil depth", "Wind speed", "Species richness counts the different species present."],
  ["15_plus", "medium", "A species is found naturally in only one region. Which term describes it?", "Endemic", "Cosmopolitan", "Domesticated", "Migratory", "An endemic species is native to and restricted to a particular area."],
  ["15_plus", "hard", "A fishery catches fish faster than they reproduce. What is the likely long-term result?", "Declining fish population", "Unlimited sustainable yield", "Permanent population growth", "No ecological change", "Removing fish faster than recruitment reduces the stock over time."],
);
logic.push(
  ["6_to_8", "easy", "What comes next: 2, 4, 6, 8?", "10", "9", "11", "12", "The pattern adds two each time."],
  ["6_to_8", "medium", "A box holds only red balls. You pick one without looking. What colour must it be?", "Red", "Blue", "Green", "Yellow", "Every ball in the box is red."],
  ["6_to_8", "easy", "Which shape has no corners?", "Circle", "Triangle", "Square", "Rectangle", "A circle is curved and has no corners."],
  ["9_to_11", "easy", "Which instruction is most precise?", "Move forward three steps", "Move a little", "Go somewhere", "Walk for a bit", "A specific number of steps makes the instruction clearer."],
  ["9_to_11", "medium", "Ava is taller than Ben. Ben is taller than Cara. Who is tallest?", "Ava", "Ben", "Cara", "They are equal", "The two comparisons place Ava above both Ben and Cara."],
  ["9_to_11", "hard", "A code changes CAT to DBU by shifting each letter one place. What does DOG become?", "EPH", "CNG", "FQI", "EOG", "D becomes E, O becomes P, and G becomes H."],
  ["12_to_14", "easy", "Which value can a Boolean variable hold?", "True", "Twenty", "A paragraph", "A photograph", "A Boolean represents one of two logical values: true or false."],
  ["12_to_14", "medium", "A fair coin is tossed twice. What is the probability of two heads?", "One quarter", "One half", "Three quarters", "One", "There are four equally likely ordered outcomes, and only HH has two heads."],
  ["12_to_14", "hard", "A program should repeat five times but repeats six. Which error is most likely?", "Off-by-one error", "Missing power supply", "Wrong font choice", "Low screen brightness", "An off-by-one error often comes from incorrect loop boundaries."],
  ["15_plus", "easy", "Which structure processes items in first-in, first-out order?", "Queue", "Stack", "Set", "Tree", "A queue removes items in the order they were added."],
  ["15_plus", "medium", "An algorithm checks every item once. How does its work grow with n items?", "Proportional to n", "Proportional to n squared", "Independent of n", "Proportional to two to n", "One constant-time check per item produces linear work."],
  ["15_plus", "hard", "A statement says P implies Q. Which is its contrapositive?", "Not Q implies not P", "Q implies P", "Not P implies not Q", "P implies not Q", "The contrapositive reverses and negates both parts, and is logically equivalent."],
);

const pools: Record<string, Item[]> = {
  "how-world-works": science, science,
  "language-craft": language, "language-literacy": language,
  "organize-ourselves": society, "systems-societies": society, "who-we-are": society,
  "global-perspectives": history, "place-and-time": history, history,
  "creative-expression": art, "express-ourselves": art, art, music: art, movies: art,
  "sharing-planet": planet, geography: planet,
  "logical-inquirers": logic, "design-innovation": logic, logic, "computer-science": logic,
};

export function buildQuickQuestions(categories: Category[]): Question[] {
  const questions: Question[] = [];
  for (const category of categories) {
    let items = pools[category.slug] ?? [];
    if (["math", "math-masterminds"].includes(category.slug)) {
      items = [];
      for (let n = 2; n <= 13; n += 1) {
        const a = n + 3;
        items.push(["6_to_8", n >= 8 ? "medium" : "easy", `What is ${n} + ${a}?`, `${n + a}`, `${n + a - 1}`, `${n + a + 1}`, `${a}`, `Adding ${n} and ${a} gives ${n + a}.`]);
        items.push(["9_to_11", n >= 9 ? "hard" : "medium", `${n} bags hold ${a} marbles each. How many marbles altogether?`, `${n * a}`, `${n + a}`, `${n * a - n}`, `${n * a + a}`, `Multiply the number of bags by the marbles in each bag: ${n} x ${a} = ${n * a}.`]);
        items.push(["12_to_14", "medium", `Solve: 3x + ${n} = ${3 * a + n}.`, `${a}`, `${a + 1}`, `${a - 1}`, `${3 * a}`, `Subtract ${n}, then divide by 3. This gives x = ${a}.`]);
        const change = (n * n / 100).toFixed(2);
        items.push(["15_plus", "medium", `An amount rises by ${n}%, then falls by ${n}%. What is the overall change?`, `${change}% decrease`, `${change}% increase`, "No change", `${n}% decrease`, `The second percentage uses the increased amount. Multiplying (1 + ${n}/100) by (1 - ${n}/100) gives an overall decrease of ${change}%.`]);
      }
    }
    items.forEach(([age, difficulty, prompt, correct, b, c, d, explanation], index) => {
      const question: Question = {
        id: `quick-v1-${category.slug}-${index}`, categoryId: category.id,
        title: category.name, prompt, difficulty, ageBandMin: age, ageBandMax: age,
        modality: "text", answerType: "multiple_choice", options: { A: correct, B: b, C: c, D: d },
        correctAnswer: "A", explanation, mediaUrl: null, mediaAltText: null,
        estimatedSeconds: 30, active: true, tags: ["age-reviewed:v1", "quick-starter", category.slug],
        createdAt: "2026-10-21T00:00:00.000Z", updatedAt: "2026-10-21T00:00:00.000Z",
      };
      const issues = questionQualityIssues(question);
      if (issues.length) throw new Error(`${question.id}: ${issues.join(", ")}`);
      questions.push(question);
    });
  }
  return questions;
}
