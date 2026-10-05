import Phaser from "phaser";
import { settings } from "../core/state.ts";
import type { Leader } from "../types.ts";
import { CANVAS_W, CX, H, VIS_CX, W } from "./theme.ts";

/** Parallax throne-room backdrop: far/near layers, tilt/pointer parallax, civ particles, vignette, mood light. */
export class Backdrop extends Phaser.GameObjects.Container {
	private far: Phaser.GameObjects.Image;
	private near: Phaser.GameObjects.Image;
	private mood: Phaser.GameObjects.Rectangle;
	private vignette: Phaser.GameObjects.Image;
	private accentColor: number;
	private px = 0;
	private py = 0;
	private tx = 0;
	private ty = 0;
	private emitter: Phaser.GameObjects.Particles.ParticleEmitter;
	private onTilt = (e: DeviceOrientationEvent) => {
		if (e.gamma == null || e.beta == null) return;
		this.tx = Phaser.Math.Clamp(e.gamma / 30, -1, 1);
		this.ty = Phaser.Math.Clamp((e.beta - 45) / 30, -1, 1);
	};

	constructor(
		scene: Phaser.Scene,
		leader: Leader,
		farKey: string,
		nearKey: string,
	) {
		super(scene, 0, 0);
		const cover = (img: Phaser.GameObjects.Image, extra: number) => {
			const s = Math.max((W * extra) / img.width, (H * extra) / img.height);
			img.setScale(s);
		};
		// Art anchors the visual column (right half in landscape, center in portrait).
		this.far = scene.add.image(VIS_CX, H / 2, farKey);
		cover(this.far, 1.14);
		this.near = scene.add.image(VIS_CX, H / 2, nearKey);
		cover(this.near, 1.2);
		this.near.setAlpha(0.0);
		// near layer: only the lower half (foreground) so the far layer gives depth at the top
		const maskG = scene.make.graphics({ x: 0, y: 0 });
		maskG.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0, 0, 1, 1);
		maskG.fillRect(VIS_CX - W / 2, H * 0.35, W, H * 0.65);
		this.near.setMask(maskG.createGeometryMask());
		this.near.setAlpha(0.95);

		this.accentColor = Phaser.Display.Color.HexStringToColor(
			leader.palette.accent ?? "#e0b64a",
		).color;
		const bgHex = leader.palette.bg ?? leader.palette.primary ?? "#062a33";
		this.mood = scene.add
			.rectangle(
				VIS_CX,
				H / 2,
				W * 1.2,
				H * 1.2,
				Phaser.Display.Color.HexStringToColor(bgHex).color,
				0.25,
			)
			.setBlendMode(Phaser.BlendModes.MULTIPLY);
		this.vignette = scene.add
			.image(CX, H / 2, "vignette")
			.setDisplaySize(CANVAS_W * 1.15, H * 1.15)
			.setAlpha(0.75);
		const grain = scene.add
			.tileSprite(CX, H / 2, CANVAS_W * 1.2, H * 1.2, "grain")
			.setAlpha(0.06)
			.setBlendMode(Phaser.BlendModes.OVERLAY);
		this.emitter = scene.add.particles(0, 0, "spark", {
			x: { min: VIS_CX - W / 2 - 40, max: VIS_CX + W / 2 + 40 },
			y: { min: H * 0.05, max: H * 1.05 },
			lifespan: { min: 5000, max: 9000 },
			speedY: { min: -14, max: -34 },
			speedX: { min: -8, max: 8 },
			scale: { start: 0.35, end: 0 },
			alpha: { start: 0, end: 0.9, ease: "Sine.out" },
			tint: [this.accentColor, 0xffffff, this.accentColor],
			quantity: 1,
			frequency: settings.reducedMotion ? 400 : 140,
			blendMode: Phaser.BlendModes.ADD,
		});
		this.add([
			this.far,
			this.near,
			this.mood,
			this.emitter,
			this.vignette,
			grain,
		]);
		scene.add.existing(this);
		this.setDepth(-10);

