import Phaser from "phaser";
import { audio } from "../core/audio.ts";
import { settings } from "../core/state.ts";
import type { Effects, Stat } from "../types.ts";
import { COLORS, FONT, hex, STAT_META, W } from "./theme.ts";

const STATS: Stat[] = ["gold", "stability", "legacy"];

interface ReliquaryMeta {
	title: string;
	subtitle: string;
	icon: string;
	color: number;
	deepColor: number;
	fluidColor: number;
	fluidGlow: number;
}

const RELIQUARIES: Record<Stat, ReliquaryMeta> = {
	gold: {
		title: "TREASURY",
		subtitle: "GOLD",
		icon: STAT_META.gold.icon,
		color: COLORS.gold,
		deepColor: COLORS.goldDeep,
		fluidColor: 0xe0a626,
		fluidGlow: 0xffe270,
	},
	stability: {
		title: "ORDER",
		subtitle: "STABILITY",
		icon: STAT_META.stability.icon,
		color: COLORS.sage,
		deepColor: 0x3d6647,
		fluidColor: 0x54a06b,
		fluidGlow: 0x8ce0a3,
	},
	legacy: {
		title: "POSTERITY",
		subtitle: "LEGACY",
		icon: STAT_META.legacy.icon,
		color: COLORS.sky,
		deepColor: 0x365f85,
		fluidColor: 0x4f92c7,
		fluidGlow: 0x8ed0ff,
	},
};

interface WingState {
	x: number;
	cx: number;
	value: { v: number };
	meterGfx: Phaser.GameObjects.Graphics;
	dangerGfx: Phaser.GameObjects.Graphics;
	dangerTween?: Phaser.Tweens.Tween;
	dangerEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
	inDanger: boolean;
	valueText: Phaser.GameObjects.Text;
	cartoucheGfx: Phaser.GameObjects.Graphics;
}

/** Regal three-reliquary triptych HUD (Treasury, Order, Posterity) with graduated mercury meters. */
export class Gauges extends Phaser.GameObjects.Container {
	private bars: Record<Stat, WingState>;
	private activeChips = new Set<Phaser.GameObjects.Container>();

	// Reliquary panel geometry
	private readonly pw = 218; // panel width
	private readonly ph = 84; // panel height
	private readonly py = -42; // panel top relative to container Y
	private readonly gw = 194; // gauge meter width
	private readonly gh = 16; // gauge meter height
	private readonly gy = 1; // gauge meter Y relative to container Y (py + 43 = 1)

