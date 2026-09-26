import { online, tts } from "./api.ts";
import { audio, type VoiceHandle } from "./audio.ts";

/** Silent "voice" for offline mode: fake amplitude so portraits still talk, timed by word count. */
function mimed(text: string): VoiceHandle {
	const words = text.trim().split(/\s+/).length;
	const duration = Math.max(1.2, words * 0.36 + 0.4);
	const t0 = performance.now();
	let stopped = false;
	let resolveDone: () => void = () => {};
	const done = new Promise<void>((r) => {
		resolveDone = r;
	});
	const timer = setTimeout(() => {
		stopped = true;
		resolveDone();
	}, duration * 1000);
	return {
		done,
		duration,
		level: () => {
			if (stopped) return 0;
			const t = (performance.now() - t0) / 1000;
			// syllable-ish pulse ~4.5 Hz with pauses every few words
			const pulse = Math.max(
				0,
				Math.sin(t * 28) * 0.6 + Math.sin(t * 9.3) * 0.3 + 0.35,
			);
			const pause = Math.sin(t * 1.9) > 0.85 ? 0 : 1;
			return pulse * pause;
		},
		shape: () => {
			if (stopped) return { amplitude: 0, openness: 0, sibilance: 0 };
			const t = (performance.now() - t0) / 1000;
			const pulse = Math.max(
				0,
				Math.sin(t * 28) * 0.6 + Math.sin(t * 9.3) * 0.3 + 0.35,
			);
			const pause = Math.sin(t * 1.9) > 0.85 ? 0 : 1;
			const amp = pulse * pause;
			return { amplitude: amp, openness: amp, sibilance: 0 };
		},
		stop: () => {
			clearTimeout(timer);
			stopped = true;
			resolveDone();
		},
	};
}

/** Prefetch TTS so the next line plays instantly. */
export function warm(text: string, voice: string, style?: string) {
	if (online()) void tts(text, voice, style).catch(() => {});
}

/** Speak a line with TTS (cached), falling back to a timed mime when offline/failing. */
export async function say(
	text: string,
	voice: string,
	style?: string,
	pan = 0,
): Promise<VoiceHandle> {
	if (online()) {
		try {
			const raw = await tts(text, voice, style);
			const buf = await audio.decode(raw);
			return audio.speak(buf, pan);
		} catch (e) {
			console.warn("tts failed", e);
		}
	}
	audio.stopVoice();
	return mimed(text);
}