		scene.input.on(
			Phaser.Input.Events.POINTER_MOVE,
			(p: Phaser.Input.Pointer) => {
				this.tx = (p.x / CANVAS_W - 0.5) * 2;
				this.ty = (p.y / H - 0.5) * 2;
			},
		);
		window.addEventListener("deviceorientation", this.onTilt);
		const grainTick = (_t: number, d: number) => {
			grain.tilePositionX += d * 0.7;
			grain.tilePositionY -= d * 0.9;
		};
		scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
		scene.events.on(Phaser.Scenes.Events.UPDATE, grainTick);
		this.once(Phaser.GameObjects.Events.DESTROY, () => {
			window.removeEventListener("deviceorientation", this.onTilt);
			scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this);
			scene.events.off(Phaser.Scenes.Events.UPDATE, grainTick);
			scene.tweens.killTweensOf(this.vignette);
		});
	}

	/** Adjusts throne-room particles and vignette based on realm stability and gold. */
	setAtmosphere(stability: number, gold: number) {
		const isCrisis = stability <= 2 || gold <= 2;
		const isProsperity = !isCrisis && stability >= 5 && gold >= 5;

		this.scene.tweens.killTweensOf(this.vignette);
		if (isCrisis) {
			this.emitter.setFrequency(settings.reducedMotion ? 260 : 70);
			this.emitter.timeScale = settings.reducedMotion ? 1.0 : 1.45;
			this.emitter.speedY = { min: -22, max: -48 };
			this.emitter.setParticleTint([0xd9381e, 0xff7b25, 0x8a1515, 0xff4500]);
			this.scene.tweens.add({
				targets: this.vignette,
				alpha: 1.0,
				duration: 800,
				ease: "Sine.out",
			});
		} else if (isProsperity) {
			this.emitter.setFrequency(settings.reducedMotion ? 450 : 180);
			this.emitter.timeScale = settings.reducedMotion ? 0.75 : 0.85;
			this.emitter.speedY = { min: -10, max: -24 };
			this.emitter.setParticleTint([0xffd700, 0xffe57f, 0xffffff, 0xf6ad55]);
			this.scene.tweens.add({
				targets: this.vignette,
				alpha: 0.55,
				duration: 800,
				ease: "Sine.out",
			});
		} else {
			this.emitter.setFrequency(settings.reducedMotion ? 400 : 140);
			this.emitter.timeScale = 1.0;
			this.emitter.speedY = { min: -14, max: -34 };
			this.emitter.setParticleTint([
				this.accentColor,
				0xffffff,
				this.accentColor,
			]);
			this.scene.tweens.add({
				targets: this.vignette,
				alpha: 0.75,
				duration: 800,
				ease: "Sine.out",
			});
		}
	}

	/** Direct crisis tension toggle. */
	setTension(crisis: boolean) {
		if (crisis) {
			this.setAtmosphere(1, 1);
		} else {
			this.setAtmosphere(4, 4);
		}
	}

	/** Emotion-driven lighting: warm/cool/danger. */
	setMood(color: number, alpha = 0.25, ms = 700) {
		this.scene.tweens.addCounter({
			from: 0,
			to: 1,
			duration: ms,
			onUpdate: (tw) => {
				const c = Phaser.Display.Color.Interpolate.ColorWithColor(
					Phaser.Display.Color.IntegerToColor(this.mood.fillColor),
					Phaser.Display.Color.IntegerToColor(color),
					1,
					tw.getValue() ?? 0,
				);
				this.mood.setFillStyle(
					Phaser.Display.Color.GetColor(c.r, c.g, c.b),
					Phaser.Math.Linear(this.mood.fillAlpha, alpha, tw.getValue() ?? 0),
				);
			},
		});
	}

	/** Burst of particles for reveals. */
	burst(x: number, y: number, count = 40) {
		this.emitter.explode(count, x, y);
	}

	private tick(_t: number, d: number) {
		const k = Math.min(1, d / 400);
		const amt = settings.reducedMotion ? 0.25 : 1;
		this.px += (this.tx - this.px) * k;
		this.py += (this.ty - this.py) * k;
		this.far.setPosition(
			VIS_CX - this.px * 10 * amt,
			H / 2 - this.py * 8 * amt,
		);
		this.near.setPosition(
			VIS_CX - this.px * 26 * amt,
			H / 2 - this.py * 18 * amt,
		);
	}
}
