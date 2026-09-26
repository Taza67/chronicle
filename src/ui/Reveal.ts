import Phaser from "phaser";
import { audio } from "../core/audio.ts";
import { settings } from "../core/state.ts";
import { COLORS, FONT, H, hex, title, W } from "./theme.ts";
import { Button } from "./widgets.ts";

/** Parchment that unrolls to show the historical reveal (or the what-if), a fun fact, and a continue button. */
export class Reveal extends Phaser.GameObjects.Container {
	private textObj: Phaser.GameObjects.Text;
	private continueBtn: Button | null = null;
	private maskG: Phaser.GameObjects.Graphics;
	private readonly pw = W - 56;
	private readonly ph: number;
	private readonly top: number;

	constructor(scene: Phaser.Scene, kind: "history" | "whatif", text: string) {
		super(scene, 0, 0);
		this.top = 190;
		this.ph = H - this.top - 210;
		const shade = scene.add
			.rectangle(W / 2, H / 2, W, H, COLORS.night, 0.45)
			.setInteractive();
		const paper = scene.add.graphics();
		paper.fillStyle(COLORS.parchmentDark, 1);
		paper.fillRoundedRect(
			W / 2 - this.pw / 2 + 6,
			this.top + 8,
			this.pw,
			this.ph,
			12,
		);
		paper.fillStyle(COLORS.parchment, 1);
		paper.fillRoundedRect(W / 2 - this.pw / 2, this.top, this.pw, this.ph, 12);
		// aged texture lines
		paper.lineStyle(1, COLORS.goldDeep, 0.15);
		for (let y = this.top + 40; y < this.top + this.ph - 20; y += 22)
			paper.lineBetween(
				W / 2 - this.pw / 2 + 30,
				y,
				W / 2 + this.pw / 2 - 30,
				y,
			);
		paper.lineStyle(3, COLORS.goldDeep, 0.7);
		paper.strokeRoundedRect(
			W / 2 - this.pw / 2 + 12,
			this.top + 12,
			this.pw - 24,
			this.ph - 24,
			8,
		);
		const head = scene.add
			.text(
				W / 2,
				this.top + 48,
				kind === "history" ? "WHAT HISTORY RECORDS" : "WHAT MIGHT HAVE BEEN",
				title(26, hex(kind === "history" ? COLORS.goldDeep : COLORS.blood)),
			)
			.setOrigin(0.5);
		head.setLetterSpacing(5);
		const rule = scene.add.rectangle(
			W / 2,
			this.top + 78,
			220,
			2,
			COLORS.goldDeep,
			0.6,
		);
		this.textObj = scene.add
			.text(W / 2, this.top + 104, text, {
				fontFamily: FONT.body,
				fontSize: "30px",
				color: hex(COLORS.night),
				wordWrap: { width: this.pw - 90 },
				align: "left",
				lineSpacing: 5,
			})
			.setOrigin(0.5, 0);
		this.add([shade, paper, head, rule, this.textObj]);
		// unroll mask
		this.maskG = scene.make.graphics({ x: 0, y: 0 });
		this.maskG.fillStyle(0xffffff);
		this.maskG.fillRect(0, 0, W, this.top);
		for (const o of [paper, head, rule, this.textObj])
			o.setMask(this.maskG.createGeometryMask());
		scene.add.existing(this);
		this.setDepth(70);
		audio.sfx("reveal");
		scene.tweens.addCounter({
			from: 0,
			to: 1,
			duration: settings.reducedMotion ? 200 : 900,
			ease: "Cubic.out",
			onUpdate: (tw) => {
				this.maskG.clear();
				this.maskG.fillStyle(0xffffff);
				this.maskG.fillRect(
					0,
					0,
					W,
					this.top + (this.ph + 20) * (tw.getValue() ?? 0),
				);
			},
		});
		// the "roll" cylinder at the unroll edge
		const roll = scene.add
			.rectangle(W / 2, this.top, this.pw + 10, 26, COLORS.goldDeep)
			.setDepth(71);
		roll.setStrokeStyle(2, COLORS.gold);
		this.add(roll);
		scene.tweens.add({
			targets: roll,
			y: this.top + this.ph,
			duration: settings.reducedMotion ? 200 : 900,
			ease: "Cubic.out",
			onComplete: () =>
				scene.tweens.add({ targets: roll, alpha: 0, duration: 200 }),
		});
	}

	/** Slide in the fun-fact chip below the reveal text. */
	showFact(text: string, onCodex?: () => void) {
		const s = this.scene;
		const y = Math.min(
			this.top + this.ph - 120,
			this.top + 130 + this.textObj.height + 60,
		);
		const c = s.add.container(W / 2, y);
		const w = this.pw - 70;
		const t = s.add
			.text(-w / 2 + 64, 0, text, {
				fontFamily: FONT.ui,
				fontSize: "19px",
				color: hex(COLORS.text),
				wordWrap: { width: w - 84 },
			})
			.setOrigin(0, 0.5);
		const h = Math.max(70, t.height + 28);
		const g = s.add.graphics();
		g.fillStyle(COLORS.ink, 0.92);
		g.fillRoundedRect(-w / 2, -h / 2, w, h, 14);
		g.lineStyle(2, COLORS.sky, 0.8);
		g.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
		const icon = s.add
			.text(-w / 2 + 32, 0, "✦", {
				fontFamily: FONT.ui,
				fontSize: "30px",
				color: hex(COLORS.sky),
			})
			.setOrigin(0.5);
		c.add([g, icon, t]);
		c.setAlpha(0).setX(W / 2 + 40);
		s.tweens.add({
			targets: c,
			alpha: 1,
			x: W / 2,
			duration: 450,
			ease: "Back.out",
		});
		s.tweens.add({
			targets: icon,
			angle: 360,
			duration: 1800,
			repeat: -1,
			ease: "Linear",
		});
		this.add(c);
		if (onCodex) {
			const chip = s.add
				.text(W / 2, y + h / 2 + 22, "+ added to Codex", {
					fontFamily: FONT.ui,
					fontSize: "16px",
					color: hex(COLORS.sky),
				})
				.setOrigin(0.5)
				.setAlpha(0);
			this.add(chip);
			s.tweens.add({ targets: chip, alpha: 0.9, duration: 400, delay: 500 });
			onCodex();
		}
	}

	waitContinue(label = "Continue"): Promise<void> {
		return new Promise((done) => {
			this.continueBtn = new Button(this.scene, W / 2, H - 120, label, () => {
				this.scene.tweens.add({
					targets: this,
					alpha: 0,
					y: -40,
					duration: 300,
					ease: "Cubic.in",
					onComplete: () => this.destroy(),
				});
				done();
			});
			this.continueBtn.setAlpha(0);
			this.add(this.continueBtn);
			this.scene.tweens.add({
				targets: this.continueBtn,
				alpha: 1,
				duration: 350,
			});
		});
	}
}