	constructor(scene: Phaser.Scene, y: number, stats: Effects) {
		super(scene, 0, y);

		// 1. Base Mounting Plaque & Triptych Bezels
		const baseGfx = scene.add.graphics();
		this.drawTriptychBase(baseGfx);
		this.add(baseGfx);

		this.bars = {} as Record<Stat, WingState>;

		// 2. Build the three reliquary wings
		STATS.forEach((s, i) => {
			const px = 16 + i * (this.pw + 17);
			const cx = px + this.pw / 2;
			const rel = RELIQUARIES[s];

			// Danger crisis aura (pulsing blood-red bezel)
			const dangerGfx = scene.add.graphics();
			this.drawDangerBezel(dangerGfx, px);
			dangerGfx.setVisible(false);
			this.add(dangerGfx);

			let dangerTween: Phaser.Tweens.Tween | undefined;
			if (!settings.reducedMotion) {
				dangerTween = scene.tweens.add({
					targets: dangerGfx,
					alpha: { from: 0.35, to: 0.95 },
					duration: 650,
					yoyo: true,
					repeat: -1,
					ease: "Sine.easeInOut",
					paused: true,
				});
			}

			// Danger embers particle emitter (subtle rising firebrands when <= 1.5)
			let dangerEmitter:
				| Phaser.GameObjects.Particles.ParticleEmitter
				| undefined;
			if (scene.textures.exists("spark")) {
				dangerEmitter = scene.add.particles(
					cx,
					this.py + this.ph - 4,
					"spark",
					{
						x: { min: -this.pw / 2 + 18, max: this.pw / 2 - 18 },
						y: { min: -4, max: 4 },
						speedY: { min: -22, max: -46 },
						speedX: { min: -7, max: 7 },
						lifespan: { min: 900, max: 1500 },
						scale: { start: 0.22, end: 0 },
						alpha: { start: 0.85, end: 0, ease: "Sine.out" },
						tint: [COLORS.blood, 0xef5020, COLORS.gold],
						quantity: 1,
						frequency: settings.reducedMotion ? 500 : 160,
						blendMode: Phaser.BlendModes.ADD,
						emitting: false,
					},
				);
				this.add(dangerEmitter);
			}

			// Reliquary Header: Icon Medallion
			const discX = px + 22;
			const discY = this.py + 21;
			const iconText = scene.add
				.text(discX, discY, rel.icon, {
					fontFamily: FONT.title,
					fontSize: "15px",
					color: hex(rel.color),
					fontStyle: "700",
				})
				.setOrigin(0.5);
			iconText.setShadow(0, 1, "rgba(0, 0, 0, 0.9)", 2, false, true);

			// Reliquary Header: Two-tiered Title
			const titleText = scene.add.text(px + 38, this.py + 13, rel.title, {
				fontFamily: FONT.title,
				fontSize: "12px",
				color: "#f5ecd7",
				fontStyle: "700",
			});
			titleText.setLetterSpacing(1.5);
			titleText.setShadow(0, 1, "rgba(0, 0, 0, 0.85)", 2, false, true);

			const subText = scene.add.text(px + 38, this.py + 26, rel.subtitle, {
				fontFamily: FONT.ui,
				fontSize: "8.5px",
				color: hex(rel.color),
				fontStyle: "600",
			});
			subText.setLetterSpacing(2);

			// Reliquary Header: Value Cartouche
			const cartoucheGfx = scene.add.graphics();
			const rx = px + this.pw - 12 - 34;
			const ry = this.py + 11;
			const rw = 34;
			const rh = 20;

			cartoucheGfx.fillStyle(0x0c0a14, 0.85);
			cartoucheGfx.fillRoundedRect(rx, ry, rw, rh, 5);
			cartoucheGfx.lineStyle(1.2, COLORS.goldDeep, 0.8);
			cartoucheGfx.strokeRoundedRect(rx, ry, rw, rh, 5);

			const valueText = scene.add
				.text(
					rx + rw / 2,
					ry + rh / 2,
					`${Phaser.Math.Clamp(Math.round(stats[s]), 0, 10)}`,
					{
						fontFamily: FONT.title,
						fontSize: "14px",
						color: "#ffffff",
						fontStyle: "700",
					},
				)
				.setOrigin(0.5);
			valueText.setShadow(0, 1, "rgba(0, 0, 0, 0.9)", 2, false, true);

			// Liquid gauge meter graphics
			const meterGfx = scene.add.graphics();

			this.add([
				iconText,
				titleText,
				subText,
				cartoucheGfx,
				valueText,
				meterGfx,
			]);

			this.bars[s] = {
				x: px,
				cx,
				value: { v: stats[s] },
				meterGfx,
				dangerGfx,
				dangerTween,
				dangerEmitter,
				inDanger: false,
				valueText,
				cartoucheGfx,
			};

			this.draw(s);
		});

		scene.add.existing(this);
		this.setDepth(50);

		// Clean up emitters and tweens on destroy
		this.once(Phaser.GameObjects.Events.DESTROY, () => {
			this.activeChips.forEach((c) => c.destroy());
			this.activeChips.clear();
			STATS.forEach((s) => {
				const b = this.bars[s];
				if (b.dangerTween) {
					b.dangerTween.stop();
				}
				if (b.dangerEmitter) {
					b.dangerEmitter.stop();
				}
			});
		});
	}

