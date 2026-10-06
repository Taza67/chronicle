import Phaser from "phaser";
import { LEADERS } from "../content/leaders.ts";
import { queueLeaderArt, texKey } from "../core/art.ts";
import { audio } from "../core/audio.ts";
import { customLeaders, newGame, saveGame, settings } from "../core/state.ts";
import type { Leader } from "../types.ts";
import {
	CANVAS_W,
	COL_X,
	COLORS,
	CX,
	FONT,
	H,
	hex,
	LANDSCAPE,
	SAFE_BOTTOM,
	SAFE_TOP,
	W,
} from "../ui/theme.ts";
import { Button, fadeIn, go, motion } from "../ui/widgets.ts";

const PORTRAIT_W = 480;
const PORTRAIT_H = 636;
const MOULDING = 24;
const FRAME_W = PORTRAIT_W + MOULDING * 2; // 528
const FRAME_H = PORTRAIT_H + MOULDING * 2; // 684
const GAP = 560;
const getTrackY = () => Math.round(H * 0.403);
const getPipY = () => getTrackY() + 364;
// Stela center: below the pips by default, but never so low that its 176px
// plate (STELA_H/2 = 88) collides with "Take the Throne" (top edge at
// H - SAFE_BOTTOM - 175, see create()); keep a 16px breathing gap.
const getStelaY = () =>
	Math.min(getPipY() + 112, H - SAFE_BOTTOM - 175 - 16 - STELA_H / 2);
const STELA_W = 620;
const STELA_H = 176;

interface ImperialPip {
	container: Phaser.GameObjects.Container;
	aura: Phaser.GameObjects.Graphics;
	jewel: Phaser.GameObjects.Graphics;
	auraTween?: Phaser.Tweens.Tween;
}

interface RegalChevron {
	container: Phaser.GameObjects.Container;
	bg: Phaser.GameObjects.Graphics;
	aura: Phaser.GameObjects.Graphics;
	glyph: Phaser.GameObjects.Text;
	setEnabled: (enabled: boolean) => void;
}

/** Swipeable imperial court portrait gallery with gilded frames and regal presentation. */
export class SelectScene extends Phaser.Scene {
	public leaders: Leader[] = [];
	public index = 0;
	private track!: Phaser.GameObjects.Container;
	private cards: Phaser.GameObjects.Container[] = [];
	private bg!: Phaser.GameObjects.Image;
	private moodOverlay!: Phaser.GameObjects.Rectangle;
	private currentMoodColor = 0x0f6f7a;
	private moodTween?: Phaser.Tweens.Tween;
	private idleTween?: Phaser.Tweens.Tween;

	private pips: ImperialPip[] = [];
	private stelaDivider!: Phaser.GameObjects.Graphics;
	public info!: {
		name: Phaser.GameObjects.Text;
		civ: Phaser.GameObjects.Text;
		quote: Phaser.GameObjects.Text;
	};
	private infoBaseY: number[] = [];

	private leftChevron!: RegalChevron;
	private rightChevron!: RegalChevron;

	private dragX = 0;
	private dragging = false;

	constructor() {
		super("Select");
	}

