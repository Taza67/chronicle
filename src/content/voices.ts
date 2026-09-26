/** Gradium flagship voice ids (English). */
export const VOICES = {
	narrator: "POBHtemksfWQbng0", // Garrett — smooth, low
	// masculine
	marcus: "r2sIQdqqoqgRJuXw", // resonant, conviction
	sterling: "6MFfc37kq0sBjBjy", // theatrical
	toby: "dME3IWyZBvmh1n1q", // British, sparky
	reuben: "CF0NgaMwHMMrHZn0", // British, upbeat
	declan: "I7GYfpcKbafFrYUv", // Irish, calm
	cormac: "JuMRs5W5S52hzuge", // Irish, warm
	damon: "KUpE0JVhjiIzp1Fk", // bright, excited
	archie: "kfzLbcdE_yXgLeUI", // British, warm
	// feminine
	saoirse: "gqn4ytOULe-TQfjl", // Irish, expressive
	maeve: "6PWnV0Nq4wu7RVBT", // British, sharp
	harper: "4SZHfMpw-p46Ywgs", // American, confident
	tilly: "4rdlkbxRv4m3UQTW", // British, warm
	aoife: "vimnD4UQG_36P43U", // Irish, lively
} as const;

export type VoiceName = keyof typeof VOICES;

export const MASCULINE: VoiceName[] = [
	"marcus",
	"sterling",
	"toby",
	"reuben",
	"declan",
	"cormac",
	"damon",
	"archie",
];
export const FEMININE: VoiceName[] = [
	"saoirse",
	"maeve",
	"harper",
	"tilly",
	"aoife",
];

export interface CharacterVoicePersona {
	id: string;
	displayName: string;
	gender: "male" | "female";
	description: string;
	defaultVoice: VoiceName;
}

/**
 * Rich personality & vocal prompts for each major character in Chronicle.
 * Used by Voice Design (`tools/create_character_voices.mjs` / `POST /voice/design`)
 * to generate bespoke, dedicated voice models.
 */
