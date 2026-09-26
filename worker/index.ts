/**
 * Chronicle proxy: keeps Google + Gradium keys server-side and caches TTS/music in KV.
 * Routes: POST /gemini, /tts, /stt, /image, /music. GET /health.
 */
export interface Env {
	GOOGLE_API_KEY: string;
	GRADIUM_API_KEY: string;
	CACHE: KVNamespace;
	ALLOWED_ORIGINS?: string;
}

const GOOGLE = "https://generativelanguage.googleapis.com/v1beta/models";
const GRADIUM = "https://api.gradium.ai/api/post";

function cors(req: Request, env: Env) {
	const origin = req.headers.get("origin") ?? "*";
	const allowed = env.ALLOWED_ORIGINS?.split(",").map((s) => s.trim());
	const ok =
		!allowed ||
		allowed.length === 0 ||
		allowed.includes(origin) ||
		origin.endsWith(".itch.zone") ||
		origin.endsWith("itch.io");
	return {
		"access-control-allow-origin": ok ? origin : "null",
		"access-control-allow-methods": "POST, GET, OPTIONS",
		"access-control-allow-headers": "content-type",
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

async function handleTts(req: Request, env: Env, h: Record<string, string>) {
	const { text, voice_id } = (await req.json()) as {
		text: string;
		voice_id: string;
	};
	if (!text || text.length > 1200) return json({ error: "bad text" }, h, 400);
	const key = `tts:${await sha1(`${voice_id}|${text}`)}`;
	const hit = await env.CACHE.get(key, "arrayBuffer");
	if (hit)
		return new Response(hit, {
			headers: { ...h, "content-type": "audio/wav", "x-cache": "hit" },
		});
	const r = await fetch(`${GRADIUM}/speech/tts`, {
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
	if (!r.ok)
		return json(
			{ error: `gradium ${r.status} ${(await r.text()).slice(0, 200)}` },
			h,
			502,
		);
	const buf = await r.arrayBuffer();
	if (buf.byteLength < 25_000_000)
		await env.CACHE.put(key, buf, { expirationTtl: 60 * 60 * 24 * 30 });
	return new Response(buf, {
		headers: { ...h, "content-type": "audio/wav", "x-cache": "miss" },
	});
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
		try {
			switch (url.pathname) {
				case "/gemini":
					return await handleGemini(req, env, h);
				case "/tts":
					return await handleTts(req, env, h);
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
