import { encodeWav, micSupported } from "./recorder.ts";

export interface VADOptions {
	/** Volume threshold (0..1) to detect speech onset. Defaults to 0.12. */
	speechThreshold?: number;
	/** Milliseconds of silence after speech required to finalize utterance. Defaults to 800. */
	silenceDurationMs?: number;
	/** Maximum speech duration in milliseconds. Defaults to 8000. */
	maxDurationMs?: number;
	/** Minimum speech duration in milliseconds to filter out transient pops/clicks. Defaults to 400. */
	minDurationMs?: number;
	/** Callback fired when speech onset is detected. */
	onSpeechStart?: () => void;
	/** Callback with live volume level (0..1). */
	onLevel?: (level: number) => void;
	/** Callback fired when natural silence follows speech, delivering WAV blob. */
	onSpeechEnd?: (blob: Blob) => void;
	/** Error handler. */
	onError?: (err: unknown) => void;
}

/**
 * Hands-free Voice Activity Detector (VAD):
 * Runs in the background of the court council. Captures sovereign speech automatically
 * using pre-roll buffering, energy thresholding, and silence detection.
 */
export class VoiceActivityDetector {
	private stream: MediaStream | null = null;
	private ctx: AudioContext | null = null;
	private src: MediaStreamAudioSourceNode | null = null;
	private proc: ScriptProcessorNode | null = null;

	private state: "idle" | "speaking" | "paused" | "stopped" = "stopped";
	private preRoll: Float32Array[] = [];
	private speechChunks: Float32Array[] = [];

	private silenceTimeMs = 0;
	private speechTimeMs = 0;
	private consecutiveSpeechFrames = 0;
	private currentLevel = 0;

	private readonly speechThreshold: number;
	private readonly silenceDurationMs: number;
	private readonly maxDurationMs: number;
	private readonly minDurationMs: number;

	private readonly onSpeechStart?: () => void;
	private readonly onLevel?: (level: number) => void;
	private readonly onSpeechEnd?: (blob: Blob) => void;
	private readonly onError?: (err: unknown) => void;

	constructor(opts: VADOptions = {}) {
		this.speechThreshold = opts.speechThreshold ?? 0.12;
		this.silenceDurationMs = opts.silenceDurationMs ?? 800;
		this.maxDurationMs = opts.maxDurationMs ?? 8000;
		this.minDurationMs = opts.minDurationMs ?? 400;

		this.onSpeechStart = opts.onSpeechStart;
		this.onLevel = opts.onLevel;
		this.onSpeechEnd = opts.onSpeechEnd;
		this.onError = opts.onError;
	}

	get isActive(): boolean {
		return this.state !== "stopped";
	}

	get isSpeaking(): boolean {
		return this.state === "speaking";
	}

	get level(): number {
		return this.currentLevel;
	}

	/** Start listening passively for sovereign speech in the council. */
	async start(): Promise<boolean> {
		if (this.isActive || !micSupported()) return false;

		try {
			this.stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			});

			this.ctx = new AudioContext();
			this.src = this.ctx.createMediaStreamSource(this.stream);
			// 4096 samples ≈ 85ms buffer at 48kHz
			this.proc = this.ctx.createScriptProcessor(4096, 1, 1);

			this.proc.onaudioprocess = (e) => this.handleAudioProcess(e);

			this.src.connect(this.proc);
			this.proc.connect(this.ctx.destination);

			this.state = "idle";
			this.preRoll = [];
			this.speechChunks = [];
			this.consecutiveSpeechFrames = 0;
			return true;
		} catch (err) {
			this.onError?.(err);
			this.stop();
			return false;
		}
	}

	/** Temporarily pause VAD (e.g. while processing or advisor speaks). */
	pause() {
		if (this.state === "speaking") {
			this.finalizeSpeech(false);
		}
		if (this.state === "idle") {
			this.state = "paused";
		}
	}

	/** Resume passive listening for speech. */
	resume() {
		if (this.state === "paused") {
			this.state = "idle";
			this.preRoll = [];
			this.speechChunks = [];
			this.silenceTimeMs = 0;
			this.speechTimeMs = 0;
			this.consecutiveSpeechFrames = 0;
		}
	}

	/** Completely stop the VAD listener and release microphone hardware. */
	stop() {
		this.state = "stopped";
		if (this.proc) {
			try {
				this.proc.disconnect();
			} catch {
				/* noop */
			}
			this.proc = null;
		}
		if (this.src) {
			try {
				this.src.disconnect();
			} catch {
				/* noop */
			}
			this.src = null;
		}
		if (this.stream) {
			for (const track of this.stream.getTracks()) track.stop();
			this.stream = null;
		}
		if (this.ctx) {
			void this.ctx.close();
			this.ctx = null;
		}
		this.preRoll = [];
		this.speechChunks = [];
		this.currentLevel = 0;
	}

	private handleAudioProcess(e: AudioProcessingEvent) {
		if (this.state === "stopped" || this.state === "paused") return;

		const d = e.inputBuffer.getChannelData(0);
		const copy = new Float32Array(d);

		// Compute RMS level
		let s = 0;
		for (let i = 0; i < d.length; i += 8) s += d[i] * d[i];
		const rawLevel = Math.min(1, Math.sqrt(s / (d.length / 8)) * 6);
		this.currentLevel = rawLevel;
		this.onLevel?.(rawLevel);

		const frameDurationMs = (d.length / e.inputBuffer.sampleRate) * 1000;

		if (this.state === "idle") {
			// Maintain rolling pre-roll buffer (~340ms)
			this.preRoll.push(copy);
			if (this.preRoll.length > 4) this.preRoll.shift();

			if (rawLevel >= this.speechThreshold) {
				this.consecutiveSpeechFrames++;
				if (this.consecutiveSpeechFrames >= 2) {
					// Speech detected!
					this.state = "speaking";
					this.speechTimeMs = 0;
					this.silenceTimeMs = 0;
					this.speechChunks = [...this.preRoll, copy];
					this.preRoll = [];
					this.onSpeechStart?.();
				}
			} else {
				this.consecutiveSpeechFrames = 0;
			}
		} else if (this.state === "speaking") {
			this.speechChunks.push(copy);
			this.speechTimeMs += frameDurationMs;

			if (rawLevel < this.speechThreshold) {
				this.silenceTimeMs += frameDurationMs;
			} else {
				this.silenceTimeMs = 0;
			}

			// End of speech: natural pause detected or max duration reached
			const silenceElapsed = this.silenceTimeMs >= this.silenceDurationMs;
			const maxDurationReached = this.speechTimeMs >= this.maxDurationMs;

			if (silenceElapsed || maxDurationReached) {
				this.finalizeSpeech(true);
			}
		}
	}

	private finalizeSpeech(dispatch: boolean) {
		if (this.state !== "speaking") return;
		const chunks = this.speechChunks;
		const duration = this.speechTimeMs;
		const sampleRate = this.ctx?.sampleRate ?? 44100;

		this.state = "idle";
		this.speechChunks = [];
		this.speechTimeMs = 0;
		this.silenceTimeMs = 0;
		this.consecutiveSpeechFrames = 0;
		this.preRoll = [];

		if (dispatch && duration >= this.minDurationMs && chunks.length > 0) {
			const blob = encodeWav(chunks, sampleRate);
			this.onSpeechEnd?.(blob);
		}
	}
}
