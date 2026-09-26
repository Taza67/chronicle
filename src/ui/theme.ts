/** Design tokens. Logical resolution is portrait 720×1280, scaled to fit the device. */
export const W = 720;
export const H = 1280;

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
