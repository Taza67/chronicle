import Phaser from "phaser";
import { audio } from "../core/audio.ts";
import { settings } from "../core/state.ts";
import type { GameState, RoyalSeals as SealsState } from "../types.ts";
import { COLORS, FONT, hex, W } from "./theme.ts";
import { toast } from "./widgets.ts";

export interface RoyalSealsCallbacks {
	onPrescience: () => void;
	onTreasury: () => void;
	onDecree: () => void;
}

interface SealDef {
	key: keyof SealsState;
	name: string;
	icon: string;
	color: number;
	borderColor: number;
	desc: string;
}

const SEAL_DEFS: SealDef[] = [
	{
		key: "prescience",
		name: "Prescience",
		icon: "◉",
		color: 0x4a2a6b,
		borderColor: 0xb589d6,
		desc: "Reveals choice consequences and highlights historical paths",
	},
	{
		key: "treasury",
		name: "Treasury",
		icon: "◆",
		color: 0x6e4e10,
		borderColor: 0xe0b64a,
		desc: "+2 Gold immediately at the cost of -1 Stability",
	},
	{
		key: "decree",
		name: "Decree",
		icon: "⚔",
		color: 0x661818,
		borderColor: 0xd9534f,
		desc: "+2 Stability and +1 Trust from all council advisors",
	},
];

/**
 * Three tactile royal wax seals providing emergency tactical edicts to the sovereign.
 * Recharged by winning wagers at the sacred Oracle.
 */
export class RoyalSeals extends Phaser.GameObjects.Container {
	private g: GameState;
	private cb: RoyalSealsCallbacks;
	private sealsContainer: Map<
		keyof SealsState,
		{
			container: Phaser.GameObjects.Container;
			badge: Phaser.GameObjects.Text;
			glow: Phaser.GameObjects.Graphics;
			bg: Phaser.GameObjects.Graphics;
		}
	> = new Map();

	constructor(
		scene: Phaser.Scene,
		y: number,
		g: GameState,
		cb: RoyalSealsCallbacks,
	) {
		super(scene, W / 2, y);
		this.g = g;
		this.cb = cb;

		const bannerW = 460;
		const bannerH = 72;

		// Subtle royal docket backing plate
		const docket = scene.add.graphics();
		docket.fillStyle(COLORS.night, 0.65);
		docket.fillRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 16);
		docket.lineStyle(1.5, COLORS.gold, 0.4);
		docket.strokeRoundedRect(-bannerW / 2, -bannerH / 2, bannerW, bannerH, 16);
		this.add(docket);

		// Render the 3 wax seals
		const spacing = 140;
		SEAL_DEFS.forEach((def, index) => {
			const sx = (index - 1) * spacing;
			const seal = this.createSeal(scene, sx, 0, def);
			this.sealsContainer.set(def.key, seal);
			this.add(seal.container);
		});

