import Phaser from "phaser";
import { audio } from "../core/audio.ts";
import { settings } from "../core/state.ts";
import {
	CANVAS_W,
	COLORS,
	CX,
	FONT,
	H,
	hex,
	LANDSCAPE,
	SAFE_BOTTOM,
	SAFE_TOP,
	title,
	VIS_CX,
	W,
} from "./theme.ts";

export const motion = () => (settings.reducedMotion ? 0.35 : 1);

/** Ornate gold-rimmed button with press feedback and heraldic corner pips. */
export class Button extends Phaser.GameObjects.Container {
	private bg: Phaser.GameObjects.Graphics;
	private label: Phaser.GameObjects.Text;
	private iconText?: Phaser.GameObjects.Text;
	readonly w: number;
	readonly h: number;
	readonly radius: number;
	private enabledState = true;
	private currentIcon?: string;

	constructor(
		scene: Phaser.Scene,
		x: number,
		y: number,
		text: string,
		onTap: () => void,
		opts: {
			w?: number;
			h?: number;
			primary?: boolean;
			size?: number;
			color?: number;
			icon?: string;
			radius?: number;
			letterSpacing?: number;
		} = {},
	) {
		super(scene, x, y);
		this.w = opts.w ?? 420;
		this.h = opts.h ?? 84;
		this.radius =
			opts.radius ?? Math.min(18, Math.max(10, Math.round(this.h * 0.22)));
		const primary = opts.primary ?? true;

		// Extract leading icon if present (e.g. "✦ Summon Another Leader" or "🎙 Say the name")
		let iconStr = opts.icon;
		let labelStr = text;
		if (!iconStr) {
			const m = text.match(/^([✦🎙‹›◆⚖⚔★◎●])\s+(.+)$/u);
			if (m) {
				iconStr = m[1];
				labelStr = m[2];
			}
		}
		this.currentIcon = iconStr;

		this.bg = scene.add.graphics();
		this.drawBg(primary, opts.color);

		const fontSize = opts.size ?? (primary ? 26 : 24);
		const fontColor = primary ? hex(0x181005) : hex(COLORS.text);

		this.label = scene.add
			.text(0, 0, labelStr, {
				fontFamily: FONT.title,
				fontSize: `${fontSize}px`,
				color: fontColor,
				fontStyle: "700",
				align: "center",
			})
			.setOrigin(0.5);

		if (primary) {
			this.label.setShadow(0, 1, "rgba(255, 245, 205, 0.55)", 0, false, true);
		} else {
			this.label.setShadow(0, 2, "rgba(0, 0, 0, 0.95)", 5, false, true);
		}

		if (opts.letterSpacing) {
			this.label.setLetterSpacing(opts.letterSpacing);
		} else {
			this.label.setLetterSpacing(2);
		}

		if (iconStr) {
			this.iconText = scene.add
				.text(0, 0, iconStr, {
					fontFamily: FONT.title,
					fontSize: `${Math.round(fontSize * 1.05)}px`,
					color: primary ? hex(0x181005) : hex(COLORS.gold),
					fontStyle: "700",
					align: "center",
				})
				.setOrigin(0.5);
			if (!primary) {
				this.iconText.setShadow(0, 0, hex(COLORS.gold), 6, false, true);
			}
			this.add([this.bg, this.iconText, this.label]);
		} else {
			this.add([this.bg, this.label]);
		}

		this.layoutContent();

		this.setSize(this.w, this.h);
		this.setInteractive({ useHandCursor: true });
		this.on("pointerover", () => {
			if (!this.enabledState) return;
			scene.tweens.add({
				targets: this,
				scale: 1.018,
				duration: 120,
				ease: "Sine.out",
			});
		});
		this.on("pointerdown", () => {
			if (!this.enabledState) return;
			this.label.setY(1.5);
			if (this.iconText) this.iconText.setY(1.5);
			scene.tweens.add({
				targets: this,
				scale: 0.95,
				duration: 70,
				ease: "Quad.out",
			});
		});
		this.on("pointerup", () => {
			if (!this.enabledState) return;
			this.label.setY(0);
			if (this.iconText) this.iconText.setY(0);
			audio.sfx("tap");
			scene.tweens.add({
				targets: this,
				scale: 1,
				duration: 160,
				ease: "Back.out(1.5)",
			});
			onTap();
		});
		this.on("pointerout", () => {
			this.label.setY(0);
			if (this.iconText) this.iconText.setY(0);
			scene.tweens.add({
				targets: this,
				scale: 1,
				duration: 140,
				ease: "Sine.out",
			});
		});
		scene.add.existing(this);
	}

