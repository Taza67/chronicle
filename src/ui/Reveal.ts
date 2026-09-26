import Phaser from "phaser";
import { audio } from "../core/audio.ts";
import { settings } from "../core/state.ts";
import { COLORS, FONT, H, hex, title, W } from "./theme.ts";
import { Button } from "./widgets.ts";

/**
 * Authentic illuminated imperial decree with ancient vellum parchment,
 * ornamental wax seal, brass scroll rods with turned finials, calligraphic typography,
 * and celestial archival fact badges.
 */
export class Reveal extends Phaser.GameObjects.Container {
	private textObj: Phaser.GameObjects.Text;
	private continueBtn: Button | null = null;
	private maskG: Phaser.GameObjects.Graphics;
	private readonly pw = W - 56;
	private readonly ph: number;
	private readonly top = 180;

	constructor(scene: Phaser.Scene, kind: "history" | "whatif", text: string) {
		super(scene, 0, 0);
		this.ph = H - this.top - 200;

		const isHist = kind === "history";
		const primaryColor = isHist ? COLORS.goldDeep : COLORS.blood;
		const duration = settings.reducedMotion ? 200 : 950;

		// 1. Dimmed night backdrop with soft interactive barrier
		const shade = scene.add
			.rectangle(W / 2, H / 2, W, H, COLORS.night, 0.52)
			.setInteractive();

		// 2. Vellum Parchment Scroll Graphics (shadows, aged texture, borders, corner fleurons)
		const paperG = scene.add.graphics();
		this.drawVellum(paperG, W / 2 - this.pw / 2, this.top, this.pw, this.ph);

		// 3. Ornate Decree Heading
		const subTitleText = isHist
			? "✦ IMPERIAL ARCHIVES · HISTORICAL RECORD ✦"
			: "✦ CHRONICA INCERTA · ALTERNATE DESTINY ✦";
		const decSub = scene.add
			.text(W / 2, this.top + 72, subTitleText, {
				fontFamily: FONT.title,
				fontSize: "12px",
				fontStyle: "700",
				color: hex(primaryColor),
				align: "center",
			})
			.setOrigin(0.5);
		decSub.setLetterSpacing(3);

		const mainTitleText = isHist
			? "WHAT HISTORY RECORDS"
			: "WHAT MIGHT HAVE BEEN";
		const decHead = scene.add
			.text(W / 2, this.top + 100, mainTitleText, title(25, hex(primaryColor)))
			.setOrigin(0.5);
		decHead.setLetterSpacing(5);

		// 4. Filigree Rule Divider
		const filigreeG = scene.add.graphics();
		this.drawFiligreeDivider(filigreeG, W / 2, this.top + 130, primaryColor);

		// 5. Calligraphic Opening Quote Accent
		const quoteGlyph = scene.add
			.text(W / 2, this.top + 146, "“", {
				fontFamily: FONT.title,
				fontSize: "34px",
				fontStyle: "700",
				color: hex(primaryColor),
				align: "center",
			})
			.setOrigin(0.5)
			.setAlpha(0.65);

		// 6. Narrative Calligraphic Text
		this.textObj = scene.add
			.text(W / 2, this.top + 166, text, {
				fontFamily: FONT.body,
				fontSize: "28px",
				color: hex(0x19120b),
				wordWrap: { width: this.pw - 100 },
				align: "center",
				lineSpacing: 8,
			})
			.setOrigin(0.5, 0);

		// 7. Calligraphic Terminal Fleuron
		const closingFleuron = scene.add
			.text(W / 2, this.top + 172 + this.textObj.height + 10, "❧", {
				fontFamily: FONT.body,
				fontSize: "24px",
				color: hex(primaryColor),
				align: "center",
			})
			.setOrigin(0.5)
			.setAlpha(0.7);

		// 8. Geometry Mask for physical unrolling effect
		this.maskG = scene.make.graphics({ x: 0, y: 0 });
		this.maskG.fillStyle(0xffffff);
		this.maskG.fillRect(0, 0, W, this.top);
		const geomMask = this.maskG.createGeometryMask();

		const maskedItems: (
			| Phaser.GameObjects.Graphics
			| Phaser.GameObjects.Text
		)[] = [
			paperG,
			decSub,
			decHead,
			filigreeG,
			quoteGlyph,
			this.textObj,
			closingFleuron,
		];
		for (const item of maskedItems) {
			item.setMask(geomMask);
		}

		// 9. Top Stationary Brass Rod with Turned Finials (unmasked, fixed at top)
		const topRodG = scene.add.graphics();
		this.drawBrassRod(topRodG, W / 2, this.top, this.pw, false);

		// 10. Ornamental Wax Seal Stamped at Top (stamped onto the top edge)
		const waxSealContainer = scene.add.container(W / 2, this.top + 26);
		const waxSealG = scene.add.graphics();
		this.drawWaxSeal(waxSealG, 0, 0, kind);
		waxSealContainer.add(waxSealG);

		// Tactile seal stamp entrance
		waxSealContainer.setScale(1.4).setAlpha(0);
		scene.tweens.add({
			targets: waxSealContainer,
			scale: 1,
			alpha: 1,
			duration: settings.reducedMotion ? 150 : 320,
			ease: "Back.out",
			delay: 80,
		});

		// 11. Bottom Unrolling Brass Rod with Turned Finials & Rolled Vellum Lip
		const bottomRodContainer = scene.add.container(W / 2, this.top);
		const bottomRodG = scene.add.graphics();
		this.drawBrassRod(bottomRodG, 0, 0, this.pw, true);
		bottomRodContainer.add(bottomRodG);

		// Add base items to container
		this.add([
			shade,
			paperG,
			decSub,
			decHead,
			filigreeG,
			quoteGlyph,
			this.textObj,
			closingFleuron,
			topRodG,
			bottomRodContainer,
			waxSealContainer,
		]);

		scene.add.existing(this);
		this.setDepth(70);
		audio.sfx("reveal");

		// 12. Unroll Animation: expands geometry mask and drives bottom rod downwards
		scene.tweens.addCounter({
			from: 0,
			to: 1,
			duration,
			ease: "Cubic.out",
			onUpdate: (tw) => {
				const progress = tw.getValue() ?? 0;
				const currentY = this.top + this.ph * progress;
				bottomRodContainer.setY(currentY);

				this.maskG.clear();
				this.maskG.fillStyle(0xffffff);
				this.maskG.fillRect(0, 0, W, currentY + 4);
			},
			onComplete: () => {
				// Settle bottom rod as imperial weighted hanging bar with subtle shimmer
				if (!settings.reducedMotion) {
					scene.tweens.add({
						targets: bottomRodContainer,
						y: "+=3",
						duration: 160,
						yoyo: true,
						ease: "Quad.out",
					});
				}
			},
		});
	}

