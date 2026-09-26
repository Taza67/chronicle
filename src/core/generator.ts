import type {
	AdvisorRole,
	Chapter,
	Emotion,
	GameState,
	Leader,
	Turn,
} from "../types.ts";
import { online, gemini as workerGemini } from "./api.ts";
import type { VerdictRecord } from "./state.ts";

let gemini: typeof workerGemini = workerGemini;
/** Swap the Gemini client (used by the offline pre-generation tool). */
export function useGeminiClient(fn: typeof workerGemini) {
	gemini = fn;
}

const MODEL = "gemini-3.8-flash";

const RULES = `You write for CHRONICLE, a voice-acted mobile history game. The player IS the historical leader; advisors address them ("Majesty", "Sire", "Pharaoh"...).
Tone: lightly humorous, advisors bicker and have strong personalities, but ALL humour must be period-appropriate — NO modern anachronisms (no "budget", "PR", "weekend", "coffee" unless it exists in that era).
Historical revelations ("reveal") are serious, precise and vivid: real names, dates, places, consequences. Never invent facts. If uncertain, stay general.
Every line will be spoken aloud by TTS: write for the ear — short sentences, contractions, no lists, no markdown, no stage directions, no quotes around the text.`;

export const TUTORIAL_HINT = `
This is the player's FIRST council. In turn 1, the advisor's speech must weave in, in-world and briefly, that the court watches three things — the treasury (gold), the peace of the realm (stability) and how posterity will remember the ruler (legacy) — and that after each decision the Oracle will ask the ruler to wager whether they chose as history did. Keep it natural, not a lecture; the dilemma still comes first.`;

const EFFECT_SCHEMA = {
	type: "OBJECT",
	properties: {
		gold: { type: "INTEGER" },
		stability: { type: "INTEGER" },
		legacy: { type: "INTEGER" },
	},
	required: ["gold", "stability", "legacy"],
};
const EMOTIONS = ["calm", "alarmed", "amused", "proud", "bold"];
const ROLES = ["war", "gold", "faith"];

const CHAPTER_SCHEMA = {
	type: "OBJECT",
	properties: {
		season_title: { type: "STRING" },
		intro: {
			type: "STRING",
			description: "Narrator, 2 sentences setting the scene for this chapter.",
		},
		turns: {
			type: "ARRAY",
			items: {
				type: "OBJECT",
				properties: {
					year: { type: "STRING" },
					title: { type: "STRING", description: "3-5 word dilemma title" },
					advisor: { type: "STRING", enum: ROLES },
					emotion: { type: "STRING", enum: EMOTIONS },
					speech: {
						type: "STRING",
						description:
							"Advisor presents the real dilemma with its stakes, 45-70 words, ends by asking the leader to decide.",
					},
					rebuttal: {
						type: "OBJECT",
						nullable: true,
						properties: {
							advisor: { type: "STRING", enum: ROLES },
							line: {
								type: "STRING",
								description: "Another advisor disagrees, 12-25 words, witty.",
							},
							emotion: { type: "STRING", enum: EMOTIONS },
						},
						required: ["advisor", "line", "emotion"],
					},
					choices: {
						type: "ARRAY",
						minItems: 3,
						maxItems: 3,
						items: {
							type: "OBJECT",
							properties: {
								label: {
									type: "STRING",
									description: "2-6 words, imperative, what the leader does",
								},
								historical: { type: "BOOLEAN" },
								effects: EFFECT_SCHEMA,
								whatif: {
									type: "STRING",
									nullable: true,
									description:
										"For non-historical choices only: a plausible 45-70 word counterfactual narrated by the narrator, ending by reminding what really happened in one sentence.",
								},
							},
							required: ["label", "historical", "effects"],
						},
					},
					reveal: {
						type: "STRING",
						description:
							"Narrator tells what really happened and why it mattered, 55-80 words.",
					},
					fun_fact: {
						type: "STRING",
						description: "One surprising true detail, 20-35 words.",
					},
				},
				required: [
					"year",
					"title",
					"advisor",
					"emotion",
					"speech",
					"rebuttal",
					"choices",
					"reveal",
					"fun_fact",
				],
			},
		},
	},
	required: ["season_title", "intro", "turns"],
};

