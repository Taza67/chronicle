import { FEMININE, MASCULINE, VOICES } from "../content/voices.ts";
import type {
	AdvisorRole,
	BBox,
	CharacterArt,
	Leader,
	LeaderArt,
} from "../types.ts";
import { gemini, image } from "./api.ts";
import { generateLeaderProfile, type LeaderProfile } from "./generator.ts";
import { addCustomLeader } from "./state.ts";

const STYLE =
	"Stylized painted portrait in the art style of Civilization VI leader screens: bold saturated colors, soft painterly shading, slightly exaggerated proportions, confident expression, mouth closed, eyes open looking at the viewer, waist-up, centered, on a plain dark gradient backdrop, no text, no frame.";
const SCENE_STYLE =
	"Painted background illustration in the art style of Civilization VI, wide establishing shot, no people, soft depth, atmospheric light, rich color, no text.";
const EDIT =
	"Edit this exact image: keep everything identical (framing, lighting, colors, pose, clothing) but ";

export type SummonProgress = (step: string, fraction: number) => void;

function loadImg(dataUrl: string): Promise<HTMLImageElement> {
	return new Promise((res, rej) => {
		const i = new Image();
		i.onload = () => res(i);
		i.onerror = rej;
		i.src = dataUrl;
	});
}

const toDataUrl = (r: { data: string; mime: string }) =>
	`data:${r.mime};base64,${r.data}`;

function canvas(w: number, h: number) {
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	return c;
}

/** Resize to a fixed size so overlays line up between base and edited variants. */
async function normalize(
	dataUrl: string,
	w: number,
	h: number,
): Promise<{ url: string; b64: string; img: HTMLImageElement }> {
	const src = await loadImg(dataUrl);
	const c = canvas(w, h);
	c.getContext("2d")!.drawImage(src, 0, 0, w, h);
	const png = c.toDataURL("image/png");
	const url = c.toDataURL("image/webp", 0.86);
	return { url, b64: png.split(",")[1], img: await loadImg(png) };
}

function pad(
	box: [number, number, number, number],
	p: number,
): [number, number, number, number] {
	const [y0, x0, y1, x1] = box;
	const py = (y1 - y0) * p;
	const px = (x1 - x0) * p;
	return [
		Math.max(0, y0 - py),
		Math.max(0, x0 - px),
		Math.min(1000, y1 + py),
		Math.min(1000, x1 + px),
	];
}

const pixels = (img: HTMLImageElement) => {
	const c = canvas(img.width, img.height);
	const ctx = c.getContext("2d")!;
	ctx.drawImage(img, 0, 0);
	return ctx.getImageData(0, 0, img.width, img.height);
};

/**
 * Crop a variant to a bbox, shifted to best match the base on the ring around the
 * feature (edited images drift by a few px), colour-matched to the base, then feathered.
 */