	/** Slide in the fun-fact card with ancient archival stamp and celestial sky-blue glow. */
	showFact(text: string, onCodex?: () => void) {
		const s = this.scene;
		const y = Math.min(
			this.top + this.ph - 120,
			this.top + 160 + this.textObj.height + 65,
		);
		const w = this.pw - 52;

		const c = s.add.container(W / 2, y);

		// Archival header tag
		const headerText = s.add
			.text(-w / 2 + 88, -20, "✦ ARCHIVAL RECORD", {
				fontFamily: FONT.title,
				fontSize: "12px",
				fontStyle: "700",
				color: hex(COLORS.sky),
			})
			.setOrigin(0, 0.5);
		headerText.setLetterSpacing(3);

		// Body text
		const bodyText = s.add
			.text(-w / 2 + 88, 12, text, {
				fontFamily: FONT.body,
				fontSize: "21px",
				fontStyle: "italic",
				color: hex(0xece3cb),
				wordWrap: { width: w - 114 },
				lineSpacing: 4,
			})
			.setOrigin(0, 0.5);

		const totalContentH = Math.max(
			82,
			headerText.height + bodyText.height + 34,
		);
		const h = totalContentH;

		// Re-center text vertically within card
		headerText.setY(-h / 2 + 20);
		bodyText.setY(10);

		// Card background graphics with dual border and photo-corners
		const cardBgG = s.add.graphics();
		this.drawArchivalCardBackground(cardBgG, w, h);

		// Archival Celestial Wax Seal Badge Container
		const badgeContainer = s.add.container(-w / 2 + 44, 0);

		// Celestial Sky-Blue Pulsing Radial Glow
		const glowG = s.add.graphics();
		glowG.fillStyle(COLORS.sky, 0.22);
		glowG.fillCircle(0, 0, 36);
		glowG.fillStyle(COLORS.sky, 0.12);
		glowG.fillCircle(0, 0, 46);

		// Celestial Archival Wax Seal Graphic
		const badgeG = s.add.graphics();
		this.drawArchivalBadge(badgeG, 0, 0);

		// Rotating celestial star sigil
		const celestialStar = s.add
			.text(0, 0, "✦", {
				fontFamily: FONT.ui,
				fontSize: "24px",
				color: hex(COLORS.sky),
			})
			.setOrigin(0.5);

		badgeContainer.add([glowG, badgeG, celestialStar]);

		c.add([cardBgG, badgeContainer, headerText, bodyText]);
		c.setAlpha(0).setX(W / 2 + 45);

		s.tweens.add({
			targets: c,
			alpha: 1,
			x: W / 2,
			duration: settings.reducedMotion ? 200 : 450,
			ease: "Back.out",
		});

		// Pulsing celestial aura
		if (!settings.reducedMotion) {
			s.tweens.add({
				targets: glowG,
				scale: { from: 0.95, to: 1.08 },
				alpha: { from: 0.18, to: 0.38 },
				duration: 2200,
				yoyo: true,
				repeat: -1,
				ease: "Sine.easeInOut",
			});
			s.tweens.add({
				targets: celestialStar,
				angle: 360,
				duration: 8000,
				repeat: -1,
				ease: "Linear",
			});
		}

		this.add(c);

		// If preserved in Royal Codex, show ornate archival wafer chip
		if (onCodex) {
			const chipY = y + h / 2 + 22;
			const chipContainer = s.add.container(W / 2, chipY);

			const chipG = s.add.graphics();
			const chipW = 260;
			const chipH = 30;
			chipG.fillStyle(0x0c1624, 0.92);
			chipG.fillRoundedRect(-chipW / 2, -chipH / 2, chipW, chipH, 15);
			chipG.lineStyle(1.5, COLORS.sky, 0.85);
			chipG.strokeRoundedRect(-chipW / 2, -chipH / 2, chipW, chipH, 15);

			const chipText = s.add
				.text(0, 0, "✦ PRESERVED IN ROYAL CODEX ✦", {
					fontFamily: FONT.title,
					fontSize: "12px",
					fontStyle: "700",
					color: hex(COLORS.sky),
				})
				.setOrigin(0.5);
			chipText.setLetterSpacing(2);

			chipContainer.add([chipG, chipText]);
			chipContainer.setAlpha(0).setScale(0.9);
			this.add(chipContainer);

			s.tweens.add({
				targets: chipContainer,
				alpha: 1,
				scale: 1,
				duration: 380,
				delay: 450,
				ease: "Back.out",
			});

			onCodex();
		}
	}

