import Phaser from "phaser";
import { audio } from "../core/audio.ts";
import { settings } from "../core/state.ts";
import { COLORS, FONT, H, hex, title, W } from "./theme.ts";

type OracleSfx =
	| "oracle_open"
	| "coin_toss"
	| "coin_land"
	| "coin"
	| "card"
	| "whoosh"
	| "chime"
	| "fail"
	| "tap";

/** Safe audio invocation helper matching BootScene & audio.ts contracts */
function playSfx(
	name: OracleSfx,
	fallback?: "coin" | "card" | "whoosh" | "chime" | "fail" | "tap",
) {
	try {
		const sfxFn = audio.sfx as unknown as (sound: string) => void;
		sfxFn(name);
	} catch {
		if (fallback) audio.sfx(fallback);
	}
}

/** Ensure procedural textures exist if BootScene hasn't initialized them */
function ensureOracleTextures(scene: Phaser.Scene) {
	if (!scene.textures.exists("coin_edge")) {
		const c = scene.textures.createCanvas("coin_edge", 28, 256);
		if (c) {
			const ctx = c.getContext();
			const g = ctx.createLinearGradient(0, 0, 28, 0);
			g.addColorStop(0, "#3d280a");
			g.addColorStop(0.2, "#8a6520");
			g.addColorStop(0.5, "#ffe599");
			g.addColorStop(0.8, "#c69632");
			g.addColorStop(1, "#48320b");
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, 28, 256);
			for (let y = 6; y < 250; y += 6) {
				ctx.fillStyle = "rgba(40, 25, 5, 0.55)";
				ctx.fillRect(0, y, 28, 2);
				ctx.fillStyle = "rgba(255, 245, 200, 0.45)";
				ctx.fillRect(0, y + 2, 28, 1);
			}
			c.refresh();
		}
	}
	if (!scene.textures.exists("coin_shine")) {
		const c = scene.textures.createCanvas("coin_shine", 256, 256);
		if (c) {
			const ctx = c.getContext();
			const g = ctx.createLinearGradient(30, 0, 226, 256);
			g.addColorStop(0, "rgba(255, 255, 255, 0)");
			g.addColorStop(0.42, "rgba(255, 255, 255, 0.08)");
			g.addColorStop(0.5, "rgba(255, 255, 255, 0.75)");
			g.addColorStop(0.58, "rgba(255, 255, 255, 0.08)");
			g.addColorStop(1, "rgba(255, 255, 255, 0)");
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.arc(128, 128, 122, 0, Math.PI * 2);
			ctx.fill();
			c.refresh();
		}
	}
}

/**
 * The Oracle of Chronicles: A museum-grade sacred ritual.
 * Features an ancient concentric brass armillary astrolabe, a dark velvet plinth altar,
 * obsidian & midnight wager steles, and full pseudo-3D coin tumbling physics.
 */
export class Oracle extends Phaser.GameObjects.Container {
	private coinContainer: Phaser.GameObjects.Container;
	private coinFace: Phaser.GameObjects.Image;
	private coinEdge: Phaser.GameObjects.Image;
	private coinShine: Phaser.GameObjects.Image;
	private shadow: Phaser.GameObjects.Ellipse;

	private astrolabe: Phaser.GameObjects.Container;
	private ringOuter: Phaser.GameObjects.Graphics;
	private ringMid: Phaser.GameObjects.Graphics;
	private ringInner: Phaser.GameObjects.Graphics;

	private prompt: Phaser.GameObjects.Text;
	private verdictText?: Phaser.GameObjects.Text;
	private tablets: Phaser.GameObjects.Container[] = [];

	private locked = false;
	private playerBetHistorical = true;

	private idleLevitation?: Phaser.Tweens.Tween;
	private idleWobble?: Phaser.Tweens.Tween;
	private idleShadow?: Phaser.Tweens.Tween;
	private idleShineTimer?: Phaser.Time.TimerEvent;