	private layoutContent() {
		if (this.iconText && this.currentIcon) {
			const gap = 12;
			const totalW = this.iconText.width + gap + this.label.width;
			this.iconText.setPosition(-totalW / 2 + this.iconText.width / 2, 0);
			this.label.setPosition(
				-totalW / 2 + this.iconText.width + gap + this.label.width / 2,
				0,
			);
		} else {
			this.label.setPosition(0, 0);
		}
	}

	private drawBg(primary: boolean, color?: number) {
		const g = this.bg;
		g.clear();
		const r = this.radius;
		const w = this.w;
		const h = this.h;
		const inset = 3.5;

		if (primary) {
			// Ambient shadow underneath
			g.fillStyle(0x000000, 0.45);
			g.fillRoundedRect(-w / 2, -h / 2 + 4, w, h, r);
			g.fillStyle(0x000000, 0.2);
			g.fillRoundedRect(-w / 2 + 2, -h / 2 + 7, w - 4, h, r);

			// Base plate: rich warm imperial gold
			const baseCol = color ?? COLORS.gold;
			g.fillStyle(baseCol, 1);
			g.fillRoundedRect(-w / 2, -h / 2, w, h, r);

			// Specular metallic sheen overlay on upper half
			g.fillStyle(0xffffff, 0.16);
			g.fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h / 2 - 4, {
				tl: Math.max(2, r - 3),
				tr: Math.max(2, r - 3),
				bl: 3,
				br: 3,
			});
			g.fillStyle(0xffffff, 0.08);
			g.fillRoundedRect(-w / 2 + 5, -h / 2 + 4, w - 10, 4, Math.max(1, r - 5));

			// Outer bezel border: burnished antique bronze-gold
			g.lineStyle(2, 0x7c540e, 0.95);
			g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);

			// Inner delicate hairline (liseré orfévré d'or pâle)
			g.lineStyle(1, 0xfff4c6, 0.65);
			g.strokeRoundedRect(
				-w / 2 + inset,
				-h / 2 + inset,
				w - inset * 2,
				h - inset * 2,
				Math.max(2, r - 3),
			);

			// Specular highlight line along top inner rim
			g.lineStyle(1.5, 0xfffae8, 0.85);
			g.lineBetween(
				-w / 2 + r + 2,
				-h / 2 + inset + 0.5,
				w / 2 - r - 2,
				-h / 2 + inset + 0.5,
			);

			// Shading line along bottom inner rim
			g.lineStyle(1.5, 0x8a6214, 0.8);
			g.lineBetween(
				-w / 2 + r + 2,
				h / 2 - inset - 0.5,
				w / 2 - r - 2,
				h / 2 - inset - 0.5,
			);

