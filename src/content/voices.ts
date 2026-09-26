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
