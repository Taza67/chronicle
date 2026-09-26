export interface Petition {
	id: string;
	petitioner: string;
	icon: string;
	title: string;
	request: string;
	rejectLabel: string;
	rejectEffects: { gold: number; stability: number };
	acceptLabel: string;
	acceptEffects: { gold: number; stability: number };
}

export const PETITIONS: Petition[] = [
	{
		id: "grain_tax",
		petitioner: "Guild of Millers & Bakers",
		icon: "🌾",
		title: "Mill Grain Levy",
		request:
			"Bread prices are surging and the commons rumble with discontent. The guild implores a temporary relief from the crown's grain levy.",
		rejectLabel: "Deny Relief",
		rejectEffects: { gold: 1, stability: -1 },
		acceptLabel: "Lower the Levy",
		acceptEffects: { gold: -1, stability: 1 },
	},
	{
		id: "foreign_merchants",
		petitioner: "Caravaneers of the Spice Route",
		icon: "🪙",
		title: "Imperial Warehouse Charter",
		request:
			"Wealthy merchants from the East offer a heavy purse of gold in exchange for an exclusive royal charter at the grand bazaar.",
		rejectLabel: "Protect Local Guilds",
		rejectEffects: { gold: 0, stability: 1 },
		acceptLabel: "Accept the Gold",
		acceptEffects: { gold: 2, stability: -1 },
	},
	{
		id: "guard_bonus",
		petitioner: "Captain of the Watch",
		icon: "⚔️",
		title: "Garrison Winter Stipend",
		request:
			"Sentinels freeze upon the city battlements and petition for a winter bonus to maintain unwavering vigilance against infiltrators.",
		rejectLabel: "Duty is Enough",
		rejectEffects: { gold: 0, stability: -1 },
		acceptLabel: "Disburse the Bonus",
		acceptEffects: { gold: -1, stability: 1 },
	},
	{
		id: "temple_repair",
		petitioner: "Priesthood of the High Altar",
		icon: "🏛️",
		title: "Colonnade Restoration",
		request:
			"Lightning has split the sacred marble pillars. The faithful beseech a royal tithe to restore the sanctum and ward off divine wrath.",
		rejectLabel: "The Coffers are Shut",
		rejectEffects: { gold: 0, stability: -1 },
		acceptLabel: "Bless the Works",
		acceptEffects: { gold: -1, stability: 1 },
	},
	{
		id: "smugglers_bounty",
		petitioner: "River Patrol Warden",
		icon: "⚓",
		title: "Corsair Cargo Pardon",
		request:
			"A captured contraband fleet offers to forfeit its entire illicit haul of silk and spices if the Crown grants a royal pardon.",
		rejectLabel: "Justice Above Coin",
		rejectEffects: { gold: 0, stability: 1 },
		acceptLabel: "Seize the Cargo",
		acceptEffects: { gold: 2, stability: -1 },
	},
	{
		id: "scholars_grant",
		petitioner: "Scribes & Astronomers",
		icon: "📜",
		title: "Celestial Chart Translation",
		request:
			"Nomadic cartographers have brought unknown oceanic maps. The scribes seek royal patron funds to copy and catalog them.",
		rejectLabel: "Idle Curiosities",
		rejectEffects: { gold: 0, stability: 0 },
		acceptLabel: "Acquire the Knowledge",
		acceptEffects: { gold: -1, stability: 1 },
	},
	{
		id: "noble_banquet",
		petitioner: "Grand Peers of the Realm",
		icon: "👑",
		title: "Imperial State Banquet",
		request:
			"Court lords demand a lavish imperial banquet to flaunt the dynasty's splendour and intimidate visiting foreign ambassadors.",
		rejectLabel: "The Court Shall Fast",
		rejectEffects: { gold: 1, stability: -1 },
		acceptLabel: "Host the Feast",
		acceptEffects: { gold: -2, stability: 2 },
	},
];

export function getRandomPetitions(count = 3): Petition[] {
	const shuffled = [...PETITIONS].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, count);
}
