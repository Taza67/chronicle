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
								consequence: {
									type: "OBJECT",
									nullable: true,
									description:
										"Optional deferred repercussion of this decree, resurfacing a few turns later: 'text' narrates the echo (max 20 words), 'effects' its stat deltas (-2..2), 'delay' the turns until it returns (2-3). At most one choice per chapter.",
									properties: {
										text: { type: "STRING" },
										effects: EFFECT_SCHEMA,
										delay: { type: "INTEGER" },
									},
									required: ["text", "effects", "delay"],
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
	turnCount = 8,
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
Write chapter ${season} of this reign: exactly ${turnCount} turns, chronological, each a REAL documented dilemma this leader faced (or a decision with real historical consequences). ${covered ? `Do NOT reuse these already-played dilemmas: ${covered}.` : ""}
Exactly one choice per turn is what history records (historical:true); the two others are plausible alternatives (historical:false, each with a whatif). Effects are integers between -2 and 2 and reflect realistic consequences for gold, stability and legacy. Vary which advisor speaks. Include a rebuttal on at least 4 turns. At most one choice in the chapter may carry a 'consequence' — a documented later repercussion of that decree, only where the historical record actually has one.${reignBrief(g)}${extra}`;
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
	let collapseInstruction = "";
	if (g.collapse === "bankruptcy") {
		collapseInstruction = `\nCRITICAL: The reign COLLAPSED due to BANKRUPTCY (treasury reached 0). The leader has been ruined. Title must reflect this (e.g. "The Fallen Monarch", "The Bankrupt Sovereign", epithet "<Name> the Ruined"). The comment and leaderLine must reflect this tragic defeat, empty coffers, and loss of the throne.`;
	} else if (g.collapse === "revolt") {
		collapseInstruction = `\nCRITICAL: The reign COLLAPSED due to OPEN REVOLT (stability reached 0). The leader was overthrown by the populace. Title must reflect this (e.g. "Deposed in Chaos", "The Overthrown", epithet "<Name> the Overthrown"). The comment and leaderLine must reflect this rebellion and violent loss of power.`;
	}
	const prompt = `${leaderBrief(l)}${reignBrief(g)}${collapseInstruction}
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

function deriveFallbackYears(era: string, season: number): string[] {
	const isBC = /\b(bc|bce)\b/i.test(era);
	// Only treat 3+ digit numbers as years — "18th Dynasty" must not yield "18 BC".
	let baseYear = (era.match(/\d+/g) ?? []).map(Number).find((n) => n >= 100);
	if (baseYear === undefined) {
		// "3rd century BC" → a plausible mid-century year.
		const cent = era.match(/(\d+)(?:st|nd|rd|th)\s+centur(?:y|ies)/i);
		if (cent) baseYear = parseInt(cent[1], 10) * 100 - 50;
	}
	if (baseYear !== undefined) {
		const step = 3;
		const offset = (season - 1) * 24;
		return Array.from({ length: 8 }, (_, i) => {
			if (isBC) {
				const y = baseYear - offset - i * step;
				return y > 0 ? `${y} BC` : `${Math.abs(y) + 1} AD`;
			}
			const y = baseYear + offset + i * step;
			return `${y}`;
		});
	}
	const startYear = (season - 1) * 8 + 1;
	return Array.from({ length: 8 }, (_, i) => `Year ${startYear + i}`);
}

/** Generic historical archetype fallback chapter for custom or summoned leaders offline. */
export function createArchetypeFallbackChapter(
	g: GameState,
	season: number,
): Chapter {
	const l = g.leader;
	const warAdv = l.advisors?.find((a) => a.role === "war") ?? {
		role: "war" as AdvisorRole,
		name: "Marshal",
		title: "Commander of the Host",
		trait: "bold and martial",
		voice: "onyx",
	};
	const goldAdv = l.advisors?.find((a) => a.role === "gold") ?? {
		role: "gold" as AdvisorRole,
		name: "Treasurer",
		title: "Master of the Mint",
		trait: "calculating and cautious",
		voice: "toby",
	};
	const faithAdv = l.advisors?.find((a) => a.role === "faith") ?? {
		role: "faith" as AdvisorRole,
		name: "High Priest",
		title: "Voice of the Sacred",
		trait: "devout and insightful",
		voice: "declan",
	};

	const years = deriveFallbackYears(l.era, season);

	const turn1Speech =
		season === 1
			? `${l.name}, your ascension over ${l.civ} is proclaimed, but our rivals test our resolve. Our court watches three sacred scales: the treasury gold, the stability of our provinces, and the eternal legacy you carve in stone. Even the Oracle will test if your decrees mirror what history recorded. Conspirators whisper in the shadow of the throne. Shall we strike down the faction leaders swiftly, or offer them royal pardons?`
			: `${l.name}, factions within ${l.civ} challenge our latest decrees as rival powers watch from our borders. We must project sovereign strength before internal strife fractures the realm. Shall we purge the seditious ministers, or convene the high council to negotiate terms?`;

	const turns: Turn[] = [
		{
			year: years[0],
			title: "Consolidation of Power",
			advisor: warAdv.role,
			emotion: "bold",
			speech: turn1Speech,
			rebuttal: {
				advisor: goldAdv.role,
				line: `Rash violence will frighten our wealthiest merchants, ${warAdv.name}, and empty the markets of ${l.civ}.`,
				emotion: "alarmed",
			},
			choices: [
				{
					label: "Purge conspirators and centralize rule",
					historical: true,
					effects: { gold: -1, stability: 2, legacy: 1 },
					consequence: {
						text: "The kin of the purged still whisper in dark halls.",
						effects: { gold: 0, stability: -1, legacy: 0 },
						delay: 2,
					},
				},
				{
					label: "Offer pardons and seat rivals on council",
					historical: false,
					effects: { gold: 0, stability: -2, legacy: -1 },
					whatif: `Welcoming unrepentant conspirators into the royal council paralyzed the state. Within months, rival factions bribed provincial garrisons and challenged imperial edicts across ${l.civ}. In reality, ${l.name} moved decisively to neutralize opposition and secure executive authority during ${l.era}.`,
				},
				{
					label: "Impose harsh martial law across realm",
					historical: false,
					effects: { gold: -2, stability: 1, legacy: -2 },
					consequence: {
						text: "Occupied markets stay shuttered; merchants count their dead.",
						effects: { gold: -1, stability: -1, legacy: 0 },
						delay: 2,
					},
					whatif: `Stationing armed cohorts in every marketplace choked commerce and stirred bitter resentment among the common folk of ${l.civ}. Royal revenue plunged under military upkeep. In truth, ${l.name} balanced authority with institutional legitimacy to maintain civil peace.`,
				},
			],
			reveal: `At the dawn of ${l.name}'s rule, securing the throne against factional intrigue was critical. By consolidating loyalists while establishing administrative discipline, the authority of ${l.civ} was firmly preserved throughout ${l.era}.`,
			fun_fact:
				"In ancient courts, royal proclamations were authenticated with personal cylinder seals or signet rings pressed into soft wax or wet clay to prevent forgery.",
		},
		{
			year: years[1],
			title: "Reform of the Treasury",
			advisor: goldAdv.role,
			emotion: "calm",
			speech: `${l.name}, the royal treasury of ${l.civ} faces a severe reckoning. Trade caravans report harassment, road maintenance has halted, and our provincial administrators demand back pay. We must restore fiscal balance. Shall we overhaul tax collection and invest in secure trade roads, or dilute the metal content of our coinage?`,
			rebuttal: {
				advisor: faithAdv.role,
				line: `Wealth without virtue is fleeting, ${goldAdv.name}. A sovereign who burdens the devout will answer to higher powers.`,
				emotion: "bold",
			},
			choices: [
				{
					label: "Reform tax collection and secure trade",
					historical: true,
					effects: { gold: 2, stability: 1, legacy: 0 },
					consequence: {
						text: "Governors stripped of old levies send fewer gifts to court.",
						effects: { gold: -1, stability: 0, legacy: 0 },
						delay: 3,
					},
				},
				{
					label: "Debase the silver and gold currency",
					historical: false,
					effects: { gold: 2, stability: -2, legacy: -1 },
					whatif: `Mixing base metals into the coinage yielded a brief windfall, but traders across foreign ports soon refused ${l.civ}'s money. Runaway inflation wiped out merchant savings and triggered citywide bread strikes. Historically, ${l.name} stabilized revenues through legitimate administration and trade protection.`,
				},
				{
					label: "Levy punitive levies on sacred temples",
					historical: false,
					effects: { gold: 2, stability: -2, legacy: -2 },
					whatif: `Seizing consecrated treasures turned influential priests and scholars into vehement critics of the throne. Devout citizens refused to pay taxes, declaring the regime illegitimate. In truth, ${l.name} protected cultural sanctuaries to keep social order intact.`,
				},
			],
			reveal: `Pragmatic financial management kept ${l.civ} solvent during crucial years. By encouraging commerce and rooting out corrupt provincial extortion, ${l.name} funded public defenses and sustained stability across ${l.era}.`,
			fun_fact:
				"Historical royal treasuries regularly inspected circulating coinage by dropping pieces onto stone tables; experienced moneyers could detect debased copper alloys by pitch alone.",
		},
		{
			year: years[2],
			title: "Sanctuary of the Gods",
			advisor: faithAdv.role,
			emotion: "bold",
			speech: `Sire, the sages and temple keepers of ${l.civ} implore you to remember posterity. Grand monuments and codified sacred traditions unite our diverse peoples under one shared identity and preserve your name for eternity. Shall we commission a monumental sanctuary and patronize the scholars, or dismiss these holy traditions as costly distractions?`,
			rebuttal: {
				advisor: warAdv.role,
				line: `Splendid temples will not parry enemy spears if our border ramparts crumble into ruin, ${faithAdv.name}.`,
				emotion: "alarmed",
			},
			choices: [
				{
					label: "Commission monument and codify rites",
					historical: true,
					effects: { gold: -1, stability: 1, legacy: 2 },
				},
				{
					label: "Proclaim sovereign divinity above gods",
					historical: false,
					effects: { gold: 0, stability: -2, legacy: -1 },
					whatif: `Demanding personal worship triggered severe theological outrage among orthodox elders in ${l.civ}. Devout commanders mutinied rather than sacrifice at the ruler's altar. In reality, ${l.name} ruled as the protector of sacred customs rather than claiming divine personhood.`,
				},
				{
					label: "Disband monastic orders and seize land",
					historical: false,
					effects: { gold: 1, stability: -2, legacy: -2 },
					whatif: `Dissolving sacred orders created legions of displaced monks who stirred peasant revolts across the provinces of ${l.civ}. The crown lost its primary cultural scribes and historians. Historically, ${l.name} cultivated the alliance of spiritual leaders to reinforce royal legitimacy.`,
				},
			],
			reveal: `Monumental architecture and cultural patronage were indispensable tools of statecraft for ${l.name}. The enduring structures and chronicles commissioned during ${l.era} came to define the heritage of ${l.civ} for subsequent millennia.`,
			fun_fact:
				"Monument builders often hid stone foundation deposits containing precious gems, bronze models, and inscribed dedication tablets underneath major temple pillars.",
		},
		{
			year: years[3],
			title: "The Frontier Ultimatum",
			advisor: warAdv.role,
			emotion: "alarmed",
			speech: `${l.name}, scouts ride in from the frontier marches of ${l.civ}. A hostile foreign confederation amasses along our border and their emissaries demand heavy tribute under threat of total invasion. Our cohorts await your command. Shall we fortify strategic passes and negotiate from strength, or yield frontier outposts to avoid war?`,
			rebuttal: {
				advisor: goldAdv.role,
				line: `War is ruinously expensive, ${warAdv.name}; a clever diplomat with sacks of silver can buy peace for half the cost of an army.`,
				emotion: "amused",
			},
			choices: [
				{
					label: "Fortify frontier and deter invasion",
					historical: true,
					effects: { gold: -1, stability: 1, legacy: 1 },
				},
				{
					label: "Cede border fortifications for peace",
					historical: false,
					effects: { gold: 1, stability: -2, legacy: -2 },
					whatif: `Ceding the frontier mountains left the core provinces of ${l.civ} exposed to sudden invasion. Emboldened by weakness, enemy armies demanded the capital itself within two campaigns. Historically, ${l.name} understood that firm deterrence was essential to preserve peace.`,
				},
				{
					label: "Launch reckless charge into enemy land",
					historical: false,
					effects: { gold: -2, stability: -1, legacy: 0 },
					whatif: `Marching blindly into hostile wilderness exhausted supplies and led ${l.civ}'s legions into a devastating mountain trap. The resulting slaughter crippled the realm's military capacity. In truth, ${l.name} fought defensively and chose battlefields with calculated advantage.`,
				},
			],
			reveal: `Disciplined frontier deterrence defended ${l.civ} against external catastrophe. By fortifying critical choke points while leaving diplomatic channels open, ${l.name} secured the sovereignty of ${l.civ} throughout ${l.era}.`,
			fun_fact:
				"Frontier fortresses in this era were routinely designed with bent-axis gateways so attackers could not charge straight through an opened gate without exposing their unshielded sides.",
		},
		{
			year: years[4],
			title: "The Great Calamity",
			advisor: goldAdv.role,
			emotion: "alarmed",
			speech: `${l.name}, disaster strikes the heartland: prolonged drought and severe frost threaten the harvest across ${l.civ}. Food prices soar in the capital and anxious crowds gather around the palace gates. Neighboring realms watch eagerly for our collapse. How will your majesty steer the empire through this existential crisis?`,
			rebuttal: {
				advisor: warAdv.role,
				line: `We can enforce order with our shields, ${goldAdv.name}, but a sovereign who starves their own subjects rules over a kingdom of ghosts.`,
				emotion: "bold",
			},
			choices: [
				{
					label: "Open royal granaries and direct relief",
					historical: true,
					effects: { gold: -1, stability: 2, legacy: 2 },
				},
				{
					label: "Bar palace gates and hoard provisions",
					historical: false,
					effects: { gold: 1, stability: -2, legacy: -2 },
					whatif: `Hoarding state grain behind palace gates sparked an uncontrollable rebellion. Furious citizens stormed the courtyards of ${l.civ} and regular troops refused orders to fire on their own families. In reality, ${l.name} opened emergency granaries and personally coordinated relief to keep the realm united.`,
				},
				{
					label: "Expel starving populace beyond walls",
					historical: false,
					effects: { gold: 0, stability: -2, legacy: -1 },
					whatif: `Driving desperate citizens into the countryside formed massive rogue raiding bands that ravaged farmsteads and severed food caravans destined for ${l.civ}. In truth, ${l.name} maintained civic solidarity and preserved public trust through decisive statesmanship.`,
				},
			],
			reveal: `Meeting systemic crisis with decisive compassion and administrative organization proved the crowning triumph of ${l.name}'s reign. The resilience of ${l.civ} during ${l.era} earned an indelible place in the memory of posterity.`,
			fun_fact:
				"State granaries in the ancient world frequently utilized elevated cypress floors and sulfur fumigation to keep grain dry and edible for up to five years in reserve.",
		},
		{
			year: years[5],
			title: "The Great Alliance",
			advisor: faithAdv.role,
			emotion: "calm",
			speech: `Emissaries from neighboring realms seek royal audience, ${l.name}. They propose an enduring treaty of peace, sealed by sacred oaths and shared trade routes across the borders of ${l.civ}. Will you ratify this covenant of friendship, or press for total vassalage?`,
			rebuttal: {
				advisor: warAdv.role,
				line: `Treaties are only parchment, ${faithAdv.name}. A wise ruler trusts hardened steel over foreign smiles.`,
				emotion: "alarmed",
			},
			choices: [
				{
					label: "Ratify treaty and foster open trade",
					historical: true,
					effects: { gold: 1, stability: 1, legacy: 1 },
				},
				{
					label: "Demand humiliating tribute and hostages",
					historical: false,
					effects: { gold: 2, stability: -1, legacy: -2 },
					whatif: `Extorting punitive tribute provoked an immediate regional coalition against ${l.civ}. Former neutrals mobilized across all frontiers to break your hegemony. In truth, ${l.name} balanced imperial prestige with diplomatic reciprocity to ensure durable stability.`,
				},
				{
					label: "Expel the ambassadors without audience",
					historical: false,
					effects: { gold: 0, stability: -1, legacy: -1 },
					whatif: `Refusing diplomatic engagement isolated ${l.civ} completely from the major trade networks of the era. Merchants redirected their caravans through rival capitals. Historically, ${l.name} welcomed foreign envoys to elevate the realm's standing.`,
				},
			],
			reveal: `Astute diplomacy and reciprocal pacts allowed ${l.civ} to consolidate its golden age without squandering blood in needless border wars throughout ${l.era}.`,
			fun_fact:
				"Ancient peace treaties were frequently carved onto bronze tablets or temple walls in multiple languages so travelers and merchants could read the terms.",
		},
		{
			year: years[6],
			title: "The Golden Academy",
			advisor: goldAdv.role,
			emotion: "proud",
			speech: `The fame of ${l.civ} has attracted the finest astronomers, poets, and jurists of the known world, Sire. They beseech your Majesty to establish an imperial academy and translate the wisdom of all nations into our royal library. Shall we fund this renaissance of knowledge?`,
			rebuttal: {
				advisor: faithAdv.role,
				line: `Let us ensure these foreign philosophers do not question the ancient traditions of ${l.civ}, ${goldAdv.name}.`,
				emotion: "alarmed",
			},
			choices: [
				{
					label: "Endow the academy and codify laws",
					historical: true,
					effects: { gold: -1, stability: 1, legacy: 2 },
				},
				{
					label: "Censor foreign texts and enforce dogma",
					historical: false,
					effects: { gold: 0, stability: -1, legacy: -2 },
					whatif: `Banning foreign treatises sparked clandestine intellectual dissent throughout ${l.civ}. The brightest scholars fled to rival courts, taking their knowledge with them. In truth, ${l.name} fostered learning as the hallmark of an enlightened civilization.`,
				},
				{
					label: "Tax schools as unproductive luxuries",
					historical: false,
					effects: { gold: 1, stability: -2, legacy: -1 },
					whatif: `Taxing scholars closed the civic academies within a generation, leaving ${l.civ} with an administrative shortage of competent magistrates. Historically, ${l.name} understood that legal clarity and education were vital pillars of the crown.`,
				},
			],
			reveal: `The intellectual flourishing patronized by ${l.name} became the enduring beacon of ${l.civ}, ensuring its cultural dominance outlasted even its physical monuments.`,
			fun_fact:
				"Royal archives in this era stored clay tablets in wicker baskets lined with cedar oil to repel moisture and insects.",
		},
		{
			year: years[7],
			title: "The Sovereign's Testament",
			advisor: faithAdv.role,
			emotion: "bold",
			speech: `Your twilight years approach, ${l.name}. The realm of ${l.civ} is vast and prosperous, but ambitious ministers already eye the succession. How will your Majesty decree the eternal governance of the realm and seal your name for posterity?`,
			rebuttal: {
				advisor: goldAdv.role,
				line: `A peaceful transfer of authority is worth more than ten victorious campaigns, ${faithAdv.name}.`,
				emotion: "calm",
			},
			choices: [
				{
					label: "Inscribe royal codex and confirm chosen heir",
					historical: true,
					effects: { gold: 0, stability: 2, legacy: 2 },
				},
				{
					label: "Partition the empire among rival claimants",
					historical: false,
					effects: { gold: -1, stability: -2, legacy: -2 },
					whatif: `Dividing the empire among multiple successors triggered a devastating civil war the moment ${l.name} was laid to rest. Provinces were reduced to ash. In truth, ${l.name} fought to maintain the unbroken unity of ${l.civ}.`,
				},
				{
					label: "Exhaust treasury on a colossal mausoleum",
					historical: false,
					effects: { gold: -2, stability: -1, legacy: 1 },
					whatif: `Bankrupting the state to construct an extravagant tomb left the incoming ruler unable to pay the army garrisons. The empire fell into immediate disarray. In reality, ${l.name} left a solvent treasury and enduring institutional reforms.`,
				},
			],
			reveal: `By establishing orderly succession and codifying royal law, ${l.name} completed one of history's most celebrated reigns, leaving ${l.civ} unified and revered across generations.`,
			fun_fact:
				"Many sovereign testament stelae were intentionally inscribed with curses against any future monarch who dared erase the founder's laws or monuments.",
		},
	];

	return {
		season_title:
			season === 1
				? `${l.name}: The Dawn of Rule`
				: `${l.name}: Season ${season}`,
		intro: `The court of ${l.civ} gathers before ${l.name}. Through intrigue, economic trials, and foreign threats, the destiny of ${l.era} is forged in the council chambers.`,
		turns,
	};
}

/** Live generation when online, otherwise pre-generated chapters (rotating). */
export async function getChapter(
	g: GameState,
	season: number,
	special: Turn["special"],
	turnCount = 8,
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
			const chapter = await generateChapter(g, season, special, turnCount);
			if (chapter.turns?.length >= 3) return { chapter, live: true };
		} catch (e) {
			console.warn("chapter generation failed, using fallback", e);
		}
	}
	if (fallback.length === 0)
		return {
			chapter: createArchetypeFallbackChapter(g, season),
			live: false,
		};
	return {
		chapter:
			season <= fallback.length
				? fallback[season - 1]
				: createArchetypeFallbackChapter(g, season),
		live: false,
	};
}

export const emotionOr = (e: string | undefined): Emotion =>
	EMOTIONS.includes(e ?? "") ? (e as Emotion) : "calm";
