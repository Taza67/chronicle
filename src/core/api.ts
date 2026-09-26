/** Client for the Cloudflare Worker proxy (keys never live in the browser). */

const WORKER =
	(import.meta.env?.VITE_WORKER_URL as string | undefined)?.replace(
		/\/$/,
		"",
	) ?? "";

export const online = () => WORKER !== "" && navigator.onLine;

export interface GeminiPart {
	text?: string;
	inlineData?: { mimeType: string; data: string };
}

async function post(
	path: string,
	body: BodyInit,
	headers: Record<string, string> = {},
	timeoutMs = 60000,
) {
	if (!WORKER) throw new Error("offline");
	const ctl = new AbortController();
	const t = setTimeout(() => ctl.abort(), timeoutMs);
	try {
		const r = await fetch(WORKER + path, {
			method: "POST",
			body,
			headers,
			signal: ctl.signal,
		});
		if (!r.ok)
			throw new Error(`${path} ${r.status}: ${(await r.text()).slice(0, 200)}`);
		return r;
	} finally {
		clearTimeout(t);
	}
}

export async function gemini<T>(opts: {
	system: string;
	parts: GeminiPart[];
	schema?: unknown;
	model?: string;
	temperature?: number;
}): Promise<T> {
	const r = await post(
		"/gemini",
		JSON.stringify(opts),
		{ "content-type": "application/json" },
		90000,
	);
	const txt = await r.text();
	try {
		return JSON.parse(txt) as T;
	} catch {
		const m = txt.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
		if (m) return JSON.parse(m[0]) as T;
		throw new Error("bad json from gemini");
	}
}

async function hash(s: string) {
	const d = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
	return [...new Uint8Array(d)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

const ttsMem = new Map<string, Promise<ArrayBuffer>>();

// Concurrency gate for TTS requests
const TTS_SLOTS = 6;
let ttsActive = 0;
const ttsQueue: (() => void)[] = [];
const acquire = () =>
	new Promise<void>((res) => {
		if (ttsActive < TTS_SLOTS) {
			ttsActive++;
			res();
		} else ttsQueue.push(res);
	});
const release = () => {
	const next = ttsQueue.shift();
	if (next) next();
	else ttsActive--;
};

/** TTS → WAV bytes, cached in memory + Cache API. */
export function tts(
	text: string,
	voice: string,
	style?: string,
): Promise<ArrayBuffer> {
	const key = `${voice}|${style ?? ""}|${text}`;
	let p = ttsMem.get(key);
	if (!p) {
		p = (async () => {
			const h = await hash(key);
			const cacheKey = `${location.origin}/__tts/${h}`;
			let cache: Cache | null = null;
			try {
				cache = await caches.open("chronicle-tts-v1");
				const hit = await cache.match(cacheKey);
				if (hit) return hit.arrayBuffer();
			} catch {
				/* Cache API unavailable */
			}
			await acquire();
			let buf: ArrayBuffer;
			try {
				const r = await post(
					"/tts",
					JSON.stringify({ text, voice_id: voice, style }),
					{ "content-type": "application/json" },
					45000,
				);
				buf = await r.arrayBuffer();
			} finally {
				release();
			}
			if (cache && buf.byteLength > 1000)
				void cache
					.put(
						cacheKey,
						new Response(buf, { headers: { "content-type": "audio/wav" } }),
					)
					.catch(() => {});
			return buf;
		})();
		ttsMem.set(key, p);
		p.catch(() => ttsMem.delete(key));
	}
	return p;
}

/** Design a brand-new persistent character voice via Google Gemini Voice Design. */
export async function designVoice(opts: {
	name: string;
	description: string;
	gender?: "male" | "female";
	language?: string;
}): Promise<{ id: string; sampleAudio?: string }> {
	const r = await post(
		"/voice/design",
		JSON.stringify({
			store: true,
			voice: {
				model: "gemini-3.8-flash-tts",
				type: "prompted",
				display_name: opts.name,
				gender: opts.gender ?? "male",
				language_code: opts.language ?? "en-US",
				prompted: {
					input: opts.description,
				},
			},
		}),
		{ "content-type": "application/json" },
		60000,
	);
	const data = (await r.json()) as {
		id?: string;
		name?: string;
		sample_audio?: { data?: string };
	};
	const id = data.id || data.name?.replace("voices/", "") || "";
	return { id, sampleAudio: data.sample_audio?.data };
}

export async function stt(blob: Blob): Promise<string> {
	const r = await post(
		"/stt",
		blob,
		{ "content-type": blob.type || "audio/webm" },
		30000,
	);
	const j = (await r.json()) as { text: string };
	return j.text ?? "";
}

const IMAGE_SLOTS = 3;
let imageActive = 0;
const imageQueue: (() => void)[] = [];
const acquireImage = () =>
	new Promise<void>((res) => {
		if (imageActive < IMAGE_SLOTS) {
			imageActive++;
			res();
		} else imageQueue.push(res);
	});
const releaseImage = () => {
	const next = imageQueue.shift();
	if (next) next();
	else imageActive--;
};

/** Google image generation with queue gating and retries. `ref` = base64 PNG to edit. */
export async function image(
	prompt: string,
	aspect: string,
	ref?: string,
): Promise<{ data: string; mime: string }> {
	await acquireImage();
	try {
		for (let attempt = 0; attempt < 3; attempt++) {
			try {
				const r = await post(
					"/image",
					JSON.stringify({ prompt, aspect, ref }),
					{ "content-type": "application/json" },
					90000,
				);
				const data = (await r.json()) as { data: string; mime: string };
				if (data.data) return data;
			} catch (e) {
				if (attempt === 2) throw e;
				await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
			}
		}
		throw new Error("image generation failed after retries");
	} finally {
		releaseImage();
	}
}

export async function music(
	prompt: string,
	id: string,
): Promise<ArrayBuffer | null> {
	try {
		const r = await post(
			"/music",
			JSON.stringify({ prompt, id }),
			{ "content-type": "application/json" },
			120000,
		);
		return await r.arrayBuffer();
	} catch {
		return null;
	}
}
