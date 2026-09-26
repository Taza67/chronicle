import Phaser from "phaser";
import { audio } from "../core/audio.ts";
import {
	type CampaignLength,
	saveGame,
	saveSettings,
	settings,
} from "../core/state.ts";
import { COLORS, FONT, H, hex, ui, W } from "../ui/theme.ts";
import { Button, fadeIn, go } from "../ui/widgets.ts";

/**
 * SettingsScene: Antique Imperial Chronometer & Royal Horological Cabinet.
 * Features antique brass toggle switches with velvet tracks, graduated brass volume
 * rulers with polished ivory & gold knobs, filigree dividers, and meshing clockwork gears.
 */
export class SettingsScene extends Phaser.Scene {
	private back = "Title";
	private overlay = false;
	private gearTweens: Phaser.Tweens.Tween[] = [];

	constructor() {
		super("Settings");
	}

	init(data: { back?: string; overlay?: boolean }) {
		this.back = data?.back ?? "Title";
		this.overlay = !!data?.overlay;
		this.gearTweens = [];
	}

	create() {
		// 1. Background Atmosphere & Vignette
		if (!this.overlay) {
			fadeIn(this);
			this.add.rectangle(W / 2, H / 2, W, H, COLORS.night);
			const bg = this.add.image(W / 2, H / 2, "title_bg");
			bg.setScale(Math.max(W / bg.width, H / bg.height) * 1.1).setAlpha(0.16);

			// Warm wood & bronze peripheral vignette
			const vignette = this.add.graphics();
			vignette.fillStyle(0x060408, 0.45);
			vignette.fillRect(0, 0, W, H);
		} else {
			const shade = this.add
				.rectangle(W / 2, H / 2, W, H, COLORS.night, 0)
				.setInteractive();
			this.tweens.add({ targets: shade, fillAlpha: 0.86, duration: 240 });
		}

		// 2. Top Header Escutcheon & Back Button
		this.createHeader();

		// 3. Chronometer Cabinet Casing & Clockwork Backdrop
		const cabinetContainer = this.add.container(0, 0);
		this.createCabinet(cabinetContainer);

		// 4. Section I: Acoustic Escapement (Subtitles & Volumes)
		this.createFiligreeDivider(180, "I · ACOUSTIC ESCAPEMENT");

		this.createBrassToggle(
			"Subtitles",
			"Show what advisors say",
			() => settings.subtitles,
			(v) => {
				settings.subtitles = v;
			},
			242,
		);

		this.createGraduatedScale(
			"Voices",
			"Advisors and narrator",
			() => settings.voiceVolume,
			(v) => {
				audio.voiceVolume = settings.voiceVolume = v;
			},
			346,
		);

		this.createGraduatedScale(
			"Music",
			"Lyria court themes",
			() => settings.musicVolume,
			(v) => {
				audio.musicVolume = settings.musicVolume = v;
			},
			452,
		);

		// 5. Section II: Temporal Springs (Hourglass & Reduced Motion)
		this.createFiligreeDivider(536, "II · TEMPORAL SPRINGS");

		this.createBrassToggle(
			"Court hourglass",
			"10 seconds to decide, or council decides",
			() => settings.timer,
			(v) => {
				settings.timer = v;
			},
			602,
		);

		this.createCampaignLengthSelector(692);

		this.createBrassToggle(
			"Reduce motion",
			"Calmer animations, stationary clockwork",
			() => settings.reducedMotion,
			(v) => {
				settings.reducedMotion = v;
				for (const tw of this.gearTweens) {
					if (v) tw.pause();
					else tw.resume();
				}
			},
			780,
		);

		// 6. Horological Hallmark & Inspection Cartouche
		this.createFiligreeDivider(842);
		this.createHallmarkPlaque(876);

		// 7. Navigation Actions
		if (this.overlay) {
			new Button(this, W / 2, 915, "‹  Return to Court", () => this.close(), {
				w: 430,
				h: 68,
			});
			new Button(this, W / 2, 996, "⚔  Abandon Reign", () => this.abandon(), {
				w: 390,
				h: 58,
				primary: false,
				color: COLORS.blood,
				size: 21,
			});
		} else {
			new Button(this, W / 2, 948, "◆  Seal Chronometer", () => this.close(), {
				w: 390,
				h: 72,
			});
		}

		// 8. Footer Hackathon Credit
		this.add
			.text(
				W / 2,
				1230,
				"Chronicle · made for the Voodoo × Gradium × Cognition × DeepMind hackathon",
				ui(14, hex(COLORS.muted)),
			)
			.setOrigin(0.5)
			.setAlpha(0.68);
	}