	/** Draw the three-winged mounting plaque, metallic frames, hinge fasteners, and etched glass tracks. */
	private drawTriptychBase(g: Phaser.GameObjects.Graphics) {
		// Ambient mounting bar behind the reliquary wings
		g.fillStyle(0x0a0810, 0.72);
		g.fillRoundedRect(12, -45, W - 24, 90, 14);
		g.lineStyle(1, 0x473516, 0.45);
		g.strokeRoundedRect(12, -45, W - 24, 90, 14);

		// Central imperial pediment finial above Order reliquary
		g.fillStyle(COLORS.gold, 0.95);
		g.beginPath();
		g.moveTo(353, this.py);
		g.lineTo(360, this.py - 6);
		g.lineTo(367, this.py);
		g.closePath();
		g.fillPath();
		g.lineStyle(1, 0xfff6d0, 0.6);
		g.strokePath();
		g.fillCircle(360, this.py - 6, 1.8);

		// Hinge brackets connecting left-center and center-right wings
		for (const hx of [242.5, 477.5]) {
			g.fillStyle(0x1a140b, 0.95);
			g.fillRoundedRect(hx - 10, -6, 20, 12, 3);
			g.lineStyle(1.2, COLORS.goldDeep, 0.9);
			g.strokeRoundedRect(hx - 10, -6, 20, 12, 3);
			g.lineStyle(1, COLORS.gold, 0.6);
			g.lineBetween(hx - 8, -5, hx + 8, -5);
			// Central pivot knuckle
			g.fillStyle(COLORS.gold, 0.9);
			g.fillCircle(hx, 0, 2.5);
			g.fillStyle(0xffffff, 0.8);
			g.fillCircle(hx - 0.7, -0.7, 1);
			// Flanking rivet pins
			g.fillStyle(COLORS.goldDeep, 0.85);
			g.fillCircle(hx - 6, 0, 1.4);
			g.fillCircle(hx + 6, 0, 1.4);
		}

		// Individual reliquary wing housings
		STATS.forEach((s, i) => {
			const px = 16 + i * (this.pw + 17);
			const cx = px + this.pw / 2;
			const rel = RELIQUARIES[s];

			// Drop shadow
			g.fillStyle(0x000000, 0.5);
			g.fillRoundedRect(px - 1, this.py + 2, this.pw + 2, this.ph + 2, 11);

			// Outer dark bronze bezel
			g.fillStyle(COLORS.night, 0.9);
			g.fillRoundedRect(px, this.py, this.pw, this.ph, 10);

			// Outer metallic border
			g.lineStyle(1.5, COLORS.goldDeep, 0.85);
			g.strokeRoundedRect(px, this.py, this.pw, this.ph, 10);

			// Inner electrum highlight rim (3D bevel reflection)
			g.lineStyle(1, 0xfae082, 0.45);
			g.strokeRoundedRect(px + 1, this.py + 1, this.pw - 2, this.ph - 2, 9);

			// Recessed obsidian chamber
			g.fillStyle(COLORS.ink, 0.92);
			g.fillRoundedRect(px + 4, this.py + 4, this.pw - 8, this.ph - 8, 8);
			g.lineStyle(1, 0x271e11, 0.9);
			g.strokeRoundedRect(px + 4, this.py + 4, this.pw - 8, this.ph - 8, 8);

			// Corner rivet pins
			const cornerOffsets = [
				[8, 8],
				[this.pw - 8, 8],
				[8, this.ph - 8],
				[this.pw - 8, this.ph - 8],
			];
			for (const [ox, oy] of cornerOffsets) {
				g.fillStyle(COLORS.gold, 0.85);
				g.fillCircle(px + ox, this.py + oy, 2.2);
				g.fillStyle(0xffffff, 0.7);
				g.fillCircle(px + ox - 0.6, this.py + oy - 0.6, 0.9);
			}

			// Icon medallion disc background
			const discX = px + 22;
			const discY = this.py + 21;
			g.fillStyle(0x0c0914, 0.8);
			g.fillCircle(discX, discY, 11);
			g.lineStyle(1, rel.color, 0.7);
			g.strokeCircle(discX, discY, 11);

			// Bottom engraved baseline filigree
			const by = this.py + this.ph - 9;
			g.lineStyle(1, COLORS.goldDeep, 0.4);
			g.lineBetween(px + 24, by, cx - 12, by);
			g.lineBetween(cx + 12, by, px + this.pw - 24, by);
			g.fillStyle(COLORS.gold, 0.6);
			g.fillCircle(cx, by, 1.8);

			// Glass lumen track (meter trough)
			const gx = px + 12;
			const gy = this.gy;
			const gw = this.gw;
			const gh = this.gh;

			// Outer beveled frame of glass tube
			g.lineStyle(1.2, 0x3d2d14, 0.9);
			g.strokeRoundedRect(gx - 1, gy - 1, gw + 2, gh + 2, 8);

			// Deep recessed interior of tube
			g.fillStyle(0x07050d, 0.95);
			g.fillRoundedRect(gx, gy, gw, gh, 7);

			// Top specular glass glare line
			g.lineStyle(1, 0xffffff, 0.16);
			g.lineBetween(gx + 6, gy + 1, gx + gw - 6, gy + 1);

			// Graduated calibration ticks etched into the glass
			for (let k = 1; k <= 9; k++) {
				const tx = Math.round(gx + (k / 10) * gw);
				if (k === 5) {
					// Halfway major calibration mark
					g.lineStyle(1.2, COLORS.gold, 0.55);
					g.lineBetween(tx, gy + 3, tx, gy + gh - 3);
				} else {
					// Minor calibration marks
					g.lineStyle(1, 0x8f7850, 0.32);
					g.lineBetween(tx, gy + 5, tx, gy + gh - 5);
				}
			}

			// End notches at 0 and 10
			g.fillStyle(COLORS.goldDeep, 0.45);
			g.fillCircle(gx + 2, gy + gh / 2, 1.5);
			g.fillCircle(gx + gw - 2, gy + gh / 2, 1.5);
		});
	}

