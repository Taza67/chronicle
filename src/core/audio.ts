/** Web Audio engine: voice playback with amplitude analysis (lip-sync), ducked music, synthesized SFX. */

export type MusicSituation =
	| "normal"
	| "tension"
	| "crisis"
	| "oracle"
	| "triumph"
	| "collapse";

export type CourtAcoustics =
	| "cathedral"
	| "palace_hall"
	| "chamber"
	| "stone_temple"
	| "none";

export interface SpeechShape {
	amplitude: number; // 0..1 overall smoothed loudness
	openness: number; // 0..1 low-mid frequencies (vowels, jaw drop)
	sibilance: number; // 0..1 high frequencies (sibilants, lip compression)
}

export interface VoiceHandle {
	done: Promise<void>;
	/** 0..1 smoothed loudness, polled every frame by portraits. */
	level(): number;
	shape(): SpeechShape;
	stop(): void;
	duration: number;
}

class AudioEngine {
	private ctx: AudioContext | null = null;
	private master!: GainNode;
	private musicGain!: GainNode;
	private musicFilter!: BiquadFilterNode;
	private currentSituation: MusicSituation = "normal";
	private situationVolumeFactor = 1.0;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private voiceGain!: GainNode;
	private voiceDryGain!: GainNode;
	private voiceWetGain!: GainNode;
	private voiceConvolver!: ConvolverNode;
	private courtAcoustics: CourtAcoustics = "palace_hall";
	private courtWetLevel = 0.18;
	private impulseCache = new Map<CourtAcoustics, AudioBuffer>();
	private roomPresenceNode: AudioBufferSourceNode | null = null;
	private roomPresenceGain!: GainNode;
	private presenceCache = new Map<CourtAcoustics, AudioBuffer>();
	private sfxGain!: GainNode;
	private analyser!: AnalyserNode;
	private data!: Uint8Array<ArrayBuffer>;
	private smoothed = 0;
	private smoothedOpenness = 0;
	private smoothedSibilance = 0;
	private current: AudioBufferSourceNode | null = null;
	private music: {
		src: AudioBufferSourceNode;
		gain: GainNode;
		id: string;
	} | null = null;
	private musicLoadingId: string | null = null;
	private musicBuffers = new Map<string, AudioBuffer>();
	musicVolume = 0.6;
	voiceVolume = 1;

	get unlocked() {
		return this.ctx !== null && this.ctx.state === "running";
	}

	/** Must be called from a user gesture (iOS). */
	unlock() {
		if (!this.ctx) {
			this.ctx = new AudioContext();
			this.master = this.ctx.createGain();
			this.master.connect(this.ctx.destination);
			this.musicFilter = this.ctx.createBiquadFilter();
			this.musicFilter.type = "lowpass";
			this.musicFilter.frequency.value = 20000;
			this.musicFilter.Q.value = 1.0;
			this.musicGain = this.ctx.createGain();
			this.musicGain.gain.value = this.musicVolume;
			this.musicFilter.connect(this.musicGain);
			this.musicGain.connect(this.master);
			this.sfxGain = this.ctx.createGain();
			this.sfxGain.gain.value = 0.5;
			this.sfxGain.connect(this.master);

			// Voice chain: dry & wet paths through procedural court convolver
			this.voiceGain = this.ctx.createGain();
			this.voiceGain.gain.value = this.voiceVolume;

			this.analyser = this.ctx.createAnalyser();
			this.analyser.fftSize = 512;
			this.analyser.smoothingTimeConstant = 0.4;
			this.data = new Uint8Array(this.analyser.frequencyBinCount);
			this.voiceGain.connect(this.analyser);

			this.voiceDryGain = this.ctx.createGain();
			this.voiceDryGain.gain.value = Math.max(0, 1.0 - this.courtWetLevel);
			this.voiceDryGain.connect(this.master);

			this.voiceConvolver = this.ctx.createConvolver();
			this.voiceConvolver.normalize = true;

			this.voiceWetGain = this.ctx.createGain();
			this.voiceWetGain.gain.value = this.courtWetLevel;
			this.voiceWetGain.connect(this.master);

			this.voiceGain.connect(this.voiceDryGain);
			this.voiceGain.connect(this.voiceConvolver);
			this.voiceConvolver.connect(this.voiceWetGain);

			// Subtle room presence ambience bus
			this.roomPresenceGain = this.ctx.createGain();
			this.roomPresenceGain.gain.value = 0.04;
			this.roomPresenceGain.connect(this.master);

			this.applyCourtAcoustics(this.courtAcoustics, this.courtWetLevel);
		}
		if (this.ctx.state === "suspended") void this.ctx.resume();
	}

