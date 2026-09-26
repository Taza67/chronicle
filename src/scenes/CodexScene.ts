import Phaser from "phaser";
import { LEADERS } from "../content/leaders.ts";
import { RELICS } from "../content/relics.ts";
import { audio } from "../core/audio.ts";
import {
	type CodexEntry,
	codex,
	customLeaders,
	unlockedRelics,
} from "../core/state.ts";
import { ScrollList } from "../ui/ScrollList.ts";
import { COLORS, FONT, H, hex, ui, W } from "../ui/theme.ts";
import { fadeIn, go, heading, iconButton } from "../ui/widgets.ts";

type Tab = "fact" | "whatif" | "relic";

/**
 * Draws an authentic multi-lobed 3D wax seal with ribbon tails and debossed core.
 */
function drawWaxSeal(
	g: Phaser.GameObjects.Graphics,
	cx: number,
	cy: number,
	radius: number,
	opts: {
		baseColor: number;
		rimColor: number;
		shadowColor: number;
		ribbonColor?: number;
	},
) {
	// Ambient drop shadow beneath seal
	g.fillStyle(0x000000, 0.45);
	g.fillCircle(cx + 1.5, cy + 2.5, radius + 1);

	// Silk ribbon tails hanging beneath seal
	if (opts.ribbonColor) {
		g.fillStyle(opts.ribbonColor, 0.95);
		// Left swallowtail ribbon
		g.beginPath();
		g.moveTo(cx - 5, cy + radius - 4);
		g.lineTo(cx - 9, cy + radius + 22);
		g.lineTo(cx - 3, cy + radius + 17);
		g.lineTo(cx + 1, cy + radius + 22);
		g.lineTo(cx + 1, cy + radius - 4);
		g.closePath();
		g.fillPath();
		g.lineStyle(1, 0x221105, 0.4);
		g.strokePath();

		// Right swallowtail ribbon
		g.beginPath();
		g.moveTo(cx, cy + radius - 4);
		g.lineTo(cx + 2, cy + radius + 24);
		g.lineTo(cx + 7, cy + radius + 18);
		g.lineTo(cx + 12, cy + radius + 24);
		g.lineTo(cx + 8, cy + radius - 4);
		g.closePath();
		g.fillPath();
		g.strokePath();
	}

	// Scalloped melted wax puddle (12 lobes)
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
	g.lineStyle(1.5, 0x1a0a05, 0.5);
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
 * Grand Imperial Archives: Archival bookmark tabs, gold filigree progress gauges,
 * and illuminated manuscript cards with archival seals.
 */
export class CodexScene extends Phaser.Scene {
	private list: ScrollList | null = null;
	private currentTab: Tab = "fact";
	private tabRibbons: Record<Tab, Phaser.GameObjects.Container> | null = null;

	constructor() {
		super("Codex");
	}

	create() {
		fadeIn(this);

		// Deep imperial night backdrop
		this.add.rectangle(W / 2, H / 2, W, H, COLORS.night);
		const bg = this.add.image(W / 2, H / 2, "title_bg");
		bg.setScale(Math.max(W / bg.width, H / bg.height) * 1.1)
			.setAlpha(0.18)
			.setTint(0x3a2818);

		// Vignette shadow overlay
		const vignette = this.add.image(W / 2, H / 2, "vignette");
		vignette.setDisplaySize(W, H).setAlpha(0.75);

		// Grand Imperial Archives Header
		heading(this, 68, "Imperial Codex", 36);
		this.add
			.text(W / 2, 98, "GRAND IMPERIAL ARCHIVES", {
				fontFamily: FONT.title,
				fontSize: "12px",
				color: hex(COLORS.goldDeep),
				fontStyle: "700",
			})
			.setOrigin(0.5)
			.setLetterSpacing(4);

		iconButton(this, 56, 70, "‹", () => go(this, "Title"));

		// Archival summary ribbon pill
		const total = codex.length;
		const factsCount = codex.filter((c) => c.kind === "fact").length;
		const whatifsCount = codex.filter((c) => c.kind === "whatif").length;

		const summaryBg = this.add.graphics();
		summaryBg.fillStyle(0x130f1d, 0.85);
		summaryBg.fillRoundedRect(W / 2 - 250, 114, 500, 26, 13);
		summaryBg.lineStyle(1, COLORS.goldDeep, 0.65);
		summaryBg.strokeRoundedRect(W / 2 - 250, 114, 500, 26, 13);

		this.add
			.text(
				W / 2,
				127,
				`✦  ${total} ${total === 1 ? "RECORD" : "RECORDS"}  ·  ${factsCount} HISTORICAL  ·  ${whatifsCount} COUNTERFACTUAL  ✦`,
				{
					fontFamily: FONT.ui,
					fontSize: "11px",
					color: hex(COLORS.gold),
					fontStyle: "700",
				},
			)
			.setOrigin(0.5)
			.setLetterSpacing(1.5);

		// Archival bookmark ribbon tabs: 'WHAT HAPPENED' vs 'WHAT IF'
		this.createBookmarkTabs();

		// Initial render of default tab
		this.renderTab("fact");
	}

	/**
	 * Creates two hanging vellum & gold leaf ribbon bookmark tabs.
	 */
	private createBookmarkTabs() {
		const tabW = 206;
		const tabH = 50;
		const tabY = 152;
		const tab1X = 41;
		const tab2X = 257;
		const tab3X = 473;

		const makeRibbonContainer = (x: number, kind: Tab) => {
			const c = this.add.container(x, tabY);
			c.setSize(tabW, tabH);
			c.setInteractive({ useHandCursor: true });
			c.on("pointerup", () => {
				if (this.currentTab !== kind) {
					audio.sfx("card");
					this.setTab(kind);
				}
			});
			return c;
		};

		const factRibbon = makeRibbonContainer(tab1X, "fact");
		const whatifRibbon = makeRibbonContainer(tab2X, "whatif");
		const relicRibbon = makeRibbonContainer(tab3X, "relic");
		this.tabRibbons = {
			fact: factRibbon,
			whatif: whatifRibbon,
			relic: relicRibbon,
		};

		this.updateRibbonVisuals();
	}

	/**
	 * Renders the ribbon bookmarks according to active/inactive selection.
	 */
	private updateRibbonVisuals() {
		if (!this.tabRibbons) return;
		const tabW = 206;
		const tabH = 50;

		(["fact", "whatif", "relic"] as Tab[]).forEach((kind) => {
			const container = this.tabRibbons![kind];
			container.removeAll(true);
			const active = this.currentTab === kind;

			const g = this.add.graphics();

			// Ribbon bookmark geometry: chevron swallowtail notch at the bottom edge
			const drawRibbonPath = (graphics: Phaser.GameObjects.Graphics) => {
				graphics.beginPath();
				graphics.moveTo(0, 0);
				graphics.lineTo(tabW, 0);
				graphics.lineTo(tabW, tabH - 7);
				graphics.lineTo(tabW / 2, tabH);
				graphics.lineTo(0, tabH - 7);
				graphics.closePath();
			};

			if (active) {
				// Ambient drop shadow beneath ribbon
				g.fillStyle(0x000000, 0.45);
				g.beginPath();
				g.moveTo(0, 3);
				g.lineTo(tabW, 3);
				g.lineTo(tabW, tabH - 4);
				g.lineTo(tabW / 2, tabH + 3);
				g.lineTo(0, tabH - 4);
				g.closePath();
				g.fillPath();

				// Vellum body: warm illuminated parchment
				g.fillStyle(COLORS.parchment, 1);
				drawRibbonPath(g);
				g.fillPath();

				// Gold leaf trim
				g.lineStyle(2.5, COLORS.gold, 0.95);
				drawRibbonPath(g);
				g.strokePath();

				// Specular inner hairline
				g.lineStyle(1, 0xfff2b8, 0.55);
				g.beginPath();
				g.moveTo(4, 2);
				g.lineTo(tabW - 4, 2);
				g.lineTo(tabW - 4, tabH - 9);
				g.lineTo(tabW / 2, tabH - 3);
				g.lineTo(4, tabH - 9);
				g.closePath();
				g.strokePath();

				// Central golden diamond pip at chevron point
				g.fillStyle(COLORS.gold, 1);
				g.fillCircle(tabW / 2, tabH - 3, 2.5);
			} else {
				// Inactive: archival dark velvet cloth
				g.fillStyle(0x130f1e, 0.85);
				drawRibbonPath(g);
				g.fillPath();

				// Subtle antique bronze edge
				g.lineStyle(1.5, COLORS.goldDeep, 0.45);
				drawRibbonPath(g);
				g.strokePath();

				// Muted pip
				g.fillStyle(COLORS.goldDeep, 0.6);
				g.fillCircle(tabW / 2, tabH - 4, 2);
			}

			// Emblem & Typography
			const icon = this.add
				.text(
					18,
					tabH / 2 - 2,
					active ? "✦" : "✧",
					ui(16, hex(active ? COLORS.goldDeep : COLORS.muted)),
				)
				.setOrigin(0.5);

			const titles: Record<Tab, { title: string; sub: string }> = {
				fact: {
					title: "HISTOIRE",
					sub: active ? "ANNALES VRAIES" : "FAITS RÉELS",
				},
				whatif: {
					title: "ET SI ?",
					sub: active ? "DESTINS SECRETS" : "ALTERNATIVES",
				},
				relic: {
					title: "RELIQUES",
					sub: active ? "TRÉSORS D'ÉTAT" : "MERVEILLES",
				},
			};

			const meta = titles[kind];

			const mainTitle = this.add
				.text(tabW / 2 + 6, 15, meta.title, {
					fontFamily: FONT.title,
					fontSize: "15px",
					color: hex(active ? COLORS.night : COLORS.muted),
					fontStyle: "700",
				})
				.setOrigin(0.5);
			mainTitle.setLetterSpacing(2);

			const subCaption = this.add
				.text(tabW / 2 + 6, 32, meta.sub, {
					fontFamily: FONT.ui,
					fontSize: "8.5px",
					color: hex(active ? 0x785612 : 0x72695c),
					fontStyle: "700",
				})
				.setOrigin(0.5);
			subCaption.setLetterSpacing(1.2);

			container.add([g, icon, mainTitle, subCaption]);
		});
	}

	private setTab(t: Tab) {
		this.currentTab = t;
		this.updateRibbonVisuals();
		this.renderTab(t);
	}

	private renderTab(t: Tab) {
		if (t === "relic") {
			this.renderRelicsTab();
			return;
		}
		if (!this.list) {
			this.list = new ScrollList(this, 222, H - 24);
		} else {
			this.list.removeAll(true);
			this.list.y = 222;
			this.list.setContentHeight(0);
		}

		const entries = codex
			.filter((c) => c.kind === t)
			.sort((a, b) => b.at - a.at);

		let y = 14;

		if (!entries.length) {
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
				.text(
					W / 2,
					76,
					t === "fact" ? "THE ANNALS LIE DORMANT" : "NO APOCRYPHA UNVEILED",
					{
						fontFamily: FONT.title,
						fontSize: "20px",
						color: hex(COLORS.gold),
						fontStyle: "700",
					},
				)
				.setOrigin(0.5);
			emptyTitle.setLetterSpacing(3);

			const emptyBody = this.add
				.text(
					W / 2,
					124,
					t === "fact"
						? "Ascend the imperial throne and decree your will.\nThe royal chroniclers will inscribe these pages with the truth of history."
						: "Defy the recorded annals of antiquity and venture down untrodden paths\nto discover what might have been.",
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

			this.list.add([eg, emptyTitle, emptyBody]);
			this.list.setContentHeight(240);
			return;
		}

		// Group entries by leader with civilization completion progress
		const leaders = [...LEADERS, ...customLeaders];
		const byLeader = new Map<string, CodexEntry[]>();
		for (const e of entries) {
			byLeader.set(e.leaderId, [...(byLeader.get(e.leaderId) ?? []), e]);
		}

		for (const [lid, list] of byLeader) {
			const l = leaders.find((x) => x.id === lid);
			const civName = l?.civ ?? list[0].leaderName;
			const leaderName = l?.name ?? list[0].leaderName;
			const pct = Math.min(100, Math.round((list.length / 10) * 100));

			// Civilization Completion Header Plaque
			const headerContainer = this.add.container(0, 0);
			const plaqueW = W - 64;
			const plaqueH = 76;
			const plaqueX = 32;

			const hg = this.add.graphics();
			// Dark velvet plaque
			hg.fillStyle(0x110d1a, 0.88);
			hg.fillRoundedRect(plaqueX, y, plaqueW, plaqueH, 10);
			hg.lineStyle(1.5, COLORS.goldDeep, 0.85);
			hg.strokeRoundedRect(plaqueX, y, plaqueW, plaqueH, 10);
			hg.lineStyle(1, 0xd4af37, 0.25);
			hg.strokeRoundedRect(plaqueX + 3, y + 3, plaqueW - 6, plaqueH - 6, 8);
			drawCornerFlourishes(
				hg,
				plaqueX,
				y,
				plaqueW,
				plaqueH,
				COLORS.goldDeep,
				8,
			);

			// Miniature civilization crest medallion
			hg.fillStyle(0x1a1426, 0.95);
			hg.fillCircle(plaqueX + 26, y + 24, 13);
			hg.lineStyle(1.5, COLORS.gold, 0.9);
			hg.strokeCircle(plaqueX + 26, y + 24, 13);

			const crestIcon = this.add
				.text(plaqueX + 26, y + 24, "✦", ui(13, hex(COLORS.gold)))
				.setOrigin(0.5);

			// Civ Name & Leader Subtitle
			const civTitle = this.add.text(
				plaqueX + 48,
				y + 13,
				`✦ ${civName.toUpperCase()} ✦`,
				{
					fontFamily: FONT.title,
					fontSize: "18px",
					color: hex(COLORS.gold),
					fontStyle: "700",
				},
			);
			civTitle.setLetterSpacing(2.5);

			const leaderSub = this.add.text(
				plaqueX + 48,
				y + 35,
				`${leaderName} · Imperial Archive Record`,
				{
					fontFamily: FONT.body,
					fontSize: "16px",
					color: hex(COLORS.muted),
					fontStyle: "italic",
				},
			);

			// Completion Badge Pill
			const badgeW = 126;
			const badgeH = 26;
			const badgeX = plaqueX + plaqueW - badgeW - 14;
			const badgeY = y + 13;

			hg.fillStyle(0x181324, 0.95);
			hg.fillRoundedRect(badgeX, badgeY, badgeW, badgeH, 13);
			hg.lineStyle(1, COLORS.gold, 0.8);
			hg.strokeRoundedRect(badgeX, badgeY, badgeW, badgeH, 13);

			const badgeTxt = this.add
				.text(
					badgeX + badgeW / 2,
					badgeY + badgeH / 2,
					pct === 100 ? "✦ MASTERED ✦" : `${pct}% ARCHIVED`,
					{
						fontFamily: FONT.ui,
						fontSize: "11px",
						color: hex(COLORS.gold),
						fontStyle: "700",
					},
				)
				.setOrigin(0.5)
				.setLetterSpacing(1);

			// Gold Filigree Progress Gauge
			const gaugeX = 48;
			const gaugeY = y + 57;
			const gaugeW = W - 96;
			const gaugeH = 8;

			// Gauge track groove
			hg.fillStyle(0x08060c, 0.95);
			hg.fillRoundedRect(gaugeX, gaugeY, gaugeW, gaugeH, 4);
			hg.lineStyle(1, 0x6e5218, 0.75);
			hg.strokeRoundedRect(gaugeX, gaugeY, gaugeW, gaugeH, 4);

			// Filigree end-cap diamond finials
			hg.fillStyle(COLORS.gold, 0.9);
			for (const fx of [gaugeX - 3, gaugeX + gaugeW + 3]) {
				hg.fillCircle(fx, gaugeY + gaugeH / 2, 2.5);
			}

			// Segmented filigree tick marks
			for (let i = 1; i <= 9; i++) {
				const tx = gaugeX + (gaugeW / 10) * i;
				const unlocked = i <= Math.floor(pct / 10);
				hg.lineStyle(1, unlocked ? COLORS.gold : 0x543f14, 0.6);
				hg.lineBetween(tx, gaugeY + 1, tx, gaugeY + gaugeH - 1);
			}

			// Gauge fill bar
			const bar = this.add
				.rectangle(gaugeX, gaugeY + gaugeH / 2, 0, gaugeH - 2, COLORS.gold)
				.setOrigin(0, 0.5);

			this.tweens.add({
				targets: bar,
				width: gaugeW * (pct / 100),
				duration: 750,
				ease: "Cubic.out",
			});

			headerContainer.add([hg, crestIcon, civTitle, leaderSub, badgeTxt, bar]);
			this.list.add(headerContainer);
			y += 90;

			// Codex Entry Cards for this civilization
			for (let i = 0; i < list.length; i++) {
				const e = list[i];
				const cardResult = this.createEntryCard(e, y, i + 1);
				this.list.add(cardResult.obj);
				y += cardResult.h + 16;
			}
			y += 18;
		}

		this.list.setContentHeight(y);
	}

	/**
	 * Creates an illuminated manuscript entry card with gold foil edges and archival seal.
	 */
	private createEntryCard(e: CodexEntry, y: number, indexNum: number) {
		const cardW = W - 64;
		const cardX = 32;
		const isFact = e.kind === "fact";

		// Measure typography heights
		const titleTxt = this.add.text(cardX + 78, y + 36, e.title, {
			fontFamily: FONT.title,
			fontSize: "19px",
			color: hex(isFact ? COLORS.night : COLORS.gold),
			fontStyle: "700",
			wordWrap: { width: cardW - 100 },
		});
		titleTxt.setLetterSpacing(1.5);

		const bodyTxt = this.add.text(
			cardX + 28,
			y + 70 + titleTxt.height + 8,
			e.text,
			{
				fontFamily: FONT.body,
				fontSize: "23px",
				color: hex(isFact ? 0x1a140d : 0xf2ebd9),
				wordWrap: { width: cardW - 56 },
				lineSpacing: 4,
			},
		);

		const cardH = 70 + titleTxt.height + 8 + bodyTxt.height + 42;

		const g = this.add.graphics();

		// Ambient drop shadow beneath card
		g.fillStyle(0x000000, 0.4);
		g.fillRoundedRect(cardX, y + 4, cardW, cardH, 12);

		if (isFact) {
			// Illuminated warm vellum
			g.fillStyle(0xf5eedc, 0.97);
			g.fillRoundedRect(cardX, y, cardW, cardH, 12);

			// Aged parchment edge vignette
			g.lineStyle(5, 0xdecda6, 0.5);
			g.strokeRoundedRect(cardX + 2.5, y + 2.5, cardW - 5, cardH - 5, 10);

			// Gold foil edges
			g.lineStyle(2, COLORS.goldDeep, 0.85);
			g.strokeRoundedRect(cardX, y, cardW, cardH, 12);
			g.lineStyle(1, COLORS.gold, 0.5);
			g.strokeRoundedRect(cardX + 5, y + 5, cardW - 10, cardH - 10, 8);

			drawCornerFlourishes(g, cardX, y, cardW, cardH, COLORS.goldDeep, 12);
		} else {
			// Arcane midnight vellum for counterfactual entries
			g.fillStyle(0x151222, 0.95);
			g.fillRoundedRect(cardX, y, cardW, cardH, 12);

			// Crimson wash edge
			g.lineStyle(5, 0x2e1520, 0.55);
			g.strokeRoundedRect(cardX + 2.5, y + 2.5, cardW - 5, cardH - 5, 10);

			// Blood & gold foil edges
			g.lineStyle(2, COLORS.blood, 0.85);
			g.strokeRoundedRect(cardX, y, cardW, cardH, 12);
			g.lineStyle(1, COLORS.gold, 0.45);
			g.strokeRoundedRect(cardX + 5, y + 5, cardW - 10, cardH - 10, 8);

			drawCornerFlourishes(g, cardX, y, cardW, cardH, COLORS.blood, 12);
		}

		// Archival Wax Seal at top-left of card
		const sealX = cardX + 42;
		const sealY = y + 40;
		drawWaxSeal(g, sealX, sealY, 20, {
			baseColor: isFact ? 0xb88828 : 0x9c2424,
			rimColor: isFact ? 0xdfb752 : 0xc84242,
			shadowColor: isFact ? 0x7a5612 : 0x5c1010,
			ribbonColor: isFact ? 0x8f6516 : 0x7a181c,
		});

		// Seal sigil text
		const sigil = this.add
			.text(
				sealX,
				sealY,
				isFact ? "✦" : "✧",
				ui(14, hex(isFact ? 0xfff2b8 : 0xffdcd6)),
			)
			.setOrigin(0.5);

		// Year Cartouche Pill
		const yearPillX = cardX + 78;
		const yearPillY = y + 15;
		const yearPillW = 110;
		const yearPillH = 19;

		g.fillStyle(0x130f1d, 0.9);
		g.fillRoundedRect(yearPillX, yearPillY, yearPillW, yearPillH, 9);
		g.lineStyle(1, isFact ? COLORS.goldDeep : COLORS.gold, 0.7);
		g.strokeRoundedRect(yearPillX, yearPillY, yearPillW, yearPillH, 9);

		const yearTxt = this.add
			.text(
				yearPillX + yearPillW / 2,
				yearPillY + yearPillH / 2,
				`ANNO ${e.year.toUpperCase()}`,
				{
					fontFamily: FONT.title,
					fontSize: "10px",
					color: hex(COLORS.gold),
					fontStyle: "700",
				},
			)
			.setOrigin(0.5)
			.setLetterSpacing(1);

		// Archival Docket Footer
		const footerY = y + cardH - 24;
		g.lineStyle(1, isFact ? COLORS.goldDeep : COLORS.gold, 0.45);
		g.lineBetween(cardX + 24, footerY - 8, cardX + cardW - 24, footerY - 8);

		g.fillStyle(isFact ? COLORS.goldDeep : COLORS.gold, 0.7);
		g.fillCircle(cardX + cardW / 2, footerY - 8, 2);

		const tagTxt = this.add.text(
			cardX + 24,
			footerY,
			isFact
				? `✦ CHRONICLED IN THE IMPERIAL REGISTER · RECORD № ${indexNum}`
				: `✧ DIVERGENT DESTINY · BRANCH № ${indexNum}`,
			{
				fontFamily: FONT.ui,
				fontSize: "10px",
				color: hex(isFact ? 0x7a5a1e : 0xb88628),
				fontStyle: "700",
			},
		);
		tagTxt.setLetterSpacing(1);

		const dateTxt = this.add
			.text(cardX + cardW - 24, footerY, new Date(e.at).toLocaleDateString(), {
				fontFamily: FONT.ui,
				fontSize: "10px",
				color: hex(isFact ? 0x8a7a66 : 0x8a7a92),
			})
			.setOrigin(1, 0);

		const container = this.add
			.container(0, 0, [g, titleTxt, bodyTxt, sigil, yearTxt, tagTxt, dateTxt])
			.setAlpha(0);

		this.tweens.add({
			targets: container,
			alpha: 1,
			duration: 350,
			delay: Math.min(400, y / 5),
			ease: "Cubic.out",
		});

		return { obj: container, h: cardH };
	}

	private renderRelicsTab() {
		if (!this.list) {
			this.list = new ScrollList(this, 222, H - 24);
		} else {
			this.list.removeAll(true);
			this.list.y = 222;
			this.list.setContentHeight(0);
		}
		const list = this.list;

		let y = 14;
		const cardW = W - 72;
		const cardH = 138;
		const cardX = 36;

		// Summary Banner
		const unlockedCount = RELICS.filter((r) =>
			unlockedRelics.includes(r.id),
		).length;
		const banner = this.add.container(W / 2, y + 20);
		const bg = this.add.graphics();
		bg.fillStyle(0x130f1d, 0.88);
		bg.fillRoundedRect(-240, -18, 480, 36, 18);
		bg.lineStyle(1.5, COLORS.gold, 0.6);
		bg.strokeRoundedRect(-240, -18, 480, 36, 18);

		const bannerText = this.add
			.text(
				0,
				0,
				`✦  ${unlockedCount} / ${RELICS.length} RELIQUES SACRÉES FORGÉES  ✦`,
				{
					fontFamily: FONT.title,
					fontSize: "14px",
					color: hex(COLORS.gold),
					fontStyle: "700",
				},
			)
			.setOrigin(0.5);
		bannerText.setLetterSpacing(2);
		banner.add([bg, bannerText]);
		list.add(banner);

		y += 60;

		RELICS.forEach((relic) => {
			const isUnlocked = unlockedRelics.includes(relic.id);
			const card = this.add.container(cardX, y);
			const g = this.add.graphics();

			// Card base & border
			g.fillStyle(isUnlocked ? 0x14101e : 0x0c0a12, 0.94);
			g.fillRoundedRect(0, 0, cardW, cardH, 16);
			g.lineStyle(
				isUnlocked ? 2 : 1,
				isUnlocked ? COLORS.gold : 0x362c40,
				isUnlocked ? 0.9 : 0.5,
			);
			g.strokeRoundedRect(0, 0, cardW, cardH, 16);

			if (isUnlocked) {
				// Inner gold guideline
				g.lineStyle(1, 0xfff0b8, 0.35);
				g.strokeRoundedRect(4, 4, cardW - 8, cardH - 8, 12);
				drawCornerFlourishes(g, 0, 0, cardW, cardH, COLORS.goldDeep);

				// Circular relic pedestal
				g.fillStyle(0x241a33, 0.9);
				g.fillCircle(54, cardH / 2, 34);
				g.lineStyle(2, COLORS.gold, 0.85);
				g.strokeCircle(54, cardH / 2, 34);
			} else {
				// Locked circular pedestal
				g.fillStyle(0x181420, 0.7);
				g.fillCircle(54, cardH / 2, 32);
				g.lineStyle(1, 0x483a54, 0.5);
				g.strokeCircle(54, cardH / 2, 32);
			}

			// Relic Icon
			const icon = this.add
				.text(54, cardH / 2, isUnlocked ? relic.icon : "🔒", {
					fontSize: isUnlocked ? "34px" : "24px",
				})
				.setOrigin(0.5);

			// Title
			const title = this.add.text(
				104,
				16,
				isUnlocked ? relic.name.toUpperCase() : "RELIQUE SCELLÉE",
				{
					fontFamily: FONT.title,
					fontSize: "17px",
					color: hex(isUnlocked ? COLORS.gold : COLORS.muted),
					fontStyle: "700",
				},
			);
			title.setLetterSpacing(1.5);

			// Status Chip at top-right
			const chip = this.add
				.text(cardW - 20, 22, isUnlocked ? "✦ DÉBLOQUÉE" : "🔒 INCONNUE", {
					fontFamily: FONT.ui,
					fontSize: "11px",
					color: hex(isUnlocked ? COLORS.gold : COLORS.blood),
					fontStyle: "800",
				})
				.setOrigin(1, 0.5);

			// Effect description
			const desc = this.add.text(
				104,
				44,
				isUnlocked
					? relic.desc
					: "Accomplissez des hauts faits d'armes ou de règne pour révéler ce trésor.",
				{
					fontFamily: FONT.ui,
					fontSize: "13px",
					color: hex(isUnlocked ? COLORS.text : COLORS.muted),
					fontStyle: "600",
					wordWrap: { width: cardW - 130 },
				},
			);

			// Lore or clue
			const clue = this.add.text(
				104,
				82,
				isUnlocked
					? `« ${relic.lore} »`
					: `Origine : ${relic.leaderId ? relic.leaderId.toUpperCase() : "DYNASTIE IMPÉRIALE"}`,
				{
					fontFamily: FONT.body,
					fontSize: "15px",
					color: hex(isUnlocked ? COLORS.muted : 0x7a6c88),
					fontStyle: isUnlocked ? "italic" : "normal",
					wordWrap: { width: cardW - 130 },
				},
			);

			card.add([g, icon, title, chip, desc, clue]);
			list.add(card);
			y += cardH + 16;
		});

		list.setContentHeight(y + 30);
	}
}