			// 4 precision corner diamond pips
			const pipDistX = w / 2 - Math.max(9, r - 2);
			const pipDistY = h / 2 - Math.max(9, r - 2);
			for (const sx of [-1, 1]) {
				for (const sy of [-1, 1]) {
					const px = sx * pipDistX;
					const py = sy * pipDistY;
					// 4-point diamond facet
					g.fillStyle(0x7c540e, 0.9);
					g.beginPath();
					g.moveTo(px, py - 3.5);
					g.lineTo(px + 3, py);
					g.lineTo(px, py + 3.5);
					g.lineTo(px - 3, py);
					g.closePath();
					g.fillPath();
					// Center specular spark
					g.fillStyle(0xfff8d8, 1);
					g.fillCircle(px, py, 1);
				}
			}
		} else {
			// Ambient shadow underneath
			g.fillStyle(0x000000, 0.38);
			g.fillRoundedRect(-w / 2, -h / 2 + 3.5, w, h, r);

			// Deep royal midnight velvet plate
			g.fillStyle(0x120f1b, 0.96);
			g.fillRoundedRect(-w / 2, -h / 2, w, h, r);

			// Soft velvet inner tone
			g.fillStyle(0x1a1626, 0.4);
			g.fillRoundedRect(
				-w / 2 + 3,
				-h / 2 + 3,
				w - 6,
				h - 6,
				Math.max(2, r - 3),
			);

			// Outer regal gold border
			g.lineStyle(1.5, color ?? COLORS.gold, 0.88);
			g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);

			// Inner delicate hairline
			g.lineStyle(1, 0xd4af37, 0.28);
			g.strokeRoundedRect(
				-w / 2 + inset,
				-h / 2 + inset,
				w - inset * 2,
				h - inset * 2,
				Math.max(2, r - 3),
			);

			// Specular highlight line along top inner rim
			g.lineStyle(1, 0xfff0b8, 0.4);
			g.lineBetween(
				-w / 2 + r + 2,
				-h / 2 + inset + 0.5,
				w / 2 - r - 2,
				-h / 2 + inset + 0.5,
			);

			// Shading line along bottom inner rim
			g.lineStyle(1, 0x05040a, 0.6);
			g.lineBetween(
				-w / 2 + r + 2,
				h / 2 - inset - 0.5,
				w / 2 - r - 2,
				h / 2 - inset - 0.5,
			);

			// 4 corner diamond pips
			const pipDistX = w / 2 - Math.max(9, r - 2);
			const pipDistY = h / 2 - Math.max(9, r - 2);
			for (const sx of [-1, 1]) {
				for (const sy of [-1, 1]) {
					const px = sx * pipDistX;
					const py = sy * pipDistY;
					g.fillStyle(color ?? COLORS.goldDeep, 0.7);
					g.beginPath();
					g.moveTo(px, py - 3);
					g.lineTo(px + 2.5, py);
					g.lineTo(px, py + 3);
					g.lineTo(px - 2.5, py);
					g.closePath();
					g.fillPath();
					g.fillStyle(0xffe89e, 0.85);
					g.fillCircle(px, py, 0.8);
				}
			}
		}
	}

	setText(t: string) {
		let iconStr = this.currentIcon;
		let labelStr = t;
		const m = t.match(/^([✦🎙‹›◆⚖⚔★◎●])\s+(.+)$/u);
		if (m) {
			iconStr = m[1];
			labelStr = m[2];
		}
		this.currentIcon = iconStr;
		this.label.setText(labelStr);
		if (this.iconText && iconStr) {
			this.iconText.setText(iconStr);
		}
		this.layoutContent();
		return this;
	}

	setEnabled(v: boolean) {
		this.enabledState = v;
		this.setAlpha(v ? 1 : 0.45);
		return this;
	}
}

