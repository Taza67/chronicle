import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const URL = process.argv[2] ?? "http://localhost:5173/";
const SHOT_DIR = path.resolve("showcase/screenshots");

if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

console.log("📸 Generating official itch.io 7-part screenshot suite on", URL);

const browser = await chromium.launch();
const context = await browser.newContext({
	viewport: { width: 414, height: 736 },
	isMobile: true,
	hasTouch: true,
});
const page = await context.newPage();
page.on("pageerror", (e) => console.error("❌ [PAGE ERROR]:", e.message));
page.on("console", (m) => {
	if (m.type() === "error") console.error("❌ [BROWSER ERROR]:", m.text());
});

// 1. Title Screen
console.log("▶ 1. Title Screen...");
await page.goto(URL);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => globalThis.__game?.scene.isActive("Title"), {
	timeout: 15000,
});
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(SHOT_DIR, "01-title-screen.png") });
console.log("✔ 01-title-screen.png saved");

// 2. Select Carousel
console.log("▶ 2. Select Carousel...");
await page.waitForTimeout(2000);
await page.evaluate(() => {
	const title = globalThis.__game.scene.getScene("Title");
	const btn = title.children.list.find(
		(c) => c.label?.text === "Begin Your Reign",
	);
	btn?.emit("pointerdown");
	btn?.emit("pointerup");
});
await page.waitForFunction(() => globalThis.__game?.scene.isActive("Select"), {
	timeout: 8000,
});
await page.evaluate(() => globalThis.__game?.scene.getScene("Select")?.step(1));
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(SHOT_DIR, "02-leader-carousel.png") });
console.log("✔ 02-leader-carousel.png saved");

// 3. Court Advisor Speaking
console.log("▶ 3. Court Advisor Speaking...");
await page.evaluate(() => globalThis.__game?.scene.getScene("Select")?.begin());
await page.waitForFunction(() => globalThis.__game?.scene.isActive("Court"), {
	timeout: 10000,
});

// Skip chapter card
await page.waitForTimeout(1000);
await page.evaluate(() => {
	const court = globalThis.__game.scene.getScene("Court");
	const shade = court.children.list.find((c) => c.input && c.depth === 90);
	if (shade) shade.emit("pointerup");
});

// Let advisor speak for 3 seconds
await page.waitForTimeout(4000);
await page.screenshot({
	path: path.join(SHOT_DIR, "03-court-advisor-speaking.png"),
});
console.log("✔ 03-court-advisor-speaking.png saved");

// 4. Choice Cards
console.log("▶ 4. Choice Cards...");
await page.evaluate(() => {
	const court = globalThis.__game.scene.getScene("Court");
	court.children.list
		.filter((c) =>
			["Subtitle", "AccusationStamp", "Portrait"].includes(c.constructor.name),
		)
		.forEach((c) => c.destroy());
	new court.RoyalSeals(
		court,
		600,
		court.g || { seals: { prescience: 1, treasury: 1, decree: 1 } },
		{},
	);
	new court.ChoiceCards(
		court,
		[
			{
				label:
					"Lead the Reserve Army through the Great St Bernard Pass on sledges",
				historical: true,
				effects: { gold: -1, stability: 1, legacy: 2 },
			},
			{
				label: "March safely along the Riviera coast under British naval guns",
				historical: false,
				effects: { gold: -2, stability: -1, legacy: 0 },
			},
			{
				label:
					"Fortify the Rhine frontier and await Austrian offensive in Provence",
				historical: false,
				effects: { gold: 0, stability: 1, legacy: -1 },
			},
		],
		{ micAvailable: false, onPick: () => {} },
	);
});
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(SHOT_DIR, "04-choice-cards.png") });
console.log("✔ 04-choice-cards.png saved");

// 5. Oracle Wager
console.log("▶ 5. Oracle Wager...");
await page.evaluate(() => {
	const court = globalThis.__game.scene.getScene("Court");
	court.children.list
		.filter((c) => ["ChoiceCards", "RoyalSeals"].includes(c.constructor.name))
		.forEach((c) => c.destroy());
	new court.Oracle(court, 3, () => {});
});
await page.waitForTimeout(2000);
await page.screenshot({ path: path.join(SHOT_DIR, "05-oracle-wager.png") });
console.log("✔ 05-oracle-wager.png saved");

// 6. Historical Reveal
console.log("▶ 6. Historical Reveal Parchment...");
await page.evaluate(() => {
	const court = globalThis.__game.scene.getScene("Court");
	court.children.list
		.filter((c) => c.constructor.name === "Oracle")
		.forEach((c) => c.destroy());
	new court.Reveal(
		court,
		"fact",
		"In May 1800, First Consul Napoleon Bonaparte led 40,000 men of the Army of the Reserve through the Great St Bernard Pass in treacherous spring snows, hauling dismantled cannon in hollowed pine trunks across the Alps to surprise Austrian forces in the plains of Lombardy.",
	);
});
await page.waitForTimeout(2500);
await page.screenshot({
	path: path.join(SHOT_DIR, "06-historical-reveal.png"),
});
console.log("✔ 06-historical-reveal.png saved");

// 7. Verdict Scorecard
console.log("▶ 7. Verdict Scorecard...");
await page.evaluate(() => {
	const g = globalThis.__game;
	for (const s of g.scene.getScenes(true)) s.scene.stop();
	const st = {
		leader: {
			id: "napoleon",
			name: "Napoleon Bonaparte",
			civ: "First French Empire",
			dates: "1799–1815",
		},
		season: 1,
		turnIndex: 5,
		stats: { gold: 8, stability: 7, legacy: 9 },
		trust: { war: 2, gold: 1, faith: -1 },
		combo: 4,
		history: [
			{
				year: "1800",
				title: "Marengo",
				chosen: "Cross the Great St Bernard Pass",
				historical: true,
				matched: true,
			},
			{
				year: "1801",
				title: "Bank of France",
				chosen: "Establish the Bank and stabilize currency",
				historical: true,
				matched: true,
			},
			{
				year: "1804",
				title: "Coronation",
				chosen: "Crown myself Emperor at Notre-Dame",
				historical: true,
				matched: true,
			},
			{
				year: "1805",
				title: "Austerlitz",
				chosen: "Strike the Allied center on the Pratzen",
				historical: true,
				matched: true,
			},
			{
				year: "1807",
				title: "Tilsit",
				chosen: "Raft on the Niemen with Tsar Alexander",
				historical: false,
				matched: false,
			},
		],
		seasonsPlayed: 1,
		collapse: null,
		seals: { prescience: 1, treasury: 1, decree: 1 },
	};
	g.scene.start("Verdict", { g: st });
});
await page.waitForTimeout(5000);
await page.screenshot({
	path: path.join(SHOT_DIR, "07-verdict-scorecard.png"),
});
console.log("✔ 07-verdict-scorecard.png saved");

await browser.close();
console.log("\n🎉 ALL 7 SCREENSHOTS CAPTURED SUCCESSFULLY IN", SHOT_DIR);
