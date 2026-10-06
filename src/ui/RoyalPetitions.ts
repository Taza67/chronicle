import Phaser from "phaser";
import type { Petition } from "../content/petitions.ts";
import { audio } from "../core/audio.ts";
import { settings } from "../core/state.ts";
import { CANVAS_W, COLORS, CX, FONT, H, hex } from "./theme.ts";

export interface RoyalPetitionsOpts {
	petitions: Petition[];
	onDecision: (p: Petition, accepted: boolean) => void;
	onComplete: () => void;
}

/**
 * Rapid tactile audience of popular petitions (Reigns-style micro-phase).
 * Breaks up council deliberations with instant direct decrees.
 */
export class RoyalPetitions extends Phaser.GameObjects.Container {
	private currentIndex = 0;
	private banner: Phaser.GameObjects.Container;
	private progressDots: Phaser.GameObjects.Graphics;
	private locked = false;
	private opts: RoyalPetitionsOpts;

	constructor(scene: Phaser.Scene, opts: RoyalPetitionsOpts) {
		super(scene, 0, 0);
		this.opts = opts;

		// 1. Dark semi-transparent atmospheric backdrop
		const bg = scene.add
			.rectangle(CX, H / 2, CANVAS_W, H, COLORS.night, 0.78)
			.setInteractive();
		this.add(bg);

		// 2. Audience Header Banner — authored at 210 for H=1280; scale with
		// canvas height (capped) so tall phones don't strand it at the top.
		const bannerY = Math.round(210 * Math.min(1.3, H / 1280));
		this.banner = scene.add.container(CX, bannerY);
		const bGfx = scene.add.graphics();
		bGfx.fillStyle(0x130f1e, 0.95);
		bGfx.fillRoundedRect(-240, -32, 480, 64, 18);
		bGfx.lineStyle(1.5, COLORS.gold, 0.85);
		bGfx.strokeRoundedRect(-240, -32, 480, 64, 18);

		const bTitle = scene.add
			.text(0, -8, "AUDIENCE OF PETITIONS", {
				fontFamily: FONT.title,
				fontSize: "20px",
				color: hex(COLORS.gold),
				fontStyle: "700",
			})
			.setOrigin(0.5);
		bTitle.setLetterSpacing(3);

		const bSub = scene.add
			.text(0, 14, "Urgent realm grievances · Decreed by the Crown", {
				fontFamily: FONT.ui,
				fontSize: "12px",
				color: hex(COLORS.muted),
				fontStyle: "500",
			})
			.setOrigin(0.5);

		this.banner.add([bGfx, bTitle, bSub]);
		this.add(this.banner);

		// 3. Progress indicator pips
		this.progressDots = scene.add.graphics();
		this.progressDots.setPosition(CX, bannerY + 50);
		this.add(this.progressDots);
		this.updateProgressDots();

		scene.add.existing(this);
		this.setDepth(80);

		audio.sfx("fanfare");
		this.showPetition(0);
	}

	private updateProgressDots() {
		this.progressDots.clear();
		const total = this.opts.petitions.length;
		const spacing = 28;
		const startX = -((total - 1) * spacing) / 2;

		for (let i = 0; i < total; i++) {
			const x = startX + i * spacing;
			if (i === this.currentIndex) {
				this.progressDots.fillStyle(COLORS.gold, 1);
				this.progressDots.fillCircle(x, 0, 6);
				this.progressDots.lineStyle(1.5, 0xffffff, 0.9);
				this.progressDots.strokeCircle(x, 0, 6);
			} else if (i < this.currentIndex) {
				this.progressDots.fillStyle(COLORS.goldDeep, 0.8);
				this.progressDots.fillCircle(x, 0, 4);
			} else {
				this.progressDots.fillStyle(0x3a3048, 0.7);
				this.progressDots.fillCircle(x, 0, 4);
			}
		}
	}

	private showPetition(index: number) {
		if (!this.active) return;
		if (index >= this.opts.petitions.length) {
			this.finish();
			return;
		}

		this.currentIndex = index;
		this.updateProgressDots();
		const p = this.opts.petitions[index];
		const scene = this.scene;

		const cardW = 580;
		const cardH = 480;
		const card = scene.add.container(CX, H * 0.52);

		// Ambient drop shadow
		const shadow = scene.add.graphics();
		shadow.fillStyle(0x000000, 0.45);
		shadow.fillRoundedRect(-cardW / 2 + 3, -cardH / 2 + 8, cardW, cardH, 20);

		// Parchment card body
		const body = scene.add.graphics();
		body.fillStyle(COLORS.parchment, 0.98);
		body.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 20);