	constructor(
		scene: Phaser.Scene,
		combo: number,
		onBet: (betHistorical: boolean) => void,
	) {
		super(scene, 0, 0);

		ensureOracleTextures(scene);

		const cx = W / 2;
		const astrolabeY = H * 0.35;
		const plinthY = H * 0.44;

		// --- 1. Temple Atmosphere & Mystical Veil ---
		const shade = scene.add
			.rectangle(cx, H / 2, W, H, COLORS.night, 0.96)
			.setInteractive();

		const vignette = scene.add
			.image(cx, H / 2, "vignette")
			.setDisplaySize(W, H)
			.setAlpha(0.68)
			.setDepth(1);

		// Torchlight ambient sanctuary glow
		const torchGlow = scene.add
			.image(cx, astrolabeY, "spark")
			.setScale(26)
			.setTint(0xffbe4d)
			.setAlpha(0.14)
			.setBlendMode(Phaser.BlendModes.ADD);

		scene.tweens.add({
			targets: torchGlow,
			scale: { from: 24, to: 28 },
			alpha: { from: 0.1, to: 0.18 },
			yoyo: true,
			repeat: -1,
			duration: 2600,
			ease: "Sine.inOut",
		});

		// Slowly drifting golden torchlight dust motes
		const motes: Phaser.GameObjects.Arc[] = [];
		const moteColors = [COLORS.gold, 0xffdf80, 0xefc464, 0xfff3d1];
		for (let i = 0; i < 22; i++) {
			const mx = Phaser.Math.Between(40, W - 40);
			const my = Phaser.Math.Between(H * 0.12, H * 0.85);
			const mr = Phaser.Math.FloatBetween(1.2, 2.8);
			const mCol = Phaser.Utils.Array.GetRandom(moteColors) as number;
			const mote = scene.add.circle(
				mx,
				my,
				mr,
				mCol,
				Phaser.Math.FloatBetween(0.15, 0.4),
			);
			mote.setBlendMode(Phaser.BlendModes.ADD);
			motes.push(mote);

			scene.tweens.add({
				targets: mote,
				y: `-=${Phaser.Math.Between(80, 160)}`,
				duration: Phaser.Math.Between(3500, 6500),
				repeat: -1,
				ease: "Linear",
				onRepeat: () => {
					mote.y = my + Phaser.Math.Between(20, 60);
					mote.x = Phaser.Math.Between(40, W - 40);
				},
			});

			scene.tweens.add({
				targets: mote,
				x: `+=${Phaser.Math.Between(-18, 18)}`,
				duration: Phaser.Math.Between(1800, 3200),
				yoyo: true,
				repeat: -1,
				ease: "Sine.inOut",
			});
		}

		// --- 2. Ancient Armillary Astrolabe ---
		this.astrolabe = scene.add.container(cx, astrolabeY);

		// Outer Ring: 36 astronomical ticks & gear teeth
		this.ringOuter = scene.add.graphics();
		this.ringOuter.lineStyle(2, COLORS.goldDeep, 0.5);
		this.ringOuter.strokeCircle(0, 0, 166);
		this.ringOuter.lineStyle(1, COLORS.gold, 0.35);
		this.ringOuter.strokeCircle(0, 0, 158);

		for (let i = 0; i < 36; i++) {
			const a = (i * Math.PI * 2) / 36;
			const isMajor = i % 3 === 0;
			const r1 = isMajor ? 148 : 154;
			const r2 = 166;
			this.ringOuter.lineStyle(
				isMajor ? 1.8 : 1,
				COLORS.gold,
				isMajor ? 0.75 : 0.35,
			);
			this.ringOuter.lineBetween(
				Math.cos(a) * r1,
				Math.sin(a) * r1,
				Math.cos(a) * r2,
				Math.sin(a) * r2,
			);

			// Outer gear tooth tab
			const toothA1 = a - 0.025;
			const toothA2 = a + 0.025;
			this.ringOuter.lineStyle(1.5, COLORS.goldDeep, 0.45);
			this.ringOuter.lineBetween(
				Math.cos(toothA1) * 166,
				Math.sin(toothA1) * 166,
				Math.cos(toothA1) * 172,
				Math.sin(toothA1) * 172,
			);
			this.ringOuter.lineBetween(
				Math.cos(toothA1) * 172,
				Math.sin(toothA1) * 172,
				Math.cos(toothA2) * 172,
				Math.sin(toothA2) * 172,
			);
			this.ringOuter.lineBetween(
				Math.cos(toothA2) * 172,
				Math.sin(toothA2) * 172,
				Math.cos(toothA2) * 166,
				Math.sin(toothA2) * 166,
			);
		}

		// Middle Ring: 12 Celestial Zodiac nodes & star pips
		this.ringMid = scene.add.graphics();
		this.ringMid.lineStyle(1.5, COLORS.sky, 0.45);
		this.ringMid.strokeCircle(0, 0, 122);

		for (let i = 0; i < 12; i++) {
			const a = (i * Math.PI * 2) / 12;
			const px = Math.cos(a) * 122;
			const py = Math.sin(a) * 122;
			this.ringMid.fillStyle(COLORS.sky, 0.85);
			this.ringMid.fillCircle(px, py, 3);
			this.ringMid.lineStyle(1, COLORS.gold, 0.5);
			this.ringMid.strokeCircle(px, py, 6);

			// Chords linking zodiac triads
			const nextA = ((i + 4) * Math.PI * 2) / 12;
			this.ringMid.lineStyle(0.8, COLORS.sky, 0.15);
			this.ringMid.lineBetween(
				px,
				py,
				Math.cos(nextA) * 122,
				Math.sin(nextA) * 122,
			);
		}

		// Inner Meridian Ring: Sighting crossbar & reticle
		this.ringInner = scene.add.graphics();
		this.ringInner.lineStyle(2, COLORS.gold, 0.55);
		this.ringInner.strokeCircle(0, 0, 80);
		this.ringInner.lineStyle(1, COLORS.goldDeep, 0.4);
		this.ringInner.lineBetween(-80, 0, 80, 0);
		this.ringInner.lineBetween(0, -80, 0, 80);

		for (let i = 0; i < 8; i++) {
			const a = (i * Math.PI * 2) / 8;
			this.ringInner.fillStyle(COLORS.gold, 0.9);
			this.ringInner.fillCircle(Math.cos(a) * 80, Math.sin(a) * 80, 2.5);
		}

		// Central diamond reticle
		this.ringInner.fillStyle(COLORS.goldDeep, 0.8);
		this.ringInner.beginPath();
		this.ringInner.moveTo(0, -8);
		this.ringInner.lineTo(8, 0);
		this.ringInner.lineTo(0, 8);
		this.ringInner.lineTo(-8, 0);
		this.ringInner.closePath();
		this.ringInner.fill();

		this.astrolabe.add([this.ringOuter, this.ringMid, this.ringInner]);

		// Realistic astronomical continuous rotation
		scene.tweens.add({
			targets: this.ringOuter,
			angle: -360,
			duration: 72000,
			repeat: -1,
			ease: "Linear",
		});
		scene.tweens.add({
			targets: this.ringMid,
			angle: 360,
			duration: 48000,
			repeat: -1,
			ease: "Linear",
		});
		scene.tweens.add({
			targets: this.ringInner,
			angle: -360,
			duration: 32000,
			repeat: -1,
			ease: "Linear",
		});

		// --- 3. Carved Stone & Velvet Plinth Altar ---
		const altar = scene.add.graphics();

		// Tier 1: Foundation obsidian slate
		altar.fillStyle(0x0c0a14, 0.95);
		altar.fillRoundedRect(cx - 160, plinthY + 16, 320, 24, 8);
		altar.lineStyle(1.5, COLORS.goldDeep, 0.55);
		altar.strokeRoundedRect(cx - 160, plinthY + 16, 320, 24, 8);

		// Tier 2: Carved granite frieze with antique gold inlay
		altar.fillStyle(0x151122, 0.92);
		altar.fillRoundedRect(cx - 130, plinthY + 2, 260, 18, 6);
		altar.lineStyle(1.5, COLORS.goldDeep, 0.7);
		altar.strokeRoundedRect(cx - 130, plinthY + 2, 260, 18, 6);

		// Filigree diamond pattern across the frieze
		altar.lineStyle(1, COLORS.gold, 0.4);
		for (let fx = cx - 110; fx <= cx + 110; fx += 22) {
			altar.beginPath();
			altar.moveTo(fx, plinthY + 11);
			altar.lineTo(fx + 6, plinthY + 7);
			altar.lineTo(fx + 12, plinthY + 11);
			altar.lineTo(fx + 6, plinthY + 15);
			altar.closePath();
			altar.stroke();
		}

		// Tier 3: Dark Velvet Cushion Plinth
		altar.fillStyle(0x13071d, 0.98);
		altar.fillRoundedRect(cx - 105, plinthY - 10, 210, 16, 8);
		altar.lineStyle(1.5, COLORS.gold, 0.85);
		altar.strokeRoundedRect(cx - 105, plinthY - 10, 210, 16, 8);

		// Velvet top nap highlight cord
		altar.lineStyle(1, 0xffe9a6, 0.4);
		altar.lineBetween(cx - 90, plinthY - 8, cx + 90, plinthY - 8);

		// Ground Shadow on the velvet cushion
		this.shadow = scene.add
			.ellipse(cx, plinthY - 2, 110, 24, 0x000000, 0.58)
			.setDepth(3);

		// --- 4. Pseudo-3D Coin Composite Container ---
		this.coinContainer = scene.add.container(cx, astrolabeY).setDepth(5);

		this.coinFace = scene.add.image(0, 0, "coin").setScale(0.45);
		this.coinEdge = scene.add
			.image(0, 0, "coin_edge")
			.setScale(0.45)
			.setVisible(false);
		this.coinShine = scene.add
			.image(0, 0, "coin_shine")
			.setScale(0.45)
			.setBlendMode(Phaser.BlendModes.ADD)
			.setAlpha(0);

		this.coinContainer.add([this.coinFace, this.coinEdge, this.coinShine]);
		this.coinContainer.setScale(0);

		// Entrance animation
		scene.tweens.add({
			targets: this.coinContainer,
			scale: 1,
			duration: settings.reducedMotion ? 250 : 650,
			ease: "Back.out",
		});

		// Idle levitation & wobble
		this.idleLevitation = scene.tweens.add({
			targets: this.coinContainer,
			y: astrolabeY - 12,
			duration: 1600,
			yoyo: true,
			repeat: -1,
			ease: "Sine.inOut",
		});

		this.idleWobble = scene.tweens.add({
			targets: this.coinContainer,
			angle: { from: -4, to: 4 },
			duration: 1800,
			yoyo: true,
			repeat: -1,
			ease: "Sine.inOut",
		});

		this.idleShadow = scene.tweens.add({
			targets: this.shadow,
			scaleX: 0.78,
			scaleY: 0.78,
			alpha: 0.38,
			duration: 1600,
			yoyo: true,
			repeat: -1,
			ease: "Sine.inOut",
		});

		// Periodic subtle specular sweep on idle
		if (!settings.reducedMotion) {
			this.idleShineTimer = scene.time.addEvent({
				delay: 3400,
				loop: true,
				callback: () => {
					if (this.locked) return;
					scene.tweens.add({
						targets: this.coinShine,
						alpha: { from: 0.6, to: 0 },
						duration: 650,
						ease: "Quad.out",
					});
				},
			});
		}

		// --- 5. Classical Typography & Headers ---
		const header = scene.add
			.text(
				cx,
				H * 0.165,
				"THE ORACLE OF CHRONICLES",
				title(26, hex(COLORS.gold)),
			)
			.setOrigin(0.5)
			.setAlpha(0);
		header.setLetterSpacing(6);
		header.setShadow(0, 3, "#000000", 12, false, true);

		this.prompt = scene.add
			.text(cx, H * 0.56, "Did history choose the path you took?", {
				fontFamily: FONT.body,
				fontSize: "34px",
				color: hex(COLORS.text),
				align: "center",
				wordWrap: { width: W - 100 },
			})
			.setOrigin(0.5)
			.setAlpha(0);

		const comboBadge =
			combo > 0
				? scene.add
						.text(
							cx,
							H * 0.62,
							`✦ COMBO ×${Math.min(3, combo + 1)} IF TRUE ✦`,
							{
								fontFamily: FONT.ui,
								fontSize: "17px",
								color: hex(COLORS.gold),
								fontStyle: "700",
							},
						)
						.setOrigin(0.5)
						.setLetterSpacing(3)
						.setAlpha(0)
				: null;

		scene.tweens.add({
			targets: [header, this.prompt, comboBadge].filter(Boolean),
			alpha: 1,
			duration: 450,
			delay: 300,
		});

		// Add base temple elements to container
		this.add([
			shade,
			vignette,
			torchGlow,
			...motes,
			this.astrolabe,
			altar,
			this.shadow,
			this.coinContainer,
			header,
			this.prompt,
		]);
		if (comboBadge) this.add(comboBadge);

		scene.add.existing(this);
		this.setDepth(80);

		// Ritual initiation audio
		playSfx("oracle_open", "coin");

		// --- 6. Sacred Wager Talismans (Stele Cards) ---
		this.createSteleTalismans(onBet);
	}

