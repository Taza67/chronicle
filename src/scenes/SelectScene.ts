import Phaser from "phaser";
import { LEADERS } from "../content/leaders.ts";
import { queueLeaderArt, texKey } from "../core/art.ts";
import { audio } from "../core/audio.ts";
import { customLeaders, newGame, saveGame } from "../core/state.ts";
import type { Leader } from "../types.ts";
import { body, COLORS, FONT, H, hex, title, ui, W } from "../ui/theme.ts";
import {
	Button,
	fadeIn,
	go,
	heading,
	iconButton,
	motion,
} from "../ui/widgets.ts";

const CARD_W = 520;
const GAP = 560;

/** Swipeable leader carousel. */
export class SelectScene extends Phaser.Scene {
	private leaders: Leader[] = [];
	private index = 0;
	private track!: Phaser.GameObjects.Container;
	private cards: Phaser.GameObjects.Container[] = [];
	private info!: {
		name: Phaser.GameObjects.Text;
		civ: Phaser.GameObjects.Text;
		quote: Phaser.GameObjects.Text;
	};
	private dragX = 0;
	private dragging = false;

	constructor() {
		super("Select");
	}

	init(data: { focus?: string }) {
		this.leaders = [...customLeaders, ...LEADERS];
		this.index = Math.max(
			0,
			this.leaders.findIndex((l) => l.id === data?.focus),
		);
	}

	preload() {
		for (const l of customLeaders) queueLeaderArt(this, l);
	}