function patch(
	base: HTMLImageElement,
	img: HTMLImageElement,
	box: [number, number, number, number],
): string {
	const [y0, x0, y1, x1] = box;
	const bx = Math.round((x0 / 1000) * base.width);
	const by = Math.round((y0 / 1000) * base.height);
	const bw = Math.max(2, Math.round(((x1 - x0) / 1000) * base.width));
	const bh = Math.max(2, Math.round(((y1 - y0) / 1000) * base.height));
	const B = pixels(base);
	const V = pixels(img);
	const my = Math.floor(bh * 0.28);
	const mx = Math.floor(bw * 0.22);
	const onRing = (x: number, y: number) =>
		y < my || y >= bh - my || x < mx || x >= bw - mx;
	const at = (d: ImageData, x: number, y: number) => (y * d.width + x) * 4;
	const r = Math.round(Math.max(bw, bh) * 0.12);
	let best = Number.POSITIVE_INFINITY;
	let bdx = 0;
	let bdy = 0;
	for (let dy = -r; dy <= r; dy += 2)
		for (let dx = -r; dx <= r; dx += 2) {
			if (
				by + dy < 0 ||
				bx + dx < 0 ||
				by + dy + bh > V.height ||
				bx + dx + bw > V.width
			)
				continue;
			let err = 0;
			let n = 0;
			for (let y = 0; y < bh; y += 2)
				for (let x = 0; x < bw; x += 2) {
					if (!onRing(x, y)) continue;
					const a = at(B, bx + x, by + y);
					const b = at(V, bx + x + dx, by + y + dy);
					for (let c = 0; c < 3; c++) {
						const d = B.data[a + c] - V.data[b + c];
						err += d * d;
					}
					n++;
				}
			err /= Math.max(1, n);
			if (err < best) {
				best = err;
				bdx = dx;
				bdy = dy;
			}
		}
	// per-channel mean/std match on the ring
	const sb = [0, 0, 0];
	const sv = [0, 0, 0];
	const qb = [0, 0, 0];
	const qv = [0, 0, 0];
	let n = 0;
	for (let y = 0; y < bh; y++)
		for (let x = 0; x < bw; x++) {
			if (!onRing(x, y)) continue;
			const a = at(B, bx + x, by + y);
			const b = at(V, bx + x + bdx, by + y + bdy);
			for (let c = 0; c < 3; c++) {
				sb[c] += B.data[a + c];
				qb[c] += B.data[a + c] ** 2;
				sv[c] += V.data[b + c];
				qv[c] += V.data[b + c] ** 2;
			}
			n++;
		}
	const out = new ImageData(bw, bh);
	const gain = [0, 1, 2].map((c) => {
		const mb = sb[c] / n;
		const mv = sv[c] / n;
		const sdb = Math.sqrt(Math.max(0, qb[c] / n - mb * mb)) + 1e-3;
		const sdv = Math.sqrt(Math.max(0, qv[c] / n - mv * mv)) + 1e-3;
		return { mb, mv, g: Math.min(1.4, Math.max(0.7, sdb / sdv)) };
	});
	for (let y = 0; y < bh; y++)
		for (let x = 0; x < bw; x++) {
			const b = at(V, bx + x + bdx, by + y + bdy);
			const o = (y * bw + x) * 4;
			for (let c = 0; c < 3; c++) {
				const { mb, mv, g } = gain[c];
				out.data[o + c] = Math.max(
					0,
					Math.min(255, (V.data[b + c] - mv) * g + mb),
				);
			}
			out.data[o + 3] = 255;
		}
	const cut = canvas(bw, bh);
	cut.getContext("2d")!.putImageData(out, 0, 0);
	const c = canvas(bw, bh);
	const ctx = c.getContext("2d")!;
	const m = Math.max(2, Math.min(bw, bh) / 8);
	ctx.filter = `blur(${m / 2}px)`;
	ctx.fillStyle = "#fff";
	ctx.beginPath();
	ctx.roundRect(m, m, bw - 2 * m, bh - 2 * m, m);
	ctx.fill();
	ctx.filter = "none";
	ctx.globalCompositeOperation = "source-in";
	ctx.drawImage(cut, 0, 0);
	return c.toDataURL("image/webp", 0.9);
}

async function bboxes(b64: string): Promise<BBox> {
	return gemini<BBox>({
		system: "You are a precise vision annotator.",
		parts: [
			{ inlineData: { mimeType: "image/png", data: b64 } },
			{
				text: 'Detect on this painted portrait: the mouth (lips only), both eyes together as one box (outer corner of left eye to outer corner of right eye, including eyelids and brows), and the whole head (including hair and headdress). Return JSON {"mouth":[ymin,xmin,ymax,xmax],"eyes":[...],"head":[...]} normalized to 0-1000.',
			},
		],
		schema: {
			type: "OBJECT",
			properties: {
				mouth: { type: "ARRAY", items: { type: "INTEGER" } },
				eyes: { type: "ARRAY", items: { type: "INTEGER" } },
				head: { type: "ARRAY", items: { type: "INTEGER" } },
			},
			required: ["mouth", "eyes", "head"],
		},
	});
}

async function character(
	prompt: string,
	onStep: () => void,
): Promise<CharacterArt> {
	const base = await normalize(
		toDataUrl(await image(`${STYLE} Subject: ${prompt}`, "3:4")),
		576,
		768,
	);
	onStep();
	const [open, half, blink, bb] = await Promise.all([
		image(
			`${EDIT}the character is now mid-sentence, mouth clearly open showing teeth slightly as if pronouncing 'ah'. Same eyes, same expression otherwise.`,
			"3:4",
			base.b64,
		).then((r) => normalize(toDataUrl(r), 576, 768)),
		image(
			`${EDIT}the lips are slightly parted, as if pronouncing 'mm' or 'oo', small rounded opening. Same eyes.`,
			"3:4",
			base.b64,
		).then((r) => normalize(toDataUrl(r), 576, 768)),
		image(
			`${EDIT}both eyes are fully closed, eyelids down, relaxed. Same mouth.`,
			"3:4",
			base.b64,
		).then((r) => normalize(toDataUrl(r), 576, 768)),
		bboxes(base.b64),
	]);
	onStep();
	const mouth = pad(bb.mouth, 0.55);
	const eyes = pad(bb.eyes, 0.35);
	return {
		src: base.url,
		mouthOpen: patch(base.img, open.img, mouth),
		mouthHalf: patch(base.img, half.img, mouth),
		eyesClosed: patch(base.img, blink.img, eyes),
		bbox: { mouth, eyes, head: bb.head },
	};
}

