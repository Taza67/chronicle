import Phaser from "phaser";
import { LEADERS } from "../content/leaders.ts";
import { audio } from "../core/audio.ts";
import { playTitleMusic } from "../core/music.ts";
import { loadGame, reigns, settings, takeSaveLost } from "../core/state.ts";
import {
	CANVAS_W,
	COL_X,
	COLORS,
	CX,
	FONT,
	H,
	hex,
	LANDSCAPE,
	SAFE_BOTTOM,
	SAFE_TOP,
	W,
} from "../ui/theme.ts";
import {
	Button,
	fadeIn,
	go,
	iconButton,
	motion,
	toast,
} from "../ui/widgets.ts";

export class TitleScene extends Phaser.Scene {
	constructor() {
		super("Title");
	}

	create() {
		fadeIn(this, 800);

		// 1. Living archive backdrop with gentle slow cinematic drift
		const bg = this.add.image(CX, H / 2, "title_bg");
		bg.setScale(Math.max(W / bg.width, H / bg.height) * 1.1).setAlpha(0.52);
		this.tweens.add({
			targets: bg,
			x: CX + 18,
			y: H / 2 - 12,
			duration: 14000,
			yoyo: true,
			repeat: -1,
			ease: "Sine.inOut",
		});
		this.add.image(CX, H / 2, "vignette").setDisplaySize(CANVAS_W, H);

		// 2. Atmospheric Golden Archive Embers & Ambient Dust
		this.createArchiveAtmosphere();

		// 3. Leaders awakening sequence with radiant halos and archival depth
		this.createLeadersAwakening();

		// 4. Logo, imperial crest divider & tagline presentation
		this.createLogoPresentation();

		// 5. Harmonized button layout & prestigious typography
		this.createButtonLayout();

		// 6. Audio unlock & music trigger on first interaction
		this.input.once("pointerdown", () => {
			audio.unlock();
			playTitleMusic();
		});
	}

	/** Dual-layered floating archive embers and luminous micro-motes. */
	private createArchiveAtmosphere() {
		// Soft warm ambient archive light glow behind the leader council
		const archiveBackglow = this.add.graphics();
		archiveBackglow.fillStyle(COLORS.goldDeep, 0.12);
		archiveBackglow.fillEllipse(CX, H * 0.505, 620, 240);
		archiveBackglow.fillStyle(0xffe299, 0.06);
		archiveBackglow.fillEllipse(CX, H * 0.505, 380, 150);
		archiveBackglow.setBlendMode(Phaser.BlendModes.ADD);
		archiveBackglow.setDepth(1);

		// Emitter 1: Delicate floating archive gold dust (micro-motes)
		const dust = this.add.particles(0, 0, "spark", {
			x: { min: 0, max: CANVAS_W },
			y: { min: 0, max: H },
			lifespan: { min: 7500, max: 13000 },
			speedX: { min: -10, max: 10 },
			speedY: { min: -7, max: -20 },
			scale: { min: 0.1, max: 0.22 },
			alpha: { start: 0.05, end: 0.45, ease: "Sine.inOut" },
			tint: [COLORS.gold, 0xd9c79a, 0xb9ad91, 0xffe6a3],
			blendMode: Phaser.BlendModes.ADD,
			frequency: settings.reducedMotion ? 400 : 90,
		});
		dust.setDepth(2);

		// Pre-populate dust across the screen so the archive is instantly alive
		if (!settings.reducedMotion) {
			for (let i = 0; i < 28; i++) {
				dust.emitParticleAt(
					Phaser.Math.Between(20, CANVAS_W - 20),
					Phaser.Math.Between(40, H - 40),
				);
			}
		}

		// Emitter 2: Luminous rising archive embers (warm ascending sparks)
		const embers = this.add.particles(0, 0, "spark", {
			x: { min: 30, max: CANVAS_W - 30 },
			y: { min: H * 0.38, max: H * 0.96 },
			lifespan: { min: 4200, max: 7200 },
			speedX: { min: -15, max: 15 },
			speedY: { min: -18, max: -42 },
			scale: { start: 0.36, end: 0.04 },
			alpha: { start: 0.85, end: 0, ease: "Quad.out" },
			tint: [0xffffff, 0xffe89e, COLORS.gold, 0xf0b830],
			blendMode: Phaser.BlendModes.ADD,
			frequency: settings.reducedMotion ? 500 : 160,
		});
		embers.setDepth(2);

		if (!settings.reducedMotion) {
			for (let i = 0; i < 16; i++) {
				embers.emitParticleAt(
					Phaser.Math.Between(40, CANVAS_W - 40),
					Phaser.Math.Between(Math.round(H * 0.45), Math.round(H * 0.9)),
				);
			}
		}
	}