	/** Header bar with antique winding crown back button and imperial horological title. */
	private createHeader() {
		const headerY = 74;

		// Antique Brass Winding Crown / Back Escutcheon
		const btn = this.add.container(62, headerY);
		const bg = this.add.graphics();
		const crownR = 25;

		// Outer knurled gear teeth
		bg.fillStyle(COLORS.goldDeep, 0.65);
		const teeth = 18;
		for (let i = 0; i < teeth; i++) {
			const a = (i * Math.PI * 2) / teeth;
			const tx = Math.cos(a) * (crownR + 2);
			const ty = Math.sin(a) * (crownR + 2);
			bg.fillCircle(tx, ty, 2.5);
		}

		// Milled bevel ring
		bg.fillStyle(0x2a1d10, 1);
		bg.fillCircle(0, 0, crownR);
		bg.lineStyle(2.5, COLORS.gold, 0.95);
		bg.strokeCircle(0, 0, crownR);

		// Inner dark velvet face
		bg.fillStyle(0x130e1a, 0.95);
		bg.fillCircle(0, 0, crownR - 4);
		bg.lineStyle(1, COLORS.goldDeep, 0.7);
		bg.strokeCircle(0, 0, crownR - 4);

		const glyph = this.add
			.text(-1, -1, "‹", {
				fontFamily: FONT.title,
				fontSize: "30px",
				color: hex(COLORS.gold),
				fontStyle: "700",
			})
			.setOrigin(0.5);

		btn.add([bg, glyph]);
		btn.setSize(crownR * 2 + 16, crownR * 2 + 16).setInteractive({
			useHandCursor: true,
		});

		btn.on("pointerdown", () => {
			btn.setScale(0.9);
		});
		btn.on("pointerup", () => {
			audio.sfx("tap");
			this.tweens.add({
				targets: btn,
				scale: 1,
				duration: 180,
				ease: "Back.out",
			});
			this.close();
		});

		// Header Titles
		const t = this.add
			.text(
				W / 2,
				headerY - 8,
				"CHRONOMÈTRE IMPÉRIAL",
				ui(28, hex(COLORS.gold)),
			)
			.setOrigin(0.5);
		t.setFontFamily(FONT.title);
		t.setFontStyle("700");
		t.setLetterSpacing(5);
		t.setShadow(0, 2, "#000000", 10, false, true);

		const sub = this.add
			.text(
				W / 2,
				headerY + 24,
				"RÉGULATION DE LA COUR · ATELIER DES ARCHIVES",
				ui(12, hex(COLORS.parchmentDark)),
			)
			.setOrigin(0.5)
			.setAlpha(0.8);
		sub.setFontFamily(FONT.title);
		sub.setLetterSpacing(3.5);
	}

	/** Builds the brass cabinet faceplate, corner brackets, and rotating clockwork gears. */
	private createCabinet(container: Phaser.GameObjects.Container) {
		const x0 = 36;
		const y0 = 126;
		const w = 648;
		const h = 948;

		const g = this.add.graphics();
		container.add(g);

		// Outer deep drop shadow
		g.fillStyle(0x000000, 0.65);
		g.fillRoundedRect(x0 + 4, y0 + 8, w, h, 20);

		// Mahogany wooden casing
		g.fillStyle(0x18101a, 1);
		g.fillRoundedRect(x0, y0, w, h, 20);

		// Heavy brass outer bezel rim
		g.lineStyle(3.5, COLORS.goldDeep, 0.85);
		g.strokeRoundedRect(x0, y0, w, h, 20);

		// Highlighted inner brass step
		g.lineStyle(1.2, COLORS.gold, 0.7);
		g.strokeRoundedRect(x0 + 4, y0 + 4, w - 8, h - 8, 17);

		// Dark velvet / oxidized bronze faceplate
		g.fillStyle(0x110c17, 1);
		g.fillRoundedRect(x0 + 10, y0 + 10, w - 20, h - 20, 14);
		g.lineStyle(1.5, 0x050408, 0.9);
		g.strokeRoundedRect(x0 + 10, y0 + 10, w - 20, h - 20, 14);

		// Fine inner perimeter rule
		g.lineStyle(1, COLORS.goldDeep, 0.35);
		g.strokeRoundedRect(x0 + 16, y0 + 16, w - 32, h - 32, 10);

		// Astrolabe longitude arcs engraved on faceplate
		g.lineStyle(1, COLORS.gold, 0.08);
		g.strokeCircle(W / 2, 490, 260);
		g.strokeCircle(W / 2, 490, 310);
		g.lineStyle(0.8, COLORS.gold, 0.05);
		g.lineBetween(x0 + 30, 490, x0 + w - 30, 490);

		// 4 Heavy Brass Corner Brackets (Gussets) with domed rivets
		this.drawCornerGussets(g, x0 + 10, y0 + 10, w - 20, h - 20);

		// Meshing Clockwork Gears (Subtle background motion)
		this.createClockworkGears(container);
	}

