import Phaser from "phaser";
import type { VoiceHandle } from "../core/audio.ts";
import { settings } from "../core/state.ts";
import type { BBox, Emotion } from "../types.ts";
import { ROLE_META } from "./theme.ts";

export interface PortraitKeys {
	base: string;
	mouthOpen: string;
	mouthHalf: string;
	eyesClosed: string;
	bbox: BBox;
}

/**
 * Living portrait: breathing, micro head motion, random blinks, audio-driven lip-sync,
 * emotion-specific poses and rim light. Overlays are feathered patches placed on the
 * Gemini-detected mouth/eyes boxes, so no rigging is needed.
 */
export class Portrait extends Phaser.GameObjects.Container {
	private base: Phaser.GameObjects.Image;
	private mouthOpen: Phaser.GameObjects.Image;
	private mouthHalf: Phaser.GameObjects.Image;
	private eyes: Phaser.GameObjects.Image;
	private rim: Phaser.GameObjects.Image;
	private rig: Phaser.GameObjects.Container;
	private t = Math.random() * 100;
	private nextBlink = 0;
	private voice: VoiceHandle | null = null;
	private mouth = 0;
	private lvl = 0;
	private openLvl = 0;
	private sibLvl = 0;
	private targetOpenness = 0;
	private targetSibilance = 0;
	private mouthBaseH = 1;
	private mouthBaseW = 1;
	private emotion: Emotion = "calm";
	private pose = { rot: 0, sx: 1, sy: 1, dy: 0, dx: 0 };
	private shake = 0;
	private currentRimColor = 0xe0b64a;
	readonly displayH: number;
	private readonly scaleF: number;

