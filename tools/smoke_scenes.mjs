// Start each secondary scene directly (with a fake finished game) and capture errors + screenshots.
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:5173/";
const b = await chromium.launch();
const ctx = await b.newContext({
	viewport: { width: 390, height: 844 },
	isMobile: true,
	hasTouch: true,
});
const p = await ctx.newPage();
const errs = [];
p.on("console", (m) => {
	if (
		["error", "warning"].includes(m.type()) &&
		!m.text().includes("GL Driver")
	)
		errs.push(`[${m.type()}] ${m.text()}`);
});
p.on("pageerror", (e) => errs.push(`[pageerror] ${e.message}`));
await p.goto(url);
await p.waitForTimeout(3000);

// Click Begin
await p.evaluate(() => {
	const findAndClick = (list, text) => {
		for (const item of list) {
			if (item.label?.text?.includes(text)) {
				item.emit("pointerdown");
				item.emit("pointerup");
				return true;
			}
			if (item.list && findAndClick(item.list, text)) return true;
		}
		return false;
	};
	const title = globalThis.__game?.scene?.getScene("Title");
	findAndClick(title?.children?.list || [], "Begin");
});
await p.waitForTimeout(2000);

// Click Take the Throne
await p.evaluate(() => {
	const findAndClick = (list, text) => {
		for (const item of list) {
			if (item.label?.text?.includes(text)) {
				item.emit("pointerdown");
				item.emit("pointerup");
				return true;
			}
			if (item.list && findAndClick(item.list, text)) return true;
		}
		return false;
	};
	const sel = globalThis.__game?.scene?.getScene("Select");
	findAndClick(sel?.children?.list || [], "Take the Throne");
});
await p.waitForTimeout(3000);
// fake a finished chapter in the save
await p.evaluate(() => {
	let g = null;
	const saveStr = localStorage.getItem("chronicle-save");
	if (saveStr) {
		try {
			g = JSON.parse(saveStr);
		} catch {}
	}
	if (!g) {
		const leader = {
			id: "cleopatra",
			name: "Cleopatra VII",
			civ: "Ptolemaic Egypt",
			era: "51–30 BC",
			quote: "I will not be triumphed over.",
			voice: "saoirse",
			palette: { primary: "#0f6f7a", accent: "#e0b64a", bg: "#062a33" },
			advisors: [
				{
					role: "war",
					name: "Achillas",
					title: "Commander",
					trait: "bold",
					voice: "marcus",
				},
				{
					role: "gold",
					name: "Apollodorus",
					title: "Treasurer",
					trait: "calm",
					voice: "toby",
				},
				{
					role: "faith",
					name: "Sosigenes",
					title: "Priest",
					trait: "proud",
					voice: "declan",
				},
			],
		};
		g = {
			leader,
			season: 1,
			turnIndex: 5,
			stats: { gold: 6, stability: 4, legacy: 8 },
			trust: { war: 1, gold: 0, faith: 2 },
			combo: 2,
			history: [
				{
					year: "48 BC",
					title: "The Roman Fleet",
					chosen: "Provide grain",
					historical: true,
					matched: true,
					advisor: "gold",
					followedAdvisor: true,
				},
			],
			chapter: null,
			liar: null,
			liedLastTurn: false,
			seasonsPlayed: 1,
			collapse: null,
			seals: { prescience: 1, treasury: 1, decree: 1 },
		};
	} else {
		g.turnIndex = g.chapter?.turns?.length ?? 5;
		g.stats = { gold: 6, stability: 4, legacy: 8 };
	}
	localStorage.setItem("chronicle-save", JSON.stringify(g));
	console.log("save initialized for testing");
});
const start = async (k, data) => {
	await p.evaluate(
		([k, data]) => {
			const g = globalThis.__game;
			for (const s of g.scene.getScenes(true)) s.scene.stop();
			g.scene.start(k, data);
		},
		[k, data ?? {}],
	);
	await p.waitForTimeout(6000);
	await p.screenshot({ path: `/tmp/sc_${k}.png` });
	console.log(
		k,
		"active:",
		await p.evaluate(() =>
			globalThis.__game.scene.getScenes(true).map((s) => s.scene.key),
		),
	);
};
await start("Verdict");
await start("Codex");
await start("Chronicle");
await start("Settings");
await start("Summon");
console.log(errs.join("\n") || "no console errors");
await b.close();