function leaderBrief(l: Leader) {
	const adv = l.advisors
		.map(
			(a) =>
				`- ${a.role.toUpperCase()} advisor: ${a.name}, ${a.title}. Personality: ${a.trait}.`,
		)
		.join("\n");
	return `Leader: ${l.name} (${l.civ}, ${l.era}).\nAdvisors:\n${adv}`;
}

function reignBrief(g: GameState) {
	if (!g.history.length) return "";
	const lines = g.history
		.map(
			(h) =>
				`- ${h.year} ${h.title}: chose "${h.chosen}" (${h.historical ? "historical" : "diverged from history"})`,
		)
		.join("\n");
	return `\nDecisions so far:\n${lines}\nCurrent gauges: gold ${g.stats.gold}/10, stability ${g.stats.stability}/10, legacy ${g.stats.legacy}/10.`;
}

export async function generateChapter(
	g: GameState,
	season: number,
	special: Turn["special"],
): Promise<Chapter> {
	const l = g.leader;
	const covered = g.history.map((h) => h.title).join(", ");
	let extra = "";
	if (special === "bankruptcy")
		extra =
			"\nThe treasury is EMPTY. Turn 1 must be a special 'Bankruptcy' crisis directly caused by the earlier decisions; the gold advisor panics.";
	if (special === "revolt")
		extra =
			"\nThe people are in REVOLT. Turn 1 must be a special 'Revolt' crisis directly caused by the earlier decisions; the war advisor is alarmed.";
	if (special === "prophecy")
		extra =
			"\nLegacy is legendary. Turn 1 must be a special 'Prophecy': the faith advisor foretells how posterity will remember this reign, offering a bold opportunity.";
	if (season === 1) extra += TUTORIAL_HINT;
	const prompt = `${leaderBrief(l)}
Write chapter ${season} of this reign: exactly 5 turns, chronological, each a REAL documented dilemma this leader faced (or a decision with real historical consequences). ${covered ? `Do NOT reuse these already-played dilemmas: ${covered}.` : ""}
Exactly one choice per turn is what history records (historical:true); the two others are plausible alternatives (historical:false, each with a whatif). Effects are integers between -2 and 2 and reflect realistic consequences for gold, stability and legacy. Vary which advisor speaks. Include a rebuttal on at least 3 turns.${reignBrief(g)}${extra}`;
	return gemini<Chapter>({
		system: RULES,
		parts: [{ text: prompt }],
		schema: CHAPTER_SCHEMA,
		model: MODEL,
		temperature: 0.9,
	});
}

export async function generateWhatIf(
	g: GameState,
	turn: Turn,
	chosen: string,
): Promise<string> {
	const l = g.leader;
	const prompt = `${leaderBrief(l)}
Dilemma (${turn.year}): ${turn.speech}
What really happened: ${turn.reveal}
The player instead decided: "${chosen}".
Narrate, as the omniscient narrator, a plausible counterfactual in 55-80 words: immediate consequence, then a ripple ten years later. End with one sentence reminding what really happened. Keep it grounded in the era's real forces.`;
	const r = await gemini<{ whatif: string }>({
		system: RULES,
		parts: [{ text: prompt }],
		schema: {
			type: "OBJECT",
			properties: { whatif: { type: "STRING" } },
			required: ["whatif"],
		},
		model: MODEL,
		temperature: 0.9,
	});
	return r.whatif;
}