	/** Draws 4 ornate L-shaped brass brackets with domed rivets in each cabinet corner. */
	private drawCornerGussets(
		g: Phaser.GameObjects.Graphics,
		x: number,
		y: number,
		w: number,
		h: number,
	) {
		const size = 36;
		const corners = [
			{ cx: x, cy: y, flipX: 1, flipY: 1 },
			{ cx: x + w, cy: y, flipX: -1, flipY: 1 },
			{ cx: x, cy: y + h, flipX: 1, flipY: -1 },
			{ cx: x + w, cy: y + h, flipX: -1, flipY: -1 },
		];

		for (const c of corners) {
			// Bracket plate
			g.fillStyle(0x281c10, 0.95);
			g.beginPath();
			g.moveTo(c.cx, c.cy);
			g.lineTo(c.cx + c.flipX * size, c.cy);
			g.lineTo(c.cx + c.flipX * size, c.cy + c.flipY * 11);
			g.lineTo(c.cx + c.flipX * 11, c.cy + c.flipY * 11);
			g.lineTo(c.cx + c.flipX * 11, c.cy + c.flipY * size);
			g.lineTo(c.cx, c.cy + c.flipY * size);
			g.closePath();
			g.fillPath();

			g.lineStyle(1.5, COLORS.gold, 0.7);
			g.strokePath();

			// 3 domed rivets on each bracket
			const rivets = [
				{ rx: 6, ry: 20 },
				{ rx: 20, ry: 6 },
				{ rx: 20, ry: 20 },
			];
			for (const r of rivets) {
				const px = c.cx + c.flipX * r.rx;
				const py = c.cy + c.flipY * r.ry;
				g.fillStyle(0x0e0a05, 0.9);
				g.fillCircle(px + 0.5, py + 0.8, 3.2);
				g.fillStyle(0xc89e36, 1);
				g.fillCircle(px, py, 2.6);
				g.fillStyle(0xfff2cc, 0.85);
				g.fillCircle(px - 0.7, py - 0.7, 1);
			}
		}
	}

	/** Generates rotating clockwork gears under the dial plate. */
	private createClockworkGears(container: Phaser.GameObjects.Container) {
		const configs = [
			{ x: 535, y: 240, r: 86, teeth: 20, speed: 72000, dir: 1 },
			{
				x: 426,
				y: 172,
				r: 46,
				teeth: 11,
				speed: 72000 * (46 / 86),
				dir: -1,
			},
			{ x: 142, y: 755, r: 70, teeth: 16, speed: 58000, dir: 1 },
		];

		for (const cfg of configs) {
			const gc = this.add.container(cfg.x, cfg.y);
			const g = this.add.graphics();
			this.renderGearGraphics(g, cfg.r, cfg.teeth);
			gc.add(g);
			gc.setAlpha(0.2);
			container.add(gc);

			const tw = this.tweens.add({
				targets: gc,
				angle: cfg.dir * 360,
				duration: cfg.speed,
				repeat: -1,
				ease: "Linear",
			});
			if (settings.reducedMotion) tw.pause();
			this.gearTweens.push(tw);
		}
	}

	/** Procedurally draws an authentic brass gear with teeth, spokes, and central axle. */
	private renderGearGraphics(
		g: Phaser.GameObjects.Graphics,
		r: number,
		teeth: number,
	) {
		const rootR = r * 0.82;
		const innerR = r * 0.56;
		const hubR = r * 0.28;
		const axleR = r * 0.12;

		g.fillStyle(0x281d12, 0.75);
		g.lineStyle(1.8, COLORS.goldDeep, 0.7);

		g.beginPath();
		const toothStep = (Math.PI * 2) / teeth;
		const halfW = toothStep * 0.22;
		for (let i = 0; i < teeth; i++) {
			const a = i * toothStep;
			const p0x = Math.cos(a - halfW * 1.3) * rootR;
			const p0y = Math.sin(a - halfW * 1.3) * rootR;
			const p1x = Math.cos(a - halfW * 0.7) * r;
			const p1y = Math.sin(a - halfW * 0.7) * r;
			const p2x = Math.cos(a + halfW * 0.7) * r;
			const p2y = Math.sin(a + halfW * 0.7) * r;
			const p3x = Math.cos(a + halfW * 1.3) * rootR;
			const p3y = Math.sin(a + halfW * 1.3) * rootR;

			if (i === 0) g.moveTo(p0x, p0y);
			else g.lineTo(p0x, p0y);
			g.lineTo(p1x, p1y);
			g.lineTo(p2x, p2y);
			g.lineTo(p3x, p3y);
		}
		g.closePath();
		g.fillPath();
		g.strokePath();

		// Inner rim & spokes
		g.lineStyle(1.2, COLORS.gold, 0.45);
		g.strokeCircle(0, 0, innerR);

		const spokes = teeth >= 18 ? 5 : 4;
		const cutR = (innerR - hubR) * 0.42;
		const cutDist = (innerR + hubR) * 0.52;
		g.fillStyle(0x0c0812, 0.85);
		for (let s = 0; s < spokes; s++) {
			const sa = (s * Math.PI * 2) / spokes;
			const sx = Math.cos(sa) * cutDist;
			const sy = Math.sin(sa) * cutDist;
			g.fillCircle(sx, sy, cutR);
			g.lineStyle(1, COLORS.goldDeep, 0.5);
			g.strokeCircle(sx, sy, cutR);
		}

		// Hub and axle nut
		g.fillStyle(0x382714, 0.95);
		g.fillCircle(0, 0, hubR);
		g.lineStyle(1.5, COLORS.gold, 0.8);
		g.strokeCircle(0, 0, hubR);

		g.fillStyle(0x110b06, 1);
		g.fillCircle(0, 0, axleR);
		g.lineStyle(1.2, 0x050402, 1);
		g.lineBetween(-axleR * 0.8, 0, axleR * 0.8, 0);
	}

