/* Chronicle PCM capture worklet — replaces deprecated ScriptProcessorNode.
 * Batches 128-sample render quanta into 4096-sample frames (same cadence as
 * the legacy script processor) and posts copies to the main thread. */
class PcmCaptureProcessor extends AudioWorkletProcessor {
	constructor() {
		super();
		this.buf = new Float32Array(4096);
		this.len = 0;
	}

	process(inputs) {
		const ch = inputs[0]?.[0];
		if (!ch) return true;
		let off = 0;
		while (off < ch.length) {
			const n = Math.min(4096 - this.len, ch.length - off);
			this.buf.set(ch.subarray(off, off + n), this.len);
			this.len += n;
			off += n;
			if (this.len === 4096) {
				this.port.postMessage(this.buf.slice(0));
				this.len = 0;
			}
		}
		return true;
	}
}

registerProcessor("chronicle-pcm", PcmCaptureProcessor);