	init(data: { focus?: string }) {
		this.leaders = [...customLeaders, ...LEADERS];
		this.cards = [];
		this.pips = [];
		this.dragging = false;
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

		// Background canvas with leader mood lighting
		this.bg = this.add.image(CX, H / 2, "title_bg");
		this.bg
			.setScale(Math.max(W / this.bg.width, H / this.bg.height) * 1.1)
			.setAlpha(0.38);

		const initialLeader = this.leaders[this.index];
		const initialHex = initialLeader?.palette.primary ?? "#0f6f7a";
		this.currentMoodColor =
			Phaser.Display.Color.HexStringToColor(initialHex).color;
		this.bg.setTint(this.currentMoodColor);

		this.moodOverlay = this.add
			.rectangle(CX, H / 2, CANVAS_W, H, this.currentMoodColor, 0.28)
			.setBlendMode(Phaser.BlendModes.MULTIPLY);

		this.add.image(CX, H / 2, "vignette").setDisplaySize(CANVAS_W, H);

		// Atmospheric gallery spotlight descending toward the active portrait
		const spotlight = this.add.graphics();
		spotlight.fillStyle(0xfff5d6, 0.08);
		spotlight.fillCircle(CX, getTrackY() - 40, 280);
		spotlight.fillStyle(COLORS.gold, 0.04);
		spotlight.fillCircle(CX, getTrackY() - 40, 420);
		spotlight.setBlendMode(Phaser.BlendModes.ADD);

		// Header ribbon & imperial seal back button
		this.createHeader();

		// Carousel track
		this.track = this.add.container(0, getTrackY());
		this.leaders.forEach((l, i) => {
			const c = this.add.container(CX + i * GAP, 0);
			this.createGildedFrame(c, l);
			this.track.add(c);
			this.cards.push(c);
		});

		// Stela plinth for leader info
		this.createStelaPlinth();

		// Diamond jewels / imperial pips
		this.createPips();

		// Regal chevron navigation buttons
		this.createNavButtons();

		// Action buttons anchored to bottom
		const summonY = H - SAFE_BOTTOM - 42;
		const takeY = summonY - 96;

		const btnTake = new Button(
			this,
			CX,
			takeY,
			"Take the Throne",
			() => this.begin(),
			{ w: 460, h: 74, size: 26 },
		);
		btnTake.setAlpha(0).setY(takeY + 24);
		this.tweens.add({
			targets: btnTake,
			alpha: 1,
			y: takeY,
			duration: 480 * motion(),
			delay: 150 * motion(),
			ease: "Cubic.out",
		});

		const btnSummon = new Button(
			this,
			CX,
			summonY,
			"Summon Another Leader",
			() => go(this, "Summon"),
			{ w: 460, h: 66, primary: false, size: 22, icon: "✦" },
		);
		btnSummon.setAlpha(0).setY(summonY + 24);
		this.tweens.add({
			targets: btnSummon,
			alpha: 1,
			y: summonY,
			duration: 480 * motion(),
			delay: 260 * motion(),
			ease: "Cubic.out",
		});

		// Swipe & drag handling
		this.input.on(
			Phaser.Input.Events.POINTER_DOWN,
			(p: Phaser.Input.Pointer) => {
				const onArrow =
					(p.x < COL_X + 76 || p.x > COL_X + W - 76) &&
					Math.abs(p.y - getTrackY()) < 52;
				// Confine swipes to the gallery band so taps on the bottom
				// action buttons can't start an accidental drag on tall phones.
				const inBand =
					p.y > getTrackY() - FRAME_H / 2 - 44 &&
					p.y < getTrackY() + FRAME_H / 2 + 44;
				if (inBand && !onArrow) {
					this.dragging = true;
					this.dragX = p.x;
					this.idleTween?.stop();
					this.idleTween = undefined;
					const activeCard = this.cards[this.index];
					if (activeCard && activeCard.y !== 0) {
						this.tweens.add({
							targets: activeCard,
							y: 0,
							duration: 180,
							ease: "Quad.out",
						});
					}
				}
			},
		);

		this.input.on(
			Phaser.Input.Events.POINTER_MOVE,
			(p: Phaser.Input.Pointer) => {
				if (!this.dragging) return;
				this.track.x = -this.index * GAP + (p.x - this.dragX);
				this.updateCardsDuringDrag();
			},
		);

		this.input.on(Phaser.Input.Events.POINTER_UP, (p: Phaser.Input.Pointer) => {
			if (!this.dragging) return;
			this.dragging = false;
			const dx = p.x - this.dragX;
			if (dx < -60) this.step(1);
			else if (dx > 60) this.step(-1);
			else {
				// Tap on side card brings it directly to the front
				const rel =
					p.x < CX - FRAME_W / 2 ? -1 : p.x > CX + FRAME_W / 2 ? 1 : 0;
				if (rel !== 0 && Math.abs(p.y - getTrackY()) < FRAME_H / 2) {
					this.step(rel);
				} else {
					this.snap();
				}
			}
		});

		this.track.x = -this.index * GAP;
		this.snap(true);
	}

	private createHeader() {
		const headerY = SAFE_TOP + 24;

		// Refined imperial seal back button
		const backBtn = this.add.container(COL_X + 56, headerY);
		const bg = this.add.graphics();
		bg.fillStyle(COLORS.ink, 0.88);
		bg.fillCircle(0, 0, 26);
		bg.lineStyle(1.5, 0x6e4e1a, 0.95);
		bg.strokeCircle(0, 0, 26);
		bg.lineStyle(1, COLORS.gold, 0.8);
		bg.strokeCircle(0, 0, 23);

		const t = this.add
			.text(-1, 0, "‹", {
				fontFamily: FONT.title,
				fontSize: "28px",
				color: hex(COLORS.gold),
				fontStyle: "700",
			})
			.setOrigin(0.5);
		t.setShadow(0, 1, "#000", 4, false, true);

		backBtn.add([bg, t]);
		backBtn.setSize(88, 88).setInteractive({ useHandCursor: true });
		backBtn.on("pointerdown", () => {
			audio.sfx("tap");
			this.tweens.add({
				targets: backBtn,
				scale: 0.9,
				duration: 80,
				ease: "Quad.out",
			});
		});
		backBtn.on("pointerup", () => {
			this.tweens.add({
				targets: backBtn,
				scale: 1,
				duration: 180,
				ease: "Back.out",
			});
			go(this, "Title");
		});

		// Header titles
		const subTitle = this.add
			.text(CX, headerY - 24, "IMPERIAL GALLERY", {
				fontFamily: FONT.title,
				fontSize: "13px",
				color: hex(COLORS.goldDeep),
				fontStyle: "700",
			})
			.setOrigin(0.5);
		subTitle.setLetterSpacing(6);
		subTitle.setShadow(0, 2, "#000", 6, false, true);

		const mainHeading = this.add
			.text(CX, headerY + 4, "CHOOSE YOUR REIGN", {
				fontFamily: FONT.title,
				fontSize: "30px",
				color: hex(COLORS.gold),
				fontStyle: "700",
			})
			.setOrigin(0.5);
		mainHeading.setLetterSpacing(5);
		mainHeading.setShadow(0, 3, "#000", 10, false, true);

		// Filigree underline
		const headerDivider = this.add.graphics();
		headerDivider.lineStyle(1.5, 0x8a6723, 0.7);
		headerDivider.lineBetween(CX - 120, headerY + 28, CX - 14, headerY + 28);
		headerDivider.lineBetween(CX + 14, headerY + 28, CX + 120, headerY + 28);
		headerDivider.fillStyle(COLORS.gold, 0.9);
		headerDivider.fillPoints([
			{ x: CX, y: headerY + 24 },
			{ x: CX + 4, y: headerY + 28 },
			{ x: CX, y: headerY + 32 },
			{ x: CX - 4, y: headerY + 28 },
		]);
	}

