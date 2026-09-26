import Phaser from "phaser";
import { getRandomPetitions, type Petition } from "../content/petitions.ts";
import { VOICES } from "../content/voices.ts";
import { online, stt } from "../core/api.ts";
import { portraitKeys, queueLeaderArt, sceneKeys } from "../core/art.ts";
import type { CourtAcoustics, VoiceHandle } from "../core/audio.ts";
import { audio } from "../core/audio.ts";
import {
	generateLie,
	generateWhatIf,
	getChapter,
	interpretVoice,
} from "../core/generator.ts";
import { playLeaderMusic } from "../core/music.ts";
import { micSupported } from "../core/recorder.ts";
import { say, warm } from "../core/speech.ts";
import {
	ADVISOR_ROLES,
	addCodex,
	applyEffects,
	cascadeFor,
	checkCollapse,
	clamp10,
	hasRelic,
	loadGame,
	restoreRandomSeal,
	saveGame,
	saveSettings,
	settings,
	unlockRelic,
} from "../core/state.ts";
import { VoiceActivityDetector } from "../core/vad.ts";
import type {
	Advisor,
	AdvisorRole,
	Choice,
	Effects,
	Emotion,
	GameState,
	Turn,
} from "../types.ts";
import { AccusationStamp } from "../ui/AccusationStamp.ts";
import { Backdrop } from "../ui/Backdrop.ts";
import { ChoiceCards } from "../ui/ChoiceCards.ts";
import { Gauges } from "../ui/Gauges.ts";
import { Oracle } from "../ui/Oracle.ts";
import { Portrait } from "../ui/Portrait.ts";
import { Reveal } from "../ui/Reveal.ts";
import { RoyalPetitions } from "../ui/RoyalPetitions.ts";
import { RoyalSeals } from "../ui/RoyalSeals.ts";
import { TimerRing } from "../ui/TimerRing.ts";
import {
	COLORS,
	FONT,
	H,
	hex,
	ROLE_META,
	SAFE_BOTTOM,
	SAFE_TOP,
	title,
	ui,
	W,
} from "../ui/theme.ts";
import { VoiceRibbon } from "../ui/VoiceRibbon.ts";
import { fadeIn, go, iconButton, Subtitle, toast } from "../ui/widgets.ts";

const MOOD: Record<Emotion, number> = {
	calm: 0x2a2440,
	alarmed: 0x5a1a1a,
	amused: 0x4a3a12,
	proud: 0x4a3a12,
	bold: 0x5a2a10,
};
const COURT_ACOUSTICS: Record<string, CourtAcoustics> = {
	napoleon: "palace_hall",
	cleopatra: "chamber",
	ashoka: "stone_temple",
	mansa_musa: "palace_hall",
	elizabeth: "chamber",
};
const TIMER_SECONDS = 10;

function contextualEmotion(
	baseEmotion: Emotion,
	role: AdvisorRole,
	stats: { gold: number; stability: number; legacy: number },
	combo: number,
): string {
	const traits: string[] = [baseEmotion];
	if (role === "gold" && stats.gold <= 2) {
		traits.push("pleading urgently over nearly empty imperial coffers");
	} else if (role === "war" && stats.stability <= 2) {
		traits.push("tense and vigilant amidst whispers of mutiny");
	} else if (role === "faith" && stats.legacy <= 2) {
		traits.push("grim and portentous, warning of divine disfavor");
	} else if (stats.legacy >= 8) {
		traits.push("reverent, addressing a legendary sovereign");
	}
	if (combo >= 3) {
		traits.push("galvanized by the emperor's infallible foresight");
	}
	return traits.join(", ");
}

/** The council chamber: the whole turn loop lives here. */
export class CourtScene extends Phaser.Scene {
	private g!: GameState;
	private backdrop!: Backdrop;
	private gauges!: Gauges;
	private subtitle!: Subtitle;
	private speaker: Portrait | null = null;
	private second: Portrait | null = null;
	private turnLabel!: Phaser.GameObjects.Text;
	private nameplate!: Phaser.GameObjects.Container;
	private alive = true;

	constructor() {
		super("Court");
	}

	init() {
		const g = loadGame();
		if (!g) {
			this.scene.start("Title");
			return;
		}
		this.g = g;
		this.alive = true;
	}

	preload() {
		if (!this.g) return;
		queueLeaderArt(this, this.g.leader);
		const t = this.add
			.text(W / 2, H / 2, "Entering the court…", ui(24, hex(COLORS.muted)))
			.setOrigin(0.5);
		this.load.once(Phaser.Loader.Events.COMPLETE, () => t.destroy());
	}