	/**
	 * Configure court acoustics reverb response (cathedral, palace_hall, chamber, stone_temple, none).
	 * Adjusts wet/dry balance and procedural convolution impulse.
	 */
	setCourtAcoustics(type: CourtAcoustics, wetLevel = 0.18) {
		this.courtAcoustics = type;
		this.courtWetLevel = wetLevel;
		if (this.ctx && this.voiceConvolver) {
			this.applyCourtAcoustics(type, wetLevel);
		}
	}

	getCourtAcoustics(): CourtAcoustics {
		return this.courtAcoustics;
	}

	private applyCourtAcoustics(type: CourtAcoustics, wetLevel: number) {
		if (
			!this.ctx ||
			!this.voiceConvolver ||
			!this.voiceWetGain ||
			!this.voiceDryGain
		)
			return;

		if (type === "none") {
			this.voiceWetGain.gain.value = 0;
			this.voiceDryGain.gain.value = 1.0;
			this.updateRoomPresence("none");
			return;
		}

		let buf: AudioBuffer | null = this.impulseCache.get(type) ?? null;
		if (!buf) {
			buf = this.generateImpulse(type);
			if (buf) this.impulseCache.set(type, buf);
		}
		if (buf) {
			this.voiceConvolver.buffer = buf;
			this.voiceWetGain.gain.value = wetLevel;
			this.voiceDryGain.gain.value = Math.max(0, 1.0 - wetLevel);
		}
		this.updateRoomPresence(type);
	}

	private generateRoomPresence(type: CourtAcoustics): AudioBuffer | null {
		if (!this.ctx || type === "none") return null;
		const rate = this.ctx.sampleRate;
		const length = Math.floor(rate * 3.5);
		const buf = this.ctx.createBuffer(2, length, rate);
		const left = buf.getChannelData(0);
		const right = buf.getChannelData(1);

		const cutoff =
			type === "stone_temple"
				? 85
				: type === "palace_hall"
					? 150
					: type === "cathedral"
						? 110
						: 220;
		const rc = 1 / (2 * Math.PI * cutoff);
		const dt = 1 / rate;
		const alpha = dt / (rc + dt);

		let prevL = 0;
		let prevR = 0;
		for (let i = 0; i < length; i++) {
			const nL = Math.random() * 2 - 1;
			const nR = Math.random() * 2 - 1;
			prevL = prevL + alpha * (nL - prevL);
			prevR = prevR + alpha * (nR - prevR);
			const edge = Math.min(1, Math.min(i, length - i) / (rate * 0.15));
			left[i] = prevL * edge * 0.045;
			right[i] = prevR * edge * 0.045;
		}
		return buf;
	}

	private updateRoomPresence(type: CourtAcoustics) {
		if (!this.ctx || !this.roomPresenceGain) return;
		if (type === "none") {
			if (this.roomPresenceNode) {
				try {
					this.roomPresenceGain.gain.setTargetAtTime(
						0,
						this.ctx.currentTime,
						0.4,
					);
				} catch {
					/* noop */
				}
			}
			return;
		}
		let pBuf = this.presenceCache.get(type);
		if (!pBuf) {
			pBuf = this.generateRoomPresence(type) ?? undefined;
			if (pBuf) this.presenceCache.set(type, pBuf);
		}
		if (!pBuf) return;

		if (this.roomPresenceNode) {
			try {
				this.roomPresenceNode.stop();
				this.roomPresenceNode.disconnect();
			} catch {
				/* noop */
			}
			this.roomPresenceNode = null;
		}

		const src = this.ctx.createBufferSource();
		src.buffer = pBuf;
		src.loop = true;
		src.connect(this.roomPresenceGain);
		this.roomPresenceGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
		this.roomPresenceGain.gain.setTargetAtTime(
			0.045,
			this.ctx.currentTime,
			0.6,
		);
		src.start();
		this.roomPresenceNode = src;
	}