	private createGildedFrame(c: Phaser.GameObjects.Container, leader: Leader) {
		const frame = this.add.graphics();
		const col = Phaser.Display.Color.HexStringToColor(
			leader.palette.primary,
		).color;

		const hw = PORTRAIT_W / 2; // 240
		const hh = PORTRAIT_H / 2; // 318
		const ohw = FRAME_W / 2; // 264
		const ohh = FRAME_H / 2; // 342

		// 1. Multi-stage ambient drop shadow behind frame
		frame.fillStyle(0x000000, 0.45);
		frame.fillRoundedRect(-ohw - 8, -ohh - 4, (ohw + 8) * 2, (ohh + 6) * 2, 16);
		frame.fillStyle(0x000000, 0.22);
		frame.fillRoundedRect(
			-ohw - 16,
			-ohh - 8,
			(ohw + 16) * 2,
			(ohh + 12) * 2,
			22,
		);

		// 2. Heavy antique brass / bronze timber core
		frame.fillStyle(0x191207, 1);
		frame.fillRoundedRect(-ohw, -ohh, ohw * 2, ohh * 2, 12);

		// 3. Outermost stepped antique brass moulding
		frame.lineStyle(3, 0x5a3f12, 0.95);
		frame.strokeRoundedRect(-ohw, -ohh, ohw * 2, ohh * 2, 12);

		// Directional lighting specular highlights
		frame.lineStyle(2, 0xffe89e, 0.9);
		frame.lineBetween(-ohw + 12, -ohh + 1, ohw - 12, -ohh + 1);
		frame.lineStyle(2, 0xd4a843, 0.8);
		frame.lineBetween(-ohw + 1, -ohh + 12, -ohw + 1, ohh - 12);
		frame.lineStyle(2, 0x1f1406, 0.95);
		frame.lineBetween(-ohw + 12, ohh - 1, ohw - 12, ohh - 1);
		frame.lineStyle(2, 0x2e1e08, 0.9);
		frame.lineBetween(ohw - 1, -ohh + 12, ohw - 1, ohh - 12);

		// 4. Recessed fluted cove channel with leader heraldic patina
		const chInset = 6;
		const chW = (ohw - chInset) * 2;
		const chH = (ohh - chInset) * 2;
		frame.fillStyle(0x0e0a05, 0.92);
		frame.fillRoundedRect(-ohw + chInset, -ohh + chInset, chW, chH, 8);
		// Leader heraldic glaze
		frame.fillStyle(col, 0.28);
		frame.fillRoundedRect(-ohw + chInset, -ohh + chInset, chW, chH, 8);
		frame.lineStyle(1.2, 0x3d2b0e, 0.85);
		frame.strokeRoundedRect(-ohw + chInset, -ohh + chInset, chW, chH, 8);

		// 5. Intermediate raised torus moulding (bead)
		const torInset = 13;
		const torW = (ohw - torInset) * 2;
		const torH = (ohh - torInset) * 2;
		frame.lineStyle(3.5, COLORS.gold, 0.95);
		frame.strokeRoundedRect(-ohw + torInset, -ohh + torInset, torW, torH, 6);
		frame.lineStyle(1.5, 0xfff4c2, 0.85);
		frame.lineBetween(
			-ohw + torInset + 6,
			-ohh + torInset,
			ohw - torInset - 6,
			-ohh + torInset,
		);
		frame.lineBetween(
			-ohw + torInset,
			-ohh + torInset + 6,
			-ohw + torInset,
			ohh - torInset - 6,
		);
		frame.lineStyle(1.5, 0x6e4909, 0.9);
		frame.lineBetween(
			-ohw + torInset + 6,
			ohh - torInset,
			ohw - torInset - 6,
			ohh - torInset,
		);
		frame.lineBetween(
			ohw - torInset,
			-ohh + torInset + 6,
			ohw - torInset,
			ohh - torInset - 6,
		);

		// 6. Inner brass fillet & deep sight edge slip
		frame.lineStyle(2, 0xdfa632, 0.95);
		frame.strokeRect(-hw - 1, -hh - 1, (hw + 1) * 2, (hh + 1) * 2);
		frame.lineStyle(3, 0x060402, 0.95);
		frame.strokeRect(-hw + 1, -hh + 1, (hw - 1) * 2, (hh - 1) * 2);

		// 7. Ornate gilded corner brackets with antique brass finish & studs
		const cornerSize = 28;
		const corners = [
			{ x: -ohw, y: -ohh, sx: 1, sy: 1 },
			{ x: ohw, y: -ohh, sx: -1, sy: 1 },
			{ x: -ohw, y: ohh, sx: 1, sy: -1 },
			{ x: ohw, y: ohh, sx: -1, sy: -1 },
		];
		for (const { x, y, sx, sy } of corners) {
			// Brass L-bracket plate
			frame.fillStyle(0x755318, 0.95);
			frame.beginPath();
			frame.moveTo(x, y);
			frame.lineTo(x + sx * cornerSize, y);
			frame.lineTo(x + sx * cornerSize, y + sy * 8);
			frame.lineTo(x + sx * 8, y + sy * 8);
			frame.lineTo(x + sx * 8, y + sy * cornerSize);
			frame.lineTo(x, y + sy * cornerSize);
			frame.closePath();
			frame.fillPath();

			// Gilded bracket edge
			frame.lineStyle(1.5, 0xfce588, 0.9);
			frame.beginPath();
			frame.moveTo(x + sx * cornerSize, y + sy * 8);
			frame.lineTo(x + sx * 8, y + sy * 8);
			frame.lineTo(x + sx * 8, y + sy * cornerSize);
			frame.strokePath();

			// Ornate corner rivet / stud
			const rx = x + sx * 13;
			const ry = y + sy * 13;
			frame.fillStyle(0x302008, 0.9);
			frame.fillCircle(rx, ry, 4.5);
			frame.fillStyle(0xe0b64a, 1);
			frame.fillCircle(rx, ry, 3.5);
			frame.fillStyle(0xfff8d6, 1);
			frame.fillCircle(rx - sx * 0.8, ry - sy * 0.8, 1.2);
			frame.lineStyle(1, 0x1f1406, 0.9);
			frame.strokeCircle(rx, ry, 4.5);
		}

		// 8. Leader Portrait Image & Mask
		const img = this.add.image(0, 0, texKey(leader.id, "leader"));
		img.setDisplaySize(PORTRAIT_W, PORTRAIT_H);

		// Geometry mask for the portrait opening
		const mg = this.make.graphics({ x: 0, y: 0 });
		mg.fillStyle(0xffffff);
		mg.fillRoundedRect(c.x - hw, getTrackY() - hh, PORTRAIT_W, PORTRAIT_H, 8);
		img.setMask(mg.createGeometryMask());

		// 9. Canvas shading / oil painting edge vignette inside frame
		const canvasShade = this.add.graphics();
		canvasShade.fillStyle(0x000000, 0.32);
		canvasShade.fillRect(-hw, -hh, PORTRAIT_W, 28);
		canvasShade.fillStyle(0x000000, 0.16);
		canvasShade.fillRect(-hw, -hh + 28, PORTRAIT_W, 20);
		canvasShade.fillStyle(0x000000, 0.36);
		canvasShade.fillRect(-hw, hh - 32, PORTRAIT_W, 32);

		c.add([frame, img, canvasShade]);
		c.setData("mask", mg);

		// 10. Engraved brass museum dedication plaque for summoned leaders
		if (leader.generated) {
			const plaque = this.add.container(0, -ohh + 4);
			const pg = this.add.graphics();
			pg.fillStyle(0x161008, 0.92);
			pg.fillRoundedRect(-76, -14, 152, 28, 5);
			pg.lineStyle(2, COLORS.gold, 0.95);
			pg.strokeRoundedRect(-76, -14, 152, 28, 5);
			// Plaque corner screws
			pg.fillStyle(0x9a7420, 1);
			pg.fillCircle(-68, 0, 2);
			pg.fillCircle(68, 0, 2);
			const plaqueText = this.add
				.text(0, 0, "✦  SUMMONED  ✦", {
					fontFamily: FONT.title,
					fontSize: "14px",
					color: hex(COLORS.gold),
					fontStyle: "700",
				})
				.setOrigin(0.5);
			plaqueText.setLetterSpacing(3);
			plaqueText.setShadow(0, 1, "#000", 4, false, true);
			plaque.add([pg, plaqueText]);
			c.add(plaque);
		}
	}