	create() {
		if (!this.g) return;
		fadeIn(this, 900);
		const l = this.g.leader;
		const sk = sceneKeys(l);
		this.backdrop = new Backdrop(this, l, sk.far, sk.near);
		this.backdrop.setAtmosphere(this.g.stats.stability, this.g.stats.gold);
		this.gauges = new Gauges(this, SAFE_TOP + 66, this.g.stats);
		this.subtitle = new Subtitle(this, H - 330);
		this.subtitle.setDepth(45);
		this.turnLabel = this.add
			.text(W / 2, SAFE_TOP + 12, "", ui(17, hex(COLORS.muted)))
			.setOrigin(0.5)
			.setDepth(50);
		this.turnLabel.setLetterSpacing(3);
		this.nameplate = this.add.container(0, 0).setDepth(46).setAlpha(0);
		iconButton(this, W - 52, SAFE_TOP + 12, "⚙", () => this.openSettings(), 52);
		iconButton(this, 52, SAFE_TOP + 12, "‹", () => this.leave(), 52);
		playLeaderMusic(l);
		(
			this as unknown as {
				Oracle: typeof Oracle;
				Reveal: typeof Reveal;
				ChoiceCards: typeof ChoiceCards;
				RoyalSeals: typeof RoyalSeals;
			}
		).Oracle = Oracle;
		(
			this as unknown as {
				Oracle: typeof Oracle;
				Reveal: typeof Reveal;
				ChoiceCards: typeof ChoiceCards;
				RoyalSeals: typeof RoyalSeals;
			}
		).Reveal = Reveal;
		(
			this as unknown as {
				Oracle: typeof Oracle;
				Reveal: typeof Reveal;
				ChoiceCards: typeof ChoiceCards;
				RoyalSeals: typeof RoyalSeals;
			}
		).ChoiceCards = ChoiceCards;
		(
			this as unknown as {
				Oracle: typeof Oracle;
				Reveal: typeof Reveal;
				ChoiceCards: typeof ChoiceCards;
				RoyalSeals: typeof RoyalSeals;
			}
		).RoyalSeals = RoyalSeals;
		const acoustics: CourtAcoustics = COURT_ACOUSTICS[l.id] ?? "palace_hall";
		audio.setCourtAcoustics(acoustics);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			this.alive = false;
			audio.stopVoice();
		});
		void this.run().catch((e) => {
			console.error(e);
			if (this.alive)
				toast(this, "The archives are silent. Try again.", COLORS.blood);
		});
	}

	// ---------------- flow ----------------

	private async run() {
		const g = this.g;
		if (g.collapse) {
			go(this, "Verdict");
			return;
		}
		if (!g.chapter) {
			const special = g.season > 1 ? cascadeFor(g.stats) : null;
			const waiting = this.showWaiting("The scribes consult the archives…");
			try {
				const { chapter } = await getChapter(g, g.season, special);
				g.chapter = chapter;
				g.turnIndex = 0;
				saveGame(g);
			} finally {
				waiting.destroy();
			}
			if (!this.alive) return;
		}
		const ch = g.chapter!;
		if (g.turnIndex === 0) {
			g.petitionsDone = false;
			if (hasRelic(g, "relic_elizabeth")) {
				const restored = restoreRandomSeal(g);
				if (restored) {
					toast(
						this,
						"Tudor Sceptre: A Royal Seal has been restored!",
						COLORS.gold,
					);
				}
			}
			await this.chapterCard(ch.season_title, ch.intro);
		}
		const totalTurns = Math.min(ch.turns.length, settings.campaignLength ?? 10);
		for (let i = g.turnIndex; i < totalTurns; i++) {
			if (!this.alive) return;

			// After turn 2, hold the rapid popular petitions audience!
			if (i === 2 && !g.petitionsDone) {
				await this.runRoyalAudience();
				g.petitionsDone = true;
				saveGame(g);
				if (g.collapse) {
					go(this, "Verdict");
					return;
				}
			}

			g.turnIndex = i;
			saveGame(g);
			await this.playTurn(ch.turns[i], i, totalTurns);
			if (g.collapse) return;
		}
		if (!this.alive) return;
		g.turnIndex = totalTurns;
		g.seasonsPlayed += 1;
		saveGame(g);
		settings.playedOnce = true;
		saveSettings();
		go(this, "Verdict");
	}

	private async playTurn(turn: Turn, i: number, n: number) {
		const g = this.g;
		this.turnLabel.setText(
			`CHAPTER ${g.season}  ·  ${i + 1} / ${n}  ·  ${turn.year}`,
		);
		const advisor = this.advisorOf(turn.advisor);
		// --- lies: an ignored advisor (trust ≤ −2) steers you wrong, never twice in a row
		let speech = turn.speech;
		let pushIndex = -1;
		g.liar = null;
		if (g.trust[turn.advisor] <= -2 && !g.liedLastTurn) {
			g.liar = turn.advisor;
			const wrong = turn.choices
				.map((c, k) => (c.historical ? -1 : k))
				.filter((k) => k >= 0);
			pushIndex = wrong[Math.floor(Math.random() * wrong.length)] ?? -1;
			if (online()) {
				try {
					const lie = await generateLie(g, turn, turn.advisor);
					speech = lie.speech;
					pushIndex =
						turn.choices[lie.pushIndex]?.historical === false
							? lie.pushIndex
							: pushIndex;
				} catch {
					/* local lie below */
				}
			}
			if (speech === turn.speech && pushIndex >= 0)
				speech = `${turn.speech} If you want my honest counsel, Majesty, and you rarely do, the wise path is plain: ${turn.choices[pushIndex].label.toLowerCase()}.`;
		}
		g.liedLastTurn = g.liar !== null;

		// --- advisor enters and speaks
		this.updateMusicSituation(turn);
		this.backdrop.setMood(MOOD[turn.emotion], 0.3);
		this.speaker = this.portrait(turn.advisor, W / 2 + 20, H * 0.5, 900);
		this.speaker.enter(W + 300);
		this.speaker.setEmotion(turn.emotion);
		this.showNameplate(advisor, turn.emotion);
		if (turn.rebuttal)
			warm(
				turn.rebuttal.line,
				this.advisorOf(turn.rebuttal.advisor).voice,
				contextualEmotion(
					turn.rebuttal.emotion,
					turn.rebuttal.advisor,
					g.stats,
					g.combo,
				),
			);
		if (turn.special) this.specialBanner(turn.special);
		g.exposedLiar = null;
		const mainStyle = contextualEmotion(
			turn.emotion,
			turn.advisor,
			g.stats,
			g.combo,
		);
		await this.speak(
			this.speaker,
			advisor.name,
			speech,
			advisor.voice,
			ROLE_META[turn.advisor].color,
			mainStyle,
			turn.rebuttal ? 0.28 : 0,
			turn.advisor,
		);
		if (!this.alive) return;

		// --- rebuttal from a rival advisor (may expose the liar)
		if (turn.rebuttal) {
			const r = this.advisorOf(turn.rebuttal.advisor);
			let line = turn.rebuttal.line;
			if (g.liar && Math.random() < 0.7)
				line = `${line} And I would weigh ${advisor.name}'s counsel twice today, Majesty. Something in it smells of resentment.`;
			this.speaker.setScale(0.82);
			this.tweens.add({
				targets: this.speaker,
				x: W * 0.72,
				scale: 0.78,
				alpha: 0.75,
				duration: 450,
				ease: "Cubic.out",
			});
			this.second = this.portrait(
				turn.rebuttal.advisor,
				W * 0.3,
				H * 0.52,
				780,
			);
			this.second.enter(-300);
			this.second.setEmotion(turn.rebuttal.emotion);
			this.showNameplate(r, turn.rebuttal.emotion);
			// Primary speaker visually reacts to being interrupted by rival!
			this.speaker.setEmotion(
				turn.rebuttal.emotion === "alarmed" ? "alarmed" : "amused",
			);
			const rebuttalStyle = contextualEmotion(
				turn.rebuttal.emotion,
				turn.rebuttal.advisor,
				g.stats,
				g.combo,
			);
			await this.speak(
				this.second,
				r.name,
				line,
				r.voice,
				ROLE_META[turn.rebuttal.advisor].color,
				rebuttalStyle,
				-0.28,
				turn.rebuttal.advisor,
			);
			if (!this.alive) return;
			this.second.leave(-300);
			this.second = null;
			this.tweens.add({
				targets: this.speaker,
				x: W / 2 + 20,
				scale: 1,
				alpha: 1,
				duration: 400,
				ease: "Cubic.out",
			});
			this.speaker.setEmotion(turn.emotion);
			this.showNameplate(advisor, turn.emotion);
		}
		this.subtitle.hide();
		this.tweens.killTweensOf(this.nameplate);
		this.tweens.add({ targets: this.nameplate, alpha: 0, duration: 200 });

		// --- the decision
		const picked = await this.decide(turn, advisor, pushIndex);
		if (!this.alive) return;
		const choice = picked.choice;
		const followedAdvisor = g.liar
			? picked.index === pushIndex
			: choice.historical;
		this.nameplate.setAlpha(0);

		// --- Oracle wager
		audio.setMusicSituation("oracle");
		let oracle!: Oracle;
		const bet = await new Promise<boolean>((res) => {
			oracle = new Oracle(this, g.combo, res);
		});
		const matched = bet === choice.historical;
		let legacyGain = 0;
		if (matched) {
			g.combo = Math.min(3, g.combo + 1);
			legacyGain = g.combo;

			if (hasRelic(g, "relic_cleopatra")) {
				g.stats.gold = clamp10(g.stats.gold + 1);
				this.gauges.emitCoinRain(W / 2, H * 0.4, 6);
				toast(
					this,
					"Scarab of Khepri: +1 Gold blessed by the Oracle!",
					COLORS.gold,
				);
			}

			const restored = restoreRandomSeal(g);
			if (restored) {
				toast(this, "Oracle's Grace: Royal Seal restored!", COLORS.gold);
			}

			if (g.combo === 3) {
				unlockRelic("relic_alexander");
			}
		} else {
			if (hasRelic(g, "relic_alexander")) {
				g.combo = 1;
				toast(this, "Gordian Knot: Streak preserved at 1x combo!", COLORS.sky);
			} else {
				g.combo = 0;
			}
		}
		await oracle.resolve(matched, legacyGain);
		if (!this.alive) return;
		this.updateMusicSituation(turn);

		// --- reveal: history or counterfactual
		this.speaker?.setEmotion(choice.historical ? "proud" : "alarmed");
		let text = turn.reveal;
		let kind: "history" | "whatif" = "history";
		if (!choice.historical) {
			kind = "whatif";
			text = choice.whatif ?? "";
			if (!text && online()) {
				const w = this.showWaiting("The narrator imagines another world…");
				try {
					text = await Promise.race([
						generateWhatIf(g, turn, choice.label),
						new Promise<string>((_, reject) =>
							setTimeout(() => reject(new Error("timeout")), 6000),
						),
					]);
				} catch {
					text = "";
				} finally {
					w.destroy();
				}
			}
			if (!text)
				text = `Another path, another world. But history took a different road: ${turn.reveal}`;
		}
		if (!this.alive) return;
		this.backdrop.setMood(kind === "history" ? 0x3a2f14 : 0x3a1420, 0.35);
		this.backdrop.burst(W / 2, H * 0.3, 30);
		const reveal = new Reveal(this, kind, text);
		const narr = say(text, VOICES.narrator);
		// stats + trust
		let extraStability = 0;
		if (hasRelic(g, "relic_napoleon") && turn.advisor === "war") {
			extraStability += 1;
		}
		if (hasRelic(g, "relic_hammurabi") && choice.historical) {
			extraStability += 1;
		}

		const delta: Effects = {
			...choice.effects,
			stability: choice.effects.stability + extraStability,
			legacy: choice.effects.legacy + legacyGain,
		};
		const next = applyEffects(g.stats, delta);
		if (delta.gold > 0) {
			this.gauges.emitCoinRain(W / 2, H * 0.65, 8);
		}
		this.time.delayedCall(900, () => {
			this.gauges.apply(next, {
				gold: next.gold - g.stats.gold,
				stability: next.stability - g.stats.stability,
				legacy: next.legacy - g.stats.legacy,
			});
			this.backdrop.setAtmosphere(next.stability, next.gold);
			this.updateMusicSituation();
		});
		g.stats = next;
		const trustDelta = followedAdvisor ? 1 : -1;
		g.trust[turn.advisor] = Phaser.Math.Clamp(
			g.trust[turn.advisor] + trustDelta,
			-3,
			3,
		);
		g.history.push({
			year: turn.year,
			title: turn.title,
			chosen: choice.label,
			historical: choice.historical,
			matched,
			advisor: turn.advisor,
			followedAdvisor,
		});
		addCodex({
			leaderId: g.leader.id,
			leaderName: g.leader.name,
			year: turn.year,
			kind: "fact",
			title: turn.title,
			text: `${turn.reveal}\n\n✦ ${turn.fun_fact}`,
		});
		if (kind === "whatif")
			addCodex({
				leaderId: g.leader.id,
				leaderName: g.leader.name,
				year: turn.year,
				kind: "whatif",
				title: `${turn.title} — ${choice.label}`,
				text,
			});
		saveGame(g);
		const collapse = checkCollapse(g.stats);
		if (collapse) {
			if (
				collapse === "revolt" &&
				hasRelic(g, "relic_ashoka") &&
				!g.avertedRevolt
			) {
				g.avertedRevolt = true;
				g.stats.stability = 3;
				this.gauges.apply(g.stats, { gold: 0, stability: 3, legacy: 0 });
				toast(
					this,
					"Dharma Chakra: Popular revolt pacified! (+3 Stability)",
					COLORS.sage,
				);
				audio.sfx("fanfare");
			} else {
				audio.setMusicSituation("collapse");
				g.collapse = collapse;
				saveGame(g);
				await this.wait(1000);
				if (!this.alive) return;
				this.specialBanner(collapse, "THE REALM HAS FALLEN");
				await this.wait(2200);
				audio.stopVoice();
				const h = await narr;
				h.stop();
				if (!this.alive) return;
				settings.playedOnce = true;
				saveSettings();
				go(this, "Verdict");
				return;
			}
		}
		const h = await narr;
		this.speaker?.speak(null);
		reveal.showFact(turn.fun_fact, () => audio.sfx("chime"));
		const factPromise = say(turn.fun_fact, VOICES.narrator);
		await reveal.waitContinue(i + 1 < n ? "Next council" : "Hear the verdict");
		h.stop();
		const fact = await factPromise;
		fact.stop();
		if (!this.alive) return;
		this.speaker?.leave(W + 300);
		this.speaker = null;
		this.backdrop.setMood(0x2a2440, 0.25);
		await this.wait(350);
	}

	/** Cards with automatic hands-free speech detection and optional hourglass timer. */
	private decide(
		turn: Turn,
		advisor: Advisor,
		pushIndex: number,
	): Promise<{ choice: Choice; index: number }> {
		return new Promise((resolve) => {
			let done = false;
			let timer: TimerRing | null = null;
			let ribbon: VoiceRibbon | null = null;
			let vad: VoiceActivityDetector | null = null;
			let seals: RoyalSeals | null = null;

			const finish = (choice: Choice, index: number) => {
				if (done) return;
				done = true;
				timer?.stop();
				vad?.stop();
				audio.duck(false);
				ribbon?.destroy();
				seals?.dismiss();
				this.time.delayedCall(650, () => resolve({ choice, index }));
			};

			const cards = new ChoiceCards(this, turn.choices, {
				onPick: (i) => finish(turn.choices[i], i),
			});

			const sealsY = Math.max(SAFE_TOP + 120, cards.top - 94);
			seals = new RoyalSeals(this, sealsY, this.g, {
				onPrescience: () => {
					cards.activatePrescience();
					toast(this, "Prescience: Fates and outcomes revealed!", COLORS.gold);
				},
				onTreasury: () => {
					const next = applyEffects(this.g.stats, {
						gold: 2,
						stability: -1,
						legacy: 0,
					});
					this.gauges.apply(next, { gold: 2, stability: -1, legacy: 0 });
					this.gauges.emitCoinRain(W / 2, sealsY);
					this.g.stats = next;
					toast(
						this,
						"Treasury Edict: +2 Gold levied, -1 Stability!",
						COLORS.gold,
					);
				},
				onDecree: () => {
					const next = applyEffects(this.g.stats, {
						gold: 0,
						stability: 2,
						legacy: 0,
					});
					this.gauges.apply(next, { gold: 0, stability: 2, legacy: 0 });
					this.g.stats = next;
					audio.sfx("gavel");
					for (const role of ADVISOR_ROLES) {
						this.g.trust[role] = Phaser.Math.Clamp(
							this.g.trust[role] + 1,
							-3,
							3,
						);
					}
					toast(
						this,
						"Imperial Decree: +2 Stability, council trust restored!",
						COLORS.sage,
					);
				},
			});

			if (this.g.exposedLiar && pushIndex >= 0) {
				cards.markExposedLie(pushIndex);
			}

			// If microphone is supported and online, start hands-free Royal Voice Ribbon & VAD
			if (micSupported() && online()) {
				const ribbonY = cards.top - 30;
				ribbon = new VoiceRibbon(this, W / 2, ribbonY);

				vad = new VoiceActivityDetector({
					speechThreshold: 0.12,
					silenceDurationMs: 800,
					maxDurationMs: 8000,
					onSpeechStart: () => {
						if (done) return;
						audio.duck(true);
						ribbon?.setSpeaking();
					},
					onLevel: (lvl) => {
						if (done) return;
						ribbon?.setLevel(lvl);
					},
					onSpeechEnd: async (blob) => {
						if (done) return;
						audio.duck(false);
						ribbon?.setProcessing();
						try {
							const transcript = (await stt(blob)).trim();
							if (!transcript) {
								ribbon?.setRetry("The hall echoes in silence…");
								return;
							}

							const res = await interpretVoice(this.g, turn, transcript);
							if (done) return;

							if (
								res.kind === "choice" &&
								res.index != null &&
								turn.choices[res.index]
							) {
								const choice = turn.choices[res.index];
								ribbon?.setMatched(choice.label, res.index);
								cards.flash(res.index);
								this.time.delayedCall(700, () => {
									cards.pick(res.index as number);
									finish(choice, res.index as number);
								});
							} else if (res.kind === "custom" && res.label) {
								ribbon?.setCustom(res.label);
								cards.dismiss();
								const custom: Choice = {
									label: res.label,
									historical: false,
									effects: { gold: 0, stability: -1, legacy: 1 },
									whatif: res.whatif ?? undefined,
								};
								toast(this, `A path of your own: ${res.label}`, COLORS.gold);
								this.time.delayedCall(700, () => {
									finish(custom, 3);
								});
							} else {
								ribbon?.setRetry(
									"The council did not catch that. Speak again or tap a card.",
								);
								const h = await say(
									[
										"Forgive me, Majesty, I did not catch that.",
										"Your Majesty mumbles like a Roman senator. Again?",
										"The hall echoes, Majesty. Say it once more.",
									][Math.floor(Math.random() * 3)],
									advisor.voice,
								);
								this.speaker?.speak(h);
							}
						} catch (err) {
							console.warn("[VAD] voice interpretation error:", err);
							ribbon?.setRetry();
						}
					},
				});

				void vad.start();
			}

			if (settings.timer && settings.playedOnce) {
				timer = new TimerRing(
					this,
					W - 70,
					H - 130 - turn.choices.length * 110 - 80,
					TIMER_SECONDS,
					() => {
						if (!done)
							void say(
								[
									"Majesty?",
									"Your Majesty… the court waits.",
									"Sire, a decision, if you please.",
								][Math.floor(Math.random() * 3)],
								advisor.voice,
							).then((h) => this.speaker?.speak(h));
					},
					() => {
						if (done) return;
						const hist = turn.choices.findIndex((c) => c.historical);
						const idx = pushIndex >= 0 ? pushIndex : hist >= 0 ? hist : 0;
						toast(this, `${advisor.name} decided for you.`, COLORS.blood);
						cards.flash(idx);
						this.time.delayedCall(500, () => {
							cards.pick(idx);
							finish(turn.choices[idx], idx);
						});
					},
				);
			}
		});
	}

	private runRoyalAudience(): Promise<void> {
		return new Promise((resolve) => {
			const petitions = getRandomPetitions(3);
			new RoyalPetitions(this, {
				petitions,
				onDecision: (p: Petition, accepted: boolean) => {
					const effects = accepted ? p.acceptEffects : p.rejectEffects;
					const next = applyEffects(this.g.stats, {
						gold: effects.gold,
						stability: effects.stability,
						legacy: 0,
					});
					this.gauges.apply(next, {
						gold: effects.gold,
						stability: effects.stability,
						legacy: 0,
					});
					if (effects.gold > 0) {
						this.gauges.emitCoinRain(W / 2, H * 0.52, 6);
					}
					this.g.stats = next;
					saveGame(this.g);

					const collapse = checkCollapse(this.g.stats);
					if (collapse) {
						this.g.collapse = collapse;
						saveGame(this.g);
					}
				},
				onComplete: () => {
					toast(
						this,
						"The Audience is adjourned. The Royal Council is back in session.",
						COLORS.gold,
					);
					this.time.delayedCall(400, () => resolve());
				},
			});
		});
	}

	// ---------------- helpers ----------------

	private updateMusicSituation(turn?: Turn) {
		const s = this.g.stats;
		const inCollapse = checkCollapse(s);
		if (inCollapse) {
			audio.setMusicSituation("collapse");
			return;
		}
		const inCrisis = s.gold <= 2 || s.stability <= 2;
		if (inCrisis) {
			audio.setMusicSituation("crisis");
		} else if (turn?.emotion === "alarmed" || turn?.advisor === "war") {
			audio.setMusicSituation("tension");
		} else {
			audio.setMusicSituation("normal");
		}
	}

	private advisorOf(role: AdvisorRole): Advisor {
		return (
			this.g.leader.advisors.find((a) => a.role === role) ??
			this.g.leader.advisors[0]
		);
	}

	private portrait(role: AdvisorRole, x: number, y: number, h: number) {
		const p = new Portrait(this, x, y, portraitKeys(this.g.leader, role), h);
		p.setDepth(10);
		return p;
	}

	private async speak(
		p: Portrait,
		name: string,
		text: string,
		voice: string,
		color: number,
		emotion?: string,
		pan = 0,
		role?: AdvisorRole,
	) {
		const h = await say(text, voice, emotion, pan);
		if (!this.alive) return;
		p.speak(h);
		this.subtitle.show(name, text, color, h.duration * 1000);

		let stamp: AccusationStamp | null = null;
		if (role) {
			stamp = new AccusationStamp(
				this,
				Math.min(H - SAFE_BOTTOM - 20, this.subtitle.bottomY),
				{
					advisorName: name,
					onAccuse: () => {
						void this.handleAccusation(p, name, role, h);
					},
				},
			);
		}

		await this.skippable(h, () => {
			this.subtitle.finish();
			stamp?.dismiss();
		});
		stamp?.dismiss();
	}

	private async handleAccusation(
		p: Portrait,
		advisorName: string,
		role: AdvisorRole,
		h: VoiceHandle,
	) {
		h.stop();
		this.subtitle.finish();
		const g = this.g;
		const isLying = g.liar === role;
		audio.sfx("gavel");
		if (!settings.reducedMotion) this.cameras.main.shake(250, 0.008);

		if (isLying) {
			p.setEmotion("alarmed");
			p.speak(null);
			g.exposedLiar = role;
			g.liar = null;
			unlockRelic("relic_caesar");

			const legacyBonus = hasRelic(g, "relic_caesar") ? 3 : 2;
			g.stats.legacy = clamp10(g.stats.legacy + legacyBonus);
			g.combo = Math.min(3, g.combo + 1);

			const restored = restoreRandomSeal(g);
			const restoreMsg = restored ? " · Royal Seal recharged!" : "";

			toast(
				this,
				`TREASON UNMASKED! (+${legacyBonus} Legacy${restoreMsg})`,
				COLORS.gold,
			);
			this.subtitle.show(
				advisorName,
				"Mercy, Your Majesty! Bitterness had blinded me... My counsel was poisoned, yet you saw through my deceit!",
				COLORS.gold,
				4000,
			);
			audio.sfx("fanfare");
			await this.wait(3000);
		} else {
			p.setEmotion("alarmed");
			audio.sfx("fail");
			g.stats.stability = clamp10(g.stats.stability - 1);
			g.trust[role] = Phaser.Math.Clamp(g.trust[role] - 2, -3, 3);

			toast(this, "False Accusation! (-1 Stability, -2 Trust)", COLORS.blood);
			this.subtitle.show(
				advisorName,
				"Your Majesty dares question my loyalty?! My honor is besmirched before the entire realm!",
				COLORS.blood,
				3200,
			);
			await this.wait(2500);
		}
	}

	/** Wait for a voice line; a tap below the HUD skips the rest of it. */
	private async skippable(h: VoiceHandle, onSkip?: () => void) {
		const skip = (ptr: Phaser.Input.Pointer) => {
			if (ptr.y > 140 && Math.abs(ptr.y - ptr.downY) < 40) {
				h.stop();
				onSkip?.();
			}
		};
		this.input.on(Phaser.Input.Events.POINTER_UP, skip);
		await h.done;
		this.input.off(Phaser.Input.Events.POINTER_UP, skip);
	}

	private showNameplate(a: Advisor, emotion: Emotion) {
		this.nameplate.removeAll(true);
		const g = this.add.graphics();
		const col = ROLE_META[a.role].color;
		const name = this.add
			.text(0, -12, a.name.toUpperCase(), {
				fontFamily: FONT.title,
				fontSize: "26px",
				color: hex(COLORS.text),
				fontStyle: "700",
			})
			.setOrigin(0.5);
		name.setLetterSpacing(4);
		const sub = this.add
			.text(0, 18, `${a.title}  ·  ${emotion}`, ui(16, hex(COLORS.muted)))
			.setOrigin(0.5);
		const w = Math.max(name.width, sub.width) + 70;
		g.fillStyle(COLORS.night, 0.75);
		g.fillRoundedRect(-w / 2, -36, w, 72, 12);
		g.fillStyle(col, 1);
		g.fillRoundedRect(-w / 2, -36, 8, 72, { tl: 12, bl: 12, tr: 0, br: 0 });
		this.nameplate.add([g, name, sub]);
		this.nameplate.setPosition(W / 2, H - 460);
		this.nameplate.setAlpha(0);
		this.tweens.add({
			targets: this.nameplate,
			alpha: 1,
			y: H - 472,
			duration: 350,
			ease: "Cubic.out",
		});
	}

	private async chapterCard(titleText: string, intro: string) {
		let skipped = false;
		let activeVoice: VoiceHandle | null = null;
		const shade = this.add
			.rectangle(W / 2, H / 2, W, H, COLORS.night, 0.8)
			.setDepth(90)
			.setInteractive({ useHandCursor: true });
		shade.once("pointerup", () => {
			skipped = true;
			activeVoice?.stop();
			this.subtitle.finish();
		});
		const k = this.add
			.text(
				W / 2,
				H * 0.42,
				`CHAPTER ${this.g.season}`,
				ui(22, hex(COLORS.gold)),
			)
			.setOrigin(0.5)
			.setDepth(91)
			.setAlpha(0);
		k.setLetterSpacing(8);
		const t = this.add
			.text(W / 2, H * 0.48, titleText, {
				...title(48, hex(COLORS.text)),
				wordWrap: { width: W - 100 },
			})
			.setOrigin(0.5)
			.setDepth(91)
			.setAlpha(0);
		t.setShadow(0, 4, "#000", 14, false, true);
		const rule = this.add
			.rectangle(W / 2, H * 0.55, 0, 2, COLORS.gold)
			.setDepth(91);
		audio.sfx("drum");
		this.tweens.add({
			targets: k,
			alpha: 1,
			y: H * 0.41,
			duration: 500,
			delay: 200,
		});
		this.tweens.add({
			targets: t,
			alpha: 1,
			scale: { from: 1.15, to: 1 },
			duration: 800,
			delay: 400,
			ease: "Cubic.out",
		});
		this.tweens.add({ targets: rule, width: 260, duration: 600, delay: 900 });
		const voicePromise = say(intro, VOICES.narrator);
		const h = await voicePromise;
		activeVoice = h;
		if (!skipped) {
			this.subtitle.setDepth(92);
			this.subtitle.show("Narrator", intro, COLORS.gold, h.duration * 1000);
			await Promise.race([
				h.done,
				new Promise<void>((resolve) => {
					shade.once("pointerup", () => {
						h.stop();
						this.subtitle.finish();
						resolve();
					});
				}),
			]);
		}
		this.subtitle.hide();
		this.subtitle.setDepth(45);
		this.tweens.add({
			targets: [shade, k, t, rule],
			alpha: 0,
			duration: 400,
			onComplete: () => [shade, k, t, rule].forEach((o) => o.destroy()),
		});
		await this.wait(400);
	}

	private specialBanner(
		kind: NonNullable<Turn["special"]>,
		subtitleText?: string,
	) {
		const txt = {
			revolt: "REVOLT",
			bankruptcy: "BANKRUPTCY",
			prophecy: "PROPHECY",
		}[kind];
		const col = kind === "prophecy" ? COLORS.sky : COLORS.blood;
		const b = this.add
			.text(W / 2, H * 0.28, txt, title(64, hex(col)))
			.setOrigin(0.5)
			.setDepth(85)
			.setAlpha(0);
		b.setLetterSpacing(14);
		b.setShadow(0, 0, hex(col), 24, false, true);
		audio.sfx(kind === "prophecy" ? "fanfare" : "heart");
		this.cameras.main.shake(
			subtitleText ? 600 : 300,
			subtitleText ? 0.02 : kind === "prophecy" ? 0.003 : 0.012,
		);
		this.tweens.chain({
			targets: b,
			tweens: [
				{
					alpha: 1,
					scale: { from: 1.6, to: 1 },
					duration: 500,
					ease: "Cubic.out",
				},
				{ alpha: 0, y: H * 0.24, duration: 600, delay: 1600 },
			],
		});
		if (subtitleText) {
			const sub = this.add
				.text(W / 2, H * 0.36, subtitleText, {
					...title(28, hex(col)),
					fontStyle: "700",
				})
				.setOrigin(0.5)
				.setDepth(85)
				.setAlpha(0);
			sub.setLetterSpacing(8);
			sub.setShadow(0, 0, hex(col), 16, false, true);
			this.tweens.chain({
				targets: sub,
				tweens: [
					{
						alpha: 1,
						scale: { from: 1.4, to: 1 },
						duration: 500,
						ease: "Cubic.out",
					},
					{ alpha: 0, duration: 600, delay: 1600 },
				],
			});
		}
	}

	private showWaiting(text: string) {
		const c = this.add.container(W / 2, H * 0.5).setDepth(95);
		const shade = this.add.rectangle(0, 0, W, H, COLORS.night, 0.7);
		const t = this.add
			.text(0, 60, text, { ...title(26, hex(COLORS.gold)), fontStyle: "500" })
			.setOrigin(0.5);
		const ring = this.add.graphics();
		ring.lineStyle(5, COLORS.gold, 1);
		ring.arc(0, 0, 34, 0, Math.PI * 1.4);
		ring.strokePath();
		ring.setY(-30);
		c.add([shade, ring, t]);
		this.tweens.add({ targets: ring, angle: 360, duration: 1200, repeat: -1 });
		this.tweens.add({
			targets: t,
			alpha: 0.5,
			yoyo: true,
			repeat: -1,
			duration: 800,
		});
		return c;
	}

	private wait(ms: number) {
		return new Promise<void>((r) => this.time.delayedCall(ms, r));
	}

	private openSettings() {
		this.scene.pause();
		this.scene.launch("Settings", { back: "Court", overlay: true });
	}

	private leave() {
		audio.stopVoice();
		this.alive = false;
		go(this, "Title");
	}
}