	/** Present the royal decree continue button. */
	waitContinue(label = "Continue"): Promise<void> {
		return new Promise((done) => {
			this.continueBtn = new Button(this.scene, W / 2, H - 110, label, () => {
				this.scene.tweens.add({
					targets: this,
					alpha: 0,
					y: -36,
					duration: 280,
					ease: "Cubic.in",
					onComplete: () => this.destroy(),
				});
				done();
			});
			this.continueBtn.setAlpha(0);
			this.add(this.continueBtn);
			this.scene.tweens.add({
				targets: this.continueBtn,
				alpha: 1,
				duration: 320,
			});
		});
	}

	// ---------------- Drawing Helpers ----------------

	/** Draw the aged illuminated vellum parchment with texture lines, aging mottling, and corner fleurons. */
	private drawVellum(
		g: Phaser.GameObjects.Graphics,
		left: number,
		top: number,
		w: number,
		h: number,
	) {
		// 1. Soft layered drop shadows
		g.fillStyle(0x000000, 0.14);
		g.fillRoundedRect(left + 8, top + 10, w, h, 14);
		g.fillStyle(0x000000, 0.08);
		g.fillRoundedRect(left + 4, top + 5, w, h, 12);

		// 2. Base aged vellum edge rim
		g.fillStyle(COLORS.parchmentDark, 1);
		g.fillRoundedRect(left, top, w, h, 12);

		// 3. Inner warm vellum face
		g.fillStyle(COLORS.parchment, 1);
		g.fillRoundedRect(left + 4, top + 4, w - 8, h - 8, 10);

		// 4. Subtle ancient vellum age mottling & watermarking
		const blemishes = [
			{ x: left + 65, y: top + 120, rx: 50, ry: 30 },
			{ x: left + w - 85, y: top + 210, rx: 65, ry: 40 },
			{ x: left + 90, y: top + h - 190, rx: 55, ry: 35 },
			{ x: left + w - 75, y: top + h - 130, rx: 45, ry: 25 },
			{ x: left + w / 2 + 110, y: top + 430, rx: 70, ry: 32 },
		];
		g.fillStyle(0x8a6225, 0.045);
		for (const b of blemishes) {
			g.fillEllipse(b.x, b.y, b.rx, b.ry);
		}

		// 5. Manuscript laid-paper grain ruling lines
		g.lineStyle(1, COLORS.goldDeep, 0.1);
		for (let y = top + 46; y < top + h - 30; y += 22) {
			g.lineBetween(left + 36, y, left + w - 36, y);
		}

		// 6. Vertical manuscript margin rules
		g.lineStyle(1, COLORS.goldDeep, 0.18);
		g.lineBetween(left + 32, top + 34, left + 32, top + h - 34);
		g.lineBetween(left + w - 32, top + 34, left + w - 32, top + h - 34);

		// 7. Medieval Illuminated Manuscript Double Gold Border
		g.lineStyle(2.5, COLORS.goldDeep, 0.85);
		g.strokeRoundedRect(left + 14, top + 14, w - 28, h - 28, 8);

		g.lineStyle(1, COLORS.gold, 0.55);
		g.strokeRoundedRect(left + 21, top + 21, w - 42, h - 42, 6);

		// 8. Illuminated Corner Brackets & Gilded Diamonds
		const corners = [
			{ x: left + 21, y: top + 21, dx: 1, dy: 1 },
			{ x: left + w - 21, y: top + 21, dx: -1, dy: 1 },
			{ x: left + 21, y: top + h - 21, dx: 1, dy: -1 },
			{ x: left + w - 21, y: top + h - 21, dx: -1, dy: -1 },
		];
		g.lineStyle(2, COLORS.gold, 0.95);
		for (const c of corners) {
			g.lineBetween(c.x, c.y, c.x + c.dx * 18, c.y);
			g.lineBetween(c.x, c.y, c.x, c.y + c.dy * 18);

			// Gilded fleuron diamond at corner
			g.fillStyle(COLORS.goldDeep, 0.9);
			const dX = c.x + c.dx * 7;
			const dY = c.y + c.dy * 7;
			g.fillTriangle(dX, dY - 4, dX + 4, dY, dX, dY + 4);
			g.fillTriangle(dX, dY - 4, dX - 4, dY, dX, dY + 4);
		}
	}