	private createStelaPlinth() {
		const stela = this.add.container(CX, getStelaY());

		const bg = this.add.graphics();
		const sw = STELA_W / 2; // 310
		const sh = STELA_H / 2; // 88

		// Drop shadow
		bg.fillStyle(0x000000, 0.6);
		bg.fillRoundedRect(-sw - 4, -sh - 2, (sw + 4) * 2, (sh + 4) * 2, 14);

		// Dark imperial obsidian marble base
		bg.fillStyle(0x0d0b13, 0.94);
		bg.fillRoundedRect(-sw, -sh, sw * 2, sh * 2, 10);

		// Polished marble upper sheen
		bg.fillStyle(0x1a1522, 0.45);
		bg.fillRoundedRect(-sw + 2, -sh + 2, (sw - 2) * 2, sh - 4, 8);

		// Top bronze cornice
		bg.lineStyle(2.5, 0x8a6723, 0.95);
		bg.lineBetween(-sw + 14, -sh, sw - 14, -sh);

		// Specular highlight line along top cornice
		bg.lineStyle(1.2, 0xffe28a, 0.85);
		bg.lineBetween(-sw + 48, -sh + 1, sw - 48, -sh + 1);

		// Bottom plinth footing
		bg.lineStyle(2, 0x473210, 0.95);
		bg.lineBetween(-sw + 14, sh, sw - 14, sh);

		// Side pilaster frames
		bg.lineStyle(1.5, 0x5a4115, 0.7);
		bg.strokeRoundedRect(-sw, -sh, sw * 2, sh * 2, 10);

		// 4 Corner bronze studs / bosses
		const studs = [
			{ x: -sw + 14, y: -sh + 12 },
			{ x: sw - 14, y: -sh + 12 },
			{ x: -sw + 14, y: sh - 12 },
			{ x: sw - 14, y: sh - 12 },
		];
		for (const s of studs) {
			bg.fillStyle(0x2d1f0b, 1);
			bg.fillCircle(s.x, s.y, 3.5);
			bg.fillStyle(0xd4a838, 1);
			bg.fillCircle(s.x, s.y, 2.5);
			bg.fillStyle(0xfff0aa, 1);
			bg.fillCircle(s.x - 0.5, s.y - 0.5, 0.8);
		}

		// Divider graphics
		this.stelaDivider = this.add.graphics();
		this.renderStelaDivider(this.currentMoodColor);

		// Leader Name
		const name = this.add
			.text(0, -52, "", {
				fontFamily: FONT.title,
				fontSize: "36px",
				color: hex(COLORS.gold),
				fontStyle: "700",
				align: "center",
			})
			.setOrigin(0.5);
		name.setLetterSpacing(4);
		name.setShadow(0, 2, "rgba(0, 0, 0, 0.95)", 8, false, true);

		// Civ & Era
		const civ = this.add
			.text(0, -2, "", {
				fontFamily: FONT.title,
				fontSize: "19px",
				color: hex(COLORS.parchment),
				fontStyle: "600",
				align: "center",
			})
			.setOrigin(0.5);
		civ.setLetterSpacing(3);
		civ.setShadow(0, 1, "rgba(0, 0, 0, 0.9)", 4, false, true);

		// Leader Quote
		const quote = this.add
			.text(0, 44, "", {
				fontFamily: FONT.body,
				fontSize: "23px",
				color: hex(COLORS.muted),
				fontStyle: "italic",
				align: "center",
				wordWrap: { width: 540 },
				lineSpacing: 3,
			})
			.setOrigin(0.5);
		quote.setShadow(0, 1, "rgba(0, 0, 0, 0.85)", 4, false, true);

		stela.add([bg, this.stelaDivider, name, civ, quote]);
		this.info = { name, civ, quote };
		this.infoBaseY = [name.y, civ.y, quote.y];
	}