	private createSteleTalismans(onBet: (betHistorical: boolean) => void) {
		const s = this.scene;
		const w = 314;
		const h = 126;
		const y = H * 0.74;

		const makeStele = (
			x: number,
			isHistorical: boolean,
			crestGlyph: string,
			tag: string,
			titleText: string,
			subText: string,
		) => {
			const c = s.add.container(x, y);
			const bg = s.add.graphics();
			const glow = s.add.graphics();
			const accentCol = isHistorical ? COLORS.gold : 0x9ec7e8;
			const deepAccent = isHistorical ? COLORS.goldDeep : 0x4a6582;
			const stoneBg = isHistorical ? 0x110f18 : 0x0c121e;

			const drawStele = (hover = false) => {
				bg.clear();
				glow.clear();

				if (hover) {
					glow.fillStyle(accentCol, 0.18);
					glow.fillRoundedRect(-w / 2 - 6, -h / 2 - 6, w + 12, h + 12, 20);
				}

				// Carved stone slab
				bg.fillStyle(stoneBg, hover ? 0.98 : 0.9);
				bg.fillRoundedRect(-w / 2, -h / 2, w, h, 16);

				// Outer carved border
				bg.lineStyle(
					hover ? 2.5 : 2,
					hover ? accentCol : deepAccent,
					hover ? 1 : 0.75,
				);
				bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 16);

				// Inset filigree border
				bg.lineStyle(1.2, accentCol, hover ? 0.9 : 0.45);
				bg.strokeRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 11);

				// Ornamental corner brackets
				const cr = 10;
				const corners = [
					[-w / 2 + 6, -h / 2 + 6],
					[w / 2 - 6, -h / 2 + 6],
					[-w / 2 + 6, h / 2 - 6],
					[w / 2 - 6, h / 2 - 6],
				];
				bg.lineStyle(1.5, accentCol, hover ? 1 : 0.6);
				for (const [corX, corY] of corners) {
					const dx = corX < 0 ? cr : -cr;
					const dy = corY < 0 ? cr : -cr;
					bg.lineBetween(corX, corY, corX + dx, corY);
					bg.lineBetween(corX, corY, corX, corY + dy);
				}
			};