	/** Elegant filigree divider with central rosette or ribbon badge. */
	private createFiligreeDivider(y: number, text?: string) {
		const c = this.add.container(W / 2, y);
		const g = this.add.graphics();
		c.add(g);

		const halfW = 270;
		const textGap = text ? 124 : 32;

		// Tapered hairline gold rules
		g.lineStyle(1.5, COLORS.goldDeep, 0.65);
		g.lineBetween(-halfW, 0, -textGap, 0);
		g.lineBetween(textGap, 0, halfW, 0);

		g.lineStyle(1, COLORS.gold, 0.85);
		g.lineBetween(-halfW + 35, -2, -textGap, -2);
		g.lineBetween(textGap, -2, halfW - 35, -2);

		// Terminal diamond finials
		const drawDiamond = (dx: number, dy: number, s: number, color: number) => {
			g.fillStyle(color, 0.95);
			g.beginPath();
			g.moveTo(dx, dy - s);
			g.lineTo(dx + s * 0.7, dy);
			g.lineTo(dx, dy + s);
			g.lineTo(dx - s * 0.7, dy);
			g.closePath();
			g.fillPath();
		};

		drawDiamond(-halfW, 0, 4.5, COLORS.gold);
		drawDiamond(-halfW + 18, 0, 2.5, COLORS.goldDeep);
		drawDiamond(halfW, 0, 4.5, COLORS.gold);
		drawDiamond(halfW - 18, 0, 2.5, COLORS.goldDeep);

		// Acanthus flourish curves via cubic bezier sampling
		const cubicPt = (
			p0: { x: number; y: number },
			p1: { x: number; y: number },
			p2: { x: number; y: number },
			p3: { x: number; y: number },
			t: number,
		) => {
			const mt = 1 - t;
			const mt2 = mt * mt;
			const t2 = t * t;
			return {
				x:
					mt2 * mt * p0.x +
					3 * mt2 * t * p1.x +
					3 * mt * t2 * p2.x +
					t2 * t * p3.x,
				y:
					mt2 * mt * p0.y +
					3 * mt2 * t * p1.y +
					3 * mt * t2 * p2.y +
					t2 * t * p3.y,
			};
		};

		const drawCurve = (
			p0: { x: number; y: number },
			p1: { x: number; y: number },
			p2: { x: number; y: number },
			p3: { x: number; y: number },
		) => {
			g.beginPath();
			g.moveTo(p0.x, p0.y);
			for (let s = 1; s <= 12; s++) {
				const pt = cubicPt(p0, p1, p2, p3, s / 12);
				g.lineTo(pt.x, pt.y);
			}
			g.strokePath();
		};

		const drawFlourish = (flip: number) => {
			g.lineStyle(1.2, COLORS.gold, 0.75);
			drawCurve(
				{ x: flip * (textGap - 4), y: 0 },
				{ x: flip * (textGap - 18), y: -9 },
				{ x: flip * (textGap - 34), y: -7 },
				{ x: flip * (textGap - 42), y: 0 },
			);

			g.lineStyle(0.9, COLORS.goldDeep, 0.55);
			drawCurve(
				{ x: flip * (textGap - 6), y: 0 },
				{ x: flip * (textGap - 20), y: 8 },
				{ x: flip * (textGap - 36), y: 6 },
				{ x: flip * (textGap - 44), y: 0 },
			);

			drawDiamond(flip * (textGap - 24), -7, 2, COLORS.gold);
		};
		drawFlourish(1);
		drawFlourish(-1);

		if (text) {
			const label = this.add
				.text(0, 0, text.toUpperCase(), {
					fontFamily: FONT.title,
					fontSize: "13px",
					color: hex(COLORS.gold),
					fontStyle: "700",
				})
				.setOrigin(0.5);
			label.setLetterSpacing(3.5);
			label.setShadow(0, 1, "#000000", 6, false, true);
			c.add(label);

			drawDiamond(-textGap + 8, 0, 2.5, COLORS.gold);
			drawDiamond(textGap - 8, 0, 2.5, COLORS.gold);
		} else {
			// Center Escapement Rosette with ruby jewel
			g.fillStyle(COLORS.goldDeep, 0.85);
			g.fillCircle(0, 0, 9);
			g.lineStyle(1.5, COLORS.gold, 1);
			g.strokeCircle(0, 0, 9);

			g.fillStyle(COLORS.blood, 0.95);
			g.fillCircle(0, 0, 4.5);
			g.fillStyle(0xffffff, 0.8);
			g.fillCircle(-1.2, -1.2, 1.3);

			drawDiamond(0, -13, 3, COLORS.gold);
			drawDiamond(0, 13, 3, COLORS.gold);
			drawDiamond(-13, 0, 3, COLORS.gold);
			drawDiamond(13, 0, 3, COLORS.gold);
		}
	}

