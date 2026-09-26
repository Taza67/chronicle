import Phaser from "phaser";
import { audio } from "../core/audio.ts";
import { settings } from "../core/state.ts";
import { COLORS, FONT, hex, title, ui, W } from "./theme.ts";

export const motion = () => (settings.reducedMotion ? 0.35 : 1);

/** Ornate gold-rimmed button with press feedback. */
export class Button extends Phaser.GameObjects.Container {
	private bg: Phaser.GameObjects.Graphics;
	private label: Phaser.GameObjects.Text;
	readonly w: number;
	readonly h: number;
	private enabledState = true;

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
		} = {},
	) {
		super(scene, x, y);
		this.w = opts.w ?? 420;
		this.h = opts.h ?? 84;
		const primary = opts.primary ?? true;
		this.bg = scene.add.graphics();
		this.drawBg(primary, opts.color);
		this.label = scene.add
			.text(0, 0, text, {
				fontFamily: FONT.title,
				fontSize: `${opts.size ?? 28}px`,
				color: primary ? hex(COLORS.night) : hex(COLORS.text),
				fontStyle: "700",
				align: "center",
				wordWrap: { width: this.w - 40 },
			})
			.setOrigin(0.5);
		this.add([this.bg, this.label]);
		this.setSize(this.w, this.h);
		this.setInteractive({ useHandCursor: true });
		this.on("pointerdown", () => {
			if (!this.enabledState) return;
			scene.tweens.add({
				targets: this,
				scale: 0.94,
				duration: 70,
				ease: "Quad.out",
			});
		});
		this.on("pointerup", () => {
			if (!this.enabledState) return;
			audio.sfx("tap");
			scene.tweens.add({
				targets: this,
				scale: 1,
				duration: 160,
				ease: "Back.out",
			});
			onTap();
		});
		this.on("pointerout", () =>
			scene.tweens.add({ targets: this, scale: 1, duration: 120 }),
		);
		scene.add.existing(this);
	}

	private drawBg(primary: boolean, color?: number) {
		const g = this.bg;
		g.clear();
		const r = 18;
		if (primary) {
			g.fillStyle(color ?? COLORS.gold, 1);
			g.fillRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, r);
			g.fillStyle(0xffffff, 0.18);
			g.fillRoundedRect(
				-this.w / 2 + 4,
				-this.h / 2 + 4,
				this.w - 8,
				this.h / 2 - 6,
				{ tl: r - 4, tr: r - 4, bl: 6, br: 6 },
			);
			g.lineStyle(3, COLORS.goldDeep, 1);
			g.strokeRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, r);
		} else {
			g.fillStyle(COLORS.ink, 0.85);
			g.fillRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, r);
			g.lineStyle(2, color ?? COLORS.gold, 0.9);
			g.strokeRoundedRect(-this.w / 2, -this.h / 2, this.w, this.h, r);
		}
	}

	setText(t: string) {
		this.label.setText(t);
		return this;
	}

	setEnabled(v: boolean) {
		this.enabledState = v;
		this.setAlpha(v ? 1 : 0.45);
		return this;
	}
}

/** Small circular icon button (settings, back, codex…). */
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
	g.fillStyle(COLORS.ink, 0.75);
	g.fillCircle(0, 0, size / 2);
	g.lineStyle(2, COLORS.gold, 0.9);
	g.strokeCircle(0, 0, size / 2);
	const t = scene.add
		.text(0, 0, glyph, ui(size * 0.42, hex(COLORS.gold)))
		.setOrigin(0.5);
	c.add([g, t]);
	c.setSize(size, size).setInteractive({ useHandCursor: true });
	c.on("pointerup", () => {
		audio.sfx("tap");
		scene.tweens.add({
			targets: c,
			scale: { from: 0.85, to: 1 },
			duration: 200,
			ease: "Back.out",
		});
		onTap();
	});
	return c;
}

/** Full-screen dark overlay with vignette, used behind panels. */
export function dim(scene: Phaser.Scene, alpha = 0.7) {
	const r = scene.add
		.rectangle(W / 2, 640, W, 1280, COLORS.night, alpha)
		.setInteractive();
	return r;
}

/** Parchment panel (ink border + aged fill). */
export function parchment(
	scene: Phaser.Scene,
	x: number,
	y: number,
	w: number,
	h: number,
) {
	const g = scene.add.graphics();
	g.fillStyle(COLORS.parchmentDark, 1);
	g.fillRoundedRect(x - w / 2 + 6, y - h / 2 + 8, w, h, 14);
	g.fillStyle(COLORS.parchment, 1);
	g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 14);
	g.lineStyle(3, COLORS.goldDeep, 0.8);
	g.strokeRoundedRect(x - w / 2 + 10, y - h / 2 + 10, w - 20, h - 20, 8);
	return g;
}

