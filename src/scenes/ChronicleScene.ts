import Phaser from "phaser";
import { reigns } from "../core/state.ts";
import { ScrollList } from "../ui/ScrollList.ts";
import { body, COLORS, FONT, H, hex, ui, W } from "../ui/theme.ts";
import { fadeIn, go, heading, iconButton } from "../ui/widgets.ts";

/** The player's own chronicle: every reign, its verdict, its numbers. */
export class ChronicleScene extends Phaser.Scene {
	constructor() {
		super("Chronicle");
	}

	create() {
		fadeIn(this);
		this.add.rectangle(W / 2, H / 2, W, H, COLORS.night);
		const bg = this.add.image(W / 2, H / 2, "title_bg");
		bg.setScale(Math.max(W / bg.width, H / bg.height) * 1.1).setAlpha(0.18);
		heading(this, 80, "Your Chronicle", 40);
		iconButton(this, 60, 80, "‹", () => go(this, "Title"));
		const total = reigns.reduce((n, r) => n + r.total, 0);
		const matched = reigns.reduce((n, r) => n + r.matched, 0);
		this.add
			.text(
				W / 2,
				128,
				reigns.length
					? `${reigns.length} reigns · ${matched}/${total} decisions matched history`
					: "No reign recorded yet",
				ui(18, hex(COLORS.muted)),
			)
			.setOrigin(0.5);

		const list = new ScrollList(this, 170, H - 30);
		let y = 10;
		if (!reigns.length) {
			list.add(
				this.add
					.text(W / 2, 120, "Your first verdict will be written here.", {
						...body(26, hex(COLORS.muted)),
						align: "center",
					})
					.setOrigin(0.5),
			);
			y = 240;
		}
		// timeline spine
		const spine = this.add
			.rectangle(48, 0, 3, Math.max(1, reigns.length * 230), COLORS.gold, 0.35)
			.setOrigin(0.5, 0);
		list.add(spine);
		for (const r of [...reigns].sort((a, b) => b.at - a.at)) {
			const w = W - 110;
			const x = 78;
			const comment = this.add.text(x + 20, y + 98, r.verdict.comment, {
				fontFamily: FONT.body,
				fontSize: "22px",
				color: hex(COLORS.night),
				wordWrap: { width: w - 40 },
				lineSpacing: 2,
			});
			const h = comment.height + 130;
			const g = this.add.graphics();
			g.fillStyle(COLORS.parchment, 0.95);
			g.fillRoundedRect(x, y, w, h, 14);
			g.lineStyle(2, COLORS.goldDeep, 0.7);
			g.strokeRoundedRect(x, y, w, h, 14);
			const dot = this.add.circle(48, y + 30, 9, COLORS.gold);
			dot.setStrokeStyle(3, COLORS.night);
			const t = this.add.text(x + 20, y + 16, r.verdict.title.toUpperCase(), {
				fontFamily: FONT.title,
				fontSize: "24px",
				color: hex(COLORS.goldDeep),
				fontStyle: "700",
			});
			t.setLetterSpacing(2);
			const ep = this.add.text(
				x + 20,
				y + 48,
				`${r.verdict.epithet}  ·  ${r.civ}`,
				{
					fontFamily: FONT.body,
					fontSize: "20px",
					color: hex(COLORS.ink),
					fontStyle: "italic",
				},
			);
			const nums = this.add
				.text(
					x + w - 20,
					y + 20,
					`${r.matched}/${r.total}  ·  ${r.stats.gold}·${r.stats.stability}·${r.stats.legacy}`,
					ui(16, hex(COLORS.ink)),
				)
				.setOrigin(1, 0);
			const date = this.add
				.text(
					x + w - 20,
					y + h - 26,
					new Date(r.at).toLocaleDateString(),
					ui(14, hex(COLORS.ink)),
				)
				.setOrigin(1, 0.5)
				.setAlpha(0.7);
			const c = this.add
				.container(0, 0, [g, dot, t, ep, nums, comment, date])
				.setAlpha(0)
				.setX(40);
			this.tweens.add({
				targets: c,
				alpha: 1,
				x: 0,
				duration: 400,
				delay: Math.min(500, y / 4),
				ease: "Cubic.out",
			});
			list.add(c);
			y += h + 22;
		}
		list.setContentHeight(y);
	}
}