	constructor(
		scene: Phaser.Scene,
		x: number,
		y: number,
		keys: PortraitKeys,
		displayH: number,
	) {
		super(scene, x, y);
		this.displayH = displayH;
		const src = scene.textures
			.get(keys.base)
			.getSourceImage() as HTMLImageElement;
		const iw = src.width;
		const ih = src.height;
		this.scaleF = displayH / ih;
		const s = this.scaleF;

		this.rig = scene.add.container(0, 0);
		this.rim = scene.add
			.image(0, 0, keys.base)
			.setScale(s * 1.03)
			.setTint(0xe0b64a)
			.setAlpha(0)
			.setBlendMode(Phaser.BlendModes.ADD);
		this.base = scene.add.image(0, 0, keys.base).setScale(s);
		// overlays: bbox is [y0,x0,y1,x1] in 0..1000 of the base image
		const place = (
			img: Phaser.GameObjects.Image,
			b: [number, number, number, number],
		) => {
			const [y0, x0, y1, x1] = b;
			const cx = ((x0 + x1) / 2 / 1000 - 0.5) * iw * s;
			const cy = ((y0 + y1) / 2 / 1000 - 0.5) * ih * s;
			img.setPosition(cx, cy);
			img.setDisplaySize(
				((x1 - x0) / 1000) * iw * s,
				((y1 - y0) / 1000) * ih * s,
			);
			return img;
		};
		this.mouthHalf = place(
			scene.add.image(0, 0, keys.mouthHalf),
			keys.bbox.mouth,
		).setAlpha(0);
		this.mouthOpen = place(
			scene.add.image(0, 0, keys.mouthOpen),
			keys.bbox.mouth,
		).setAlpha(0);
		this.mouthBaseH = this.mouthOpen.displayHeight;
		this.mouthBaseW = this.mouthOpen.displayWidth;
		// anchor the open mouth at the upper lip so the jaw drop grows downward
		this.mouthOpen
			.setOrigin(0.5, 0)
			.setY(this.mouthOpen.y - this.mouthBaseH / 2);
		this.eyes = place(
			scene.add.image(0, 0, keys.eyesClosed),
			keys.bbox.eyes,
		).setAlpha(0);
		this.rig.add([
			this.rim,
			this.base,
			this.mouthHalf,
			this.mouthOpen,
			this.eyes,
		]);
		this.add(this.rig);
		this.nextBlink = 1.5 + Math.random() * 2;
		scene.add.existing(this);
		scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
		this.once(Phaser.GameObjects.Events.DESTROY, () =>
			scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this),
		);
	}

	/** Attach a playing voice so the mouth follows its amplitude. */
	speak(v: VoiceHandle | null) {
		this.voice = v;
		v?.done.then(() => {
			if (this.voice === v) this.voice = null;
		});
	}

	setEmotion(e: Emotion, roleColor?: number) {
		this.emotion = e;
		const m = settings.reducedMotion ? 0.4 : 1;
		const target = {
			calm: { rot: 0, sx: 1, sy: 1, dy: 0, dx: 0 },
			alarmed: { rot: -0.02, sx: 1.03, sy: 1.03, dy: -8, dx: 6 },
			amused: { rot: 0.035, sx: 0.99, sy: 0.99, dy: 6, dx: -4 },
			proud: { rot: 0, sx: 1.04, sy: 1.05, dy: -14, dx: 0 },
			bold: { rot: -0.015, sx: 1.06, sy: 1.06, dy: -6, dx: 0 },
		}[e];
		this.scene.tweens.add({
			targets: this.pose,
			rot: target.rot * m,
			sx: 1 + (target.sx - 1) * m,
			sy: 1 + (target.sy - 1) * m,
			dy: target.dy * m,
			dx: target.dx * m,
			duration: 550,
			ease: e === "alarmed" ? "Back.out" : "Sine.inOut",
		});
		const rimColor = {
			calm: 0xe0b64a,
			alarmed: 0xd9453a,
			amused: 0xf2d27a,
			proud: 0xffd86b,
			bold: 0xff9b3d,
		}[e];
		const targetRimColor = roleColor ?? rimColor;
		const fromColor = Phaser.Display.Color.IntegerToColor(this.currentRimColor);
		const toColor = Phaser.Display.Color.IntegerToColor(targetRimColor);
		this.scene.tweens.addCounter({
			from: 0,
			to: 1,
			duration: 450,
			onUpdate: (tw) => {
				const v = tw.getValue() ?? 0;
				const c = Phaser.Display.Color.Interpolate.ColorWithColor(
					fromColor,
					toColor,
					1,
					v,
				);
				const col = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
				this.rim.setTint(col);
				this.currentRimColor = col;
			},
		});
		this.scene.tweens.add({
			targets: this.rim,
			alpha: e === "calm" ? 0.08 : 0.28,
			duration: 500,
		});
		if (e === "alarmed" && !settings.reducedMotion) this.shake = 1;
		if (e === "amused")
			this.scene.tweens.add({
				targets: this.rig,
				y: { from: 0, to: -10 },
				yoyo: true,
				repeat: 2,
				duration: 110,
				ease: "Sine.inOut",
			});
	}

	/** Enter from a side with a settle. */
	enter(fromX: number, ms = 260) {
		const tx = this.x;
		this.setX(fromX).setAlpha(0);
		this.scene.tweens.add({
			targets: this,
			x: tx,
			alpha: 1,
			duration: settings.reducedMotion ? 150 : ms,
			ease: "Back.out(1.1)",
		});
	}

	leave(toX: number, ms = 220, onDone?: () => void) {
		this.speak(null);
		this.scene.tweens.add({
			targets: this,
			x: toX,
			alpha: 0,
			duration: settings.reducedMotion ? 120 : ms,
			ease: "Cubic.in",
			onComplete: () => {
				onDone?.();
				this.destroy();
			},
		});
	}

	private tick(_time: number, deltaMs: number) {
		if (!this.scene?.tweens) return;
		const dt = deltaMs / 1000;
		this.t += dt;
		const m = settings.reducedMotion ? 0.3 : 1;
		// breathing + micro head sway
		const breath = Math.sin(this.t * 1.7) * 0.006 * m;
		const sway =
			Math.sin(this.t * 0.62) * 0.008 * m + Math.sin(this.t * 1.31) * 0.004 * m;
		const drift = Math.sin(this.t * 0.45) * 5 * m;
		let shakeX = 0;
		if (this.shake > 0) {
			shakeX = Math.sin(this.t * 34) * 4 * this.shake * this.shake;
			this.shake = Math.max(0, this.shake - dt * 3);
		}
		this.rig.setScale(this.pose.sx, this.pose.sy + breath);
		this.rig.setRotation(this.pose.rot + sway);
		this.rig.setX(this.pose.dx + drift + shakeX);
		if (this.emotion !== "amused")
			this.rig.setY(this.pose.dy + Math.sin(this.t * 1.7) * 2 * m);
		// blink
		this.nextBlink -= dt;
		if (this.nextBlink <= 0) {
			this.nextBlink = 2.2 + Math.random() * 4;
			this.scene.tweens.add({
				targets: this.eyes,
				alpha: 1,
				duration: 60,
				yoyo: true,
				hold: 70,
				ease: "Quad.out",
			});
			if (Math.random() < 0.2) this.nextBlink = 0.25; // double blink
		}
		// lip-sync: fast attack, slower release, then a continuous cross-fade
		// (no hard thresholds, no whole-portrait motion → no visible jitter)
		const shape = this.voice
			? this.voice.shape()
			: { amplitude: 0, openness: 0, sibilance: 0 };
		const raw = shape.amplitude;
		this.lvl += (raw - this.lvl) * Math.min(1, dt * (raw > this.lvl ? 30 : 12));
		this.openLvl +=
			(shape.openness - this.openLvl) *
			Math.min(1, dt * (shape.openness > this.openLvl ? 30 : 12));
		this.sibLvl +=
			(shape.sibilance - this.sibLvl) *
			Math.min(1, dt * (shape.sibilance > this.sibLvl ? 30 : 12));

		const target = Phaser.Math.Clamp((this.lvl - 0.06) / 0.3, 0, 1);
		this.mouth += (target - this.mouth) * Math.min(1, dt * 18);

		const openTarget = Phaser.Math.Clamp((this.openLvl - 0.06) / 0.3, 0, 1);
		this.targetOpenness +=
			(openTarget - this.targetOpenness) * Math.min(1, dt * 18);

		const sibTarget = Phaser.Math.Clamp(this.sibLvl / 0.35, 0, 1);
		this.targetSibilance +=
			(sibTarget - this.targetSibilance) * Math.min(1, dt * 18);

		const openA = Phaser.Math.Easing.Sine.InOut(
			Phaser.Math.Clamp((this.mouth - 0.45) / 0.55, 0, 1),
		);
		const halfA =
			Phaser.Math.Easing.Sine.InOut(Phaser.Math.Clamp(this.mouth / 0.5, 0, 1)) *
			(1 - openA);
		this.mouthOpen.setAlpha(openA);
		this.mouthHalf.setAlpha(halfA);

		const targetOpenness = this.targetOpenness;
		const targetSibilance = this.targetSibilance;

		// jaw drop modulated by vowel openness and horizontal stretch by sibilance
		this.mouthOpen.displayHeight = this.mouthBaseH * (1 + 0.1 * targetOpenness);
		this.mouthOpen.displayWidth =
			this.mouthBaseW * (1 + 0.08 * targetSibilance);

		// Subtle organic speech gesture: rhythmic micro-nod on open syllables & slight head tilt on emphasis
		const speechNod =
			this.lvl > 0.04 ? Math.sin(this.t * 16) * 1.8 * targetOpenness * m : 0;
		const speechTilt =
			this.lvl > 0.04 ? Math.sin(this.t * 8) * 0.007 * this.lvl * m : 0;

		this.rig.setRotation(this.pose.rot + sway + speechTilt);
		if (this.emotion !== "amused")
			this.rig.setY(this.pose.dy + Math.sin(this.t * 1.7) * 2 * m + speechNod);
	}
}

export const roleColor = (role: keyof typeof ROLE_META) =>
	ROLE_META[role].color;
