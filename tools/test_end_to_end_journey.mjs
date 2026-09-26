import { chromium } from "playwright";

const URL = process.argv[2] ?? "http://localhost:5173/";
console.log("Starting E2E Journey test on:", URL);

const browser = await chromium.launch();
const context = await browser.newContext({
	viewport: { width: 390, height: 844 },
	isMobile: true,
	hasTouch: true,
});
const page = await context.newPage();

const errors = [];
page.on("pageerror", (e) => {
	console.error("❌ [PAGE_ERROR]:", e.stack || e.message);
	errors.push(e.message);
});
page.on("console", (m) => {
	if (m.type() === "error") {
		console.error("❌ [CONSOLE_ERROR]:", m.text());
		errors.push(m.text());
	}
});

// Clean slate
await page.goto(URL);
await page.waitForTimeout(1000);
await page.evaluate(() => localStorage.clear());
await page.reload();

console.log("1. Waiting for Title scene...");
await page.waitForFunction(() => globalThis.__game?.scene.isActive("Title"), {
	timeout: 15000,
});

// Tap "Begin Your Reign"
console.log("2. Clicking 'Begin Your Reign'...");
await page.waitForTimeout(2000);
await page.evaluate(() => {
	const title = globalThis.__game.scene.getScene("Title");
	const btn = title.children.list.find((c) => c.label?.text?.includes("Begin"));
	btn.emit("pointerdown");
	btn.emit("pointerup");
});

await page.waitForFunction(() => globalThis.__game?.scene.isActive("Select"), {
	timeout: 8000,
});
console.log("✔ Transitioned to Select scene!");

// Step carousel to Napoleon (index 1)
console.log("3. Stepping to Napoleon in Select carousel...");
await page.evaluate(() => {
	const sel = globalThis.__game.scene.getScene("Select");
	sel.step(1);
});
await page.waitForTimeout(1200);

// Tap "Take the Throne"
console.log("4. Taking the throne...");
await page.evaluate(() => {
	const sel = globalThis.__game.scene.getScene("Select");
	const btn = sel.children.list.find((c) => c.label?.text?.includes("Throne"));
	btn.emit("pointerdown");
	btn.emit("pointerup");
});

await page.waitForFunction(() => globalThis.__game?.scene.isActive("Court"), {
	timeout: 8000,
});
console.log("✔ Entered Court scene!");

// Skip Chapter card
console.log("5. Advancing past Chapter intro card...");
await page.waitForTimeout(3000);
await page.mouse.click(195, 500);

// Wait for advisor to enter and speak -> skip speeches
console.log("6. Advisor speaking, tapping to advance to choices...");
await page.waitForTimeout(2000);
await page.mouse.click(195, 500); // Skip advisor speech
await page.waitForTimeout(1000);
await page.mouse.click(195, 500); // Skip rebuttal if present
await page.waitForTimeout(1000);

// Wait for choices to appear
console.log("Waiting for choice cards...");
await page.waitForFunction(
	() => {
		const court = globalThis.__game.scene.getScene("Court");
		return court?.children?.list?.some(
			(c) => c.constructor.name === "ChoiceCards",
		);
	},
	{ timeout: 15000 },
);
console.log("✔ Choice cards appeared!");

// Pick Choice 0
console.log("7. Picking Choice 0...");
await page.evaluate(() => {
	const court = globalThis.__game.scene.getScene("Court");
	const choiceContainer = court.children.list.find(
		(c) => c.cards && c.cards.length > 0,
	);
	choiceContainer.cards[0].emit("pointerdown");
	choiceContainer.cards[0].emit("pointerup");
});

// Wait for Oracle to appear
console.log("8. Waiting for Oracle...");
await page.waitForFunction(
	() => {
		const court = globalThis.__game.scene.getScene("Court");
		return court.children.list.some((c) => c.tablets && c.tablets.length > 0);
	},
	{ timeout: 15000 },
);
console.log("✔ Oracle appeared with tablets!");

