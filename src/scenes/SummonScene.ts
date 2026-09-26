import Phaser from "phaser";
import { VOICES } from "../content/voices.ts";
import { online } from "../core/api.ts";
import { audio } from "../core/audio.ts";
import { micSupported } from "../core/recorder.ts";
import { say } from "../core/speech.ts";
import { newGame, saveGame } from "../core/state.ts";
import { summon } from "../core/summon.ts";
import {
	body,
	COLORS,
	FONT,
	H,
	hex,
	SAFE_BOTTOM,
	SAFE_TOP,
	title,
	ui,
	W,
} from "../ui/theme.ts";
import { VoiceResonator } from "../ui/VoiceResonator.ts";
import {
	Button,
	fadeIn,
	go,
	heading,
	iconButton,
	Subtitle,
	toast,
} from "../ui/widgets.ts";

const EXAMPLES = [
	"Charlemagne",
	"Wu Zetian",
	"Suleiman the Magnificent",
	"Queen Nzinga",
	"Tokugawa Ieyasu",
	"Hatshepsut",
	"Genghis Khan",
	"Catherine the Great",
];

/** Leader-on-demand: type or speak a name; the Royal Archivist judges, painters paint. */
export class SummonScene extends Phaser.Scene {
	private field!: HTMLInputElement;
	private busy = false;
	private prefill = "";

	constructor() {
		super("Summon");
	}

	init(data: { prefill?: string }) {
		this.prefill = data?.prefill ?? "";
	}