	/**
	 * Synthesizes stereo noise impulse response with exponential decay and high-frequency damping.
	 */
	private generateImpulse(type: CourtAcoustics): AudioBuffer | null {
		if (!this.ctx || type === "none") return null;

		const presets: Record<
			Exclude<CourtAcoustics, "none">,
			{ duration: number; decay: number; damping: number }
		> = {
			cathedral: { duration: 2.8, decay: 3.0, damping: 0.25 },
			palace_hall: { duration: 1.8, decay: 2.4, damping: 0.35 },
			chamber: { duration: 0.6, decay: 1.4, damping: 0.55 },
			stone_temple: { duration: 2.2, decay: 2.2, damping: 0.2 },
		};

		const cfg = presets[type];
		if (!cfg) return null;

		const sampleRate = this.ctx.sampleRate;
		const length = Math.floor(sampleRate * cfg.duration);
		const impulse = this.ctx.createBuffer(2, length, sampleRate);
		const left = impulse.getChannelData(0);
		const right = impulse.getChannelData(1);

		let prevL = 0;
		let prevR = 0;
		for (let i = 0; i < length; i++) {
			const t = i / length;
			// Exponential decay envelope
			const env = (1 - t) ** cfg.decay;
			// High-frequency damping: progressive roll-off across tail
			const d = Math.min(0.96, cfg.damping + t * (1 - cfg.damping) * 0.4);
			const noiseL = Math.random() * 2 - 1;
			const noiseR = Math.random() * 2 - 1;
			prevL = prevL * d + noiseL * (1 - d);
			prevR = prevR * d + noiseR * (1 - d);
			left[i] = prevL * env;
			right[i] = prevR * env;
		}

		return impulse;
	}

	setMusicVolume(v: number) {
		this.musicVolume = v;
		if (this.musicGain && !this.current) {
			this.musicGain.gain.value = v * this.situationVolumeFactor;
		}
	}

	setVoiceVolume(v: number) {
		this.voiceVolume = v;
		if (this.voiceGain) this.voiceGain.gain.value = v;
	}

	async decode(buf: ArrayBuffer): Promise<AudioBuffer> {
		this.unlock();
		return this.ctx!.decodeAudioData(buf.slice(0));
	}

	/** Plays a voice clip with optional stereo panning, ducking the music while it speaks. */
	speak(buffer: AudioBuffer, pan = 0): VoiceHandle {
		this.unlock();
		const ctx = this.ctx!;
		this.stopVoice();
		const src = ctx.createBufferSource();
		src.buffer = buffer;

		if (pan !== 0 && typeof ctx.createStereoPanner === "function") {
			const panner = ctx.createStereoPanner();
			panner.pan.value = Math.max(-1, Math.min(1, pan));
			src.connect(panner);
			panner.connect(this.voiceGain);
		} else {
			src.connect(this.voiceGain);
		}

		this.current = src;
		this.duck(true);
		let ended = false;
		let safetyTimer: ReturnType<typeof setTimeout> | null = null;
		const done = new Promise<void>((resolve) => {
			const finish = () => {
				if (ended) return;
				ended = true;
				if (safetyTimer) clearTimeout(safetyTimer);
				if (this.current === src) {
					this.current = null;
					this.duck(false);
				}
				this.smoothed = 0;
				this.smoothedOpenness = 0;
				this.smoothedSibilance = 0;
				try {
					src.disconnect();
				} catch {
					/* noop */
				}
				resolve();
			};
			src.onended = finish;
			// Safety timer: if AudioContext is suspended or onended fails to trigger,
			// automatically release the promise after audio duration so the game NEVER hangs.
			safetyTimer = setTimeout(finish, (buffer.duration + 0.6) * 1000);
		});
		src.start();
		return {
			done,
			duration: buffer.duration,
			level: () => (ended ? 0 : this.readLevel()),
			shape: () =>
				ended ? { amplitude: 0, openness: 0, sibilance: 0 } : this.readShape(),
			stop: () => {
				try {
					src.stop();
				} catch {
					/* already stopped */
				}
			},
		};
	}

	stopVoice() {
		if (this.current) {
			try {
				this.current.stop();
				this.current.disconnect();
			} catch {
				/* noop */
			}
			this.current = null;
			this.duck(false);
		}
		this.smoothed = 0;
		this.smoothedOpenness = 0;
		this.smoothedSibilance = 0;
	}

	private readLevel(): number {
		this.analyser.getByteFrequencyData(this.data);
		// speech energy lives roughly in bins 2..40 (≈ 200 Hz – 4 kHz at 48k/512)
		let sum = 0;
		const n = 40;
		for (let i = 2; i < n + 2; i++) sum += this.data[i];
		const raw = Math.min(1, (sum / n / 255) * 2.2);
		this.smoothed +=
			(raw - this.smoothed) * (raw > this.smoothed ? 0.55 : 0.25);
		return this.smoothed;
	}