/** Small circular icon button (settings, back, codex…) with rich gold bezel & velvet medallion interior. */
export function iconButton(
	scene: Phaser.Scene,
	x: number,
	y: number,
	glyph: string,
	onTap: () => void,
	size = 64,
) {
	const c = scene.add.container(x, y);
	const g = scene.add.graphics();
	const r = size / 2;

	// Ambient drop shadow
	g.fillStyle(0x000000, 0.42);
	g.fillCircle(0, 3, r);

	// Outer burnished gold bezel ring
	g.fillStyle(0x825b12, 1);
	g.fillCircle(0, 0, r);
	g.fillStyle(COLORS.gold, 1);
	g.fillCircle(0, 0, r - 1.5);
	g.fillStyle(0x6b490e, 1);
	g.fillCircle(0, 0, r - 3);

	// Midnight velvet medallion interior
	g.fillStyle(0x120f1c, 0.96);
	g.fillCircle(0, 0, r - 4);

	// Inner delicate gold filigree ring
	g.lineStyle(1, COLORS.gold, 0.45);
	g.strokeCircle(0, 0, r - 7);

	// Top specular highlight arc along the outer rim
	g.lineStyle(1.5, 0xfffae8, 0.75);
	g.beginPath();
	g.arc(0, 0, r - 1.5, -Math.PI * 0.75, -Math.PI * 0.25);
	g.strokePath();

	// 4 cardinal heraldic diamond studs
	const studR = r - 7;
	for (const angle of [0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2]) {
		const sx = Math.cos(angle) * studR;
		const sy = Math.sin(angle) * studR;
		g.fillStyle(COLORS.goldDeep, 0.9);
		g.fillCircle(sx, sy, 1.8);
		g.fillStyle(0xfffae8, 1);
		g.fillCircle(sx, sy, 0.9);
	}

	const fontSize = Math.round(size * 0.42);
	const t = scene.add
		.text(0, 0, glyph, {
			fontFamily: glyph === "‹" || glyph === "›" ? FONT.title : FONT.ui,
			fontSize: `${fontSize}px`,
			color: hex(COLORS.gold),
			fontStyle: "700",
			align: "center",
		})
		.setOrigin(0.5);
	t.setShadow(0, 1, "#000000", 6, false, true);

	c.add([g, t]);
	// ≥88 canvas px keeps the hit zone near 44pt even at phone fit-scale (~0.55)
	const hitSize = Math.max(size + 24, 88);
	c.setSize(hitSize, hitSize).setInteractive({ useHandCursor: true });
	c.on("pointerover", () => {
		scene.tweens.add({
			targets: c,
			scale: 1.08,
			duration: 140,
			ease: "Sine.out",
		});
	});
	c.on("pointerdown", () => {
		t.setY(1);
		scene.tweens.add({
			targets: c,
			scale: 0.92,
			duration: 70,
			ease: "Quad.out",
		});
	});
	c.on("pointerup", () => {
		t.setY(0);
		audio.sfx("tap");
		scene.tweens.add({
			targets: c,
			scale: 1,
			duration: 200,
			ease: "Back.out(2)",
		});
		onTap();
	});
	c.on("pointerout", () => {
		t.setY(0);
		scene.tweens.add({
			targets: c,
			scale: 1,
			duration: 140,
			ease: "Sine.out",
		});
	});
	return c;
}

/** Full-screen dark overlay with vignette, used behind panels. */
export function dim(scene: Phaser.Scene, alpha = 0.7) {
	const r = scene.add
		.rectangle(CX, H / 2, CANVAS_W, H, COLORS.night, alpha)
		.setInteractive();
	return r;
}

/** Parchment panel (illuminated vellum scroll with double orfèvrerie border). */
export function parchment(
	scene: Phaser.Scene,
	x: number,
	y: number,
	w: number,
	h: number,
) {
	const g = scene.add.graphics();
	// Ambient shadow
	g.fillStyle(0x000000, 0.35);
	g.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 6, w, h, 16);

	// Aged parchment edge / rim
	g.fillStyle(COLORS.parchmentDark, 1);
	g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 14);

	// Main vellum body
	g.fillStyle(COLORS.parchment, 1);
	g.fillRoundedRect(x - w / 2 + 3, y - h / 2 + 3, w - 6, h - 6, 12);

	// Double orfèvrerie inner border
	g.lineStyle(2, COLORS.goldDeep, 0.85);
	g.strokeRoundedRect(x - w / 2 + 10, y - h / 2 + 10, w - 20, h - 20, 8);
	g.lineStyle(1, 0x805d15, 0.4);
	g.strokeRoundedRect(x - w / 2 + 14, y - h / 2 + 14, w - 28, h - 28, 6);

	// Four corner heraldic diamond fleurons
	for (const sx of [-1, 1]) {
		for (const sy of [-1, 1]) {
			const px = x + sx * (w / 2 - 10);
			const py = y + sy * (h / 2 - 10);
			g.fillStyle(COLORS.goldDeep, 0.9);
			g.beginPath();
			g.moveTo(px, py - 3.5);
			g.lineTo(px + 3, py);
			g.lineTo(px, py + 3.5);
			g.lineTo(px - 3, py);
			g.closePath();
			g.fillPath();
		}
	}
	return g;
}

