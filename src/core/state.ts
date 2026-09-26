import type {
	AdvisorRole,
	Chapter,
	Effects,
	GameState,
	Leader,
	Turn,
} from "../types.ts";

export interface Settings {
	subtitles: boolean;
	musicVolume: number;
	voiceVolume: number;
	timer: boolean;
	reducedMotion: boolean;
	playedOnce: boolean;
}

export interface CodexEntry {
	leaderId: string;
	leaderName: string;
	year: string;
	kind: "fact" | "whatif";
	title: string;
	text: string;
	at: number;
}

export interface ReignRecord {
	leaderId: string;
	leaderName: string;
	civ: string;
	seasons: number;
	matched: number;
	total: number;
	stats: Effects;
	verdict: { title: string; epithet: string; comment: string };
	at: number;
}

export interface VerdictRecord {
	title: string;
	epithet: string;
	comment: string;
	leaderLine: string;
	nextEra: { leaderId: string | null; name: string; hook: string } | null;
}

const K = {
	settings: "chronicle.settings",
	save: "chronicle.save",
	codex: "chronicle.codex",
	reigns: "chronicle.reigns",
	leaders: "chronicle.leaders",
};

function read<T>(key: string, fallback: T): T {
	try {
		const v = localStorage.getItem(key);
		return v ? { ...fallback, ...JSON.parse(v) } : fallback;
	} catch {
		return fallback;
	}
}
function readArr<T>(key: string): T[] {
	try {
		const v = localStorage.getItem(key);
		return v ? (JSON.parse(v) as T[]) : [];
	} catch {
		return [];
	}
}
function write(key: string, v: unknown) {
	try {
		localStorage.setItem(key, JSON.stringify(v));
	} catch {
		/* quota */
	}
}

export const settings: Settings = read<Settings>(K.settings, {
	subtitles: true,
	musicVolume: 0.6,
	voiceVolume: 1,
	timer: false,
	reducedMotion: false,
	playedOnce: false,
});
export const saveSettings = () => write(K.settings, settings);

export function newGame(leader: Leader): GameState {
	return {
		leader,
		season: 1,
		turnIndex: 0,
		stats: { gold: 5, stability: 5, legacy: 5 },
		trust: { war: 0, gold: 0, faith: 0 },
		combo: 0,
		history: [],
		chapter: null,
		liar: null,
		liedLastTurn: false,
		seasonsPlayed: 0,
	};
}

export const saveGame = (g: GameState | null) =>
	g ? write(K.save, g) : localStorage.removeItem(K.save);
export const loadGame = (): GameState | null => {
	try {
		const v = localStorage.getItem(K.save);
		return v ? (JSON.parse(v) as GameState) : null;
	} catch {
		return null;
	}
};

export const codex = readArr<CodexEntry>(K.codex);
export function addCodex(e: Omit<CodexEntry, "at">) {
	if (
		codex.some(
			(c) =>
				c.leaderId === e.leaderId &&
				c.year === e.year &&
				c.kind === e.kind &&
				c.title === e.title,
		)
	)
		return;
	codex.unshift({ ...e, at: Date.now() });
	write(K.codex, codex);
}

export const reigns = readArr<ReignRecord>(K.reigns);
export function addReign(r: Omit<ReignRecord, "at">) {
	reigns.unshift({ ...r, at: Date.now() });
	write(K.reigns, reigns.slice(0, 50));
}

/** Player-summoned leaders (art stored as data URLs in IndexedDB-less localStorage is too big → kept in sessionless memory + meta). */
export const customLeaders = readArr<Leader>(K.leaders);
export function addCustomLeader(l: Leader) {
	const i = customLeaders.findIndex((x) => x.id === l.id);
	if (i >= 0) customLeaders[i] = l;
	else customLeaders.unshift(l);
	write(K.leaders, customLeaders.slice(0, 12));
}

export const clamp10 = (n: number) => Math.max(0, Math.min(10, n));

export function applyEffects(stats: Effects, e: Effects): Effects {
	return {
		gold: clamp10(stats.gold + e.gold),
		stability: clamp10(stats.stability + e.stability),
		legacy: clamp10(stats.legacy + e.legacy),
	};
}

export const ADVISOR_ROLES: AdvisorRole[] = ["war", "gold", "faith"];

export function cascadeFor(stats: Effects): Turn["special"] {
	if (stats.gold <= 1) return "bankruptcy";
	if (stats.stability <= 1) return "revolt";
	if (stats.legacy >= 9) return "prophecy";
	return null;
}

export function chapterSummary(g: GameState, ch: Chapter | null) {
	const matched = g.history.filter((h) => h.matched).length;
	return { matched, total: g.history.length, title: ch?.season_title ?? "" };
}
