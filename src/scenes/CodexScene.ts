import Phaser from "phaser";
import { LEADERS } from "../content/leaders.ts";
import { type CodexEntry, codex, customLeaders } from "../core/state.ts";
import { ScrollList } from "../ui/ScrollList.ts";
import { body, COLORS, FONT, H, hex, ui, W } from "../ui/theme.ts";
import { fadeIn, go, heading, iconButton } from "../ui/widgets.ts";

type Tab = "fact" | "whatif";

/** Everything the player has learned, per civilisation, with completion. */
export class CodexScene extends Phaser.Scene {
	private list: ScrollList | null = null;
	private tabs: Phaser.GameObjects.Text[] = [];

	constructor() {
		super("Codex");
	}

	create() {
		this.tabs = [];
		fadeIn(this);
		this.add.rectangle(W / 2, H / 2, W, H, COLORS.night);
		const bg = this.add.image(W / 2, H / 2, "title_bg");
		bg.setScale(Math.max(W / bg.width, H / bg.height) * 1.1).setAlpha(0.18);
		heading(this, 80, "Codex", 40);
		iconButton(this, 60, 80, "‹", () => go(this, "Title"));
		const total = codex.length;
		this.add
			.text(
				W / 2,
				128,
				`${total} ${total === 1 ? "entry" : "entries"} · ${codex.filter((c) => c.kind === "fact").length} facts · ${codex.filter((c) => c.kind === "whatif").length} what-ifs`,
				ui(18, hex(COLORS.muted)),
			)
			.setOrigin(0.5);
		(["fact", "whatif"] as Tab[]).forEach((t, i) => {
			const txt = this.add
				.text(
					W / 2 + (i - 0.5) * 220,
					190,
					t === "fact" ? "WHAT HAPPENED" : "WHAT IF",
					{
						fontFamily: FONT.title,
						fontSize: "22px",
						color: hex(COLORS.text),
						fontStyle: "700",
					},
				)
				.setOrigin(0.5)
				.setInteractive({ useHandCursor: true });
			txt.setLetterSpacing(3);
			txt.on("pointerup", () => this.setTab(t));
			this.tabs.push(txt);
		});
		this.setTab("fact");
	}

	private setTab(t: Tab) {
		this.tabs.forEach((x, i) =>
			x.setColor(
				hex((i === 0) === (t === "fact") ? COLORS.gold : COLORS.muted),
			),
		);
		this.list?.destroy();
		this.list = new ScrollList(this, 230, H - 30);
		const entries = codex
			.filter((c) => c.kind === t)
			.sort((a, b) => b.at - a.at);
		let y = 10;
		if (!entries.length) {
			this.list.add(
				this.add
					.text(
						W / 2,
						80,
						t === "fact"
							? "Rule, and the chroniclers will fill these pages."
							: "Stray from history to discover what might have been.",
						{
							...body(26, hex(COLORS.muted)),
							align: "center",
							wordWrap: { width: W - 120 },
						},
					)
					.setOrigin(0.5),
			);
			y = 200;
		}
		// group by leader with completion
		const leaders = [...LEADERS, ...customLeaders];
		const byLeader = new Map<string, CodexEntry[]>();
		for (const e of entries)
			byLeader.set(e.leaderId, [...(byLeader.get(e.leaderId) ?? []), e]);
		for (const [lid, list] of byLeader) {
			const l = leaders.find((x) => x.id === lid);
			const pct = Math.min(100, Math.round((list.length / 10) * 100));
			const head = this.add.text(
				40,
				y,
				`${l?.civ.toUpperCase() ?? list[0].leaderName.toUpperCase()}  ·  ${pct}%`,
				{
					fontFamily: FONT.title,
					fontSize: "20px",
					color: hex(COLORS.gold),
					fontStyle: "700",
				},
			);
			head.setLetterSpacing(3);
			const barBg = this.add
				.rectangle(40, y + 34, W - 80, 4, 0xffffff, 0.12)
				.setOrigin(0, 0.5);
			const bar = this.add
				.rectangle(40, y + 34, 0, 4, COLORS.gold)
				.setOrigin(0, 0.5);
			this.tweens.add({
				targets: bar,
				width: (W - 80) * (pct / 100),
				duration: 700,
				ease: "Cubic.out",
			});
			this.list.add([head, barBg, bar]);
			y += 52;
			for (const e of list) {
				const c = this.card(e, y);
				this.list.add(c.obj);
				y += c.h + 14;
			}
			y += 18;
		}
		this.list.setContentHeight(y);
	}

	private card(e: CodexEntry, y: number) {
		const w = W - 64;
		const t = this.add.text(56, y + 52, e.text, {
			fontFamily: FONT.body,
			fontSize: "24px",
			color: hex(COLORS.night),
			wordWrap: { width: w - 48 },
			lineSpacing: 3,
		});
		const h = t.height + 78;
		const g = this.add.graphics();
		g.fillStyle(
			e.kind === "fact" ? COLORS.parchment : COLORS.ink,
			e.kind === "fact" ? 0.95 : 0.9,
		);
		g.fillRoundedRect(32, y, w, h, 14);
		g.lineStyle(2, e.kind === "fact" ? COLORS.goldDeep : COLORS.blood, 0.7);
		g.strokeRoundedRect(32, y, w, h, 14);
		if (e.kind === "whatif") t.setColor(hex(COLORS.text));
		const title = this.add.text(56, y + 16, `${e.year}  ·  ${e.title}`, {
			fontFamily: FONT.title,
			fontSize: "19px",
			color: hex(e.kind === "fact" ? COLORS.goldDeep : COLORS.gold),
			fontStyle: "700",
			wordWrap: { width: w - 48 },
		});
		const c = this.add.container(0, 0, [g, title, t]).setAlpha(0);
		this.tweens.add({
			targets: c,
			alpha: 1,
			duration: 300,
			delay: Math.min(400, y / 6),
		});
		return { obj: c, h };
	}
}