	/** Draw the danger crisis aura on a reliquary panel. */
	private drawDangerBezel(g: Phaser.GameObjects.Graphics, px: number) {
		g.lineStyle(2, COLORS.blood, 0.95);
		g.strokeRoundedRect(px - 1, this.py - 1, this.pw + 2, this.ph + 2, 11);
		g.fillStyle(COLORS.blood, 0.12);
		g.fillRoundedRect(px, this.py, this.pw, this.ph, 10);
		g.lineStyle(1, 0xff5555, 0.4);
		g.strokeRoundedRect(px + 3, this.py + 3, this.pw - 6, this.ph - 6, 8);
	}

	/** Draw the graduated mercury / liquid gold meter column and meniscus bead. */
	private draw(s: Stat) {
		const b = this.bars[s];
		const rel = RELIQUARIES[s];
		const px = b.x;
		const gx = px + 12;
		const gy = this.gy;
		const gw = this.gw;
		const gh = this.gh;

		b.meterGfx.clear();
		const w = Math.max(0, Math.min(gw, (b.value.v / 10) * gw));

		if (w > 0) {
			// Molten fluid base
			b.meterGfx.fillStyle(rel.fluidColor, 1);
			b.meterGfx.fillRoundedRect(gx, gy, w, gh, {
				tl: 7,
				bl: 7,
				tr: w >= gw - 3 ? 7 : 3,
				br: w >= gw - 3 ? 7 : 3,
			});

			// Lower fluid volume depth shadow
			b.meterGfx.fillStyle(0x000000, 0.28);
			b.meterGfx.fillRect(gx + 2, gy + gh - 4, Math.max(0, w - 4), 3);

			// Cylindrical glass sheen highlight (along top third of liquid)
			b.meterGfx.fillStyle(0xffffff, 0.3);
			b.meterGfx.fillRoundedRect(
				gx + 2,
				gy + 2,
				Math.max(0, w - 4),
				Math.floor(gh / 2) - 2,
				3,
			);

			// Graduated ticks visible through/over fluid
			for (let k = 1; k <= 9; k++) {
				const tx = Math.round(gx + (k / 10) * gw);
				if (tx < gx + w - 2) {
					const isMid = k === 5;
					b.meterGfx.lineStyle(1, 0x09070e, 0.35);
					b.meterGfx.lineBetween(
						tx,
						gy + (isMid ? 3 : 5),
						tx,
						gy + gh - (isMid ? 3 : 5),
					);
					b.meterGfx.lineStyle(1, 0xffffff, 0.15);
					b.meterGfx.lineBetween(
						tx + 1,
						gy + (isMid ? 3 : 5),
						tx + 1,
						gy + gh - (isMid ? 3 : 5),
					);
				}
			}

			// Luminous Meniscus Bead at the leading fluid surface
			if (w >= 4 && w <= gw) {
				const mx = gx + w - 3;
				const my = gy + gh / 2;
				b.meterGfx.fillStyle(rel.fluidGlow, 0.65);
				b.meterGfx.fillCircle(mx, my, 4);
				b.meterGfx.fillStyle(0xffffff, 0.95);
				b.meterGfx.fillCircle(mx, my, 2.2);
			}
		}

		// Danger state evaluation (<= 1.5)
		this.updateDangerState(s, b.value.v <= 1.5);
	}