	/** Council of sovereign leaders awakening with celestial halos and depth highlights. */
	private createLeadersAwakening() {
		const n = LEADERS.length;
		// The 810-tall landscape canvas can't fit the portrait layout at
		// full size — compact the council fan and lift it off the buttons.
		const fanScale = LANDSCAPE ? 0.6 : 1;
		const fanY = LANDSCAPE ? 0.44 : 0.505;

		// Soft archival mist/plinth feathering the bottom edge of the leaders —
		// a smooth gradient into night, no hard band across the backdrop.
		const plinthGlow = this.add.graphics();
		plinthGlow.setDepth(7);
		const mistY = H * fanY + 68 * fanScale;
		plinthGlow.fillGradientStyle(
			COLORS.night,
			COLORS.night,
			COLORS.night,
			COLORS.night,
			0,
			0,
			0.85,
			0.85,
		);
		plinthGlow.fillRect(0, mistY, CANVAS_W, 48);
		plinthGlow.fillStyle(COLORS.night, 0.85);
		plinthGlow.fillRect(0, mistY + 48, CANVAS_W, H - mistY - 48);

		LEADERS.forEach((l, i) => {
			const dist = Math.abs(i - 2); // 0 at center (Akbar), 1 mid, 2 outer
			const x = CX + (i - (n - 1) / 2) * 128 * fanScale;
			const targetY = H * fanY + dist * 20 * fanScale;
			const baseScale = (0.272 - dist * 0.014) * fanScale;

			// Ethereal golden halo disk behind each leader
			const halo = this.add.graphics();
			halo.setDepth(3 - dist);
			const haloRadius = (dist === 0 ? 112 : dist === 1 ? 94 : 80) * fanScale;
			const accentCol = Phaser.Display.Color.HexStringToColor(
				l.palette.accent ?? "#e0b64a",
			).color;

			// Multi-stop radial aura
			halo.fillStyle(accentCol, 0.16);
			halo.fillCircle(0, 0, haloRadius * 1.3);
			halo.fillStyle(COLORS.gold, 0.28);
			halo.fillCircle(0, 0, haloRadius * 0.88);
			halo.fillStyle(0xfff6d4, 0.22);
			halo.fillCircle(0, 0, haloRadius * 0.46);

			halo.setPosition(x, targetY);
			halo.setScale(0.65);
			halo.setAlpha(0);
			halo.setBlendMode(Phaser.BlendModes.ADD);

			// Leader portrait image
			const img = this.add
				.image(x, targetY + 28, `${l.id}/leader`)
				.setScale(baseScale * 0.94)
				.setAlpha(0);
			img.setDepth(6 - dist);

			// Deep shadowed antique silhouette tint at initial emergence
			const startCol = new Phaser.Display.Color(18, 16, 26);
			img.setTint(startCol.color);

			// Rising entrance animation
			this.tweens.add({
				targets: img,
				alpha: dist === 2 ? 0.9 : 1,
				y: targetY,
				scale: baseScale,
				duration: 950 * motion(),
				delay: (360 + dist * 150 + (i > 2 ? 40 : 0)) * motion(),
				ease: "Cubic.out",
				onComplete: () => {
					if (!settings.reducedMotion) {
						// Subtle staggered floating bob
						this.tweens.add({
							targets: img,
							y: targetY - (6 + (2 - dist) * 2),
							duration: 2300 + dist * 250 + i * 90,
							yoyo: true,
							repeat: -1,
							ease: "Sine.inOut",
						});
					}
				},
			});

			// Awakening delay: center awakens first with regal majesty, followed by flanks
			const awakeningDelay = (1150 + dist * 260 + i * 35) * motion();
			const awakeningDuration = 1350 * motion();

			// Halo bloom animation synchronized with portrait awakening
			this.tweens.add({
				targets: halo,
				alpha: dist === 0 ? 0.82 : dist === 1 ? 0.62 : 0.45,
				scale: 1,
				duration: awakeningDuration,
				delay: awakeningDelay,
				ease: "Sine.out",
				onComplete: () => {
					if (!settings.reducedMotion) {
						// Gentle living pulse on the halo
						this.tweens.add({
							targets: halo,
							y: targetY - (6 + (2 - dist) * 2),
							alpha: {
								from: halo.alpha,
								to: halo.alpha * 0.76,
							},
							scale: { from: 1, to: 1.05 },
							duration: 2300 + dist * 250 + i * 90,
							yoyo: true,
							repeat: -1,
							ease: "Sine.inOut",
						});
					}
				},
			});

			// Color reveal tween from dark silhouette to brilliant sovereign portrait
			const targetCol =
				dist === 0
					? new Phaser.Display.Color(255, 255, 255)
					: dist === 1
						? new Phaser.Display.Color(246, 242, 234)
						: new Phaser.Display.Color(226, 220, 210);

			this.tweens.addCounter({
				from: 0,
				to: 1,
				delay: awakeningDelay,
				duration: awakeningDuration,
				ease: "Sine.inOut",
				onUpdate: (tw) => {
					const v = tw.getValue() ?? 0;
					const c = Phaser.Display.Color.Interpolate.ColorWithColor(
						startCol,
						targetCol,
						1,
						v,
					);
					img.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
				},
				onComplete: () => {
					// Specular awakening glint at crown of leader
					if (!settings.reducedMotion) {
						const glint = this.add
							.image(x, targetY - 62, "spark")
							.setScale(0.15)
							.setAlpha(0)
							.setTint(COLORS.gold)
							.setBlendMode(Phaser.BlendModes.ADD)
							.setDepth(8);
						this.tweens.add({
							targets: glint,
							alpha: { from: 0, to: 0.9, yoyo: true },
							scale: { from: 0.15, to: 0.65 },
							duration: 650,
							ease: "Sine.inOut",
							onComplete: () => glint.destroy(),
						});
					}
				},
			});
		});
	}

