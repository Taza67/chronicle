import type { Leader } from "../types.ts";
import { music as generateMusic, online } from "./api.ts";
import { audio } from "./audio.ts";

async function local(id: string): Promise<ArrayBuffer | null> {
	try {
		const r = await fetch(`music/${id}.mp3`);
		return r.ok ? await r.arrayBuffer() : null;
	} catch {
		return null;
	}
}

/** Bundled Lyria loop for default leaders; generated on demand (Worker + KV cache) for summoned ones. */
export function playLeaderMusic(leader: Leader) {
	void audio.playMusic(leader.id, async () => {
		const l = await local(leader.id);
		if (l) return l;
		if (online()) return generateMusic(leader.musicPrompt, leader.id);
		return local("cleopatra");
	});
}

export const playTitleMusic = () =>
	void audio.playMusic("title", () => local("elizabeth"));
