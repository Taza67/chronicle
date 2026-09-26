import Phaser from "phaser";
import { online, stt } from "../core/api.ts";
import { audio, type MusicSituation } from "../core/audio.ts";
import { micSupported, type Recording, record } from "../core/recorder.ts";
import { settings } from "../core/state.ts";
import { COLORS, FONT, H, hex, title, W } from "./theme.ts";
import { toast } from "./widgets.ts";

export type VoiceResult =
	| {
			ok: true;
			kind: "choice";
			label: string;
			index: number;
	  }
	| {
			ok: true;
			kind: "custom";
			label: string;
	  }
	| {
			ok: false;
			reason?: string;
	  }
	| boolean
	| undefined;

export interface VoiceResonatorOptions {
	/** Header ribbon text (e.g. "VOX REGIS", "VOX SUMMONS"). Defaults to "VOX REGIS". */
	title?: string;
	/** Subtitle guidance text. Defaults to "Speak your decree". */
	prompt?: string;
	/** Max duration in seconds before auto-sealing. Defaults to 8. */
	maxSeconds?: number;
	/** Callback invoked with final transcript. Return VoiceResult to update UI. */
	onTranscript: (transcript: string) => Promise<VoiceResult>;
	/** Optional callback when recording fails or is cancelled without transcript. */
	onCancel?: () => void;
}

type ResonatorState =
	| "idle"
	| "listening"
	| "processing"
	| "transcribed"
	| "dismissed";

/**
 * Acoustic Astrolabe (Voice Resonator):
 * A museum-grade sacred ritual overlay for voice capture in Chronicle.
 * Features an ancient astronomical astrolabe, dynamic harmonic acoustic rays,
 * concentric sound ripples, a royal golden microphone medallion, real-time waveform equalizer,
 * countdown time ring, and fluid audio physics.
 */
export class VoiceResonator extends Phaser.GameObjects.Container {
	private shade: Phaser.GameObjects.Rectangle;
	private hub: Phaser.GameObjects.Container;
	private astrolabeGfx: Phaser.GameObjects.Graphics;
	private ripplesGfx: Phaser.GameObjects.Graphics;
	private medallion: Phaser.GameObjects.Container;
	private micGfx: Phaser.GameObjects.Graphics;
	private halo: Phaser.GameObjects.Arc;
	private particles?: Phaser.GameObjects.Particles.ParticleEmitter;

	private titleText: Phaser.GameObjects.Text;
	private promptText: Phaser.GameObjects.Text;
	private closeBtn: Phaser.GameObjects.Container;
	private plateGfx: Phaser.GameObjects.Graphics;
	private equalizerGfx: Phaser.GameObjects.Graphics;
	private statusText: Phaser.GameObjects.Text;
	private hintText: Phaser.GameObjects.Text;

	private ritualState: ResonatorState = "idle";
	private recording: Recording | null = null;
	private autoTimer?: Phaser.Time.TimerEvent;
	private processingEllipsisTimer?: Phaser.Time.TimerEvent;

	// Fluid audio physics & animation state
	private smoothedLevel = 0;
	private astrolabeAngle = 0;
	private innerGearAngle = 0;
	private wavePhase = 0;
	private ripplePhase = 0;
	private remainingSeconds = 8;
	private isShuttingDown = false;
	private prevMusicSituation: MusicSituation = "normal";

	private readonly opts: Required<Omit<VoiceResonatorOptions, "onCancel">> & {
		onCancel?: () => void;
	};

