/** Design tokens. Logical base resolution is portrait 720×1280. Dynamic H expands on modern mobile screens. */
export const W = 720;
export const BASE_H = 1280;

/** Computes dynamic dimensions and safe area insets based on device viewport. */
export function computeViewportMetrics() {
	if (typeof window === "undefined") {
		return { width: W, height: BASE_H, safeTop: 48, safeBottom: 40 };
	}
	const winW = window.innerWidth;
	const winH = window.innerHeight;
	const aspect = winH / winW;

	// In portrait orientation where aspect is taller than 16:9 (1.777)
	// adapt height up to 22:9 (~2.44) to completely fill modern mobile screens (19.5:9, 20:9).
	let targetH = BASE_H;
	if (aspect >= 16 / 9) {
		targetH = Math.round(W * Math.min(22 / 9, aspect));
	}

	// Safe areas adapt to taller screens (notches, dynamic islands, home gesture bars)
	const isTall = targetH > 1360;
	const safeTop = isTall ? 64 : 48;
	const safeBottom = isTall ? 56 : 40;

	return {
		width: W,
		height: targetH,
		safeTop,
		safeBottom,
	};
}

const initialMetrics = computeViewportMetrics();
export let H = initialMetrics.height;
export let SAFE_TOP = initialMetrics.safeTop;
export let SAFE_BOTTOM = initialMetrics.safeBottom;
export let TOP_BAR_Y = SAFE_TOP + 12;

export function updateThemeMetrics(
	newH: number,
	safeTop?: number,
	safeBottom?: number,
) {
	H = newH;
	if (safeTop !== undefined) SAFE_TOP = safeTop;
	if (safeBottom !== undefined) SAFE_BOTTOM = safeBottom;
	TOP_BAR_Y = SAFE_TOP + 12;
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
