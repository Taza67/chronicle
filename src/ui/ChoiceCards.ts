import Phaser from "phaser";
import { audio } from "../core/audio.ts";
import { settings } from "../core/state.ts";
import type { Choice } from "../types.ts";
import { COLORS, FONT, H, hex, SAFE_BOTTOM, W } from "./theme.ts";

export interface ChoiceCardsOpts {
	onPick: (index: number) => void;
	onMic?: () => void;
	micAvailable?: boolean;
}

/**
 * Choice cards redesigned as luxurious gilded imperial decree tablets / vellum cards.
 * Features double hairline gold filigree rims, corner floret pips, specular bevel highlights,
 * an ornate Roman numeral cartouche, tactile press feedback, and an antique bronze
 * 'Vox Regis' medallion for speech decree.
 */
export class ChoiceCards extends Phaser.GameObjects.Container {
	public cards: Phaser.GameObjects.Container[] = [];
	private choicesData: Choice[];
	private mic?: Phaser.GameObjects.Container;
	private locked = false;
	readonly top: number;

	constructor(scene: Phaser.Scene, choices: Choice[], opts: ChoiceCardsOpts) {
		super(scene, 0, 0);
		this.choicesData = choices;
		const n = choices.length;
		const ch = 98;
		const gap = 12;
		const hasMic = Boolean(opts.micAvailable && opts.onMic);
		const bottomSpace = Math.max(SAFE_BOTTOM + 44, 110);
		const top = H - bottomSpace - n * (ch + gap) - (hasMic ? 76 : 0);
		this.top = top;

		choices.forEach((c, i) => {
			const y = top + i * (ch + gap) + ch / 2;
			const fanAngle = settings.reducedMotion ? 0 : (i - (n - 1) / 2) * 1.5;
			const card = this.makeDecreeCard(
				scene,
				W / 2,
				y,
				W - 64,
				ch,
				c.label,
				i,
				fanAngle,
				() => {
					if (this.locked) return;
					this.locked = true;
					audio.sfx("card");
					this.pickAnim(i);
					opts.onPick(i);
				},
			);

			card
				.setAlpha(0)
				.setY(y + 140)
				.setAngle(fanAngle * 2);

			scene.tweens.add({
				targets: card,
				y,
				alpha: 1,
				angle: fanAngle,
				duration: settings.reducedMotion ? 150 : 520,
				delay: i * 110,
				ease: "Back.out",
			});

			this.cards.push(card);
			this.add(card);
		});

		if (hasMic) {
			const my = top + n * (ch + gap) + 44;
			this.mic = this.makeVoxRegisMedallion(scene, W / 2, my, () => {
				if (this.locked) return;
				opts.onMic?.();
			});
			this.mic.setAlpha(0).setY(my + 36);
			scene.tweens.add({
				targets: this.mic,
				y: my,
				alpha: 1,
				duration: settings.reducedMotion ? 150 : 460,
				delay: n * 110 + 180,
				ease: "Back.out",
			});
			this.add(this.mic);
		}

		scene.add.existing(this);
		this.setDepth(40);
	}

	private makeDecreeCard(
		scene: Phaser.Scene,
		x: number,
		y: number,
		w: number,
		h: number,
		label: string,
		i: number,
		fanAngle: number,
		onTap: () => void,
	) {
		const c = scene.add.container(x, y);
		const bg = scene.add.graphics();
		const glowGfx = scene.add.graphics();
		const r = 16;

		// 1. Ambient drop shadow (physical vellum weight)
		bg.fillStyle(0x000000, 0.24);
		bg.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, r);
		bg.fillStyle(0x000000, 0.16);
		bg.fillRoundedRect(-w / 2 + 2, -h / 2 + 8, w - 4, h, r + 2);

		// 2. Base vellum parchment plate
		bg.fillStyle(COLORS.parchment, 0.98);
		bg.fillRoundedRect(-w / 2, -h / 2, w, h, r);

		// Upper half subtle parchment illumination
		bg.fillStyle(0xfffdf6, 0.35);
		bg.fillRoundedRect(-w / 2 + 2, -h / 2 + 2, w - 4, h / 2 - 2, {
			tl: r - 2,
			tr: r - 2,
			bl: 0,
			br: 0,
		});
		// Lower half subtle warm parchment curvature shading
		bg.fillStyle(COLORS.parchmentDark, 0.3);
		bg.fillRoundedRect(-w / 2 + 2, 0, w - 4, h / 2 - 2, {
			bl: r - 2,
			br: r - 2,
			tl: 0,
			tr: 0,
		});