	/** Draw a cylindrical brass scroll rod with metallic reflections and turned finials. */
	private drawBrassRod(
		g: Phaser.GameObjects.Graphics,
		cx: number,
		cy: number,
		w: number,
		isBottom: boolean,
	) {
		const rw = (w + 32) / 2;

		// Rolled parchment cylinder behind bottom rod
		if (isBottom) {
			g.fillStyle(0x000000, 0.32);
			g.fillRoundedRect(cx - rw + 8, cy + 4, (rw - 8) * 2, 12, 6);

			g.fillStyle(COLORS.parchmentDark, 0.95);
			g.fillRoundedRect(cx - rw + 8, cy - 9, (rw - 8) * 2, 13, 5);
			g.fillStyle(COLORS.parchment, 0.85);
			g.fillRoundedRect(cx - rw + 10, cy - 7, (rw - 10) * 2, 5, 2);
		}

		// 1. Deep shadow foundation
		g.fillStyle(0x342207, 1);
		g.fillRoundedRect(cx - rw, cy - 8, rw * 2, 16, 4);

		// 2. Rich bronze mid-tone
		g.fillStyle(0x8c641a, 1);
		g.fillRoundedRect(cx - rw, cy - 7, rw * 2, 14, 3);

		// 3. Polished warm brass body
		g.fillStyle(0xcca032, 1);
		g.fillRoundedRect(cx - rw, cy - 6, rw * 2, 10, 2);

		// 4. Specular metallic brass reflection highlight
		g.fillStyle(0xffef9e, 0.92);
		g.fillRect(cx - rw + 6, cy - 5, (rw - 6) * 2, 2.5);

		// 5. White specular core gleam
		g.fillStyle(0xffffff, 0.65);
		g.fillRect(cx - rw + 18, cy - 4, (rw - 18) * 2, 1);

		// 6. Bottom rim bevel shadow
		g.fillStyle(0x241604, 0.85);
		g.fillRect(cx - rw, cy + 6, rw * 2, 2);

		// Turned Brass Finials at Left and Right
		const finials = [
			{ x: cx - rw, dir: -1 },
			{ x: cx + rw, dir: 1 },
		];
		for (const f of finials) {
			const dir = f.dir;
			const bx = f.x;

			// Flanged collar ring
			g.fillStyle(0x422d0a, 1);
			g.fillRect(dir === -1 ? bx - 5 : bx, cy - 10, 5, 20);
			g.fillStyle(0xcca032, 1);
			g.fillRect(dir === -1 ? bx - 4 : bx + 1, cy - 9, 3, 18);
			g.fillStyle(0xffef9e, 0.9);
			g.fillRect(dir === -1 ? bx - 3 : bx + 1.5, cy - 8, 1.5, 6);

			// Turned brass sphere
			const ballX = bx + dir * 15;
			g.fillStyle(0x342207, 1);
			g.fillCircle(ballX, cy, 11);
			g.fillStyle(0x8c641a, 1);
			g.fillCircle(ballX, cy, 10);
			g.fillStyle(0xcca032, 1);
			g.fillCircle(ballX - dir * 1, cy - 1, 8.5);

			// Specular reflection on sphere
			g.fillStyle(0xffef9e, 0.95);
			g.fillCircle(ballX - dir * 3, cy - 3, 4);
			g.fillStyle(0xffffff, 0.85);
			g.fillCircle(ballX - dir * 3.5, cy - 3.5, 2);

			// Acorn spire tip
			const tipX = ballX + dir * 11;
			g.fillStyle(0x8c641a, 1);
			g.fillTriangle(tipX, cy - 5, tipX, cy + 5, tipX + dir * 8, cy);
			g.fillStyle(0xffef9e, 0.9);
			g.fillTriangle(tipX, cy - 2, tipX, cy + 2, tipX + dir * 7, cy);
		}
	}