/** Header ribbon text with letter-spacing, used for screen titles. */
export function heading(
	scene: Phaser.Scene,
	y: number,
	text: string,
	size = 40,
) {
	const t = scene.add
		.text(W / 2, y, text.toUpperCase(), title(size, hex(COLORS.gold)))
		.setOrigin(0.5);
	t.setLetterSpacing(6);
	t.setShadow(0, 3, "#000000", 10, false, true);
	return t;
}

/** Typewriter subtitle box at the bottom of the court. */
export class Subtitle extends Phaser.GameObjects.Container {
	private txt: Phaser.GameObjects.Text;
	private who: Phaser.GameObjects.Text;
	private bg: Phaser.GameObjects.Graphics;
	private timer?: Phaser.Time.TimerEvent;
	private full = "";

	constructor(scene: Phaser.Scene, y: number) {
		super(scene, W / 2, y);
		this.bg = scene.add.graphics();
		this.who = scene.add.text(-W / 2 + 40, -74, "", {
			fontFamily: FONT.title,
			fontSize: "22px",
			color: hex(COLORS.gold),
			fontStyle: "700",
		});
		this.who.setLetterSpacing(3);
		this.txt = scene.add.text(-W / 2 + 40, -44, "", {
			fontFamily: FONT.body,
			fontSize: "30px",
			color: hex(COLORS.text),
			wordWrap: { width: W - 80 },
			lineSpacing: 2,
		});
		this.add([this.bg, this.who, this.txt]);
		this.setAlpha(0);
		scene.add.existing(this);
	}

	show(name: string, text: string, color: number, durationMs: number) {
		if (!this.scene) return;
		this.timer?.remove();
		this.who.setText(name.toUpperCase()).setColor(hex(color));
		this.full = text;
		this.txt.setText(text);
		const h = Math.max(150, this.txt.height + 110);
		this.bg.clear();
		this.bg.fillStyle(COLORS.night, 0.82);
		this.bg.fillRoundedRect(-W / 2 + 16, -90, W - 32, h, 20);
		this.bg.lineStyle(2, color, 0.7);
		this.bg.strokeRoundedRect(-W / 2 + 16, -90, W - 32, h, 20);
		this.setAlpha(settings.subtitles ? 1 : 0);
		// typewriter: reveal words over the speech duration
		if (settings.subtitles && !settings.reducedMotion) {
			const words = text.split(" ");
			const per = Math.max(
				30,
				Math.min(120, (durationMs * 0.9) / Math.max(1, words.length)),
			);
			let i = 0;
			this.txt.setText("");
			this.timer = this.scene.time.addEvent({
				delay: per,
				repeat: words.length - 1,
				callback: () => {
					i++;
					this.txt.setText(words.slice(0, i).join(" "));
				},
			});
		}
	}

	/** Reveal the whole line at once (speech skipped). */
	finish() {
		this.timer?.remove();
		this.txt.setText(this.full);
	}

	hide() {
		if (!this.scene) return;
		this.timer?.remove();
		this.scene.tweens.add({ targets: this, alpha: 0, duration: 250 });
	}
}

/** Toast at top of screen. */
export function toast(scene: Phaser.Scene, text: string, color = COLORS.gold) {
	const t = scene.add
		.text(W / 2, 140, text, ui(24, hex(color)))
		.setOrigin(0.5)
		.setDepth(1000)
		.setAlpha(0);
	t.setShadow(0, 2, "#000", 8, false, true);
	scene.tweens.chain({
		targets: t,
		tweens: [
			{ alpha: 1, y: 160, duration: 250, ease: "Quad.out" },
			{
				alpha: 0,
				y: 150,
				duration: 400,
				delay: 1800,
				onComplete: () => t.destroy(),
			},
		],
	});
}

/** Scene transition: iris/curtain fade. */
export function go(scene: Phaser.Scene, key: string, data?: object) {
	const cam = scene.cameras.main;
	cam.fadeOut(280 * motion(), 11, 10, 16);
	cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
		scene.scene.start(key, data);
	});
}

export function fadeIn(scene: Phaser.Scene, ms = 500) {
	scene.cameras.main.fadeIn(ms * motion(), 11, 10, 16);
}
