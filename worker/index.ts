/**
 * Chronicle proxy: keeps Google + Gradium keys server-side and caches TTS/music in KV.
 * Routes: POST /gemini, /tts, /stt, /image, /music. GET /health.
 */
export interface Env {
	GOOGLE_API_KEY: string;
	GRADIUM_API_KEY: string;
	CACHE: KVNamespace;
	ALLOWED_ORIGINS?: string;
	/** Shared app key — when set, every POST must carry it as x-app-key. */
	APP_KEY?: string;
}

const GOOGLE_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GOOGLE = `${GOOGLE_BASE}/models`;
const GRADIUM = "https://api.gradium.ai/api/post";

function cors(req: Request, env: Env) {
	const origin = req.headers.get("origin");
	let host = "";
	try {
		host = origin ? new URL(origin).hostname : "";
	} catch {
		host = "";
	}
	const allowed = env.ALLOWED_ORIGINS?.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	const itcHost =
		host === "itch.io" ||
		host.endsWith(".itch.io") ||
		host.endsWith(".itch.zone");
	const ok =
		!allowed ||
		allowed.length === 0 ||
		(origin !== null && allowed.includes(origin)) ||
		itcHost;
	return {
		"access-control-allow-origin": ok && origin ? origin : "null",
		"access-control-allow-methods": "POST, GET, OPTIONS",
		"access-control-allow-headers": "content-type, x-app-key",
		"access-control-max-age": "86400",
		vary: "origin",
	};
}

const json = (data: unknown, headers: Record<string, string>, status = 200) =>
	new Response(JSON.stringify(data), {
		status,
		headers: { ...headers, "content-type": "application/json" },
	});