	/** Draw the ornamental imperial wax seal with silk ribbons, scalloped wax, and intaglio emblem. */
	private drawWaxSeal(
		g: Phaser.GameObjects.Graphics,
		cx: number,
		cy: number,
		kind: "history" | "whatif",
	) {
		const isHist = kind === "history";

		// 1. Twin silk ribbons draping from behind seal with swallowtail notch
		const ribColor = isHist ? 0x821a1a : 0x480a14;
		const ribBorder = isHist ? 0xd4af37 : 0xa8322d;

		// Left Ribbon
		g.fillStyle(ribColor, 0.95);
		g.beginPath();
		g.moveTo(cx - 16, cy);
		g.lineTo(cx - 24, cy + 62);
		g.lineTo(cx - 16, cy + 52);
		g.lineTo(cx - 8, cy + 62);
		g.lineTo(cx - 2, cy);
		g.closePath();
		g.fillPath();
		g.lineStyle(1.5, ribBorder, 0.85);
		g.strokePath();

		// Right Ribbon
		g.fillStyle(ribColor, 0.95);
		g.beginPath();
		g.moveTo(cx + 2, cy);
		g.lineTo(cx + 8, cy + 62);
		g.lineTo(cx + 16, cy + 52);
		g.lineTo(cx + 24, cy + 62);
		g.lineTo(cx + 16, cy);
		g.closePath();
		g.fillPath();
		g.lineStyle(1.5, ribBorder, 0.85);
		g.strokePath();

		// 2. Multi-lobed organic melted wax perimeter
		const baseColor = isHist ? 0x8c6418 : 0x761212;
		const midColor = isHist ? 0xba8c26 : 0x9f1e1e;
		const lightColor = isHist ? 0xf7d264 : 0xde4e4e;
		const darkColor = isHist ? 0x463208 : 0x360505;

		const numLobes = 14;
		const baseR = 34;
		g.fillStyle(baseColor, 1);
		g.beginPath();
		for (let i = 0; i <= numLobes * 4; i++) {
			const angle = (i / (numLobes * 4)) * Math.PI * 2;
			const r =
				baseR + Math.sin(angle * numLobes) * 3.5 + Math.cos(angle * 3) * 1.5;
			const px = cx + Math.cos(angle) * r;
			const py = cy + Math.sin(angle) * r;
			if (i === 0) g.moveTo(px, py);
			else g.lineTo(px, py);
		}
		g.closePath();
		g.fillPath();

		// Wax mid-tone dome
		g.fillStyle(midColor, 0.92);
		g.fillCircle(cx, cy, 30);

		// 3. 3D Beveled rim
		g.lineStyle(3, lightColor, 0.8);
		g.beginPath();
		g.arc(cx, cy, 27, Math.PI * 0.75, Math.PI * 1.85);
		g.strokePath();

		g.lineStyle(3, darkColor, 0.85);
		g.beginPath();
		g.arc(cx, cy, 27, Math.PI * 1.85, Math.PI * 2.75);
		g.strokePath();

		// 4. Recessed Matrix Bed
		g.fillStyle(darkColor, 0.95);
		g.fillCircle(cx, cy, 22);
		g.fillStyle(baseColor, 0.82);
		g.fillCircle(cx, cy, 20.5);

		// 5. Stamped Beaded Matrix Border (ring of pearls)
		const beadCount = 18;
		const beadR = 18.5;
		g.fillStyle(lightColor, 0.85);
		for (let b = 0; b < beadCount; b++) {
			const a = (b / beadCount) * Math.PI * 2;
			g.fillCircle(cx + Math.cos(a) * beadR, cy + Math.sin(a) * beadR, 1.2);
		}

		// 6. Intaglio Engraved Emblem
		if (isHist) {
			// Imperial Crown & Star Sigil
			g.lineStyle(2, darkColor, 0.95);
			g.lineBetween(cx - 10, cy + 6, cx + 10, cy + 6);
			g.lineBetween(cx - 10, cy + 6, cx - 11, cy - 4);
			g.lineBetween(cx - 11, cy - 4, cx - 5, cy + 1);
			g.lineBetween(cx - 5, cy + 1, cx, cy - 9);
			g.lineBetween(cx, cy - 9, cx + 5, cy + 1);
			g.lineBetween(cx + 5, cy + 1, cx + 11, cy - 4);
			g.lineBetween(cx + 11, cy - 4, cx + 10, cy + 6);

			g.fillCircle(cx - 11, cy - 5, 1.5);
			g.fillCircle(cx, cy - 10, 2);
			g.fillCircle(cx + 11, cy - 5, 1.5);

			// Lower specular intaglio highlight
			g.lineStyle(1.5, lightColor, 0.85);
			g.lineBetween(cx - 9, cy + 7.5, cx + 9, cy + 7.5);
			g.lineBetween(cx - 10, cy + 7, cx - 4, cy + 2.5);
			g.lineBetween(cx + 4, cy + 2.5, cx + 10, cy + 7);
		} else {
			// Temporal Hourglass & Divergent Destiny Sigil
			g.lineStyle(2, darkColor, 0.95);
			g.lineBetween(cx - 8, cy - 9, cx + 8, cy - 9);
			g.lineBetween(cx - 8, cy + 9, cx + 8, cy + 9);
			g.lineBetween(cx - 8, cy - 9, cx, cy);
			g.lineBetween(cx + 8, cy - 9, cx, cy);
			g.lineBetween(cx - 8, cy + 9, cx, cy);
			g.lineBetween(cx + 8, cy + 9, cx, cy);
			g.fillCircle(cx, cy, 1.5);

			// Lower specular intaglio highlight
			g.lineStyle(1.5, lightColor, 0.85);
			g.lineBetween(cx - 7, cy + 10.5, cx + 7, cy + 10.5);
			g.lineBetween(cx - 6, cy + 1, cx - 1, cy + 9.5);
			g.lineBetween(cx + 6, cy + 1, cx + 1, cy + 9.5);
		}

		// 7. Wax gloss highlight sheen
		g.fillStyle(0xffffff, 0.35);
		g.fillEllipse(cx - 10, cy - 12, 6, 3);
	}

