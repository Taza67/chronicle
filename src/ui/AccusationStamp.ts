import Phaser from "phaser";
import { audio } from "../core/audio.ts";
import { settings } from "../core/state.ts";
import { COLORS, FONT, hex, VIS_CX } from "./theme.ts";

export interface AccusationStampOpts {
	advisorName: string;
	onAccuse: () => void;
}

/**
 * An interactive royal signet seal appearing during advisor speeches.
 * Empowers the sovereign to actively challenge deceitful or self-serving advice.
 */
export class AccusationStamp extends Phaser.GameObjects.Container {
	private glow: Phaser.GameObjects.Graphics;
	private locked = false;

	constructor(scene: Phaser.Scene, y: number, opts: AccusationStampOpts) {
		// Sits under the proclamation scroll — which lives in the visual column.
		super(scene, VIS_CX, y);

		const w = 360;
		const h = 54;
		const r = 16;

		// 1. Ambient glow
		this.glow = scene.add.graphics();
		this.glow.lineStyle(2, COLORS.gold, 0.8);
		this.glow.strokeRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, r + 2);
		this.glow.setAlpha(0.4);
		this.add(this.glow);

		if (!settings.reducedMotion) {
			scene.tweens.add({
				targets: this.glow,
				alpha: { from: 0.2, to: 0.8 },
				duration: 900,
				yoyo: true,
				repeat: -1,
				ease: "Sine.easeInOut",
			});
		}

		// 2. Base plate
		const bg = scene.add.graphics();
		bg.fillStyle(0x0e0c16, 0.92);
		bg.fillRoundedRect(-w / 2, -h / 2, w, h, r);
		bg.lineStyle(1.5, COLORS.goldDeep, 0.9);
		bg.strokeRoundedRect(-w / 2, -h / 2, w, h, r);

		// Inner liseré
		bg.lineStyle(1, 0xfff0b8, 0.4);
		bg.strokeRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h - 6, r - 2);
		this.add(bg);

		// 3. Seal icon & text
		const label = scene.add
			.text(0, -5, "⚖ UNMASK THE ADVISOR", {
				fontFamily: FONT.title,
				fontSize: "15px",
				color: hex(COLORS.gold),
				fontStyle: "700",
			})
			.setOrigin(0.5);
		label.setLetterSpacing(1.5);

		const sub = scene.add
			.text(0, 14, "Double-edged · Expose a traitor", {
				fontFamily: FONT.ui,
				fontSize: "11px",
				color: hex(COLORS.muted),
				fontStyle: "500",
			})
			.setOrigin(0.5);

		this.add([label, sub]);

		// Interactive bounds
		this.setSize(w, h).setInteractive({ useHandCursor: true });

		this.on("pointerover", () => {
			if (this.locked) return;
			scene.tweens.add({ targets: this, scale: 1.04, duration: 100 });
		});

		this.on("pointerout", () => {
			if (this.locked) return;
			scene.tweens.add({ targets: this, scale: 1, duration: 120 });
		});

		this.on("pointerdown", () => {
			if (this.locked) return;
			this.locked = true;
			audio.sfx("tap");
			scene.tweens.add({
				targets: this,
				scale: 0.94,
				duration: 80,
				yoyo: true,
				onComplete: () => {
					opts.onAccuse();
					this.dismiss();
				},
			});
		});

		// Entry animation
		this.setAlpha(0).setY(y + 20);
		scene.tweens.add({
			targets: this,
			alpha: 1,
			y,
			duration: settings.reducedMotion ? 120 : 380,
			ease: "Cubic.out",
		});

		scene.add.existing(this);
		this.setDepth(52);
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
			y: "+=16",
			duration: 200,
			onComplete: () => this.destroy(),
		});
	}
}
