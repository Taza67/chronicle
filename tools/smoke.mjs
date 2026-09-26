// Headless smoke test: load the game, walk Title → Select → Court → one full turn, print console errors.
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
await p.waitForTimeout(4000);
// canvas is letterboxed: 720x1280 → 390x693, top offset 75
const L = (x, y) => [x * (390 / 720), 75 + y * (390 / 720)];
const tapL = async (x, y, wait = 1500) => {
	const [a, c] = L(x, y);
	await p.mouse.click(a, c);
	await p.waitForTimeout(wait);
};
const scene = async () =>
	p.evaluate(() =>
		globalThis.__game?.scene.getScenes(true).map((s) => s.scene.key),
	);
const shot = (n) => p.screenshot({ path: `/tmp/s_${n}.png` });
await shot("title");
await tapL(360, 965);
console.log("select:", await scene());
await tapL(360, 1228, 5000);
console.log("court:", await scene());
await shot("court_intro");
// skip intro + speech by waiting (offline simulated speech ≈ text length)
await p.waitForTimeout(8000); // chapter card
await shot("court_speech");
for (let i = 0; i < 3; i++) await tapL(360, 700, 2500); // skip speech + rebuttal
await p.waitForTimeout(2500);
await shot("court_choices");
// tap first choice card (cards stack in lower half)
await tapL(360, 935, 3000);
await shot("oracle");
await tapL(194, 991, 5000);
await shot("oracle_result");
await tapL(360, 700, 3000); // skip narration
await shot("reveal");
await tapL(360, 1228, 4000); // Next council
await shot("turn2");
console.log("end:", await scene());
console.log(errs.join("\n") || "no console errors");
await b.close();