	/** Manage danger aura pulse, ember particle emitter, and cartouche styling. */
	private updateDangerState(s: Stat, isDanger: boolean) {
		const b = this.bars[s];
		if (b.inDanger === isDanger) return;
		b.inDanger = isDanger;

		const rx = b.x + this.pw - 12 - 34;
		const ry = this.py + 11;
		const rw = 34;
		const rh = 20;

		b.cartoucheGfx.clear();
		if (isDanger) {
			b.dangerGfx.setVisible(true);
			if (b.dangerTween && !b.dangerTween.isPlaying()) {
				b.dangerTween.resume();
			}
			if (b.dangerEmitter && !settings.reducedMotion) {
				b.dangerEmitter.start();
			}
			// Danger crisis cartouche
			b.cartoucheGfx.fillStyle(0x220707, 0.92);
			b.cartoucheGfx.fillRoundedRect(rx, ry, rw, rh, 5);
			b.cartoucheGfx.lineStyle(1.5, COLORS.blood, 0.95);
			b.cartoucheGfx.strokeRoundedRect(rx, ry, rw, rh, 5);
			b.valueText.setColor(hex(COLORS.blood));
		} else {
			b.dangerGfx.setVisible(false);
			if (b.dangerTween?.isPlaying()) {
				b.dangerTween.pause();
			}
			if (b.dangerEmitter) {
				b.dangerEmitter.stop();
			}
			// Normal imperial cartouche
			b.cartoucheGfx.fillStyle(0x0c0a14, 0.85);
			b.cartoucheGfx.fillRoundedRect(rx, ry, rw, rh, 5);
			b.cartoucheGfx.lineStyle(1.2, COLORS.goldDeep, 0.8);
			b.cartoucheGfx.strokeRoundedRect(rx, ry, rw, rh, 5);
			b.valueText.setColor("#ffffff");
		}
	}

	/** Animate to new values with graduated fluid ease and ornate floating delta chips. */
	apply(next: Effects, delta: Effects) {
		STATS.forEach((s, i) => {
			const b = this.bars[s];
			const d = delta[s];
			const target = next[s];

			this.scene.time.delayedCall(i * 140, () => {
				if (d !== 0) audio.sfx(d > 0 ? "up" : "down");

				this.scene.tweens.killTweensOf(b.value);
				this.scene.tweens.add({
					targets: b.value,
					v: target,
					duration: settings.reducedMotion ? 200 : 700,
					ease: d > 0 ? "Back.out" : "Bounce.out",
					onUpdate: () => {
						this.draw(s);
						b.valueText.setText(
							`${Phaser.Math.Clamp(Math.round(b.value.v), 0, 10)}`,
						);
					},
					onComplete: () => {
						this.draw(s);
						b.valueText.setText(
							`${Phaser.Math.Clamp(Math.round(b.value.v), 0, 10)}`,
						);
					},
				});

				if (d !== 0) {
					this.spawnDeltaChip(b, d);
				}
			});
		});
	}

	/** Spawn an ornate imperial delta chip and impact flash. */
	private spawnDeltaChip(b: WingState, d: number) {
		const isPos = d > 0;
		const cw = 76;
		const ch = 32;
		const r = 8;

		// 1. Ornate floating seal chip
		const chip = this.scene.add.container(b.cx, this.y + 18).setDepth(65);
		this.activeChips.add(chip);

		const cg = this.scene.add.graphics();

		// Ambient drop shadow
		cg.fillStyle(0x000000, 0.6);
		cg.fillRoundedRect(-cw / 2, -ch / 2 + 2, cw, ch, r);

		// Lacquer body
		cg.fillStyle(isPos ? 0x1a1408 : 0x220707, 0.95);
		cg.fillRoundedRect(-cw / 2, -ch / 2, cw, ch, r);

		// Outer metallic border
		cg.lineStyle(1.5, isPos ? COLORS.gold : COLORS.blood, 0.95);
		cg.strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, r);

		// Inner highlight fillet
		cg.lineStyle(1, isPos ? 0xfff2b0 : 0xff7b7b, 0.45);
		cg.strokeRoundedRect(-cw / 2 + 2, -ch / 2 + 2, cw - 4, ch - 4, r - 2);