	create() {
		fadeIn(this);
		const bg = this.add.image(W / 2, H / 2, "title_bg");
		bg.setScale(Math.max(W / bg.width, H / bg.height) * 1.1).setAlpha(0.3);
		this.add.image(W / 2, H / 2, "vignette").setDisplaySize(W, H);
		heading(this, SAFE_TOP + 24, "Summon a leader", 34);
		iconButton(this, 60, SAFE_TOP + 24, "‹", () => go(this, "Select"));
		this.add
			.text(
				W / 2,
				200,
				"Name any ruler who truly lived.\nThe Royal Archivist will decide.",
				{ ...body(30, hex(COLORS.text)), align: "center" },
			)
			.setOrigin(0.5);

		if (!online()) {
			this.add
				.text(
					W / 2,
					H * 0.45,
					"The archives need a connection.\nThe five default leaders await you meanwhile.",
					{ ...body(26, hex(COLORS.muted)), align: "center" },
				)
				.setOrigin(0.5);
			new Button(this, W / 2, H * 0.6, "Back", () => go(this, "Select"), {
				primary: false,
			});
			return;
		}

		const el = document.createElement("input");
		el.type = "text";
		el.placeholder = EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)];
		el.value = this.prefill;
		el.autocomplete = "off";
		el.maxLength = 60;
		el.style.cssText = `position:fixed;box-sizing:border-box;width:${W - 120}px;height:84px;border-radius:18px;border:3px solid ${hex(COLORS.gold)};background:rgba(20,16,32,.85);color:${hex(COLORS.text)};font:600 32px ${FONT.body};padding:0 28px;outline:none;text-align:center;transform-origin:0 0;z-index:10;`;
		document.body.appendChild(el);
		this.field = el;
		// Follow the scaled canvas (Phaser's DOM container drifts under FIT + autoCenter on mobile).
		const place = () => {
			const r = this.game.canvas.getBoundingClientRect();
			const s = r.width / W;
			el.style.left = `${r.left + 60 * s}px`;
			el.style.top = `${r.top + (320 - 42) * s}px`;
			el.style.transform = `scale(${s})`;
		};
		place();
		this.events.on(Phaser.Scenes.Events.UPDATE, place);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => el.remove());
		el.addEventListener("keydown", (e) => {
			if (e.key === "Enter") void this.go(el.value);
		});

		new Button(this, W / 2, 440, "Summon", () => void this.go(el.value), {
			w: 320,
		});
		if (micSupported())
			new Button(
				this,
				W / 2,
				530,
				"🎙  Say the name",
				() => void this.listen(el),
				{ w: 320, h: 64, primary: false, size: 22 },
			);

		// suggestion chips
		const chips = Phaser.Utils.Array.Shuffle([...EXAMPLES]).slice(0, 6);
		chips.forEach((name, i) => {
			const x = W / 2 + ((i % 2) - 0.5) * 300;
			const y = 640 + Math.floor(i / 2) * 64;
			const t = this.add
				.text(x, y, name, ui(20, hex(COLORS.gold)))
				.setOrigin(0.5)
				.setInteractive({ useHandCursor: true });
			const g = this.add.graphics();
			g.lineStyle(1.5, COLORS.gold, 0.5);
			g.strokeRoundedRect(x - t.width / 2 - 18, y - 22, t.width + 36, 44, 22);
			t.on("pointerup", () => {
				el.value = name;
				void this.go(name);
			});
		});
		this.add
			.text(
				W / 2,
				H - SAFE_BOTTOM - 20,
				"Portraits, court and voices are generated live — about a minute.",
				ui(17, hex(COLORS.muted)),
			)
			.setOrigin(0.5);
	}

	private async listen(el: HTMLInputElement) {
		const resonator = new VoiceResonator(this, {
			title: "VOX SUMMONS",
			prompt: "Speak the name of a ruler or legend",
			maxSeconds: 5,
			onTranscript: async (transcript) => {
				const text = transcript.replace(/[.!?]$/, "").trim();
				if (!text) return false;
				el.value = text;
				void this.go(text);
				return {
					ok: true,
					kind: "custom",
					label: text,
				};
			},
		});
		await resonator.run();
	}

	private async go(raw: string) {
		const request = raw.trim();
		if (!request || this.busy) return;
		this.busy = true;
		audio.unlock();
		this.field.style.display = "none";
		this.field.blur();
		const shade = this.add
			.rectangle(W / 2, H / 2, W, H, COLORS.night, 0.88)
			.setDepth(90)
			.setInteractive();
		const label = this.add
			.text(W / 2, H * 0.46, "", {
				...title(28, hex(COLORS.gold)),
				fontStyle: "500",
				align: "center",
				wordWrap: { width: W - 120 },
			})
			.setOrigin(0.5)
			.setDepth(91);
		const barBg = this.add
			.rectangle(W / 2, H * 0.53, 460, 10, 0x000000, 0.6)
			.setDepth(91);
		const bar = this.add
			.rectangle(W / 2 - 230, H * 0.53, 0, 10, COLORS.gold)
			.setOrigin(0, 0.5)
			.setDepth(92);
		const quill = this.add
			.text(W / 2, H * 0.36, "✒", {
				fontFamily: FONT.ui,
				fontSize: "96px",
				color: hex(COLORS.gold),
			})
			.setOrigin(0.5)
			.setDepth(91);
		this.tweens.add({
			targets: quill,
			angle: { from: -12, to: 12 },
			y: H * 0.35,
			duration: 700,
			yoyo: true,
			repeat: -1,
			ease: "Sine.inOut",
		});
		const p = this.add
			.particles(W / 2, H * 0.4, "spark", {
				speed: { min: 10, max: 60 },
				scale: { start: 0.5, end: 0 },
				lifespan: 1500,
				tint: COLORS.gold,
				frequency: 120,
				blendMode: Phaser.BlendModes.ADD,
			})
			.setDepth(91);
		const sub = new Subtitle(this, H * 0.7);
		sub.setDepth(93);
		const cleanup = () => {
			for (const o of [shade, label, barBg, bar, quill, p, sub]) o.destroy();
			this.field.style.display = "";
			this.busy = false;
		};
		try {
			const res = await summon(request, (step, f) => {
				label.setText(step);
				this.tweens.add({
					targets: bar,
					width: 460 * f,
					duration: 500,
					ease: "Cubic.out",
				});
			});
			if (!res.ok) {
				label.setText("The Archivist declines.");
				const h = await say(res.refusal, VOICES.narrator);
				sub.show(
					"Royal Archivist",
					res.refusal,
					COLORS.gold,
					h.duration * 1000,
				);
				await h.done;
				cleanup();
				return;
			}
			audio.sfx("fanfare");
			label.setText(`${res.leader.name} answers the summons.`);
			const h = await say(
				`${res.leader.name}. ${res.leader.quote}`,
				res.leader.voice,
			);
			sub.show(
				res.leader.name,
				res.leader.quote,
				COLORS.gold,
				h.duration * 1000,
			);
			await h.done;
			saveGame(newGame(res.leader));
			go(this, "Court", { resume: true });
		} catch (e) {
			console.error(e);
			cleanup();
			toast(this, "The painters ran out of pigment. Try again.", COLORS.blood);
		}
	}
}
