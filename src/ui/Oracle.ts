import Phaser from "phaser";
import { audio } from "../core/audio.ts";
import { settings } from "../core/state.ts";
import { COLORS, FONT, H, hex, title, W } from "./theme.ts";
import { Button } from "./widgets.ts";

/**
 * The Oracle's wager: after choosing, the player bets whether history made the same choice.
 * The coin spins, then lands on the truth.
 */
export class Oracle extends Phaser.GameObjects.Container {
	private coin: Phaser.GameObjects.Image;
	private buttons: Button[] = [];
	private prompt: Phaser.GameObjects.Text;

	constructor(
		scene: Phaser.Scene,
		combo: number,
		onBet: (betHistorical: boolean) => void,
	) {
		super(scene, 0, 0);
		const shade = scene.add
			.rectangle(W / 2, H / 2, W, H, COLORS.night, 0.82)
			.setInteractive();
		this.coin = scene.add
			.image(W / 2, H * 0.36, "coin")
			.setScale(0)
			.setDepth(2);
		const glow = scene.add
			.image(W / 2, H * 0.36, "spark")
			.setScale(14)
			.setTint(COLORS.gold)
			.setAlpha(0.25)
			.setBlendMode(Phaser.BlendModes.ADD);
		scene.tweens.add({
			targets: glow,
			scale: 17,
			alpha: 0.12,
			yoyo: true,
			repeat: -1,
			duration: 1400,
			ease: "Sine.inOut",
		});
		const head = scene.add
			.text(W / 2, H * 0.18, "THE ORACLE ASKS", title(30, hex(COLORS.gold)))
			.setOrigin(0.5)
			.setAlpha(0);
		head.setLetterSpacing(7);
		this.prompt = scene.add
			.text(W / 2, H * 0.55, "Did history choose as you did?", {
				fontFamily: FONT.body,
				fontSize: "36px",
				color: hex(COLORS.text),
				align: "center",
				wordWrap: { width: W - 120 },
			})
			.setOrigin(0.5)
			.setAlpha(0);
		const comboTxt =
			combo > 0
				? scene.add
						.text(
							W / 2,
							H * 0.61,
							`combo ×${Math.min(3, combo + 1)} if right`,
							{
								fontFamily: FONT.ui,
								fontSize: "20px",
								color: hex(COLORS.gold),
							},
						)
						.setOrigin(0.5)
						.setAlpha(0)
				: null;
		this.add([shade, glow, this.coin, head, this.prompt]);
		if (comboTxt) this.add(comboTxt);
		scene.add.existing(this);
		this.setDepth(80);

		audio.sfx("coin");
		scene.tweens.add({
			targets: this.coin,
			scale: 1,
			duration: settings.reducedMotion ? 200 : 650,
			ease: "Back.out",
		});
		scene.tweens.add({
			targets: [head, this.prompt, comboTxt].filter(Boolean),
			alpha: 1,
			duration: 400,
			delay: 350,
		});
		// idle wobble
		scene.tweens.add({
			targets: this.coin,
			angle: { from: -6, to: 6 },
			duration: 900,
			yoyo: true,
			repeat: -1,
			ease: "Sine.inOut",
		});

		const mk = (x: number, label: string, v: boolean) => {
			const b = new Button(
				scene,
				x,
				H * 0.72,
				label,
				() => this.bet(v, onBet),
				{ w: 300, h: 90, primary: v, size: 24 },
			);
			b.setAlpha(0).setY(H * 0.72 + 40);
			scene.tweens.add({
				targets: b,
				alpha: 1,
				y: H * 0.72,
				duration: 400,
				delay: 500 + (v ? 0 : 80),
				ease: "Back.out",
			});
			this.buttons.push(b);
			this.add(b);
		};
		mk(W / 2 - 165, "History did", true);
		mk(W / 2 + 165, "History did not", false);
	}

	private bet(v: boolean, onBet: (v: boolean) => void) {
		for (const b of this.buttons)
			this.scene.tweens.add({ targets: b, alpha: 0, y: "+=30", duration: 200 });
		this.prompt.setText(
			v
				? "You wager: history chose the same."
				: "You wager: history went another way.",
		);
		onBet(v);
	}

	/** Spin the coin then resolve. Resolves after the landing animation. */
	resolve(matched: boolean, legacyGain: number): Promise<void> {
		return new Promise((done) => {
			const s = this.scene;
			s.tweens.killTweensOf(this.coin);
			this.coin.setAngle(0);
			audio.sfx("whoosh");
			// spin: scaleX flips emulate a 3D coin toss, rising and falling
			s.tweens.add({
				targets: this.coin,
				y: H * 0.36 - 160,
				duration: 550,
				yoyo: true,
				ease: "Quad.out",
			});
			s.tweens.add({
				targets: this.coin,
				scaleX: { from: 1, to: -1 },
				duration: 110,
				yoyo: true,
				repeat: settings.reducedMotion ? 2 : 6,
				onComplete: () => {
					this.coin.scaleX = 1;
					const col = matched ? 0x7be08a : 0xd9453a;
					this.coin.setTint(col);
					audio.sfx(matched ? "chime" : "fail");
					s.cameras.main.flash(
						matched ? 220 : 160,
						matched ? 230 : 180,
						matched ? 200 : 40,
						matched ? 120 : 40,
					);
					if (!matched && !settings.reducedMotion)
						s.cameras.main.shake(180, 0.008);
					s.tweens.add({
						targets: this.coin,
						scale: matched ? 1.25 : 0.9,
						duration: 350,
						ease: "Back.out",
					});
					const verdict = s.add
						.text(
							W / 2,
							H * 0.55,
							matched ? "THE ORACLE NODS" : "THE ORACLE SMILES",
							title(34, hex(col)),
						)
						.setOrigin(0.5)
						.setAlpha(0);
					verdict.setLetterSpacing(6);
					this.prompt.setText(
						matched
							? legacyGain > 0
								? `Your reading of history is true.  Legacy +${legacyGain}`
								: "Your reading of history is true."
							: "History had other plans. Combo lost.",
					);
					this.add(verdict);
					s.tweens.add({
						targets: verdict,
						alpha: 1,
						y: H * 0.49,
						duration: 350,
						ease: "Back.out",
					});
					if (matched) {
						const p = s.add.particles(W / 2, H * 0.36, "spark", {
							speed: { min: 120, max: 380 },
							scale: { start: 0.9, end: 0 },
							lifespan: 900,
							tint: [0xffe9a3, 0x7be08a, 0xffffff],
							quantity: 50,
							blendMode: Phaser.BlendModes.ADD,
							emitting: false,
						});
						p.setDepth(85);
						p.explode(50);
						s.time.delayedCall(1200, () => p.destroy());
					}
					s.time.delayedCall(1500, () => {
						s.tweens.add({
							targets: this,
							alpha: 0,
							duration: 350,
							onComplete: () => this.destroy(),
						});
						done();
					});
				},
			});
		});
	}
}