		// Double gold leaf border
		body.lineStyle(2.5, COLORS.gold, 0.95);
		body.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 20);
		body.lineStyle(1, 0xfff0b8, 0.6);
		body.strokeRoundedRect(
			-cardW / 2 + 5,
			-cardH / 2 + 5,
			cardW - 10,
			cardH - 10,
			16,
		);

		// Petitioner Ribbon Tag at top of card
		const tag = scene.add.container(0, -cardH / 2 + 36);
		const tagBg = scene.add.graphics();
		tagBg.fillStyle(COLORS.night, 0.85);
		tagBg.fillRoundedRect(-180, -18, 360, 36, 12);
		tagBg.lineStyle(1.5, COLORS.gold, 0.8);
		tagBg.strokeRoundedRect(-180, -18, 360, 36, 12);

		const tagText = scene.add
			.text(0, 0, `${p.icon}  ${p.petitioner.toUpperCase()}`, {
				fontFamily: FONT.title,
				fontSize: "14px",
				color: hex(COLORS.gold),
				fontStyle: "700",
			})
			.setOrigin(0.5);
		tagText.setLetterSpacing(1.5);
		tag.add([tagBg, tagText]);

		// Petition Title
		const pTitle = scene.add
			.text(0, -cardH / 2 + 95, p.title, {
				fontFamily: FONT.title,
				fontSize: "26px",
				color: hex(COLORS.night),
				fontStyle: "700",
				align: "center",
			})
			.setOrigin(0.5);

		// Petition Request Story
		const pRequest = scene.add
			.text(0, -cardH / 2 + 185, `« ${p.request} »`, {
				fontFamily: FONT.body,
				fontSize: "26px",
				color: "#241e2e",
				fontStyle: "italic",
				align: "center",
				wordWrap: { width: cardW - 64 },
				lineSpacing: 4,
			})
			.setOrigin(0.5);

		// Two tactile choice buttons at bottom: REJETER vs ACCORDER
		const btnY = cardH / 2 - 70;
		const btnW = 230;
		const btnH = 68;

		// 1. REJECT BUTTON (Left)
		const btnReject = scene.add.container(-cardW / 4, btnY);
		const rGfx = scene.add.graphics();
		rGfx.fillStyle(COLORS.blood, 0.95);
		rGfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 14);
		rGfx.lineStyle(1.5, 0xffffff, 0.85);
		rGfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 14);

		const rText = scene.add
			.text(0, -8, `✕ ${p.rejectLabel.toUpperCase()}`, {
				fontFamily: FONT.title,
				fontSize: "13px",
				color: "#ffffff",
				fontStyle: "700",
			})
			.setOrigin(0.5);
		rText.setLetterSpacing(1);

		const rDelta = scene.add
			.text(
				0,
				14,
				`◆${p.rejectEffects.gold >= 0 ? "+" : ""}${p.rejectEffects.gold}  ⚖${p.rejectEffects.stability >= 0 ? "+" : ""}${p.rejectEffects.stability}`,
				{
					fontFamily: FONT.ui,
					fontSize: "12px",
					color: "#ffd5d5",
					fontStyle: "700",
				},
			)
			.setOrigin(0.5);

		btnReject.add([rGfx, rText, rDelta]);
		btnReject.setSize(btnW, btnH).setInteractive({ useHandCursor: true });
		btnReject.on("pointerdown", () => this.handlePick(false, card));

		// 2. ACCEPT BUTTON (Right)
		const btnAccept = scene.add.container(cardW / 4, btnY);
		const aGfx = scene.add.graphics();
		aGfx.fillStyle(0x2a5c36, 0.95);
		aGfx.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 14);
		aGfx.lineStyle(1.5, COLORS.gold, 0.9);
		aGfx.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 14);

		const aText = scene.add
			.text(0, -8, `♛ ${p.acceptLabel.toUpperCase()}`, {
				fontFamily: FONT.title,
				fontSize: "13px",
				color: hex(COLORS.gold),
				fontStyle: "700",
			})
			.setOrigin(0.5);
		aText.setLetterSpacing(1);

		const aDelta = scene.add
			.text(
				0,
				14,
				`◆${p.acceptEffects.gold >= 0 ? "+" : ""}${p.acceptEffects.gold}  ⚖${p.acceptEffects.stability >= 0 ? "+" : ""}${p.acceptEffects.stability}`,
				{
					fontFamily: FONT.ui,
					fontSize: "12px",
					color: "#d4ffd8",
					fontStyle: "700",
				},
			)
			.setOrigin(0.5);

		btnAccept.add([aGfx, aText, aDelta]);
		btnAccept.setSize(btnW, btnH).setInteractive({ useHandCursor: true });
		btnAccept.on("pointerdown", () => this.handlePick(true, card));

		card.add([shadow, body, tag, pTitle, pRequest, btnReject, btnAccept]);

		// Entrance animation: slides up with slight scale
		card.setAlpha(0).setY(H * 0.52 + 50);
		scene.tweens.add({
			targets: card,
			alpha: 1,
			y: H * 0.52,
			duration: settings.reducedMotion ? 120 : 380,
			ease: "Back.out",
		});

		this.add(card);
	}

	private handlePick(accepted: boolean, card: Phaser.GameObjects.Container) {
		if (this.locked) return;
		this.locked = true;

		const p = this.opts.petitions[this.currentIndex];
		audio.sfx("card");

		// Fling animation left (reject) or right (accept)
		this.scene.tweens.add({
			targets: card,
			x: accepted ? CANVAS_W + 350 : -350,
			angle: accepted ? 14 : -14,
			alpha: 0,
			duration: settings.reducedMotion ? 100 : 340,
			ease: "Quad.in",
			onComplete: () => {
				card.destroy();
				this.locked = false;
				this.opts.onDecision(p, accepted);
				// The audience may have been adjourned (destroyed) while the
				// card was in flight — bail instead of touching dead children.
				if (this.active) this.showPetition(this.currentIndex + 1);
			},
		});
	}

	/** Adjourn the audience early — e.g. the realm collapsed mid-petition. */
	public abandon() {
		if (!this.active) return;
		this.finish();
	}

	private finish() {
		audio.sfx("chime");
		this.scene.tweens.add({
			targets: this,
			alpha: 0,
			duration: 350,
			onComplete: () => {
				this.destroy();
				this.opts.onComplete();
			},
		});
	}
}