			drawStele(false);

			// Crest Medallion
			const medX = -w / 2 + 42;
			const medBg = s.add.circle(medX, 0, 25, 0x07060c, 0.95);
			medBg.setStrokeStyle(1.5, accentCol, 0.85);

			const crest = s.add
				.text(medX, 0, crestGlyph, {
					fontFamily: FONT.title,
					fontSize: "25px",
					color: hex(accentCol),
				})
				.setOrigin(0.5);

			// Typography Group
			const textX = -w / 2 + 76;

			const tagLabel = s.add
				.text(textX, -26, tag.toUpperCase(), {
					fontFamily: FONT.ui,
					fontSize: "11px",
					color: hex(deepAccent),
					fontStyle: "700",
				})
				.setOrigin(0, 0.5);
			tagLabel.setLetterSpacing(2.5);

			const titleLabel = s.add
				.text(textX, -5, titleText, {
					fontFamily: FONT.title,
					fontSize: "14px",
					color: hex(COLORS.text),
					fontStyle: "700",
				})
				.setOrigin(0, 0.5);
			titleLabel.setLetterSpacing(0.8);

			const subLabel = s.add
				.text(textX, 20, subText, {
					fontFamily: FONT.body,
					fontSize: "13px",
					color: hex(COLORS.muted),
				})
				.setOrigin(0, 0.5);

