/**
 * Pre-generate fallback chapters for the default leaders (reliable offline demo).
 * Uses the same prompt/schema as the runtime generator, but calls Gemini directly.
 *   GOOGLE_API_KEY=... node --experimental-strip-types tools/gen_chapters.ts [leaderId]
 * Writes public/data/chapters/<id>.json = Chapter[] (2 chapters: seasons 1 and 2).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { LEADERS } from "../src/content/leaders.ts";
import type { Chapter, GameState, Leader } from "../src/types.ts";

const KEY = process.env.GOOGLE_API_KEY;
if (!KEY) throw new Error("GOOGLE_API_KEY missing");

(globalThis as unknown as { location: { origin: string } }).location = {
	origin: "http://localhost",
};
const gen = await import("../src/core/generator.ts");

async function callGemini<T>(opts: {
	system: string;
	parts: { text: string }[];
	schema?: unknown;
	model?: string;
	temperature?: number;
}): Promise<T> {
	const body = {
		systemInstruction: { parts: [{ text: opts.system }] },
		contents: [{ role: "user", parts: opts.parts }],
		generationConfig: {
			responseMimeType: "application/json",
			responseSchema: opts.schema,
			temperature: opts.temperature ?? 0.9,
		},
	};
	for (let i = 0; i < 4; i++) {
		const r = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${opts.model ?? "gemini-3.8-flash"}:generateContent`,
			{
				method: "POST",
				headers: {
					"x-goog-api-key": KEY as string,
					"content-type": "application/json",
				},
				body: JSON.stringify(body),
			},
		);
		if (r.ok) {
			const j = (await r.json()) as {
				candidates: { content: { parts: { text: string }[] } }[];
			};
			return JSON.parse(
				j.candidates[0].content.parts.map((p) => p.text).join(""),
			) as T;
		}
		console.warn("gemini", r.status, (await r.text()).slice(0, 200));
		await new Promise((res) => setTimeout(res, 3000 * (i + 1)));
	}
	throw new Error("gemini failed");
}
gen.useGeminiClient(callGemini);

function validate(c: Chapter) {
	if (c.turns.length < 5) throw new Error(`turns=${c.turns.length}`);
	for (const t of c.turns) {
		if (t.choices.length !== 3) throw new Error("choices!=3");
		if (t.choices.filter((x) => x.historical).length !== 1)
			throw new Error("historical!=1");
		for (const x of t.choices)
			for (const k of ["gold", "stability", "legacy"] as const)
				x.effects[k] = Math.max(-2, Math.min(2, Math.round(x.effects[k] ?? 0)));
	}
}

async function forLeader(l: Leader) {
	const out = `public/data/chapters/${l.id}.json`;
	if (existsSync(out) && JSON.parse(readFileSync(out, "utf8")).length >= 2)
		return console.log("skip", l.id);
	const g: GameState = {
		leader: l,
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
	const chapters: Chapter[] = [];
	for (const season of [1, 2]) {
		for (let attempt = 0; attempt < 3; attempt++) {
			try {
				const c = await gen.generateChapter(g, season, null);
				validate(c);
				chapters.push(c);
				// pretend the player followed history so chapter 2 avoids the same dilemmas
				g.history = chapters.flatMap((ch) =>
					ch.turns.map((t) => ({
						year: t.year,
						title: t.title,
						chosen: t.choices.find((x) => x.historical)?.label ?? "",
						historical: true,
						matched: true,
						advisor: t.advisor,
						followedAdvisor: true,
					})),
				);
				console.log(l.id, "season", season, "ok:", c.season_title);
				break;
			} catch (e) {
				console.warn(l.id, "season", season, "retry", (e as Error).message);
			}
		}
	}
	mkdirSync("public/data/chapters", { recursive: true });
	writeFileSync(out, JSON.stringify(chapters, null, 1));
}

const only = process.argv[2];
await Promise.all(LEADERS.filter((l) => !only || l.id === only).map(forLeader));
