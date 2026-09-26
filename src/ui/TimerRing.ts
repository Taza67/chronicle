import Phaser from "phaser";
import { audio } from "../core/audio.ts";
import { COLORS, FONT, hex } from "./theme.ts";

/** Court hourglass: a ring that drains over N seconds, ticking faster as it empties. */
export class TimerRing extends Phaser.GameObjects.Container {
	private g: Phaser.GameObjects.Graphics;
	private label: Phaser.GameObjects.Text;
	private remaining: number;
	private readonly total: number;
	private running = true;
	private lastTick = -1;
	private onHalf: () => void;
	private onZero: () => void;

	constructor(
		scene: Phaser.Scene,
		x: number,
		y: number,
		seconds: number,
		onHalf: () => void,
		onZero: () => void,
	) {
		super(scene, x, y);
		this.onHalf = onHalf;
		this.onZero = onZero;
		this.total = seconds;
		this.remaining = seconds;
		this.g = scene.add.graphics();
		this.label = scene.add
			.text(0, 0, `${seconds}`, {
				fontFamily: FONT.title,
				fontSize: "30px",
				color: hex(COLORS.text),
				fontStyle: "700",
			})
			.setOrigin(0.5);
		this.add([this.g, this.label]);
		scene.add.existing(this);
		this.setDepth(60).setScale(0);
		scene.tweens.add({
			targets: this,
			scale: 1,
			duration: 350,
			ease: "Back.out",
		});
		scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this);
		this.once(Phaser.GameObjects.Events.DESTROY, () =>
			scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this),
		);
	}

	stop() {
		this.running = false;
		this.scene.tweens.add({
			targets: this,
			scale: 0,
			alpha: 0,
			duration: 250,
			onComplete: () => this.destroy(),
		});
	}

	private tick(_t: number, d: number) {
		if (!this.running) return;
		this.remaining = Math.max(0, this.remaining - d / 1000);
		const f = this.remaining / this.total;
		const whole = Math.ceil(this.remaining);
		if (whole !== this.lastTick) {
			this.lastTick = whole;
			if (whole <= 3 && whole > 0) audio.sfx("tick");
			if (whole === Math.round(this.total / 2)) this.onHalf();
			this.label.setText(`${whole}`);
		}
		const col = f > 0.5 ? COLORS.gold : f > 0.25 ? 0xe08a3a : COLORS.blood;
		this.g.clear();
		this.g.fillStyle(COLORS.night, 0.7);
		this.g.fillCircle(0, 0, 40);
		this.g.lineStyle(7, 0x000000, 0.5);
		this.g.strokeCircle(0, 0, 40);
		this.g.lineStyle(7, col, 1);
		this.g.beginPath();
		this.g.arc(
			0,
			0,
			40,
			Phaser.Math.DegToRad(-90),
			Phaser.Math.DegToRad(-90 + 360 * f),
			false,
		);
		this.g.strokePath();
		if (f < 0.25) this.setScale(1 + Math.sin(this.remaining * 20) * 0.04);
		if (this.remaining <= 0) {
			this.running = false;
			this.onZero();
			this.stop();
		}
	}
}
