import Phaser from "phaser";
import { settings } from "../core/state.ts";
import type { Leader } from "../types.ts";
import { H, W } from "./theme.ts";

/** Parallax throne-room backdrop: far/near layers, tilt/pointer parallax, civ particles, vignette, mood light. */
export class Backdrop extends Phaser.GameObjects.Container {
	private far: Phaser.GameObjects.Image;
	private near: Phaser.GameObjects.Image;
	private mood: Phaser.GameObjects.Rectangle;
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
		this.far = scene.add.image(W / 2, H / 2, farKey);
		cover(this.far, 1.08);
		this.near = scene.add.image(W / 2, H / 2, nearKey);
		cover(this.near, 1.16);
		this.near.setAlpha(0.0);
		// near layer: only the lower half (foreground) so the far layer gives depth at the top
		const maskG = scene.make.graphics({ x: 0, y: 0 });
		maskG.fillGradientStyle(0xffffff, 0xffffff, 0xffffff, 0xffffff, 0, 0, 1, 1);
		maskG.fillRect(0, H * 0.35, W, H * 0.65);
		this.near.setMask(maskG.createGeometryMask());
		this.near.setAlpha(0.95);

		this.mood = scene.add
			.rectangle(
				W / 2,
				H / 2,
				W,
				H,
				Phaser.Display.Color.HexStringToColor(leader.palette.bg).color,
				0.25,
			)
			.setBlendMode(Phaser.BlendModes.MULTIPLY);
		const vignette = scene.add
			.image(W / 2, H / 2, "vignette")
			.setDisplaySize(W, H);
		const grain = scene.add
			.tileSprite(W / 2, H / 2, W, H, "grain")
			.setAlpha(0.06)
			.setBlendMode(Phaser.BlendModes.OVERLAY);
		const accent = Phaser.Display.Color.HexStringToColor(
			leader.palette.accent,
		).color;
		this.emitter = scene.add.particles(0, 0, "spark", {
			x: { min: 0, max: W },
			y: { min: H * 0.1, max: H * 1.05 },
			lifespan: { min: 5000, max: 9000 },
			speedY: { min: -14, max: -34 },
			speedX: { min: -8, max: 8 },
			scale: { start: 0.35, end: 0 },
			alpha: { start: 0, end: 0.9, ease: "Sine.out" },
			tint: [accent, 0xffffff, accent],
			quantity: 1,
			frequency: settings.reducedMotion ? 400 : 140,
			blendMode: Phaser.BlendModes.ADD,
		});
		this.add([this.far, this.near, this.mood, this.emitter, vignette, grain]);
		scene.add.existing(this);
		this.setDepth(-10);

		scene.input.on(
			Phaser.Input.Events.POINTER_MOVE,
			(p: Phaser.Input.Pointer) => {
				this.tx = (p.x / W - 0.5) * 2;
				this.ty = (p.y / H - 0.5) * 2;
			},
		);
		window.addEventListener("deviceorientation", this.onTilt);
		scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
		this.once(Phaser.GameObjects.Events.DESTROY, () => {
			window.removeEventListener("deviceorientation", this.onTilt);
			scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this);
		});
		scene.events.on(Phaser.Scenes.Events.UPDATE, (_t: number, d: number) => {
			grain.tilePositionX += d * 0.7;
			grain.tilePositionY -= d * 0.9;
		});
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
		this.far.setPosition(W / 2 - this.px * 10 * amt, H / 2 - this.py * 8 * amt);
		this.near.setPosition(
			W / 2 - this.px * 26 * amt,
			H / 2 - this.py * 18 * amt,
		);
	}
}
