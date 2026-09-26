import Phaser from "phaser";
import { LEADERS } from "../content/leaders.ts";
import { setManifest } from "../core/art.ts";
import { hydrateCustomLeaders } from "../core/state.ts";
import type { ArtManifest } from "../types.ts";
import { COLORS, H, W } from "../ui/theme.ts";

/** Generates procedural textures (vignette, grain, spark, coin) and loads the manifest + leader thumbnails. */
export class BootScene extends Phaser.Scene {
	constructor() {
		super("Boot");
	}

	preload() {
		this.load.json("manifest", "art/manifest.json");
		for (const l of LEADERS)
			this.load.image(`${l.id}/leader`, `art/${l.id}/leader.webp`);
		this.load.image("title_bg", "art/cleopatra/scene_far.webp");
		const bar = this.add
			.rectangle(W / 2, H / 2, 0, 4, COLORS.gold)
			.setOrigin(0.5);
		this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) =>
			bar.setSize(Math.round(300 * p), 4),
		);
	}

	create() {
		setManifest(this.cache.json.get("manifest") as ArtManifest);
		this.makeVignette();
		this.makeGrain();
		this.makeSpark();
		this.makeCoin();
		void hydrateCustomLeaders().finally(() => this.scene.start("Title"));
	}

	private makeVignette() {
		const c = this.textures.createCanvas("vignette", 256, 456);
		if (!c) return;
		const ctx = c.getContext();
		const g = ctx.createRadialGradient(128, 228, 90, 128, 228, 300);
		g.addColorStop(0, "rgba(0,0,0,0)");
		g.addColorStop(0.55, "rgba(0,0,0,0.12)");
		g.addColorStop(1, "rgba(5,3,10,0.85)");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 256, 456);
		c.refresh();
	}

	private makeGrain() {
		const c = this.textures.createCanvas("grain", 256, 256);
		if (!c) return;
		const ctx = c.getContext();
		const img = ctx.createImageData(256, 256);
		for (let i = 0; i < img.data.length; i += 4) {
			const v = 110 + Math.random() * 140;
			img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
			img.data[i + 3] = 255;
		}
		ctx.putImageData(img, 0, 0);
		c.refresh();
	}

	private makeSpark() {
		const c = this.textures.createCanvas("spark", 32, 32);
		if (!c) return;
		const ctx = c.getContext();
		const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
		g.addColorStop(0, "rgba(255,255,255,1)");
		g.addColorStop(0.3, "rgba(255,240,200,0.8)");
		g.addColorStop(1, "rgba(255,200,80,0)");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 32, 32);
		c.refresh();
	}

	private makeCoin() {
		this.makeCoinObverse();
		this.makeCoinReverse();
		this.makeCoinEdge();
		this.makeCoinShine();
	}

	private makeCoinObverse() {
		const c = this.textures.createCanvas("coin", 256, 256);
		if (!c) return;
		const ctx = c.getContext();

		// 1. Ambient drop shadow behind coin
		ctx.save();
		ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
		ctx.shadowBlur = 10;
		ctx.shadowOffsetY = 4;
		ctx.fillStyle = "#1e1305";
		ctx.beginPath();
		ctx.arc(128, 128, 122, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();

		// 2. Base metallic disc with multi-stage radial gradient (illuminated from top-left at 94, 84)
		const baseGrad = ctx.createRadialGradient(94, 84, 10, 128, 128, 124);
		baseGrad.addColorStop(0.0, "#fffde8"); // specular electrum highlight
		baseGrad.addColorStop(0.18, "#fade75"); // rich glowing gold
		baseGrad.addColorStop(0.42, "#dfa632"); // antique yellow gold
		baseGrad.addColorStop(0.68, "#9e6914"); // burnished bronze-gold
		baseGrad.addColorStop(0.88, "#613d0a"); // shadowed relief patina
		baseGrad.addColorStop(1.0, "#321e03"); // rim crease shadow
		ctx.fillStyle = baseGrad;
		ctx.beginPath();
		ctx.arc(128, 128, 122, 0, Math.PI * 2);
		ctx.fill();

		// 3. Beveled 3D rim
		ctx.strokeStyle = "#3a2105";
		ctx.lineWidth = 3.5;
		ctx.beginPath();
		ctx.arc(128, 128, 121, 0, Math.PI * 2);
		ctx.stroke();

		// Bevel rim specular highlight & shadow crescent
		const rimGrad = ctx.createLinearGradient(60, 60, 200, 200);
		rimGrad.addColorStop(0.0, "rgba(255, 250, 215, 0.85)");
		rimGrad.addColorStop(0.4, "rgba(245, 195, 80, 0.2)");
		rimGrad.addColorStop(1.0, "rgba(25, 14, 3, 0.75)");
		ctx.strokeStyle = rimGrad;
		ctx.lineWidth = 2.5;
		ctx.beginPath();
		ctx.arc(128, 128, 119.5, 0, Math.PI * 2);
		ctx.stroke();

		// 4. 60 Fine milled edge notches
		for (let i = 0; i < 60; i++) {
			const a = (i * Math.PI * 2) / 60;
			const cos = Math.cos(a);
			const sin = Math.sin(a);
			const r1 = 117;
			const r2 = 122;

			// Dark milled notch groove
			ctx.strokeStyle = "rgba(42, 23, 4, 0.85)";
			ctx.lineWidth = 1.6;
			ctx.beginPath();
			ctx.moveTo(128 + cos * r1, 128 + sin * r1);
			ctx.lineTo(128 + cos * r2, 128 + sin * r2);
			ctx.stroke();

			// Specular milled crest highlight on illuminated upper-left side
			const lightDot = -Math.SQRT1_2 * cos - Math.SQRT1_2 * sin;
			if (lightDot > -0.3) {
				const aLight = a + 0.022;
				ctx.strokeStyle = `rgba(255, 246, 200, ${Math.max(0.15, (lightDot + 0.3) * 0.75)})`;
				ctx.lineWidth = 1.1;
				ctx.beginPath();
				ctx.moveTo(
					128 + Math.cos(aLight) * (r1 + 0.5),
					128 + Math.sin(aLight) * (r1 + 0.5),
				);
				ctx.lineTo(
					128 + Math.cos(aLight) * (r2 - 0.5),
					128 + Math.sin(aLight) * (r2 - 0.5),
				);
				ctx.stroke();
			}
		}

		// 5. Fine micro-inscription around the rim ("HISTORIA MAGISTRA VITAE")
		const text = "· HISTORIA MAGISTRA VITAE ·";
		const textRadius = 108.5;
		const arcSpan = 2.45; // ~140 degrees
		const startAngle = -Math.PI / 2 - arcSpan / 2;
		ctx.font = 'bold 7.5px "Cinzel", "Times New Roman", serif';
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";

		for (let i = 0; i < text.length; i++) {
			const ch = text[i];
			const a = startAngle + (i / (text.length - 1)) * arcSpan;
			ctx.save();
			ctx.translate(128, 128);
			ctx.rotate(a + Math.PI / 2);

			// Embossed relief shadow
			ctx.fillStyle = "rgba(45, 25, 4, 0.85)";
			ctx.fillText(ch, 0.6, -textRadius + 0.7);

			// Embossed gold highlight
			ctx.fillStyle = "#fff0b0";
			ctx.fillText(ch, 0, -textRadius);
			ctx.restore();
		}

		// Lower perimeter classical marks: three raised stars flanking bottom center
		const bottomStars = [-0.18, 0, 0.18];
		for (const offset of bottomStars) {
			const a = Math.PI / 2 + offset;
			const sx = 128 + Math.cos(a) * textRadius;
			const sy = 128 + Math.sin(a) * textRadius;
			ctx.fillStyle = "rgba(45, 25, 4, 0.8)";
			ctx.beginPath();
			ctx.arc(sx + 0.5, sy + 0.5, 1.8, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = "#ffe699";
			ctx.beginPath();
			ctx.arc(sx, sy, 1.4, 0, Math.PI * 2);
			ctx.fill();
		}

		// 6. Beaded pearl ring
		ctx.strokeStyle = "#5a3a0a";
		ctx.lineWidth = 1.6;
		ctx.beginPath();
		ctx.arc(128, 128, 98, 0, Math.PI * 2);
		ctx.stroke();

		for (let i = 0; i < 48; i++) {
			const a = (i * Math.PI * 2) / 48;
			const bx = 128 + Math.cos(a) * 98;
			const by = 128 + Math.sin(a) * 98;

			// Bead base shadow
			ctx.fillStyle = "#4a2e06";
			ctx.beginPath();
			ctx.arc(bx + 0.4, by + 0.5, 2.0, 0, Math.PI * 2);
			ctx.fill();

			// Bead metallic highlight
			ctx.fillStyle = "#ffe899";
			ctx.beginPath();
			ctx.arc(bx - 0.4, by - 0.4, 1.4, 0, Math.PI * 2);
			ctx.fill();
		}

		// 7. Detailed laurel wreath branches flanking the center
		// Left branch from bottom (116, 208) up along left flank to (82, 62)
		// Right branch from bottom (140, 208) up along right flank to (174, 62)
		const drawLaurelBranch = (isRight: boolean) => {
			const p0 = { x: isRight ? 140 : 116, y: 208 };
			const p1 = { x: isRight ? 200 : 56, y: 175 };
			const p2 = { x: isRight ? 202 : 54, y: 95 };
			const p3 = { x: isRight ? 174 : 82, y: 62 };

			// Stem line
			ctx.strokeStyle = "#7a4e10";
			ctx.lineWidth = 1.6;
			ctx.beginPath();
			ctx.moveTo(p0.x, p0.y);
			ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
			ctx.stroke();

			ctx.strokeStyle = "#ffe28a";
			ctx.lineWidth = 0.8;
			ctx.beginPath();
			ctx.moveTo(p0.x, p0.y - 0.8);
			ctx.bezierCurveTo(p1.x, p1.y - 0.8, p2.x, p2.y - 0.8, p3.x, p3.y);
			ctx.stroke();

			// 8 pairs of detailed laurel leaves along stem
			for (let i = 0; i < 8; i++) {
				const t = 0.1 + (i / 7) * 0.84;
				const mt = 1 - t;
				// Cubic bezier position
				const bx =
					mt * mt * mt * p0.x +
					3 * mt * mt * t * p1.x +
					3 * mt * t * t * p2.x +
					t * t * t * p3.x;
				const by =
					mt * mt * mt * p0.y +
					3 * mt * mt * t * p1.y +
					3 * mt * t * t * p2.y +
					t * t * t * p3.y;

				// Tangent direction
				const dx =
					3 * mt * mt * (p1.x - p0.x) +
					6 * mt * t * (p2.x - p1.x) +
					3 * t * t * (p3.x - p2.x);
				const dy =
					3 * mt * mt * (p1.y - p0.y) +
					6 * mt * t * (p2.y - p1.y) +
					3 * t * t * (p3.y - p2.y);
				const tangent = Math.atan2(dy, dx);

				// Inner leaf pointing toward sun, outer leaf pointing along rim
				const leafAngles = isRight
					? [tangent + 0.48, tangent - 0.38]
					: [tangent - 0.48, tangent + 0.38];
				const len = 12.5 - t * 3.0;
				const wid = 5.2 - t * 1.2;

				for (let li = 0; li < 2; li++) {
					const la = leafAngles[li];
					const sc = li === 0 ? 1.0 : 0.88;
					const curL = len * sc;
					const curW = wid * sc;

					ctx.save();
					ctx.translate(bx, by);
					ctx.rotate(la);

					// Leaf drop shadow
					ctx.fillStyle = "rgba(45, 25, 5, 0.75)";
					ctx.beginPath();
					ctx.moveTo(0, 0.6);
					ctx.quadraticCurveTo(curW * 0.9, curL * 0.5 + 0.6, 0, curL + 0.6);
					ctx.quadraticCurveTo(-curW * 0.9, curL * 0.5 + 0.6, 0, 0.6);
					ctx.closePath();
					ctx.fill();

					// Leaf body gradient
					const lg = ctx.createLinearGradient(0, 0, 0, curL);
					lg.addColorStop(0, "#ffea94");
					lg.addColorStop(0.5, "#d69c2e");
					lg.addColorStop(1, "#855410");
					ctx.fillStyle = lg;
					ctx.beginPath();
					ctx.moveTo(0, 0);
					ctx.quadraticCurveTo(curW * 0.85, curL * 0.5, 0, curL);
					ctx.quadraticCurveTo(-curW * 0.85, curL * 0.5, 0, 0);
					ctx.closePath();
					ctx.fill();

					// Leaf central gilded vein
					ctx.strokeStyle = "#fff6c4";
					ctx.lineWidth = 0.85;
					ctx.beginPath();
					ctx.moveTo(0, 0);
					ctx.lineTo(0, curL * 0.82);
					ctx.stroke();

					ctx.restore();
				}
			}
		};

		drawLaurelBranch(false); // Left branch
		drawLaurelBranch(true); // Right branch

		// Laurel ribbon tie at bottom center (128, 208)
		ctx.save();
		ctx.translate(128, 208);
		// Knot
		ctx.fillStyle = "#422605";
		ctx.beginPath();
		ctx.arc(0, 0.5, 3.5, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = "#fad468";
		ctx.beginPath();
		ctx.arc(0, 0, 2.8, 0, Math.PI * 2);
		ctx.fill();
		// Ribbon loops
		ctx.strokeStyle = "#dfa632";
		ctx.lineWidth = 1.8;
		ctx.beginPath();
		ctx.arc(-4.5, -1, 3.5, 0, Math.PI * 2);
		ctx.arc(4.5, -1, 3.5, 0, Math.PI * 2);
		ctx.stroke();
		// Ribbon tails
		ctx.beginPath();
		ctx.moveTo(-2, 2);
		ctx.quadraticCurveTo(-6, 8, -8, 13);
		ctx.moveTo(2, 2);
		ctx.quadraticCurveTo(6, 8, 8, 13);
		ctx.stroke();
		ctx.restore();

		// 8. Embossed classical Sun with 16 ornate tapered rays
		// 16 rays: 8 major faceted spear rays + 8 minor undulating flame rays
		ctx.save();
		ctx.translate(128, 128);

		for (let i = 0; i < 16; i++) {
			const a = (i * Math.PI * 2) / 16;
			ctx.save();
			ctx.rotate(a);

			if (i % 2 === 0) {
				// Major Faceted Spear Ray (reaches r=70)
				const rInner = 33;
				const rOuter = 70;
				const baseW = 6.0;

				// Left facet (illuminated specular side)
				const leftGrad = ctx.createLinearGradient(0, rInner, 0, rOuter);
				leftGrad.addColorStop(0, "#fff5bd");
				leftGrad.addColorStop(0.5, "#fad468");
				leftGrad.addColorStop(1, "#c99026");
				ctx.fillStyle = leftGrad;
				ctx.beginPath();
				ctx.moveTo(0, rOuter);
				ctx.lineTo(-baseW, rInner);
				ctx.lineTo(0, rInner);
				ctx.closePath();
				ctx.fill();

				// Right facet (shadowed relief side)
				const rightGrad = ctx.createLinearGradient(0, rInner, 0, rOuter);
				rightGrad.addColorStop(0, "#c99026");
				rightGrad.addColorStop(0.5, "#805212");
				rightGrad.addColorStop(1, "#452b07");
				ctx.fillStyle = rightGrad;
				ctx.beginPath();
				ctx.moveTo(0, rOuter);
				ctx.lineTo(0, rInner);
				ctx.lineTo(baseW, rInner);
				ctx.closePath();
				ctx.fill();

				// Central sharp ridge spine
				ctx.strokeStyle = "rgba(255, 250, 220, 0.6)";
				ctx.lineWidth = 0.8;
				ctx.beginPath();
				ctx.moveTo(0, rInner);
				ctx.lineTo(0, rOuter);
				ctx.stroke();
			} else {
				// Minor Undulating Solar Flame Ray (reaches r=58)
				const rInner = 33;
				const rOuter = 58;
				const flameGrad = ctx.createLinearGradient(0, rInner, 0, rOuter);
				flameGrad.addColorStop(0, "#ffeb99");
				flameGrad.addColorStop(0.5, "#dfa42f");
				flameGrad.addColorStop(1, "#9e6614");
				ctx.fillStyle = flameGrad;

				ctx.beginPath();
				ctx.moveTo(-4, rInner);
				ctx.bezierCurveTo(-8, rInner + 9, 4, rInner + 18, 0, rOuter);
				ctx.bezierCurveTo(-2, rInner + 18, 8, rInner + 9, 4, rInner);
				ctx.closePath();
				ctx.fill();

				// Delicate flame spine
				ctx.strokeStyle = "rgba(255, 255, 230, 0.4)";
				ctx.lineWidth = 0.7;
				ctx.beginPath();
				ctx.moveTo(0, rInner + 3);
				ctx.quadraticCurveTo(2, rInner + 14, 0, rOuter - 2);
				ctx.stroke();
			}

			ctx.restore();
		}
		ctx.restore();

		// 9. Central Sun Core Dome (Radius 34 at 128, 128)
		const coreGrad = ctx.createRadialGradient(122, 120, 4, 128, 128, 35);
		coreGrad.addColorStop(0.0, "#fffde8");
		coreGrad.addColorStop(0.25, "#fcd872");
		coreGrad.addColorStop(0.62, "#c98d24");
		coreGrad.addColorStop(0.85, "#784a0d");
		coreGrad.addColorStop(1.0, "#3d2305");
		ctx.fillStyle = coreGrad;
		ctx.beginPath();
		ctx.arc(128, 128, 34, 0, Math.PI * 2);
		ctx.fill();

		// Sun disc beveled rim
		ctx.strokeStyle = "#4d3008";
		ctx.lineWidth = 2.2;
		ctx.stroke();

		// Specular upper-left arc highlight
		ctx.strokeStyle = "rgba(255, 250, 220, 0.7)";
		ctx.lineWidth = 1.2;
		ctx.beginPath();
		ctx.arc(128, 128, 33, -Math.PI * 0.85, -Math.PI * 0.15);
		ctx.stroke();

		// 10. Serene Majestic Sun Face (Classical Roman Helios / Apollo die-struck relief)
		// Sculpted classical brow arches
		ctx.strokeStyle = "#422806";
		ctx.lineWidth = 1.4;
		ctx.beginPath();
		ctx.moveTo(117, 121);
		ctx.quadraticCurveTo(122, 118.5, 126, 120);
		ctx.moveTo(139, 121);
		ctx.quadraticCurveTo(134, 118.5, 130, 120);
		ctx.stroke();

		// Brow ridge highlight
		ctx.strokeStyle = "#fff2b0";
		ctx.lineWidth = 0.9;
		ctx.beginPath();
		ctx.moveTo(117, 120.2);
		ctx.quadraticCurveTo(122, 117.7, 126, 119.2);
		ctx.moveTo(139, 120.2);
		ctx.quadraticCurveTo(134, 117.7, 130, 119.2);
		ctx.stroke();

		// Serene almond eyes
		const drawAlmondEye = (cx: number, cy: number) => {
			// Eye socket shadow
			ctx.fillStyle = "#4a2d07";
			ctx.beginPath();
			ctx.ellipse(cx, cy, 4.2, 2.2, 0, 0, Math.PI * 2);
			ctx.fill();

			// Upper eyelid highlight
			ctx.strokeStyle = "#fff6c4";
			ctx.lineWidth = 1.0;
			ctx.beginPath();
			ctx.moveTo(cx - 4.5, cy);
			ctx.quadraticCurveTo(cx, cy - 2.8, cx + 4.5, cy);
			ctx.stroke();

			// Serene iris / calm gaze
			ctx.fillStyle = "#2d1a03";
			ctx.beginPath();
			ctx.arc(cx, cy + 0.2, 1.3, 0, Math.PI * 2);
			ctx.fill();
			ctx.fillStyle = "#ffffff";
			ctx.beginPath();
			ctx.arc(cx - 0.4, cy - 0.3, 0.5, 0, Math.PI * 2);
			ctx.fill();
		};

		drawAlmondEye(121, 125);
		drawAlmondEye(135, 125);

		// Classical regal aquiline nose
		// Left bridge highlight
		ctx.strokeStyle = "#fff8d0";
		ctx.lineWidth = 1.2;
		ctx.beginPath();
		ctx.moveTo(127.5, 120);
		ctx.lineTo(127, 132.5);
		ctx.stroke();

		// Right bridge shadow
		ctx.strokeStyle = "#503008";
		ctx.lineWidth = 1.4;
		ctx.beginPath();
		ctx.moveTo(128.8, 121);
		ctx.lineTo(129.2, 132.5);
		ctx.stroke();

		// Nose tip & nostrils
		ctx.fillStyle = "#3e2406";
		ctx.beginPath();
		ctx.arc(128, 133, 1.8, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = "#fff3b5";
		ctx.beginPath();
		ctx.arc(127.6, 132.6, 1.0, 0, Math.PI * 2);
		ctx.fill();

		// Nostril wings
		ctx.strokeStyle = "#4d3008";
		ctx.lineWidth = 1.0;
		ctx.beginPath();
		ctx.arc(125.2, 133.5, 1.2, Math.PI * 0.5, Math.PI * 1.5);
		ctx.arc(130.8, 133.5, 1.2, -Math.PI * 0.5, Math.PI * 0.5);
		ctx.stroke();

		// Calm, majestic lips
		// Philtrum
		ctx.strokeStyle = "rgba(70, 42, 10, 0.5)";
		ctx.lineWidth = 0.8;
		ctx.beginPath();
		ctx.moveTo(127.2, 134.5);
		ctx.lineTo(127.2, 137);
		ctx.moveTo(128.8, 134.5);
		ctx.lineTo(128.8, 137);
		ctx.stroke();

		// Upper lip shadow crease
		ctx.fillStyle = "#331c04";
		ctx.beginPath();
		ctx.moveTo(123, 138.5);
		ctx.quadraticCurveTo(125.5, 137.5, 128, 138.2);
		ctx.quadraticCurveTo(130.5, 137.5, 133, 138.5);
		ctx.quadraticCurveTo(128, 140, 123, 138.5);
		ctx.fill();

		// Lower lip full curve with warm gold highlight
		ctx.fillStyle = "#fadb72";
		ctx.beginPath();
		ctx.moveTo(124, 139.5);
		ctx.quadraticCurveTo(128, 142.5, 132, 139.5);
		ctx.quadraticCurveTo(128, 140.8, 124, 139.5);
		ctx.fill();

		// Lower lip crease shadow
		ctx.strokeStyle = "#4a2c07";
		ctx.lineWidth = 1.0;
		ctx.beginPath();
		ctx.arc(128, 141.5, 3.5, 0.2, Math.PI - 0.2);
		ctx.stroke();

		// Chin button highlight
		ctx.fillStyle = "#ffeaa8";
		ctx.beginPath();
		ctx.arc(128, 146, 2.2, 0, Math.PI * 2);
		ctx.fill();

		// Soft cheekbone highlights
		ctx.fillStyle = "rgba(255, 245, 190, 0.35)";
		ctx.beginPath();
		ctx.arc(118, 131, 4.5, 0, Math.PI * 2);
		ctx.arc(138, 131, 4.5, 0, Math.PI * 2);
		ctx.fill();

		c.refresh();
	}

	private makeCoinReverse() {
		const c = this.textures.createCanvas("coin_reverse", 256, 256);
		if (!c) return;
		const ctx = c.getContext();

		// 1. Ambient drop shadow behind coin
		ctx.save();
		ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
		ctx.shadowBlur = 10;
		ctx.shadowOffsetY = 4;
		ctx.fillStyle = "#0a0e16";
		ctx.beginPath();
		ctx.arc(128, 128, 122, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();

		// 2. Deep celestial silver-bronze patina with lapis undertones (lit from top-left: 94, 84)
		const baseGrad = ctx.createRadialGradient(94, 84, 12, 128, 128, 124);
		baseGrad.addColorStop(0.0, "#eef4fa"); // celestial silver-white highlight
		baseGrad.addColorStop(0.18, "#b2c2d4"); // polished silver patina
		baseGrad.addColorStop(0.42, "#687a8e"); // weathered silver-bronze
		baseGrad.addColorStop(0.68, "#3b495b"); // lapis-tinted bronze
		baseGrad.addColorStop(0.88, "#1e2634"); // deep midnight bronze shadow
		baseGrad.addColorStop(1.0, "#0c111a"); // rim crevice
		ctx.fillStyle = baseGrad;
		ctx.beginPath();
		ctx.arc(128, 128, 122, 0, Math.PI * 2);
		ctx.fill();

		// Ethereal lapis undertone glow in central celestial field
		const lapisGlow = ctx.createRadialGradient(128, 128, 10, 128, 128, 96);
		lapisGlow.addColorStop(0.0, "rgba(28, 50, 84, 0.52)");
		lapisGlow.addColorStop(0.65, "rgba(18, 30, 52, 0.3)");
		lapisGlow.addColorStop(1.0, "rgba(8, 14, 25, 0)");
		ctx.fillStyle = lapisGlow;
		ctx.beginPath();
		ctx.arc(128, 128, 96, 0, Math.PI * 2);
		ctx.fill();

		// 3. Antique rim & 60 fine milled edge notches
		ctx.strokeStyle = "#161f2b";
		ctx.lineWidth = 3.5;
		ctx.beginPath();
		ctx.arc(128, 128, 121, 0, Math.PI * 2);
		ctx.stroke();

		const rimGrad = ctx.createLinearGradient(60, 60, 200, 200);
		rimGrad.addColorStop(0.0, "rgba(240, 248, 255, 0.8)");
		rimGrad.addColorStop(0.45, "rgba(165, 190, 220, 0.2)");
		rimGrad.addColorStop(1.0, "rgba(10, 15, 24, 0.8)");
		ctx.strokeStyle = rimGrad;
		ctx.lineWidth = 2.5;
		ctx.beginPath();
		ctx.arc(128, 128, 119.5, 0, Math.PI * 2);
		ctx.stroke();

		for (let i = 0; i < 60; i++) {
			const a = (i * Math.PI * 2) / 60;
			const cos = Math.cos(a);
			const sin = Math.sin(a);
			const r1 = 117;
			const r2 = 122;

			ctx.strokeStyle = "rgba(12, 18, 26, 0.85)";
			ctx.lineWidth = 1.6;
			ctx.beginPath();
			ctx.moveTo(128 + cos * r1, 128 + sin * r1);
			ctx.lineTo(128 + cos * r2, 128 + sin * r2);
			ctx.stroke();

			const lightFactor = -Math.SQRT1_2 * cos - Math.SQRT1_2 * sin;
			if (lightFactor > -0.3) {
				const a2 = a + 0.022;
				ctx.strokeStyle = `rgba(235, 245, 255, ${Math.max(0.15, (lightFactor + 0.3) * 0.75)})`;
				ctx.lineWidth = 1.1;
				ctx.beginPath();
				ctx.moveTo(
					128 + Math.cos(a2) * (r1 + 0.5),
					128 + Math.sin(a2) * (r1 + 0.5),
				);
				ctx.lineTo(
					128 + Math.cos(a2) * (r2 - 0.5),
					128 + Math.sin(a2) * (r2 - 0.5),
				);
				ctx.stroke();
			}
		}

		// 4. Fine astronomical perimeter markings ("FATUM IN AETERNITATEM")
		const text = "· FATUM IN AETERNITATEM ·";
		const textRadius = 108.5;
		const arcSpan = 2.45;
		const startAngle = -Math.PI / 2 - arcSpan / 2;
		ctx.font = 'bold 7.5px "Cinzel", "Times New Roman", serif';
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";

		for (let i = 0; i < text.length; i++) {
			const ch = text[i];
			const a = startAngle + (i / (text.length - 1)) * arcSpan;
			ctx.save();
			ctx.translate(128, 128);
			ctx.rotate(a + Math.PI / 2);

			// Embossed relief shadow
			ctx.fillStyle = "rgba(10, 16, 26, 0.9)";
			ctx.fillText(ch, 0.6, -textRadius + 0.7);

			// Celestial silver highlight
			ctx.fillStyle = "#e8f2fc";
			ctx.fillText(ch, 0, -textRadius);
			ctx.restore();
		}

		// Lower perimeter astronomical markings: astrolabe degree ticks along lower arc (25° to 155°)
		for (let deg = 25; deg <= 155; deg += 2.5) {
			const rad = (deg * Math.PI) / 180;
			const isMajor = deg % 15 === 0;
			const rInner = isMajor ? 104 : 106.5;
			const rOuter = 111.5;

			ctx.strokeStyle = isMajor
				? "rgba(220, 238, 255, 0.85)"
				: "rgba(160, 190, 225, 0.4)";
			ctx.lineWidth = isMajor ? 1.4 : 0.8;
			ctx.beginPath();
			ctx.moveTo(128 + Math.cos(rad) * rInner, 128 + Math.sin(rad) * rInner);
			ctx.lineTo(128 + Math.cos(rad) * rOuter, 128 + Math.sin(rad) * rOuter);
			ctx.stroke();

			if (isMajor) {
				// Astrolabe decan dot
				ctx.fillStyle = "#eef6ff";
				ctx.beginPath();
				ctx.arc(
					128 + Math.cos(rad) * (rInner - 2.5),
					128 + Math.sin(rad) * (rInner - 2.5),
					1.2,
					0,
					Math.PI * 2,
				);
				ctx.fill();
			}
		}

		// 5. Beaded pearl ring (silver-pearl beads)
		ctx.strokeStyle = "#253346";
		ctx.lineWidth = 1.6;
		ctx.beginPath();
		ctx.arc(128, 128, 98, 0, Math.PI * 2);
		ctx.stroke();

		for (let i = 0; i < 48; i++) {
			const a = (i * Math.PI * 2) / 48;
			const bx = 128 + Math.cos(a) * 98;
			const by = 128 + Math.sin(a) * 98;

			ctx.fillStyle = "#151e2b";
			ctx.beginPath();
			ctx.arc(bx + 0.4, by + 0.5, 2.0, 0, Math.PI * 2);
			ctx.fill();

			ctx.fillStyle = "#edf4fc";
			ctx.beginPath();
			ctx.arc(bx - 0.4, by - 0.4, 1.4, 0, Math.PI * 2);
			ctx.fill();
		}

		// 6. Detailed sculpted crescent moon with crater shading and inner filigree
		// Elegant waxing crescent on the left half opening towards the right (tips at 126, 78 and 126, 178)
		ctx.save();
		ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
		ctx.shadowBlur = 9;
		ctx.shadowOffsetX = -2;
		ctx.shadowOffsetY = 2;

		const moonGrad = ctx.createLinearGradient(55, 78, 126, 178);
		moonGrad.addColorStop(0.0, "#ffffff");
		moonGrad.addColorStop(0.28, "#dbe6f5");
		moonGrad.addColorStop(0.65, "#9ab1c9");
		moonGrad.addColorStop(0.88, "#50647c");
		moonGrad.addColorStop(1.0, "#253344");

		ctx.fillStyle = moonGrad;
		ctx.beginPath();
		ctx.moveTo(126, 78);
		ctx.bezierCurveTo(50, 74, 46, 182, 126, 178);
		ctx.bezierCurveTo(80, 164, 82, 92, 126, 78);
		ctx.closePath();
		ctx.fill();
		ctx.restore();

		// Crescent sculpted bevel rim strokes
		// Outer illuminated crest highlight facing light
		ctx.strokeStyle = "rgba(255, 255, 255, 0.88)";
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.moveTo(126, 78);
		ctx.bezierCurveTo(50, 74, 46, 182, 126, 178);
		ctx.stroke();

		// Inner shadowed die-relief crease
		ctx.strokeStyle = "#141d28";
		ctx.lineWidth = 1.6;
		ctx.beginPath();
		ctx.moveTo(126, 178);
		ctx.bezierCurveTo(80, 164, 82, 92, 126, 78);
		ctx.stroke();

		// Lunar crater shading & sculpted maria (within crescent mask)
		ctx.save();
		ctx.beginPath();
		ctx.moveTo(126, 78);
		ctx.bezierCurveTo(50, 74, 46, 182, 126, 178);
		ctx.bezierCurveTo(80, 164, 82, 92, 126, 78);
		ctx.closePath();
		ctx.clip();

		const drawCrater = (cx: number, cy: number, r: number) => {
			const cg = ctx.createRadialGradient(cx + 0.8, cy + 0.8, 1, cx, cy, r);
			cg.addColorStop(0, "rgba(20, 28, 40, 0.85)");
			cg.addColorStop(0.7, "rgba(35, 50, 70, 0.55)");
			cg.addColorStop(1, "rgba(65, 90, 120, 0.1)");
			ctx.fillStyle = cg;
			ctx.beginPath();
			ctx.arc(cx, cy, r, 0, Math.PI * 2);
			ctx.fill();

			// Crater illuminated rim lip (facing upper-left)
			ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
			ctx.lineWidth = 0.95;
			ctx.beginPath();
			ctx.arc(cx, cy, r - 0.5, -Math.PI * 0.8, -Math.PI * 0.1);
			ctx.stroke();

			// Crater shadowed rim lip
			ctx.strokeStyle = "rgba(10, 15, 22, 0.85)";
			ctx.lineWidth = 0.95;
			ctx.beginPath();
			ctx.arc(cx, cy, r - 0.5, Math.PI * 0.2, Math.PI * 0.9);
			ctx.stroke();

			if (r > 5) {
				ctx.fillStyle = "#ffffff";
				ctx.beginPath();
				ctx.arc(cx - 0.3, cy - 0.3, 0.8, 0, Math.PI * 2);
				ctx.fill();
			}
		};

		drawCrater(84, 112, 6.8); // Mare Crisium analogue
		drawCrater(76, 132, 5.6); // Tycho analogue
		drawCrater(86, 150, 5.0); // Copernicus analogue
		drawCrater(72, 121, 3.6); // Kepler analogue

		ctx.restore();

		// Detailed inner filigree: engraved celestial acanthus scrolls along inner crescent arc
		ctx.save();
		ctx.strokeStyle = "rgba(220, 240, 255, 0.75)";
		ctx.lineWidth = 1.0;
		// Upper filigree spiral curving into bay
		ctx.beginPath();
		ctx.moveTo(124, 84);
		ctx.quadraticCurveTo(106, 96, 108, 108);
		ctx.quadraticCurveTo(112, 116, 105, 121);
		ctx.stroke();
		// Lower filigree spiral curving into bay
		ctx.beginPath();
		ctx.moveTo(124, 172);
		ctx.quadraticCurveTo(106, 160, 108, 148);
		ctx.quadraticCurveTo(112, 140, 105, 135);
		ctx.stroke();
		// Filigree leaf buds
		const buds = [
			[106, 102],
			[111, 112],
			[106, 154],
			[111, 144],
		] as const;
		for (const [bx, by] of buds) {
			ctx.fillStyle = "#ffffff";
			ctx.beginPath();
			ctx.arc(bx, by, 1.2, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();

		// 7. Pleiades star constellation with subtle corona glows
		// Positioned in the open celestial sky to the right of the crescent moon
		const pleiades = [
			{ name: "Alcyone", x: 172, y: 124, r: 3.4, corona: 16 },
			{ name: "Maia", x: 160, y: 100, r: 2.7, corona: 13 },
			{ name: "Electra", x: 148, y: 114, r: 2.5, corona: 12 },
			{ name: "Taygete", x: 152, y: 84, r: 2.3, corona: 11 },
			{ name: "Celaeno", x: 144, y: 95, r: 2.0, corona: 10 },
			{ name: "Merope", x: 162, y: 144, r: 2.6, corona: 12 },
			{ name: "Atlas", x: 188, y: 112, r: 2.8, corona: 13 },
			{ name: "Pleione", x: 190, y: 104, r: 2.2, corona: 11 },
		];

		// Faint gossamer constellation lines connecting the Pleiades
		ctx.strokeStyle = "rgba(180, 215, 255, 0.32)";
		ctx.lineWidth = 0.9;
		ctx.beginPath();
		// Taygete -> Maia -> Electra -> Alcyone -> Merope
		ctx.moveTo(152, 84);
		ctx.lineTo(160, 100);
		ctx.lineTo(148, 114);
		ctx.lineTo(172, 124);
		ctx.lineTo(162, 144);
		// Maia -> Celaeno
		ctx.moveTo(160, 100);
		ctx.lineTo(144, 95);
		// Alcyone -> Atlas -> Pleione
		ctx.moveTo(172, 124);
		ctx.lineTo(188, 112);
		ctx.lineTo(190, 104);
		ctx.stroke();

		// Draw each star with multi-stage corona glow and 4-point diamond starlet
		for (const star of pleiades) {
			// Outer soft corona glow
			const outerCorona = ctx.createRadialGradient(
				star.x,
				star.y,
				0,
				star.x,
				star.y,
				star.corona,
			);
			outerCorona.addColorStop(0, "rgba(190, 225, 255, 0.45)");
			outerCorona.addColorStop(0.4, "rgba(160, 205, 255, 0.2)");
			outerCorona.addColorStop(1, "rgba(120, 170, 230, 0)");
			ctx.fillStyle = outerCorona;
			ctx.beginPath();
			ctx.arc(star.x, star.y, star.corona, 0, Math.PI * 2);
			ctx.fill();

			// Inner intense corona
			const innerCorona = ctx.createRadialGradient(
				star.x,
				star.y,
				0,
				star.x,
				star.y,
				star.r * 2.2,
			);
			innerCorona.addColorStop(0, "rgba(255, 255, 255, 0.9)");
			innerCorona.addColorStop(0.5, "rgba(220, 240, 255, 0.6)");
			innerCorona.addColorStop(1, "rgba(180, 210, 255, 0)");
			ctx.fillStyle = innerCorona;
			ctx.beginPath();
			ctx.arc(star.x, star.y, star.r * 2.2, 0, Math.PI * 2);
			ctx.fill();

			// 4-point diamond starlet core
			ctx.fillStyle = "#ffffff";
			const spike = star.r * 2.5;
			ctx.beginPath();
			ctx.moveTo(star.x, star.y - spike);
			ctx.lineTo(star.x + star.r * 0.4, star.y);
			ctx.lineTo(star.x, star.y + spike);
			ctx.lineTo(star.x - star.r * 0.4, star.y);
			ctx.closePath();
			ctx.fill();

			ctx.beginPath();
			ctx.moveTo(star.x - spike, star.y);
			ctx.lineTo(star.x, star.y + star.r * 0.4);
			ctx.lineTo(star.x + spike, star.y);
			ctx.lineTo(star.x - star.r * 0.4, star.y);
			ctx.closePath();
			ctx.fill();
		}

		// Scattered celestial micro-stardust
		const microStars = [
			[164, 86],
			[178, 96],
			[174, 144],
			[188, 134],
			[150, 160],
			[136, 76],
		];
		for (const [mx, my] of microStars) {
			ctx.fillStyle = "rgba(240, 248, 255, 0.65)";
			ctx.beginPath();
			ctx.arc(mx, my, 0.9, 0, Math.PI * 2);
			ctx.fill();
		}

		c.refresh();
	}

	private makeCoinEdge() {
		const c = this.textures.createCanvas("coin_edge", 24, 256);
		if (!c) return;
		const ctx = c.getContext();

		// 1. Base metallic cylinder gradient across width (x: 0 to 24)
		// x=0 is Obverse rim lip, x=24 is Reverse rim lip
		const cylGrad = ctx.createLinearGradient(0, 0, 24, 0);
		cylGrad.addColorStop(0.0, "#fffbe0"); // Obverse rim bright specular highlight
		cylGrad.addColorStop(0.08, "#f0cb5a"); // Obverse bevel
		cylGrad.addColorStop(0.22, "#c9942a"); // Milled body left
		cylGrad.addColorStop(0.5, "#fae48a"); // Cylindrical apex specular reflection
		cylGrad.addColorStop(0.78, "#a06b18"); // Milled body right
		cylGrad.addColorStop(0.92, "#5e3909"); // Reverse bevel
		cylGrad.addColorStop(1.0, "#2c1903"); // Reverse rim shadow
		ctx.fillStyle = cylGrad;
		ctx.fillRect(0, 0, 24, 256);

		// 2. Vertical ambient lighting along coin height (y: 0 to 256)
		// Highlights top-middle, soft ambient shadow at base
		const vertShade = ctx.createLinearGradient(0, 0, 0, 256);
		vertShade.addColorStop(0.0, "rgba(255, 255, 255, 0.35)");
		vertShade.addColorStop(0.25, "rgba(255, 250, 210, 0.15)");
		vertShade.addColorStop(0.7, "rgba(0, 0, 0, 0.05)");
		vertShade.addColorStop(1.0, "rgba(0, 0, 0, 0.45)");
		ctx.fillStyle = vertShade;
		ctx.fillRect(0, 0, 24, 256);

		// 3. Horizontal milled ridge grooves across the cylinder thickness (x: 2 to 22)
		for (let y = 2; y < 254; y += 4) {
			const yFactor = 1 - Math.abs(y - 80) / 180;
			const highlightAlpha = Math.max(
				0.2,
				Math.min(0.85, 0.45 + yFactor * 0.4),
			);

			// Dark milled crevice groove
			ctx.strokeStyle = "rgba(40, 22, 4, 0.85)";
			ctx.lineWidth = 1.3;
			ctx.beginPath();
			ctx.moveTo(2.5, y);
			ctx.lineTo(21.5, y);
			ctx.stroke();

			// Raised metallic ridge crest highlight
			ctx.strokeStyle = `rgba(255, 245, 195, ${highlightAlpha})`;
			ctx.lineWidth = 1.1;
			ctx.beginPath();
			ctx.moveTo(3.0, y + 1.8);
			ctx.lineTo(21.0, y + 1.8);
			ctx.stroke();

			// Warm gold ridge body reflection
			ctx.strokeStyle = "rgba(215, 160, 45, 0.5)";
			ctx.lineWidth = 0.9;
			ctx.beginPath();
			ctx.moveTo(3.5, y + 3.0);
			ctx.lineTo(20.5, y + 3.0);
			ctx.stroke();
		}

		// 4. Sharp longitudinal rim boundaries
		// Left edge lip (Obverse boundary)
		ctx.strokeStyle = "rgba(255, 252, 230, 0.9)";
		ctx.lineWidth = 1.2;
		ctx.beginPath();
		ctx.moveTo(0.6, 0);
		ctx.lineTo(0.6, 256);
		ctx.stroke();

		// Left shoulder crease
		ctx.strokeStyle = "rgba(65, 38, 7, 0.7)";
		ctx.lineWidth = 0.9;
		ctx.beginPath();
		ctx.moveTo(2.5, 0);
		ctx.lineTo(2.5, 256);
		ctx.stroke();

		// Right shoulder crease
		ctx.strokeStyle = "rgba(45, 24, 4, 0.8)";
		ctx.lineWidth = 0.9;
		ctx.beginPath();
		ctx.moveTo(21.5, 0);
		ctx.lineTo(21.5, 256);
		ctx.stroke();

		// Right edge lip (Reverse boundary)
		ctx.strokeStyle = "rgba(25, 14, 3, 0.9)";
		ctx.lineWidth = 1.2;
		ctx.beginPath();
		ctx.moveTo(23.4, 0);
		ctx.lineTo(23.4, 256);
		ctx.stroke();

		// 5. Top and bottom rim curvature highlights
		const topCap = ctx.createRadialGradient(12, 4, 1, 12, 4, 14);
		topCap.addColorStop(0, "rgba(255, 255, 245, 0.8)");
		topCap.addColorStop(0.5, "rgba(255, 235, 170, 0.4)");
		topCap.addColorStop(1, "rgba(255, 220, 120, 0)");
		ctx.fillStyle = topCap;
		ctx.beginPath();
		ctx.ellipse(12, 5, 10, 5, 0, 0, Math.PI * 2);
		ctx.fill();

		const botCap = ctx.createLinearGradient(0, 246, 0, 256);
		botCap.addColorStop(0, "rgba(20, 10, 2, 0)");
		botCap.addColorStop(1, "rgba(10, 5, 1, 0.8)");
		ctx.fillStyle = botCap;
		ctx.fillRect(0, 246, 24, 10);

		c.refresh();
	}

	private makeCoinShine() {
		const c = this.textures.createCanvas("coin_shine", 256, 256);
		if (!c) return;
		const ctx = c.getContext();

		// Clip within the circular coin radius (r=122 at 128, 128)
		ctx.save();
		ctx.beginPath();
		ctx.arc(128, 128, 122, 0, Math.PI * 2);
		ctx.clip();

		// 1. Soft diagonal specular sweep light beam (tilted at -45 degrees)
		ctx.save();
		ctx.translate(128, 128);
		ctx.rotate(-Math.PI / 4);

		// Broad soft ambient sweep
		const broadSweep = ctx.createLinearGradient(-75, 0, 75, 0);
		broadSweep.addColorStop(0.0, "rgba(255, 235, 170, 0)");
		broadSweep.addColorStop(0.3, "rgba(255, 245, 205, 0.14)");
		broadSweep.addColorStop(0.5, "rgba(255, 255, 255, 0.55)");
		broadSweep.addColorStop(0.7, "rgba(255, 245, 205, 0.14)");
		broadSweep.addColorStop(1.0, "rgba(255, 235, 170, 0)");
		ctx.fillStyle = broadSweep;
		ctx.fillRect(-75, -140, 150, 280);

		// Narrow intense specular core beam
		const coreBeam = ctx.createLinearGradient(-18, 0, 18, 0);
		coreBeam.addColorStop(0.0, "rgba(255, 255, 255, 0)");
		coreBeam.addColorStop(0.35, "rgba(255, 255, 255, 0.4)");
		coreBeam.addColorStop(0.5, "rgba(255, 255, 255, 0.85)");
		coreBeam.addColorStop(0.65, "rgba(255, 255, 255, 0.4)");
		coreBeam.addColorStop(1.0, "rgba(255, 255, 255, 0)");
		ctx.fillStyle = coreBeam;
		ctx.fillRect(-18, -140, 36, 280);

		ctx.restore();

		// 2. Brilliant focal specular starburst glint at primary light node (100, 100)
		const gx = 100;
		const gy = 100;

		// Soft radial corona
		const bloom = ctx.createRadialGradient(gx, gy, 0, gx, gy, 42);
		bloom.addColorStop(0.0, "rgba(255, 255, 255, 0.95)");
		bloom.addColorStop(0.25, "rgba(255, 248, 215, 0.6)");
		bloom.addColorStop(0.55, "rgba(255, 230, 140, 0.2)");
		bloom.addColorStop(1.0, "rgba(255, 210, 80, 0)");
		ctx.fillStyle = bloom;
		ctx.beginPath();
		ctx.arc(gx, gy, 42, 0, Math.PI * 2);
		ctx.fill();

		// Diamond flare spikes
		ctx.fillStyle = "#ffffff";
		// Horizontal spike
		ctx.beginPath();
		ctx.moveTo(gx - 45, gy);
		ctx.lineTo(gx, gy - 2);
		ctx.lineTo(gx + 45, gy);
		ctx.lineTo(gx, gy + 2);
		ctx.closePath();
		ctx.fill();

		// Vertical spike
		ctx.beginPath();
		ctx.moveTo(gx, gy - 45);
		ctx.lineTo(gx + 2, gy);
		ctx.lineTo(gx, gy + 45);
		ctx.lineTo(gx - 2, gy);
		ctx.closePath();
		ctx.fill();

		// Diagonal 45 deg secondary spikes
		ctx.save();
		ctx.translate(gx, gy);
		ctx.rotate(Math.PI / 4);
		ctx.fillStyle = "rgba(255, 250, 230, 0.75)";
		ctx.beginPath();
		ctx.moveTo(-24, 0);
		ctx.lineTo(0, -1.5);
		ctx.lineTo(24, 0);
		ctx.lineTo(0, 1.5);
		ctx.closePath();
		ctx.fill();

		ctx.beginPath();
		ctx.moveTo(0, -24);
		ctx.lineTo(1.5, 0);
		ctx.lineTo(0, 24);
		ctx.lineTo(-1.5, 0);
		ctx.closePath();
		ctx.fill();
		ctx.restore();

		// Secondary delicate glint on coin opposite shoulder (152, 92)
		const g2x = 152;
		const g2y = 92;
		const bloom2 = ctx.createRadialGradient(g2x, g2y, 0, g2x, g2y, 18);
		bloom2.addColorStop(0.0, "rgba(255, 255, 255, 0.8)");
		bloom2.addColorStop(0.4, "rgba(255, 240, 180, 0.35)");
		bloom2.addColorStop(1.0, "rgba(255, 220, 100, 0)");
		ctx.fillStyle = bloom2;
		ctx.beginPath();
		ctx.arc(g2x, g2y, 18, 0, Math.PI * 2);
		ctx.fill();

		ctx.restore();
		c.refresh();
	}
}