	/** Creates an antique brass toggle switch with a deep velvet track and physical snap feel. */
	private createBrassToggle(
		label: string,
		hint: string,
		get: () => boolean,
		set: (v: boolean) => void,
		y: number,
	) {
		// Row title & descriptive hint
		this.add
			.text(72, y - 14, label, {
				fontFamily: FONT.title,
				fontSize: "23px",
				color: hex(COLORS.text),
				fontStyle: "700",
			})
			.setOrigin(0, 0.5);

		this.add
			.text(72, y + 17, hint, ui(15, hex(COLORS.muted)))
			.setOrigin(0, 0.5);

		// Toggle assembly on the right
		const toggleX = W - 116;
		const toggleContainer = this.add.container(toggleX, y);

		const trackW = 96;
		const trackH = 46;
		const trackR = 23;
		const travelX = 25;

		const trackG = this.add.graphics();
		toggleContainer.add(trackG);

		// Engraved track indicator texts (OFF "○" and ON "✦")
		const offGlyph = this.add
			.text(-travelX, 0, "○", {
				fontFamily: FONT.title,
				fontSize: "14px",
				color: hex(COLORS.muted),
				fontStyle: "700",
			})
			.setOrigin(0.5)
			.setAlpha(0.65);

		const onGlyph = this.add
			.text(travelX, 0, "✦", {
				fontFamily: FONT.title,
				fontSize: "15px",
				color: hex(COLORS.gold),
				fontStyle: "700",
			})
			.setOrigin(0.5)
			.setAlpha(0.9);

		toggleContainer.add([offGlyph, onGlyph]);

		// Sculpted Brass Lever Knob
		const knobContainer = this.add.container(get() ? travelX : -travelX, 0);
		const knobG = this.add.graphics();
		knobContainer.add(knobG);
		toggleContainer.add(knobContainer);

		const renderTrack = (isOn: boolean) => {
			trackG.clear();

			// Deep inset shadow
			trackG.fillStyle(0x060408, 0.85);
			trackG.fillRoundedRect(-trackW / 2, -trackH / 2, trackW, trackH, trackR);

			// Track velvet bed: warm amber radiance when ON, nocturnal obsidian when OFF
			if (isOn) {
				trackG.fillStyle(0x361c12, 1);
				trackG.fillRoundedRect(
					-trackW / 2 + 2,
					-trackH / 2 + 2,
					trackW - 4,
					trackH - 4,
					trackR - 2,
				);
				trackG.fillStyle(0x7c4114, 0.65);
				trackG.fillCircle(travelX, 0, 18);
			} else {
				trackG.fillStyle(0x130f18, 1);
				trackG.fillRoundedRect(
					-trackW / 2 + 2,
					-trackH / 2 + 2,
					trackW - 4,
					trackH - 4,
					trackR - 2,
				);
			}

			// Brass mortise casing border
			trackG.lineStyle(2, COLORS.goldDeep, 0.8);
			trackG.strokeRoundedRect(
				-trackW / 2,
				-trackH / 2,
				trackW,
				trackH,
				trackR,
			);

			// Lower-right bevel reflection
			trackG.lineStyle(1.2, COLORS.gold, 0.65);
			trackG.lineBetween(-trackW / 4, trackH / 2, trackW / 2 - 10, trackH / 2);

			offGlyph.setAlpha(isOn ? 0.35 : 0.8);
			onGlyph.setAlpha(isOn ? 0.95 : 0.35);
		};

		const renderKnob = (isOn: boolean) => {
			knobG.clear();

			// Drop shadow on velvet bed
			knobG.fillStyle(0x000000, 0.55);
			knobG.fillEllipse(1, 4, 34, 30);

			// Outer knurled bronze flange
			knobG.fillStyle(0x6e4e16, 1);
			knobG.fillCircle(0, 0, 18);
			knobG.lineStyle(1.5, 0x3d2b0c, 1);
			knobG.strokeCircle(0, 0, 18);

			// Beveled polished brass face
			knobG.fillStyle(isOn ? 0xd4a536 : 0xaa842d, 1);
			knobG.fillCircle(0, 0, 15.5);
			knobG.lineStyle(1, 0xfce488, 0.75);
			knobG.strokeCircle(0, 0, 15.5);

			// Inner spun disc
			knobG.fillStyle(isOn ? 0xf5d470 : 0xb5923c, 1);
			knobG.fillCircle(0, 0, 13);

			// Specular reflection highlight arc
			knobG.lineStyle(1.8, 0xfffcf0, 0.85);
			knobG.beginPath();
			knobG.arc(0, 0, 10, -Math.PI * 0.85, -Math.PI * 0.25);
			knobG.strokePath();

			// Center knurled arbor stud
			knobG.fillStyle(0x422d0c, 1);
			knobG.fillCircle(0, 0, 6);
			knobG.lineStyle(1, COLORS.gold, 0.7);
			knobG.strokeCircle(0, 0, 6);

			// Center Cabochon Jewel: ruby red when engaged, dark garnet when disengaged
			knobG.fillStyle(isOn ? 0xdb362c : 0x481616, 1);
			knobG.fillCircle(0, 0, 3.5);
			if (isOn) {
				knobG.fillStyle(0xffffff, 0.85);
				knobG.fillCircle(-0.9, -0.9, 1.1);
			}
		};

		renderTrack(get());
		renderKnob(get());

		// Interactive hit zone
		toggleContainer
			.setSize(trackW + 16, trackH + 16)
			.setInteractive({ useHandCursor: true });

		toggleContainer.on("pointerup", () => {
			const next = !get();
			set(next);
			saveSettings();
			audio.sfx("tick");

			// Mechanical snap animation with elastic bounce
			this.tweens.add({
				targets: knobContainer,
				x: next ? travelX : -travelX,
				scaleX: { from: 1.18, to: 1 },
				scaleY: { from: 0.86, to: 1 },
				duration: 210,
				ease: "Back.out",
			});

			renderTrack(next);
			renderKnob(next);
		});
	}