	/** Refined CHRONICLE logo with ambient gold aura, Cormorant tagline, and imperial crest divider. */
	private createLogoPresentation() {
		const logoY = H * 0.205;

		// Ambient golden backlight aura behind logo
		const logoGlow = this.add.graphics();
		logoGlow.fillStyle(COLORS.gold, 0.14);
		logoGlow.fillCircle(0, 0, 160);
		logoGlow.fillStyle(0xfff0c2, 0.08);
		logoGlow.fillCircle(0, 0, 240);
		logoGlow.setScale(1.75, 0.42);
		logoGlow.setPosition(CX, logoY);
		logoGlow.setBlendMode(Phaser.BlendModes.ADD);
		logoGlow.setAlpha(0);
		this.tweens.add({
			targets: logoGlow,
			alpha: 1,
			duration: 1200 * motion(),
			delay: 200,
			ease: "Cubic.out",
		});

		// CHRONICLE primary title
		const logo = this.add
			.text(CX, logoY, "CHRONICLE", {
				fontFamily: FONT.title,
				fontSize: "76px",
				color: hex(COLORS.gold),
				fontStyle: "900",
			})
			.setOrigin(0.5)
			.setAlpha(0);
		logo.setLetterSpacing(12);
		logo.setShadow(0, 6, "#000000", 20, false, true);

		this.tweens.add({
			targets: logo,
			alpha: 1,
			scale: { from: 1.22, to: 1 },
			duration: 1100 * motion(),
			ease: "Cubic.out",
			delay: 200,
		});

		// Gold shimmer sweep over the logo with multi-stop sheen
		const sweep = this.add.graphics();
		sweep.fillStyle(COLORS.gold, 0.25);
		sweep.fillRect(-45, -75, 90, 150);
		sweep.fillStyle(0xfff3cc, 0.45);
		sweep.fillRect(-22, -75, 44, 150);
		sweep.fillStyle(0xffffff, 0.7);
		sweep.fillRect(-8, -75, 16, 150);
		sweep.setBlendMode(Phaser.BlendModes.ADD);
		sweep.setAngle(20);
		sweep.setPosition(CX - 340, logoY);
		sweep.setMask(logo.createBitmapMask());
		this.tweens.add({
			targets: sweep,
			x: CX + 340,
			duration: 1350 * motion(),
			repeat: -1,
			repeatDelay: 3200,
			delay: 1500 * motion(),
			ease: "Cubic.inOut",
		});

		// Tagline in elegant Cormorant Garamond
		const tagY = logoY + 70;
		const tag = this.add
			.text(CX, tagY, "Rule as they did. Or don't.", {
				fontFamily: FONT.body,
				fontSize: "26px",
				color: hex(COLORS.parchment),
				fontStyle: "italic",
				align: "center",
			})
			.setOrigin(0.5)
			.setAlpha(0);
		tag.setLetterSpacing(2);
		tag.setShadow(0, 2, "rgba(0, 0, 0, 0.85)", 6, false, true);

		this.tweens.add({
			targets: tag,
			alpha: 0.95,
			y: { from: tagY + 12, to: tagY },
			duration: 850 * motion(),
			delay: 950 * motion(),
			ease: "Cubic.out",
		});

		// Imperial Ornamental Crest / Divider (✦ ❖ ✦) beneath tagline
		const crestY = tagY + 42;
		const crestContainer = this.add.container(CX, crestY);
		crestContainer.setAlpha(0);
		crestContainer.setScale(0.85, 1);

		const crestGfx = this.add.graphics();

		// Symmetrical ornamental filigree hairlines extending left & right
		// Left wing
		crestGfx.lineStyle(1.5, COLORS.gold, 0.85);
		crestGfx.lineBetween(-64, 0, -170, 0);
		crestGfx.lineStyle(1, COLORS.goldDeep, 0.45);
		crestGfx.lineBetween(-170, 0, -220, 0);

		// Left diamond flourish accent & terminal pearl
		crestGfx.fillStyle(COLORS.gold, 0.95);
		crestGfx.fillPoints(
			[
				{ x: -128, y: -3.5 },
				{ x: -124.5, y: 0 },
				{ x: -128, y: 3.5 },
				{ x: -131.5, y: 0 },
			],
			true,
		);
		crestGfx.fillCircle(-222, 0, 1.6);

		// Right wing
		crestGfx.lineStyle(1.5, COLORS.gold, 0.85);
		crestGfx.lineBetween(64, 0, 170, 0);
		crestGfx.lineStyle(1, COLORS.goldDeep, 0.45);
		crestGfx.lineBetween(170, 0, 220, 0);

		// Right diamond flourish accent & terminal pearl
		crestGfx.fillStyle(COLORS.gold, 0.95);
		crestGfx.fillPoints(
			[
				{ x: 128, y: -3.5 },
				{ x: 131.5, y: 0 },
				{ x: 128, y: 3.5 },
				{ x: 124.5, y: 0 },
			],
			true,
		);
		crestGfx.fillCircle(222, 0, 1.6);

		// Central imperial emblem: ✦ ❖ ✦
		const emblemCenter = this.add
			.text(0, -1, "❖", {
				fontFamily: FONT.title,
				fontSize: "19px",
				color: hex(COLORS.gold),
				fontStyle: "700",
			})
			.setOrigin(0.5);
		emblemCenter.setShadow(0, 0, hex(COLORS.goldDeep), 8, false, true);

		const emblemLeftStar = this.add
			.text(-28, 0, "✦", {
				fontFamily: FONT.title,
				fontSize: "13px",
				color: hex(COLORS.gold),
			})
			.setOrigin(0.5);
		emblemLeftStar.setShadow(0, 0, hex(COLORS.goldDeep), 6, false, true);

		const emblemRightStar = this.add
			.text(28, 0, "✦", {
				fontFamily: FONT.title,
				fontSize: "13px",
				color: hex(COLORS.gold),
			})
			.setOrigin(0.5);
		emblemRightStar.setShadow(0, 0, hex(COLORS.goldDeep), 6, false, true);

		crestContainer.add([
			crestGfx,
			emblemCenter,
			emblemLeftStar,
			emblemRightStar,
		]);

		this.tweens.add({
			targets: crestContainer,
			alpha: 1,
			scaleX: 1,
			duration: 850 * motion(),
			delay: 1150 * motion(),
			ease: "Cubic.out",
			onComplete: () => {
				if (!settings.reducedMotion) {
					// Gentle breathing shimmer on imperial crest
					this.tweens.add({
						targets: crestContainer,
						alpha: { from: 1, to: 0.8 },
						duration: 2600,
						yoyo: true,
						repeat: -1,
						ease: "Sine.inOut",
					});
				}
			},
		});
	}