		// Flank jewel pips
		cg.fillStyle(isPos ? COLORS.gold : COLORS.blood, 0.9);
		cg.fillCircle(-cw / 2 + 8, 0, 2);
		cg.fillCircle(cw / 2 - 8, 0, 2);

		// Calligraphic delta text
		const label = this.scene.add
			.text(0, 0, `${isPos ? "+" : ""}${d}`, {
				fontFamily: FONT.title,
				fontSize: "21px",
				color: isPos ? "#fff6d9" : "#ff7b7b",
				fontStyle: "700",
			})
			.setOrigin(0.5);
		label.setShadow(
			0,
			1,
			isPos ? "rgba(224, 182, 74, 0.6)" : "rgba(0, 0, 0, 0.95)",
			3,
			false,
			true,
		);

		chip.add([cg, label]);

		// Pop and gentle drift animation
		chip.setScale(0.6).setAlpha(0);
		this.scene.tweens.add({
			targets: chip,
			y: this.y + 72,
			scale: { from: 0.65, to: 1.05 },
			alpha: { from: 1, to: 0 },
			duration: settings.reducedMotion ? 400 : 950,
			ease: "Cubic.out",
			onComplete: () => {
				this.activeChips.delete(chip);
				chip.destroy();
			},
		});

		// 2. Tube impact flash
		const flash = this.scene.add
			.rectangle(
				b.cx,
				this.y + this.gy + this.gh / 2,
				this.gw + 12,
				this.gh + 8,
				isPos ? 0xfff6cf : 0xff3b3b,
				0.65,
			)
			.setDepth(58);

		this.scene.tweens.add({
			targets: flash,
			alpha: 0,
			scaleX: 1.15,
			duration: 320,
			ease: "Quad.out",
			onComplete: () => flash.destroy(),
		});

		// 3. Ambient spark burst
		if (this.scene.textures.exists("spark") && !settings.reducedMotion) {
			const burst = this.scene.add.particles(b.cx, this.y + 20, "spark", {
				speed: { min: 35, max: 110 },
				scale: { start: 0.35, end: 0 },
				lifespan: 400,
				tint: isPos ? [COLORS.gold, 0xffffff] : [COLORS.blood, 0xff7777],
				quantity: 6,
				blendMode: Phaser.BlendModes.ADD,
			});
			this.scene.time.delayedCall(450, () => burst.destroy());
		}

		// 4. Subtle camera shake on impact
		if (!settings.reducedMotion) {
			this.scene.cameras.main.shake(120, d < 0 ? 0.004 : 0.002);
		}
	}

	/** Emit a fountain of gold coins arcing into the treasury gauge. */
	emitCoinRain(fromX: number, fromY: number, count = 10) {
		const targetX = this.bars.gold ? this.bars.gold.cx : W / 4;
		const targetY = this.y + 20;

		for (let i = 0; i < count; i++) {
			this.scene.time.delayedCall(i * 45, () => {
				const coin = this.scene.add.graphics();
				coin.fillStyle(0x000000, 0.4);
				coin.fillCircle(0, 1.5, 9);
				coin.fillStyle(COLORS.gold, 1);
				coin.fillCircle(0, 0, 9);
				coin.lineStyle(1.5, 0xfff0b8, 0.9);
				coin.strokeCircle(0, 0, 9);
				coin.fillStyle(COLORS.goldDeep, 0.9);
				coin.fillCircle(0, 0, 5);

				coin.setPosition(fromX + (Math.random() - 0.5) * 40, fromY);
				coin.setDepth(65);

				const peakY = Math.min(fromY, targetY) - 90 - Math.random() * 50;

				this.scene.tweens.add({
					targets: coin,
					props: {
						x: {
							value: targetX,
							ease: (t: number) => {
								// Parabolic trajectory towards target
								return t * t;
							},
						},
						y: {
							value: targetY,
							ease: (t: number) => {
								// Arc through peak
								return t < 0.5
									? Phaser.Math.Linear(fromY, peakY, t * 2)
									: Phaser.Math.Linear(peakY, targetY, (t - 0.5) * 2);
							},
						},
						scale: { from: 1.1, to: 0.75 },
					},
					duration: 550 + Math.random() * 80,
					onComplete: () => {
						if (i % 3 === 0) audio.sfx("coin");
						coin.destroy();
					},
				});
			});
		}
	}
}