	/** Creates a 3-way antique brass selector for council campaign length (5, 8, 10 dilemmas). */
	private createCampaignLengthSelector(y: number) {
		this.add
			.text(72, y - 14, "Reign duration", {
				fontFamily: FONT.title,
				fontSize: "23px",
				color: hex(COLORS.text),
				fontStyle: "700",
			})
			.setOrigin(0, 0.5);

		this.add
			.text(
				72,
				y + 14,
				"5, 8 or 10 dilemmas per council",
				ui(15, hex(COLORS.muted)),
			)
			.setOrigin(0, 0.5);

		const options: { length: CampaignLength; label: string }[] = [
			{ length: 5, label: "5" },
			{ length: 8, label: "8" },
			{ length: 10, label: "10" },
		];

		const startX = W - 225;
		const pillButtons: {
			bg: Phaser.GameObjects.Graphics;
			text: Phaser.GameObjects.Text;
			len: CampaignLength;
		}[] = [];

		const updatePills = () => {
			for (const p of pillButtons) {
				const isSelected = (settings.campaignLength ?? 10) === p.len;
				p.bg.clear();
				if (isSelected) {
					p.bg.fillStyle(COLORS.gold, 1);
					p.bg.fillRoundedRect(-22, -18, 44, 36, 8);
					p.bg.lineStyle(2, COLORS.goldDeep, 1);
					p.bg.strokeRoundedRect(-22, -18, 44, 36, 8);
					p.text.setColor(hex(COLORS.night));
				} else {
					p.bg.fillStyle(0x1a1208, 0.9);
					p.bg.fillRoundedRect(-22, -18, 44, 36, 8);
					p.bg.lineStyle(1.5, COLORS.goldDeep, 0.5);
					p.bg.strokeRoundedRect(-22, -18, 44, 36, 8);
					p.text.setColor(hex(COLORS.text));
				}
			}
		};

		options.forEach((opt, idx) => {
			const x = startX + idx * 54;
			const c = this.add.container(x, y);
			const bg = this.add.graphics();
			const text = this.add
				.text(0, 0, opt.label, {
					fontFamily: FONT.title,
					fontSize: "18px",
					fontStyle: "700",
					color: hex(COLORS.text),
				})
				.setOrigin(0.5);

			c.add([bg, text]);
			c.setSize(44, 36);
			c.setInteractive({ useHandCursor: true });
			c.on("pointerup", () => {
				settings.campaignLength = opt.length;
				saveSettings();
				audio.sfx("tap");
				updatePills();
			});

			pillButtons.push({ bg, text, len: opt.length });
		});

		updatePills();
	}