		// Faint manuscript ruling lines across parchment body
		bg.lineStyle(1, 0xcaa967, 0.14);
		bg.lineBetween(-w / 2 + 34, -14, w / 2 - 76, -14);
		bg.lineBetween(-w / 2 + 34, 14, w / 2 - 76, 14);

		// 3. Double Gold Hairline Filigree:
		// Under-rim shadow line for raised metal relief
		bg.lineStyle(1, 0x6e4e10, 0.55);
		bg.strokeRoundedRect(-w / 2 - 0.5, -h / 2 - 0.5, w + 1, h + 1, r + 0.5);

		// Outer hairline gold rim
		bg.lineStyle(2, COLORS.gold, 0.95);
		bg.strokeRoundedRect(-w / 2, -h / 2, w, h, r);

		// Inner hairline gold rim (liseré d'or, inset 4.5px)
		const inset1 = 4.5;
		bg.lineStyle(1, 0xfff0b8, 0.65);
		bg.strokeRoundedRect(
			-w / 2 + inset1,
			-h / 2 + inset1,
			w - inset1 * 2,
			h - inset1 * 2,
			Math.max(2, r - 3),
		);

		// Secondary subtle filigree guide (inset 7.5px)
		const inset2 = 7.5;
		bg.lineStyle(0.75, 0xc29b38, 0.25);
		bg.strokeRoundedRect(
			-w / 2 + inset2,
			-h / 2 + inset2,
			w - inset2 * 2,
			h - inset2 * 2,
			Math.max(2, r - 5),
		);

		// 4. Top-edge specular shine (bevel highlight) & bottom-edge burnished shade
		bg.lineStyle(1.5, 0xfffaea, 0.9);
		bg.lineBetween(-w / 2 + r + 2, -h / 2 + 1, w / 2 - r - 2, -h / 2 + 1);

		bg.lineStyle(1.5, 0x7c5812, 0.7);
		bg.lineBetween(-w / 2 + r + 2, h / 2 - 1, w / 2 - r - 2, h / 2 - 1);

		// 5. Corner ornaments & diamond pips (4 corners)
		const pipDistX = w / 2 - 13;
		const pipDistY = h / 2 - 13;
		for (const sx of [-1, 1]) {
			for (const sy of [-1, 1]) {
				const px = sx * pipDistX;
				const py = sy * pipDistY;

				// Diamond floret
				bg.fillStyle(COLORS.goldDeep, 0.95);
				bg.fillPoints(
					[
						{ x: px, y: py - 4 },
						{ x: px + 4, y: py },
						{ x: px, y: py + 4 },
						{ x: px - 4, y: py },
					],
					true,
				);

				// Core gold jewel glint
				bg.fillStyle(0xfffaea, 0.95);
				bg.fillCircle(px, py, 1.2);

				// Delicate corner bracket whiskers
				bg.lineStyle(1, 0xd4af37, 0.5);
				bg.lineBetween(px - sx * 5, py, px, py);
				bg.lineBetween(px, py - sy * 5, px, py);
			}
		}

		// 6. Left Gilded Decree Ribbon / Seal Strip
		const ribX = -w / 2 + 14;
		const ribW = 6;
		const ribH = h - 26;
		bg.fillStyle(0x000000, 0.15);
		bg.fillRoundedRect(ribX + 1, -ribH / 2 + 1, ribW, ribH, 3);
		bg.fillStyle(COLORS.goldDeep, 0.92);
		bg.fillRoundedRect(ribX, -ribH / 2, ribW, ribH, 3);
		bg.lineStyle(1, 0xfff0b8, 0.8);
		bg.strokeRoundedRect(ribX, -ribH / 2, ribW, ribH, 3);
		bg.fillStyle(0xfffaea, 0.95);
		bg.fillCircle(ribX + 3, -ribH / 2 + 5, 1.5);
		bg.fillCircle(ribX + 3, ribH / 2 - 5, 1.5);

		// 7. Roman Numeral Cartouche / Seal (Right Side)
		const cx = w / 2 - 46;
		const cy = 0;
		const cr = 23;

