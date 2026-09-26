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
	const url = c.toDataURL("image/png");
	return { url, b64: url.split(",")[1], img: await loadImg(url) };
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

/** Crop a variant to a bbox and alpha-feather its edges. */
function patch(
	img: HTMLImageElement,
	box: [number, number, number, number],
): string {
	const [y0, x0, y1, x1] = box;
	const sx = (x0 / 1000) * img.width;
	const sy = (y0 / 1000) * img.height;
	const sw = ((x1 - x0) / 1000) * img.width;
	const sh = ((y1 - y0) / 1000) * img.height;
	const c = canvas(Math.max(2, Math.round(sw)), Math.max(2, Math.round(sh)));
	const ctx = c.getContext("2d")!;
	const m = Math.max(2, Math.min(c.width, c.height) / 8);
	ctx.filter = `blur(${m / 2}px)`;
	ctx.fillStyle = "#fff";
	ctx.beginPath();
	ctx.roundRect(m, m, c.width - 2 * m, c.height - 2 * m, m);
	ctx.fill();
	ctx.filter = "none";
	ctx.globalCompositeOperation = "source-in";
	ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
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
	const [open, blink, bb] = await Promise.all([
		image(
			`${EDIT}the character is now mid-sentence, mouth clearly open showing teeth slightly as if pronouncing 'ah'. Same eyes, same expression otherwise.`,
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
	const mouthOpen = patch(open.img, mouth);
	return {
		src: base.url,
		mouthOpen,
		mouthHalf: mouthOpen,
		eyesClosed: patch(blink.img, eyes),
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
	addCustomLeader(leader);
	progress("The court assembles.", 1);
	return { ok: true, leader };
}