/** Ornate heading with letter-spacing and flanking imperial fleurons/diamonds. */
export function heading(
	scene: Phaser.Scene,
	y: number,
	text: string,
	size = 40,
) {
	const c = scene.add.container(CX, y);
	const t = scene.add
		.text(0, 0, text.toUpperCase(), title(size, hex(COLORS.gold)))
		.setOrigin(0.5);
	t.setLetterSpacing(6);
	t.setShadow(0, 3, "#000000", 10, false, true);

	const g = scene.add.graphics();
	const tw = t.width;
	const pad = 24;
	const availW = Math.max(0, W / 2 - tw / 2 - pad - 100);
	const ruleLen = Math.min(84, availW);

	if (ruleLen >= 20) {
		for (const sx of [-1, 1]) {
			const innerX = sx * (tw / 2 + pad);
			// Central fleuron diamond
			g.fillStyle(COLORS.gold, 0.95);
			g.beginPath();
			g.moveTo(innerX, -5);
			g.lineTo(innerX + 3.5, 0);
			g.lineTo(innerX, 5);
			g.lineTo(innerX - 3.5, 0);
			g.closePath();
			g.fillPath();
			g.fillStyle(0xfffae8, 1);
			g.fillCircle(innerX, 0, 1.2);

			// Flanking imperial rule line
			const rStart = innerX + sx * 12;
			const rEnd = innerX + sx * (12 + ruleLen);
			// Shadow line
			g.lineStyle(1, 0x000000, 0.6);
			g.lineBetween(rStart, 1.5, rEnd, 1.5);
			// Gold rule line
			g.lineStyle(1.5, COLORS.gold, 0.85);
			g.lineBetween(rStart, 0, rEnd, 0);

			// Mid-rule diamond bead
			const midX = (rStart + rEnd) / 2;
			g.fillStyle(COLORS.goldDeep, 0.9);
			g.fillCircle(midX, 0, 2);
			g.fillStyle(0xfffae8, 1);
			g.fillCircle(midX, 0, 1);

			// Outer terminal fleuron pip
			g.fillStyle(COLORS.gold, 0.75);
			g.fillCircle(rEnd, 0, 2);
		}
	}

	c.add([g, t]);
	return c;
}

/** Ornate royal council proclamation scroll with speaker cartouche, laurel/diamond heraldic marks, and refined dialogue quotes. */
export class Subtitle extends Phaser.GameObjects.Container {
	private txt: Phaser.GameObjects.Text;
	private who: Phaser.GameObjects.Text;
	private bg: Phaser.GameObjects.Graphics;
	private timer?: Phaser.Time.TimerEvent;
	private full = "";
	private words: string[] = [];
	private shown = 0;
	private contentBottom = 154;

	private containerY = 0;
	private anchorY = 0;

	/** Absolute screen Y below the scroll where content can safely start. */
	get bottomY(): number {
		return this.containerY + this.contentBottom + 26;
	}

	constructor(scene: Phaser.Scene, y: number, x = CX) {
		super(scene, x, y);
		this.containerY = y;
		this.anchorY = y;
		this.bg = scene.add.graphics();
		this.who = scene.add
			.text(0, -82, "", {
				fontFamily: FONT.title,
				fontSize: "20px",
				color: hex(COLORS.gold),
				fontStyle: "700",
				align: "center",
			})
			.setOrigin(0.5);
		this.who.setLetterSpacing(3);
		this.who.setShadow(0, 1, "#000000", 6, false, true);

		this.txt = scene.add.text(-W / 2 + 52, -38, "", {
			fontFamily: FONT.body,
			fontSize: "29px",
			color: hex(COLORS.text),
			fontStyle: "600",
			wordWrap: { width: W - 104 },
			lineSpacing: 4,
			align: "left",
		});
		this.txt.setShadow(0, 2, "#000000", 6, false, true);

		this.add([this.bg, this.who, this.txt]);
		this.setAlpha(0);
		scene.add.existing(this);
	}

