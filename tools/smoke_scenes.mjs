// Start each secondary scene directly (with a fake finished game) and capture errors + screenshots.
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:5173/";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errs = [];
p.on("console", (m) => {
	if (["error", "warning"].includes(m.type()) && !m.text().includes("GL Driver")) errs.push(`[${m.type()}] ${m.text()}`);
});
p.on("pageerror", (e) => errs.push(`[pageerror] ${e.message}`));
await p.goto(url);
await p.waitForTimeout(3500);
await p.mouse.click(195, 598); // Begin → Select (creates nothing yet)
await p.waitForTimeout(1500);
await p.mouse.click(195, 740); // Throne → Court saves a game
await p.waitForTimeout(3000);
// fake a finished chapter in the save
await p.evaluate(() => {
	const key = Object.keys(localStorage).find((k) => /save|game/i.test(k));
	const g = JSON.parse(localStorage.getItem(key));
	g.turnIndex = g.chapter?.turns.length ?? 5;
	g.history = (g.chapter?.turns ?? []).map((t) => ({ year: t.year, title: t.title, chosen: t.choices[0].label, historical: t.choices[0].historical, matched: true, advisor: t.advisor, followedAdvisor: true }));
	g.stats = { gold: 6, stability: 4, legacy: 8 };
	localStorage.setItem(key, JSON.stringify(g));
	console.log("save key", key);
});
const start = async (k, data) => {
	await p.evaluate(([k, data]) => {
		const g = globalThis.__game;
		for (const s of g.scene.getScenes(true)) s.scene.stop();
		g.scene.start(k, data);
	}, [k, data ?? {}]);
	await p.waitForTimeout(6000);
	await p.screenshot({ path: `/tmp/sc_${k}.png` });
	console.log(k, "active:", await p.evaluate(() => globalThis.__game.scene.getScenes(true).map((s) => s.scene.key)));
};
await start("Verdict");
await start("Codex");
await start("Chronicle");
await start("Settings");
await start("Summon");
console.log(errs.join("\n") || "no console errors");
await b.close();
