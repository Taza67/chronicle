import Phaser from "phaser";
import { audio } from "../core/audio.ts";
import { settings } from "../core/state.ts";
import type { Choice } from "../types.ts";
import { COLORS, FONT, H, hex, W } from "./theme.ts";

export interface ChoiceCardsOpts {
	onPick: (index: number) => void;
	onMic?: () => void;
	micAvailable: boolean;
}

/** Choice cards that rise from the bottom with a bounce; tapping one flings the others away. */
export class ChoiceCards extends Phaser.GameObjects.Container {
	private cards: Phaser.GameObjects.Container[] = [];
	private locked = false;
	private mic?: Phaser.GameObjects.Container;

	constructor(scene: Phaser.Scene, choices: Choice[], opts: ChoiceCardsOpts) {
		super(scene, 0, 0);
		const n = choices.length;
		const ch = 96;
		const gap = 14;
		const top = H - 130 - n * (ch + gap) - (opts.micAvailable ? 84 : 0);
		choices.forEach((c, i) => {
			const y = top + i * (ch + gap) + ch / 2;
			const card = this.makeCard(
				scene,
				W / 2,
				y,
				W - 64,
				ch,
				c.label,
				i,
				() => {
					if (this.locked) return;
					this.locked = true;
					audio.sfx("card");
					this.pickAnim(i);
					opts.onPick(i);
				},
			);
			card.setAlpha(0).setY(y + 160);
			scene.tweens.add({
				targets: card,
				y,
				alpha: 1,
				duration: settings.reducedMotion ? 150 : 520,
				delay: i * 110,
				ease: "Back.out",
			});
			this.cards.push(card);
			this.add(card);
		});
		if (opts.micAvailable && opts.onMic) {
			const my = top + n * (ch + gap) + 40;
			this.mic = this.makeCard(
				scene,
				W / 2,
				my,
				300,
				64,
				"🎙  Speak your decision",
				-1,
				() => {
					if (this.locked) return;
					opts.onMic?.();
				},
			);
			this.mic.setAlpha(0);
			scene.tweens.add({
				targets: this.mic,
				alpha: 1,
				duration: 400,
				delay: n * 110 + 200,
			});
			this.add(this.mic);
		}
		scene.add.existing(this);
		this.setDepth(40);
	}

	private makeCard(
		scene: Phaser.Scene,
		x: number,
		y: number,
		w: number,
		h: number,
		label: string,
		i: number,
		onTap: () => void,
	) {
		const c = scene.add.container(x, y);
		const g = scene.add.graphics();
		const isMic = i < 0;
		g.fillStyle(isMic ? COLORS.ink : COLORS.parchment, isMic ? 0.85 : 0.96);
		g.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
		g.lineStyle(2.5, COLORS.gold, isMic ? 0.6 : 0.95);
		g.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);
		if (!isMic) {
			g.fillStyle(COLORS.goldDeep, 1);
			g.fillRoundedRect(-w / 2 + 12, -h / 2 + 12, 6, h - 24, 3);
		}
		const t = scene.add
			.text(isMic ? 0 : -w / 2 + 40, 0, label, {
				fontFamily: isMic ? FONT.ui : FONT.body,
				fontSize: isMic ? "22px" : "31px",
				color: isMic ? hex(COLORS.text) : hex(COLORS.night),
				fontStyle: isMic ? "600" : "600",
				wordWrap: { width: w - 80 },
				align: isMic ? "center" : "left",
			})
			.setOrigin(isMic ? 0.5 : 0, 0.5);
		if (!isMic) {
			const num = scene.add
				.text(w / 2 - 34, 0, ["I", "II", "III", "IV"][i], {
					fontFamily: FONT.title,
					fontSize: "26px",
					color: hex(COLORS.goldDeep),
					fontStyle: "700",
				})
				.setOrigin(0.5);
			c.add(num);
		}
		c.add([g, t]);
		c.setSize(w, h).setInteractive({ useHandCursor: true });
		c.on("pointerdown", () =>
			scene.tweens.add({ targets: c, scale: 0.97, duration: 80 }),
		);
		c.on("pointerup", () => {
			scene.tweens.add({
				targets: c,
				scale: 1,
				duration: 150,
				ease: "Back.out",
			});
			onTap();
		});
		c.on("pointerout", () =>
			scene.tweens.add({ targets: c, scale: 1, duration: 120 }),
		);
		return c;
	}

	/** Highlight one card (used when an advisor decides for the player). */
	flash(i: number) {
		const c = this.cards[i];
		if (c)
			this.scene.tweens.add({
				targets: c,
				scale: 1.04,
				yoyo: true,
				repeat: 2,
				duration: 140,
			});
	}

	pick(i: number) {
		if (this.locked) return;
		this.locked = true;
		this.pickAnim(i);
	}

	private pickAnim(i: number) {
		this.cards.forEach((c, j) => {
			if (j === i) {
				this.scene.tweens.add({
					targets: c,
					y: H * 0.62,
					scale: 1.05,
					duration: 380,
					ease: "Cubic.out",
				});
				this.scene.tweens.add({
					targets: c,
					alpha: 0,
					duration: 250,
					delay: 700,
					onComplete: () => this.destroy(),
				});
			} else {
				this.scene.tweens.add({
					targets: c,
					x: j < i ? -W : W * 2,
					alpha: 0,
					angle: j < i ? -8 : 8,
					duration: 380,
					ease: "Cubic.in",
				});
			}
		});
		if (this.mic)
			this.scene.tweens.add({
				targets: this.mic,
				alpha: 0,
				y: "+=40",
				duration: 250,
			});
	}

	dismiss() {
		this.locked = true;
		this.scene.tweens.add({
			targets: this,
			alpha: 0,
			y: "+=60",
			duration: 250,
			onComplete: () => this.destroy(),
		});
	}
}
