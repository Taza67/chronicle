import Phaser from "phaser";
import { LEADERS } from "../content/leaders.ts";
import { VOICES } from "../content/voices.ts";
import { online } from "../core/api.ts";
import { portraitKeys, queueLeaderArt } from "../core/art.ts";
import { audio } from "../core/audio.ts";
import { generateVerdict } from "../core/generator.ts";
import { say } from "../core/speech.ts";
import {
	addReign,
	loadGame,
	saveGame,
	type VerdictRecord,
} from "../core/state.ts";
import type { GameState } from "../types.ts";
import { Portrait } from "../ui/Portrait.ts";
import { body, COLORS, FONT, H, hex, title, ui, W } from "../ui/theme.ts";
import { Button, fadeIn, go, Subtitle, toast } from "../ui/widgets.ts";

const LOCAL_TITLES: [number, string, string][] = [
	[0.9, "The Faithful Heir", "the Faithful"],
	[0.7, "The Steady Hand", "the Steady"],
	[0.5, "The Gambler", "the Bold"],
	[0.3, "The Reformer", "the Restless"],
	[0, "Chaos Incarnate", "the Unruly"],
];

function localVerdict(g: GameState): VerdictRecord {
	const n = g.history.length || 1;
	const hist = g.history.filter((h) => h.historical).length;
	const r = hist / n;
	const [, t, ep] =
		LOCAL_TITLES.find(([min]) => r >= min) ??
		LOCAL_TITLES[LOCAL_TITLES.length - 1];
	const others = LEADERS.filter((l) => l.id !== g.leader.id);
	const next = others[Math.floor(Math.random() * others.length)];
	return {
		title: t,
		epithet: `${g.leader.name.split(" ")[0]} ${ep}`,
		comment: `${hist} of ${n} decisions followed the path history records. The treasury stands at ${g.stats.gold}, the realm at ${g.stats.stability}, and posterity at ${g.stats.legacy}. The chroniclers will have much to argue about.`,
		leaderLine:
			hist >= n / 2
				? "You ruled almost as I did. Almost. History is kinder to those who dare a little more."
				: "You ruled nothing like me, and yet the realm still stands. Perhaps I worried too much.",
		nextEra: {
			leaderId: next.id,
			name: next.name,
			hook: `Another throne calls: ${next.name} of ${next.civ} awaits your counsel.`,
		},
	};
}

/** End of chapter: drums, title reveal, the real leader speaks, then continue / change era. */
export class VerdictScene extends Phaser.Scene {
	private g!: GameState;

	constructor() {
		super("Verdict");
	}

	init() {
		const g = loadGame();
		if (!g) {
			this.scene.start("Title");
			return;
		}
		this.g = g;
	}

	preload() {
		if (this.g) queueLeaderArt(this, this.g.leader);
	}

	create() {
		if (!this.g) return;
		fadeIn(this, 700);
		const l = this.g.leader;
		const bg = this.add.image(W / 2, H / 2, `${l.id}/scene`);
		bg.setScale(Math.max(W / bg.width, H / bg.height))
			.setAlpha(0.35)
			.setTint(0x8888aa);
		this.add.image(W / 2, H / 2, "vignette").setDisplaySize(W, H);
		void this.run().catch((e) => {
			console.error(e);
			toast(this, "The chroniclers lost their quills.", COLORS.blood);
		});
	}