async function sha1(s: string) {
	const d = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
	return [...new Uint8Array(d)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

async function google(env: Env, model: string, body: unknown) {
	const r = await fetch(`${GOOGLE}/${model}:generateContent`, {
		method: "POST",
		headers: {
			"x-goog-api-key": env.GOOGLE_API_KEY,
			"content-type": "application/json",
		},
		body: JSON.stringify(body),
	});
	if (!r.ok)
		throw new Error(`google ${r.status} ${(await r.text()).slice(0, 300)}`);
	return r.json<{
		candidates?: {
			content: {
				parts: {
					text?: string;
					inlineData?: { mimeType: string; data: string };
				}[];
			};
		}[];
	}>();
}

interface GeminiReq {
	system: string;
	parts: unknown[];
	schema?: unknown;
	model?: string;
	temperature?: number;
}

async function handleGemini(req: Request, env: Env, h: Record<string, string>) {
	const b = (await req.json()) as GeminiReq;
	const model = b.model ?? "gemini-3.8-flash";
	const body: Record<string, unknown> = {
		systemInstruction: { parts: [{ text: b.system }] },
		contents: [{ role: "user", parts: b.parts }],
		generationConfig: {
			temperature: b.temperature ?? 0.8,
			...(b.schema
				? { responseMimeType: "application/json", responseSchema: b.schema }
				: {}),
		},
	};
	// two attempts: structured output occasionally truncates
	let lastErr = "";
	for (let i = 0; i < 2; i++) {
		try {
			const r = await google(env, model, body);
			const text =
				r.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ??
				"";
			if (b.schema) JSON.parse(text);
			return new Response(text, {
				headers: { ...h, "content-type": "application/json" },
			});
		} catch (e) {
			lastErr = String(e);
		}
	}
	return json({ error: lastErr }, h, 502);
}

function hasRiffHeader(b: Uint8Array): boolean {
	return (
		b.length >= 12 &&
		b[0] === 0x52 &&
		b[1] === 0x49 &&
		b[2] === 0x46 &&
		b[3] === 0x46
	);
}

function decodeBase64(b64: string): Uint8Array {
	const bin = atob(b64);
	const bytes = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
	return bytes;
}

function pcmToWav(pcm: Uint8Array, sampleRate = 24000): Uint8Array {
	const wav = new Uint8Array(44 + pcm.length);
	const view = new DataView(wav.buffer);
	// RIFF
	wav[0] = 0x52;
	wav[1] = 0x49;
	wav[2] = 0x46;
	wav[3] = 0x46;
	view.setUint32(4, 36 + pcm.length, true);
	// WAVE
	wav[8] = 0x57;
	wav[9] = 0x41;
	wav[10] = 0x56;
	wav[11] = 0x45;
	// fmt
	wav[12] = 0x66;
	wav[13] = 0x6d;
	wav[14] = 0x74;
	wav[15] = 0x20;
	view.setUint32(16, 16, true);
	view.setUint16(20, 1, true); // PCM format
	view.setUint16(22, 1, true); // 1 channel
	view.setUint32(24, sampleRate, true);
	view.setUint32(28, sampleRate * 2, true); // byteRate
	view.setUint16(32, 2, true); // blockAlign
	view.setUint16(34, 16, true); // bitsPerSample
	// data
	wav[36] = 0x64;
	wav[37] = 0x61;
	wav[38] = 0x74;
	wav[39] = 0x61;
	view.setUint32(40, pcm.length, true);
	wav.set(pcm, 44);
	return wav;
}

const GOOGLE_VOICES = new Set([
	"Puck",
	"Charon",
	"Kore",
	"Fenrir",
	"Aoede",
	"Zephyr",
	"Leda",
	"Orpheus",
	"Calliope",
	"Pegasus",
	"Clio",
	"Erato",
]);

async function handleTts(req: Request, env: Env, h: Record<string, string>) {
	const { text, voice_id, style } = (await req.json()) as {
		text: string;
		voice_id: string;
		style?: string;
	};
	if (!text || text.length > 1200) return json({ error: "bad text" }, h, 400);
	const key = `tts:${await sha1(`${voice_id}|${style ?? ""}|${text}`)}`;
	const hit = await env.CACHE.get(key, "arrayBuffer");
	if (hit)
		return new Response(hit, {
			headers: { ...h, "content-type": "audio/wav", "x-cache": "hit" },
		});

	const isGoogleVoice =
		voice_id.startsWith("voice_") || GOOGLE_VOICES.has(voice_id);

	// Try Gradium TTS directly when a Gradium voice ID is specified
	if (!isGoogleVoice && env.GRADIUM_API_KEY) {
		let r: Response | null = null;
		let err = "";
		for (let i = 0; i < 4; i++) {
			r = await fetch(`${GRADIUM}/speech/tts`, {
				method: "POST",
				headers: {
					"x-api-key": env.GRADIUM_API_KEY,
					"content-type": "application/json",
				},
				body: JSON.stringify({
					text,
					voice_id,
					output_format: "wav",
					only_audio: true,
				}),
			});
			if (r.ok) break;
			err = (await r.text()).slice(0, 200);
			if (!/Concurrency|429|rate/i.test(err) && r.status !== 429) break;
			await new Promise((res) => setTimeout(res, 400 * (i + 1)));
		}
		if (r?.ok) {
			const buf = await r.arrayBuffer();
			if (buf.byteLength < 25_000_000)
				await env.CACHE.put(key, buf, { expirationTtl: 60 * 60 * 24 * 30 });
			const contentType = r.headers.get("content-type") || "audio/wav";
			return new Response(buf, {
				headers: { ...h, "content-type": contentType, "x-cache": "miss" },
			});
		}
	}

	// Try Google Gemini TTS if specified or as fallback
	if (env.GOOGLE_API_KEY) {
		const isCustom = voice_id.startsWith("voice_");
		const voiceConfig = isCustom
			? { voice: voice_id }
			: {
					prebuiltVoiceConfig: { voiceName: isGoogleVoice ? voice_id : "Puck" },
				};

		// Gemini TTS is steered by a stage direction in the text itself
		// ("speech_metadata" is not an API field and was silently ignored).
		const promptText = style
			? `Speak in a voice that is ${style}: ${text}`
			: text;
		const body = {
			contents: [
				{
					role: "user",
					parts: [{ text: promptText }],
				},
			],
			generationConfig: {
				responseModalities: ["AUDIO"],
				speechConfig: { voiceConfig },
			},
		};

		const ttsModels = ["gemini-3.8-flash-tts", "gemini-2.5-flash-preview-tts"];
		for (const model of ttsModels) {
			try {
				const r = await fetch(`${GOOGLE}/${model}:generateContent`, {
					method: "POST",
					headers: {
						"x-goog-api-key": env.GOOGLE_API_KEY,
						"content-type": "application/json",
					},
					body: JSON.stringify(body),
				});
				if (!r.ok) continue;
				const res = (await r.json()) as {
					candidates?: {
						content?: {
							parts?: {
								inlineData?: { mimeType: string; data: string };
							}[];
						};
					}[];
				};
				const b64 = res.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
				if (!b64) continue;

				const rawBytes = decodeBase64(b64);
				const wavBytes = hasRiffHeader(rawBytes)
					? rawBytes
					: pcmToWav(rawBytes, 24000);
				if (wavBytes.byteLength < 25_000_000) {
					await env.CACHE.put(key, wavBytes.buffer as ArrayBuffer, {
						expirationTtl: 60 * 60 * 24 * 30,
					});
				}
				return new Response(wavBytes.buffer as ArrayBuffer, {
					headers: { ...h, "content-type": "audio/wav", "x-cache": "miss" },
				});
			} catch {
				/* continue to next model or fallback */
			}
		}
	}

	return json({ error: "TTS generation failed" }, h, 502);
}

async function handleVoiceDesign(
	req: Request,
	env: Env,
	h: Record<string, string>,
) {
	const body = await req.json();
	const r = await fetch(`${GOOGLE_BASE}/voices`, {
		method: "POST",
		headers: {
			"x-goog-api-key": env.GOOGLE_API_KEY,
			"content-type": "application/json",
		},
		body: JSON.stringify(body),
	});
	if (!r.ok) {
		return new Response(await r.text(), { status: r.status, headers: h });
	}
	const data = await r.json();
	return json(data, h);
}

async function handleStt(req: Request, env: Env, h: Record<string, string>) {
	const body = await req.arrayBuffer();
	const ct = req.headers.get("content-type") ?? "audio/wav";
	const cfg = encodeURIComponent(JSON.stringify({ language: "en" }));
	const r = await fetch(`${GRADIUM}/speech/asr?json_config=${cfg}`, {
		method: "POST",
		headers: { "x-api-key": env.GRADIUM_API_KEY, "content-type": ct },
		body,
	});
	if (!r.ok)
		return json(
			{ error: `gradium stt ${r.status} ${(await r.text()).slice(0, 200)}` },
			h,
			502,
		);
	const words: string[] = [];
	for (const line of (await r.text()).split("\n")) {
		if (!line.trim()) continue;
		try {
			const m = JSON.parse(line) as { type: string; text?: string };
			if (m.type === "text" && m.text) words.push(m.text);
		} catch {
			/* skip */
		}
	}
	return json({ text: words.join(" ").replace(/\s+/g, " ").trim() }, h);
}

async function handleImage(req: Request, env: Env, h: Record<string, string>) {
	const { prompt, aspect, ref } = (await req.json()) as {
		prompt: string;
		aspect: string;
		ref?: string;
	};
	const parts: unknown[] = [];
	if (ref) parts.push({ inlineData: { mimeType: "image/png", data: ref } });
	parts.push({ text: prompt });
	const r = await google(env, "gemini-3.1-flash-image", {
		contents: [{ parts }],
		generationConfig: {
			responseModalities: ["IMAGE"],
			imageConfig: { aspectRatio: aspect || "3:4" },
		},
	});
	const img = r.candidates?.[0]?.content?.parts?.find(
		(p) => p.inlineData,
	)?.inlineData;
	if (!img) return json({ error: "no image" }, h, 502);
	return json({ data: img.data, mime: img.mimeType }, h);
}

async function handleMusic(req: Request, env: Env, h: Record<string, string>) {
	const { prompt, id } = (await req.json()) as { prompt: string; id: string };
	const key = `music:${id}:${await sha1(prompt)}`;
	const hit = await env.CACHE.get(key, "arrayBuffer");
	if (hit)
		return new Response(hit, {
			headers: { ...h, "content-type": "audio/mpeg", "x-cache": "hit" },
		});
	const r = await google(env, "lyria-3-clip-preview", {
		contents: [
			{
				parts: [
					{
						text: `${prompt} Instrumental only, no vocals, steady tempo, suitable as a seamless loop.`,
					},
				],
			},
		],
		generationConfig: { responseModalities: ["AUDIO"] },
	});
	const audio = r.candidates?.[0]?.content?.parts?.find(
		(p) => p.inlineData,
	)?.inlineData;
	if (!audio) return json({ error: "no audio" }, h, 502);
	const bin = Uint8Array.from(atob(audio.data), (c) => c.charCodeAt(0));
	await env.CACHE.put(key, bin.buffer, { expirationTtl: 60 * 60 * 24 * 30 });
	return new Response(bin, {
		headers: { ...h, "content-type": audio.mimeType, "x-cache": "miss" },
	});
}

export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const h = cors(req, env);
		if (req.method === "OPTIONS") return new Response(null, { headers: h });
		const url = new URL(req.url);
		if (url.pathname === "/health") return json({ ok: true }, h);
		if (req.method !== "POST") return json({ error: "method" }, h, 405);
		if (env.APP_KEY && req.headers.get("x-app-key") !== env.APP_KEY)
			return json({ error: "unauthorized" }, h, 401);
		// Body cap: without it a client (or an abuser with the app key) could
		// stream arbitrarily large payloads through to the paid APIs —
		// /stt audio, /image base64 refs, /gemini parts.
		const len = Number(req.headers.get("content-length") ?? "0");
		if (len > 8 * 1024 * 1024)
			return json({ error: "payload too large" }, h, 413);
		try {
			switch (url.pathname) {
				case "/gemini":
					return await handleGemini(req, env, h);
				case "/tts":
					return await handleTts(req, env, h);
				case "/voice/design":
					return await handleVoiceDesign(req, env, h);
				case "/stt":
					return await handleStt(req, env, h);
				case "/image":
					return await handleImage(req, env, h);
				case "/music":
					return await handleMusic(req, env, h);
				default:
					return json({ error: "not found" }, h, 404);
			}
		} catch (e) {
			return json({ error: String(e) }, h, 500);
		}
	},
};