		// Cartouche drop shadow
		bg.fillStyle(0x000000, 0.3);
		bg.fillCircle(cx + 0.5, cy + 2, cr);

		// Cartouche base plate (antique bronze lacquer disc)
		bg.fillStyle(0x1e150c, 0.96);
		bg.fillCircle(cx, cy, cr);

		// Cartouche outer gold rim
		bg.lineStyle(2, COLORS.gold, 0.95);
		bg.strokeCircle(cx, cy, cr);

		// Cartouche inner hairline rim
		bg.lineStyle(1, 0xffe28a, 0.6);
		bg.strokeCircle(cx, cy, cr - 4);

		// Top specular arc on cartouche
		bg.lineStyle(1.2, 0xfffaea, 0.8);
		bg.arc(cx, cy, cr - 1, -Math.PI * 0.75, -Math.PI * 0.25);
		bg.strokePath();

		// 4 cardinal gold pips on cartouche rim
		bg.fillStyle(0xffe28a, 0.9);
		bg.fillCircle(cx + cr - 1, cy, 1.5);
		bg.fillCircle(cx - (cr - 1), cy, 1.5);
		bg.fillCircle(cx, cy - (cr - 1), 1.5);
		bg.fillCircle(cx, cy + (cr - 1), 1.5);

		// Roman numeral text
		const numerals = ["I", "II", "III", "IV", "V", "VI"];
		const num = scene.add
			.text(cx, 0, numerals[i] ?? `${i + 1}`, {
				fontFamily: FONT.title,
				fontSize: "22px",
				color: hex(COLORS.gold),
				fontStyle: "700",
			})
			.setOrigin(0.5);
		num.setShadow(0, 1, "#000000", 3, false, true);

		// 8. Decree Text
		const textX = -w / 2 + 38;
		const textW = w - 116;
		const fontSize = label.length > 55 ? "25px" : "28px";
		const t = scene.add
			.text(textX, 0, label, {
				fontFamily: FONT.body,
				fontSize,
				color: hex(COLORS.night),
				fontStyle: "600",
				wordWrap: { width: textW },
				align: "left",
				lineSpacing: 2,
			})
			.setOrigin(0, 0.5);
		t.setShadow(0, 1, "rgba(255, 252, 240, 0.6)", 0, false, true);

		// 9. Tactile hover & flash glow overlay
		glowGfx.lineStyle(2.5, 0xfffaea, 0.85);
		glowGfx.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
		glowGfx.lineStyle(1.5, COLORS.gold, 0.9);
		glowGfx.strokeRoundedRect(
			-w / 2 + inset1,
			-h / 2 + inset1,
			w - inset1 * 2,
			h - inset1 * 2,
			r - 3,
		);
		glowGfx.setAlpha(0);

		c.add([bg, t, num, glowGfx]);
		c.setSize(w, h).setInteractive({ useHandCursor: true });

		// Tactile micro-interactions
		c.on("pointerover", () => {
			if (this.locked) return;
			scene.tweens.add({
				targets: c,
				scale: 1.018,
				angle: fanAngle * 0.4,
				duration: 110,
				ease: "Sine.out",
			});
			scene.tweens.add({
				targets: glowGfx,
				alpha: 0.7,
				duration: 110,
			});
		});

		c.on("pointerout", () => {
			if (this.locked) return;
			scene.tweens.add({
				targets: c,
				scale: 1,
				angle: fanAngle,
				duration: 130,
				ease: "Sine.out",
			});
			scene.tweens.add({
				targets: glowGfx,
				alpha: 0,
				duration: 130,
			});
		});

		c.on("pointerdown", () => {
			if (this.locked) return;
			audio.sfx("tap");
			scene.tweens.add({
				targets: c,
				scale: 0.965,
				angle: 0,
				duration: 70,
				ease: "Quad.out",
			});
			scene.tweens.add({
				targets: glowGfx,
				alpha: 1,
				duration: 70,
			});
		});

		c.on("pointerup", () => {
			if (this.locked) return;
			scene.tweens.add({
				targets: c,
				scale: 1,
				duration: 160,
				ease: "Back.out(1.5)",
			});
			scene.tweens.add({
				targets: glowGfx,
				alpha: 0,
				duration: 160,
			});
			onTap();
		});

