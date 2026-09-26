import type { Leader } from "../types.ts";
import { VOICES } from "./voices.ts";

export const STYLE =
	"Stylized painted portrait in the art style of Civilization VI leader screens: bold saturated colors, soft painterly shading, slightly exaggerated proportions, confident expression, mouth closed, eyes open looking at the viewer, waist-up, centered, on a plain dark gradient backdrop, no text, no frame.";

export const SCENE_STYLE =
	"Painted background illustration in the art style of Civilization VI, wide establishing shot, no people, soft depth, atmospheric light, rich color, no text.";

export const LEADERS: Leader[] = [
	{
		id: "cleopatra",
		name: "Cleopatra VII",
		civ: "Ptolemaic Egypt",
		era: "51–30 BC",
		quote: "I will not be triumphed over.",
		voice: VOICES.saoirse,
		palette: { primary: "#0f6f7a", accent: "#e0b64a", bg: "#062a33" },
		advisors: [
			{
				role: "war",
				name: "Achillas",
				title: "Commander of the Royal Guard",
				trait: "blunt, impatient, loves a good siege",
				voice: VOICES.marcus,
			},
			{
				role: "gold",
				name: "Apollodorus",
				title: "Master of the Treasury",
				trait: "silky, calculating, counts everything twice",
				voice: VOICES.toby,
			},
			{
				role: "faith",
				name: "Sosigenes",
				title: "Astronomer and High Priest",
				trait: "dreamy scholar, quotes the stars, secretly funny",
				voice: VOICES.declan,
			},
		],
		portraitPrompt:
			"Cleopatra VII, queen of Egypt, golden vulture headdress with uraeus, kohl eyes, lapis and gold jewellery, teal and gold tones.",
		scenePrompt:
			"Interior of the royal palace of Alexandria at dusk, marble columns with lotus capitals, view of the harbour and the Lighthouse of Pharos, teal sea, warm torchlight, gold accents.",
		musicPrompt:
			"Ancient Egyptian court ambience: oud, ney flute, frame drums, low sustained strings, regal and mysterious, slow tempo, loopable.",
	},
	{
		id: "napoleon",
		name: "Napoleon Bonaparte",
		civ: "French Empire",
		era: "1799–1815",
		quote: "Impossible is a word found only in the dictionary of fools.",
		voice: VOICES.sterling,
		palette: { primary: "#1f3a93", accent: "#d4af37", bg: "#0d1633" },
		advisors: [
			{
				role: "war",
				name: "Berthier",
				title: "Chief of Staff of the Grande Armée",
				trait: "obsessive planner, mutters map coordinates",
				voice: VOICES.reuben,
			},
			{
				role: "gold",
				name: "Gaudin",
				title: "Minister of Finance",
				trait: "dry, cautious, allergic to deficits",
				voice: VOICES.archie,
			},
			{
				role: "faith",
				name: "Monge",
				title: "Savant and Senator",
				trait: "enthusiastic geometer, sees equations everywhere",
				voice: VOICES.damon,
			},
		],
		portraitPrompt:
			"Napoleon Bonaparte in his green colonel uniform of the Chasseurs with red collar, bicorne hat, hand behind back, imperial blue and gold tones.",
		scenePrompt:
			"Grand hall of the Tuileries Palace, winter light through tall windows, imperial eagles, blue velvet and gilded mouldings, maps spread on a table, candlelight.",
		musicPrompt:
			"Napoleonic era military-romantic theme: snare drums, French horns, strings, harpsichord accents, stately and ambitious, loopable.",
	},
	{
		id: "ashoka",
		name: "Ashoka",
		civ: "Maurya Empire",
		era: "268–232 BC",
		quote: "All men are my children.",
		voice: VOICES.cormac,
		palette: { primary: "#b7410e", accent: "#f2c14e", bg: "#2b1206" },
		advisors: [
			{
				role: "war",
				name: "Sushima's Bane",
				title: "General of the Mauryan Host",
				trait: "proud veteran, counts victories on his fingers",
				voice: VOICES.marcus,
			},
			{
				role: "gold",
				name: "Radhagupta",
				title: "Chief Minister",
				trait: "wily kingmaker, always has a scroll ready",
				voice: VOICES.toby,
			},
			{
				role: "faith",
				name: "Upagupta",
				title: "Buddhist Monk",
				trait: "serene, gently teasing, speaks in questions",
				voice: VOICES.declan,
			},
		],
		portraitPrompt:
			"Emperor Ashoka of the Maurya dynasty, saffron and deep red silk robes, gold torque, turban with jewel, wise compassionate face, warm orange tones.",
		scenePrompt:
			"Palace terrace of Pataliputra at golden hour, carved sandstone pillars with lion capitals, banyan trees, the Ganges river beyond, saffron banners, incense smoke.",
		musicPrompt:
			"Ancient India meditative court music: sitar, bansuri flute, tanpura drone, soft tabla, serene and majestic, loopable.",
	},
	{
		id: "mansa_musa",
		name: "Mansa Musa",
		civ: "Mali Empire",
		era: "1312–1337",
		quote: "Gold is the dust of my roads.",
		voice: VOICES.marcus,
		palette: { primary: "#c47a12", accent: "#ffd166", bg: "#2e1a05" },
		advisors: [
			{
				role: "war",
				name: "Sagaman-dir",
				title: "General of the Mansa",
				trait: "boisterous, brags about the Gao campaign",
				voice: VOICES.sterling,
			},
			{
				role: "gold",
				name: "Farba",
				title: "Keeper of the Gold Mines",
				trait: "nervous about prices, weighs every nugget",
				voice: VOICES.reuben,
			},
			{
				role: "faith",
				name: "al-Sahili",
				title: "Poet and Architect",
				trait: "flamboyant, dreams in domes and verses",
				voice: VOICES.cormac,
			},
		],
		portraitPrompt:
			"Mansa Musa, emperor of Mali, golden crown, flowing white and gold robes, holding a gold nugget and sceptre, radiant warm gold and amber tones.",
		scenePrompt:
			"Timbuktu at sunset, the Djinguereber mosque in adobe with wooden beams, camel caravan arriving through golden sand haze, market tents, warm amber light.",
		musicPrompt:
			"West African Mali empire ambience: kora, balafon, djembe, ngoni, warm and dignified, mid-slow tempo, loopable.",
	},
	{
		id: "elizabeth",
		name: "Elizabeth I",
		civ: "Tudor England",
		era: "1558–1603",
		quote:
			"I know I have the body of a weak and feeble woman, but I have the heart of a king.",
		voice: VOICES.maeve,
		palette: { primary: "#7a1b2e", accent: "#e6c67a", bg: "#1c0a10" },
		advisors: [
			{
				role: "war",
				name: "Walsingham",
				title: "Spymaster",
				trait: "whispering, paranoid, sees plots in every cup of wine",
				voice: VOICES.archie,
			},
			{
				role: "gold",
				name: "Burghley",
				title: "Lord Treasurer",
				trait: "fatherly, penny-pinching, sighs a lot",
				voice: VOICES.toby,
			},
			{
				role: "faith",
				name: "Dee",
				title: "Court Astrologer",
				trait: "eccentric mystic, talks to angels, oddly practical",
				voice: VOICES.damon,
			},
		],
		portraitPrompt:
			"Queen Elizabeth I of England, red curled hair, white lace ruff collar, pearl-encrusted crimson and gold gown, pale face, sharp intelligent eyes, crimson and gold tones.",
		scenePrompt:
			"Great hall of Hampton Court Palace, Tudor oak panelling, tapestries, leaded windows with misty morning light, a globe and sea charts, candle chandeliers.",
		musicPrompt:
			"Elizabethan renaissance court music: lute, viol consort, recorder, gentle tabor, elegant and slightly mysterious, loopable.",
	},
];

export const LEADER_BY_ID = Object.fromEntries(LEADERS.map((l) => [l.id, l]));