	create() {
		fadeIn(this);
		const bg = this.add.image(W / 2, H / 2, "title_bg");
		bg.setScale(Math.max(W / bg.width, H / bg.height) * 1.1).setAlpha(0.35);
		this.add.image(W / 2, H / 2, "vignette").setDisplaySize(W, H);
		heading(this, 90, "Choose your reign", 34);
		iconButton(this, 60, 90, "‹", () => go(this, "Title"));

		this.track = this.add.container(0, H * 0.43);
		this.leaders.forEach((l, i) => {
			const c = this.add.container(W / 2 + i * GAP, 0);
			const frame = this.add.graphics();
			const col = Phaser.Display.Color.HexStringToColor(
				l.palette.primary,
			).color;
			frame.fillStyle(col, 0.35);
			frame.fillRoundedRect(
				-CARD_W / 2 - 8,
				-CARD_W * 0.66 - 8,
				CARD_W + 16,
				CARD_W * 1.32 + 16,
				26,
			);
			frame.lineStyle(4, COLORS.gold, 0.9);
			frame.strokeRoundedRect(
				-CARD_W / 2 - 8,
				-CARD_W * 0.66 - 8,
				CARD_W + 16,
				CARD_W * 1.32 + 16,
				26,
			);
			const img = this.add.image(0, 0, texKey(l.id, "leader"));
			img.setDisplaySize(CARD_W, CARD_W * 1.32);
			// rounded mask
			const mg = this.make.graphics({ x: 0, y: 0 });
			mg.fillStyle(0xffffff);
			mg.fillRoundedRect(
				c.x - CARD_W / 2,
				this.track.y - CARD_W * 0.66,
				CARD_W,
				CARD_W * 1.32,
				20,
			);
			img.setMask(mg.createGeometryMask());
			c.add([frame, img]);
			c.setData("mask", mg);
			if (l.generated) {
				const tag = this.add
					.text(0, -CARD_W * 0.66 + 26, "SUMMONED", ui(18, hex(COLORS.gold)))
					.setOrigin(0.5);
				tag.setLetterSpacing(4);
				c.add(tag);
			}
			this.track.add(c);
			this.cards.push(c);
		});

		const name = this.add
			.text(W / 2, H * 0.745, "", {
				fontFamily: FONT.title,
				fontSize: "46px",
				color: hex(COLORS.gold),
				fontStyle: "700",
			})
			.setOrigin(0.5);
		name.setShadow(0, 3, "#000", 10, false, true);
		const civ = this.add
			.text(W / 2, H * 0.745 + 46, "", {
				...title(22, hex(COLORS.text)),
				fontStyle: "500",
			})
			.setOrigin(0.5);
		const quote = this.add
			.text(W / 2, H * 0.745 + 100, "", {
				...body(26, hex(COLORS.muted)),
				fontStyle: "italic",
				align: "center",
				wordWrap: { width: W - 120 },
			})
			.setOrigin(0.5);
		this.info = { name, civ, quote };

		// dots
		const dots = this.leaders.map((_, i) =>
			this.add.circle(
				W / 2 + (i - (this.leaders.length - 1) / 2) * 22,
				H * 0.7,
				5,
				COLORS.gold,
				i === this.index ? 1 : 0.3,
			),
		);
		this.events.on("index", (i: number) =>
			dots.forEach((d, j) => d.setAlpha(j === i ? 1 : 0.3)),
		);

		new Button(this, W / 2, H * 0.905, "Take the Throne", () => this.begin(), {
			w: 440,
		});
		new Button(
			this,
			W / 2,
			H * 0.905 + 90,
			"✦ Summon another leader",
			() => go(this, "Summon"),
			{ w: 440, h: 64, primary: false, size: 22 },
		);

		// swipe
		this.input.on(
			Phaser.Input.Events.POINTER_DOWN,
			(p: Phaser.Input.Pointer) => {
				if (p.y > H * 0.12 && p.y < H * 0.86 && p.x > 100 && p.x < W - 100) {
					this.dragging = true;
					this.dragX = p.x;
				}
			},
		);
		this.input.on(
			Phaser.Input.Events.POINTER_MOVE,
			(p: Phaser.Input.Pointer) => {
				if (!this.dragging) return;
				this.track.x = -this.index * GAP + (p.x - this.dragX);
			},
		);
		this.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
			if (!this.dragging) return;
			this.dragging = false;
			const dx = p.x - this.dragX;
			if (dx < -60) this.step(1);
			else if (dx > 60) this.step(-1);
			else {
				// tap on a side card brings it to the front
				const rel = Math.round((p.x - W / 2) / GAP);
				if (rel !== 0 && Math.abs(p.y - this.track.y) < CARD_W * 0.66)
					this.step(rel);
				else this.snap();
			}
		});
		iconButton(this, 48, H * 0.43, "‹", () => this.step(-1));
		iconButton(this, W - 48, H * 0.43, "›", () => this.step(1));
		this.track.x = -this.index * GAP;
		this.snap(true);
	}

	private step(d: number) {
		this.index = Phaser.Math.Clamp(this.index + d, 0, this.leaders.length - 1);
		this.snap();
	}

	private snap(instant = false) {
		audio.sfx("card");
		this.tweens.add({
			targets: this.track,
			x: -this.index * GAP,
			duration: instant ? 0 : 320 * motion(),
			ease: "Back.out",
		});
		this.cards.forEach((c, i) => {
			const active = i === this.index;
			this.tweens.add({
				targets: c,
				scale: active ? 1 : 0.86,
				alpha: active ? 1 : 0.5,
				duration: instant ? 0 : 300,
			});
		});
		const l = this.leaders[this.index];
		this.info.name.setText(l.name);
		this.info.civ.setText(`${l.civ.toUpperCase()}  ·  ${l.era}`);
		this.info.quote.setText(`“${l.quote}”`);
		for (const t of Object.values(this.info))
			this.tweens.add({
				targets: t,
				alpha: { from: 0, to: 1 },
				duration: 260,
			});
		this.events.emit("index", this.index);
	}

	update() {
		// masks follow the track
		for (const c of this.cards) {
			const mg = c.getData("mask") as Phaser.GameObjects.Graphics;
			mg.setScale(c.scale);
			mg.x = this.track.x + c.x * (1 - c.scale);
			mg.y = this.track.y * (1 - c.scale);
		}
	}

	private begin() {
		const leader = this.leaders[this.index];
		const g = newGame(leader);
		saveGame(g);
		go(this, "Court", { resume: true });
	}
}
