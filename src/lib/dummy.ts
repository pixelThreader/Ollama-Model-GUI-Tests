/**
 * Robust prompt generator with massive permutations.
 * Designed to provide meaningful testing prompts for Ollama models.
 */

const subjects = [
    "quantum computing", "medieval history", "space exploration", "renewable energy",
    "culinary arts", "modern architecture", "marine biology", "personal finance",
    "artificial intelligence", "classical music", "digital marketing", "paleontology",
    "sustainable fashion", "cryptography", "world mythology", "urban gardening",
    "neuroscience", "ancient civilizations", "game design", "climate change",
    "robotics", "philosophy of mind", "data science", "astrophotography",
    "microbiology", "film theory", "cybersecurity", "interior design",
    "volcanology", "linguistics", "behavioral economics", "origami",
    "restorative justice", "biomimicry", "astrology", "quantum entanglement",
    "the dark web", "renaissance art", "machine learning", "organic chemistry"
];

const verbs = [
    "explain the nuances of", "write a detailed report on", "critique the impact of",
    "summarize the latest trends in", "create a comparison between", "develop a strategy for",
    "analyze the ethical implications of", "design a basic framework for", "explore the history of",
    "propose a innovative solution for", "generate a debate about", "outline the future of",
    "investigate the connection between", "reimagine the role of", "predict the evolution of",
    "synthesize the key concepts of", "document the challenges within", "evaluate the success of",
    "draft a comprehensive guide to", "illustrate the mechanics of"
];

const modifiers = [
    "from a perspective of sustainability", "targeting beginners in the field",
    "focusing on economic viability", "considering the psychological effects",
    "using a highly technical approach", "written in a poetic style",
    "embedded with historical context", "emphasizing practical applications",
    "with a touch of cynical humor", "optimized for academic clarity",
    "incorporating diverse cultural viewpoints", "balancing pros and cons",
    "while adhering to strict scientific rigor", "in the context of a post-apocalyptic world",
    "specifically for a young audience", "assuming unlimited resources",
    "highlighting the most controversial aspects", "through the lens of a futurist",
    "intended for a global summit", "ignoring standard conventions"
];

const constraints = [
    "within 300 words", "using only simple metaphors", "including a list of five action items",
    "presented as a series of short paragraphs", "without using any jargon",
    "framed as a letter to the future", "formatted with clear headings",
    "ending with a thought-provoking question", "supported by hypothetical data",
    "interspersed with illustrative analogies", "written in the first person",
    "concluding with a bold prediction", "avoiding any mention of politics",
    "structured like a Greek tragedy", "organized by priority",
    "punctuated with rhetorical questions", "using a conversational tone",
    "including a disclaimer at the start", "referencing at least three distinct eras",
    "maintaining a sense of urgency"
];

const secondarySubjects = [
    "the internet of things", "blockchain technology", "mental health awareness",
    "global supply chains", "remote work culture", "social media algorithms",
    "space tourism", "vertical farming", "genetic engineering", "autonomous vehicles",
    "virtual reality", "ethical hacking", "mindfulness meditation", "circular economies",
    "biodiversity loss", "the gig economy", "nanotechnology", "precision medicine",
    "clean water initiatives", "urbanization"
];

const tones = [
    "optimistic", "skeptical", "whimsical", "clinical", "melancholic",
    "authoritative", "playful", "mysterious", "aggressive", "gentle",
    "ironic", "somber", "urgent", "relaxed", "pompous",
    "modest", "visionary", "analytical", "provocative", "reassuring"
];

/**
 * Generates a random prompt by combining various sentence fragments.
 * Combinations: subjects * verbs * modifiers * constraints * secondarySubjects * tones
 * Total: 40 * 20 * 20 * 20 * 20 * 20 = 128,000,000 permutations (1.28 * 10^8)
 * By expanding the lists or adding more segments, we can easily reach higher magnitudes.
 */
export type PromptMode = 'stream' | 'generate' | 'structured';

export function generateRandomPrompt(mode?: PromptMode): string {
    const s = subjects[Math.floor(Math.random() * subjects.length)];
    const v = verbs[Math.floor(Math.random() * verbs.length)];
    const m = modifiers[Math.floor(Math.random() * modifiers.length)];
    const c = constraints[Math.floor(Math.random() * constraints.length)];
    const ss = secondarySubjects[Math.floor(Math.random() * secondarySubjects.length)];
    const t = tones[Math.floor(Math.random() * tones.length)];

    const structures = [
        () => `Please ${v} ${s} ${m}. Ensure it is ${c} and maintains a ${t} tone.`,
        () => `In a ${t} manner, ${v} the relationship between ${s} and ${ss}, ${m}. Keep it ${c}.`,
        () => `Assuming a ${t} stance: ${v} ${s}. How does ${ss} fit into this, ${m}? Format it ${c}.`,
        () => `${v} ${s} and ${ss}. The writing should be ${t}, ${m}, and ${c}.`,
        () => `Construct a ${t} argument that ${v} ${s}. Note the influence of ${ss}, ${m}. Must be ${c}.`
    ];

    const builder = structures[Math.floor(Math.random() * structures.length)];
    let finalPrompt = builder();

    if (mode === 'structured') {
        finalPrompt += '\n\nIMPORTANT: You must output strictly in JSON format. The JSON should have exactly this structure: { "title": "Your Title", "summary": "A brief summary", "key_points": ["Point 1", "Point 2"], "conclusion": "Your conclusion" }. Do not add any extra text or conversational formatting outside of the JSON object.';
    } else if (mode === 'generate') {
        finalPrompt += '\n\nPlease present your entire response at once, structuring it cohesively and completely.';
    } else if (mode === 'stream') {
        finalPrompt += '\n\nPlease progressively build upon your answer, suitable for a dynamic real-time stream.';
    }

    return finalPrompt;
}