		return c;
	}

	private makeVoxRegisMedallion(
		scene: Phaser.Scene,
		x: number,
		y: number,
		onTap: () => void,
	) {
		const mw = 356;
		const mh = 64;
		const mr = 32;
		const c = scene.add.container(x, y);
		const g = scene.add.graphics();
		const hoverGlow = scene.add.graphics();

		// 1. Ambient drop shadow
		g.fillStyle(0x000000, 0.42);
		g.fillRoundedRect(-mw / 2, -mh / 2 + 4, mw, mh, mr);

		// 2. Base plate: antique imperial bronze / obsidian
		g.fillStyle(0x17120c, 0.96);
		g.fillRoundedRect(-mw / 2, -mh / 2, mw, mh, mr);

		// Subtle upper bronze sheen
		g.fillStyle(0x3a2916, 0.35);
		g.fillRoundedRect(-mw / 2 + 3, -mh / 2 + 3, mw - 6, mh / 2 - 3, {
			tl: mr - 2,
			tr: mr - 2,
			bl: 0,
			br: 0,
		});

		// 3. Borders:
		// Under-rim shadow line
		g.lineStyle(1, 0x54380b, 0.6);
		g.strokeRoundedRect(-mw / 2 - 0.5, -mh / 2 - 0.5, mw + 1, mh + 1, mr + 0.5);

		// Outer burnished antique bronze-gold border
		g.lineStyle(2, 0x9e7526, 0.95);
		g.strokeRoundedRect(-mw / 2, -mh / 2, mw, mh, mr);

		// Inner delicate pale gold hairline (inset 3.5px)
		const minset = 3.5;
		g.lineStyle(1, 0xffea9f, 0.6);
		g.strokeRoundedRect(
			-mw / 2 + minset,
			-mh / 2 + minset,
			mw - minset * 2,
			mh - minset * 2,
			mr - 3,
		);

		// Specular top highlight line
		g.lineStyle(1.5, 0xfffaea, 0.8);
		g.lineBetween(-mw / 2 + mr, -mh / 2 + 1, mw / 2 - mr, -mh / 2 + 1);

		// Bottom shadow line
		g.lineStyle(1.5, 0x5a3e10, 0.7);
		g.lineBetween(-mw / 2 + mr, mh / 2 - 1, mw / 2 - mr, mh / 2 - 1);

		// 4. Left Antique Medallion Seal (Coin)
		const scx = -mw / 2 + 36;
		const scy = 0;
		const scr = 21;

		// Coin shadow
		g.fillStyle(0x000000, 0.35);
		g.fillCircle(scx, scy + 1.5, scr);

		// Coin disc
		g.fillStyle(0x2a1c0d, 1);
		g.fillCircle(scx, scy, scr);

		// Coin milled gold rim
		g.lineStyle(1.8, COLORS.gold, 0.95);
		g.strokeCircle(scx, scy, scr);

		// Inner coin hairline
		g.lineStyle(1, 0xffea9f, 0.55);
		g.strokeCircle(scx, scy, scr - 3.5);

		// Milled edge tick marks (8 radial ticks)
		for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
			const cos = Math.cos(a);
			const sin = Math.sin(a);
			g.lineStyle(1, 0xffea9f, 0.7);
			g.lineBetween(
				scx + cos * (scr - 3.5),
				scy + sin * (scr - 3.5),
				scx + cos * (scr - 1),
				scy + sin * (scr - 1),
			);
		}

		// Breathing aura behind the seal
		const aura = scene.add.circle(scx, scy, scr + 5, COLORS.gold, 0.12);
		if (!settings.reducedMotion) {
			scene.tweens.add({
				targets: aura,
				alpha: { from: 0.1, to: 0.3 },
				scale: { from: 0.95, to: 1.15 },
				duration: 1200,
				yoyo: true,
				repeat: -1,
				ease: "Sine.easeInOut",
			});
		}

		// Icon inside seal
		const micIcon = scene.add
			.text(scx, scy, "🎙", {
				fontSize: "19px",
			})
			.setOrigin(0.5);

		// 5. Inscription typography
		// Header: "VOX REGIS"
		const titleText = scene.add
			.text(14, -10, "VOX REGIS", {
				fontFamily: FONT.title,
				fontSize: "16px",
				color: hex(COLORS.gold),
				fontStyle: "700",
			})
			.setOrigin(0.5);
		titleText.setLetterSpacing(4);
		titleText.setShadow(0, 1, "#000000", 4, false, true);

		// Subtitle: "Speak your decree"
		const subText = scene.add
			.text(14, 12, "Speak your decree", {
				fontFamily: FONT.ui,
				fontSize: "13px",
				color: hex(COLORS.muted),
				fontStyle: "600",
			})
			.setOrigin(0.5);
		subText.setLetterSpacing(1.5);
		subText.setShadow(0, 1, "#000000", 2, false, true);

		// Right side imperial star floret
		const starFloret = scene.add
			.text(mw / 2 - 32, 0, "✦", {
				fontFamily: FONT.title,
				fontSize: "15px",
				color: hex(COLORS.gold),
				fontStyle: "700",
			})
			.setOrigin(0.5);
		starFloret.setShadow(0, 0, hex(COLORS.gold), 6, false, true);

		// Hover glow graphics
		hoverGlow.lineStyle(2, 0xfff0b8, 0.85);
		hoverGlow.strokeRoundedRect(-mw / 2, -mh / 2, mw, mh, mr);
		hoverGlow.lineStyle(1, COLORS.gold, 0.9);
		hoverGlow.strokeRoundedRect(
			-mw / 2 + minset,
			-mh / 2 + minset,
			mw - minset * 2,
			mh - minset * 2,
			mr - 3,
		);
		hoverGlow.setAlpha(0);

		c.add([g, aura, micIcon, titleText, subText, starFloret, hoverGlow]);
		c.setSize(mw, mh).setInteractive({ useHandCursor: true });

		// Tactile micro-interactions
		c.on("pointerover", () => {
			if (this.locked) return;
			scene.tweens.add({
				targets: c,
				scale: 1.025,
				duration: 120,
				ease: "Sine.out",
			});
			scene.tweens.add({
				targets: hoverGlow,
				alpha: 0.7,
				duration: 120,
			});
		});

		c.on("pointerout", () => {
			if (this.locked) return;
			scene.tweens.add({
				targets: c,
				scale: 1,
				duration: 140,
				ease: "Sine.out",
			});
			scene.tweens.add({
				targets: hoverGlow,
				alpha: 0,
				duration: 140,
			});
		});

		c.on("pointerdown", () => {
			if (this.locked) return;
			audio.sfx("tap");
			scene.tweens.add({
				targets: c,
				scale: 0.95,
				duration: 70,
				ease: "Quad.out",
			});
		});

		c.on("pointerup", () => {
			if (this.locked) return;
			scene.tweens.add({
				targets: c,
				scale: 1,
				duration: 160,
				ease: "Back.out(1.5)",
			});
			scene.tweens.add({
				targets: hoverGlow,
				alpha: 0,
				duration: 160,
			});
			onTap();
		});

		return c;
	}

	/** Highlight one card (used when an advisor decides for the player). */
	flash(i: number) {
		const c = this.cards[i];
		if (!c) return;
		audio.sfx("chime");
		this.scene.tweens.add({
			targets: c,
			scale: 1.045,
			yoyo: true,
			repeat: 2,
			duration: 140,
			ease: "Sine.easeInOut",
		});
	}

	pick(i: number) {
		if (this.locked) return;
		this.locked = true;
		this.pickAnim(i);
	}

	private pickAnim(i: number) {
		this.cards.forEach((c, j) => {
			if (j === i) {
				this.scene.tweens.add({
					targets: c,
					y: H * 0.62,
					scale: 1.06,
					angle: 0,
					duration: 380,
					ease: "Back.out",
				});
				if (!settings.reducedMotion && this.scene.textures.exists("spark")) {
					const p = this.scene.add.particles(W / 2, H * 0.62, "spark", {
						speed: { min: 60, max: 220 },
						scale: { start: 0.6, end: 0 },
						lifespan: 500,
						tint: [COLORS.gold, 0xffffff],
						quantity: 16,
						blendMode: Phaser.BlendModes.ADD,
						emitting: false,
					});
					p.setDepth(55);
					p.explode(16);
					this.scene.time.delayedCall(600, () => p.destroy());
				}
				this.scene.tweens.add({
					targets: c,
					alpha: 0,
					duration: 250,
					delay: 700,
					onComplete: () => this.destroy(),
				});
			} else {
				const flingAngle = j < i ? -14 : 14;
				this.scene.tweens.add({
					targets: c,
					x: j < i ? -W : W * 2,
					alpha: 0,
					angle: flingAngle,
					duration: 380,
					ease: "Cubic.in",
				});
			}
		});
		if (this.mic) {
			this.scene.tweens.add({
				targets: this.mic,
				alpha: 0,
				y: "+=30",
				duration: 250,
			});
		}
	}

	dismiss() {
		this.locked = true;
		if (!this.scene?.tweens) {
			this.destroy();
			return;
		}
		this.scene.tweens.add({
			targets: this,
			alpha: 0,
			y: "+=50",
			duration: 250,
			onComplete: () => this.destroy(),
		});
	}

	/** Reveal exact hidden stat impacts and illuminate the historical choice. */
	activatePrescience() {
		this.cards.forEach((card, i) => {
			const choice = this.choicesData[i];
			if (!choice) return;

			// Golden aura if historical
			if (choice.historical) {
				const aura = this.scene.add.graphics();
				aura.lineStyle(3.5, COLORS.gold, 0.95);
				aura.strokeRoundedRect(
					-(W - 64) / 2 - 2,
					-98 / 2 - 2,
					W - 64 + 4,
					98 + 4,
					18,
				);
				card.add(aura);
				card.sendToBack(aura);
				this.scene.tweens.add({
					targets: aura,
					alpha: { from: 0.35, to: 1 },
					duration: 650,
					yoyo: true,
					repeat: -1,
					ease: "Sine.easeInOut",
				});
			}

			// Stat preview pill at the bottom right of the card
			const pill = this.scene.add.container((W - 64) / 2 - 130, 24);
			const bg = this.scene.add.graphics();
			bg.fillStyle(0x0e0c14, 0.88);
			bg.fillRoundedRect(-55, -12, 110, 24, 7);
			bg.lineStyle(1, COLORS.gold, 0.6);
			bg.strokeRoundedRect(-55, -12, 110, 24, 7);

			const fmt = (n: number) => (n > 0 ? `+${n}` : `${n}`);
			const gStr =
				choice.effects.gold !== 0 ? `◆${fmt(choice.effects.gold)} ` : "";
			const sStr =
				choice.effects.stability !== 0
					? `⚖${fmt(choice.effects.stability)} `
					: "";
			const lStr =
				choice.effects.legacy !== 0 ? `✦${fmt(choice.effects.legacy)}` : "";
			const text = `${gStr}${sStr}${lStr}`.trim() || "±0";

			const txt = this.scene.add
				.text(0, 0, text, {
					fontFamily: FONT.ui,
					fontSize: "13px",
					color: hex(choice.historical ? COLORS.gold : COLORS.text),
					fontStyle: "700",
				})
				.setOrigin(0.5);

			pill.add([bg, txt]);
			pill.setAlpha(0);
			card.add(pill);
			this.scene.tweens.add({
				targets: pill,
				alpha: 1,
				duration: 300,
				ease: "Cubic.out",
			});
		});
	}

	/** Mark a deceitful choice as exposed with a warning badge and slash styling. */
	markExposedLie(badChoiceIndex: number) {
		const card = this.cards[badChoiceIndex];
		if (!card) return;

		const badge = this.scene.add.container(0, -98 / 2 + 1);
		const bg = this.scene.add.graphics();
		bg.fillStyle(COLORS.blood, 0.95);
		bg.fillRoundedRect(-110, -12, 220, 24, 6);
		bg.lineStyle(1.5, 0xffffff, 0.85);
		bg.strokeRoundedRect(-110, -12, 220, 24, 6);

		const txt = this.scene.add
			.text(0, 0, "⚠️ CONSEIL PERFIDE DÉVOILÉ", {
				fontFamily: FONT.ui,
				fontSize: "12px",
				color: "#ffffff",
				fontStyle: "800",
			})
			.setOrigin(0.5);

		badge.add([bg, txt]);
		badge.setAlpha(0).setScale(0.85);
		card.add(badge);

		this.scene.tweens.add({
			targets: badge,
			alpha: 1,
			scale: 1,
			duration: 250,
			ease: "Back.out",
		});
	}
}