	/** Creates an antique graduated brass ruler with an ivory & gold indicator knob. */
	private createGraduatedScale(
		label: string,
		hint: string,
		get: () => number,
		set: (v: number) => void,
		y: number,
	) {
		// Left: Title and Hint
		this.add
			.text(72, y - 16, label, {
				fontFamily: FONT.title,
				fontSize: "23px",
				color: hex(COLORS.text),
				fontStyle: "700",
			})
			.setOrigin(0, 0.5);

		this.add
			.text(72, y + 14, hint, ui(15, hex(COLORS.muted)))
			.setOrigin(0, 0.5);

		// Engraved Brass Value Readout Badge
		const badge = this.add.container(72, y + 42);
		const badgeG = this.add.graphics();
		badgeG.fillStyle(0x150f1c, 0.95);
		badgeG.fillRoundedRect(0, -11, 68, 22, 5);
		badgeG.lineStyle(1.5, COLORS.goldDeep, 0.75);
		badgeG.strokeRoundedRect(0, -11, 68, 22, 5);

		const formatValue = (v: number) =>
			v <= 0.02 ? "MUTE" : `${Math.round(v * 100)}%`;
		const badgeText = this.add
			.text(34, 0, formatValue(get()), {
				fontFamily: FONT.ui,
				fontSize: "12px",
				color: hex(COLORS.gold),
				fontStyle: "700",
			})
			.setOrigin(0.5);
		badge.add([badgeG, badgeText]);

		// Right: Graduated Brass Ruler & Ivory Knob
		const w = 236;
		const x0 = W - 328;

		const rulerG = this.add.graphics();
		const fillG = this.add.graphics();

		// Draw antique brass ruler plate
		const plateH = 28;
		rulerG.fillStyle(0x060408, 0.7);
		rulerG.fillRoundedRect(x0 - 10, y - plateH / 2 + 3, w + 20, plateH, 6);

		rulerG.fillStyle(0x2e1f13, 1);
		rulerG.fillRoundedRect(x0 - 10, y - plateH / 2, w + 20, plateH, 6);
		rulerG.lineStyle(2, COLORS.goldDeep, 0.85);
		rulerG.strokeRoundedRect(x0 - 10, y - plateH / 2, w + 20, plateH, 6);

		// Top highlight rim on ruler plate
		rulerG.lineStyle(1, COLORS.gold, 0.7);
		rulerG.lineBetween(
			x0 - 8,
			y - plateH / 2 + 1,
			x0 + w + 8,
			y - plateH / 2 + 1,
		);

		// Mounting screws on ruler end tabs
		const drawScrew = (sx: number) => {
			rulerG.fillStyle(0x120a04, 1);
			rulerG.fillCircle(sx, y, 3.5);
			rulerG.lineStyle(1, COLORS.goldDeep, 0.8);
			rulerG.strokeCircle(sx, y, 3.5);
			rulerG.lineStyle(1, 0x050302, 1);
			rulerG.lineBetween(sx - 2.5, y, sx + 2.5, y);
		};
		drawScrew(x0 - 5);
		drawScrew(x0 + w + 5);

		// Recessed slider channel
		rulerG.fillStyle(0x100b17, 1);
		rulerG.fillRoundedRect(x0, y - 4, w, 8, 4);
		rulerG.lineStyle(1.2, 0x060308, 0.95);
		rulerG.strokeRoundedRect(x0, y - 4, w, 8, 4);

		// Engraved graduation ticks (20 intervals = 21 ticks)
		const tickLabels = ["0", "¼", "½", "¾", "I"];
		for (let i = 0; i <= 20; i++) {
			const tx = x0 + (i / 20) * w;
			if (i % 5 === 0) {
				// Major calibration tick
				rulerG.lineStyle(1.6, COLORS.gold, 0.95);
				rulerG.lineBetween(tx, y - 7, tx, y - 17);

				// Engraved scale label above ruler
				const idx = i / 5;
				this.add
					.text(tx, y - 27, tickLabels[idx], {
						fontFamily: FONT.title,
						fontSize: "11px",
						color: hex(COLORS.parchmentDark),
						fontStyle: "700",
					})
					.setOrigin(0.5);
			} else if (i % 2 === 0) {
				// Medium tick
				rulerG.lineStyle(1.2, COLORS.goldDeep, 0.75);
				rulerG.lineBetween(tx, y - 7, tx, y - 13);
			} else {
				// Minor subdivision tick
				rulerG.lineStyle(0.8, COLORS.goldDeep, 0.45);
				rulerG.lineBetween(tx, y - 7, tx, y - 10);
			}
		}

		// Polished Ivory & Gold Knob Assembly
		const knobContainer = this.add.container(x0 + w * get(), y);
		const knobG = this.add.graphics();
		knobContainer.add(knobG);

		const renderFill = (v: number) => {
			fillG.clear();
			if (v <= 0) return;
			const fw = Math.max(4, w * v);
			fillG.fillStyle(COLORS.gold, 0.95);
			fillG.fillRoundedRect(x0, y - 3, fw, 6, 3);
			fillG.lineStyle(1, 0xfff6b8, 0.85);
			fillG.lineBetween(x0 + 2, y, x0 + fw - 2, y);
		};

		const renderKnob = () => {
			knobG.clear();

			// Cast shadow
			knobG.fillStyle(0x000000, 0.5);
			knobG.fillEllipse(1, 4, 30, 26);

			// Outer knurled brass flange
			knobG.fillStyle(0x765319, 1);
			knobG.fillCircle(0, 0, 14);
			knobG.lineStyle(1.5, 0x402b0a, 1);
			knobG.strokeCircle(0, 0, 14);

			// Polished gold rim
			knobG.fillStyle(0xdba638, 1);
			knobG.fillCircle(0, 0, 12);
			knobG.lineStyle(1, 0xffeb8a, 0.8);
			knobG.strokeCircle(0, 0, 12);

			// Polished Ivory Core
			knobG.fillStyle(0xfdf8ee, 1);
			knobG.fillCircle(0, 0, 9.5);

			// Ivory subtle lower shaded bevel
			knobG.fillStyle(0xdcd0b4, 0.7);
			knobG.beginPath();
			knobG.arc(0, 1, 8.5, 0, Math.PI);
			knobG.fillPath();

			// Sharp brass pointer index needle facing UPWARD toward ticks
			knobG.fillStyle(COLORS.gold, 1);
			knobG.beginPath();
			knobG.moveTo(0, -18);
			knobG.lineTo(-3.8, -10);
			knobG.lineTo(3.8, -10);
			knobG.closePath();
			knobG.fillPath();

			knobG.lineStyle(1, 0x5a3e10, 1);
			knobG.strokePath();

			// Center brass rivet pin
			knobG.fillStyle(0x9a7420, 1);
			knobG.fillCircle(0, 0, 3.2);
			knobG.fillStyle(0xffffff, 0.85);
			knobG.fillCircle(-0.8, -0.8, 1);
		};

		renderFill(get());
		renderKnob();

		// Interactive Slider Hit Zone
		const zone = this.add
			.rectangle(x0 + w / 2, y, w + 44, 68, 0, 0)
			.setInteractive({ useHandCursor: true });

		let held = false;
		let lastTickStep = Math.round(get() * 20);

		const apply = (px: number) => {
			const raw = Phaser.Math.Clamp((px - x0) / w, 0, 1);
			const step = Math.round(raw * 20);
			const v = step / 20;

			knobContainer.x = x0 + w * v;
			renderFill(v);
			badgeText.setText(formatValue(v));

			if (step !== lastTickStep) {
				audio.sfx("tick");
				lastTickStep = step;
			}

			set(v);
			saveSettings();
		};

		zone.on("pointerdown", (p: Phaser.Input.Pointer) => {
			held = true;
			this.tweens.add({
				targets: knobContainer,
				scale: 1.15,
				duration: 120,
				ease: "Back.out",
			});
			apply(p.x);
		});

		const moveHandler = (p: Phaser.Input.Pointer) => {
			if (held && p.isDown) apply(p.x);
		};

		const upHandler = () => {
			if (held) {
				held = false;
				this.tweens.add({
					targets: knobContainer,
					scale: 1,
					duration: 150,
					ease: "Quad.out",
				});
			}
		};

		this.input.on(Phaser.Input.Events.POINTER_MOVE, moveHandler);
		this.input.on(Phaser.Input.Events.POINTER_UP, upHandler);

		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.input.off(Phaser.Input.Events.POINTER_MOVE, moveHandler);
			this.input.off(Phaser.Input.Events.POINTER_UP, upHandler);
		});
	}

	/** Hallmark brass inspection cartouche certifying royal precision escapement. */
	private createHallmarkPlaque(y: number) {
		const c = this.add.container(W / 2, y);
		const g = this.add.graphics();
		c.add(g);

		const pw = 420;
		const ph = 32;

		g.fillStyle(0x181120, 0.95);
		g.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 7);
		g.lineStyle(1.5, COLORS.goldDeep, 0.75);
		g.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 7);

		const hallmark = this.add
			.text(
				0,
				0,
				"✦  CALIBRE ROYALE · NO. 1804 · ATELIER DE PRÉCISION  ✦",
				ui(11, hex(COLORS.goldDeep)),
			)
			.setOrigin(0.5);
		hallmark.setFontFamily(FONT.title);
		hallmark.setLetterSpacing(2.5);
		c.add(hallmark);
	}

	private close() {
		if (this.overlay) {
			this.scene.resume(this.back);
			this.scene.stop();
		} else go(this, this.back);
	}

	private abandon() {
		saveGame(null);
		this.scene.stop(this.back);
		this.scene.stop();
		this.scene.start("Title");
	}
}
