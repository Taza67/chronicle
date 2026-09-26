import Phaser from "phaser";
import { audio } from "./core/audio.ts";
import { settings } from "./core/state.ts";
import { BootScene } from "./scenes/BootScene.ts";
import { ChronicleScene } from "./scenes/ChronicleScene.ts";
import { CodexScene } from "./scenes/CodexScene.ts";
import { CourtScene } from "./scenes/CourtScene.ts";
import { SelectScene } from "./scenes/SelectScene.ts";
import { SettingsScene } from "./scenes/SettingsScene.ts";
import { SummonScene } from "./scenes/SummonScene.ts";
import { TitleScene } from "./scenes/TitleScene.ts";
import { VerdictScene } from "./scenes/VerdictScene.ts";
import { COLORS, H, W } from "./ui/theme.ts";

audio.musicVolume = settings.musicVolume;
audio.voiceVolume = settings.voiceVolume;

const game = new Phaser.Game({
	type: Phaser.AUTO,
	parent: "app",
	width: W,
	height: H,
	backgroundColor: COLORS.night,
	scale: {
		mode: Phaser.Scale.FIT,
		autoCenter: Phaser.Scale.CENTER_BOTH,
	},
	render: {
		antialias: true,
		roundPixels: false,
		powerPreference: "high-performance",
	},
	dom: { createContainer: true },
	input: { activePointers: 2 },
	scene: [
		BootScene,
		TitleScene,
		SelectScene,
		SummonScene,
		CourtScene,
		VerdictScene,
		CodexScene,
		ChronicleScene,
		SettingsScene,
	],
});

if (import.meta.env.DEV) (globalThis as { __game?: Phaser.Game }).__game = game;

// iOS: unlock audio on the first gesture anywhere.
const unlock = () => {
	audio.unlock();
	window.removeEventListener("pointerdown", unlock);
	window.removeEventListener("touchend", unlock);
};
window.addEventListener("pointerdown", unlock);
window.addEventListener("touchend", unlock);
