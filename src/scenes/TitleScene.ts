import Phaser from "phaser";
import { LEADERS } from "../content/leaders.ts";
import { audio } from "../core/audio.ts";
import { playTitleMusic } from "../core/music.ts";
import { loadGame, reigns, settings } from "../core/state.ts";
import { COLORS, FONT, H, hex, title, ui, W } from "../ui/theme.ts";
import { Button, fadeIn, go, iconButton, motion } from "../ui/widgets.ts";

export class TitleScene extends Phaser.Scene {
	constructor() {
		super("Title");
	}

	create() {
		fadeIn(this, 800);
		const bg = this.add.image(W / 2, H / 2, "title_bg");
		bg.setScale(Math.max(W / bg.width, H / bg.height) * 1.1).setAlpha(0.55);
		this.tweens.add({
			targets: bg,
			x: W / 2 + 18,
			y: H / 2 - 12,
			duration: 14000,
			yoyo: true,
			repeat: -1,
			ease: "Sine.inOut",
		});
		this.add.image(W / 2, H / 2, "vignette").setDisplaySize(W, H);
		this.add.particles(0, 0, "spark", {
			x: { min: 0, max: W },
			y: { min: 0, max: H },
			lifespan: { min: 6000, max: 10000 },
			speedY: { min: -10, max: -28 },
			scale: { start: 0.4, end: 0 },
			alpha: { start: 0, end: 0.8 },
			tint: [COLORS.gold, 0xffffff],
			frequency: settings.reducedMotion ? 500 : 160,
			blendMode: Phaser.BlendModes.ADD,
		});

		// leaders' silhouettes rising in a row, waking up in sequence
		const n = LEADERS.length;
		LEADERS.forEach((l, i) => {
			const x = W / 2 + (i - (n - 1) / 2) * 128;
			const img = this.add
				.image(x, H * 0.5 + Math.abs(i - 2) * 22, `${l.id}/leader`)
				.setScale(0.26)
				.setAlpha(0);
			img.setTint(0x101018);
			this.tweens.add({
				targets: img,
				alpha: 1,
				y: img.y - 20,
				duration: 900,
				delay: 400 + i * 140,
				ease: "Cubic.out",
			});
			this.tweens.addCounter({
				from: 0,
				to: 1,
				delay: 1500 + i * 220,
				duration: 1200,
				onUpdate: (tw) => {
					const v = tw.getValue() ?? 0;
					const c = Phaser.Display.Color.Interpolate.ColorWithColor(
						new Phaser.Display.Color(16, 16, 24),
						new Phaser.Display.Color(255, 255, 255),
						1,
						v,
					);
					img.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));
				},
			});
			this.tweens.add({
				targets: img,
				y: `-=${6 + i}`,
				duration: 2200 + i * 130,
				yoyo: true,
				repeat: -1,
				ease: "Sine.inOut",
				delay: 1400,
			});
			img.setDepth(5 - Math.abs(i - 2));
		});

		// logo
		const logo = this.add
			.text(W / 2, H * 0.22, "CHRONICLE", {
				fontFamily: FONT.title,
				fontSize: "74px",
				color: hex(COLORS.gold),
				fontStyle: "900",
			})
			.setOrigin(0.5)
			.setAlpha(0);
		logo.setLetterSpacing(10);
		logo.setShadow(0, 6, "#000000", 18, false, true);
		this.tweens.add({
			targets: logo,
			alpha: 1,
			scale: { from: 1.25, to: 1 },
			duration: 1100 * motion(),
			ease: "Cubic.out",
			delay: 200,
		});
		const tag = this.add
			.text(W / 2, H * 0.22 + 78, "Rule as they did. Or don't.", {
				...title(26, hex(COLORS.text)),
				fontStyle: "500",
			})
			.setOrigin(0.5)
			.setAlpha(0);
		this.tweens.add({ targets: tag, alpha: 0.9, duration: 900, delay: 1000 });
		// gold shimmer sweep over the logo
		const sweep = this.add
			.rectangle(W / 2 - 300, H * 0.22, 60, 120, 0xffffff, 0.35)
			.setBlendMode(Phaser.BlendModes.ADD)
			.setAngle(18);
		sweep.setMask(logo.createBitmapMask());
		this.tweens.add({
			targets: sweep,
			x: W / 2 + 320,
			duration: 1400,
			repeat: -1,
			repeatDelay: 3200,
			delay: 1600,
			ease: "Quad.inOut",
		});

		// buttons
		const save = loadGame();
		let y = H * 0.7;
		if (save) {
			new Button(
				this,
				W / 2,
				y,
				`Continue: ${save.leader.name}`,
				() => this.start("Court", { resume: true }),
				{ w: 480 },
			);
			y += 100;
			new Button(this, W / 2, y, "New Reign", () => this.start("Select"), {
				w: 480,
				primary: false,
			});
		} else {
			const b = new Button(
				this,
				W / 2,
				y,
				"Begin Your Reign",
				() => this.start("Select"),
				{ w: 480 },
			);
			this.tweens.add({
				targets: b,
				scale: 1.03,
				duration: 900,
				yoyo: true,
				repeat: -1,
				ease: "Sine.inOut",
			});
		}
		y += 120;
		const row = [
			["Codex", "Codex"],
			[
				reigns.length ? `Chronicle (${reigns.length})` : "Chronicle",
				"Chronicle",
			],
		] as const;
		row.forEach(([label, scene], i) => {
			new Button(
				this,
				W / 2 + (i - 0.5) * 250,
				y,
				label,
				() => this.start(scene),
				{ w: 230, h: 70, primary: false, size: 22 },
			);
		});
		iconButton(this, W - 60, 70, "⚙", () =>
			this.start("Settings", { back: "Title" }),
		);

		this.add
			.text(
				W / 2,
				H - 40,
				"Gemini · Gradium · Lyria · Phaser",
				ui(18, hex(COLORS.muted)),
			)
			.setOrigin(0.5)
			.setAlpha(0.8);

		this.input.once("pointerdown", () => {
			audio.unlock();
			playTitleMusic();
		});
	}

	private start(key: string, data?: object) {
		audio.unlock();
		go(this, key, data);
	}
}
