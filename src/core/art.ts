import type Phaser from "phaser";
import type { AdvisorRole, ArtManifest, BBox, Leader } from "../types.ts";
import type { PortraitKeys } from "../ui/Portrait.ts";

export let manifest: ArtManifest = {};
export const setManifest = (m: ArtManifest) => {
	manifest = m;
};

const ROLES: AdvisorRole[] = ["war", "gold", "faith"];

export const texKey = (leaderId: string, name: string) => `${leaderId}/${name}`;

/** Queue every image of a leader into the scene loader (manifest for default leaders, data URLs for summoned ones). */
export function queueLeaderArt(scene: Phaser.Scene, leader: Leader) {
	const has = (k: string) => scene.textures.exists(k);
	const load = scene.load;
	if (leader.art) {
		const a = leader.art;
		const chars: [string, typeof a.leader][] = [
			["leader", a.leader],
			...ROLES.map((r) => [r, a.advisors[r]] as [string, typeof a.leader]),
		];
		for (const [k, c] of chars) {
			if (!has(texKey(leader.id, k))) load.image(texKey(leader.id, k), c.src);
			if (!has(texKey(leader.id, `${k}_mouth_open`)))
				load.image(texKey(leader.id, `${k}_mouth_open`), c.mouthOpen);
			if (!has(texKey(leader.id, `${k}_mouth_half`)))
				load.image(texKey(leader.id, `${k}_mouth_half`), c.mouthHalf);
			if (!has(texKey(leader.id, `${k}_eyes_closed`)))
				load.image(texKey(leader.id, `${k}_eyes_closed`), c.eyesClosed);
		}
		if (!has(texKey(leader.id, "scene")))
			load.image(texKey(leader.id, "scene"), a.scene);
		if (!has(texKey(leader.id, "scene_far")))
			load.image(texKey(leader.id, "scene_far"), a.sceneFar);
		return;
	}
	const m = manifest[leader.id];
	if (!m) return;
	const dir = `art/${leader.id}`;
	for (const k of ["leader", ...ROLES]) {
		for (const v of ["", "_mouth_open", "_mouth_half", "_eyes_closed"]) {
			const key = texKey(leader.id, `${k}${v}`);
			if (!has(key)) load.image(key, `${dir}/${k}${v}.webp`);
		}
	}
	if (!has(texKey(leader.id, "scene")))
		load.image(texKey(leader.id, "scene"), `${dir}/scene.webp`);
	if (!has(texKey(leader.id, "scene_far")))
		load.image(texKey(leader.id, "scene_far"), `${dir}/scene_far.webp`);
}

export function portraitKeys(
	leader: Leader,
	who: "leader" | AdvisorRole,
): PortraitKeys {
	let bbox: BBox;
	if (leader.art)
		bbox =
			who === "leader" ? leader.art.leader.bbox : leader.art.advisors[who].bbox;
	else {
		const m = manifest[leader.id];
		bbox = who === "leader" ? m.leader.bbox : m.advisors[who].bbox;
	}
	return {
		base: texKey(leader.id, who),
		mouthOpen: texKey(leader.id, `${who}_mouth_open`),
		mouthHalf: texKey(leader.id, `${who}_mouth_half`),
		eyesClosed: texKey(leader.id, `${who}_eyes_closed`),
		bbox,
	};
}

export const sceneKeys = (leader: Leader) => ({
	near: texKey(leader.id, "scene"),
	far: texKey(leader.id, "scene_far"),
});
