import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const URL = process.argv[2] ?? "http://localhost:5173/";
const SHOT_DIR = path.resolve("showcase/screenshots");

if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });

console.log("📸 Generating official 7-part itch.io screenshot suite on", URL);

const browser = await chromium.launch();
const context = await browser.newContext({
	viewport: { width: 390, height: 844 },
	isMobile: true,
	hasTouch: true,
});
const page = await context.newPage();

const tapButton = async (text, waitMs = 2000) => {
	const clicked = await page.evaluate((btnText) => {
		const game = globalThis.__game;
		const findButton = (node) => {
			if (!node) return null;
			if (node.label?.text === btnText) return node;
			const children =
				node.list || (node.children?.list ? node.children.list : null);
			if (children) {
				for (const child of children) {
					const found = findButton(child);
					if (found) return found;
				}
			}
			return null;
		};
		for (const scene of game.scene.getScenes(true)) {
			const btn = findButton(scene);
			if (btn) {
				btn.emit("pointerdown");
				btn.emit("pointerup");
				return true;
			}
		}
		return false;
	}, text);
	await page.waitForTimeout(waitMs);
	return clicked;
};

const tapCanvas = async (gx, gy, waitMs = 1500) => {
	const coords = await page.evaluate(
		([x, y]) => {
			const canvas =
				globalThis.__game?.canvas || document.querySelector("canvas");
			if (!canvas) return null;
			const r = canvas.getBoundingClientRect();
			const s = r.width / 720;
			return [r.left + x * s, r.top + y * s];
		},
		[gx, gy],
	);
	if (coords) await page.mouse.click(coords[0], coords[1]);
	await page.waitForTimeout(waitMs);
};

// 1. Title Screen
console.log("▶ 1. Capturing Title Screen...");
await page.goto(URL);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => globalThis.__game?.scene.isActive("Title"), {
	timeout: 15000,
});
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(SHOT_DIR, "01-title-screen.png") });
console.log("✔ 01-title-screen.png saved");

// 2. Leader Carousel
console.log("▶ 2. Capturing Leader Carousel...");
await tapButton("Begin Your Reign", 2500);
await page.waitForFunction(() => globalThis.__game?.scene.isActive("Select"), {
	timeout: 8000,
});
await page.evaluate(() => {
	globalThis.__game?.scene.getScene("Select")?.step(1);
});
await page.waitForTimeout(1800);
await page.screenshot({ path: path.join(SHOT_DIR, "02-leader-carousel.png") });
console.log("✔ 02-leader-carousel.png saved");

// 3. Court Advisor Speaking
console.log("▶ 3. Entering Court and capturing advisor speaking...");
await tapButton("Take the Throne", 3000);
await page.waitForFunction(() => globalThis.__game?.scene.isActive("Court"), {
	timeout: 8000,
});

// Skip chapter card
await page.waitForTimeout(2000);
await tapCanvas(360, 700, 2000);

// Advisor enters and speaks
await page.waitForTimeout(2500);
await page.screenshot({
	path: path.join(SHOT_DIR, "03-court-advisor-speaking.png"),
});
console.log("✔ 03-court-advisor-speaking.png saved");

// 4. Choice Cards
console.log("▶ 4. Capturing Choice Cards...");
await tapCanvas(360, 700, 1500); // Skip speaker
await tapCanvas(360, 700, 1500); // Skip rebuttal if present
await page.waitForTimeout(1800);
await page.screenshot({ path: path.join(SHOT_DIR, "04-choice-cards.png") });
console.log("✔ 04-choice-cards.png saved");

// 5. Oracle Bet
console.log("▶ 5. Picking choice and capturing Oracle wager...");
await page.evaluate(() => {
	const court = globalThis.__game?.scene.getScene("Court");
	const list = court?.children?.list || court?.sys?.displayList?.list || [];
	for (const child of list) {
		if (child.cards && child.cards.length > 0) {
			child.cards[0].emit("pointerdown");
			child.cards[0].emit("pointerup");
			break;
		}
	}
});
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(SHOT_DIR, "05-oracle-wager.png") });
console.log("✔ 05-oracle-wager.png saved");

// 6. Historical Reveal Parchment
console.log("▶ 6. Placing wager and capturing Historical Reveal Parchment...");
await page.evaluate(() => {
	const court = globalThis.__game?.scene.getScene("Court");
	const list = court?.children?.list || court?.sys?.displayList?.list || [];
	for (const child of list) {
		if (child.tablets && child.tablets.length > 0) {
			child.tablets[0].emit("pointerdown");
			child.tablets[0].emit("pointerup");
			break;
		}
	}
});
await page.waitForTimeout(5000); // Coin flip + shockwave resolves to reveal parchment
await page.screenshot({
	path: path.join(SHOT_DIR, "06-historical-reveal.png"),
});
console.log("✔ 06-historical-reveal.png saved");

// 7. Verdict Scorecard
console.log("▶ 7. Capturing Verdict Scorecard...");
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
		stats: { gold: 7, stability: 6, legacy: 9 },
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
console.log(
	"\n🎉 Complete 7-part itch.io screenshot suite generated in showcase/screenshots!",
);