		scene.add.existing(this);
		this.setDepth(45);
	}

	private createSeal(
		scene: Phaser.Scene,
		x: number,
		y: number,
		def: SealDef,
	): {
		container: Phaser.GameObjects.Container;
		badge: Phaser.GameObjects.Text;
		glow: Phaser.GameObjects.Graphics;
		bg: Phaser.GameObjects.Graphics;
	} {
		const c = scene.add.container(x, y);
		const available = (this.g.seals[def.key] ?? 1) > 0;

		const glow = scene.add.graphics();
		glow.fillStyle(def.borderColor, 0.4);
		glow.fillCircle(0, 0, 28);
		glow.setAlpha(0);

		const bg = scene.add.graphics();
		this.drawWaxDisc(bg, def, available);

		const icon = scene.add
			.text(0, -6, def.icon, {
				fontSize: "19px",
			})
			.setOrigin(0.5);

		// Below the wax disc (r=24 + 2px shadow) — not tucked under its rim.
		const label = scene.add
			.text(0, 30, def.name.toUpperCase(), {
				fontFamily: FONT.title,
				fontSize: "11px",
				color: hex(available ? COLORS.gold : COLORS.muted),
				fontStyle: "700",
			})
			.setOrigin(0.5);
		label.setLetterSpacing(1);
		// The name must not spill past the wax disc's footprint.
		if (label.width > 68) label.setScale(68 / label.width);

		const badge = scene.add
			.text(16, -16, available ? "1" : "0", {
				fontFamily: FONT.ui,
				fontSize: "11px",
				color: hex(available ? 0xffffff : COLORS.blood),
				fontStyle: "800",
				backgroundColor: hex(available ? COLORS.goldDeep : 0x221111),
				padding: { x: 4, y: 1 },
			})
			.setOrigin(0.5);

		c.add([glow, bg, icon, label, badge]);
		c.setSize(72, 72).setInteractive({ useHandCursor: true });

		c.on("pointerover", () => {
			scene.tweens.add({ targets: c, scale: 1.08, duration: 120 });
			scene.tweens.add({ targets: glow, alpha: 0.8, duration: 120 });
		});

		c.on("pointerout", () => {
			scene.tweens.add({ targets: c, scale: 1, duration: 140 });
			scene.tweens.add({ targets: glow, alpha: 0, duration: 140 });
		});

		c.on("pointerdown", () => {
			const count = this.g.seals[def.key] ?? 0;
			if (count <= 0) {
				audio.sfx("tap");
				scene.tweens.add({
					targets: c,
					x: x + 6,
					duration: 60,
					yoyo: true,
					repeat: 2,
				});
				toast(
					scene,
					`${def.name} Seal spent. Win an Oracle wager to restore it!`,
					COLORS.blood,
				);
				return;
			}

			// Use seal!
			this.g.seals[def.key] = 0;
			audio.sfx("seal_break");

			// Wax shattering particle burst
			if (!settings.reducedMotion && scene.textures.exists("spark")) {
				const p = scene.add.particles(this.x + x, this.y + y, "spark", {
					speed: { min: 40, max: 180 },
					scale: { start: 0.5, end: 0 },
					lifespan: 450,
					tint: [def.borderColor, 0xffffff],
					quantity: 14,
					blendMode: Phaser.BlendModes.ADD,
					emitting: false,
				});
				p.setDepth(60);
				p.explode(14);
				scene.time.delayedCall(500, () => p.destroy());
			}

			this.drawWaxDisc(bg, def, false);
			badge.setText("0");
			badge.setColor(hex(COLORS.blood));
			badge.setBackgroundColor("#221111");
			label.setColor(hex(COLORS.muted));

			scene.tweens.add({
				targets: c,
				scale: 1.15,
				duration: 80,
				yoyo: true,
				onComplete: () => {
					if (def.key === "prescience") this.cb.onPrescience();
					else if (def.key === "treasury") this.cb.onTreasury();
					else if (def.key === "decree") this.cb.onDecree();
				},
			});
		});

		return { container: c, badge, glow, bg };
	}

	private drawWaxDisc(
		g: Phaser.GameObjects.Graphics,
		def: SealDef,
		available: boolean,
	) {
		g.clear();
		const r = 24;

		if (available) {
			// Rich glossy wax seal
			g.fillStyle(0x000000, 0.35);
			g.fillCircle(0, 2, r);

			g.fillStyle(def.color, 1);
			g.fillCircle(0, 0, r);

			// Rim specular
			g.lineStyle(2, def.borderColor, 0.95);
			g.strokeCircle(0, 0, r);

			g.lineStyle(1, 0xffffff, 0.45);
			g.strokeCircle(0, 0, r - 3);

			// Wax highlight arc
			g.lineStyle(1.5, 0xffffff, 0.6);
			g.beginPath();
			g.arc(0, 0, r - 2, -Math.PI * 0.75, -Math.PI * 0.25, false);
			g.strokePath();
		} else {
			// Broken / exhausted wax
			g.fillStyle(0x000000, 0.2);
			g.fillCircle(0, 2, r);

			g.fillStyle(0x221d2a, 0.85);
			g.fillCircle(0, 0, r);

			g.lineStyle(1.5, 0x4a4358, 0.6);
			g.strokeCircle(0, 0, r);

			// Crack lines across seal
			g.lineStyle(1.5, COLORS.blood, 0.7);
			g.lineBetween(-12, -10, 2, 4);
			g.lineBetween(2, 4, 14, 12);
		}
	}

	/** Restore a spent seal with golden animation and chime */
	restoreSeal(key: keyof SealsState) {
		const target = this.sealsContainer.get(key);
		const def = SEAL_DEFS.find((d) => d.key === key);
		if (!target || !def) return;

		this.g.seals[key] = 1;
		this.drawWaxDisc(target.bg, def, true);
		target.badge.setText("1");
		target.badge.setColor("#ffffff");
		target.badge.setBackgroundColor(hex(COLORS.goldDeep));

		audio.sfx("chime");
		this.scene.tweens.add({
			targets: target.container,
			scale: { from: 1.3, to: 1 },
			duration: 400,
			ease: "Back.out",
		});
	}

	dismiss() {
		if (!this.scene?.tweens) {
			this.destroy();
			return;
		}
		this.scene.tweens.add({
			targets: this,
			alpha: 0,
			y: "+=30",
			duration: 220,
			onComplete: () => this.destroy(),
		});
	}
}