async function scene(
	prompt: string,
): Promise<{ scene: string; sceneFar: string }> {
	const r = await image(`${SCENE_STYLE} Location: ${prompt}`, "9:16");
	const img = await loadImg(toDataUrl(r));
	const near = canvas(864, 1536);
	near.getContext("2d")!.drawImage(img, 0, 0, 864, 1536);
	const far = canvas(432, 768);
	const fctx = far.getContext("2d")!;
	fctx.filter = "blur(6px)";
	fctx.drawImage(img, -10, -10, 452, 788);
	return {
		scene: near.toDataURL("image/webp", 0.82),
		sceneFar: far.toDataURL("image/webp", 0.75),
	};
}

const pick = (list: readonly (keyof typeof VOICES)[], i: number) =>
	VOICES[list[i % list.length]];

export type SummonResult =
	| { ok: true; leader: Leader }
	| { ok: false; refusal: string };

/** Full leader-on-demand pipeline: profile → 4 animated portraits → scene. ~40-70 s online. */
export async function summon(
	request: string,
	progress: SummonProgress,
): Promise<SummonResult> {
	progress("The archivist searches the records…", 0.05);
	const profile: LeaderProfile = await generateLeaderProfile(request);
	if (!profile.valid || !profile.leader)
		return {
			ok: false,
			refusal:
				profile.refusal ||
				"The archives hold only those who truly lived, Majesty.",
		};
	const p = profile.leader;
	const id = `${p.id.replace(/[^a-z0-9_]/g, "").slice(0, 32) || "leader"}_${Date.now().toString(36)}`;
	const total = 4 * 2 + 1;
	let done = 0;
	const step = (label: string) => () => {
		done += 1;
		progress(label, 0.1 + 0.85 * (done / total));
	};
	progress("The court painter mixes colours…", 0.1);
	const roles: AdvisorRole[] = ["war", "gold", "faith"];
	const advisors = roles.map((r, i) => {
		const a = p.advisors.find((x) => x.role === r) ?? {
			role: r,
			name: ["Marshal", "Treasurer", "High Priest"][i],
			title: ["Master of War", "Keeper of the Treasury", "Voice of the Gods"][
				i
			],
			trait: "loyal, blunt",
			gender: "male" as const,
		};
		return {
			...a,
			voice: pick(a.gender === "female" ? FEMININE : MASCULINE, i + 1),
		};
	});
	const [leaderArt, ...advArt] = await Promise.all([
		character(p.portraitPrompt, step(`Painting ${p.name}…`)),
		...advisors.map((a) =>
			character(
				`${a.name}, ${a.title} of ${p.civ}, ${a.trait}, ${p.era}`,
				step(`Painting ${a.name}…`),
			),
		),
	]);
	progress("Sketching the seat of power…", 0.92);
	const sc = await scene(p.scenePrompt);
	const art: LeaderArt = {
		leader: leaderArt,
		scene: sc.scene,
		sceneFar: sc.sceneFar,
		advisors: { war: advArt[0], gold: advArt[1], faith: advArt[2] },
	};
	const leader: Leader = {
		id,
		name: p.name,
		civ: p.civ,
		era: p.era,
		quote: p.quote,
		voice: pick(p.gender === "female" ? FEMININE : MASCULINE, 0),
		palette: p.palette,
		advisors: advisors.map(({ role, name, title, trait, voice }) => ({
			role,
			name,
			title,
			trait,
			voice,
		})),
		portraitPrompt: p.portraitPrompt,
		scenePrompt: p.scenePrompt,
		musicPrompt: p.musicPrompt,
		generated: true,
		art,
	};
	await addCustomLeader(leader);
	progress("The court assembles.", 1);
	return { ok: true, leader };
}
