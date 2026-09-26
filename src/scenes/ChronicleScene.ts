import Phaser from "phaser";
import { type ReignRecord, reigns } from "../core/state.ts";
import { ScrollList } from "../ui/ScrollList.ts";
import {
	COLORS,
	FONT,
	H,
	hex,
	SAFE_BOTTOM,
	SAFE_TOP,
	ui,
	W,
} from "../ui/theme.ts";
import { fadeIn, go, heading, iconButton } from "../ui/widgets.ts";

/**
 * Draws an authentic multi-lobed 3D wax seal node along the timeline spine.
 */
function drawTimelineWaxSeal(
	g: Phaser.GameObjects.Graphics,
	cx: number,
	cy: number,
	radius: number,
	cardX: number,
	opts: {
		baseColor: number;
		rimColor: number;
		shadowColor: number;
		ribbonColor: number;
	},
) {
	// Ambient drop shadow beneath wax seal
	g.fillStyle(0x000000, 0.48);
	g.fillCircle(cx + 1.8, cy + 2.5, radius + 1);

	// Silk ribbon tails connecting wax seal to the archival reign card
	g.fillStyle(opts.ribbonColor, 0.95);
	// Upper silk ribbon streamer
	g.beginPath();
	g.moveTo(cx + 4, cy - 8);
	g.lineTo(cardX + 2, cy - 14);
	g.lineTo(cardX + 2, cy - 2);
	g.lineTo(cx + 8, cy + 2);
	g.closePath();
	g.fillPath();
	g.lineStyle(1, 0x1d0b04, 0.4);
	g.strokePath();

	// Lower swallowtail silk ribbon streamer
	g.beginPath();
	g.moveTo(cx + 2, cy + 4);
	g.lineTo(cardX + 8, cy + 12);
	g.lineTo(cardX + 2, cy + 18);
	g.lineTo(cardX + 8, cy + 24);
	g.lineTo(cx + 6, cy + 12);
	g.closePath();
	g.fillPath();
	g.strokePath();

	// Scalloped melted wax puddle (12 lobes with organic radius oscillation)
	const lobes = 12;
	const angleStep = (Math.PI * 2) / lobes;
	g.fillStyle(opts.baseColor, 0.98);
	g.beginPath();
	for (let i = 0; i <= lobes; i++) {
		const angle = i * angleStep;
		const r = radius + (i % 2 === 0 ? 2.5 : -2);
		const px = cx + Math.cos(angle) * r;
		const py = cy + Math.sin(angle) * r;
		if (i === 0) g.moveTo(px, py);
		else g.lineTo(px, py);
	}
	g.closePath();
	g.fillPath();

	// Outer raised wax rim
	g.lineStyle(2.5, opts.rimColor, 0.85);
	g.strokeCircle(cx, cy, radius - 3);

	// Specular highlight arc along upper-left
	g.lineStyle(1.5, 0xfff0c8, 0.65);
	g.beginPath();
	g.arc(cx, cy, radius - 3, -Math.PI * 0.85, -Math.PI * 0.15);
	g.strokePath();

	// Shading arc along lower-right
	g.lineStyle(1.5, 0x140604, 0.55);
	g.beginPath();
	g.arc(cx, cy, radius - 3, Math.PI * 0.15, Math.PI * 0.85);
	g.strokePath();

	// Debossed inner core
	g.fillStyle(opts.shadowColor, 0.95);
	g.fillCircle(cx, cy, radius - 6);
	g.lineStyle(1, opts.rimColor, 0.35);
	g.strokeCircle(cx, cy, radius - 6);
}

/**
 * Draws four illuminated manuscript corner brackets with gold diamond pips.
 */
