import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:5173/";

const VIEWPORT_MATRIX = [
	{ name: "iPhone 14 (390x844)", width: 390, height: 844, type: "mobile-tall" },
	{
		name: "Galaxy S20 (360x800)",
		width: 360,
		height: 800,
		type: "mobile-tall",
	},
	{ name: "iPhone SE (375x667)", width: 375, height: 667, type: "mobile-16-9" },
	{ name: "iPad Mini (768x1024)", width: 768, height: 1024, type: "tablet" },
	{ name: "Desktop (1280x800)", width: 1280, height: 800, type: "desktop" },
	{
		name: "Mobile Landscape (844x390)",
		width: 844,
		height: 390,
		type: "landscape",
	},
];

console.log("=== CHRONICLE RESPONSIVE REGRESSION TEST SUITE ===");
const browser = await chromium.launch();

let passed = 0;
let total = 0;

function check(desc, cond) {
	total++;
	if (!cond) {
		console.error(`  FAIL: ${desc}`);
		throw new Error(`Assertion failed: ${desc}`);
	}
	console.log(`  PASS: ${desc}`);
	passed++;
}

for (const vp of VIEWPORT_MATRIX) {
	console.log(`\nTesting viewport: ${vp.name} [${vp.type}]`);
	const page = await browser.newPage({
		viewport: { width: vp.width, height: vp.height },
		isMobile: vp.type.startsWith("mobile"),
		hasTouch: vp.type.startsWith("mobile") || vp.type === "tablet",
	});

	await page.goto(url);
	await page.waitForTimeout(1000);

	const metrics = await page.evaluate(() => {
		const canvas = document.querySelector("canvas");
		const guard = document.querySelector("#orientation-guard");
		if (!canvas) return null;
		const r = canvas.getBoundingClientRect();
		const guardVisible =
			guard && window.getComputedStyle(guard).display !== "none";
		return {
			canvasW: r.width,
			canvasH: r.height,
			topGap: Math.round(r.top),
			bottomGap: Math.round(window.innerHeight - r.bottom),
			leftGap: Math.round(r.left),
			rightGap: Math.round(window.innerWidth - r.right),
			usedScreenPct: Math.round(
				((r.width * r.height) / (window.innerWidth * window.innerHeight)) * 100,
			),
			guardVisible: Boolean(guardVisible),
			gameH: globalThis.__game?.scale?.height,
			gameW: globalThis.__game?.scale?.width,
		};
	});

	check("Canvas exists and is initialized", metrics !== null);

	if (vp.type === "mobile-tall" || vp.type === "mobile-16-9") {
		check("Zero top letterbox gap on mobile", metrics.topGap === 0);
		check("Zero bottom letterbox gap on mobile", metrics.bottomGap === 0);
		check("Zero left gap on mobile", metrics.leftGap === 0);
		check("Zero right gap on mobile", metrics.rightGap === 0);
		check("100% screen utilization on mobile", metrics.usedScreenPct === 100);
		check(
			"Orientation guard hidden in portrait",
			metrics.guardVisible === false,
		);
	} else if (vp.type === "tablet" || vp.type === "desktop") {
		check("Pillarboxed canvas has 0 top gap", metrics.topGap === 0);
		check("Pillarboxed canvas has 0 bottom gap", metrics.bottomGap === 0);
		check(
			"Canvas is perfectly symmetrically centered horizontally",
			Math.abs(metrics.leftGap - metrics.rightGap) <= 1,
		);
		check(
			"Orientation guard hidden on large screen",
			metrics.guardVisible === false,
		);
	} else if (vp.type === "landscape") {
		check(
			"Orientation guard active in mobile landscape",
			metrics.guardVisible === true,
		);
	}

	await page.close();
}

console.log(`\n${passed}/${total} assertions passed successfully.`);
await browser.close();
