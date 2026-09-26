import Phaser from "phaser";
import { LEADERS } from "../content/leaders.ts";
import { VOICES } from "../content/voices.ts";
import { online } from "../core/api.ts";
import { portraitKeys, queueLeaderArt } from "../core/art.ts";
import { audio, type VoiceHandle } from "../core/audio.ts";
import { generateVerdict } from "../core/generator.ts";
import { say } from "../core/speech.ts";
import {
	addReign,
	loadGame,
	newGame,
	saveGame,
	settings,
	unlockRelic,
	type VerdictRecord,
} from "../core/state.ts";
import type { GameState, Leader } from "../types.ts";
import { Portrait } from "../ui/Portrait.ts";
import {
	body,
	COLORS,
	FONT,
	H,
	hex,
	STAT_META,
	title,
	ui,
	W,
} from "../ui/theme.ts";
import { Button, fadeIn, go, Subtitle, toast } from "../ui/widgets.ts";

const LOCAL_TITLES: [number, string, string][] = [
	[0.9, "The Faithful Heir", "the Faithful"],
	[0.7, "The Steady Hand", "the Steady"],
	[0.5, "The Gambler", "the Bold"],
	[0.3, "The Reformer", "the Restless"],
	[0, "Chaos Incarnate", "the Unruly"],
];

