/** Design tokens. Logical base resolution is portrait 720×1280. Dynamic H expands on modern mobile screens. */
export const W = 720;
export const BASE_H = 1280;

/** Landscape split-screen: 1440×810 logical — left 720 column holds the
 * council UI, right 720 column holds the court visuals (portraits, backdrop). */
export const LANDSCAPE_W = 1440;
export const LANDSCAPE_H = 810;

/** Hidden probe reading env(safe-area-inset-*) — real values only appear
 * in fullscreen/PWA contexts (viewport-fit=cover is set in index.html). */
let safeProbe: HTMLElement | null = null;
function probeSafeAreaInsets(): { top: number; bottom: number } {
	try {
		if (!safeProbe && typeof document !== "undefined") {
			safeProbe = document.createElement("div");
			safeProbe.style.cssText =
				"position:fixed;top:0;left:0;width:0;height:0;pointer-events:none;" +
				"visibility:hidden;overflow:hidden;" +
				"padding-top:env(safe-area-inset-top,0px);" +
				"padding-bottom:env(safe-area-inset-bottom,0px);";
			document.body.appendChild(safeProbe);
		}
		if (!safeProbe) return { top: 0, bottom: 0 };
		const cs = getComputedStyle(safeProbe);
		return {
			top: parseFloat(cs.paddingTop) || 0,
			bottom: parseFloat(cs.paddingBottom) || 0,
		};
	} catch {
		return { top: 0, bottom: 0 };
	}
}

/** Computes dynamic dimensions and safe area insets based on device viewport. */
export function computeViewportMetrics() {
	if (typeof window === "undefined") {
		return {
			width: W,
			height: BASE_H,
			canvasW: W,
			landscape: false,
			safeTop: 48,
			safeBottom: 40,
		};
	}
	const winW = window.innerWidth;
	const winH = window.innerHeight;
	const aspect = winH / winW;

	// Clearly-wide viewports (landscape tablets, desktops) get a wide canvas
	// whose width matches the window aspect exactly: the 720-wide game column
	// stays centered and the backdrop art fills the side margins. Squarish
	// windows (aspect ≥ ~1.15) keep the portrait column, and small phones in
	// landscape are still blocked by the CSS orientation guard (<580px tall).
	const landscape = aspect < 1.15;

	// In portrait orientation where aspect is taller than 16:9 (1.777)
	// adapt height up to 22:9 (~2.44) to completely fill modern mobile screens (19.5:9, 20:9).
	let targetH = BASE_H;
	if (!landscape && aspect >= 16 / 9) {
		targetH = Math.round(W * Math.min(22 / 9, aspect));
	}
	let canvasW = W;
	if (landscape) {
		targetH = LANDSCAPE_H;
		// Fill the window width exactly; capped so extreme ultrawides don't
		// over-zoom the side art into a blurry smear (they letterbox instead).
		canvasW = Math.min(1920, Math.max(W, Math.round(LANDSCAPE_H / aspect)));
	}

	// Baseline gutters adapt to taller screens; on notched devices the real
	// env() insets (converted CSS px → game px via the FIT scale) win.
	const isTall = targetH > 1360;
	const fitScale = Math.min(winW / canvasW, winH / targetH) || 1;
	const insets = probeSafeAreaInsets();
	const safeTop = Math.max(
		isTall ? 64 : 48,
		Math.ceil(insets.top / fitScale) + 12,
	);
	const safeBottom = Math.max(
		isTall ? 56 : 40,
		Math.ceil(insets.bottom / fitScale) + 12,
	);

	return {
		width: W,
		height: targetH,
		canvasW,
		landscape,
		safeTop,
		safeBottom,
	};
}

const initialMetrics = computeViewportMetrics();
export let H = initialMetrics.height;
export let SAFE_TOP = initialMetrics.safeTop;
export let SAFE_BOTTOM = initialMetrics.safeBottom;
export let TOP_BAR_Y = SAFE_TOP + 12;

/** Landscape canvas width (720 portrait, window-aspect-matched wide). */
export let CANVAS_W = initialMetrics.canvasW;
/** Whether the wide-canvas landscape layout is active. */
export let LANDSCAPE = initialMetrics.landscape;
/** X center of the whole canvas — centered content anchors here. */
export let CX = CANVAS_W / 2;
/** X origin of the centered 720-wide content column. */
export let COL_X = CX - W / 2;
/** X center of the visual column — the centered game column in every mode. */
export let VIS_CX = CX;

export function updateThemeMetrics(
	newH: number,
	safeTop?: number,
	safeBottom?: number,
	canvasW = W,
	landscape = false,
) {
	H = newH;
	if (safeTop !== undefined) SAFE_TOP = safeTop;
	if (safeBottom !== undefined) SAFE_BOTTOM = safeBottom;
	TOP_BAR_Y = SAFE_TOP + 12;
	CANVAS_W = canvasW;
	LANDSCAPE = landscape;
	CX = CANVAS_W / 2;
	COL_X = CX - W / 2;
	VIS_CX = CX;
}

export const SAFE_INSET_LEFT = 24;
export const SAFE_INSET_RIGHT = 24;

export const COLORS = {
	night: 0x0b0a10,
	ink: 0x14111c,
	parchment: 0xefe3c6,
	parchmentDark: 0xd9c79a,
	gold: 0xe0b64a,
	goldDeep: 0x9a7420,
	blood: 0xa8322d,
	sage: 0x6f9a7a,
	sky: 0x6fa3c9,
	text: 0xf5ecd7,
	muted: 0xb9ad91,
};

export const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;

export const FONT = {
	title: "Cinzel, 'Times New Roman', serif",
	body: "'Cormorant Garamond', Georgia, serif",
	ui: "Inter, system-ui, sans-serif",
};

export const STAT_META = {
	gold: { label: "Gold", color: COLORS.gold, icon: "◆" },
	stability: { label: "Stability", color: COLORS.sage, icon: "⚖" },
	legacy: { label: "Legacy", color: COLORS.sky, icon: "✦" },
} as const;

export const ROLE_META = {
	war: { label: "War", color: 0xa8322d },
	gold: { label: "Treasury", color: 0xe0b64a },
	faith: { label: "Faith", color: 0x8b7bd1 },
} as const;

export const title = (
	size: number,
	color = hex(COLORS.text),
): Phaser.Types.GameObjects.Text.TextStyle => ({
	fontFamily: FONT.title,
	fontSize: `${size}px`,
	color,
	fontStyle: "700",
	align: "center",
});

export const body = (
	size: number,
	color = hex(COLORS.text),
): Phaser.Types.GameObjects.Text.TextStyle => ({
	fontFamily: FONT.body,
	fontSize: `${size}px`,
	color,
	align: "center",
	wordWrap: { width: W - 96 },
	lineSpacing: 4,
});

export const ui = (
	size: number,
	color = hex(COLORS.text),
): Phaser.Types.GameObjects.Text.TextStyle => ({
	fontFamily: FONT.ui,
	fontSize: `${size}px`,
	color,
	align: "center",
});
