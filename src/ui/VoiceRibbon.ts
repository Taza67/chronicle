import Phaser from "phaser";
import { COLORS, FONT, hex } from "./theme.ts";

export type RibbonState =
	| "standby"
	| "speaking"
	| "processing"
	| "matched"
	| "custom"
	| "retry";

/**
 * Royal Voice Ribbon:
 * An unobtrusive, elegant golden banner resting gracefully above the council cards.
 * Responds passively to sovereign speech in real time with audio wave animation,
 * speech recognition feedback, and seamless decree confirmation.
 */
export class VoiceRibbon extends Phaser.GameObjects.Container {
	private bg: Phaser.GameObjects.Graphics;
	private waveGfx: Phaser.GameObjects.Graphics;
	private icon: Phaser.GameObjects.Text;
	private label: Phaser.GameObjects.Text;

	private ribbonState: RibbonState = "standby";
	private smoothedLevel = 0;
	private wavePhase = 0;
	private breathTween?: Phaser.Tweens.Tween;
	private ellipsisTimer?: Phaser.Time.TimerEvent;

	constructor(scene: Phaser.Scene, x: number, y: number) {
		super(scene, x, y);

		this.bg = scene.add.graphics();
		this.waveGfx = scene.add.graphics();

		this.icon = scene.add
			.text(-190, 0, "🎙", {
				fontFamily: FONT.ui,
				fontSize: "18px",
				color: hex(COLORS.gold),
			})
			.setOrigin(0.5);

		this.label = scene.add
			.text(-165, 0, "Speak your decree, or choose below", {
				fontFamily: FONT.ui,
				fontSize: "15px",
				color: hex(COLORS.muted),
				fontStyle: "500",
			})
			.setOrigin(0, 0.5);

		this.add([this.bg, this.waveGfx, this.icon, this.label]);
		this.setDepth(55);
		this.setAlpha(0);

		this.drawBackground(440, 36, false);

		// Gentle breathing animation in standby
		this.breathTween = scene.tweens.add({
			targets: this,
			alpha: { from: 0.75, to: 0.95 },
			duration: 1600,
			yoyo: true,
			repeat: -1,
			ease: "Sine.inOut",
		});

		scene.add.existing(this);
		scene.events.on(Phaser.Scenes.Events.UPDATE, this.updateWave, this);
		this.once(Phaser.GameObjects.Events.DESTROY, () => {
			scene.events.off(Phaser.Scenes.Events.UPDATE, this.updateWave, this);
			this.breathTween?.stop();
			this.ellipsisTimer?.remove();
		});
	}

	/** Set live microphone level (0..1) from VAD. */
	setLevel(lvl: number) {
		if (lvl > this.smoothedLevel) {
			this.smoothedLevel += (lvl - this.smoothedLevel) * 0.45;
		} else {
			this.smoothedLevel += (lvl - this.smoothedLevel) * 0.12;
		}
	}

	setSpeaking() {
		if (this.ribbonState === "speaking") return;
		this.ribbonState = "speaking";

		this.drawBackground(520, 44, true);
		this.icon.setText("✦").setColor(hex(COLORS.gold));
		this.label
			.setText("The Sovereign speaks…")
			.setColor(hex(COLORS.text))
			.setFontSize(16);

		this.scene.tweens.add({
			targets: this,
			scale: { from: 0.96, to: 1.02 },
			alpha: 1,
			duration: 200,
			ease: "Back.out",
		});
	}

	setProcessing() {
		this.ribbonState = "processing";
		this.waveGfx.clear();
		this.icon.setText("⚙").setColor(hex(COLORS.gold));
		this.label
			.setText("The council weighs your words")
			.setColor(hex(COLORS.gold))
			.setFontSize(15);

		let dots = 0;
		this.ellipsisTimer?.remove();
		this.ellipsisTimer = this.scene.time.addEvent({
			delay: 300,
			loop: true,
			callback: () => {
				if (this.ribbonState !== "processing") return;
				dots = (dots + 1) % 4;
				this.label.setText(`The council weighs your words${".".repeat(dots)}`);
			},
		});
	}