	private async run() {
		const g = this.g;
		const wait = this.add
			.text(W / 2, H / 2, "The chroniclers deliberate…", {
				...title(28, hex(COLORS.gold)),
				fontStyle: "500",
			})
			.setOrigin(0.5);
		this.tweens.add({
			targets: wait,
			alpha: 0.4,
			yoyo: true,
			repeat: -1,
			duration: 700,
		});
		let v: VerdictRecord;
		try {
			v = online() ? await generateVerdict(g) : localVerdict(g);
		} catch {
			v = localVerdict(g);
		}
		wait.destroy();
		const matched = g.history.filter((h) => h.historical).length;
		audio.sfx("drum");
		this.cameras.main.shake(250, 0.006);
		this.add
			.image(W / 2, H * 0.22, "spark")
			.setScale(22)
			.setTint(COLORS.gold)
			.setAlpha(0.18)
			.setBlendMode(Phaser.BlendModes.ADD);
		const k = this.add
			.text(W / 2, H * 0.08, "THE VERDICT", ui(22, hex(COLORS.gold)))
			.setOrigin(0.5)
			.setAlpha(0);
		k.setLetterSpacing(9);
		const t = this.add
			.text(W / 2, H * 0.15, v.title.toUpperCase(), {
				...title(50, hex(COLORS.text)),
				wordWrap: { width: W - 80 },
				align: "center",
			})
			.setOrigin(0.5)
			.setAlpha(0);
		t.setShadow(0, 5, "#000", 16, false, true);
		const ep = this.add
			.text(W / 2, H * 0.235, v.epithet, {
				...body(30, hex(COLORS.gold)),
				fontStyle: "italic",
				wordWrap: { width: W - 100 },
				align: "center",
			})
			.setOrigin(0.5)
			.setAlpha(0);
		this.tweens.add({ targets: k, alpha: 1, duration: 500, delay: 100 });
		this.tweens.add({
			targets: t,
			alpha: 1,
			scale: { from: 1.4, to: 1 },
			duration: 700,
			delay: 300,
			ease: "Back.out",
		});
		this.tweens.add({
			targets: ep,
			alpha: 1,
			y: H * 0.245,
			duration: 500,
			delay: 800,
		});
		const p = this.add.particles(W / 2, H * 0.15, "spark", {
			speed: { min: 80, max: 300 },
			scale: { start: 0.8, end: 0 },
			lifespan: 1200,
			tint: [COLORS.gold, 0xffffff],
			quantity: 60,
			blendMode: Phaser.BlendModes.ADD,
			emitting: false,
		});
		this.time.delayedCall(350, () => p.explode(60));

		// scorecard
		const card = this.add.container(W / 2, H * 0.33).setAlpha(0);
		card.setDepth(6);
		const cg = this.add.graphics();
		cg.fillStyle(COLORS.night, 0.7);
		cg.fillRoundedRect(-300, -50, 600, 100, 16);
		cg.lineStyle(2, COLORS.gold, 0.6);
		cg.strokeRoundedRect(-300, -50, 600, 100, 16);
		const stats = [
			[`${matched}/${g.history.length}`, "matched history"],
			[
				`${g.stats.gold}·${g.stats.stability}·${g.stats.legacy}`,
				"gold · stability · legacy",
			],
			[`${g.history.filter((h) => h.matched).length}`, "oracle wagers won"],
		];
		stats.forEach(([a, b], i) => {
			const x = (i - 1) * 195;
			card.add(
				this.add
					.text(x, -14, a, {
						fontFamily: FONT.title,
						fontSize: "30px",
						color: hex(COLORS.gold),
						fontStyle: "700",
					})
					.setOrigin(0.5),
			);
			card.add(
				this.add.text(x, 20, b, ui(14, hex(COLORS.muted))).setOrigin(0.5),
			);
		});
		card.addAt(cg, 0);
		this.tweens.add({
			targets: card,
			alpha: 1,
			y: H * 0.32,
			duration: 500,
			delay: 1100,
		});

		// narrator comment
		const sub = new Subtitle(this, H * 0.5);
		sub.setDepth(7);
		const narr = await say(v.comment, VOICES.narrator);
		sub.show("Narrator", v.comment, COLORS.gold, narr.duration * 1000);
		await narr.done;
		sub.hide();

		// the real leader appears and speaks
		const portrait = new Portrait(
			this,
			W / 2,
			H * 0.56,
			portraitKeys(g.leader, "leader"),
			440,
		);
		portrait.setDepth(5);
		portrait.enter(W / 2, 700);
		portrait.setAlpha(0);
		this.tweens.add({ targets: portrait, alpha: 1, duration: 700 });
		portrait.setEmotion(
			matched >= g.history.length / 2 ? "proud" : "amused",
			COLORS.gold,
		);
		const lv = await say(v.leaderLine, g.leader.voice);
		portrait.speak(lv);
		sub.setY(H * 0.8);
		sub.show(g.leader.name, v.leaderLine, COLORS.gold, lv.duration * 1000);
		await lv.done;
		sub.hide();
		// make room for the actions
		this.tweens.add({
			targets: portrait,
			y: H * 0.5,
			scale: 0.72,
			duration: 600,
			ease: "Sine.inOut",
		});

		// record the reign
		addReign({
			leaderId: g.leader.id,
			leaderName: g.leader.name,
			civ: g.leader.civ,
			seasons: g.seasonsPlayed,
			matched,
			total: g.history.length,
			stats: g.stats,
			verdict: { title: v.title, epithet: v.epithet, comment: v.comment },
		});

		// actions
		const y = H * 0.68;
		new Button(
			this,
			W / 2,
			y,
			"Continue the reign",
			() => this.continueReign(),
			{ w: 460 },
		);
		if (v.nextEra) {
			const hook = this.add
				.text(W / 2, y + 70, v.nextEra.hook, {
					...body(21, hex(COLORS.muted)),
					fontStyle: "italic",
					wordWrap: { width: W - 120 },
					align: "center",
				})
				.setOrigin(0.5)
				.setAlpha(0);
			this.tweens.add({ targets: hook, alpha: 1, duration: 500 });
			const target =
				v.nextEra.leaderId && LEADERS.some((x) => x.id === v.nextEra?.leaderId)
					? v.nextEra.leaderId
					: null;
			new Button(
				this,
				W / 2,
				y + 150,
				`Change era: ${v.nextEra.name}`,
				() => this.changeEra(target, v.nextEra?.name ?? ""),
				{ w: 460, primary: false, size: 22 },
			);
		}
		new Button(
			this,
			W / 2,
			y + 240,
			"Share verdict card",
			() => void this.share(v, matched),
			{ w: 300, h: 60, primary: false, size: 20 },
		);
	}

	private continueReign() {
		const g = this.g;
		g.season += 1;
		g.chapter = null;
		g.turnIndex = 0;
		saveGame(g);
		go(this, "Court");
	}

	private changeEra(leaderId: string | null, name: string) {
		saveGame(null);
		if (leaderId) go(this, "Select", { focus: leaderId });
		else go(this, "Summon", { prefill: name });
	}

	private async share(v: VerdictRecord, matched: number) {
		const g = this.g;
		const text = `${v.epithet} — "${v.title}". ${matched}/${g.history.length} decisions matched history. Chronicle: rule as they did. Or don't.`;
		try {
			const canvas = this.game.canvas;
			const blob = await new Promise<Blob | null>((r) =>
				canvas.toBlob(r, "image/png"),
			);
			const nav = navigator as Navigator & {
				canShare?: (d: ShareData) => boolean;
			};
			if (
				blob &&
				nav.share &&
				nav.canShare?.({
					files: [new File([blob], "chronicle.png", { type: "image/png" })],
				})
			) {
				await nav.share({
					text,
					files: [new File([blob], "chronicle.png", { type: "image/png" })],
				});
				return;
			}
			if (nav.share) {
				await nav.share({ text });
				return;
			}
			await navigator.clipboard.writeText(text);
			toast(this, "Verdict copied to clipboard");
		} catch {
			toast(this, "Sharing unavailable here", COLORS.blood);
		}
	}
}