	/** Harmonized button layout with architectural symmetry, icon accents, and prestigious typography. */
	private createButtonLayout() {
		const save = loadGame();
		const lost = takeSaveLost();
		if (lost) {
			this.time.delayedCall(900, () =>
				toast(
					this,
					`The chronicle of ${lost} was lost — the summoned art faded from this device's archive.`,
					COLORS.blood,
				),
			);
		}
		const buttonBaseDelay = 800;

		if (save) {
			// Stack for resuming existing reign: Continue, New Reign, Codex / Chronicle
			const yRow = H - SAFE_BOTTOM - 130;
			const yNew = yRow - 96;
			const yContinue = yNew - 96;

			const btnContinue = new Button(
				this,
				CX,
				yContinue,
				`✦  Continue: ${save.leader.name}`,
				() => this.start("Court", { resume: true }),
				{ w: 500, h: 84, size: 25, letterSpacing: 2 },
			);
			this.enterButton(btnContinue, yContinue, buttonBaseDelay);

			const btnNew = new Button(
				this,
				CX,
				yNew,
				"⚔  New Reign",
				() => this.start("Select"),
				{ w: 500, h: 76, primary: false, size: 23, letterSpacing: 2 },
			);
			this.enterButton(btnNew, yNew, buttonBaseDelay + 120);

			this.createSecondaryRow(yRow, buttonBaseDelay + 240);
		} else {
			// Stack for fresh game: Begin Your Reign + Codex / Chronicle
			const yRow = H - SAFE_BOTTOM - 150;
			const yBegin = yRow - 115;

			const btnBegin = new Button(
				this,
				CX,
				yBegin,
				"✦  Begin Your Reign",
				() => this.start("Select"),
				{ w: 500, h: 88, size: 26, letterSpacing: 3 },
			);
			this.enterButton(btnBegin, yBegin, buttonBaseDelay, () => {
				if (!settings.reducedMotion) {
					this.tweens.add({
						targets: btnBegin,
						scale: 1.025,
						duration: 950,
						yoyo: true,
						repeat: -1,
						ease: "Sine.inOut",
					});
				}
			});

			this.createSecondaryRow(yRow, buttonBaseDelay + 140);
		}

		// Top right settings gear
		const settingsBtn = iconButton(
			this,
			COL_X + W - 60,
			SAFE_TOP + 16,
			"⚙",
			() => this.start("Settings", { back: "Title" }),
		);
		settingsBtn.setAlpha(0).setScale(0.8);
		this.tweens.add({
			targets: settingsBtn,
			alpha: 1,
			scale: 1,
			duration: 450 * motion(),
			delay: 1050 * motion(),
			ease: "Back.out",
		});

		// Prestigious imperial footer inscription
		const footer = this.add
			.text(
				CX,
				H - SAFE_BOTTOM + 16,
				"✦  GEMINI  ·  GRADIUM  ·  LYRIA  ·  PHASER  ✦",
				{
					fontFamily: FONT.title,
					fontSize: "13px",
					color: hex(COLORS.muted),
					letterSpacing: 3,
					fontStyle: "600",
				},
			)
			.setOrigin(0.5)
			.setAlpha(0);
		this.tweens.add({
			targets: footer,
			alpha: 0.75,
			duration: 600 * motion(),
			delay: 1200 * motion(),
		});
	}

