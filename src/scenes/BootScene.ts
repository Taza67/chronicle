import Phaser from "phaser";
import { LEADERS } from "../content/leaders.ts";
import { setManifest } from "../core/art.ts";
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
		this.scene.start("Title");
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
		const c = this.textures.createCanvas("coin", 256, 256);
		if (!c) return;
		const ctx = c.getContext();
		const g = ctx.createRadialGradient(100, 90, 20, 128, 128, 128);
		g.addColorStop(0, "#ffe9a3");
		g.addColorStop(0.6, "#e0b64a");
		g.addColorStop(1, "#8d6a1e");
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(128, 128, 124, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = "#6b4e12";
		ctx.lineWidth = 8;
		ctx.stroke();
		ctx.strokeStyle = "rgba(255,255,255,0.35)";
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.arc(128, 128, 104, 0, Math.PI * 2);
		ctx.stroke();
		ctx.fillStyle = "#5c410e";
		ctx.font = "900 150px Cinzel, serif";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText("C", 128, 138);
		c.refresh();
	}
}
