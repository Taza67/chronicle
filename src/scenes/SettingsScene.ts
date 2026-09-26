import Phaser from "phaser";
import { audio } from "../core/audio.ts";
import { saveGame, saveSettings, settings } from "../core/state.ts";
import { COLORS, FONT, H, hex, ui, W } from "../ui/theme.ts";
import { Button, fadeIn, go, heading, iconButton } from "../ui/widgets.ts";

/** Settings: subtitles, volumes, hourglass, reduced motion. Also an overlay when paused from the Court. */
export class SettingsScene extends Phaser.Scene {
	private back = "Title";
	private overlay = false;

	constructor() {
		super("Settings");
	}

	init(data: { back?: string; overlay?: boolean }) {
		this.back = data?.back ?? "Title";
		this.overlay = !!data?.overlay;
	}

	create() {
		if (!this.overlay) {
			fadeIn(this);
			this.add.rectangle(W / 2, H / 2, W, H, COLORS.night);
			const bg = this.add.image(W / 2, H / 2, "title_bg");
			bg.setScale(Math.max(W / bg.width, H / bg.height) * 1.1).setAlpha(0.18);
		} else {
			const shade = this.add
				.rectangle(W / 2, H / 2, W, H, COLORS.night, 0)
				.setInteractive();
			this.tweens.add({ targets: shade, fillAlpha: 0.82, duration: 250 });
		}
		heading(this, 80, "Settings", 40);
		iconButton(this, 60, 80, "‹", () => this.close());

		let y = 210;
		const row = (label: string, hint: string) => {
			this.add
				.text(48, y, label, {
					fontFamily: FONT.title,
					fontSize: "26px",
					color: hex(COLORS.text),
					fontStyle: "700",
				})
				.setOrigin(0, 0.5);
			this.add
				.text(48, y + 32, hint, ui(17, hex(COLORS.muted)))
				.setOrigin(0, 0.5);
			const cy = y;
			y += 120;
			return cy;
		};
		const toggle = (
			label: string,
			hint: string,
			get: () => boolean,
			set: (v: boolean) => void,
		) => {
			const cy = row(label, hint);
			const track = this.add
				.rectangle(W - 100, cy, 92, 44, get() ? COLORS.gold : 0x333344)
				.setInteractive({ useHandCursor: true });
			track.setStrokeStyle(2, COLORS.gold, 0.6);
			const knob = this.add.circle(
				W - 100 + (get() ? 24 : -24),
				cy,
				17,
				get() ? COLORS.night : COLORS.muted,
			);
			track.on("pointerup", () => {
				const v = !get();
				set(v);
				saveSettings();
				audio.sfx("card");
				this.tweens.add({
					targets: knob,
					x: W - 100 + (v ? 24 : -24),
					duration: 180,
					ease: "Back.out",
				});
				track.setFillStyle(v ? COLORS.gold : 0x333344);
				knob.setFillStyle(v ? COLORS.night : COLORS.muted);
			});
		};
		const slider = (
			label: string,
			hint: string,
			get: () => number,
			set: (v: number) => void,
		) => {
			const cy = row(label, hint);
			const x0 = W - 300;
			const w = 240;
			this.add.rectangle(x0, cy, w, 6, 0xffffff, 0.15).setOrigin(0, 0.5);
			const fill = this.add
				.rectangle(x0, cy, w * get(), 6, COLORS.gold)
				.setOrigin(0, 0.5);
			const knob = this.add.circle(x0 + w * get(), cy, 18, COLORS.parchment);
			knob.setStrokeStyle(3, COLORS.gold);
			const zone = this.add
				.rectangle(x0 + w / 2, cy, w + 60, 72, 0, 0)
				.setInteractive({ useHandCursor: true });
			const apply = (px: number) => {
				const v = Phaser.Math.Clamp((px - x0) / w, 0, 1);
				knob.x = x0 + w * v;
				fill.width = w * v;
				set(Math.round(v * 20) / 20);
				saveSettings();
			};
			let held = false;
			zone.on("pointerdown", (p: Phaser.Input.Pointer) => {
				held = true;
				apply(p.x);
			});
			this.input.on(
				Phaser.Input.Events.POINTER_MOVE,
				(p: Phaser.Input.Pointer) => {
					if (held && p.isDown) apply(p.x);
				},
			);
			this.input.on(Phaser.Input.Events.POINTER_UP, () => {
				held = false;
			});
		};

		toggle(
			"Subtitles",
			"Show what advisors say",
			() => settings.subtitles,
			(v) => (settings.subtitles = v),
		);
		slider(
			"Voices",
			"Advisors and narrator",
			() => settings.voiceVolume,
			(v) => (audio.voiceVolume = settings.voiceVolume = v),
		);
		slider(
			"Music",
			"Lyria court themes",
			() => settings.musicVolume,
			(v) => (audio.musicVolume = settings.musicVolume = v),
		);
		toggle(
			"Court hourglass",
			"10 seconds to decide, or an advisor decides for you",
			() => settings.timer,
			(v) => (settings.timer = v),
		);
		toggle(
			"Reduce motion",
			"Calmer animations, fewer particles",
			() => settings.reducedMotion,
			(v) => (settings.reducedMotion = v),
		);

		if (this.overlay) {
			new Button(this, W / 2, H - 260, "Return to court", () => this.close(), {
				w: 400,
			});
			new Button(this, W / 2, H - 160, "Abandon reign", () => this.abandon(), {
				w: 400,
				primary: false,
				size: 22,
			});
		} else {
			new Button(this, W / 2, H - 160, "Done", () => this.close(), { w: 320 });
		}
		this.add
			.text(
				W / 2,
				H - 60,
				"Chronicle · made for the Voodoo × Gradium × Cognition × DeepMind hackathon",
				ui(15, hex(COLORS.muted)),
			)
			.setOrigin(0.5)
			.setAlpha(0.7);
	}

	private close() {
		if (this.overlay) {
			this.scene.resume(this.back);
			this.scene.stop();
		} else go(this, this.back);
	}

	private abandon() {
		saveGame(null);
		this.scene.stop(this.back);
		this.scene.stop();
		this.scene.start("Title");
	}
}
