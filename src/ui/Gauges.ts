import Phaser from "phaser";
import { audio } from "../core/audio.ts";
import { settings } from "../core/state.ts";
import type { Effects, Stat } from "../types.ts";
import { COLORS, FONT, hex, STAT_META, W } from "./theme.ts";

const STATS: Stat[] = ["gold", "stability", "legacy"];

/** Three elastic gauges (0–10) with impact flashes and floating deltas. */
export class Gauges extends Phaser.GameObjects.Container {
	private bars: Record<
		Stat,
		{
			fill: Phaser.GameObjects.Graphics;
			value: { v: number };
			label: Phaser.GameObjects.Text;
			x: number;
		}
	>;
	private readonly bw = 190;
	private readonly bh = 14;

	constructor(scene: Phaser.Scene, y: number, stats: Effects) {
		super(scene, 0, y);
		const bg = scene.add.graphics();
		bg.fillStyle(COLORS.night, 0.55);
		bg.fillRoundedRect(16, -34, W - 32, 78, 18);
		bg.lineStyle(1.5, COLORS.gold, 0.35);
		bg.strokeRoundedRect(16, -34, W - 32, 78, 18);
		this.add(bg);
		this.bars = {} as typeof this.bars;
		STATS.forEach((s, i) => {
			const x = 40 + i * (this.bw + 36);
			const meta = STAT_META[s];
			const label = scene.add.text(
				x,
				-22,
				`${meta.icon} ${meta.label.toUpperCase()}  ${stats[s]}`,
				{
					fontFamily: FONT.ui,
					fontSize: "17px",
					color: hex(meta.color),
					fontStyle: "600",
				},
			);
			label.setLetterSpacing(1.5);
			const track = scene.add.graphics();
			track.fillStyle(0x000000, 0.5);
			track.fillRoundedRect(x, 8, this.bw, this.bh, 7);
			const fill = scene.add.graphics();
			this.add([label, track, fill]);
			this.bars[s] = { fill, value: { v: stats[s] }, label, x };
			this.draw(s);
		});
		scene.add.existing(this);
		this.setDepth(50);
	}

	private draw(s: Stat) {
		const b = this.bars[s];
		const meta = STAT_META[s];
		b.fill.clear();
		const w = Math.max(0, (b.value.v / 10) * this.bw);
		if (w > 0) {
			b.fill.fillStyle(meta.color, 1);
			b.fill.fillRoundedRect(b.x, 8, w, this.bh, 7);
			b.fill.fillStyle(0xffffff, 0.25);
			b.fill.fillRoundedRect(
				b.x + 2,
				9,
				Math.max(0, w - 4),
				this.bh / 2 - 1,
				4,
			);
		}
		// danger glow
		if (b.value.v <= 1.5) {
			b.fill.lineStyle(2, COLORS.blood, 0.9);
			b.fill.strokeRoundedRect(b.x - 2, 6, this.bw + 4, this.bh + 4, 9);
		}
	}

	/** Animate to new values; shows +/- chips. */
	apply(next: Effects, delta: Effects) {
		STATS.forEach((s, i) => {
			const b = this.bars[s];
			const d = delta[s];
			const target = next[s];
			this.scene.time.delayedCall(i * 140, () => {
				if (d !== 0) audio.sfx(d > 0 ? "up" : "down");
				this.scene.tweens.add({
					targets: b.value,
					v: target,
					duration: settings.reducedMotion ? 200 : 700,
					ease: d > 0 ? "Back.out" : "Bounce.out",
					onUpdate: () => {
						this.draw(s);
						b.label.setText(
							`${STAT_META[s].icon} ${STAT_META[s].label.toUpperCase()}  ${Math.round(b.value.v)}`,
						);
					},
				});
				if (d !== 0) {
					const chip = this.scene.add
						.text(b.x + this.bw / 2, this.y + 30, `${d > 0 ? "+" : ""}${d}`, {
							fontFamily: FONT.title,
							fontSize: "34px",
							color: d > 0 ? hex(COLORS.text) : hex(COLORS.blood),
							fontStyle: "900",
						})
						.setOrigin(0.5)
						.setDepth(60);
					chip.setShadow(0, 2, "#000", 6, false, true);
					this.scene.tweens.add({
						targets: chip,
						y: this.y + 80,
						alpha: 0,
						scale: { from: 1.4, to: 1 },
						duration: 900,
						ease: "Cubic.out",
						onComplete: () => chip.destroy(),
					});
					// impact flash
					const flash = this.scene.add
						.rectangle(
							b.x + this.bw / 2,
							this.y + 15,
							this.bw + 12,
							this.bh + 12,
							0xffffff,
							0.6,
						)
						.setDepth(55);
					this.scene.tweens.add({
						targets: flash,
						alpha: 0,
						scaleX: 1.15,
						duration: 300,
						onComplete: () => flash.destroy(),
					});
					if (!settings.reducedMotion)
						this.scene.cameras.main.shake(120, d < 0 ? 0.004 : 0.002);
				}
			});
		});
	}
}