export const CHARACTER_PERSONAS: Record<string, CharacterVoicePersona> = {
	narrator: {
		id: "narrator",
		displayName: "The Chronicler",
		gender: "male",
		description:
			"A timeless, deep, and evocative chronicle narrator with an omniscient, ancient resonance, dramatic solemn pacing, gravelly warmth, and classical oracular grandeur, recounting the rise and fall of civilizations like a Homeric bard.",
		defaultVoice: "narrator",
	},
	cleopatra: {
		id: "cleopatra",
		displayName: "Cleopatra VII",
		gender: "female",
		description:
			"A charismatic, regal 30-year-old Ptolemaic queen with an alluring Hellenistic Mediterranean Greek lilt. Seductive, measured, and razor-sharp, speaking with immense regal authority, serpentine intelligence, breathy elegance, and subtle aristocratic cadence.",
		defaultVoice: "saoirse",
	},
	achillas: {
		id: "achillas",
		displayName: "Achillas",
		gender: "male",
		description:
			"A gruff, battle-hardened 40-year-old Spartan-trained royal guard commander. Blunt, gravelly, and rasping, barking orders in an aggressive Doric military cadence, impatient, loud, and demanding, perpetually eager for a siege.",
		defaultVoice: "marcus",
	},
	apollodorus: {
		id: "apollodorus",
		displayName: "Apollodorus",
		gender: "male",
		description:
			"A silky, calculating Greek merchant-courtier and master of treasury. Possesses a smooth Hellenic Mediterranean cadence, soft-spoken yet razor-sharp, delivering precise financial reckonings with transactional elegance, quiet cunning, and dry wit.",
		defaultVoice: "toby",
	},
	sosigenes: {
		id: "sosigenes",
		displayName: "Sosigenes",
		gender: "male",
		description:
			"A dreamy, erudite 50-year-old Alexandrian astronomer and cosmic high priest. Resonant, ethereal baritone with a contemplative, meditative cadence, speaking with scholastic wonder, astrological reverence, and subtle dry humor.",
		defaultVoice: "declan",
	},
	napoleon: {
		id: "napoleon",
		displayName: "Napoleon Bonaparte",
		gender: "male",
		description:
			"An intense, fiery 35-year-old Corsican-French general and emperor. French-Corsican military cadence, clipped, rapid staccato delivery, commanding absolute obedience with relentless energy, razor-sharp authority, and brisk tactical genius.",
		defaultVoice: "sterling",
	},
	berthier: {
		id: "berthier",
		displayName: "Berthier",
		gender: "male",
		description:
			"An obsessive, meticulous 45-year-old chief of staff of the Grande Armée. Brisk French staff officer cadence, delivering rapid logistical jargon, dry, curt, clipped, and breathless with precision as he recites marching orders and map coordinates.",
		defaultVoice: "reuben",
	},
	gaudin: {
		id: "gaudin",
		displayName: "Gaudin",
		gender: "male",
		description:
			"A dry, skeptical 50-year-old finance minister. Restrained French bureaucratic monotone, cautious, weary, allergic to deficits, weighing every sou with flinty skepticism and delivering fiscal warnings without an ounce of romantic illusion.",
		defaultVoice: "archie",
	},
	monge: {
		id: "monge",
		displayName: "Monge",
		gender: "male",
		description:
			"An enthusiastic, spirited 55-year-old Enlightenment mathematician and savant. Spirited geometer with an animated, buoyant French academic cadence, speaking with rapid intellectual wonder and seeing geometric equations and ballistic parabolas everywhere.",
		defaultVoice: "damon",
	},
	ashoka: {
		id: "ashoka",
		displayName: "Emperor Ashoka",
		gender: "male",
		description:
			"A serene, deeply compassionate 40-year-old Mauryan emperor who renounced conquest. Serene Mauryan cadence, deeply resonant warm baritone with ancient Indian Prakrit inflection, speaking with philosophical warmth, profound stillness, and unshakeable moral authority.",
		defaultVoice: "cormac",
	},
	sushimas_bane: {
		id: "sushimas_bane",
		displayName: "Sushima's Bane",
		gender: "male",
		description:
			"A battle-hardened 45-year-old Mauryan host general and veteran of the Kalinga wars. Husky, guttural baritone with a gruff, proud warrior's cadence, boastful and hearty, counting victories and spearheads with thunderous martial conviction.",
		defaultVoice: "marcus",
	},
	radhagupta: {
		id: "radhagupta",
		displayName: "Radhagupta",
		gender: "male",
		description:
			"A shrewd, calculating 50-year-old Mauryan chief minister and kingmaker. Low, sibilant whispery cadence, razor-sharp Magadhan court diction, delivering subtle political riddles, iron statecraft, and pragmatic advice in measured murmurs.",
		defaultVoice: "toby",
	},
	upagupta: {
		id: "upagupta",
		displayName: "Upagupta",
		gender: "male",
		description:
			"A serene Buddhist monk and spiritual mentor. Measured, tranquil cadence, speaking slowly with peaceful breath, gentle teasing warmth, and deep quiet wisdom that cuts through worldly ambition.",
		defaultVoice: "declan",
	},
	mansa_musa: {
		id: "mansa_musa",
		displayName: "Mansa Musa",
		gender: "male",
		description:
			"A magnificent, deeply dignified 40-year-old Mali emperor. Deep, melodic Mandinka baritone, majestic, opulent and slow pacing, rich resonant warmth, radiating effortless imperial power, calm generosity, and pious nobility.",
		defaultVoice: "marcus",
	},
	sagamandir: {
		id: "sagamandir",
		displayName: "Sagaman-dir",
		gender: "male",
		description:
			"A fierce, thunderous Mandinka general of the royal vanguard. Booming West African baritone, hearty bellowing laughter, fearless and aggressive warrior cadence that rings like clashing shields across the Sahel.",
		defaultVoice: "sterling",
	},
	farba: {
		id: "farba",
		displayName: "Farba",
		gender: "male",
		description:
			"An extravagant, flamboyant royal treasurer and keeper of the gold mines. Smooth, animated Mandinka cadence, lavishly confident yet nervous of marketplace flux, weighing golden nuggets and treating gold dust like water.",
		defaultVoice: "reuben",
	},
	alsahili: {
		id: "alsahili",
		displayName: "Abu Ishaq al-Sahili",
		gender: "male",
		description:
			"An eloquent, cultured Andalusian poet-architect. Melodious Moorish-Arabic lilt, refined and lyrical, sighing in rhymed prose, elegant meter, and glowing architectural visions of sun-baked adobe and grand minarets.",
		defaultVoice: "cormac",
	},
	elizabeth: {
		id: "elizabeth",
		displayName: "Queen Elizabeth I",
		gender: "female",
		description:
			"A sharp, theatrical, razor-witted 40-year-old Tudor queen. Aristocratic Early Modern English diction, crisp received pronunciation, imperious cadence shifting with glittering intellect from icy quiet menace to righteous royal fury.",
		defaultVoice: "maeve",
	},
	drake: {
		id: "drake",
		displayName: "Francis Drake",
		gender: "male",
		description:
			"A salty, reckless 35-year-old privateer admiral. Salty West Country pirate swagger, hearty, gravelly Devon drawl, booming naval authority reeking of sea salt, tobacco, and cannon powder.",
		defaultVoice: "archie",
	},
	cecil: {
		id: "cecil",
		displayName: "William Cecil",
		gender: "male",
		description:
			"A frail, venomous 60-year-old spymaster and Lord Burghley. Frail, whispery, chilling Tudor court cadence, quiet and venomous, measuring secrets, ciphered letters, and state executions with cold bureaucratic precision.",
		defaultVoice: "toby",
	},
	dee: {
		id: "dee",
		displayName: "John Dee",
		gender: "male",
		description:
			"A mystical, intense 50-year-old court astrologer and mathematician. Arcane mystical whispering, feverish cadence, murmuring of angelic scrying mirrors, celestial geometry, and esoteric prophecy with scholarly intensity.",
		defaultVoice: "damon",
	},
};