	private renderStelaDivider(accentCol: number) {
		this.stelaDivider.clear();
		const y = -26;
		// Main wing lines
		this.stelaDivider.lineStyle(1.5, 0x8a6723, 0.75);
		this.stelaDivider.lineBetween(-170, y, -14, y);
		this.stelaDivider.lineBetween(14, y, 170, y);
		// Inner highlight wings
		this.stelaDivider.lineStyle(1, 0xffe28a, 0.85);
		this.stelaDivider.lineBetween(-85, y, -14, y);
		this.stelaDivider.lineBetween(14, y, 85, y);
		// Outer wing end dots
		this.stelaDivider.fillStyle(0x8a6723, 0.8);
		this.stelaDivider.fillCircle(-170, y, 2);
		this.stelaDivider.fillCircle(170, y, 2);
		// Central radiant aura dot
		this.stelaDivider.fillStyle(accentCol, 0.35);
		this.stelaDivider.fillCircle(0, y, 7);
		// Central diamond pip
		this.stelaDivider.fillStyle(0xfff5d1, 1);
		this.stelaDivider.fillPoints([
			{ x: 0, y: y - 5 },
			{ x: 5, y: y },
			{ x: 0, y: y + 5 },
			{ x: -5, y: y },
		]);
		this.stelaDivider.lineStyle(1, 0xd4a838, 0.9);
		this.stelaDivider.strokePoints(
			[
				{ x: 0, y: y - 5 },
				{ x: 5, y: y },
				{ x: 0, y: y + 5 },
				{ x: -5, y: y },
			],
			true,
		);
	}