function drawCornerFlourishes(
	g: Phaser.GameObjects.Graphics,
	x: number,
	y: number,
	w: number,
	h: number,
	color: number,
	len = 12,
) {
	g.lineStyle(1.5, color, 0.8);
	// Top-Left
	g.lineBetween(x + 10, y + 10 + len, x + 10, y + 10);
	g.lineBetween(x + 10, y + 10, x + 10 + len, y + 10);
	// Top-Right
	g.lineBetween(x + w - 10 - len, y + 10, x + w - 10, y + 10);
	g.lineBetween(x + w - 10, y + 10, x + w - 10, y + 10 + len);
	// Bottom-Left
	g.lineBetween(x + 10, y + h - 10 - len, x + 10, y + h - 10);
	g.lineBetween(x + 10, y + h - 10, x + 10 + len, y + h - 10);
	// Bottom-Right
	g.lineBetween(x + w - 10 - len, y + h - 10, x + w - 10, y + h - 10);
	g.lineBetween(x + w - 10, y + h - 10, x + w - 10, y + h - 10 - len);

	// 4 Corner diamond studs
	g.fillStyle(color, 0.9);
	for (const [px, py] of [
		[x + 10, y + 10],
		[x + w - 10, y + 10],
		[x + 10, y + h - 10],
		[x + w - 10, y + h - 10],
	]) {
		g.fillCircle(px, py, 2.2);
	}
}

/**
 * Draws an embossed velvet/silk verdict ribbon across the top of a reign card.
 */
function drawVerdictRibbon(
	g: Phaser.GameObjects.Graphics,
	rx: number,
	ry: number,
	rw: number,
	rh: number,
	theme: {
		bodyColor: number;
		borderColor: number;
		highlightColor: number;
	},
) {
	// Ambient shadow beneath ribbon
	g.fillStyle(0x000000, 0.35);
	g.fillRoundedRect(rx, ry + 2.5, rw, rh, 6);

	// Ribbon body
	g.fillStyle(theme.bodyColor, 0.95);
	g.fillRoundedRect(rx, ry, rw, rh, 6);

	// Outer gilded border
	g.lineStyle(1.8, theme.borderColor, 0.9);
	g.strokeRoundedRect(rx, ry, rw, rh, 6);

	// Specular highlight line along upper rim
	g.lineStyle(1.2, theme.highlightColor, 0.65);
	g.lineBetween(rx + 8, ry + 1.5, rx + rw - 8, ry + 1.5);

	// Crease shading line along bottom rim
	g.lineStyle(1, 0x080404, 0.45);
	g.lineBetween(rx + 8, ry + rh - 1.5, rx + rw - 8, ry + rh - 1.5);

	// Left and right beveled fold notches
	g.fillStyle(theme.borderColor, 0.85);
	g.fillTriangle(rx, ry + rh / 2, rx + 4, ry + 4, rx + 4, ry + rh - 4);
	g.fillTriangle(
		rx + rw,
		ry + rh / 2,
		rx + rw - 4,
		ry + 4,
		rx + rw - 4,
		ry + rh - 4,
	);
}

/**
 * Grand Imperial Archives: Antique imperial genealogical timeline spine
 * with ornate wax seal nodes and archival reign record cards with embossed verdict ribbons.
 */
export class ChronicleScene extends Phaser.Scene {
	constructor() {
		super("Chronicle");
	}