	private readShape(): SpeechShape {
		const amp = this.readLevel();
		if (!this.analyser || amp < 0.01) {
			this.smoothedOpenness += (0 - this.smoothedOpenness) * 0.25;
			this.smoothedSibilance += (0 - this.smoothedSibilance) * 0.25;
			return {
				amplitude: amp,
				openness: Math.max(0, this.smoothedOpenness),
				sibilance: Math.max(0, this.smoothedSibilance),
			};
		}

		const binHz = (this.ctx?.sampleRate ?? 48000) / this.analyser.fftSize;

		// Low-mid frequencies (~300 - 1400 Hz) for vowel openness (jaw drop)
		const openLow = Math.max(1, Math.floor(300 / binHz));
		const openHigh = Math.min(this.data.length - 1, Math.ceil(1400 / binHz));
		let openSum = 0;
		for (let i = openLow; i <= openHigh; i++) {
			openSum += this.data[i];
		}
		const openCount = Math.max(1, openHigh - openLow + 1);
		const rawOpen = Math.min(1, (openSum / openCount / 255) * 2.5);

		// High frequencies (~2500 - 6000 Hz) for sibilants (lip compression)
		const sibLow = Math.max(1, Math.floor(2500 / binHz));
		const sibHigh = Math.min(this.data.length - 1, Math.ceil(6000 / binHz));
		let sibSum = 0;
		for (let i = sibLow; i <= sibHigh; i++) {
			sibSum += this.data[i];
		}
		const sibCount = Math.max(1, sibHigh - sibLow + 1);
		const rawSib = Math.min(1, (sibSum / sibCount / 255) * 3.2);

		this.smoothedOpenness +=
			(rawOpen - this.smoothedOpenness) *
			(rawOpen > this.smoothedOpenness ? 0.6 : 0.3);
		this.smoothedSibilance +=
			(rawSib - this.smoothedSibilance) *
			(rawSib > this.smoothedSibilance ? 0.6 : 0.3);

		return {
			amplitude: amp,
			openness: this.smoothedOpenness,
			sibilance: this.smoothedSibilance,
		};
	}

	/** Duck or restore music volume (e.g. while speech or recording is active). */
	duck(on: boolean) {
		if (!this.musicGain) return;
		const t = this.ctx!.currentTime;
		this.musicGain.gain.cancelScheduledValues(t);
		const base = this.musicVolume * this.situationVolumeFactor;
		this.musicGain.gain.setTargetAtTime(
			on ? base * 0.35 : base,
			t,
			on ? 0.15 : 0.8,
		);
	}

	/** Adjust background music acoustics & tension dynamically based on gameplay situation. */
	setMusicSituation(situation: MusicSituation, smoothTime = 1.0) {
		this.currentSituation = situation;
		if (!this.ctx || !this.musicFilter) return;

		let cutoff = 20000;
		let q = 1.0;
		let volFactor = 1.0;

		switch (situation) {
			case "normal":
				cutoff = 20000;
				q = 1.0;
				volFactor = 1.0;
				break;
			case "tension":
				cutoff = 3000;
				q = 2.2;
				volFactor = 0.95;
				break;
			case "crisis":
				cutoff = 680;
				q = 3.6;
				volFactor = 0.82;
				break;
			case "oracle":
				cutoff = 850;
				q = 3.2;
				volFactor = 0.42;
				break;
			case "triumph":
				cutoff = 20000;
				q = 1.0;
				volFactor = 1.05;
				break;
			case "collapse":
				cutoff = 320;
				q = 4.0;
				volFactor = 0.45;
				break;
		}

		this.situationVolumeFactor = volFactor;
		const t = this.ctx.currentTime;

		this.musicFilter.frequency.cancelScheduledValues(t);
		this.musicFilter.frequency.setTargetAtTime(cutoff, t, smoothTime * 0.5);

		this.musicFilter.Q.cancelScheduledValues(t);
		this.musicFilter.Q.setTargetAtTime(q, t, smoothTime * 0.5);

		if (!this.current && this.musicGain) {
			this.musicGain.gain.cancelScheduledValues(t);
			this.musicGain.gain.setTargetAtTime(
				this.musicVolume * volFactor,
				t,
				smoothTime * 0.5,
			);
		}

		if (this.music?.src) {
			const rate = this.situationRate(situation);
			this.music.src.playbackRate.cancelScheduledValues(t);
			this.music.src.playbackRate.setTargetAtTime(rate, t, smoothTime * 0.7);
		}

		// Crisis heartbeat pulse
		if (situation === "crisis") {
			if (!this.heartbeatTimer) {
				const beat = () => {
					if (this.currentSituation !== "crisis") return;
					// Low ominous heart double-pulse
					this.tone(52, 0.12, "sine", 0.32, 0.8);
					this.tone(42, 0.16, "sine", 0.22, 0.75, 0.18);
				};
				beat();
				this.heartbeatTimer = setInterval(beat, 950);
			}
		} else if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	}

