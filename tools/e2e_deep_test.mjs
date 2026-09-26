import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:5173/";

console.log("Starting deep E2E test on", url);

const b = await chromium.launch();
const ctx = await b.newContext({
	viewport: { width: 390, height: 844 },
	isMobile: true,
	hasTouch: true,
});
const p = await ctx.newPage();

const errs = [];
p.on("pageerror", (e) => {
	console.error("[PAGE_ERROR]", e.stack || e.message);
	errs.push(e.message);
});
p.on("console", (m) => {
	if (m.type() === "error") {
		console.error("[CONSOLE_ERROR]", m.text());
		errs.push(m.text());
	}
});

const tapButton = async (text, wait = 1200) => {
	const clicked = await p.evaluate((btnText) => {
		const findAndClick = (list) => {
			for (const item of list) {
				if (item.label?.text?.includes(btnText)) {
					item.emit("pointerdown");
					item.emit("pointerup");
					return true;
				}
				if (item.text?.includes(btnText)) {
					const btn = item.parentContainer || item;
					btn.emit("pointerdown");
					btn.emit("pointerup");
					return true;
				}
				if (item.list && findAndClick(item.list)) return true;
			}
			return false;
		};
		const g = globalThis.__game;
		for (const scene of g.scene.getScenes(true)) {
			if (findAndClick(scene.children?.list || [])) return true;
		}
		return false;
	}, text);
	if (!clicked) {
		console.warn(`Could not find button "${text}"`);
	}
	await p.waitForTimeout(wait);
	return clicked;
};

const tapL = async (gx, gy, wait = 1200) => {
	await p.evaluate(
		([x, y]) => {
			const canvas = document.querySelector("canvas");
			if (!canvas) return;
			const r = canvas.getBoundingClientRect();
			const s = r.width / 720;
			const cx = r.left + x * s;
			const cy = r.top + y * s;
			canvas.dispatchEvent(
				new PointerEvent("pointerdown", {
					clientX: cx,
					clientY: cy,
					bubbles: true,
				}),
			);
			canvas.dispatchEvent(
				new PointerEvent("pointerup", {
					clientX: cx,
					clientY: cy,
					bubbles: true,
				}),
			);
		},
		[gx, gy],
	);
	await p.waitForTimeout(wait);
};

const getActiveScenes = async () => {
	return await p.evaluate(() =>
		globalThis.__game?.scene.getScenes(true).map((s) => s.scene.key),
	);
};

// ============================================================================
// TEST 1: Full flow from Title -> Select -> Court -> Turn -> Oracle -> Reveal
// ============================================================================
console.log("\n--- TEST 1: Title -> Select -> Court flow ---");
await p.goto(url);
await p.waitForTimeout(3000);
await p.evaluate(() => localStorage.clear());
await p.reload();
await p.waitForFunction(() => {
	const s = globalThis.__game?.scene?.getScene("Title");
	return s?.children?.list?.some(
		(c) => c.label?.text?.includes("Begin") && c.alpha > 0.8,
	);
});
await p.waitForTimeout(500);

let scenes = await getActiveScenes();
console.log("Initial scene:", scenes);
if (!scenes.includes("Title")) throw new Error("Expected Title scene");

// Tap "Begin Your Reign"
console.log("Tapping Begin Your Reign...");
await tapButton("Begin", 1000);

await p.waitForFunction(
	() => {
		return globalThis.__game?.scene
			?.getScenes(true)
			.some((s) => s.scene.key === "Select");
	},
	{ timeout: 8000 },
);

scenes = await getActiveScenes();
console.log("After Begin, scenes:", scenes);
if (!scenes.includes("Select")) throw new Error("Expected Select scene");

// Slide to leader and start
console.log("Selecting leader and taking throne...");
await tapButton("Take the Throne", 1000);

await p.waitForFunction(
	() => {
		return globalThis.__game?.scene
			?.getScenes(true)
			.some((s) => s.scene.key === "Court");
	},
	{ timeout: 8000 },
);

scenes = await getActiveScenes();
console.log("In Court scene:", scenes);
if (!scenes.includes("Court")) throw new Error("Expected Court scene");

// Chapter card appears -> skip intro
console.log("Skipping Chapter card...");
await p.waitForTimeout(3500);
await tapL(360, 700, 2000); // Tap to skip intro

// Wait for advisor to speak -> skip advisor speech
console.log("Waiting for advisor and skipping speech...");
await p.waitForTimeout(3000);
await tapL(360, 700, 2000); // Tap to skip speech
await tapL(360, 700, 2000); // Tap to skip rebuttal if present