	create() {
		fadeIn(this);

		// Deep imperial night backdrop
		this.add.rectangle(W / 2, H / 2, W, H, COLORS.night);
		const bg = this.add.image(W / 2, H / 2, "title_bg");
		bg.setScale(Math.max(W / bg.width, H / bg.height) * 1.1)
			.setAlpha(0.18)
			.setTint(0x321e1a);

		// Vignette shadow overlay
		const vignette = this.add.image(W / 2, H / 2, "vignette");
		vignette.setDisplaySize(W, H).setAlpha(0.75);

		// Imperial Header
		heading(this, SAFE_TOP + 18, "Imperial Chronicle", 36);
		this.add
			.text(W / 2, SAFE_TOP + 48, "GENEALOGICAL ROLL OF REIGNS", {
				fontFamily: FONT.title,
				fontSize: "12px",
				color: hex(COLORS.goldDeep),
				fontStyle: "700",
			})
			.setOrigin(0.5)
			.setLetterSpacing(4);

		iconButton(this, 56, SAFE_TOP + 18, "‹", () => go(this, "Title"));

		// Grand Imperial Roll Summary Ribbon Pill
		const totalDecrees = reigns.reduce((n, r) => n + r.total, 0);
		const matchedDecrees = reigns.reduce((n, r) => n + r.matched, 0);
		const fidelityPct =
			totalDecrees > 0 ? Math.round((matchedDecrees / totalDecrees) * 100) : 0;

		const summaryBg = this.add.graphics();
		summaryBg.fillStyle(0x130f1d, 0.85);
		summaryBg.fillRoundedRect(W / 2 - 260, 114, 520, 26, 13);
		summaryBg.lineStyle(1, COLORS.goldDeep, 0.65);
		summaryBg.strokeRoundedRect(W / 2 - 260, 114, 520, 26, 13);

		const summaryText = reigns.length
			? `✦  ${reigns.length} ${reigns.length === 1 ? "REIGN" : "REIGNS"} RECORDED  ·  ${matchedDecrees}/${totalDecrees} HISTORICAL DECREES (${fidelityPct}%)  ✦`
			: "✦  NO REIGNS RECORDED IN THE IMPERIAL ARCHIVES YET  ✦";

		this.add
			.text(W / 2, 127, summaryText, {
				fontFamily: FONT.ui,
				fontSize: "11px",
				color: hex(COLORS.gold),
				fontStyle: "700",
			})
			.setOrigin(0.5)
			.setLetterSpacing(1.5);

		// Scrollable genealogical timeline container
		const list = new ScrollList(this, 168, H - SAFE_BOTTOM - 20);
		let y = 14;

		if (!reigns.length) {
			// Illuminated empty archival scroll
			const emptyW = W - 96;
			const emptyH = 170;
			const emptyX = 48;
			const eg = this.add.graphics();
			eg.fillStyle(0x130f1c, 0.85);
			eg.fillRoundedRect(emptyX, 40, emptyW, emptyH, 14);
			eg.lineStyle(1.5, COLORS.goldDeep, 0.65);
			eg.strokeRoundedRect(emptyX, 40, emptyW, emptyH, 14);
			drawCornerFlourishes(eg, emptyX, 40, emptyW, emptyH, COLORS.goldDeep);

			const emptyTitle = this.add
				.text(W / 2, 76, "THE IMPERIAL ROLL LIES UNWRITTEN", {
					fontFamily: FONT.title,
					fontSize: "20px",
					color: hex(COLORS.gold),
					fontStyle: "700",
				})
				.setOrigin(0.5);
			emptyTitle.setLetterSpacing(3);

			const emptyBody = this.add
				.text(
					W / 2,
					124,
					"Ascend the throne, decree your royal will before the court,\nand the imperial chroniclers shall inscribe your lineage in wax and gold.",
					{
						fontFamily: FONT.body,
						fontSize: "22px",
						color: hex(COLORS.muted),
						align: "center",
						wordWrap: { width: emptyW - 48 },
						lineSpacing: 4,
					},
				)
				.setOrigin(0.5);

			list.add([eg, emptyTitle, emptyBody]);
			list.setContentHeight(240);
			return;
		}

		const sortedReigns = [...reigns].sort((a, b) => b.at - a.at);
		const spineX = 52;
		const cardX = 86;
		const cardW = W - 114;

		// Dedicated graphics for the continuous genealogical timeline spine
		const spineG = this.add.graphics();
		list.add(spineG);

		// Build each archival reign record card with its wax seal node
		for (let idx = 0; idx < sortedReigns.length; idx++) {
			const r = sortedReigns[idx];
			const isCollapse = !!r.collapse;
			const matchRatio = r.matched / Math.max(1, r.total);
			const isTriumph = !isCollapse && matchRatio >= 0.65;
			const isSteady = !isCollapse && !isTriumph;

			// Measure commentary text height
			const commentTxt = this.add.text(
				cardX + 22,
				y + (isCollapse ? 160 : 130),
				r.verdict.comment,
				{
					fontFamily: FONT.body,
					fontSize: "22px",
					color: hex(0x1c150c),
					wordWrap: { width: cardW - 44 },
					lineSpacing: 3,
				},
			);

			const cardH = (isCollapse ? 160 : 130) + commentTxt.height + 44;

			const cardContainer = this.add.container(0, 0);

			// Wax Seal Node parameters
			const sealY = y + 42;
			let sealBase = 0x9c2424;
			let sealRim = 0xd44a4a;
			let sealShadow = 0x5e1010;
			let sealRibbon = 0x7a181c;
			let sealSigil = "✦";

			if (isCollapse) {
				sealBase = 0x4e0f12;
				sealRim = 0x8c2528;
				sealShadow = 0x240608;
				sealRibbon = 0x5c1014;
				sealSigil = r.collapse === "revolt" ? "⚔" : "⚡";
			} else if (isTriumph) {
				sealBase = 0xb88924;
				sealRim = 0xf0c85c;
				sealShadow = 0x705210;
				sealRibbon = 0x8f6516;
				sealSigil = "★";
			}

			// Render Wax Seal Node along timeline spine
			const sealG = this.add.graphics();
			drawTimelineWaxSeal(sealG, spineX, sealY, 21, cardX, {
				baseColor: sealBase,
				rimColor: sealRim,
				shadowColor: sealShadow,
				ribbonColor: sealRibbon,
			});

			const sigilTxt = this.add
				.text(
					spineX,
					sealY,
					sealSigil,
					ui(15, hex(isTriumph ? 0xfff2b8 : 0xffe2dc)),
				)
				.setOrigin(0.5);

			// Archival Reign Record Card Base
			const cg = this.add.graphics();

			// Ambient drop shadow beneath card
			cg.fillStyle(0x000000, 0.42);
			cg.fillRoundedRect(cardX, y + 4, cardW, cardH, 12);

			// Aged royal vellum body
			cg.fillStyle(0xf6eedb, 0.97);
			cg.fillRoundedRect(cardX, y, cardW, cardH, 12);

			// Aged parchment edge vignette
			cg.lineStyle(5, 0xdfceaa, 0.55);
			cg.strokeRoundedRect(cardX + 2.5, y + 2.5, cardW - 5, cardH - 5, 10);

			// Gold foil double edges
			cg.lineStyle(2, COLORS.goldDeep, 0.85);
			cg.strokeRoundedRect(cardX, y, cardW, cardH, 12);
			cg.lineStyle(1, COLORS.gold, 0.5);
			cg.strokeRoundedRect(cardX + 5, y + 5, cardW - 10, cardH - 10, 8);

			drawCornerFlourishes(cg, cardX, y, cardW, cardH, COLORS.goldDeep, 12);

			// Embossed Verdict Ribbon across top of card
			const ribbonX = cardX + 12;
			const ribbonY = y + 12;
			const ribbonW = cardW - 24;
			const ribbonH = 40;

			let ribbonTheme = {
				bodyColor: 0x9e751b,
				borderColor: COLORS.gold,
				highlightColor: 0xfff2b8,
			};
			let verdictTitleColor = hex(COLORS.night);

			if (isCollapse) {
				ribbonTheme = {
					bodyColor: 0x581014,
					borderColor: COLORS.blood,
					highlightColor: 0xffb8b8,
				};
				verdictTitleColor = hex(0xfff0ee);
			} else if (isSteady) {
				ribbonTheme = {
					bodyColor: 0x1c2b4e,
					borderColor: 0x5b7cb8,
					highlightColor: 0xd0e0ff,
				};
				verdictTitleColor = hex(0xf4f7ff);
			}

			drawVerdictRibbon(cg, ribbonX, ribbonY, ribbonW, ribbonH, ribbonTheme);

			const verdictTitle = this.add
				.text(
					ribbonX + ribbonW / 2,
					ribbonY + ribbonH / 2,
					isCollapse
						? `⚡ ${r.verdict.title.toUpperCase()} ⚡`
						: `✦ ${r.verdict.title.toUpperCase()} ✦`,
					{
						fontFamily: FONT.title,
						fontSize: "19px",
						color: verdictTitleColor,
						fontStyle: "700",
					},
				)
				.setOrigin(0.5);
			verdictTitle.setLetterSpacing(2.5);

			// Leader Epithet & Civilization Line
			const epithetTxt = this.add.text(cardX + 22, y + 60, r.verdict.epithet, {
				fontFamily: FONT.body,
				fontSize: "21px",
				color: hex(0x1a1208),
				fontStyle: "italic",
			});

			const civTxt = this.add.text(
				cardX + 22 + epithetTxt.width + 10,
				y + 63,
				`·  ${r.civ.toUpperCase()}`,
				{
					fontFamily: FONT.title,
					fontSize: "14px",
					color: hex(COLORS.goldDeep),
					fontStyle: "700",
				},
			);
			civTxt.setLetterSpacing(1.5);

			const docketTxt = this.add
				.text(cardX + cardW - 22, y + 63, `ROLL № ${reigns.length - idx}`, {
					fontFamily: FONT.ui,
					fontSize: "11px",
					color: hex(0x7a6a58),
					fontStyle: "700",
				})
				.setOrigin(1, 0)
				.setLetterSpacing(1);

			// Imperial Registry Stat Badges (Triumvirate + Historical Alignment)
			const badgeY = y + 92;
			const badges = this.createStatPills(cg, cardX + 22, badgeY, r);

			// Collapse Warning Banner (if collapse occurred)
			let collapseBanner: Phaser.GameObjects.Text | null = null;
			if (isCollapse) {
				const colY = y + 124;
				const colW = cardW - 44;
				cg.fillStyle(0x380c10, 0.9);
				cg.fillRoundedRect(cardX + 22, colY, colW, 24, 12);
				cg.lineStyle(1, COLORS.blood, 0.85);
				cg.strokeRoundedRect(cardX + 22, colY, colW, 24, 12);

				collapseBanner = this.add
					.text(
						cardX + 22 + colW / 2,
						colY + 12,
						r.collapse === "bankruptcy"
							? "⚠️ COLLAPSED IN BANKRUPTCY — ROYAL VAULTS EMPTIED"
							: "⚠️ OVERTHROWN IN REVOLT — PALACE SHATTERED BY POPULACE",
						{
							fontFamily: FONT.ui,
							fontSize: "10px",
							color: hex(0xf5c2be),
							fontStyle: "700",
						},
					)
					.setOrigin(0.5);
				collapseBanner.setLetterSpacing(1);
			}

			// Archival Calligraphic Footer
			const footerY = y + cardH - 24;
			cg.lineStyle(1, 0x9e7e2c, 0.45);
			cg.lineBetween(cardX + 22, footerY - 8, cardX + cardW - 22, footerY - 8);

			cg.fillStyle(0x9e7e2c, 0.7);
			cg.fillCircle(cardX + cardW / 2, footerY - 8, 2);

			const footerInfo = this.add.text(
				cardX + 22,
				footerY,
				`Seasons in Power: ${r.seasons ?? 1}  ·  Inscribed in the Roll of Reigns`,
				{
					fontFamily: FONT.ui,
					fontSize: "10px",
					color: hex(0x785c22),
					fontStyle: "700",
				},
			);
			footerInfo.setLetterSpacing(0.8);

			const dateTxt = this.add
				.text(
					cardX + cardW - 22,
					footerY,
					new Date(r.at).toLocaleDateString(undefined, {
						year: "numeric",
						month: "short",
						day: "numeric",
					}),
					{
						fontFamily: FONT.ui,
						fontSize: "10px",
						color: hex(0x766654),
					},
				)
				.setOrigin(1, 0);

			const cardElements: Phaser.GameObjects.GameObject[] = [
				cg,
				sealG,
				sigilTxt,
				verdictTitle,
				epithetTxt,
				civTxt,
				docketTxt,
				...badges,
				commentTxt,
				footerInfo,
				dateTxt,
			];
			if (collapseBanner) cardElements.push(collapseBanner);

			cardContainer.add(cardElements);
			cardContainer.setAlpha(0).setX(35);

			this.tweens.add({
				targets: cardContainer,
				alpha: 1,
				x: 0,
				duration: 420,
				delay: Math.min(500, y / 4),
				ease: "Cubic.out",
			});

			list.add(cardContainer);
			y += cardH + 24;
		}

		// Draw continuous genealogical timeline spine rod
		const spineTotalH = y;
		spineG.clear();

		// Outer ambient shadow
		spineG.lineStyle(10, 0x000000, 0.35);
		spineG.lineBetween(spineX, 10, spineX, spineTotalH);

		// Dual antique bronze rails
		spineG.lineStyle(1.5, COLORS.goldDeep, 0.8);
		spineG.lineBetween(spineX - 4, 12, spineX - 4, spineTotalH);
		spineG.lineBetween(spineX + 4, 12, spineX + 4, spineTotalH);

		// Central gold lineage thread
		spineG.lineStyle(2, COLORS.gold, 0.9);
		spineG.lineBetween(spineX, 12, spineX, spineTotalH);

		// Periodic genealogical filigree cross-ties
		for (let py = 20; py < spineTotalH; py += 42) {
			spineG.lineStyle(1.2, COLORS.goldDeep, 0.85);
			spineG.lineBetween(spineX - 6, py, spineX + 6, py);
			spineG.fillStyle(COLORS.gold, 0.9);
			spineG.fillCircle(spineX, py, 1.8);
		}

		// Top Crown Finial
		spineG.fillStyle(COLORS.gold, 1);
		spineG.lineStyle(1.5, COLORS.goldDeep, 1);
		spineG.fillTriangle(spineX - 8, 14, spineX + 8, 14, spineX, 6);
		spineG.strokeTriangle(spineX - 8, 14, spineX + 8, 14, spineX, 6);

		// Bottom Spearhead Finial
		spineG.fillTriangle(
			spineX - 6,
			spineTotalH - 8,
			spineX + 6,
			spineTotalH - 8,
			spineX,
			spineTotalH,
		);
		spineG.strokeTriangle(
			spineX - 6,
			spineTotalH - 8,
			spineX + 6,
			spineTotalH - 8,
			spineX,
			spineTotalH,
		);

		list.setContentHeight(y);
	}