	private updateStela(leader: Leader, instant: boolean) {
		this.info.name.setText(leader.name);
		this.info.civ.setText(`${leader.civ.toUpperCase()}  ✦  ${leader.era}`);
		this.info.quote.setText(`“${leader.quote}”`);
		this.renderStelaDivider(
			Phaser.Display.Color.HexStringToColor(leader.palette.primary).color,
		);

		const infoList = [this.info.name, this.info.civ, this.info.quote];
		infoList.forEach((t, idx) => {
			this.tweens.killTweensOf(t);
			const baseY = this.infoBaseY[idx] ?? t.y;
			t.y = baseY;
			if (!instant) {
				t.setAlpha(0);
				this.tweens.add({
					targets: t,
					alpha: 1,
					y: { from: baseY + 8, to: baseY },
					duration: 280 * motion(),
					delay: idx * 45 * motion(),
					ease: "Cubic.out",
				});
			} else {
				t.setAlpha(1);
			}
		});
	}

	private createPips() {
		// Landscape: the pip row lands in the 22px seam between the two
		// bottom buttons — its hit zones would eat the buttons' edges.
		// Chevrons and card taps already navigate there.
		if (LANDSCAPE) return;
		const numLeaders = this.leaders.length;
		const pipSpacing = Math.min(
			32,
			Math.floor((W - 180) / Math.max(1, numLeaders - 1)),
		);
		const pipStartX = CX - ((numLeaders - 1) / 2) * pipSpacing;

		this.leaders.forEach((_, i) => {
			const px = pipStartX + i * pipSpacing;
			const pc = this.add.container(px, getPipY());

			// Radial golden aura halo
			const aura = this.add.graphics();
			aura.fillStyle(0xffe280, 0.22);
			aura.fillCircle(0, 0, 18);
			aura.fillStyle(COLORS.gold, 0.38);
			aura.fillCircle(0, 0, 12);
			aura.fillStyle(0xfff7d6, 0.65);
			aura.fillCircle(0, 0, 5);
			aura.setAlpha(i === this.index ? 0.95 : 0);
			aura.setScale(i === this.index ? 1 : 0.6);

			// Diamond jewel
			const jewel = this.add.graphics();
			this.drawJewel(jewel, i === this.index);

			pc.add([aura, jewel]);
			pc.setSize(64, 64).setInteractive({ useHandCursor: true });

			pc.on("pointerdown", () => {
				if (this.index !== i) {
					this.index = i;
					this.snap();
				}
			});

			this.pips.push({ container: pc, aura, jewel });
		});

		this.events.on("index", (activeIdx: number) => {
			this.pips.forEach((pip, j) => {
				const active = j === activeIdx;
				this.drawJewel(pip.jewel, active);
				pip.auraTween?.stop();

				if (active) {
					this.tweens.add({
						targets: pip.container,
						scale: 1.25,
						duration: 220 * motion(),
						ease: "Back.out(1.5)",
					});
					this.tweens.add({
						targets: pip.aura,
						alpha: 0.95,
						scale: 1.1,
						duration: 250 * motion(),
						onComplete: () => {
							if (!settings.reducedMotion) {
								pip.auraTween = this.tweens.add({
									targets: pip.aura,
									alpha: { from: 0.95, to: 0.55 },
									scale: { from: 1.1, to: 0.92 },
									duration: 1200,
									yoyo: true,
									repeat: -1,
									ease: "Sine.inOut",
								});
							}
						},
					});
				} else {
					this.tweens.add({
						targets: pip.container,
						scale: 1,
						duration: 200 * motion(),
						ease: "Cubic.out",
					});
					this.tweens.add({
						targets: pip.aura,
						alpha: 0,
						scale: 0.6,
						duration: 200 * motion(),
					});
				}
			});
		});
	}