	setMatched(choiceLabel: string, index: number) {
		this.ribbonState = "matched";
		this.ellipsisTimer?.remove();
		this.waveGfx.clear();
		const roman = ["I", "II", "III", "IV"][index] ?? `${index + 1}`;
		this.icon.setText("✦").setColor(hex(COLORS.gold));
		this.label
			.setText(`Option ${roman} : “${choiceLabel}”`)
			.setColor(hex(COLORS.gold))
			.setFontSize(16);

		this.drawBackground(540, 46, true);
		this.scene.tweens.add({
			targets: this,
			scale: { from: 1, to: 1.05 },
			duration: 200,
			yoyo: true,
			repeat: 1,
		});
	}

	setCustom(label: string) {
		this.ribbonState = "custom";
		this.ellipsisTimer?.remove();
		this.waveGfx.clear();
		this.icon.setText("👑").setColor(hex(COLORS.gold));
		this.label
			.setText(`Decree : “${label}”`)
			.setColor(hex(COLORS.text))
			.setFontSize(16);

		this.drawBackground(540, 46, true);
		this.scene.tweens.add({
			targets: this,
			scale: { from: 1, to: 1.05 },
			duration: 200,
			yoyo: true,
			repeat: 1,
		});
	}

	setRetry(hint = "The hall echoes in silence…") {
		this.ribbonState = "retry";
		this.ellipsisTimer?.remove();
		this.waveGfx.clear();
		this.icon.setText("🎙").setColor(hex(COLORS.muted));
		this.label.setText(hint).setColor(hex(COLORS.muted)).setFontSize(14);

		this.scene.time.delayedCall(2200, () => {
			if (this.ribbonState === "retry") {
				this.resetStandby();
			}
		});
	}

	resetStandby() {
		this.ribbonState = "standby";
		this.ellipsisTimer?.remove();
		this.waveGfx.clear();
		this.icon.setText("🎙").setColor(hex(COLORS.gold));
		this.label
			.setText("Speak your decree, or choose below")
			.setColor(hex(COLORS.muted))
			.setFontSize(15);
		this.drawBackground(440, 36, false);
		this.setScale(1);
	}

	private drawBackground(w: number, h: number, glowing: boolean) {
		const g = this.bg;
		g.clear();
		const halfW = w / 2;
		const halfH = h / 2;
		const r = h / 2;

		// Obsidian velvet fill
		g.fillStyle(COLORS.ink, glowing ? 0.94 : 0.82);
		g.fillRoundedRect(-halfW, -halfH, w, h, r);

		if (glowing) {
			// Double gold filigree with warm radiance
			g.lineStyle(2, COLORS.gold, 0.95);
			g.strokeRoundedRect(-halfW, -halfH, w, h, r);
			g.lineStyle(1, COLORS.goldDeep, 0.6);
			g.strokeRoundedRect(-halfW + 3, -halfH + 3, w - 6, h - 6, r - 3);
		} else {
			// Subtle aged gold filament
			g.lineStyle(1.5, COLORS.goldDeep, 0.7);
			g.strokeRoundedRect(-halfW, -halfH, w, h, r);
		}
	}

	private updateWave(_time: number, delta: number) {
		if (this.ribbonState !== "speaking") return;
		const dt = Math.min(delta / 1000, 0.1);
		this.wavePhase += dt * (3 + this.smoothedLevel * 10);

		const g = this.waveGfx;
		g.clear();

		// Draw 7 dynamic audio bars near the right flank of the ribbon
		const numBars = 7;
		const barWidth = 3;
		const gap = 4;
		const startX = 145;
		const maxH = 24;

		for (let i = 0; i < numBars; i++) {
			const x = startX + i * (barWidth + gap);
			const harmonic = Math.sin(this.wavePhase + i * 0.8);
			const h = Math.max(
				4,
				this.smoothedLevel * maxH * (0.4 + 0.6 * Math.abs(harmonic)),
			);
			const alpha = 0.4 + this.smoothedLevel * 0.6;
			g.fillStyle(COLORS.gold, alpha);
			g.fillRoundedRect(x, -h / 2, barWidth, h, 1.5);
		}
	}
}