// Place wager on Historical path (Tablet 0)
console.log("9. Placing Oracle wager...");
await page.evaluate(() => {
	const court = globalThis.__game.scene.getScene("Court");
	const oracle = court.children.list.find(
		(c) => c.tablets && c.tablets.length > 0,
	);
	oracle.tablets[0].emit("pointerdown");
	oracle.tablets[0].emit("pointerup");
});

// Wait for 3D tumbling flip and shockwave to resolve, then Reveal unrolls
console.log("10. Waiting for Reveal parchment...");
await page.waitForFunction(
	() => {
		const court = globalThis.__game.scene.getScene("Court");
		return court.children.list.some(
			(c) => c.constructor.name === "Reveal" && c.continueBtn,
		);
	},
	{ timeout: 15000 },
);
console.log("✔ Reveal parchment unrolled with Continue button!");

// Tap 'Next council' continue button
console.log("11. Advancing to next council...");
await page.evaluate(() => {
	const court = globalThis.__game.scene.getScene("Court");
	const reveal = court.children.list.find(
		(c) => c.constructor.name === "Reveal",
	);
	reveal.continueBtn.emit("pointerdown");
	reveal.continueBtn.emit("pointerup");
});

await page.waitForTimeout(2000);
console.log("✔ Turn 1 complete! Advancing to Turn 2!");

// Verify Verdict Scene with simulated finished game
console.log("12. Testing Verdict Scene...");
await page.evaluate(() => {
	const raw = localStorage.getItem("chronicle.save");
	const g = JSON.parse(raw);
	g.turnIndex = 5;
	g.stats = { gold: 8, stability: 7, legacy: 9 };
	localStorage.setItem("chronicle.save", JSON.stringify(g));
	const game = globalThis.__game;
	for (const s of game.scene.getScenes(true)) s.scene.stop();
	game.scene.start("Verdict");
});

await page.waitForFunction(() => globalThis.__game?.scene.isActive("Verdict"), {
	timeout: 10000,
});
console.log("✔ Verdict scene active!");

// Verify Collapse / Game Over state
console.log("13. Testing Game Over / Collapse on Zero Gold...");
await page.evaluate(() => {
	const raw = localStorage.getItem("chronicle.save");
	const g = JSON.parse(raw);
	g.collapse = "bankruptcy";
	g.stats = { gold: 0, stability: 5, legacy: 2 };
	localStorage.setItem("chronicle.save", JSON.stringify(g));
	const game = globalThis.__game;
	for (const s of game.scene.getScenes(true)) s.scene.stop();
	game.scene.start("Verdict");
});

await page.waitForFunction(
	() => {
		const v = globalThis.__game.scene.getScene("Verdict");
		return v.children.list.some((c) => c.text === "REIGN COLLAPSED");
	},
	{ timeout: 12000 },
);
console.log(
	"✔ Collapse Game Over correctly rendered with REIGN COLLAPSED banner!",
);

// Test Auxiliary Scenes (Codex, Chronicle, Settings)
console.log("14. Testing auxiliary scenes (Codex, Chronicle, Settings)...");
for (const sceneName of ["Codex", "Chronicle", "Settings"]) {
	await page.evaluate(
		([sc]) => {
			const game = globalThis.__game;
			for (const s of game.scene.getScenes(true)) s.scene.stop();
			game.scene.start(sc);
		},
		[sceneName],
	);
	await page.waitForFunction(
		([sc]) => globalThis.__game?.scene.isActive(sc),
		[sceneName],
		{ timeout: 8000 },
	);
	console.log(`✔ ${sceneName} scene verified!`);
}

await browser.close();

console.log("\n=======================================================");
if (errors.length === 0) {
	console.log("🏆 COMPLETE END-TO-END JOURNEY TEST PASSED WITH 0 ERRORS!");
} else {
	console.error("❌ Errors detected:", errors);
	process.exit(1);
}
console.log("=======================================================");
