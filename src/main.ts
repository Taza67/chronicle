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
import {
	CANVAS_W,
	COLORS,
	computeViewportMetrics,
	H,
	LANDSCAPE,
	SAFE_BOTTOM,
	SAFE_TOP,
	updateThemeMetrics,
} from "./ui/theme.ts";
import { toast } from "./ui/widgets.ts";

audio.musicVolume = settings.musicVolume;
audio.voiceVolume = settings.voiceVolume;

const initialMetrics = computeViewportMetrics();
updateThemeMetrics(
	initialMetrics.height,
	initialMetrics.safeTop,
	initialMetrics.safeBottom,
	initialMetrics.canvasW,
	initialMetrics.landscape,
);

const game = new Phaser.Game({
	type: Phaser.AUTO,
	parent: "app",
	width: CANVAS_W,
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
		// needed so VerdictScene can toDataURL() the canvas for share PNGs
		preserveDrawingBuffer: true,
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

(globalThis as unknown as { __game?: Phaser.Game }).__game = game;

// PWA: register the service worker for the offline shell + asset cache.
// Production only — a dev-mode SWR cache would serve stale transformed
// modules and break hot reload. Inert on itch.io's third-party iframe.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
	window.addEventListener("load", () => {
		navigator.serviceWorker
			.register("./sw.js", { scope: "./" })
			.catch(() => {});
	});
}

// state.ts dispatches this once when a localStorage write hits quota — surface
// it on whichever scene is live instead of losing progress silently.
window.addEventListener("chronicle:storage-full", () => {
	const scene = game.scene.getScenes(true)[0];
	if (scene) toast(scene, "Storage is full — progress may not be saved.");
});

// api.ts dispatches this once when the worker rejects TTS auth — happens when
// APP_KEY is set server-side but VITE_APP_KEY is missing from the build.
window.addEventListener("chronicle:tts-denied", () => {
	const scene = game.scene.getScenes(true)[0];
	if (scene)
		toast(scene, "Voice service denied the app key — speech is mimed.");
});

const bootedAt = performance.now();
const handleResize = () => {
	const metrics = computeViewportMetrics();
	const sizeChanged = metrics.height !== H || metrics.canvasW !== CANVAS_W;
	const safeChanged =
		metrics.safeTop !== SAFE_TOP || metrics.safeBottom !== SAFE_BOTTOM;
	if (!sizeChanged && !safeChanged) return;
	const prevH = H;
	const wasLandscape = LANDSCAPE;
	updateThemeMetrics(
		metrics.height,
		metrics.safeTop,
		metrics.safeBottom,
		metrics.canvasW,
		metrics.landscape,
	);
	if (sizeChanged) game.scale.setGameSize(CANVAS_W, metrics.height);
	// FIT recomputes the canvas display size against the ScaleManager's cached
	// parent bounds — which lag one resize behind when the viewport grows back
	// (portrait→landscape leaves the canvas shrunk at its old CSS size).
	// Refresh once now and once after layout settles.
	game.scale.refresh();
	requestAnimationFrame(() => game.scale.refresh());
	// Scene objects never re-anchor — restart the visible scenes so they
	// rebuild against the new H/safe areas. Small deltas (mobile URL bar
	// collapse, ~8%) only resize the canvas: a mid-turn restart would be
	// worse than the bottom gap they leave.
	const structural =
		(Math.abs(metrics.height - prevH) / prevH > 0.2 ||
			safeChanged ||
			metrics.landscape !== wasLandscape) &&
		performance.now() - bootedAt > 400;
	if (!structural) return;
	for (const scene of game.scene.scenes) {
		const key = scene.scene.key;
		// Summon holds typed DOM input — its centered layout degrades
		// gracefully, keep it alive.
		if (key === "Boot" || key === "Summon") continue;
		if (scene.sys.isActive()) scene.scene.restart();
	}
};
window.addEventListener("resize", handleResize);
window.addEventListener("orientationchange", handleResize);

// iOS: unlock audio on the first gesture anywhere.
const unlock = () => {
	audio.unlock();
	window.removeEventListener("pointerdown", unlock);
	window.removeEventListener("touchend", unlock);
};
window.addEventListener("pointerdown", unlock);
window.addEventListener("touchend", unlock);

// Fullscreen re-entry button: browsers drop fullscreen when the mic permission
// prompt appears, so offer a way back whenever fullscreen is available but inactive.
const fsBtn = document.getElementById("fs-btn");
const fullscreenSupported =
	typeof document.documentElement.requestFullscreen === "function" &&
	document.fullscreenEnabled;
const isStandalone =
	window.matchMedia("(display-mode: fullscreen)").matches ||
	window.matchMedia("(display-mode: standalone)").matches;
const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
if (fsBtn && fullscreenSupported && isTouchDevice && !isStandalone) {
	const syncFsBtn = () => {
		fsBtn.classList.toggle("visible", !document.fullscreenElement);
	};
	fsBtn.addEventListener("click", () => {
		document.documentElement
			.requestFullscreen({ navigationUI: "hide" })
			.then(() => handleResize())
			.catch(() => {});
	});
	document.addEventListener("fullscreenchange", () => {
		syncFsBtn();
		handleResize();
	});
	syncFsBtn();

	// Top-right is the gear on Title/Court, so park the button top-left there.
	const placeFsBtn = (sceneKey: string) => {
		fsBtn.classList.toggle("fs-btn--left", sceneKey === "Title");
		fsBtn.classList.toggle("fs-btn--left-inner", sceneKey === "Court");
	};
	game.events.once(Phaser.Core.Events.READY, () => {
		for (const scene of game.scene.scenes) {
			const key = scene.scene.key;
			if (key === "Boot") continue;
			scene.events.on(Phaser.Scenes.Events.START, () => placeFsBtn(key));
			scene.events.on(Phaser.Scenes.Events.WAKE, () => placeFsBtn(key));
			scene.events.on(Phaser.Scenes.Events.RESUME, () => placeFsBtn(key));
		}
	});
}
