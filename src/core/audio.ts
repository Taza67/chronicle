/** Web Audio engine: voice playback with amplitude analysis (lip-sync), ducked music, synthesized SFX. */

export interface VoiceHandle {
	done: Promise<void>;
	/** 0..1 smoothed loudness, polled every frame by portraits. */
	level(): number;
	stop(): void;
	duration: number;
}

class AudioEngine {
	private ctx: AudioContext | null = null;
	private master!: GainNode;
	private musicGain!: GainNode;
	private voiceGain!: GainNode;
	private sfxGain!: GainNode;
	private analyser!: AnalyserNode;
	private data!: Uint8Array<ArrayBuffer>;
	private smoothed = 0;
	private current: AudioBufferSourceNode | null = null;
	private music: {
		src: AudioBufferSourceNode;
		gain: GainNode;
		id: string;
	} | null = null;
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
			this.musicGain = this.ctx.createGain();
			this.musicGain.gain.value = this.musicVolume;
			this.musicGain.connect(this.master);
			this.sfxGain = this.ctx.createGain();
			this.sfxGain.gain.value = 0.5;
			this.sfxGain.connect(this.master);
			this.voiceGain = this.ctx.createGain();
			this.voiceGain.gain.value = this.voiceVolume;
			this.analyser = this.ctx.createAnalyser();
			this.analyser.fftSize = 512;
			this.analyser.smoothingTimeConstant = 0.4;
			this.data = new Uint8Array(this.analyser.frequencyBinCount);
			this.voiceGain.connect(this.analyser);
			this.analyser.connect(this.master);
		}
		if (this.ctx.state === "suspended") void this.ctx.resume();
	}

	setMusicVolume(v: number) {
		this.musicVolume = v;
		if (this.musicGain && !this.current) this.musicGain.gain.value = v;
	}

	setVoiceVolume(v: number) {
		this.voiceVolume = v;
		if (this.voiceGain) this.voiceGain.gain.value = v;
	}

	async decode(buf: ArrayBuffer): Promise<AudioBuffer> {
		this.unlock();
		return this.ctx!.decodeAudioData(buf.slice(0));
	}

	/** Plays a voice clip, ducking the music while it speaks. */
	speak(buffer: AudioBuffer): VoiceHandle {
		this.unlock();
		const ctx = this.ctx!;
		this.stopVoice();
		const src = ctx.createBufferSource();
		src.buffer = buffer;
		src.connect(this.voiceGain);
		this.current = src;
		this.duck(true);
		let ended = false;
		const done = new Promise<void>((resolve) => {
			src.onended = () => {
				ended = true;
				if (this.current === src) {
					this.current = null;
					this.duck(false);
				}
				resolve();
			};
		});
		src.start();
		return {
			done,
			duration: buffer.duration,
			level: () => (ended ? 0 : this.readLevel()),
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
			} catch {
				/* noop */
			}
			this.current = null;
			this.duck(false);
		}
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

	private duck(on: boolean) {
		if (!this.musicGain) return;
		const t = this.ctx!.currentTime;
		this.musicGain.gain.cancelScheduledValues(t);
		this.musicGain.gain.setTargetAtTime(
			on ? this.musicVolume * 0.35 : this.musicVolume,
			t,
			on ? 0.15 : 0.8,
		);
	}

	async playMusic(id: string, load: () => Promise<ArrayBuffer | null>) {
		if (this.music?.id === id) return;
		this.unlock();
		let buf = this.musicBuffers.get(id);
		if (!buf) {
			const raw = await load();
			if (!raw) return;
			buf = await this.decode(raw);
			this.musicBuffers.set(id, buf);
		}
		if (this.music?.id === id) return;
		this.stopMusic(1.5);
		const ctx = this.ctx!;
		const src = ctx.createBufferSource();
		src.buffer = buf;
		src.loop = true;
		const gain = ctx.createGain();
		gain.gain.value = 0;
		src.connect(gain);
		gain.connect(this.musicGain);
		src.start();
		gain.gain.linearRampToValueAtTime(1, ctx.currentTime + 2);
		this.music = { src, gain, id };
	}

	stopMusic(fade = 1) {
		if (!this.music) return;
		const { src, gain } = this.music;
		const t = this.ctx!.currentTime;
		gain.gain.cancelScheduledValues(t);
		gain.gain.setValueAtTime(gain.gain.value, t);
		gain.gain.linearRampToValueAtTime(0, t + fade);
		src.stop(t + fade + 0.05);
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
		src.start(t0);
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
			| "fail",
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
		}
	}
}

export const audio = new AudioEngine();