	getMusicSituation(): MusicSituation {
		return this.currentSituation;
	}

	private situationRate(s: MusicSituation): number {
		switch (s) {
			case "tension":
				return 1.02;
			case "crisis":
				return 0.96;
			case "oracle":
				return 0.98;
			case "collapse":
				return 0.78;
			default:
				return 1.0;
		}
	}

	async playMusic(id: string, load: () => Promise<ArrayBuffer | null>) {
		if (this.music?.id === id || this.musicLoadingId === id) return;
		this.musicLoadingId = id;
		this.unlock();
		let buf = this.musicBuffers.get(id);
		if (!buf) {
			const raw = await load();
			if (this.musicLoadingId !== id) return;
			if (!raw) {
				this.musicLoadingId = null;
				return;
			}
			try {
				buf = await this.decode(raw);
			} catch (e) {
				console.warn("music decode failed", id, e);
				if (this.musicLoadingId === id) this.musicLoadingId = null;
				return;
			}
			if (this.musicLoadingId !== id) return;
			this.musicBuffers.set(id, buf);
		}
		if (this.musicLoadingId !== id) return;
		if (this.music?.id === id) return;
		this.stopMusic(1.5);
		const ctx = this.ctx!;
		const src = ctx.createBufferSource();
		src.buffer = buf;
		src.loop = true;
		const gain = ctx.createGain();
		gain.gain.value = 0;
		src.connect(gain);
		gain.connect(this.musicFilter);
		src.start();
		gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 2);
		this.music = { src, gain, id };
		this.musicLoadingId = null;