	private drawJewel(g: Phaser.GameObjects.Graphics, active: boolean) {
		g.clear();
		if (active) {
			const w = 7.5;
			const h = 11;
			// 1. Top facet (specular highlight electrum)
			g.fillStyle(0xfffae3, 1);
			g.fillPoints([
				{ x: 0, y: -h },
				{ x: 0, y: 0 },
				{ x: -w, y: 0 },
			]);
			// 2. Top-right facet (brilliant warm gold)
			g.fillStyle(0xf5d061, 1);
			g.fillPoints([
				{ x: 0, y: -h },
				{ x: w, y: 0 },
				{ x: 0, y: 0 },
			]);
			// 3. Bottom-right facet (burnished deep gold)
			g.fillStyle(0xc49321, 1);
			g.fillPoints([
				{ x: 0, y: 0 },
				{ x: w, y: 0 },
				{ x: 0, y: h },
			]);
			// 4. Bottom-left facet (antique bronze shadow)
			g.fillStyle(0x78500c, 1);
			g.fillPoints([
				{ x: -w, y: 0 },
				{ x: 0, y: 0 },
				{ x: 0, y: h },
			]);
			// Gilded rim stroke
			g.lineStyle(1.5, 0xfffde8, 0.95);
			g.strokePoints(
				[
					{ x: 0, y: -h },
					{ x: w, y: 0 },
					{ x: 0, y: h },
					{ x: -w, y: 0 },
				],
				true,
			);
			// Center specular brilliant star
			g.fillStyle(0xffffff, 1);
			g.fillCircle(0, 0, 1.2);
		} else {
			const w = 5;
			const h = 7.5;
			// Inactive diamond cut in burnished bronze
			g.fillStyle(0x231a0e, 0.88);
			g.fillPoints([
				{ x: 0, y: -h },
				{ x: w, y: 0 },
				{ x: 0, y: h },
				{ x: -w, y: 0 },
			]);
			g.lineStyle(1.2, 0x6e5220, 0.75);
			g.strokePoints(
				[
					{ x: 0, y: -h },
					{ x: w, y: 0 },
					{ x: 0, y: h },
					{ x: -w, y: 0 },
				],
				true,
			);
			g.fillStyle(0x997528, 0.7);
			g.fillCircle(0, 0, 1);
		}
	}

	private createNavButtons() {
		this.leftChevron = this.createChevronButton(-1, () => this.step(-1));
		this.rightChevron = this.createChevronButton(1, () => this.step(1));

		this.leftChevron.container.setAlpha(0);
		this.rightChevron.container.setAlpha(0);
		this.tweens.add({
			targets: [this.leftChevron.container, this.rightChevron.container],
			alpha: 1,
			duration: 400 * motion(),
			delay: 200 * motion(),
			onComplete: () => this.updateNavButtons(),
		});
	}

	private createChevronButton(
		direction: -1 | 1,
		onTap: () => void,
	): RegalChevron {
		const x = direction === -1 ? COL_X + 40 : COL_X + W - 40;
		const y = getTrackY();
		const c = this.add.container(x, y);

		// Aura
		const aura = this.add.graphics();
		aura.fillStyle(COLORS.gold, 0.35);
		aura.fillRoundedRect(-27, -43, 54, 86, 16);
		aura.setAlpha(0);

		// Base plate
		const bg = this.add.graphics();
		bg.fillStyle(0x0c0912, 0.88);
		bg.fillRoundedRect(-24, -40, 48, 80, 14);
		// Antique bronze outer moulding
		bg.lineStyle(1.5, 0x664817, 0.95);
		bg.strokeRoundedRect(-24, -40, 48, 80, 14);
		// Inner gilded rim
		bg.lineStyle(1, 0xdfa632, 0.7);
		bg.strokeRoundedRect(-21, -37, 42, 74, 11);

		// Chevron glyph
		const glyph = this.add
			.text(direction === -1 ? -2 : 2, 0, direction === -1 ? "‹" : "›", {
				fontFamily: FONT.title,
				fontSize: "38px",
				color: hex(COLORS.gold),
				fontStyle: "700",
			})
			.setOrigin(0.5);
		glyph.setShadow(0, 2, "rgba(0, 0, 0, 0.9)", 4, false, true);

		c.add([aura, bg, glyph]);
		c.setSize(72, 96).setInteractive({ useHandCursor: true });

		let isEnabled = true;

		c.on("pointerover", () => {
			if (!isEnabled) return;
			this.tweens.add({
				targets: c,
				scale: 1.08,
				duration: 140,
				ease: "Sine.out",
			});
			this.tweens.add({
				targets: aura,
				alpha: 0.85,
				duration: 140,
			});
		});

		c.on("pointerout", () => {
			if (!isEnabled) return;
			this.tweens.add({
				targets: c,
				scale: 1,
				duration: 140,
				ease: "Sine.out",
			});
			this.tweens.add({
				targets: aura,
				alpha: 0,
				duration: 140,
			});
		});

		c.on("pointerdown", () => {
			if (!isEnabled) return;
			audio.sfx("tap");
			this.tweens.add({
				targets: c,
				scale: 0.93,
				duration: 70,
				ease: "Quad.out",
			});
		});

		c.on("pointerup", () => {
			if (!isEnabled) return;
			this.tweens.add({
				targets: c,
				scale: 1.08,
				duration: 180,
				ease: "Back.out",
			});
			onTap();
		});

		const setEnabled = (enabled: boolean) => {
			isEnabled = enabled;
			if (c.input) c.input.enabled = enabled;
			this.tweens.add({
				targets: c,
				alpha: enabled ? 1 : 0.2,
				duration: 200 * motion(),
			});
		};

		return { container: c, bg, aura, glyph, setEnabled };
	}

