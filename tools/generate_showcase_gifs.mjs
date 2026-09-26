import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const URL = process.argv[2] ?? "http://localhost:5173/";
const OUT_DIR = path.resolve("showcase");
const TMP_VID_DIR = "/tmp/chronicle_showcase_raw";

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
if (fs.existsSync(TMP_VID_DIR))
	fs.rmSync(TMP_VID_DIR, { recursive: true, force: true });
fs.mkdirSync(TMP_VID_DIR, { recursive: true });

console.log("🎥 Starting Chronicle showcase generation on", URL);

const browser = await chromium.launch();
const context = await browser.newContext({
	viewport: { width: 414, height: 736 },
	recordVideo: { dir: TMP_VID_DIR, size: { width: 414, height: 736 } },
	isMobile: true,
	hasTouch: true,
});

const page = await context.newPage();

const tapByText = async (text, waitMs = 2000) => {
	const clicked = await page.evaluate((t) => {
		const g = globalThis.__game;
		for (const scene of g.scene.getScenes(true)) {
			for (const child of scene.children.list) {
				if (child.label?.text?.includes(t)) {
					child.emit("pointerup");
					return true;
				}
			}
		}
		return false;
	}, text);
	await page.waitForTimeout(waitMs);
	return clicked;
};

// 1. Boot to Title
console.log("▶ 1. Booting to Title...");
await page.goto(URL);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => globalThis.__game?.scene?.isActive("Title"), {
	timeout: 12000,
});
await page.waitForTimeout(1500);

// 2. Title -> Select
console.log("▶ 2. Entering Select carousel...");
await tapByText("Begin Your Reign", 2000);
await page.waitForFunction(() => globalThis.__game?.scene?.isActive("Select"), {
	timeout: 5000,
});

// Carousel step
console.log("▶ 3. Stepping carousel (Cleopatra -> Napoleon -> Mansa Musa)...");
await page.waitForTimeout(1200);
await page.evaluate(() => globalThis.__game?.scene.getScene("Select")?.step(1));
await page.waitForTimeout(1800);
await page.evaluate(() => globalThis.__game?.scene.getScene("Select")?.step(1));
await page.waitForTimeout(1800);
await page.evaluate(() =>
	globalThis.__game?.scene.getScene("Select")?.step(-1),
);
await page.waitForTimeout(1500);

// 3. Take the throne with Napoleon
console.log("▶ 4. Taking the Throne...");
await tapByText("Take the Throne", 2500);
await page.waitForFunction(() => globalThis.__game?.scene?.isActive("Court"), {
	timeout: 6000,
});

// Wait through chapter card
console.log("▶ 5. Chapter card and advisor entry...");
await page.waitForTimeout(12000);

// Advisor speaks with lip-sync
console.log("▶ 6. Advisor speaking with animated lip-sync...");
await page.waitForTimeout(12000);

// Wait for choice cards to settle
console.log("▶ 7. Choice cards appear & pick choice...");
await page.waitForTimeout(3000);
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

// Oracle bet & 3D coin flip
console.log("▶ 8. Oracle bet coin flip...");
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
await page.waitForTimeout(4500);

await context.close();
await browser.close();

console.log("✔ Recording session finished!");

const files = fs.readdirSync(TMP_VID_DIR).filter((f) => f.endsWith(".webm"));
if (!files.length) throw new Error(`No webm found in ${TMP_VID_DIR}`);
const video = path.join(TMP_VID_DIR, files[0]);

console.log("⚡ Generating final GIF showcase suite...");

// 1. Itch.io Animated Cover (630x500)
// Focuses on the speaking advisor + leader screen
const coverGif = path.join(OUT_DIR, "itch-cover.gif");
execSync(
	`ffmpeg -y -ss 00:00:36 -t 5.0 -i "${video}" -vf "crop=414:328:0:140,scale=630:500:flags=lanczos,fps=12,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" "${coverGif}"`,
	{ stdio: "inherit" },
);
console.log("✔ Generated", coverGif);

// 2. Court Advisor Living Portrait (360x640)
const advisorGif = path.join(OUT_DIR, "court-advisor.gif");
execSync(
	`ffmpeg -y -ss 00:00:35 -t 6.0 -i "${video}" -vf "scale=360:-1:flags=lanczos,fps=12,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" "${advisorGif}"`,
	{ stdio: "inherit" },
);
console.log("✔ Generated", advisorGif);

// 3. Leader Selection Carousel (360x640)
const carouselGif = path.join(OUT_DIR, "leader-carousel.gif");
execSync(
	`ffmpeg -y -ss 00:00:04.5 -t 5.0 -i "${video}" -vf "scale=360:-1:flags=lanczos,fps=12,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" "${carouselGif}"`,
	{ stdio: "inherit" },
);
console.log("✔ Generated", carouselGif);

// 4. Oracle Bet & Coin Flip (360x640)
const oracleGif = path.join(OUT_DIR, "oracle-bet.gif");
execSync(
	`ffmpeg -y -ss 00:00:39 -t 5.0 -i "${video}" -vf "scale=360:-1:flags=lanczos,fps=12,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3" "${oracleGif}"`,
	{ stdio: "inherit" },
);
console.log("✔ Generated", oracleGif);

console.log("\n✨ Showcase GIF suite successfully created in showcase/!");