		// Apply current situation rate to the new track
		const rate = this.situationRate(this.currentSituation);
		src.playbackRate.setValueAtTime(rate, ctx.currentTime);
	}

	stopMusic(fade = 1) {
		this.musicLoadingId = null;
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
		if (!this.music) return;
		const { src, gain } = this.music;
		const t = this.ctx!.currentTime;
		gain.gain.cancelScheduledValues(t);
		gain.gain.setValueAtTime(gain.gain.value, t);
		gain.gain.linearRampToValueAtTime(0, t + fade);
		src.stop(t + fade + 0.05);
		src.onended = () => {
			try {
				src.disconnect();
				gain.disconnect();
			} catch {
				/* noop */
			}
		};
		this.music = null;
	}

	// ---- synthesized SFX (no asset downloads, instant) ----
	private tone(
		freq: number,
		dur: number,
		type: OscillatorType,
		vol = 0.4,
		slide = 1,
		delay = 0,
	) {
		if (!this.ctx) return;
		const ctx = this.ctx;
		const t0 = ctx.currentTime + delay;
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		osc.type = type;
		osc.frequency.setValueAtTime(freq, t0);
		osc.frequency.exponentialRampToValueAtTime(
			Math.max(20, freq * slide),
			t0 + dur,
		);
		g.gain.setValueAtTime(0.0001, t0);
		g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
		g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
		osc.connect(g);
		g.connect(this.sfxGain);
		osc.onended = () => {
			try {
				osc.disconnect();
				g.disconnect();
			} catch {
				/* noop */
			}
		};
		osc.start(t0);
		osc.stop(t0 + dur + 0.02);
	}

	private noise(dur: number, vol = 0.3, delay = 0, lp = 1200) {
		if (!this.ctx) return;
		const ctx = this.ctx;
		const t0 = ctx.currentTime + delay;
		const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < d.length; i++)
			d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
		const src = ctx.createBufferSource();
		src.buffer = buf;
		const f = ctx.createBiquadFilter();
		f.type = "lowpass";
		f.frequency.value = lp;
		const g = ctx.createGain();
		g.gain.value = vol;
		src.connect(f);
		f.connect(g);
		g.connect(this.sfxGain);
		src.onended = () => {
			try {
				src.disconnect();
				f.disconnect();
				g.disconnect();
			} catch {
				/* noop */
			}
		};
		src.start(t0);
		src.stop(t0 + dur);
	}

	sfx(
		name:
			| "tap"
			| "card"
			| "coin"
			| "up"
			| "down"
			| "reveal"
			| "drum"
			| "fanfare"
			| "tick"
			| "heart"
			| "whoosh"
			| "chime"
			| "fail"
			| "oracle_open"
			| "coin_toss"
			| "coin_land"
			| "gavel"
			| "seal_break"
			| "relic",
	) {
		switch (name) {
			case "tap":
				this.tone(660, 0.07, "triangle", 0.25, 0.8);
				break;
			case "card":
				this.noise(0.12, 0.25, 0, 2500);
				this.tone(220, 0.1, "sine", 0.2, 1.4);
				break;
			case "coin":
				this.tone(1568, 0.25, "sine", 0.3, 1.0);
				this.tone(2093, 0.4, "sine", 0.25, 1.0, 0.08);
				break;
			case "oracle_open": {
				if (!this.ctx) return;
				const ctx = this.ctx;
				const t0 = ctx.currentTime;
				const dur = 1.3;

				// Deep, solemn singing bowl / bronze bell fundamental ~130Hz (C3)
				const oscFund = ctx.createOscillator();
				const gainFund = ctx.createGain();
				oscFund.type = "sine";
				oscFund.frequency.setValueAtTime(130.8, t0);
				oscFund.frequency.exponentialRampToValueAtTime(129.6, t0 + dur);
				gainFund.gain.setValueAtTime(0.0001, t0);
				gainFund.gain.exponentialRampToValueAtTime(0.42, t0 + 0.04);
				gainFund.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
				oscFund.connect(gainFund);
				gainFund.connect(this.sfxGain);

				// Shimmering harmonics ~520Hz with slight detuning (520Hz & 523.5Hz)
				// producing authentic singing bowl physical interference shimmer beats
				const oscHarm1 = ctx.createOscillator();
				const gainHarm1 = ctx.createGain();
				oscHarm1.type = "sine";
				oscHarm1.frequency.setValueAtTime(520, t0);
				gainHarm1.gain.setValueAtTime(0.0001, t0);
				gainHarm1.gain.exponentialRampToValueAtTime(0.18, t0 + 0.03);
				gainHarm1.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.15);
				oscHarm1.connect(gainHarm1);
				gainHarm1.connect(this.sfxGain);

				const oscHarm2 = ctx.createOscillator();
				const gainHarm2 = ctx.createGain();
				oscHarm2.type = "sine";
				oscHarm2.frequency.setValueAtTime(523.5, t0);
				gainHarm2.gain.setValueAtTime(0.0001, t0);
				gainHarm2.gain.exponentialRampToValueAtTime(0.14, t0 + 0.03);
				gainHarm2.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.15);
				oscHarm2.connect(gainHarm2);
				gainHarm2.connect(this.sfxGain);

				// Soft triangle overtone decaying gracefully over 1.2s
				const oscTri = ctx.createOscillator();
				const gainTri = ctx.createGain();
				oscTri.type = "triangle";
				oscTri.frequency.setValueAtTime(392, t0);
				gainTri.gain.setValueAtTime(0.0001, t0);
				gainTri.gain.exponentialRampToValueAtTime(0.15, t0 + 0.02);
				gainTri.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.2);
				oscTri.connect(gainTri);
				gainTri.connect(this.sfxGain);

				const bellNodes = [
					[oscFund, gainFund, dur],
					[oscHarm1, gainHarm1, 1.15],
					[oscHarm2, gainHarm2, 1.15],
					[oscTri, gainTri, 1.2],
				] as const;

				for (const [osc, g, d] of bellNodes) {
					osc.onended = () => {
						try {
							osc.disconnect();
							g.disconnect();
						} catch {
							/* noop */
						}
					};
					osc.start(t0);
					osc.stop(t0 + d + 0.03);
				}
				break;
			}
			case "coin_toss": {
				if (!this.ctx) return;
				const ctx = this.ctx;
				const t0 = ctx.currentTime;
				const spinDur = 0.42;

				// Sharp metallic thumb flick (1800Hz transient click)
				const clickOsc = ctx.createOscillator();
				const clickGain = ctx.createGain();
				clickOsc.type = "triangle";
				clickOsc.frequency.setValueAtTime(1800, t0);
				clickOsc.frequency.exponentialRampToValueAtTime(600, t0 + 0.025);
				clickGain.gain.setValueAtTime(0.0001, t0);
				clickGain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.003);
				clickGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.025);
				clickOsc.connect(clickGain);
				clickGain.connect(this.sfxGain);
				clickOsc.onended = () => {
					try {
						clickOsc.disconnect();
						clickGain.disconnect();
					} catch {
						/* noop */
					}
				};
				clickOsc.start(t0);
				clickOsc.stop(t0 + 0.03);

				// Rising airy aerodynamic spin whine: sine sweep 400Hz -> 850Hz with soft AM
				const carrier = ctx.createOscillator();
				const carrierGain = ctx.createGain();
				const amGain = ctx.createGain();
				const lfo = ctx.createOscillator();
				const lfoGain = ctx.createGain();

				carrier.type = "sine";
				carrier.frequency.setValueAtTime(400, t0 + 0.005);
				carrier.frequency.exponentialRampToValueAtTime(850, t0 + spinDur);

				carrierGain.gain.setValueAtTime(0.0001, t0 + 0.005);
				carrierGain.gain.exponentialRampToValueAtTime(0.24, t0 + 0.05);
				carrierGain.gain.exponentialRampToValueAtTime(0.0001, t0 + spinDur);

				// Amplitude Modulation (18Hz flutter simulating rapid coin tumbling in the air)
				lfo.type = "sine";
				lfo.frequency.setValueAtTime(18, t0 + 0.005);
				lfoGain.gain.setValueAtTime(0.35, t0 + 0.005);
				amGain.gain.setValueAtTime(0.65, t0 + 0.005);

				lfo.connect(lfoGain);
				lfoGain.connect(amGain.gain);

				carrier.connect(carrierGain);
				carrierGain.connect(amGain);
				amGain.connect(this.sfxGain);

				carrier.onended = () => {
					try {
						carrier.disconnect();
						carrierGain.disconnect();
						amGain.disconnect();
					} catch {
						/* noop */
					}
				};
				lfo.onended = () => {
					try {
						lfo.disconnect();
						lfoGain.disconnect();
					} catch {
						/* noop */
					}
				};

				carrier.start(t0 + 0.005);
				carrier.stop(t0 + spinDur + 0.03);
				lfo.start(t0 + 0.005);
				lfo.stop(t0 + spinDur + 0.03);
				break;
			}
			case "coin_land": {
				if (!this.ctx) return;
				const ctx = this.ctx;
				const t0 = ctx.currentTime;

				// Impact 1: First heavy impact at 1450Hz + 2100Hz with fast decay
				const osc1a = ctx.createOscillator();
				const g1a = ctx.createGain();
				osc1a.type = "sine";
				osc1a.frequency.setValueAtTime(1450, t0);
				g1a.gain.setValueAtTime(0.0001, t0);
				g1a.gain.exponentialRampToValueAtTime(0.35, t0 + 0.003);
				g1a.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.08);
				osc1a.connect(g1a);
				g1a.connect(this.sfxGain);

				const osc1b = ctx.createOscillator();
				const g1b = ctx.createGain();
				osc1b.type = "sine";
				osc1b.frequency.setValueAtTime(2100, t0);
				g1b.gain.setValueAtTime(0.0001, t0);
				g1b.gain.exponentialRampToValueAtTime(0.25, t0 + 0.003);
				g1b.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
				osc1b.connect(g1b);
				g1b.connect(this.sfxGain);

				// Subtle low stone thud on initial impact
				const stoneOsc = ctx.createOscillator();
				const stoneGain = ctx.createGain();
				stoneOsc.type = "triangle";
				stoneOsc.frequency.setValueAtTime(240, t0);
				stoneOsc.frequency.exponentialRampToValueAtTime(90, t0 + 0.04);
				stoneGain.gain.setValueAtTime(0.0001, t0);
				stoneGain.gain.exponentialRampToValueAtTime(0.2, t0 + 0.004);
				stoneGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.045);
				stoneOsc.connect(stoneGain);
				stoneGain.connect(this.sfxGain);

				// Impact 2: 50ms later (t0 + 0.05s) - second lighter bounce clink at 1750Hz with pleasant metallic ring
				const t1 = t0 + 0.05;
				const osc2 = ctx.createOscillator();
				const g2 = ctx.createGain();
				osc2.type = "sine";
				osc2.frequency.setValueAtTime(1750, t1);
				g2.gain.setValueAtTime(0.0001, t1);
				g2.gain.exponentialRampToValueAtTime(0.28, t1 + 0.003);
				g2.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.28);
				osc2.connect(g2);
				g2.connect(this.sfxGain);

				// High-order harmonic shimmer on bounce
				const osc2Harm = ctx.createOscillator();
				const g2Harm = ctx.createGain();
				osc2Harm.type = "sine";
				osc2Harm.frequency.setValueAtTime(3500, t1);
				g2Harm.gain.setValueAtTime(0.0001, t1);
				g2Harm.gain.exponentialRampToValueAtTime(0.12, t1 + 0.002);
				g2Harm.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.12);
				osc2Harm.connect(g2Harm);
				g2Harm.connect(this.sfxGain);

				const nodes = [
					[osc1a, g1a, t0, 0.09],
					[osc1b, g1b, t0, 0.07],
					[stoneOsc, stoneGain, t0, 0.05],
					[osc2, g2, t1, 0.29],
					[osc2Harm, g2Harm, t1, 0.13],
				] as const;

				for (const [osc, g, startT, dur] of nodes) {
					osc.onended = () => {
						try {
							osc.disconnect();
							g.disconnect();
						} catch {
							/* noop */
						}
					};
					osc.start(startT);
					osc.stop(startT + dur + 0.02);
				}
				break;
			}
			case "up":
				this.tone(523, 0.12, "triangle", 0.3, 1.0);
				this.tone(784, 0.25, "triangle", 0.3, 1.0, 0.1);
				break;
			case "down":
				this.tone(392, 0.15, "sawtooth", 0.15, 0.7);
				this.tone(261, 0.3, "sawtooth", 0.15, 0.7, 0.12);
				break;
			case "reveal":
				this.noise(0.9, 0.2, 0, 900);
				this.tone(180, 0.9, "sine", 0.2, 1.5);
				break;
			case "drum":
				for (let i = 0; i < 12; i++)
					this.noise(0.08, 0.35 - i * 0.01, i * 0.11, 400);
				for (let i = 0; i < 12; i++)
					this.tone(90, 0.09, "sine", 0.4, 0.6, i * 0.11);
				break;
			case "fanfare": {
				const notes = [523, 659, 784, 1046];
				notes.forEach((n, i) =>
					this.tone(n, i === 3 ? 0.9 : 0.22, "triangle", 0.3, 1.0, i * 0.16),
				);
				notes.forEach((n, i) =>
					this.tone(
						n / 2,
						i === 3 ? 0.9 : 0.22,
						"sawtooth",
						0.08,
						1.0,
						i * 0.16,
					),
				);
				break;
			}
			case "tick":
				this.tone(1200, 0.03, "square", 0.08, 0.9);
				break;
			case "heart":
				this.tone(60, 0.18, "sine", 0.6, 0.6);
				this.tone(55, 0.22, "sine", 0.45, 0.6, 0.22);
				break;
			case "whoosh":
				this.noise(0.5, 0.25, 0, 1800);
				break;
			case "chime":
				[1046, 1318, 1568].forEach((n, i) =>
					this.tone(n, 0.8, "sine", 0.18, 1.0, i * 0.05),
				);
				break;
			case "fail":
				this.tone(300, 0.35, "sawtooth", 0.15, 0.5);
				break;
			case "gavel":
				this.noise(0.12, 0.45, 0, 1100);
				this.tone(90, 0.38, "triangle", 0.55, 0.01);
				this.tone(140, 0.2, "sine", 0.35, 0.02, 0.03);
				break;
			case "seal_break":
				this.noise(0.08, 0.35, 0, 4200);
				this.tone(1480, 0.25, "sine", 0.25, 0.8, 0.02);
				this.tone(1960, 0.32, "sine", 0.2, 0.8, 0.06);
				break;
			case "relic": {
				const arpeggio = [523.25, 659.25, 783.99, 1046.5, 1318.51];
				arpeggio.forEach((f, i) =>
					this.tone(f, 0.75, "triangle", 0.22, 1.0, i * 0.07),
				);
				break;
			}
		}
	}
}

export const audio = new AudioEngine();