export async function generateVerdict(g: GameState): Promise<VerdictRecord> {
	const l = g.leader;
	const matched = g.history.filter((h) => h.historical).length;
	const prompt = `${leaderBrief(l)}${reignBrief(g)}
The chapter is over. ${matched}/${g.history.length} decisions matched history.
Produce:
- title: a 2-4 word verdict title earned by THIS reign (e.g. "The Cautious Reformer", "Chaos Incarnate"), unique and flavourful.
- epithet: how chroniclers would name this ruler, format "<Name> the <Epithet>".
- comment: narrator's judgement of the reign, 35-55 words, referencing at least two specific decisions.
- leaderLine: the REAL ${l.name} addresses the player who just played as them, in first person, 25-45 words, in character, witty, period-appropriate, reacting to how the player diverged from or matched their real choices.
- nextEra: recommend a change of era that flows from this reign's story: leaderId is one of [cleopatra, napoleon, ashoka, mansa_musa, elizabeth] different from ${l.id}, or null with a name if you propose a leader not in that list; name = leader name; hook = 1 sentence spoken by the narrator that links this reign to the proposal.`;
	return gemini<VerdictRecord>({
		system: RULES,
		parts: [{ text: prompt }],
		schema: {
			type: "OBJECT",
			properties: {
				title: { type: "STRING" },
				epithet: { type: "STRING" },
				comment: { type: "STRING" },
				leaderLine: { type: "STRING" },
				nextEra: {
					type: "OBJECT",
					nullable: true,
					properties: {
						leaderId: { type: "STRING", nullable: true },
						name: { type: "STRING" },
						hook: { type: "STRING" },
					},
					required: ["leaderId", "name", "hook"],
				},
			},
			required: ["title", "epithet", "comment", "leaderLine", "nextEra"],
		},
		model: MODEL,
		temperature: 0.9,
	});
}

export interface VoiceInterpretation {
	kind: "choice" | "custom" | "unclear";
	index: number | null;
	label: string | null;
	whatif: string | null;
}

export async function interpretVoice(
	g: GameState,
	turn: Turn,
	transcript: string,
): Promise<VoiceInterpretation> {
	const opts = turn.choices.map((c, i) => `${i}: ${c.label}`).join("\n");
	const prompt = `${leaderBrief(g.leader)}
Dilemma: ${turn.speech}
Options:\n${opts}
The player said (speech transcript): "${transcript}"
If it clearly maps to one option → kind "choice" with its index. If it is a different, concrete, era-plausible decision → kind "custom" with a 2-6 word imperative label and a 55-80 word counterfactual (whatif) that ends by reminding what really happened: ${turn.reveal}. If it's noise, off-topic or incomprehensible → kind "unclear".`;
	return gemini<VoiceInterpretation>({
		system: RULES,
		parts: [{ text: prompt }],
		schema: {
			type: "OBJECT",
			properties: {
				kind: { type: "STRING", enum: ["choice", "custom", "unclear"] },
				index: { type: "INTEGER", nullable: true },
				label: { type: "STRING", nullable: true },
				whatif: { type: "STRING", nullable: true },
			},
			required: ["kind", "index", "label", "whatif"],
		},
		model: MODEL,
	});
}

/** A lying advisor pushes a NON-historical option. Returns a rewritten speech. */
export async function generateLie(
	g: GameState,
	turn: Turn,
	liar: AdvisorRole,
): Promise<{ speech: string; pushIndex: number }> {
	const a = g.leader.advisors.find((x) => x.role === liar)!;
	const opts = turn.choices
		.map((c, i) => `${i}: ${c.label} (${c.historical ? "historical" : "not"})`)
		.join("\n");
	const prompt = `${leaderBrief(g.leader)}
${a.name} (${liar} advisor) feels ignored and resentful (trust is low). He now presents this dilemma but subtly steers the leader toward a NON-historical option, exaggerating its benefits, while sounding sincere. 45-70 words, in his personality, period-appropriate humour allowed. End by asking the leader to decide.
Original dilemma speech for context: ${turn.speech}
Options:\n${opts}`;
	return gemini<{ speech: string; pushIndex: number }>({
		system: RULES,
		parts: [{ text: prompt }],
		schema: {
			type: "OBJECT",
			properties: {
				speech: { type: "STRING" },
				pushIndex: { type: "INTEGER" },
			},
			required: ["speech", "pushIndex"],
		},
		model: MODEL,
		temperature: 0.9,
	});
}

export interface LeaderProfile {
	valid: boolean;
	refusal: string;
	leader: Omit<Leader, "advisors" | "voice"> & {
		gender: "male" | "female";
		advisors: {
			role: AdvisorRole;
			name: string;
			title: string;
			trait: string;
			gender: "male" | "female";
		}[];
	};
}