export function localVerdict(g: GameState): VerdictRecord {
	const n = g.history.length || 1;
	const hist = g.history.filter((h) => h.historical).length;
	const others = LEADERS.filter((l) => l.id !== g.leader.id);
	const next = others[Math.floor(Math.random() * others.length)];

	if (g.collapse === "bankruptcy") {
		return {
			title: "The Fallen Monarch",
			epithet: `${g.leader.name.split(" ")[0]} the Ruined`,
			comment: `The royal treasury was emptied to the last coin. With soldiers unpaid and debts mounting, your reign collapsed into bankruptcy after ${n} decisions. The kingdom falls to creditors and chaos.`,
			leaderLine:
				"An empire cannot rule on empty vaults. When the treasury ran dry, my crown was worth less than lead. We have failed.",
			nextEra: {
				leaderId: next.id,
				name: next.name,
				hook: `Another throne calls: ${next.name} of ${next.civ} awaits your counsel.`,
			},
		};
	}
	if (g.collapse === "revolt") {
		return {
			title: "Deposed in Chaos",
			epithet: `${g.leader.name.split(" ")[0]} the Overthrown`,
			comment: `Order in the realm shattered completely. Open rebellion consumed the capital and your authority broke after ${n} decisions. Your throne is lost to the flames of uprising.`,
			leaderLine:
				"The people took to the streets and the court fled in terror. You pushed the realm to revolt, and our crown was lost.",
			nextEra: {
				leaderId: next.id,
				name: next.name,
				hook: `Another throne calls: ${next.name} of ${next.civ} awaits your counsel.`,
			},
		};
	}

	const r = hist / n;
	const [, t, ep] =
		LOCAL_TITLES.find(([min]) => r >= min) ??
		LOCAL_TITLES[LOCAL_TITLES.length - 1];
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

/** End of chapter: imperial hall of judgment, monumental proclamation, triumphal summary plaque. */
export class VerdictScene extends Phaser.Scene {
	private g!: GameState;
	private alive = true;

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
		this.alive = true;
	}

	preload() {
		if (this.g) queueLeaderArt(this, this.g.leader);
	}

	create() {
		if (!this.g) return;
		this.alive = true;
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.alive = false;
			audio.setMusicSituation("normal");
		});

		fadeIn(this, 700);
		const isCollapsed = Boolean(this.g.collapse);

		if (isCollapsed) {
			audio.setMusicSituation("collapse");
			this.time.delayedCall(4500, () => audio.stopMusic(3));
		} else {
			audio.setMusicSituation("triumph");
		}

		this.setupHallAtmosphere(this.g.leader, isCollapsed);

		void this.run().catch((e) => {
			if (!this.alive) return;
			console.error(e);
			toast(this, "The chroniclers lost their quills.", COLORS.blood);
		});
	}

	/** Set up the grand imperial hall atmosphere, pillars, lighting, and ambient motes. */
	private setupHallAtmosphere(leader: Leader, collapsed: boolean) {
		const bg = this.add.image(W / 2, H / 2, `${leader.id}/scene`);
		const scale = Math.max(W / bg.width, H / bg.height) * 1.05;
		bg.setScale(scale)
			.setAlpha(collapsed ? 0.44 : 0.38)
			.setTint(collapsed ? 0x581d1d : 0x7a748c);

		// Subtle atmospheric camera/backdrop breathing
		if (!settings.reducedMotion) {
			this.tweens.add({
				targets: bg,
				scale: scale * 1.03,
				duration: collapsed ? 8000 : 14000,
				yoyo: true,
				repeat: -1,
				ease: "Sine.inOut",
			});
		}

		// Vignette overlay
		const vig = this.add.image(W / 2, H / 2, "vignette").setDisplaySize(W, H);
		if (collapsed) {
			vig.setTint(0x701212);
		}

		// Architectural hall framing (left and right gilded pilaster hairlines)
		const frameG = this.add.graphics();
		frameG.setDepth(2);
		const colCol = collapsed ? 0x4a1818 : COLORS.goldDeep;
		const colAlpha = collapsed ? 0.45 : 0.6;

		// Left & right pillar lines
		frameG.lineStyle(1.5, colCol, colAlpha);
		frameG.lineBetween(24, 40, 24, H - 40);
		frameG.lineBetween(W - 24, 40, W - 24, H - 40);

		// Capital brackets and base plinths
		for (const x of [24, W - 24]) {
			frameG.strokeRect(x - 8, 40, 16, 8);
			frameG.strokeRect(x - 8, H - 48, 16, 8);
		}

		// Vault frieze across the top
		frameG.lineStyle(1, colCol, colAlpha * 0.7);
		frameG.lineBetween(24, 44, W - 24, 44);

		if (collapsed) {
			// Smoldering ruins underglow
			const underglow = this.add.graphics();
			underglow.setDepth(2);
			underglow.fillStyle(COLORS.blood, 0.22);
			underglow.fillRect(0, H * 0.65, W, H * 0.35);

			if (!settings.reducedMotion) {
				this.tweens.add({
					targets: underglow,
					alpha: 0.08,
					yoyo: true,
					repeat: -1,
					duration: 1800,
					ease: "Sine.inOut",
				});
			}

			// Rising deep crimson embers
			this.add
				.particles(0, 0, "spark", {
					x: { min: 20, max: W - 20 },
					y: { min: H * 0.55, max: H * 1.02 },
					lifespan: { min: 2600, max: 4600 },
					speedY: { min: -45, max: -160 },
					speedX: { min: -25, max: 25 },
					scale: { start: 0.75, end: 0.05 },
					alpha: { start: 0.85, end: 0, ease: "Sine.out" },
					tint: [COLORS.blood, 0x731515, 0x3d0707],
					frequency: settings.reducedMotion ? 250 : 80,
					blendMode: Phaser.BlendModes.ADD,
				})
				.setDepth(3);
		} else {
			// Celestial judgment light beams
			const raysG = this.add.graphics();
			raysG.setDepth(1);
			raysG.fillStyle(COLORS.gold, 0.04);
			const rayPolys = [
				[
					W / 2 - 180,
					0,
					W / 2 - 120,
					0,
					W / 2 - 290,
					H * 0.6,
					W / 2 - 380,
					H * 0.6,
				],
				[
					W / 2 - 70,
					0,
					W / 2 - 20,
					0,
					W / 2 - 140,
					H * 0.7,
					W / 2 - 210,
					H * 0.7,
				],
				[
					W / 2 - 20,
					0,
					W / 2 + 20,
					0,
					W / 2 - 60,
					H * 0.8,
					W / 2 + 60,
					H * 0.8,
				],
				[
					W / 2 + 20,
					0,
					W / 2 + 70,
					0,
					W / 2 + 210,
					H * 0.7,
					W / 2 + 140,
					H * 0.7,
				],
				[
					W / 2 + 120,
					0,
					W / 2 + 180,
					0,
					W / 2 + 380,
					H * 0.6,
					W / 2 + 290,
					H * 0.6,
				],
			];
			for (const p of rayPolys) {
				raysG.beginPath();
				raysG.moveTo(p[0], p[1]);
				for (let i = 2; i < p.length; i += 2) {
					raysG.lineTo(p[i], p[i + 1]);
				}
				raysG.closePath();
				raysG.fillPath();
			}
			raysG.setBlendMode(Phaser.BlendModes.ADD);

			if (!settings.reducedMotion) {
				this.tweens.add({
					targets: raysG,
					alpha: 0.5,
					yoyo: true,
					repeat: -1,
					duration: 3800,
					ease: "Sine.inOut",
				});
			}

			// Floating golden sanctuary motes
			this.add
				.particles(0, 0, "spark", {
					x: { min: 20, max: W - 20 },
					y: { min: 40, max: H - 40 },
					lifespan: { min: 4500, max: 8000 },
					speedY: { min: -10, max: -30 },
					speedX: { min: -15, max: 15 },
					scale: { start: 0.35, end: 0 },
					alpha: { start: 0, end: 0.5 },
					tint: [COLORS.gold, 0xfff4cc, 0xffffff],
					frequency: settings.reducedMotion ? 400 : 150,
					blendMode: Phaser.BlendModes.ADD,
				})
				.setDepth(3);
		}
	}

	/** Draw a pointed faceted laurel leaf polygon on Graphics. */
	private drawLeaf(
		g: Phaser.GameObjects.Graphics,
		lx: number,
		ly: number,
		angle: number,
		len: number,
		w: number,
		fillCol: number,
		strokeCol: number,
	) {
		const tipX = lx + Math.cos(angle) * len;
		const tipY = ly + Math.sin(angle) * len;
		const midX = lx + Math.cos(angle) * (len * 0.45);
		const midY = ly + Math.sin(angle) * (len * 0.45);
		const perpX = -Math.sin(angle) * (w / 2);
		const perpY = Math.cos(angle) * (w / 2);

		g.fillStyle(fillCol, 1);
		g.beginPath();
		g.moveTo(lx, ly);
		g.lineTo(midX + perpX, midY + perpY);
		g.lineTo(tipX, tipY);
		g.lineTo(midX - perpX, midY - perpY);
		g.closePath();
		g.fillPath();

		g.lineStyle(1, strokeCol, 0.85);
		g.strokePath();
	}

	/** Draw imperial laurel wreath and crown crest. */
	private drawImperialCrest(
		x: number,
		y: number,
		collapsed: boolean,
	): Phaser.GameObjects.Container {
		const c = this.add.container(x, y);
		const g = this.add.graphics();

		if (collapsed) {
			// Fractured broken crown and withered scorched wreath
			// Scorched leaves left side
			const leafFill = 0x3d1717;
			const leafStroke = 0x1c0707;
			const stemCol = 0x471818;

			// Left withered stem
			g.lineStyle(2, stemCol, 0.8);
			g.beginPath();
			g.moveTo(-16, 12);
			g.lineTo(-44, 4);
			g.lineTo(-68, -12);
			g.lineTo(-76, -26);
			g.strokePath();

			this.drawLeaf(g, -34, 7, -2.1, 14, 5.5, leafFill, leafStroke);
			this.drawLeaf(g, -54, -3, -2.3, 13, 5, leafFill, leafStroke);
			this.drawLeaf(g, -72, -18, -2.5, 12, 4.5, leafFill, leafStroke);

			// Right fractured stem (broken off early)
			g.beginPath();
			g.moveTo(16, 12);
			g.lineTo(44, 4);
			g.lineTo(60, -6);
			g.strokePath();

			this.drawLeaf(g, 34, 7, -1.0, 13, 5, leafFill, leafStroke);
			this.drawLeaf(g, 52, -1, -0.8, 12, 4.5, leafFill, leafStroke);

			// Shattered crown: left half tilted down-left, right half tilted up-right
			const drawCrownHalf = (
				dir: number,
				angleDeg: number,
				offsetX: number,
				offsetY: number,
			) => {
				const rad = Phaser.Math.DegToRad(angleDeg);
				const cos = Math.cos(rad);
				const sin = Math.sin(rad);
				const tx = (px: number, py: number) => ({
					x: offsetX + px * cos - py * sin,
					y: offsetY + px * sin + py * cos,
				});

				const p0 = tx(dir * 2, -6);
				const p1 = tx(dir * 18, -6);
				const p2 = tx(dir * 18, -12);
				const p3 = tx(dir * 14, -26);
				const p4 = tx(dir * 8, -17);
				const p5 = tx(dir * 2, -32);

				g.fillStyle(0x421818, 1);
				g.beginPath();
				g.moveTo(p0.x, p0.y);
				g.lineTo(p1.x, p1.y);
				g.lineTo(p2.x, p2.y);
				g.lineTo(p3.x, p3.y);
				g.lineTo(p4.x, p4.y);
				g.lineTo(p5.x, p5.y);
				g.closePath();
				g.fillPath();

				g.lineStyle(1.5, 0x8a2020, 0.9);
				g.strokePath();
			};

			drawCrownHalf(-1, -6, -4, 2);
			drawCrownHalf(1, 6, 4, 1);

			// Molten fracture line through the center
			g.lineStyle(2, 0xff4400, 0.85);
			g.lineBetween(-2, -34, 2, -4);
		} else {
			// Golden starburst background halo
			const halo = this.add
				.image(0, -12, "spark")
				.setScale(7)
				.setTint(COLORS.gold)
				.setAlpha(0.24)
				.setBlendMode(Phaser.BlendModes.ADD);
			c.add(halo);

			// Rich burnished gold colors
			const leafFill = COLORS.gold;
			const leafStroke = 0x8f6817;
			const stemCol = COLORS.goldDeep;

			// Symmetrical laurel wreath branches
			for (const dir of [-1, 1]) {
				g.lineStyle(2, stemCol, 0.95);
				g.beginPath();
				g.moveTo(dir * 16, 12);
				g.lineTo(dir * 46, 5);
				g.lineTo(dir * 72, -9);
				g.lineTo(dir * 84, -28);
				g.lineTo(dir * 76, -46);
				g.strokePath();

				// 5 pairs of sculpted golden leaves along each branch
				const nodes = [
					{ x: dir * 28, y: 9, a1: -2.0, a2: -1.4 },
					{ x: dir * 48, y: 4, a1: -2.2, a2: -1.2 },
					{ x: dir * 66, y: -6, a1: -2.4, a2: -1.0 },
					{ x: dir * 80, y: -20, a1: -2.6, a2: -0.8 },
					{ x: dir * 78, y: -38, a1: -2.8, a2: -0.6 },
				];

				for (const n of nodes) {
					const angle1 = dir === -1 ? n.a1 : -Math.PI - n.a1;
					const angle2 = dir === -1 ? n.a2 : -Math.PI - n.a2;
					this.drawLeaf(g, n.x, n.y, angle1, 14, 5.5, leafFill, leafStroke);
					this.drawLeaf(g, n.x, n.y, angle2, 13, 5, leafFill, leafStroke);
				}
			}

			// Imperial Crown at the apex
			// Crown base band
			g.fillStyle(COLORS.goldDeep, 1);
			g.fillRoundedRect(-20, -10, 40, 6, 2);
			g.lineStyle(1, 0xfff6c7, 0.9);
			g.lineBetween(-18, -9, 18, -9);

			// Crown peaks
			g.fillStyle(COLORS.gold, 1);
			g.beginPath();
			g.moveTo(-18, -10);
			g.lineTo(-14, -28);
			g.lineTo(-7, -18);
			g.lineTo(0, -36);
			g.lineTo(7, -18);
			g.lineTo(14, -28);
			g.lineTo(18, -10);
			g.closePath();
			g.fillPath();

			g.lineStyle(1.5, 0x8a6214, 0.95);
			g.strokePath();

			// Jewels on peaks
			g.fillStyle(0xffffff, 1);
			g.fillCircle(0, -36, 2.5);
			g.fillStyle(0xffe899, 1);
			g.fillCircle(-14, -28, 2);
			g.fillCircle(14, -28, 2);

			// Pips on base band
			g.fillStyle(COLORS.blood, 1);
			g.fillCircle(-10, -7, 1.8);
			g.fillCircle(10, -7, 1.8);
			g.fillStyle(COLORS.sky, 1);
			g.fillCircle(0, -7, 2);
		}

		c.add(g);
		return c;
	}

	/** Draw a dramatic broken wax seal for collapse aesthetics. */
	private drawBrokenWaxSeal(
		x: number,
		y: number,
	): Phaser.GameObjects.Container {
		const c = this.add.container(x, y);
		const sealG = this.add.graphics();

		// Two halves of broken wax seal with jagged crack
		const drawWaxHalf = (
			dir: number,
			shiftX: number,
			shiftY: number,
			rotDeg: number,
		) => {
			const rad = Phaser.Math.DegToRad(rotDeg);
			const cos = Math.cos(rad);
			const sin = Math.sin(rad);
			const pt = (px: number, py: number) => ({
				x: shiftX + px * cos - py * sin,
				y: shiftY + px * sin + py * cos,
			});

			const crack = [
				pt(dir * 1, -34),
				pt(dir * 4, -20),
				pt(dir * -2, -6),
				pt(dir * 5, 8),
				pt(dir * -3, 20),
				pt(dir * 1, 34),
			];

			sealG.fillStyle(0x751313, 0.96);
			sealG.beginPath();
			sealG.moveTo(crack[0].x, crack[0].y);

			// Outer scalloped wax arc
			const steps = 10;
			for (let i = 0; i <= steps; i++) {
				const a =
					dir === -1
						? -Math.PI / 2 - (Math.PI * i) / steps
						: -Math.PI / 2 + (Math.PI * i) / steps;
				const r = 34 + Math.sin(i * 1.8) * 3;
				const p = pt(Math.cos(a) * r, Math.sin(a) * r);
				sealG.lineTo(p.x, p.y);
			}

			// Connect back along the crack
			for (let i = crack.length - 1; i >= 0; i--) {
				sealG.lineTo(crack[i].x, crack[i].y);
			}
			sealG.closePath();
			sealG.fillPath();

			// Rim bevel
			sealG.lineStyle(1.5, 0xa32222, 0.9);
			sealG.strokePath();

			// Inner stamped groove
			sealG.lineStyle(1.2, 0x4a0a0a, 0.85);
			sealG.beginPath();
			for (let i = 1; i < steps; i++) {
				const a =
					dir === -1
						? -Math.PI / 2 - (Math.PI * i) / steps
						: -Math.PI / 2 + (Math.PI * i) / steps;
				const p = pt(Math.cos(a) * 24, Math.sin(a) * 24);
				if (i === 1) sealG.moveTo(p.x, p.y);
				else sealG.lineTo(p.x, p.y);
			}
			sealG.strokePath();
		};

		// Left and right halves shifted and tilted
		drawWaxHalf(-1, -3, -2, -3.5);
		drawWaxHalf(1, 3, 2, 3.5);

		// Fiery crack fissure glow
		sealG.lineStyle(2, 0xff3b00, 0.95);
		sealG.lineBetween(-3, -34, -1, 34);

		c.add(sealG);
		return c;
	}

	/** Build the ornate triumphal summary plaque / medallion. */
	private drawSummaryPlaque(
		gState: GameState,
		matched: number,
		total: number,
		wagersWon: number,
	): {
		container: Phaser.GameObjects.Container;
		startCounter: () => void;
	} {
		const collapsed = Boolean(gState.collapse);
		const container = this.add.container(W / 2, 360).setAlpha(0);
		container.setDepth(6);

		const pw = 656;
		const ph = 168;
		const plaqueG = this.add.graphics();

		// Plaque background plate
		plaqueG.fillStyle(COLORS.night, 0.9);
		plaqueG.fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 18);

		if (collapsed) {
			// Scorched charred stone border
			plaqueG.lineStyle(2.5, 0x6e1717, 0.95);
			plaqueG.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 18);

			// Inner dark hairline
			plaqueG.lineStyle(1, 0x3d0c0c, 0.7);
			plaqueG.strokeRoundedRect(-pw / 2 + 4, -ph / 2 + 4, pw - 8, ph - 8, 14);

			// Scorched fracture cracks across the plaque
			plaqueG.lineStyle(2, 0x220505, 0.9);
			plaqueG.lineBetween(-pw / 2 + 30, ph / 2 - 10, -80, -ph / 2 + 20);
			plaqueG.lineBetween(40, -ph / 2 + 10, pw / 2 - 40, ph / 2 - 15);

			// Glowing ember core inside cracks
			plaqueG.lineStyle(1, 0xff3b00, 0.5);
			plaqueG.lineBetween(-pw / 2 + 40, ph / 2 - 12, -75, -ph / 2 + 22);
			plaqueG.lineBetween(45, -ph / 2 + 12, pw / 2 - 45, ph / 2 - 17);

			// Header ribbon text on plaque
			const collapseTitle =
				gState.collapse === "bankruptcy"
					? "TREASURY DEPLETED"
					: "REALM OVERTHROWN";
			const head = this.add
				.text(
					0,
					-ph / 2 + 15,
					`☠  RECORD OF RUIN: ${collapseTitle}  ☠`,
					ui(12, hex(COLORS.blood)),
				)
				.setOrigin(0.5);
			head.setLetterSpacing(2);
			container.add(head);

			// Broken wax seal stamped on plaque
			const seal = this.drawBrokenWaxSeal(0, -ph / 2 + 2);
			container.add(seal);
		} else {
			// Rich imperial gold plaque border
			plaqueG.lineStyle(2.5, COLORS.goldDeep, 0.95);
			plaqueG.strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 18);

			// Inner gold hairline
			plaqueG.lineStyle(1, COLORS.gold, 0.65);
			plaqueG.strokeRoundedRect(-pw / 2 + 4, -ph / 2 + 4, pw - 8, ph - 8, 14);

			// 4 Gilded corner L-brackets with diamond rivets
			const bracketDistX = pw / 2 - 14;
			const bracketDistY = ph / 2 - 14;
			plaqueG.lineStyle(1.5, COLORS.gold, 0.85);
			for (const sx of [-1, 1]) {
				for (const sy of [-1, 1]) {
					const cx = sx * bracketDistX;
					const cy = sy * bracketDistY;
					plaqueG.beginPath();
					plaqueG.moveTo(cx - sx * 16, cy);
					plaqueG.lineTo(cx, cy);
					plaqueG.lineTo(cx, cy - sy * 16);
					plaqueG.strokePath();

					// Rivet dot
					plaqueG.fillStyle(0xffe899, 0.9);
					plaqueG.fillCircle(cx - sx * 5, cy - sy * 5, 2);
				}
			}

			// Header ribbon text on plaque
			const head = this.add
				.text(
					0,
					-ph / 2 + 15,
					`✦  IMPERIAL RECORD OF THE REIGN  ✦`,
					ui(12, hex(COLORS.gold)),
				)
				.setOrigin(0.5);
			head.setLetterSpacing(3);
			container.add(head);
		}

		// Vertical hairline dividers separating stations
		plaqueG.lineStyle(1, collapsed ? 0x4a1818 : COLORS.goldDeep, 0.5);
		plaqueG.lineBetween(-116, -ph / 2 + 32, -116, ph / 2 - 18);
		plaqueG.lineBetween(116, -ph / 2 + 32, 116, ph / 2 - 18);

		container.addAt(plaqueG, 0);

		// STATION 1: Historical Accord Seal (Left, x = -205)
		const s1X = -205;
		const s1Y = 8;
		const s1G = this.add.graphics();
		s1G.fillStyle(COLORS.ink, 0.8);
		s1G.fillCircle(s1X, s1Y - 10, 32);
		s1G.lineStyle(2, collapsed ? 0x8a1d1d : COLORS.gold, 0.9);
		s1G.strokeCircle(s1X, s1Y - 10, 32);
		s1G.lineStyle(1, collapsed ? 0x4d1010 : COLORS.goldDeep, 0.6);
		s1G.strokeCircle(s1X, s1Y - 10, 28);
		container.add(s1G);

		const icon1 = this.add.text(s1X, s1Y - 26, "📜", ui(14)).setOrigin(0.5);
		const numMatched = this.add
			.text(s1X, s1Y - 6, `0/${total}`, {
				fontFamily: FONT.title,
				fontSize: "24px",
				color: hex(collapsed ? COLORS.blood : COLORS.gold),
				fontStyle: "700",
			})
			.setOrigin(0.5);

		const lbl1 = this.add
			.text(s1X, s1Y + 34, "ACCORD", ui(11, hex(COLORS.muted)))
			.setOrigin(0.5);
		lbl1.setLetterSpacing(1.5);

		const ratio = matched / (total || 1);
		const badgeText =
			ratio >= 0.8
				? "Faithful Heir"
				: ratio >= 0.5
					? "Pragmatic Path"
					: "Bold Heresy";
		const sub1 = this.add
			.text(
				s1X,
				s1Y + 50,
				badgeText,
				ui(10, hex(ratio >= 0.5 ? COLORS.gold : COLORS.sky)),
			)
			.setOrigin(0.5);

		container.add([icon1, numMatched, lbl1, sub1]);

		// STATION 2: The Three Pillars (Center, x = 0)
		const s2Y = 6;
		const s2Head = this.add
			.text(0, s2Y - 32, "THE THREE PILLARS", ui(11, hex(COLORS.muted)))
			.setOrigin(0.5);
		s2Head.setLetterSpacing(2);
		container.add(s2Head);

		const chips = [
			{
				dx: -68,
				key: "gold" as const,
				meta: STAT_META.gold,
				val: gState.stats.gold,
			},
			{
				dx: 0,
				key: "stability" as const,
				meta: STAT_META.stability,
				val: gState.stats.stability,
			},
			{
				dx: 68,
				key: "legacy" as const,
				meta: STAT_META.legacy,
				val: gState.stats.legacy,
			},
		];

		const statTexts: Phaser.GameObjects.Text[] = [];

		for (const chip of chips) {
			const cx = chip.dx;
			const cy = s2Y + 4;

			const chipG = this.add.graphics();
			chipG.fillStyle(COLORS.ink, 0.7);
			chipG.fillCircle(cx, cy - 6, 20);
			chipG.lineStyle(1.5, chip.meta.color, 0.85);
			chipG.strokeCircle(cx, cy - 6, 20);
			container.add(chipG);

			const ic = this.add
				.text(cx, cy - 18, chip.meta.icon, ui(13, hex(chip.meta.color)))
				.setOrigin(0.5);
			const num = this.add
				.text(cx, cy - 2, "0", {
					fontFamily: FONT.title,
					fontSize: "20px",
					color: hex(chip.meta.color),
					fontStyle: "700",
				})
				.setOrigin(0.5);
			const lbl = this.add
				.text(
					cx,
					cy + 24,
					chip.meta.label.toUpperCase(),
					ui(10, hex(COLORS.muted)),
				)
				.setOrigin(0.5);
			lbl.setLetterSpacing(1);

			statTexts.push(num);
			container.add([ic, num, lbl]);
		}

		// STATION 3: Oracle Favors & Posterity (Right, x = 205)
		const s3X = 205;
		const s3Y = 8;
		const s3G = this.add.graphics();
		s3G.fillStyle(COLORS.ink, 0.8);
		s3G.fillCircle(s3X, s3Y - 10, 32);
		s3G.lineStyle(2, collapsed ? 0x8a1d1d : COLORS.gold, 0.9);
		s3G.strokeCircle(s3X, s3Y - 10, 32);
		s3G.lineStyle(1, collapsed ? 0x4d1010 : COLORS.goldDeep, 0.6);
		s3G.strokeCircle(s3X, s3Y - 10, 28);
		container.add(s3G);

		const icon3 = this.add.text(s3X, s3Y - 26, "👁", ui(14)).setOrigin(0.5);
		const numWagers = this.add
			.text(s3X, s3Y - 6, "0", {
				fontFamily: FONT.title,
				fontSize: "24px",
				color: hex(collapsed ? COLORS.blood : COLORS.gold),
				fontStyle: "700",
			})
			.setOrigin(0.5);

		const lbl3 = this.add
			.text(s3X, s3Y + 34, "ORACLE BETS", ui(11, hex(COLORS.muted)))
			.setOrigin(0.5);
		lbl3.setLetterSpacing(1.5);

		const sub3 = this.add
			.text(
				s3X,
				s3Y + 50,
				`${wagersWon} Won`,
				ui(10, hex(wagersWon > 0 ? COLORS.gold : COLORS.muted)),
			)
			.setOrigin(0.5);

		container.add([icon3, numWagers, lbl3, sub3]);

		// Counter roll-up animation function
		const startCounter = () => {
			let lastTick = -1;
			this.tweens.addCounter({
				from: 0,
				to: 1,
				duration: settings.reducedMotion ? 200 : 750,
				delay: 1100,
				ease: "Cubic.out",
				onUpdate: (tw) => {
					const val = tw.getValue() ?? 0;
					const curMatched = Math.round(val * matched);
					const curGold = Math.round(val * gState.stats.gold);
					const curStability = Math.round(val * gState.stats.stability);
					const curLegacy = Math.round(val * gState.stats.legacy);
					const curWagers = Math.round(val * wagersWon);

					numMatched.setText(`${curMatched}/${total}`);
					statTexts[0].setText(`${curGold}`);
					statTexts[1].setText(`${curStability}`);
					statTexts[2].setText(`${curLegacy}`);
					numWagers.setText(`${curWagers}`);

					const tickStep = Math.floor(val * 8);
					if (tickStep !== lastTick) {
						lastTick = tickStep;
						audio.sfx("tick");
					}
				},
				onComplete: () => {
					audio.sfx("coin");
				},
			});
		};

		return { container, startCounter };
	}

	/** Reveal the monumental imperial proclamation typography, crest, and epithet. */
	private showMonumentalProclamation(v: VerdictRecord, collapsed: boolean) {
		// Header Decree Banner
		const decreeText = collapsed
			? "☠  FALL OF THE DYNASTY  ☠"
			: "❖  IMPERIAL PROCLAMATION  ❖";
		const headerColor = collapsed ? COLORS.blood : COLORS.gold;
		const decree = this.add
			.text(W / 2, 66, decreeText, ui(15, hex(headerColor)))
			.setOrigin(0.5)
			.setAlpha(0)
			.setDepth(5);
		decree.setLetterSpacing(6);
		decree.setShadow(0, 2, "rgba(0,0,0,0.85)", 6, false, true);

		// Imperial Crest & Laurels
		const crest = this.drawImperialCrest(W / 2, 108, collapsed);
		crest.setDepth(5).setAlpha(0);

		// Monumental Title
		const rawTitle = v.title.toUpperCase();
		const titleSize =
			rawTitle.length > 22 ? 36 : rawTitle.length > 15 ? 42 : 48;
		const titleText = this.add
			.text(W / 2, 164, rawTitle, {
				...title(titleSize, "#fffaf0"),
				wordWrap: { width: W - 72 },
				align: "center",
			})
			.setOrigin(0.5)
			.setAlpha(0)
			.setDepth(5);

		titleText.setStroke(collapsed ? "#330606" : "#2a1c05", 5);
		titleText.setShadow(0, 6, "#000000", 18, false, true);

		// Epithet & Filigree dividing rules
		const epithetColor = collapsed ? 0xff7777 : COLORS.gold;
		const epithet = this.add
			.text(W / 2, 226, `« ${v.epithet} »`, {
				...body(29, hex(epithetColor)),
				fontStyle: "italic",
				wordWrap: { width: W - 110 },
				align: "center",
			})
			.setOrigin(0.5)
			.setAlpha(0)
			.setDepth(5);
		epithet.setShadow(0, 3, "rgba(0,0,0,0.8)", 8, false, true);

		// Filigree hairlines flanking epithet
		const filigreeG = this.add.graphics();
		filigreeG.setDepth(5).setAlpha(0);

		const epHalfW = Math.min(220, epithet.width / 2 + 16);
		const epY = 226;
		const divCol = collapsed ? 0x6e1b1b : COLORS.goldDeep;
		filigreeG.lineStyle(1.5, divCol, 0.85);

		// Left hairline & diamond pip
		filigreeG.lineBetween(W / 2 - epHalfW - 74, epY, W / 2 - epHalfW, epY);
		filigreeG.fillStyle(divCol, 0.95);
		filigreeG.fillCircle(W / 2 - epHalfW, epY, 2.5);

		// Right hairline & diamond pip
		filigreeG.lineBetween(W / 2 + epHalfW, epY, W / 2 + epHalfW + 74, epY);
		filigreeG.fillCircle(W / 2 + epHalfW, epY, 2.5);

		// Orchestrated monumental entrance tweens
		this.tweens.add({
			targets: decree,
			alpha: 1,
			y: 72,
			duration: 450,
			delay: 80,
		});

		this.tweens.add({
			targets: crest,
			alpha: 1,
			scale: { from: 0.8, to: 1 },
			duration: 600,
			delay: 180,
			ease: "Back.out(1.3)",
		});

		this.tweens.add({
			targets: titleText,
			alpha: 1,
			scale: { from: 1.35, to: 1 },
			duration: settings.reducedMotion ? 250 : 700,
			delay: 320,
			ease: "Back.out(1.4)",
		});

		this.tweens.add({
			targets: [epithet, filigreeG],
			alpha: 1,
			y: "-=6",
			duration: 500,
			delay: 750,
			ease: "Sine.out",
		});
	}

	private async run() {
		const g = this.g;
		const collapsed = Boolean(g.collapse);

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
			v = online()
				? await Promise.race([
						generateVerdict(g),
						new Promise<VerdictRecord>((_, reject) =>
							setTimeout(() => reject(new Error("verdict timeout")), 7000),
						),
					])
				: localVerdict(g);
		} catch {
			v = localVerdict(g);
		}

		wait.destroy();
		if (!this.alive || !this.cameras?.main) return;

		const matched = g.history.filter((h) => h.historical).length;
		const total = g.history.length;
		const totalDecisions = total || 1;
		const wagersWon = g.history.filter((h) => h.matched).length;

		// Revelation sound & dramatic hall impact
		audio.sfx("drum");
		if (collapsed) {
			audio.sfx("fail");
			this.cameras.main.shake(380, 0.01);
		} else {
			audio.sfx("fanfare");
			this.cameras.main.shake(250, 0.006);
		}

		// Reveal Monumental Imperial Proclamation
		this.showMonumentalProclamation(v, collapsed);

		// Celebration or collapse particles
		if (collapsed) {
			const collapseBurst = this.add
				.particles(W / 2, 165, "spark", {
					speed: { min: 60, max: 260 },
					scale: { start: 0.85, end: 0 },
					lifespan: 1300,
					tint: [COLORS.blood, 0x731515, 0x3d0707],
					blendMode: Phaser.BlendModes.ADD,
					emitting: false,
				})
				.setDepth(4);

			this.time.delayedCall(320, () => {
				collapseBurst.explode(settings.reducedMotion ? 25 : 60);
			});
		} else if (matched >= totalDecisions / 2) {
			// Triumphant dual-fountain particle burst with gold & sky sparks
			const leftFountain = this.add
				.particles(W * 0.16, 420, "spark", {
					speed: { min: 320, max: 650 },
					angle: { min: -85, max: -45 },
					gravityY: 550,
					scale: { start: 0.85, end: 0 },
					lifespan: { min: 1400, max: 2200 },
					tint: [COLORS.gold, COLORS.sky, 0xffffff],
					blendMode: Phaser.BlendModes.ADD,
					emitting: false,
				})
				.setDepth(4);

			const rightFountain = this.add
				.particles(W * 0.84, 420, "spark", {
					speed: { min: 320, max: 650 },
					angle: { min: -135, max: -95 },
					gravityY: 550,
					scale: { start: 0.85, end: 0 },
					lifespan: { min: 1400, max: 2200 },
					tint: [COLORS.gold, COLORS.sky, 0xffffff],
					blendMode: Phaser.BlendModes.ADD,
					emitting: false,
				})
				.setDepth(4);

			const centerBurst = this.add
				.particles(W / 2, 165, "spark", {
					speed: { min: 80, max: 320 },
					scale: { start: 0.85, end: 0 },
					lifespan: 1200,
					tint: [COLORS.gold, COLORS.sky, 0xffffff],
					blendMode: Phaser.BlendModes.ADD,
					emitting: false,
				})
				.setDepth(4);

			this.time.delayedCall(320, () => {
				const q = settings.reducedMotion ? 35 : 75;
				leftFountain.explode(q);
				rightFountain.explode(q);
				centerBurst.explode(settings.reducedMotion ? 25 : 55);
			});

			if (!settings.reducedMotion) {
				this.time.delayedCall(520, () => {
					leftFountain.explode(45);
					rightFountain.explode(45);
				});
			}
		} else {
			// Survived reign
			const p = this.add
				.particles(W / 2, 165, "spark", {
					speed: { min: 80, max: 300 },
					scale: { start: 0.8, end: 0 },
					lifespan: 1200,
					tint: [COLORS.gold, 0xffffff],
					blendMode: Phaser.BlendModes.ADD,
					emitting: false,
				})
				.setDepth(4);
			this.time.delayedCall(320, () =>
				p.explode(settings.reducedMotion ? 25 : 60),
			);
		}

		// Summary Plaque Medallion
		const { container: plaque, startCounter } = this.drawSummaryPlaque(
			g,
			matched,
			total,
			wagersWon,
		);

		this.tweens.add({
			targets: plaque,
			alpha: 1,
			y: 364,
			duration: 550,
			delay: 950,
			ease: "Back.out(1.2)",
			onStart: () => startCounter(),
		});

		// Narrator voice comment
		const sub = new Subtitle(this, 545);
		sub.setDepth(7);
		const narr = await say(
			v.comment,
			VOICES.narrator,
			collapsed ? "tragic and solemn chronicle" : "epic and admiring chronicle",
		);
		sub.show(
			"Narrator",
			v.comment,
			collapsed ? COLORS.blood : COLORS.gold,
			narr.duration * 1000,
		);
		await this.skippable(narr);
		sub.hide();

		// The sovereign appears to deliver their final proclamation
		const portrait = new Portrait(
			this,
			W / 2,
			620,
			portraitKeys(g.leader, "leader"),
			400,
		);
		portrait.setDepth(5);
		portrait.enter(W / 2, 700);
		portrait.setAlpha(0);
		this.tweens.add({ targets: portrait, alpha: 1, duration: 700 });

		portrait.setEmotion(
			collapsed
				? "alarmed"
				: matched >= totalDecisions / 2
					? "proud"
					: "amused",
			collapsed ? COLORS.blood : COLORS.gold,
		);

		const leaderStyle = collapsed
			? "despairing or furious historical ruler"
			: matched >= totalDecisions / 2
				? "proud, triumphant and commanding ruler"
				: "bemused and philosophical ruler";
		const lv = await say(v.leaderLine, g.leader.voice, leaderStyle);
		portrait.speak(lv);

		sub.setY(880);
		sub.show(
			g.leader.name,
			v.leaderLine,
			collapsed ? COLORS.blood : COLORS.gold,
			lv.duration * 1000,
		);
		await this.skippable(lv);
		sub.hide();

		// Sovereign repositions to make room for prestigious action suite
		this.tweens.add({
			targets: portrait,
			y: 535,
			scale: 0.65,
			duration: 600,
			ease: "Sine.inOut",
		});

		// Record the reign in chronicle history
		addReign({
			leaderId: g.leader.id,
			leaderName: g.leader.name,
			civ: g.leader.civ,
			seasons: g.seasonsPlayed,
			matched,
			total: g.history.length,
			stats: g.stats,
			verdict: { title: v.title, epithet: v.epithet, comment: v.comment },
			collapse: g.collapse ?? null,
		});

		const histCount = g.history.filter((h) => h.historical).length;
		if (histCount >= 5) {
			const newlyUnlocked = unlockRelic("relic_hammurabi");
			if (newlyUnlocked) {
				audio.sfx("relic");
				toast(
					this,
					"Relique Antique : La Stèle des Lois a été forgée !",
					COLORS.gold,
				);
			}
		}

		// Prestigious action buttons suite
		this.showActions(v, matched);
	}

	/** Prestigious layout of action buttons, next era cartouche, and share decree. */
	private showActions(v: VerdictRecord, matched: number) {
		const g = this.g;
		const collapsed = Boolean(g.collapse);
		const actionsContainer = this.add.container(0, 0).setAlpha(0).setDepth(8);

		const primaryY = 810;

		// Primary Action: Continue or Reclaim Throne
		if (collapsed) {
			const btn = new Button(
				this,
				W / 2,
				primaryY,
				"⚔ Reclaim the Throne",
				() => this.tryAgain(),
				{ w: 480, h: 74, color: COLORS.blood },
			);
			actionsContainer.add(btn);
		} else {
			const btn = new Button(
				this,
				W / 2,
				primaryY,
				"👑 Continue the Reign",
				() => this.continueReign(),
				{ w: 480, h: 74 },
			);
			actionsContainer.add(btn);
		}

		if (v.nextEra) {
			// Next Era Cartouche / Decree Strip
			const hookText = this.add
				.text(W / 2, primaryY + 86, `✦  ${v.nextEra.hook}`, {
					...body(20, hex(COLORS.parchmentDark)),
					fontStyle: "italic",
					wordWrap: { width: W - 120 },
					align: "center",
				})
				.setOrigin(0.5);
			actionsContainer.add(hookText);

			const target =
				v.nextEra.leaderId && LEADERS.some((x) => x.id === v.nextEra?.leaderId)
					? v.nextEra.leaderId
					: null;

			const eraBtn = new Button(
				this,
				W / 2,
				primaryY + 158,
				`✦ Change era: ${v.nextEra.name}`,
				() => this.changeEra(target, v.nextEra?.name ?? ""),
				{ w: 480, h: 64, primary: false, size: 21 },
			);
			actionsContainer.add(eraBtn);

			// Share Verdict Decree button
			const shareBtn = new Button(
				this,
				W / 2,
				primaryY + 242,
				"📜 Proclaim Imperial Verdict",
				() => void this.share(v, matched),
				{ w: 380, h: 56, primary: false, size: 20 },
			);
			actionsContainer.add(shareBtn);
		} else {
			// Share Verdict Decree button directly below primary action
			const shareBtn = new Button(
				this,
				W / 2,
				primaryY + 98,
				"📜 Proclaim Imperial Verdict",
				() => void this.share(v, matched),
				{ w: 380, h: 58, primary: false, size: 21 },
			);
			actionsContainer.add(shareBtn);
		}

		this.tweens.add({
			targets: actionsContainer,
			alpha: 1,
			y: "-=12",
			duration: 500,
			ease: "Sine.out",
		});
	}

	private continueReign() {
		const g = this.g;
		g.season += 1;
		g.chapter = null;
		g.turnIndex = 0;
		saveGame(g);
		go(this, "Court");
	}

	private async skippable(h: VoiceHandle) {
		const skip = (ptr: Phaser.Input.Pointer) => {
			if (ptr.y > 140 && Math.abs(ptr.y - ptr.downY) < 40) {
				h.stop();
			}
		};
		this.input.on(Phaser.Input.Events.POINTER_UP, skip);
		await h.done;
		this.input.off(Phaser.Input.Events.POINTER_UP, skip);
	}

	private tryAgain() {
		this.g = newGame(this.g.leader);
		saveGame(this.g);
		go(this, "Court");
	}

	private changeEra(leaderId: string | null, name: string) {
		saveGame(null);
		if (leaderId) go(this, "Select", { focus: leaderId });
		else go(this, "Summon", { prefill: name });
	}

	private async share(v: VerdictRecord, matched: number) {
		const g = this.g;
		audio.sfx("coin");

		const statusText = g.collapse
			? `Dynasty Collapsed (${g.collapse === "bankruptcy" ? "Treasury Depleted" : "Popular Revolt"})`
			: "Imperial Reign Verdict";

		const text = `👑 ${v.epithet} — "${v.title}"\n${statusText} after ${g.history.length} decisions (${matched}/${g.history.length} aligned with history).\nTreasury: ${g.stats.gold} ◆ | Stability: ${g.stats.stability} ⚖ | Legacy: ${g.stats.legacy} ✦\nChronicle: rule as they did. Or don't.`;

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
			toast(this, "Verdict copied to clipboard", COLORS.gold);
		} catch {
			toast(this, "Sharing unavailable here", COLORS.blood);
		}
	}
}
