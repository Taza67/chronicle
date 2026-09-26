import { getLeaderDefaultRelic } from "../content/relics.ts";
import type {
	AdvisorRole,
	Chapter,
	Effects,
	GameState,
	Leader,
	Turn,
} from "../types.ts";
import { deleteArt, getArt, putArt } from "./artStore.ts";

export type CampaignLength = 5 | 8 | 10;

export interface Settings {
	subtitles: boolean;
	musicVolume: number;
	voiceVolume: number;
	timer: boolean;
	reducedMotion: boolean;
	playedOnce: boolean;
	campaignLength: CampaignLength;
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
	collapse?: "bankruptcy" | "revolt" | null;
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
	relics: "chronicle.relics",
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
	campaignLength: 10,
});
export const saveSettings = () => write(K.settings, settings);

export const unlockedRelics = readArr<string>(K.relics);
export function unlockRelic(id: string): boolean {
	if (unlockedRelics.includes(id)) return false;
	unlockedRelics.push(id);
	write(K.relics, unlockedRelics);
	return true;
}

export function hasRelic(g: GameState, id: string): boolean {
	return (g.relics ?? []).includes(id);
}

export function restoreRandomSeal(
	g: GameState,
): keyof GameState["seals"] | null {
	const empty = (Object.keys(g.seals) as (keyof GameState["seals"])[]).filter(
		(k) => g.seals[k] <= 0,
	);
	if (empty.length === 0) return null;
	const picked = empty[Math.floor(Math.random() * empty.length)];
	g.seals[picked] = 1;
	saveGame(g);
	return picked;
}

export function newGame(leader: Leader): GameState {
	const defaultRelic = getLeaderDefaultRelic(leader.id);
	if (defaultRelic) unlockRelic(defaultRelic);
	const startingGold = defaultRelic === "relic_mansa_musa" ? 7 : 5;
	return {
		leader,
		season: 1,
		turnIndex: 0,
		stats: { gold: startingGold, stability: 5, legacy: 5 },
		trust: { war: 0, gold: 0, faith: 0 },
		combo: 0,
		history: [],
		chapter: null,
		liar: null,
		liedLastTurn: false,
		seasonsPlayed: 0,
		collapse: null,
		seals: { prescience: 1, treasury: 1, decree: 1 },
		relics: defaultRelic ? [defaultRelic] : [],
	};
}

/** Leader without its (huge) art payload; art lives in IndexedDB and in-memory. */
const stripArt = (l: Leader): Leader => {
	const { art: _art, ...rest } = l;
	return rest;
};

export const saveGame = (g: GameState | null) =>
	g
		? write(K.save, { ...g, leader: stripArt(g.leader) })
		: localStorage.removeItem(K.save);
export const loadGame = (): GameState | null => {
	try {
		const v = localStorage.getItem(K.save);
		if (!v) return null;
		const g = JSON.parse(v) as GameState;
		if (g.leader.generated) {
			const full = customLeaders.find((l) => l.id === g.leader.id);
			if (!full?.art) return null;
			g.leader = full;
		}
		if (!g.seals) {
			g.seals = { prescience: 1, treasury: 1, decree: 1 };
		}
		if (!g.relics) {
			const def = getLeaderDefaultRelic(g.leader.id);
			g.relics = def ? [def] : [];
		}
		return g;
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

/** Player-summoned leaders. Metadata in localStorage, art in IndexedDB (hydrated at boot). */
export const customLeaders = readArr<Leader>(K.leaders);
export async function addCustomLeader(l: Leader) {
	if (l.art) await putArt(l.id, l.art);
	const i = customLeaders.findIndex((x) => x.id === l.id);
	if (i >= 0) customLeaders[i] = l;
	else customLeaders.unshift(l);
	for (const old of customLeaders.splice(12)) void deleteArt(old.id);
	write(K.leaders, customLeaders.map(stripArt));
}

/** Attach stored art to summoned leaders; drops any whose art is missing. */
export async function hydrateCustomLeaders() {
	const arts = await Promise.all(customLeaders.map((l) => getArt(l.id)));
	for (let i = customLeaders.length - 1; i >= 0; i--) {
		if (arts[i]) customLeaders[i].art = arts[i];
		else customLeaders.splice(i, 1);
	}
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

export function checkCollapse(stats: Effects): "bankruptcy" | "revolt" | null {
	if (stats.gold <= 0) return "bankruptcy";
	if (stats.stability <= 0) return "revolt";
	return null;
}

export function chapterSummary(g: GameState, ch: Chapter | null) {
	const matched = g.history.filter((h) => h.matched).length;
	return { matched, total: g.history.length, title: ch?.season_title ?? "" };
}