	/** Draw the ornate filigree manuscript rule divider. */
	private drawFiligreeDivider(
		g: Phaser.GameObjects.Graphics,
		cx: number,
		cy: number,
		color: number,
	) {
		// Central 4-point diamond
		g.fillStyle(color, 0.85);
		g.fillTriangle(cx, cy - 6, cx + 6, cy, cx, cy + 6);
		g.fillTriangle(cx, cy - 6, cx - 6, cy, cx, cy + 6);

		// Flanking fleurons
		g.fillCircle(cx - 15, cy, 2);
		g.fillCircle(cx + 15, cy, 2);
		g.fillCircle(cx - 26, cy, 1.5);
		g.fillCircle(cx + 26, cy, 1.5);

		// Tapered rule lines
		g.lineStyle(1.5, color, 0.7);
		g.lineBetween(cx - 150, cy, cx - 34, cy);
		g.lineBetween(cx + 34, cy, cx + 150, cy);

		g.lineStyle(0.75, color, 0.35);
		g.lineBetween(cx - 130, cy + 3, cx - 42, cy + 3);
		g.lineBetween(cx + 42, cy + 3, cx + 130, cy + 3);

		// Terminal diamond accents
		g.fillTriangle(cx - 150, cy - 3, cx - 147, cy, cx - 150, cy + 3);
		g.fillTriangle(cx - 150, cy - 3, cx - 153, cy, cx - 150, cy + 3);
		g.fillTriangle(cx + 150, cy - 3, cx + 153, cy, cx + 150, cy + 3);
		g.fillTriangle(cx + 150, cy - 3, cx + 147, cy, cx + 150, cy + 3);
	}