export async function generateLeaderProfile(
	request: string,
): Promise<LeaderProfile> {
	const prompt = `A player asks to play as: "${request}".
If this is NOT a real, documented historical person (fictional character, living celebrity with no reign, object, insult, gibberish) → valid:false and a polite, witty, in-world refusal spoken by the Royal Archivist (25-40 words, no modern references; e.g. the archives hold only those who truly lived).
Otherwise valid:true and build the leader:
id: snake_case ascii; name; civ (state/civilisation they led); era (years of power); quote (a real or well-attested quote, short); palette {primary, accent, bg} hex colours evoking the culture; gender;
advisors: exactly 3 with roles war, gold, faith — real historical figures from that court when possible, else plausible period titles; each with name, title, trait (personality in 6-10 words), gender;
portraitPrompt: 25-40 word visual description of the leader for a painter (clothing, headwear, colours, distinctive features, era-accurate);
scenePrompt: 25-40 word description of their seat of power interior/exterior, no people;
musicPrompt: 20-30 word description of a loopable court music in the culture's instruments.`;
	return gemini<LeaderProfile>({
		system: RULES,
		parts: [{ text: prompt }],
		schema: {
			type: "OBJECT",
			properties: {
				valid: { type: "BOOLEAN" },
				refusal: { type: "STRING" },
				leader: {
					type: "OBJECT",
					nullable: true,
					properties: {
						id: { type: "STRING" },
						name: { type: "STRING" },
						civ: { type: "STRING" },
						era: { type: "STRING" },
						quote: { type: "STRING" },
						gender: { type: "STRING", enum: ["male", "female"] },
						palette: {
							type: "OBJECT",
							properties: {
								primary: { type: "STRING" },
								accent: { type: "STRING" },
								bg: { type: "STRING" },
							},
							required: ["primary", "accent", "bg"],
						},
						advisors: {
							type: "ARRAY",
							items: {
								type: "OBJECT",
								properties: {
									role: { type: "STRING", enum: ROLES },
									name: { type: "STRING" },
									title: { type: "STRING" },
									trait: { type: "STRING" },
									gender: { type: "STRING", enum: ["male", "female"] },
								},
								required: ["role", "name", "title", "trait", "gender"],
							},
						},
						portraitPrompt: { type: "STRING" },
						scenePrompt: { type: "STRING" },
						musicPrompt: { type: "STRING" },
					},
					required: [
						"id",
						"name",
						"civ",
						"era",
						"quote",
						"gender",
						"palette",
						"advisors",
						"portraitPrompt",
						"scenePrompt",
						"musicPrompt",
					],
				},
			},
			required: ["valid", "refusal", "leader"],
		},
		model: MODEL,
	});
}

// ---------- fallback (pre-generated) content ----------

const fallbackCache = new Map<string, Chapter[]>();

export async function loadFallbackChapters(
	leaderId: string,
): Promise<Chapter[]> {
	let c = fallbackCache.get(leaderId);
	if (!c) {
		try {
			const r = await fetch(`data/chapters/${leaderId}.json`);
			c = r.ok ? ((await r.json()) as Chapter[]) : [];
		} catch {
			c = [];
		}
		fallbackCache.set(leaderId, c);
	}
	return c;
}

/** Live generation when online, otherwise pre-generated chapters (rotating). */
export async function getChapter(
	g: GameState,
	season: number,
	special: Turn["special"],
): Promise<{ chapter: Chapter; live: boolean }> {
	const fallback = await loadFallbackChapters(g.leader.id);
	// First chapter of a default leader: prefer the reviewed, pre-generated one (reliable demo, instant TTS cache).
	if (
		season === 1 &&
		special === null &&
		fallback.length > 0 &&
		!g.leader.generated
	)
		return { chapter: fallback[0], live: false };
	if (online()) {
		try {
			const chapter = await generateChapter(g, season, special);
			if (chapter.turns?.length >= 3) return { chapter, live: true };
		} catch (e) {
			console.warn("chapter generation failed, using fallback", e);
		}
	}
	if (fallback.length === 0)
		throw new Error("No content available for this leader");
	return { chapter: fallback[(season - 1) % fallback.length], live: false };
}

export const emotionOr = (e: string | undefined): Emotion =>
	EMOTIONS.includes(e ?? "") ? (e as Emotion) : "calm";