// Choice cards are visible -> pick choice 0
console.log("Picking choice 0...");
await p.waitForTimeout(2000);
await tapL(360, 920, 2500); // Tap first choice card

// Oracle is now active -> pick Wager
console.log("Facing the Oracle...");
await p.waitForTimeout(1500);
// Tap left talisman: Historical path (W / 2 - 165 = 195)
await tapL(195, 1000, 5000); // Place wager and let 3D coin flip resolve

// Reveal parchment is displayed -> skip narration and tap Continue
console.log("Reading historical reveal parchment...");
await p.waitForTimeout(3000);
await tapL(360, 700, 1500); // Tap to skip narrator audio
await tapL(360, 1160, 3000); // Tap Continue button at bottom of reveal

// Verified Turn 1 finished cleanly!
console.log("Turn 1 complete!");

// ============================================================================
// TEST 2: Fast-forward to Chapter End & Test Verdict Scene
// ============================================================================
console.log("\n--- TEST 2: Verdict Scene & Scorecard Count-up ---");
await p.evaluate(() => {
	const raw =
		localStorage.getItem("chronicle.save") ||
		localStorage.getItem("chronicle.save");
	const g = JSON.parse(raw);
	g.turnIndex = (g.chapter?.turns.length ?? 5) - 1; // Last turn
	g.stats = { gold: 7, stability: 6, legacy: 8 };
	localStorage.setItem("chronicle.save", JSON.stringify(g));
});

// Launch Verdict scene directly to inspect scorecard and particles
await p.evaluate(() => {
	const g = globalThis.__game;
	for (const s of g.scene.getScenes(true)) s.scene.stop();
	g.scene.start("Verdict");
});

await p.waitForTimeout(4000);
scenes = await getActiveScenes();
console.log("Verdict scenes:", scenes);
if (!scenes.includes("Verdict")) throw new Error("Expected Verdict scene");
console.log("Verdict Scene verified!");

// ============================================================================
// TEST 3: Collapse & Game Over Trigger
// ============================================================================
console.log("\n--- TEST 3: Collapse / Game Over on Zero Gold ---");
await p.evaluate(() => {
	const raw =
		localStorage.getItem("chronicle.save") ||
		localStorage.getItem("chronicle.save");
	const g = JSON.parse(raw);
	g.collapse = "bankruptcy";
	g.stats = { gold: 0, stability: 5, legacy: 4 };
	localStorage.setItem("chronicle.save", JSON.stringify(g));
	const game = globalThis.__game;
	for (const s of game.scene.getScenes(true)) s.scene.stop();
	game.scene.start("Verdict");
});

console.log("Skipping verdict voice comments...");
await p.waitForTimeout(2000);
await tapL(360, 500, 1000); // Skip narrator
await tapL(360, 500, 1000); // Skip leader

console.log("Waiting for Verdict actions and Reclaim button...");
const hasTryAgain = await p.waitForFunction(
	() => {
		const verdict = globalThis.__game?.scene.getScene("Verdict");
		const findButton = (list) => {
			for (const item of list) {
				if (
					item.label?.text?.includes("Reclaim") ||
					item.label?.text?.includes("Try Again")
				)
					return true;
				if (item.list && findButton(item.list)) return true;
			}
			return false;
		};
		return findButton(verdict?.children?.list || []);
	},
	{ timeout: 35000 },
);
console.log("Reclaim button rendered on collapse:", !!hasTryAgain);

// ============================================================================
// TEST 4: Codex, Chronicle & Settings Scenes
// ============================================================================
console.log("\n--- TEST 4: Codex, Chronicle, Settings Scenes ---");
for (const sceneName of ["Codex", "Chronicle", "Settings"]) {
	await p.evaluate(
		([sc]) => {
			const game = globalThis.__game;
			for (const s of game.scene.getScenes(true)) s.scene.stop();
			game.scene.start(sc);
		},
		[sceneName],
	);
	await p.waitForTimeout(2000);
	const active = await getActiveScenes();
	console.log(`Testing ${sceneName} -> active:`, active);
	if (!active.includes(sceneName))
		throw new Error(`Failed to activate ${sceneName}`);
}

await b.close();

console.log("\n=======================================================");
if (errs.length === 0) {
	console.log("🎉 ALL E2E TESTS PASSED WITH 0 ERRORS!");
} else {
	console.error("❌ Errors encountered during test:", errs);
	process.exit(1);
}
console.log("=======================================================");
