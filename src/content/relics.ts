import type { Relic } from "../types.ts";

export const RELICS: Relic[] = [
	{
		id: "relic_cleopatra",
		name: "Scarab of Khepri",
		leaderId: "cleopatra",
		icon: "🪲",
		desc: "+1 Gold for every winning wager placed with the Oracle.",
		lore: "An amulet of gold and lapis lazuli inscribed with Alexandria's royal cartouche, invoking the eternal rebirth of the Nile.",
	},
	{
		id: "relic_napoleon",
		name: "Eagle of Austerlitz",
		leaderId: "napoleon",
		icon: "🦅",
		desc: "War decisions grant +1 additional Stability.",
		lore: "The bronze standard that guided imperial columns through the frozen mists of Moravia.",
	},
	{
		id: "relic_ashoka",
		name: "Dharma Chakra",
		leaderId: "ashoka",
		icon: "☸️",
		desc: "Pacifies popular revolt by restoring +3 Stability (once per reign).",
		lore: "The twenty-four spoked wheel of righteousness carved into sandstone edict pillars across ancient India.",
	},
	{
		id: "relic_mansa_musa",
		name: "Ingot of Timbuktu",
		leaderId: "mansa_musa",
		icon: "🪙",
		desc: "Begin each reign with 7 Gold instead of 5.",
		lore: "A pure gold bullion of Mali, whose lavish distribution in Cairo depressed Mediterranean gold markets for decades.",
	},
	{
		id: "relic_elizabeth",
		name: "Tudor Sceptre",
		leaderId: "elizabeth",
		icon: "👑",
		desc: "Automatically recharges one Royal Seal at the dawn of each new chapter.",
		lore: "The pearl-encrusted regalia that commanded the golden age of the Virgin Queen.",
	},
	{
		id: "relic_caesar",
		name: "Laurel Wreath of Rome",
		icon: "🌿",
		desc: "Unmasking a treacherous advisor awards +3 Legacy instead of +2.",
		lore: "The civic crown of Roman triumphators, worn by those who discern conspirators before the Senate falls.",
	},
	{
		id: "relic_alexander",
		name: "Gordian Knot",
		icon: "⚔️",
		desc: "A lost Oracle wager preserves your streak at 1x combo instead of resetting.",
		lore: "The mythical knot of Phrygia cleaved by the conqueror's blade to claim dominion over Asia.",
	},
	{
		id: "relic_hammurabi",
		name: "Stele of Hammurabi",
		icon: "📜",
		desc: "Every decision aligned with history fortifies the realm (+1 Stability).",
		lore: "The black diorite monolith upon which Babylon chiseled the foundational tenets of justice.",
	},
];

export function getLeaderDefaultRelic(leaderId: string): string | null {
	const match = RELICS.find((r) => r.leaderId === leaderId);
	return match ? match.id : null;
}
