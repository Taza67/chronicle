/** Microphone capture → WAV blob (Gradium ASR accepts raw wav). */

export const micSupported = () =>
	typeof navigator !== "undefined" &&
	!!navigator.mediaDevices?.getUserMedia &&
	typeof AudioContext !== "undefined";

export function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
	const len = chunks.reduce((n, c) => n + c.length, 0);
	const buf = new ArrayBuffer(44 + len * 2);
	const v = new DataView(buf);
	const str = (o: number, s: string) => {
		for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
	};
	str(0, "RIFF");
	v.setUint32(4, 36 + len * 2, true);
	str(8, "WAVE");
	str(12, "fmt ");
	v.setUint32(16, 16, true);
	v.setUint16(20, 1, true);
	v.setUint16(22, 1, true);
	v.setUint32(24, sampleRate, true);
	v.setUint32(28, sampleRate * 2, true);
	v.setUint16(32, 2, true);
	v.setUint16(34, 16, true);
	str(36, "data");
	v.setUint32(40, len * 2, true);
	let o = 44;
	for (const c of chunks) {
		for (let i = 0; i < c.length; i++, o += 2)
			v.setInt16(o, Math.max(-1, Math.min(1, c[i])) * 0x7fff, true);
	}
	return new Blob([buf], { type: "audio/wav" });
}

/** A live PCM tap on a mic source — AudioWorklet first, ScriptProcessor fallback. */
interface PcmTap {
	disconnect(): void;
}

export async function tapPcm(
	ctx: AudioContext,
	src: AudioNode,
	onChunk: (samples: Float32Array) => void,
): Promise<PcmTap> {
	try {
		if (!ctx.audioWorklet) throw new Error("no audioWorklet");
		await ctx.audioWorklet.addModule("worklets/pcm-capture.js");
		const node = new AudioWorkletNode(ctx, "chronicle-pcm");
		node.port.onmessage = (e: MessageEvent<Float32Array>) => {
			onChunk(e.data);
		};
		src.connect(node);
		node.connect(ctx.destination);
		return {
			disconnect() {
				node.port.onmessage = null;
				src.disconnect(node);
				node.disconnect();
			},
		};
	} catch {
		// AudioWorklet unavailable (old Safari) or module failed — fall back
		// to the deprecated but universal ScriptProcessor path.
		const proc = ctx.createScriptProcessor(4096, 1, 1);
		proc.onaudioprocess = (e) => {
			onChunk(new Float32Array(e.inputBuffer.getChannelData(0)));
		};
		src.connect(proc);
		proc.connect(ctx.destination);
		return {
			disconnect() {
				proc.onaudioprocess = null;
				src.disconnect(proc);
				proc.disconnect();
			},
		};
	}
}

export interface Recording {
	/** 0..1 live input level for the mic UI. */
	level(): number;
	stop(): Promise<Blob>;
}

export async function record(maxSeconds = 8): Promise<Recording> {
	const stream = await navigator.mediaDevices.getUserMedia({
		audio: { echoCancellation: true, noiseSuppression: true },
	});
	const ctx = new AudioContext();
	const src = ctx.createMediaStreamSource(stream);
	const chunks: Float32Array[] = [];
	let level = 0;
	const tap = await tapPcm(ctx, src, (d) => {
		chunks.push(d);
		let s = 0;
		for (let i = 0; i < d.length; i += 8) s += d[i] * d[i];
		level = Math.min(1, Math.sqrt(s / (d.length / 8)) * 6);
	});
	let stopped = false;
	const stop = async () => {
		if (stopped) return encodeWav(chunks, ctx.sampleRate);
		stopped = true;
		tap.disconnect();
		src.disconnect();
		for (const t of stream.getTracks()) t.stop();
		await ctx.close();
		return encodeWav(chunks, ctx.sampleRate);
	};
	const auto = setTimeout(() => void stop(), maxSeconds * 1000);
	return {
		level: () => level,
		stop: () => {
			clearTimeout(auto);
			return stop();
		},
	};
}