	constructor(scene: Phaser.Scene, options: VoiceResonatorOptions) {
		super(scene, 0, 0);

		this.opts = {
			title: options.title ?? "VOX REGIS",
			prompt: options.prompt ?? "Speak your decree",
			maxSeconds: options.maxSeconds ?? 8,
			onTranscript: options.onTranscript,
			onCancel: options.onCancel,
		};
		this.remainingSeconds = this.opts.maxSeconds;

		this.setDepth(92);

		// 1. Full-screen dark velvet interactive veil
		this.shade = scene.add
			.rectangle(W / 2, H / 2, W, H, COLORS.night, 0.82)
			.setDepth(91)
			.setInteractive();
		this.shade.setAlpha(0);

		// 2. Central ritual hub
		const hubY = H * 0.5;
		this.hub = scene.add.container(W / 2, hubY).setDepth(92);
		this.hub.setScale(0.85).setAlpha(0);

		// 3. Ambient golden breathing aura
		this.halo = scene.add.circle(0, 0, 110, COLORS.gold, 0.12);
		scene.tweens.add({
			targets: this.halo,
			alpha: { from: 0.08, to: 0.22 },
			scale: { from: 0.95, to: 1.15 },
			duration: 1800,
			yoyo: true,
			repeat: -1,
			ease: "Sine.inOut",
		});

		// 4. Expanding acoustic ripple rings graphics
		this.ripplesGfx = scene.add.graphics();

		// 5. Astronomical Astrolabe gear & dynamic harmonic frequency rays
		this.astrolabeGfx = scene.add.graphics();

		// 6. Sovereign Golden Medallion
		this.medallion = scene.add.container(0, 0);
		const medBg = scene.add.graphics();
		this.drawMedallionBase(medBg);

		this.micGfx = scene.add.graphics();
		this.drawMicrophoneGlyph(this.micGfx, COLORS.gold, 1);

		this.medallion.add([medBg, this.micGfx]);

		// 7. Celestial stardust particles
		if (!settings.reducedMotion && scene.textures.exists("spark")) {
			this.particles = scene.add.particles(0, 0, "spark", {
				speed: { min: 20, max: 70 },
				angle: { min: 220, max: 320 },
				scale: { start: 0.45, end: 0 },
				alpha: { start: 0.7, end: 0 },
				lifespan: 1100,
				tint: [COLORS.gold, 0xffffff, COLORS.goldDeep],
				frequency: 180,
				blendMode: Phaser.BlendModes.ADD,
				emitting: false,
			});
		}

		// 8. Headers above the astrolabe
		this.titleText = scene.add
			.text(0, -188, this.opts.title.toUpperCase(), {
				...title(24, hex(COLORS.gold)),
				letterSpacing: 6,
			})
			.setOrigin(0.5);
		this.titleText.setShadow(0, 2, "#000000", 8, false, true);

		this.promptText = scene.add
			.text(0, -152, this.opts.prompt, {
				fontFamily: FONT.body,
				fontSize: "24px",
				color: hex(COLORS.parchment),
				fontStyle: "italic",
				align: "center",
			})
			.setOrigin(0.5);

		// Close / Cancel button at top right
		this.closeBtn = this.createCloseButton(scene, 220, -188);

		// 9. Status & Transcription plate below the astrolabe
		const plateWidth = 520;
		const plateHeight = 92;
		const plateY = 176;

		this.plateGfx = scene.add.graphics();
		this.drawStatusPlate(this.plateGfx, 0, plateY, plateWidth, plateHeight);

		// Real-time equalizer visualizer inside the plate
		this.equalizerGfx = scene.add.graphics();

		this.statusText = scene.add
			.text(0, plateY - 14, "Listening…", {
				fontFamily: FONT.ui,
				fontSize: "20px",
				color: hex(COLORS.text),
				fontStyle: "600",
				align: "center",
				wordWrap: { width: plateWidth - 40 },
			})
			.setOrigin(0.5);

		this.hintText = scene.add
			.text(0, plateY + 22, "Tap anywhere to seal your decree", {
				fontFamily: FONT.ui,
				fontSize: "14px",
				color: hex(COLORS.muted),
				fontStyle: "500",
				align: "center",
			})
			.setOrigin(0.5);

		// Assemble children into hub container
		const hubElements: Phaser.GameObjects.GameObject[] = [
			this.halo,
			this.ripplesGfx,
			this.astrolabeGfx,
		];
		if (this.particles) hubElements.push(this.particles);
		hubElements.push(
			this.medallion,
			this.titleText,
			this.promptText,
			this.closeBtn,
			this.plateGfx,
			this.equalizerGfx,
			this.statusText,
			this.hintText,
		);
		this.hub.add(hubElements);

		this.add([this.shade, this.hub]);
		scene.add.existing(this);

		// Tap anywhere to finish early
		this.shade.on("pointerup", () => {
			if (this.ritualState === "listening") {
				audio.sfx("tap");
				void this.sealAndProcess();
			}
		});

		// Scene shutdown hook
		scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleShutdown, this);
		scene.events.on(Phaser.Scenes.Events.UPDATE, this.updateAnimation, this);
	}

	private createCloseButton(scene: Phaser.Scene, x: number, y: number) {
		const c = scene.add.container(x, y);
		const bg = scene.add.graphics();
		bg.fillStyle(COLORS.ink, 0.85);
		bg.fillCircle(0, 0, 18);
		bg.lineStyle(1.5, COLORS.goldDeep, 0.7);
		bg.strokeCircle(0, 0, 18);

		const txt = scene.add
			.text(0, 0, "✕", {
				fontFamily: FONT.ui,
				fontSize: "16px",
				color: hex(COLORS.muted),
				fontStyle: "700",
			})
			.setOrigin(0.5);

		c.add([bg, txt]);
		c.setSize(36, 36).setInteractive({ useHandCursor: true });

		c.on("pointerover", () => {
			txt.setColor(hex(COLORS.gold));
			bg.lineStyle(1.5, COLORS.gold, 1);
			bg.strokeCircle(0, 0, 18);
		});
		c.on("pointerout", () => {
			txt.setColor(hex(COLORS.muted));
			bg.lineStyle(1.5, COLORS.goldDeep, 0.7);
			bg.strokeCircle(0, 0, 18);
		});
		c.on("pointerup", () => {
			audio.sfx("tap");
			this.cancel();
		});

		return c;
	}

	/** Start recording and run the interactive voice overlay ritual. */
	async run(): Promise<void> {
		if (!micSupported() || !online()) {
			toast(this.scene, "Microphone unavailable", COLORS.blood);
			this.dismiss(false);
			return;
		}

		// Play opening whoosh and set intimate acoustic situation
		audio.sfx("whoosh");
		this.prevMusicSituation = audio.getMusicSituation();
		audio.setMusicSituation("oracle");

		// Smooth entrance transition
		this.scene.tweens.add({
			targets: this.shade,
			alpha: 0.82,
			duration: 280,
			ease: "Cubic.out",
		});
		this.scene.tweens.add({
			targets: this.hub,
			alpha: 1,
			scale: 1,
			duration: 380,
			ease: "Back.out",
		});

		try {
			this.recording = await record(this.opts.maxSeconds);
		} catch (err) {
			console.error("[VoiceResonator] getUserMedia error:", err);
			toast(this.scene, "Microphone access denied", COLORS.blood);
			audio.sfx("fail");
			this.dismiss(false);
			return;
		}

		this.ritualState = "listening";
		this.remainingSeconds = this.opts.maxSeconds;
		if (this.particles) this.particles.start();

		// Auto-stop safety timer
		this.autoTimer = this.scene.time.delayedCall(
			this.opts.maxSeconds * 1000 + 100,
			() => {
				if (this.ritualState === "listening") {
					void this.sealAndProcess();
				}
			},
		);
	}

	/** Cancel cleanly without submitting or showing an error. */
	cancel() {
		if (this.ritualState === "dismissed") return;
		this.ritualState = "dismissed";
		if (this.recording) {
			void this.recording.stop();
		}
		this.opts.onCancel?.();
		audio.setMusicSituation(this.prevMusicSituation);
		this.cleanupEvents();
		this.scene.tweens.add({
			targets: this.hub,
			scale: 0.85,
			alpha: 0,
			duration: 200,
			ease: "Cubic.in",
		});
		this.scene.tweens.add({
			targets: this.shade,
			alpha: 0,
			duration: 220,
			ease: "Cubic.in",
			onComplete: () => {
				this.destroy();
			},
		});
	}

	/** Seal the recording and proceed to transcription & court interpretation. */
	private async sealAndProcess() {
		if (this.ritualState !== "listening" || !this.recording) return;
		this.ritualState = "processing";

		this.autoTimer?.remove();
		this.shade.disableInteractive();
		this.closeBtn.disableInteractive();
		if (this.particles) this.particles.stop();

		// Clear equalizer
		this.equalizerGfx.clear();

		// Update UI for processing state
		this.statusText.setText("The court weighs your words");
		this.hintText.setText("Divining historical counsel…");

		// Pulsing animated ellipsis for regal contemplation
		let dotCount = 0;
		this.processingEllipsisTimer = this.scene.time.addEvent({
			delay: 350,
			loop: true,
			callback: () => {
				if (this.ritualState !== "processing") return;
				dotCount = (dotCount + 1) % 4;
				const dots = ".".repeat(dotCount);
				this.statusText.setText(`The court weighs your words${dots}`);
			},
		});

		// Medallion contemplation pulse
		this.scene.tweens.add({
			targets: this.medallion,
			scale: 1.08,
			duration: 500,
			yoyo: true,
			repeat: -1,
			ease: "Sine.inOut",
		});

		// Stop recorder and retrieve WAV blob
		let blob: Blob | null = null;
		try {
			blob = await this.recording.stop();
		} catch (e) {
			console.warn("[VoiceResonator] Recorder stop error:", e);
		}

		if (!blob || this.isShuttingDown) {
			this.handleError("Could not capture audio");
			return;
		}

		// STT Transcription
		let transcript = "";
		try {
			transcript = (await stt(blob)).trim();
		} catch (e) {
			console.warn("[VoiceResonator] STT error:", e);
		}

		this.processingEllipsisTimer?.remove();

		if (!transcript) {
			this.handleError("Could not hear words. Please choose below.");
			return;
		}

		// Display recognized transcript in quotes
		this.ritualState = "transcribed";
		audio.sfx("chime");
		this.statusText.setColor(hex(COLORS.gold));
		this.statusText.setText(`“${transcript}”`);
		this.hintText.setText("The council listens");

		// Flash of golden light on transcript
		this.scene.tweens.add({
			targets: [this.statusText, this.medallion],
			alpha: { from: 0.4, to: 1 },
			duration: 250,
			yoyo: true,
			repeat: 1,
		});

		// Invoke consumer callback with transcript
		let result: VoiceResult = false;
		try {
			result = await this.opts.onTranscript(transcript);
		} catch (e) {
			console.error("[VoiceResonator] onTranscript failed:", e);
		}

		if (result && typeof result === "object" && result.ok) {
			// Rich confirmation display
			if (result.kind === "choice") {
				this.statusText.setText(`✦ ${result.label} ✦`);
				this.hintText.setText(
					`Option ${["I", "II", "III", "IV"][result.index] ?? result.index + 1} confirmed`,
				);
			} else if (result.kind === "custom") {
				this.statusText.setText(`♛ ${result.label}`);
				this.hintText.setText("A sovereign decree is sealed");
			}
			this.scene.time.delayedCall(700, () => {
				this.dismiss(true);
			});
		} else if (result === true) {
			this.scene.time.delayedCall(500, () => {
				this.dismiss(true);
			});
		} else {
			this.handleError("Could not understand. Choose below.");
		}
	}

	private handleError(msg: string) {
		if (this.isShuttingDown) return;
		this.ritualState = "idle";
		audio.sfx("fail");
		toast(this.scene, msg, COLORS.blood);
		this.drawMicrophoneGlyph(this.micGfx, COLORS.blood, 0.8);
		this.scene.tweens.add({
			targets: this.medallion,
			x: { from: -8, to: 8 },
			duration: 60,
			yoyo: true,
			repeat: 3,
			onComplete: () => this.dismiss(false),
		});
	}

	/** Smooth dismissal of the voice resonator ritual. */
	private dismiss(success: boolean) {
		if (this.ritualState === "dismissed") return;
		this.ritualState = "dismissed";

		if (!success) {
			this.opts.onCancel?.();
		}

		audio.setMusicSituation(this.prevMusicSituation);
		this.cleanupEvents();

		this.scene.tweens.add({
			targets: this.hub,
			scale: 0.85,
			alpha: 0,
			duration: 240,
			ease: "Cubic.in",
		});

		this.scene.tweens.add({
			targets: this.shade,
			alpha: 0,
			duration: 260,
			ease: "Cubic.in",
			onComplete: () => {
				this.destroy();
			},
		});
	}

	private handleShutdown() {
		this.isShuttingDown = true;
		if (this.recording) {
			void this.recording.stop();
		}
		this.cleanupEvents();
	}

	private cleanupEvents() {
		this.autoTimer?.remove();
		this.processingEllipsisTimer?.remove();
		this.scene.events.off(
			Phaser.Scenes.Events.UPDATE,
			this.updateAnimation,
			this,
		);
		this.scene.events.off(
			Phaser.Scenes.Events.SHUTDOWN,
			this.handleShutdown,
			this,
		);
	}

	// ---------------- Drawing Helpers ----------------

	private drawMedallionBase(g: Phaser.GameObjects.Graphics) {
		g.clear();
		const r = 58;

		// Deep velvet obsidian base
		g.fillStyle(COLORS.ink, 0.96);
		g.fillCircle(0, 0, r);

		// Outer gold rim
		g.lineStyle(3.5, COLORS.goldDeep, 1);
		g.strokeCircle(0, 0, r);

		// Inner high-carat gold ring
		g.lineStyle(2, COLORS.gold, 0.95);
		g.strokeCircle(0, 0, r - 4);

		// 24 astronomical perimeter bead dots
		for (let i = 0; i < 24; i++) {
			const a = (i * Math.PI * 2) / 24;
			const bx = Math.cos(a) * (r - 9);
			const by = Math.sin(a) * (r - 9);
			g.fillStyle(i % 6 === 0 ? COLORS.gold : COLORS.goldDeep, 0.7);
			g.fillCircle(bx, by, i % 6 === 0 ? 2 : 1.2);
		}
	}

	private drawMicrophoneGlyph(
		g: Phaser.GameObjects.Graphics,
		color: number,
		alpha: number,
	) {
		g.clear();

		const cy = -6;

		// 1. Microphone Capsule
		g.fillStyle(color, alpha);
		g.fillRoundedRect(-13, cy - 24, 26, 36, 12);

		// Capsule horizontal grille slats
		g.lineStyle(2, COLORS.ink, 0.85 * alpha);
		g.lineBetween(-9, cy - 16, 9, cy - 16);
		g.lineBetween(-11, cy - 9, 11, cy - 9);
		g.lineBetween(-9, cy - 2, 9, cy - 2);

		// Specular cylindrical highlight on left flank
		g.fillStyle(0xffffff, 0.35 * alpha);
		g.fillRoundedRect(-11, cy - 21, 3, 28, 1.5);

		// 2. U-shaped cradle bracket
		g.lineStyle(3, color, alpha);
		g.beginPath();
		g.arc(0, cy - 3, 20, 0.1 * Math.PI, 0.9 * Math.PI, false);
		g.strokePath();

		// Pivot bracket bolts
		g.fillStyle(color, alpha);
		g.fillCircle(-20, cy - 4, 3);
		g.fillCircle(20, cy - 4, 3);

		// 3. Central stem
		g.lineStyle(4, color, alpha);
		g.lineBetween(0, cy + 17, 0, cy + 28);

		// 4. Weighted tiered pedestal base
		g.fillStyle(color, alpha);
		g.fillRoundedRect(-18, cy + 28, 36, 6, 3);
		g.lineStyle(1.5, COLORS.goldDeep, alpha);
		g.strokeRoundedRect(-18, cy + 28, 36, 6, 3);
	}

	private drawStatusPlate(
		g: Phaser.GameObjects.Graphics,
		x: number,
		y: number,
		w: number,
		h: number,
	) {
		g.clear();
		const halfW = w / 2;
		const halfH = h / 2;

		// Dark velvet backdrop
		g.fillStyle(COLORS.ink, 0.92);
		g.fillRoundedRect(x - halfW, y - halfH, w, h, 14);

		// Double gold filigree border
		g.lineStyle(2.5, COLORS.goldDeep, 0.9);
		g.strokeRoundedRect(x - halfW, y - halfH, w, h, 14);
		g.lineStyle(1, COLORS.gold, 0.6);
		g.strokeRoundedRect(x - halfW + 4, y - halfH + 4, w - 8, h - 8, 10);

		// Corner ornamental flourishes
		const cornerSize = 8;
		g.fillStyle(COLORS.gold, 0.8);
		g.fillRect(x - halfW + 6, y - halfH + 6, cornerSize, 2);
		g.fillRect(x - halfW + 6, y - halfH + 6, 2, cornerSize);

		g.fillRect(x + halfW - 6 - cornerSize, y - halfH + 6, cornerSize, 2);
		g.fillRect(x + halfW - 8, y - halfH + 6, 2, cornerSize);

		g.fillRect(x - halfW + 6, y + halfH - 8, cornerSize, 2);
		g.fillRect(x - halfW + 6, y + halfH - 6 - cornerSize, 2, cornerSize);

		g.fillRect(x + halfW - 6 - cornerSize, y + halfH - 8, cornerSize, 2);
		g.fillRect(x + halfW - 8, y + halfH - 6 - cornerSize, 2, cornerSize);
	}

	// ---------------- Live Animation Loop ----------------

	private updateAnimation(_time: number, delta: number) {
		if (this.isShuttingDown || !this.scene) return;
		const dt = Math.min(delta / 1000, 0.1);

		// 1. Audio Level Smoothing (fast attack, smooth exponential decay)
		const rawLevel =
			this.recording && this.ritualState === "listening"
				? this.recording.level()
				: 0;
		if (rawLevel > this.smoothedLevel) {
			this.smoothedLevel +=
				(rawLevel - this.smoothedLevel) * Math.min(1, dt * 14);
		} else {
			this.smoothedLevel +=
				(rawLevel - this.smoothedLevel) * Math.min(1, dt * 5);
		}

		if (this.ritualState === "listening") {
			this.remainingSeconds = Math.max(0, this.remainingSeconds - dt);
		}

		// 2. Astrolabe rotations
		if (this.ritualState === "processing") {
			// Clockwork gear spin during royal deliberation
			this.astrolabeAngle += dt * 1.8;
			this.innerGearAngle -= dt * 2.4;
		} else {
			// Subtle celestial drift
			const driftSpeed = settings.reducedMotion ? 0.05 : 0.25;
			this.astrolabeAngle += dt * (driftSpeed + this.smoothedLevel * 0.4);
			this.innerGearAngle -= dt * (driftSpeed * 0.8 + this.smoothedLevel * 0.3);
		}

		this.wavePhase += dt * (2.5 + this.smoothedLevel * 8);
		this.ripplePhase =
			(this.ripplePhase + dt * (0.6 + this.smoothedLevel * 1.2)) % 1;

		// 3. Render Astrolabe Gear, Harmonic Acoustic Rays & Countdown Arc
		this.renderAstrolabeRays();

		// 4. Render Expanding Acoustic Ripples
		this.renderAcousticRipples();

		// 5. Render Live Equalizer in Status Plate
		this.renderEqualizer();

		// 6. Dynamic Medallion pulse with voice
		if (this.ritualState === "listening") {
			const s = 1 + this.smoothedLevel * 0.15;
			this.medallion.setScale(s);
			this.halo.setScale(1 + this.smoothedLevel * 0.5);
			this.halo.setAlpha(0.12 + this.smoothedLevel * 0.25);
		}
	}

	private renderAstrolabeRays() {
		const g = this.astrolabeGfx;
		g.clear();

		const numRays = 32;
		const innerR = 64;
		const baseOuterR = 86;
		const maxExtension = settings.reducedMotion ? 12 : 46;

		// Outer astronomical dial ring
		g.lineStyle(1.5, COLORS.gold, 0.4);
		g.strokeCircle(0, 0, 118);
		g.lineStyle(1, COLORS.goldDeep, 0.25);
		g.strokeCircle(0, 0, 126);

		// Countdown Timer Arc around the outer perimeter (r = 138)
		if (this.ritualState === "listening") {
			const frac = this.remainingSeconds / this.opts.maxSeconds;
			const isLow = frac < 0.25;
			g.lineStyle(2.5, isLow ? COLORS.blood : COLORS.gold, 0.7);
			g.beginPath();
			g.arc(0, 0, 138, -Math.PI / 2, -Math.PI / 2 + frac * Math.PI * 2, false);
			g.strokePath();

			// Subtle base track ring
			g.lineStyle(1, 0x000000, 0.4);
			g.strokeCircle(0, 0, 138);
		}

		// 36 Astrolabe perimeter degree ticks
		for (let i = 0; i < 36; i++) {
			const a = this.innerGearAngle + (i * Math.PI * 2) / 36;
			const isCardinal = i % 9 === 0;
			const isMajor = i % 3 === 0;
			const tickLen = isCardinal ? 10 : isMajor ? 6 : 3;
			const x1 = Math.cos(a) * 118;
			const y1 = Math.sin(a) * 118;
			const x2 = Math.cos(a) * (118 + tickLen);
			const y2 = Math.sin(a) * (118 + tickLen);

			g.lineStyle(
				isCardinal ? 2 : 1,
				isCardinal ? COLORS.gold : COLORS.goldDeep,
				isCardinal ? 0.9 : 0.45,
			);
			g.lineBetween(x1, y1, x2, y2);

			if (isCardinal) {
				// Cardinal diamond stud (◆)
				const dx = Math.cos(a) * 132;
				const dy = Math.sin(a) * 132;
				g.fillStyle(COLORS.gold, 0.85);
				g.fillCircle(dx, dy, 2.5);
			}
		}

		// Harmonic acoustic frequency sunburst rays
		for (let i = 0; i < numRays; i++) {
			const angle = this.astrolabeAngle + (i * Math.PI * 2) / numRays;
			// Simulated multi-harmonic frequency response
			const harmonic =
				0.5 * Math.sin(angle * 3 + this.wavePhase) +
				0.3 * Math.sin(angle * 5 - this.wavePhase * 1.3) +
				0.2 * Math.cos(angle * 2 + this.wavePhase * 0.7);

			const extra =
				Math.max(0, harmonic + 0.6) * this.smoothedLevel * maxExtension;
			const r1 = innerR + 3;
			const r2 = baseOuterR + extra;

			const x1 = Math.cos(angle) * r1;
			const y1 = Math.sin(angle) * r1;
			const x2 = Math.cos(angle) * r2;
			const y2 = Math.sin(angle) * r2;

			const isAccent = i % 4 === 0;
			const rayAlpha = Math.min(
				1,
				0.35 + this.smoothedLevel * 0.65 + (isAccent ? 0.2 : 0),
			);
			g.lineStyle(
				isAccent ? 2.5 : 1.5,
				isAccent ? COLORS.gold : COLORS.goldDeep,
				rayAlpha,
			);
			g.lineBetween(x1, y1, x2, y2);

			// Tip sparkle on peaks
			if (extra > 16 && isAccent) {
				g.fillStyle(COLORS.gold, 0.9);
				g.fillCircle(x2, y2, 2);
			}
		}
	}

	private renderAcousticRipples() {
		const g = this.ripplesGfx;
		g.clear();

		if (settings.reducedMotion) return;

		// 3 Concentric ripples emanating outward
		const rippleCount = 3;
		const minR = 64;
		const maxR = 158;

		for (let i = 0; i < rippleCount; i++) {
			const phase = (this.ripplePhase + i / rippleCount) % 1;
			const r = minR + phase * (maxR - minR);
			// Alpha decreases as ripple expands, intensified by smoothed voice level
			const baseAlpha = (1 - phase) * (0.15 + this.smoothedLevel * 0.55);

			if (baseAlpha > 0.02) {
				g.lineStyle(1.5, COLORS.gold, baseAlpha);
				g.strokeCircle(0, 0, r);
			}
		}
	}

	private renderEqualizer() {
		const g = this.equalizerGfx;
		g.clear();

		if (this.ritualState !== "listening") return;

		const numBars = 7;
		const barWidth = 3;
		const gap = 5;
		const totalW = numBars * barWidth + (numBars - 1) * gap;
		const startX = -totalW / 2;
		const baseY = 176 + 5;

		for (let i = 0; i < numBars; i++) {
			const x = startX + i * (barWidth + gap);
			const harmonic = Math.sin(this.wavePhase * 1.5 + i * 0.9);
			const h = 3 + this.smoothedLevel * 14 * (0.5 + 0.5 * Math.abs(harmonic));
			const alpha = 0.4 + this.smoothedLevel * 0.6;
			g.fillStyle(COLORS.gold, alpha);
			g.fillRoundedRect(x, baseY - h / 2, barWidth, h, 1.5);
		}
	}
}
