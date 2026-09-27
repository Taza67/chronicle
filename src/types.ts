export type AdvisorRole = "war" | "gold" | "faith";
export type Emotion = "calm" | "alarmed" | "amused" | "proud" | "bold";
export type Stat = "gold" | "stability" | "legacy";

export interface Effects {
	gold: number;
	stability: number;
	legacy: number;
}

export interface RoyalSeals {
	prescience: number;
	treasury: number;
	decree: number;
}

export interface Relic {
	id: string;
	name: string;
	leaderId?: string;
	icon: string;
	desc: string;
	lore: string;
}

export interface DeferredConsequence {
	/** Short echo line narrated when it resurfaces. */
	text: string;
	effects: Effects;
	/** Turns until it resurfaces (1–3). */
	delay: number;
}

export interface Choice {
	label: string;
	historical: boolean;
	effects: Effects;
	/** Pre-generated counterfactual for non-historical choices (fallback content). */
	whatif?: string;
	/** Player-invented decree via voice input — the Oracle cannot wager on it. */
	custom?: boolean;
	/** A repercussion that echoes back a few turns later. */
	consequence?: DeferredConsequence;
}

/** A scheduled deferred consequence, ticking down each turn. */
export interface DeferredFlag {
	text: string;
	effects: Effects;
	turnsLeft: number;
}

export interface Turn {
	year: string;
	title: string;
	advisor: AdvisorRole;
	emotion: Emotion;
	speech: string;
	rebuttal: { advisor: AdvisorRole; line: string; emotion: Emotion } | null;
	choices: Choice[];
	reveal: string;
	fun_fact: string;
	special?: "revolt" | "bankruptcy" | "prophecy" | null;
}

export interface Chapter {
	season_title: string;
	intro: string;
	turns: Turn[];
}

export interface Advisor {
	role: AdvisorRole;
	name: string;
	title: string;
	trait: string;
	voice: string;
}

export interface BBox {
	/** [ymin, xmin, ymax, xmax] normalised 0..1000 */
	mouth: [number, number, number, number];
	eyes: [number, number, number, number];
	head: [number, number, number, number];
}

export interface Leader {
	id: string;
	name: string;
	civ: string;
	era: string;
	quote: string;
	voice: string;
	palette: { primary: string; accent: string; bg: string };
	advisors: Advisor[];
	portraitPrompt: string;
	scenePrompt: string;
	musicPrompt: string;
	generated?: boolean;
	/** Data-URL art for summoned leaders (default leaders use the manifest). */
	art?: LeaderArt;
}

export interface CharacterArt {
	src: string;
	mouthOpen: string;
	mouthHalf: string;
	eyesClosed: string;
	bbox: BBox;
}

export interface LeaderArt {
	leader: CharacterArt;
	scene: string;
	sceneFar: string;
	advisors: Record<AdvisorRole, CharacterArt>;
}

export interface ArtManifest {
	[leaderId: string]: {
		leader: { src: string; bbox: BBox };
		scene: { src: string; far: string };
		advisors: Record<AdvisorRole, { src: string; bbox: BBox }>;
	};
}

export interface PlayerChoiceRecord {
	year: string;
	title: string;
	chosen: string;
	historical: boolean;
	/** Oracle bet was right. */
	matched: boolean;
	advisor: AdvisorRole;
	followedAdvisor: boolean;
}

export interface GameState {
	leader: Leader;
	season: number;
	turnIndex: number;
	stats: Effects;
	trust: Record<AdvisorRole, number>;
	combo: number;
	history: PlayerChoiceRecord[];
	chapter: Chapter | null;
	/** Role of the advisor who is lying this turn (trust ≤ −2), null otherwise. */
	liar: AdvisorRole | null;
	liedLastTurn: boolean;
	seasonsPlayed: number;
	collapse?: "bankruptcy" | "revolt" | null;
	/** Available royal seals for tactical decisions. */
	seals: RoyalSeals;
	/** Whether the player activated the Prescience seal for the current dilemma. */
	prescienceActive?: boolean;
	/** Role of an advisor exposed by the player this turn. */
	exposedLiar?: AdvisorRole | null;
	/** Relic IDs currently active in this run. */
	relics?: string[];
	/** Has the revolt collapse already been averted by Ashoka's relic? */
	avertedRevolt?: boolean;
	/** Whether the popular petitions audience has been completed this chapter. */
	petitionsDone?: boolean;
	/** Cascade warning injected into the current chapter (bankruptcy/revolt/prophecy). */
	chapterSpecial?: "revolt" | "bankruptcy" | "prophecy" | null;
	/** Whether this reign's verdict was already recorded in the chronicle. */
	reignRecorded?: boolean;
	/** Deferred consequences ticking toward resurfacing. */
	flags?: DeferredFlag[];
	/** Times each advisor's counsel was heeded — feeds the court-whisper favors. */
	favor?: Record<AdvisorRole, number>;
}