	/** Repositioning also moves the dock anchor (VerdictScene re-anchors the
	 * scroll between narrator and leader lines before the next show()). */
	override setY(value?: number): this {
		super.setY(value);
		if (value !== undefined) {
			this.anchorY = value;
			this.containerY = value;
		}
		return this;
	}

	show(name: string, text: string, color: number, durationMs: number) {
		if (!this.scene) return;
		this.timer?.remove();
		this.timer = undefined;

		const speakerName = (name || "HERALD").toUpperCase();
		const bannerColor = color || COLORS.gold;

		// Refined dialogue quotes: wrap with noble curly quotes if not already quoted
		const trimmed = text.trim();
		const isQuoted =
			trimmed.startsWith("“") ||
			trimmed.startsWith('"') ||
			trimmed.startsWith("«");
		const formattedText = isQuoted ? trimmed : `“${trimmed}”`;
		this.full = formattedText;

		// Cartouche label flanked by heraldic laurel/diamond marks
		this.who.setText(`✦  ${speakerName}  ✦`).setColor(hex(bannerColor));

		// Set text temporarily to compute exact wrapped height
		this.txt.setText(formattedText);
		const textH = Math.max(56, this.txt.height);

		const bw = W - 36;
		const topY = -86;
		const bh = Math.max(154, textH + 68);
		this.contentBottom = bh; // bottom edge of the scroll, relative to container y

		// The scroll grows DOWNWARD from the anchor: when a long speech would
		// push its bottom edge past the safe band (leaving no room for the
		// AccusationStamp below), slide the whole container up instead of
		// letting the text slide under the stamp.
		const limit = H - SAFE_BOTTOM - 84;
		const overflow = this.anchorY + topY + bh - limit;
		const dockedY = this.anchorY - Math.max(0, overflow);
		this.containerY = dockedY;
		this.y = dockedY;

		// Render the proclamation scroll
		const g = this.bg;
		g.clear();

		// 1. Ambient drop shadow
		g.fillStyle(0x000000, 0.32);
		g.fillRoundedRect(-bw / 2 + 4, topY + 7, bw, bh, 18);
		g.fillStyle(0x000000, 0.5);
		g.fillRoundedRect(-bw / 2, topY + 3.5, bw, bh, 16);

		// 2. Midnight velvet chamber backing
		g.fillStyle(0x0d0a17, 0.95);
		g.fillRoundedRect(-bw / 2, topY, bw, bh, 16);

		// 3. Inner royal velvet tone
		g.fillStyle(0x161324, 0.55);
		g.fillRoundedRect(-bw / 2 + 5, topY + 5, bw - 10, bh - 10, 12);

		// 4. Antique gold orfevrerie borders
		g.lineStyle(2, bannerColor, 0.85);
		g.strokeRoundedRect(-bw / 2, topY, bw, bh, 16);

		// Specular line along top rim
		g.lineStyle(1.5, 0xfffae0, 0.55);
		g.lineBetween(-bw / 2 + 20, topY + 0.5, bw / 2 - 20, topY + 0.5);

		// Inner hairline liseré
		g.lineStyle(1, COLORS.gold, 0.35);
		g.strokeRoundedRect(-bw / 2 + 6, topY + 6, bw - 12, bh - 12, 11);

		// 5. Four heraldic corner fleurons
		const cx = bw / 2 - 16;
		const cyTop = topY + 16;
		const cyBottom = topY + bh - 16;
		for (const [px, py] of [
			[-cx, cyTop],
			[cx, cyTop],
			[-cx, cyBottom],
			[cx, cyBottom],
		]) {
			// Diamond facet
			g.fillStyle(COLORS.gold, 0.85);
			g.beginPath();
			g.moveTo(px, py - 4);
			g.lineTo(px + 3, py);
			g.lineTo(px, py + 4);
			g.lineTo(px - 3, py);
			g.closePath();
			g.fillPath();

			// Center bead
			g.fillStyle(0xfffae8, 1);
			g.fillCircle(px, py, 1.2);
		}

		// 6. Speaker cartouche plaque atop the scroll
		const cartW = Math.max(200, this.who.width + 48);
		const cartH = 32;
		const cartY = topY - 14;

		// Cartouche shadow
		g.fillStyle(0x000000, 0.45);
		g.fillRoundedRect(-cartW / 2, cartY + 2, cartW, cartH, 8);

		// Cartouche obsidian plate
		g.fillStyle(0x0a0812, 0.98);
		g.fillRoundedRect(-cartW / 2, cartY, cartW, cartH, 8);

		// Cartouche gold border
		g.lineStyle(1.5, bannerColor, 0.9);
		g.strokeRoundedRect(-cartW / 2, cartY, cartW, cartH, 8);

		// Cartouche inner hairline
		g.lineStyle(1, 0xfff0b8, 0.35);
		g.strokeRoundedRect(-cartW / 2 + 2.5, cartY + 2.5, cartW - 5, cartH - 5, 6);

		// Cartouche terminal diamond pips
		for (const sx of [-1, 1]) {
			const pipX = sx * (cartW / 2 - 10);
			const pipY = cartY + cartH / 2;
			g.fillStyle(bannerColor, 0.9);
			g.beginPath();
			g.moveTo(pipX, pipY - 3);
			g.lineTo(pipX + 2.5, pipY);
			g.lineTo(pipX, pipY + 3);
			g.lineTo(pipX - 2.5, pipY);
			g.closePath();
			g.fillPath();
			g.fillStyle(0xfffae8, 1);
			g.fillCircle(pipX, pipY, 0.9);
		}

		// Position speaker name in cartouche
		this.who.setPosition(0, cartY + cartH / 2);

		// Position dialogue text inside banner
		this.txt.setPosition(-bw / 2 + 32, topY + 44);

		if (settings.subtitles) {
			if (this.alpha < 0.1) {
				this.setAlpha(0);
				this.scene.tweens.add({
					targets: this,
					alpha: 1,
					duration: 200,
					ease: "Quad.out",
				});
			} else {
				this.setAlpha(1);
			}
		} else {
			this.setAlpha(0);
		}

		// Typewriter: reveal words over the speech duration
		if (settings.subtitles && !settings.reducedMotion) {
			const words = formattedText.split(" ");
			this.words = words;
			this.shown = 0;
			const per = Math.max(
				28,
				Math.min(110, (durationMs * 0.9) / Math.max(1, words.length)),
			);
			this.txt.setText("");
			this.timer = this.scene.time.addEvent({
				delay: per,
				repeat: words.length - 1,
				callback: () => {
					this.shown++;
					this.txt.setText(words.slice(0, this.shown).join(" "));
				},
			});
		} else {
			this.words = [];
			this.shown = 0;
			this.txt.setText(formattedText);
		}
	}