	/**
	 * Creates the 4 archival pill badges for historical alignment and stat triumvirate.
	 */
	private createStatPills(
		g: Phaser.GameObjects.Graphics,
		startX: number,
		y: number,
		r: ReignRecord,
	) {
		const badges: Phaser.GameObjects.Text[] = [];
		let cx = startX;

		// 1. Historical Alignment Pill
		const histText = `✦ ${r.matched}/${r.total} HISTORICAL`;
		const histW = 124;
		const h = 24;

		g.fillStyle(0xede3cc, 0.95);
		g.fillRoundedRect(cx, y, histW, h, 12);
		g.lineStyle(1, 0x9e761c, 0.8);
		g.strokeRoundedRect(cx, y, histW, h, 12);

		const t1 = this.add
			.text(cx + histW / 2, y + h / 2, histText, {
				fontFamily: FONT.ui,
				fontSize: "11px",
				color: hex(0x765410),
				fontStyle: "700",
			})
			.setOrigin(0.5);
		badges.push(t1);
		cx += histW + 8;

		// 2. Gold Pill
		const goldText = `◆ ${r.stats.gold} GOLD`;
		const goldW = 90;
		g.fillStyle(0xf2e8cf, 0.95);
		g.fillRoundedRect(cx, y, goldW, h, 12);
		g.lineStyle(1, COLORS.goldDeep, 0.75);
		g.strokeRoundedRect(cx, y, goldW, h, 12);

		const t2 = this.add
			.text(cx + goldW / 2, y + h / 2, goldText, {
				fontFamily: FONT.ui,
				fontSize: "11px",
				color: hex(0x825c10),
				fontStyle: "700",
			})
			.setOrigin(0.5);
		badges.push(t2);
		cx += goldW + 8;

		// 3. Stability Pill
		const stabText = `⚖ ${r.stats.stability} STAB`;
		const stabW = 90;
		g.fillStyle(0xe0ecdf, 0.95);
		g.fillRoundedRect(cx, y, stabW, h, 12);
		g.lineStyle(1, 0x4e7b57, 0.75);
		g.strokeRoundedRect(cx, y, stabW, h, 12);

		const t3 = this.add
			.text(cx + stabW / 2, y + h / 2, stabText, {
				fontFamily: FONT.ui,
				fontSize: "11px",
				color: hex(0x285431),
				fontStyle: "700",
			})
			.setOrigin(0.5);
		badges.push(t3);
		cx += stabW + 8;

		// 4. Legacy Pill
		const legText = `✦ ${r.stats.legacy} LEGACY`;
		const legW = 96;
		g.fillStyle(0xdfebf4, 0.95);
		g.fillRoundedRect(cx, y, legW, h, 12);
		g.lineStyle(1, 0x48799e, 0.75);
		g.strokeRoundedRect(cx, y, legW, h, 12);

		const t4 = this.add
			.text(cx + legW / 2, y + h / 2, legText, {
				fontFamily: FONT.ui,
				fontSize: "11px",
				color: hex(0x244c6e),
				fontStyle: "700",
			})
			.setOrigin(0.5);
		badges.push(t4);

		return badges;
	}
}
