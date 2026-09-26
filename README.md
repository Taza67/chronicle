# Chronicle ❖

> **Rule as history's greatest leaders. Learn history through play.**

🎮 **Play directly in your browser:** [https://taza67.itch.io/chronicle](https://taza67.itch.io/chronicle)

**Chronicle** is a mobile-first historical decision visual novel. You take the throne of real world leaders, listen to your court advisors present real crises from history, choose how to act, and discover what actually happened versus what an alternate timeline would have produced.

---

## 📖 What is Chronicle?

Chronicle turns history into an interactive story:

* **Real historical leaders:** Rule as **Napoleon Bonaparte**, **Cleopatra VII**, **Elizabeth I**, **Ashoka the Great**, **Mansa Musa**, or summon any real ruler from history by name.
* **Authentic dilemmas:** Every scenario is a real dilemma that the leader actually faced during their reign.
* **Learn while playing:** Compare your choices against real history, uncover true historical facts, and explore plausible "What If" alternate timelines.

---

## 🎮 Game Guide: How to Play

### 1. Goal of the Game
Guide your empire through a **5-turn reign**. You must manage your kingdom's 3 core resources, make critical choices, bet on historical truth, and finish with a strong legacy without triggering a crisis.

### 2. The 3 Kingdom Pillars
Every decision you make affects three gauges:
* 🪙 **Gold:** Your treasury. Letting it drop too low triggers a **Bankruptcy** crisis.
* ⚖️ **Stability:** Peace and civil order. Letting it collapse sparks a **Revolt**.
* 👑 **Legacy:** Your historical fame and score. Reaching high legacy unlocks special **Prophecy** events.

### 3. Step-by-Step Turn Walkthrough
Each turn follows 4 clear steps:

1. **The Council Dilemma:**
   A court advisor brings a crisis to your throne. Review the situation and examine the 3 proposed decrees. Each decree shows which pillars it will likely impact.
2. **Make Your Decree (Tap or Voice):**
   Choose your decision by tapping a decree card, or use the microphone button to decree hands-free by speaking your own words.
3. **The Oracle's Wager:**
   Before the result is revealed, place a bet: *Did the real historical leader make this choice, or did they do something else?* Guessing correctly chains a combo multiplier for your score.
4. **Historical Reveal & "What If":**
   * **If your choice matched history:** You learn what really took place and collect verified facts in your Codex.
   * **If your choice differed:** The game generates an alternate history timeline explaining how your decision would have changed world events.

### 4. End of Reign: The Verdict
After surviving 5 turns, you reach the **Verdict screen**:
* View your final Pillar scores (Gold, Stability, Legacy).
* Check your Oracle prediction accuracy.
* Receive an assessment of your rule and a historical epithet (e.g., *"Napoleon the Visionary"*, *"Cleopatra the Stern"*).

---

## 🏛️ Game Modes & Features

* **Campaign Carousel:** Jump between different civilisations and eras (Imperial France, Ancient Egypt, Tudor England, Maurya India, Mali Empire).
* **Summon Any Leader:** Type any historical figure (e.g. *Marcus Aurelius*, *Joan of Arc*, *Saladin*) to dynamically generate a custom ruler profile and new dilemmas.
* **The Royal Codex:** An in-game encyclopedia tracking all the historical facts and alternate timelines you have unlocked across your reigns.
* **The Chronicle:** A hall of records summarizing past reigns, final scores, and titles earned.

---

## 📱 How to Play on Mobile

1. Open [https://taza67.itch.io/chronicle](https://taza67.itch.io/chronicle) on your mobile browser (Safari, Chrome).
2. Tap **"Run Game"** to launch in fullscreen portrait mode.
3. Tap the screen once to enable audio.
4. Play by tapping cards, or toggle voice input in Settings to decree with your voice.

---

## 🛠️ Tech Stack & Sponsors

Built for the **Voodoo × Gradium × Cognition × Google DeepMind** Hackathon (*Track: Build a Game*).

### Sponsor Roles
* **Google DeepMind:** Gemini 3.8 Flash powers dynamic dilemmas, alternate history generation, end-of-reign verdicts, and voice intent parsing. Imagen/Nano Banana generated character portraits and court scenes. Lyria provided period court music.
* **Gradium:** Text-to-speech generates spoken dialogue for court advisors, and speech-to-text enables voice decree input.
* **Cognition:** End-to-end development, architecture, and debugging with Devin.
* **Voodoo:** Mobile-first design principles (vertical portrait layout, one-thumb navigation, quick onboarding).

### Technology
* **Game Engine:** Phaser 3.90 + TypeScript + Vite (mobile portrait 720×1280).
* **Backend:** Cloudflare Workers with KV caching for API calls.

---

## 💻 Local Setup

```bash
# 1. Install dependencies
npm install

# 2. Run local dev server
npm run dev

# 3. Build & package for distribution
npm run typecheck
npm run lint
npm run package
```

---

## 🔗 Links

* **Playable Game:** [https://taza67.itch.io/chronicle](https://taza67.itch.io/chronicle)
* **GitHub Repository:** [https://github.com/Taza67/chronicle](https://github.com/Taza67/chronicle)