	/** Draw the archival card background with dual sky/gold border and gilded photo-corners. */
	private drawArchivalCardBackground(
		g: Phaser.GameObjects.Graphics,
		w: number,
		h: number,
	) {
		// Deep midnight archival obsidian card base
		g.fillStyle(0x0e131c, 0.95);
		g.fillRoundedRect(-w / 2, -h / 2, w, h, 14);

		// Outer celestial sky border
		g.lineStyle(1.5, COLORS.sky, 0.75);
		g.strokeRoundedRect(-w / 2, -h / 2, w, h, 14);

		// Inner antique gold hairline border
		g.lineStyle(1, COLORS.gold, 0.35);
		g.strokeRoundedRect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 10);

		// Gilded archival photo-corners
		const corners = [
			{ x: -w / 2 + 5, y: -h / 2 + 5, dx: 1, dy: 1 },
			{ x: w / 2 - 5, y: -h / 2 + 5, dx: -1, dy: 1 },
			{ x: -w / 2 + 5, y: h / 2 - 5, dx: 1, dy: -1 },
			{ x: w / 2 - 5, y: h / 2 - 5, dx: -1, dy: -1 },
		];
		g.lineStyle(1.5, COLORS.sky, 0.85);
		for (const c of corners) {
			g.lineBetween(c.x, c.y, c.x + c.dx * 12, c.y);
			g.lineBetween(c.x, c.y, c.x, c.y + c.dy * 12);
		}

		// Archival Circular Stamp Watermark in bottom-right corner
		const wX = w / 2 - 40;
		const wY = h / 2 - 20;
		g.lineStyle(1, COLORS.sky, 0.08);
		g.strokeCircle(wX, wY, 18);
		g.strokeCircle(wX, wY, 14);
	}

	/** Draw the celestial archival wax wafer badge with astrolabe ring. */
	private drawArchivalBadge(
		g: Phaser.GameObjects.Graphics,
		cx: number,
		cy: number,
	) {
		// Scalloped midnight cobalt wax wafer
		const numLobes = 12;
		const baseR = 26;
		g.fillStyle(0x10243d, 1);
		g.beginPath();
		for (let i = 0; i <= numLobes * 4; i++) {
			const angle = (i / (numLobes * 4)) * Math.PI * 2;
			const r = baseR + Math.sin(angle * numLobes) * 2.5;
			const px = cx + Math.cos(angle) * r;
			const py = cy + Math.sin(angle) * r;
			if (i === 0) g.moveTo(px, py);
			else g.lineTo(px, py);
		}
		g.closePath();
		g.fillPath();

		// Raised 3D bevel rim in celestial sky
		g.lineStyle(2, COLORS.sky, 0.85);
		g.beginPath();
		g.arc(cx, cy, 22, Math.PI * 0.75, Math.PI * 1.85);
		g.strokePath();

		g.lineStyle(2, 0x071526, 0.9);
		g.beginPath();
		g.arc(cx, cy, 22, Math.PI * 1.85, Math.PI * 2.75);
		g.strokePath();

		// Recessed center bed
		g.fillStyle(0x0a1828, 0.95);
		g.fillCircle(cx, cy, 18);

		// Astrolabe concentric astronomical ring
		g.lineStyle(1, COLORS.sky, 0.5);
		g.strokeCircle(cx, cy, 14);

		// Planetary orbital dots
		g.fillStyle(COLORS.sky, 0.75);
		for (let i = 0; i < 6; i++) {
			const a = (i / 6) * Math.PI * 2;
			g.fillCircle(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, 1);
		}
	}
}