			c.add([glow, bg, medBg, crest, tagLabel, titleLabel, subLabel]);
			c.setInteractive({
				hitArea: new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h),
				hitAreaCallback: Phaser.Geom.Rectangle.Contains,
				useHandCursor: true,
			});

			c.on("pointerover", () => {
				if (this.locked) return;
				drawStele(true);
				playSfx("tap");
				s.tweens.add({
					targets: c,
					y: y - 8,
					scale: 1.03,
					duration: 160,
					ease: "Quad.out",
				});
			});

			c.on("pointerout", () => {
				if (this.locked) return;
				drawStele(false);
				s.tweens.add({
					targets: c,
					y,
					scale: 1,
					duration: 160,
					ease: "Quad.out",
				});
			});

			c.on("pointerdown", () => {
				if (this.locked) return;
				s.tweens.add({
					targets: c,
					y: y - 3,
					scale: 0.97,
					duration: 70,
					ease: "Quad.out",
				});
			});

			c.on("pointerup", () => {
				if (this.locked) return;
				this.locked = true;
				this.playerBetHistorical = isHistorical;

				playSfx("card");

				// Pause idle tweens
				this.idleLevitation?.pause();
				this.idleWobble?.pause();

				this.selectStele(isHistorical, c, onBet);
			});

			c.setAlpha(0).setY(y + 45);
			s.tweens.add({
				targets: c,
				alpha: 1,
				y,
				duration: 450,
				delay: 450 + (isHistorical ? 0 : 100),
				ease: "Back.out",
			});

			this.tablets.push(c);
			this.add(c);
			return c;
		};

		makeStele(
			W / 2 - 164,
			true,
			"☼",
			"✦ Historical ✦",
			"THE CHRONICLER'S PATH",
			"History affirmed this choice",
		);

		makeStele(
			W / 2 + 164,
			false,
			"☾",
			"✦ Counterfactual ✦",
			"THE DIVERGENT THREAD",
			"History took another road",
		);
	}

	private selectStele(
		isHistorical: boolean,
		chosen: Phaser.GameObjects.Container,
		onBet: (betHistorical: boolean) => void,
	) {
		const s = this.scene;

		for (const t of this.tablets) {
			if (t !== chosen) {
				// Gentle dissolution of rejected stele into embers
				s.tweens.add({
					targets: t,
					alpha: 0,
					scale: 0.88,
					y: "+=30",
					duration: 320,
					ease: "Cubic.in",
				});

				if (!settings.reducedMotion) {
					for (let i = 0; i < 18; i++) {
						const spark = s.add
							.circle(
								t.x + Phaser.Math.Between(-130, 130),
								t.y + Phaser.Math.Between(-40, 40),
								Phaser.Math.Between(2, 4),
								!isHistorical ? COLORS.gold : 0x9ec7e8,
								0.85,
							)
							.setDepth(82);
						s.tweens.add({
							targets: spark,
							x: spark.x + Phaser.Math.Between(-25, 25),
							y: spark.y - Phaser.Math.Between(30, 80),
							alpha: 0,
							scale: 0.2,
							duration: Phaser.Math.Between(400, 750),
							ease: "Quad.out",
							onComplete: () => spark.destroy(),
						});
					}
				}
			} else {
				// Chosen stele glides gracefully into central plinth position
				s.tweens.add({
					targets: t,
					x: W / 2,
					y: H * 0.72,
					scale: 1.04,
					duration: 420,
					ease: "Cubic.out",
				});
			}
		}

		this.prompt.setText(
			isHistorical
				? "You wager: The Annals record your decree."
				: "You wager: History diverged onto another road.",
		);

		onBet(isHistorical);
	}

	/**
	 * Executes the sacred coin tumble, astrolabe acceleration, double-bounce landing,
	 * and heraldic verdict resolution.
	 */
	resolve(matched: boolean, legacyGain: number): Promise<void> {
		return new Promise((done) => {
			const s = this.scene;

			this.idleLevitation?.stop();
			this.idleWobble?.stop();
			this.idleShadow?.stop();
			this.idleShineTimer?.remove();
			s.tweens.killTweensOf(this.coinContainer);
			s.tweens.killTweensOf(this.shadow);

			const startY = H * 0.35;
			const apexY = startY - 200;
			// Coin radius (122 * 0.45 ~ 55px) resting on plinth surface (H * 0.44 - 10)
			const impactY = H * 0.44 - 65;
			const plinthSurfaceY = H * 0.44 - 10;

			this.coinContainer.setAngle(0);
			this.coinContainer.setY(startY);

			// Determine target face based on player's wager & actual match
			// Sol = "coin", Luna = "coin_reverse"
			const targetFace = matched
				? this.playerBetHistorical
					? "coin"
					: "coin_reverse"
				: this.playerBetHistorical
					? "coin_reverse"
					: "coin";

			// Toss launch audio
			playSfx("coin_toss", "whoosh");

			// Accelerate astrolabe celestial rings
			s.tweens.add({
				targets: this.ringOuter,
				angle: "-=540",
				duration: 950,
				ease: "Quad.inOut",
			});
			s.tweens.add({
				targets: this.ringMid,
				angle: "+=720",
				duration: 950,
				ease: "Quad.inOut",
			});
			s.tweens.add({
				targets: this.ringInner,
				angle: "-=540",
				duration: 950,
				ease: "Quad.inOut",
			});

			const baseHalfTurns = settings.reducedMotion ? 4 : 12;
			const targetIsCoin = targetFace === "coin";
			const totalHalfTurns = targetIsCoin ? baseHalfTurns : baseHalfTurns + 1;
			const tossDuration = settings.reducedMotion ? 650 : 1080;

			// Trail stardust emitter timer
			let trailTimer: Phaser.Time.TimerEvent | null = null;
			if (!settings.reducedMotion) {
				trailTimer = s.time.addEvent({
					delay: 45,
					repeat: 24,
					callback: () => {
						const spark = s.add
							.circle(
								this.coinContainer.x + Phaser.Math.Between(-18, 18),
								this.coinContainer.y + Phaser.Math.Between(-10, 10),
								Phaser.Math.Between(2, 4.5),
								COLORS.gold,
								0.85,
							)
							.setDepth(4);
						s.tweens.add({
							targets: spark,
							alpha: 0,
							scale: 0.2,
							y: "+=24",
							duration: 380,
							onComplete: () => spark.destroy(),
						});
					},
				});
			}

			// Parabolic Toss with Continuous 3D Tumble Driver
			s.tweens.addCounter({
				from: 0,
				to: 1,
				duration: tossDuration,
				ease: "Linear",
				onUpdate: (tween) => {
					const p = tween.getValue() ?? 0;

					// 1. Parabolic Arc with Apex Weightless Hang Time
					let currentY: number;
					if (p < 0.46) {
						// Ascending with Quad.out
						const u = p / 0.46;
						const ease = 1 - (1 - u) * (1 - u);
						currentY = startY - (startY - apexY) * ease;
					} else if (p < 0.54) {
						// Apex weightless hang time
						const u = (p - 0.46) / 0.08;
						currentY = apexY - 5 * Math.sin(u * Math.PI);
					} else {
						// Descending with Quad.in acceleration
						const u = (p - 0.54) / 0.46;
						const ease = u * u;
						currentY = apexY + (impactY - apexY) * ease;
					}
					this.coinContainer.y = currentY;

					// 2. Ground Shadow Altitude Scaling
					const heightRatio = Math.max(
						0,
						Math.min(1, (impactY - currentY) / (impactY - apexY)),
					);
					this.shadow.setScale(
						1.0 - heightRatio * 0.72,
						1.0 - heightRatio * 0.72,
					);
					this.shadow.setAlpha(0.65 - heightRatio * 0.5);

					// 3. Pseudo-3D Cosine Rotation & Face Selection
					const phi = p * totalHalfTurns * Math.PI;
					const cosVal = Math.cos(phi);
					const absCos = Math.abs(cosVal);

					const faceTexture = cosVal >= 0 ? "coin" : "coin_reverse";
					this.coinFace.setTexture(faceTexture);
					this.coinFace.setScale(Math.max(0.04, absCos) * 0.45, 0.45);

					// Edge rim sliver
					if (absCos < 0.2) {
						this.coinEdge.setVisible(true);
						const edgeFrac = (0.2 - absCos) / 0.2;
						this.coinEdge.setScale((edgeFrac * 0.35 + 0.12) * 0.45, 0.45);
						this.coinEdge.setAlpha(edgeFrac * 0.95);
					} else {
						this.coinEdge.setVisible(false);
					}

					// Euler wobble tilt
					this.coinContainer.angle = Math.sin(phi * 0.75) * 10;

					// Specular light glint sweep
					if (absCos > 0.65 && cosVal > 0) {
						const sweep = (absCos - 0.65) / 0.35;
						this.coinShine.setAlpha(Math.sin(sweep * Math.PI) * 0.75);
						this.coinShine.x = (sweep - 0.5) * 60;
					} else {
						this.coinShine.setAlpha(0);
					}
				},
				onComplete: () => {
					trailTimer?.remove();

					// Lock final canonical settle face
					this.coinFace.setTexture(targetFace);
					this.coinFace.setScale(0.45, 0.45);
					this.coinEdge.setVisible(false);
					this.coinContainer.angle = 0;
					this.coinContainer.y = impactY;
					this.shadow.setScale(1.0, 1.0);
					this.shadow.setAlpha(0.65);

					// --- Impact & Double-Bounce Physics ---
					playSfx("coin_land", "coin");

					if (!settings.reducedMotion) {
						s.cameras.main.shake(120, 0.003);
					}

					// Shockwave Ring on velvet plinth
					const shockwave = s.add
						.ellipse(W / 2, plinthSurfaceY + 2, 54, 18)
						.setDepth(4);
					const verdictCol = matched ? COLORS.gold : 0xd9534f;
					shockwave.setStrokeStyle(2.5, verdictCol, 0.9);
					s.tweens.add({
						targets: shockwave,
						scaleX: 4.2,
						scaleY: 2.8,
						alpha: 0,
						duration: 540,
						ease: "Cubic.out",
						onComplete: () => shockwave.destroy(),
					});

					// Double bounce damping
					s.tweens.add({
						targets: this.shadow,
						scaleX: 0.86,
						scaleY: 0.86,
						alpha: 0.45,
						duration: 130,
						ease: "Quad.out",
						yoyo: true,
					});

					s.tweens.add({
						targets: this.coinContainer,
						y: impactY - 22,
						duration: 130,
						ease: "Quad.out",
						yoyo: true,
						onYoyo: () => {
							// Second light bounce
							s.tweens.add({
								targets: this.coinContainer,
								y: impactY - 7,
								duration: 85,
								ease: "Quad.out",
								yoyo: true,
								delay: 130,
								onComplete: () => {
									// Delicate settling wobble
									s.tweens.add({
										targets: this.coinContainer,
										angle: { from: -3, to: 3 },
										duration: 80,
										yoyo: true,
										repeat: 1,
										ease: "Sine.inOut",
										onComplete: () => {
											this.coinContainer.angle = 0;
											// Final settling specular gleam
											s.tweens.add({
												targets: this.coinShine,
												alpha: { from: 0.85, to: 0 },
												duration: 550,
												ease: "Quad.out",
											});
										},
									});
								},
							});
						},
					});

					// --- Heraldic Verdict & Announcement ---
					playSfx(matched ? "chime" : "fail");

					s.cameras.main.flash(
						matched ? 240 : 180,
						matched ? 240 : 180,
						matched ? 210 : 40,
						matched ? 110 : 40,
						false,
					);

					const verdictTint = matched ? 0xfff0a0 : 0xd9756c;
					this.coinFace.setTint(verdictTint);

					// Verdict Announcement Title
					const verdictHeader = matched
						? this.playerBetHistorical
							? "RECORDED IN THE ANNALS"
							: "A NEW BRANCH UNFOLDS"
						: "FATE HELD ANOTHER COURSE";

					this.verdictText = s.add
						.text(W / 2, H * 0.51, verdictHeader, title(32, hex(verdictTint)))
						.setOrigin(0.5)
						.setAlpha(0);
					this.verdictText.setLetterSpacing(5);
					this.verdictText.setShadow(0, 3, hex(verdictTint), 14, false, true);
					this.add(this.verdictText);

					s.tweens.add({
						targets: this.verdictText,
						alpha: 1,
						y: H * 0.495,
						duration: 400,
						ease: "Back.out",
					});

					// Update Prompt with Combo Multiplier Celebration
					this.prompt.setText(
						matched
							? legacyGain > 0
								? `The chronicles affirm your wisdom.  Legacy +${legacyGain}`
								: "The chronicles affirm your wisdom."
							: "History took another road. The wager dissolves.",
					);

					// Triumphant golden starlight cascade on match
					if (matched && !settings.reducedMotion) {
						const p = s.add.particles(W / 2, plinthSurfaceY, "spark", {
							speed: { min: 80, max: 280 },
							scale: { start: 0.9, end: 0 },
							lifespan: 1200,
							tint: [0xfff5cf, COLORS.gold, 0xffd970, 0xffffff],
							quantity: 50,
							blendMode: Phaser.BlendModes.ADD,
							emitting: false,
						});
						p.setDepth(85);
						p.explode(50);
						s.time.delayedCall(1400, () => p.destroy());
					}

					// Dignified Hold & Clean Exit
					s.time.delayedCall(1800, () => {
						s.tweens.add({
							targets: this,
							alpha: 0,
							duration: 420,
							onComplete: () => {
								this.destroy();
								done();
							},
						});
					});
				},
			});
		});
	}

	override destroy(fromScene?: boolean) {
		this.idleLevitation?.stop();
		this.idleWobble?.stop();
		this.idleShadow?.stop();
		this.idleShineTimer?.remove();
		super.destroy(fromScene);
	}
}