	/** Re-pace the remaining typewriter words to a now-known speech duration. */
	retime(durationMs: number) {
		if (!this.timer || !this.scene) return;
		const remaining = this.words.length - this.shown;
		if (remaining <= 0) return;
		this.timer.remove();
		const per = Math.max(28, Math.min(110, (durationMs * 0.9) / remaining));
		this.timer = this.scene.time.addEvent({
			delay: per,
			repeat: remaining - 1,
			callback: () => {
				this.shown++;
				this.txt.setText(this.words.slice(0, this.shown).join(" "));
			},
		});
	}

	/** Reveal the whole line at once (speech skipped). */
	finish() {
		this.timer?.remove();
		this.timer = undefined;
		this.txt.setText(this.full);
	}

	hide() {
		if (!this.scene) return;
		this.timer?.remove();
		this.timer = undefined;
		this.scene.tweens.add({
			targets: this,
			alpha: 0,
			duration: 220,
			ease: "Sine.in",
		});
	}
}

/** Toast banner at top of screen with royal decree plaque. */
export function toast(scene: Phaser.Scene, text: string, color = COLORS.gold) {
	// Sit below the reliquary gauge strip (panel bottom = SAFE_TOP + 108)
	// so notifications never cover the Legacy meter mid-court.
	// Landscape: the council column's top strip is packed (gauges, overlay
	// titles) — float notices over the top of the visual column instead,
	// above any CX-anchored overlay banner.
	const c = scene.add
		.container(
			LANDSCAPE ? VIS_CX : CX,
			LANDSCAPE ? SAFE_TOP + 56 : SAFE_TOP + 142,
		)
		.setDepth(1000)
		.setAlpha(0);
	const t = scene.add
		.text(0, 0, text, {
			fontFamily: FONT.title,
			fontSize: "20px",
			color: hex(color),
			fontStyle: "700",
			align: "center",
		})
		.setOrigin(0.5);
	t.setLetterSpacing(2);
	t.setShadow(0, 1, "#000000", 6, false, true);

	const g = scene.add.graphics();
	const pw = Math.min(W - 48, Math.max(260, t.width + 64));
	// Long notices must shrink to fit the plate instead of spilling past it.
	if (t.width > pw - 40) t.setScale((pw - 40) / t.width);
	const ph = 46;
	const pr = 14;

	// Drop shadow
	g.fillStyle(0x000000, 0.45);
	g.fillRoundedRect(-pw / 2, -ph / 2 + 3, pw, ph, pr);

	// Midnight velvet plate
	g.fillStyle(0x100d18, 0.95);
	g.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, pr);

	// Outer gold/color border
	g.lineStyle(1.5, color, 0.85);
	g.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, pr);

	// Inner hairline
	g.lineStyle(1, 0xfff0b8, 0.3);
	g.strokeRoundedRect(
		-pw / 2 + 3,
		-ph / 2 + 3,
		pw - 6,
		ph - 6,
		Math.max(2, pr - 3),
	);

	// Flanking diamond pips
	for (const sx of [-1, 1]) {
		const px = sx * (pw / 2 - 14);
		g.fillStyle(color, 0.9);
		g.beginPath();
		g.moveTo(px, -3);
		g.lineTo(px + 2.5, 0);
		g.lineTo(px, 3);
		g.lineTo(px - 2.5, 0);
		g.closePath();
		g.fillPath();
	}

	c.add([g, t]);

	const m = motion();
	const restY = c.y;
	c.y = restY - 12;
	scene.tweens.chain({
		targets: c,
		tweens: [
			{ alpha: 1, y: restY, duration: 260 * m, ease: "Back.out(1.2)" },
			{
				alpha: 0,
				y: restY - 6,
				duration: 380 * m,
				delay: 1900,
				ease: "Quad.in",
				onComplete: () => c.destroy(),
			},
		],
	});
}

/** Scene transition: iris/curtain fade. */
export function go(scene: Phaser.Scene, key: string, data?: object) {
	const cam = scene.cameras?.main;
	if (!cam) {
		scene.scene.start(key, data);
		return;
	}
	let started = false;
	const start = () => {
		if (started) return;
		started = true;
		scene.scene.start(key, data);
	};
	const dur = Math.max(50, Math.round(280 * motion()));
	cam.fadeOut(dur, 11, 10, 16, (_camera: unknown, progress: number) => {
		if (progress >= 1) start();
	});
	cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, start);
	scene.time.delayedCall(dur + 120, start);
}

export function fadeIn(scene: Phaser.Scene, ms = 500) {
	scene.cameras.main.fadeIn(ms * motion(), 11, 10, 16);
}