	private updateNavButtons() {
		if (!this.leftChevron || !this.rightChevron) return;
		this.leftChevron.setEnabled(this.index > 0);
		this.rightChevron.setEnabled(this.index < this.leaders.length - 1);
	}

	private updateCardsDuringDrag() {
		for (const c of this.cards) {
			const screenX = this.track.x + c.x;
			const dist = Math.abs(screenX - CX);
			const t = Phaser.Math.Clamp(1 - dist / GAP, 0, 1);
			const ease = Phaser.Math.Easing.Cubic.Out(t);
			c.setScale(Phaser.Math.Linear(0.86, 1, ease));
			c.setAlpha(Phaser.Math.Linear(0.5, 1, ease));
		}
	}

	public step(d: number) {
		this.index = Phaser.Math.Clamp(this.index + d, 0, this.leaders.length - 1);
		this.snap();
	}

	private transitionMood(targetHex: string, duration = 500) {
		const targetInt = Phaser.Display.Color.HexStringToColor(targetHex).color;
		if (duration === 0) {
			this.moodTween?.stop();
			this.currentMoodColor = targetInt;
			this.bg.setTint(targetInt);
			this.moodOverlay.setFillStyle(targetInt, 0.28);
			return;
		}

		const fromColor = Phaser.Display.Color.IntegerToColor(
			this.currentMoodColor,
		);
		const toColor = Phaser.Display.Color.IntegerToColor(targetInt);

		this.moodTween?.stop();
		this.moodTween = this.tweens.addCounter({
			from: 0,
			to: 1,
			duration: duration * motion(),
			ease: "Sine.out",
			onUpdate: (tw) => {
				const v = tw.getValue() ?? 0;
				const c = Phaser.Display.Color.Interpolate.ColorWithColor(
					fromColor,
					toColor,
					1,
					v,
				);
				const col = Phaser.Display.Color.GetColor(c.r, c.g, c.b);
				this.currentMoodColor = col;
				this.bg.setTint(col);
				this.moodOverlay.setFillStyle(col, 0.28);
			},
		});
	}

	private snap(instant = false) {
		this.idleTween?.stop();
		this.idleTween = undefined;

		const l = this.leaders[this.index];
		this.transitionMood(l.palette.primary, instant ? 0 : 500);

		audio.sfx("card");
		if (instant) {
			this.track.x = -this.index * GAP;
			this.cards.forEach((c, i) => {
				const active = i === this.index;
				this.tweens.killTweensOf(c);
				c.setScale(active ? 1 : 0.86);
				c.setAlpha(active ? 1 : 0.5);
				c.setY(0);
			});
			if (!settings.reducedMotion) {
				const activeCard = this.cards[this.index];
				if (activeCard) {
					this.idleTween = this.tweens.add({
						targets: activeCard,
						y: -10,
						duration: 2200,
						yoyo: true,
						repeat: -1,
						ease: "Sine.inOut",
					});
				}
			}
		} else {
			this.tweens.add({
				targets: this.track,
				x: -this.index * GAP,
				duration: 340 * motion(),
				ease: "Back.out(1.1)",
			});
			this.cards.forEach((c, i) => {
				const active = i === this.index;
				this.tweens.killTweensOf(c);
				this.tweens.add({
					targets: c,
					scale: active ? 1 : 0.86,
					alpha: active ? 1 : 0.5,
					y: 0,
					duration: 320 * motion(),
					ease: active ? "Back.out(1.15)" : "Cubic.out",
					onComplete: () => {
						if (active && i === this.index && !settings.reducedMotion) {
							this.idleTween = this.tweens.add({
								targets: c,
								y: -10,
								duration: 2200,
								yoyo: true,
								repeat: -1,
								ease: "Sine.inOut",
							});
						}
					},
				});
			});
		}

		this.updateStela(l, instant);
		this.events.emit("index", this.index);
		this.updateNavButtons();
	}

	update() {
		// masks follow the track and card floating
		for (const c of this.cards) {
			if (!c.active) continue;
			const mg = c.getData("mask") as Phaser.GameObjects.Graphics | undefined;
			if (!mg?.active) continue;
			mg.setScale(c.scale);
			mg.x = this.track.x + c.x * (1 - c.scale);
			mg.y = this.track.y * (1 - c.scale) + c.y;
		}
	}

	public begin() {
		const leader = this.leaders[this.index];
		const g = newGame(leader);
		saveGame(g);
		go(this, "Court", { resume: true });
	}
}
