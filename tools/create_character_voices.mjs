#!/usr/bin/env node
/**
 * Character Voice Designer for Chronicle.
 * Uses Google Gemini API (POST /v1beta/voices) to create custom vocal personas
 * tailored to each historical leader, advisor, and the narrator.
 *
 * Usage:
 *   node tools/create_character_voices.mjs [--character napoleon] [--list] [--test]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SAMPLES_DIR = path.join(ROOT, "public", "audio", "samples");
const VOICES_MAP_FILE = path.join(
	ROOT,
	"public",
	"data",
	"designed_voices.json",
);

// Ensure directories exist
fs.mkdirSync(SAMPLES_DIR, { recursive: true });
fs.mkdirSync(path.dirname(VOICES_MAP_FILE), { recursive: true });

const apiKey =
	process.env.GOOGLE_API_KEY ||
	process.env.GEMINI_API_KEY ||
	process.argv.find((a) => a.startsWith("--key="))?.split("=")[1];

const CHARACTERS = [
	{
		id: "narrator",
		name: "The Chronicler",
		gender: "male",
		description:
			"A timeless, deep, and evocative chronicle narrator with an omniscient, ancient resonance, dramatic solemn pacing, gravelly warmth, and classical oracular grandeur, recounting the rise and fall of civilizations like a Homeric bard.",
		testLine:
			"Welcome to the Chronicle. Before you lies the hinge of history. Make your decree.",
	},
	{
		id: "cleopatra",
		name: "Cleopatra VII",
		gender: "female",
		description:
			"A charismatic, regal 30-year-old Ptolemaic queen with an alluring Hellenistic Mediterranean Greek lilt. Seductive, measured, and razor-sharp, speaking with immense regal authority, serpentine intelligence, breathy elegance, and subtle aristocratic cadence.",
		testLine:
			"I will not be triumphed over. Alexandria is the jewel of the sea, and Rome shall know it.",
	},
	{
		id: "achillas",
		name: "Achillas",
		gender: "male",
		description:
			"A gruff, battle-hardened 40-year-old Spartan-trained royal guard commander. Blunt, gravelly, and rasping, barking orders in an aggressive Doric military cadence, impatient, loud, and demanding, perpetually eager for a siege.",
		testLine:
			"Words are wind, Majesty! Let my phalanx break their lines before sunset.",
	},
	{
		id: "apollodorus",
		name: "Apollodorus",
		gender: "male",
		description:
			"A silky, calculating Greek merchant-courtier and master of treasury. Possesses a smooth Hellenic Mediterranean cadence, soft-spoken yet razor-sharp, delivering precise financial reckonings with transactional elegance, quiet cunning, and dry wit.",
		testLine:
			"A subtle gift in Persian silk will buy us three legions without drawing a single blade.",
	},
	{
		id: "sosigenes",
		name: "Sosigenes",
		gender: "male",
		description:
			"A dreamy, erudite 50-year-old Alexandrian astronomer and cosmic high priest. Resonant, ethereal baritone with a contemplative, meditative cadence, speaking with scholastic wonder, astrological reverence, and subtle dry humor.",
		testLine:
			"The celestial sphere turns in immaculate harmony. Even empires must align with the stars.",
	},
	{
		id: "napoleon",
		name: "Napoleon Bonaparte",
		gender: "male",
		description:
			"An intense, fiery 35-year-old Corsican-French general and emperor. French-Corsican military cadence, clipped, rapid staccato delivery, commanding absolute obedience with relentless energy, razor-sharp authority, and brisk tactical genius.",
		testLine:
			"Impossible is a word found only in the dictionary of fools. We march across the Alps tonight.",
	},
	{
		id: "berthier",
		name: "Berthier",
		gender: "male",
		description:
			"An obsessive, meticulous 45-year-old chief of staff of the Grande Armée. Brisk French staff officer cadence, delivering rapid logistical jargon, dry, curt, clipped, and breathless with precision as he recites marching orders and map coordinates.",
		testLine:
			"Division coordinates locked at forty-five degrees north. Artillery carriages will reach the pass at dawn.",
	},
	{
		id: "gaudin",
		name: "Gaudin",
		gender: "male",
		description:
			"A dry, skeptical 50-year-old finance minister. Restrained French bureaucratic monotone, cautious, weary, allergic to deficits, weighing every sou with flinty skepticism and delivering fiscal warnings without an ounce of romantic illusion.",
		testLine:
			"Glory does not balance the ledger, First Consul. Our reserves cannot sustain another winter offensive.",
	},
	{
		id: "monge",
		name: "Monge",
		gender: "male",
		description:
			"An enthusiastic, spirited 55-year-old Enlightenment mathematician and savant. Spirited geometer with an animated, buoyant French academic cadence, speaking with rapid intellectual wonder and seeing geometric equations and ballistic parabolas everywhere.",
		testLine:
			"Look at the ballistic curvature, General! Science and victory are bound by the same equations.",
	},
	{
		id: "ashoka",
		name: "Emperor Ashoka",
		gender: "male",
		description:
			"A serene, deeply compassionate 40-year-old Mauryan emperor who renounced conquest. Serene Mauryan cadence, deeply resonant warm baritone with ancient Indian Prakrit inflection, speaking with philosophical warmth, profound stillness, and unshakeable moral authority.",
		testLine:
			"All men are my children. True victory is not won by the sword, but by Dhamma.",
	},
	{
		id: "sushimas_bane",
		name: "Sushima's Bane",
		gender: "male",
		description:
			"A battle-hardened 45-year-old Mauryan host general and veteran of the Kalinga wars. Husky, guttural baritone with a gruff, proud warrior's cadence, boastful and hearty, counting victories and spearheads with thunderous martial conviction.",
		testLine:
			"The war drums sound across the valley, Sire! Let the Mauryan host sweep the enemy into the river.",
	},
	{
		id: "radhagupta",
		name: "Radhagupta",
		gender: "male",
		description:
			"A shrewd, calculating 50-year-old Mauryan chief minister and kingmaker. Low, sibilant whispery cadence, razor-sharp Magadhan court diction, delivering subtle political riddles, iron statecraft, and pragmatic advice in measured murmurs.",
		testLine:
			"A crown is held by whispers before it is secured by armies. Keep your gaze upon the ministers.",
	},
	{
		id: "upagupta",
		name: "Upagupta",
		gender: "male",
		description:
			"A serene Buddhist monk and spiritual mentor. Measured, tranquil cadence, speaking slowly with peaceful breath, gentle teasing warmth, and deep quiet wisdom that cuts through worldly ambition.",
		testLine:
			"Does the river conquer the rock by fury, Majesty, or by steadfast gentle persistence?",
	},
	{
		id: "mansa_musa",
		name: "Mansa Musa",
		gender: "male",
		description:
			"A magnificent, deeply dignified 40-year-old Mali emperor. Deep, melodic Mandinka baritone, majestic, opulent and slow pacing, rich resonant warmth, radiating effortless imperial power, calm generosity, and pious nobility.",
		testLine:
			"The wealth of the earth is a trust bestowed by heaven. Let sixty thousand camels lead the pilgrimage.",
	},
	{
		id: "sagamandir",
		name: "Sagaman-dir",
		gender: "male",
		description:
			"A fierce, thunderous Mandinka general of the royal vanguard. Booming West African baritone, hearty bellowing laughter, fearless and aggressive warrior cadence that rings like clashing shields across the Sahel.",
		testLine:
			"No cavalry in the world can break our shield wall, Mansa! We strike when the sun reaches its zenith.",
	},
	{
		id: "farba",
		name: "Farba",
		gender: "male",
		description:
			"An extravagant, flamboyant royal treasurer and keeper of the gold mines. Smooth, animated Mandinka cadence, lavishly confident yet nervous of marketplace flux, weighing golden nuggets and treating gold dust like water.",
		testLine:
			"Another convoy of gold dust arrives from Bambuk. Weigh each pouch with care, lest a single grain be lost.",
	},
	{
		id: "alsahili",
		name: "Abu Ishaq al-Sahili",
		gender: "male",
		description:
			"An eloquent, cultured Andalusian poet-architect. Melodious Moorish-Arabic lilt, refined and lyrical, sighing in rhymed prose, elegant meter, and glowing architectural visions of sun-baked adobe and grand minarets.",
		testLine:
			"In the shadow of the great mosque, clay and timber rise like poetry beneath the desert sky.",
	},
	{
		id: "elizabeth",
		name: "Queen Elizabeth I",
		gender: "female",
		description:
			"A sharp, theatrical, razor-witted 40-year-old Tudor queen. Aristocratic Early Modern English diction, crisp received pronunciation, imperious cadence shifting with glittering intellect from icy quiet menace to righteous royal fury.",
		testLine:
			"I know I have the body of a weak and feeble woman, but I have the heart and stomach of a king!",
	},
	{
		id: "drake",
		name: "Francis Drake",
		gender: "male",
		description:
			"A salty, reckless 35-year-old privateer admiral. Salty West Country pirate swagger, hearty, gravelly Devon drawl, booming naval authority reeking of sea salt, tobacco, and cannon powder.",
		testLine:
			"Set all sail and run out the guns! The Spanish galleons won't escape on this tide, by God!",
	},
	{
		id: "cecil",
		name: "William Cecil",
		gender: "male",
		description:
			"A frail, venomous 60-year-old spymaster and Lord Burghley. Frail, whispery, chilling Tudor court cadence, quiet and venomous, measuring secrets, ciphered letters, and state executions with cold bureaucratic precision.",
		testLine:
			"Trust none who smile too warmly in the corridors of power, Your Grace. Treason wears a velvet cloak.",
	},
	{
		id: "dee",
		name: "John Dee",
		gender: "male",
		description:
			"A mystical, intense 50-year-old court astrologer and mathematician. Arcane mystical whispering, feverish cadence, murmuring of angelic scrying mirrors, celestial geometry, and esoteric prophecy with scholarly intensity.",
		testLine:
			"The celestial mirrors reveal geometric harmonies unseen by mortal eyes. The stars speak of your glory.",
	},
];

async function createVoice(char) {
	console.log(`\nDesigning voice for [${char.name}]...`);
	console.log(`Prompt: "${char.description}"`);

	const res = await fetch(
		"https://generativelanguage.googleapis.com/v1beta/voices",
		{
			method: "POST",
			headers: {
				"x-goog-api-key": apiKey,
				"content-type": "application/json",
			},
			body: JSON.stringify({
				store: true,
				voice: {
					model: "gemini-3.8-flash-tts",
					type: "prompted",
					display_name: char.name,
					gender: char.gender,
					language_code: "en-US",
					prompted: {
						input: char.description,
					},
				},
			}),
		},
	);

	if (!res.ok) {
		const err = await res.text();
		throw new Error(
			`Failed to create voice for ${char.name} (${res.status}): ${err}`,
		);
	}

	const data = await res.json();
	const voiceId = data.id || data.name?.replace("voices/", "");
	console.log(`✓ Voice created successfully: ${voiceId}`);

	if (data.sample_audio?.data) {
		const samplePath = path.join(SAMPLES_DIR, `${char.id}.wav`);
		fs.writeFileSync(samplePath, Buffer.from(data.sample_audio.data, "base64"));
		console.log(`✓ Audition preview audio written to: ${samplePath}`);
	}

	return voiceId;
}

async function main() {
	const args = process.argv.slice(2);
	if (args.includes("--list")) {
		console.log("Characters available for Voice Design:");
		for (const c of CHARACTERS) {
			console.log(` - ${c.id.padEnd(14)}: ${c.name} (${c.gender})`);
		}
		return;
	}

	if (!apiKey) {
		console.error("Error: GOOGLE_API_KEY environment variable is required.");
		console.error(
			"Usage: GOOGLE_API_KEY=... node tools/create_character_voices.mjs",
		);
		process.exit(1);
	}

	const targetChar = args
		.find((a) => a.startsWith("--character="))
		?.split("=")[1];
	const selected = targetChar
		? CHARACTERS.filter((c) => c.id === targetChar)
		: CHARACTERS;

	if (selected.length === 0) {
		console.error(
			`Character "${targetChar}" not found. Run with --list to see options.`,
		);
		process.exit(1);
	}

	let existing = {};
	if (fs.existsSync(VOICES_MAP_FILE)) {
		try {
			existing = JSON.parse(fs.readFileSync(VOICES_MAP_FILE, "utf-8"));
		} catch {}
	}

	for (const char of selected) {
		try {
			const voiceId = await createVoice(char);
			existing[char.id] = {
				voiceId,
				displayName: char.name,
				gender: char.gender,
				updatedAt: new Date().toISOString(),
			};
			fs.writeFileSync(VOICES_MAP_FILE, JSON.stringify(existing, null, 2));
		} catch (e) {
			console.error(`✗ Error on ${char.name}:`, e.message);
		}
	}

	console.log(`\nAll done! Updated voices saved in ${VOICES_MAP_FILE}`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