	/** Secondary action row: Codex and Chronicle matching the 500px width of the primary stack. */
	private createSecondaryRow(y: number, baseDelay: number) {
		const row = [
			{
				label: "◆  Codex",
				scene: "Codex",
			},
			{
				label: reigns.length
					? `★  Chronicle (${reigns.length})`
					: "★  Chronicle",
				scene: "Chronicle",
			},
		] as const;

		// 2 buttons of width 240 with 20px gap: total 500px, symmetrically spanning 110 to 610
		row.forEach((item, i) => {
			const x = CX + (i - 0.5) * 260;
			const btn = new Button(
				this,
				x,
				y,
				item.label,
				() => this.start(item.scene),
				{ w: 240, h: 70, primary: false, size: 21, letterSpacing: 2 },
			);
			this.enterButton(btn, y, baseDelay + i * 100);
		});
	}

	private enterButton(
		btn: Phaser.GameObjects.Container,
		targetY: number,
		delayMs: number,
		onComplete?: () => void,
	) {
		btn.setAlpha(0);
		btn.setY(targetY + 28);
		this.tweens.add({
			targets: btn,
			alpha: 1,
			y: targetY,
			duration: 550 * motion(),
			delay: delayMs * motion(),
			ease: "Cubic.out",
			onComplete: () => {
				onComplete?.();
			},
		});
	}

	private start(key: string, data?: object) {
		audio.unlock();
		go(this, key, data);
	}
}
