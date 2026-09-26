# Chronicle ❖

> **Rule as history's greatest leaders. Learn history through play.**

🎮 **Play now on itch.io:** [https://taza67.itch.io/chronicle](https://taza67.itch.io/chronicle)

**Chronicle** is a mobile-first historical decision visual novel. You take the throne of real world leaders, listen to your court advisors present real crises from history, choose how to act, and discover what actually happened versus what an alternate timeline would have produced.

---

## 📖 What is Chronicle?

Chronicle turns history into an interactive story:

* **Real historical leaders:** Rule as **Napoleon Bonaparte**, **Cleopatra VII**, **Elizabeth I**, **Ashoka the Great**, **Mansa Musa**, or summon any real ruler from history by name.
* **Authentic dilemmas:** Every scenario is a real dilemma that the leader actually faced during their reign.
* **Learn while playing:** Compare your choices against real history, uncover true historical facts, and explore plausible "What If" alternate timelines.

---

## 🎮 How to Play

A reign is played in **chapters of 5 historical dilemmas**. Balance your kingdom's 3 resources (**Gold, Stability, Legacy**) to avoid bankruptcy or rebellion:

1. **Choose a decree:** An advisor presents a historical crisis. Pick your action by tapping a card or speaking out loud.
2. **Bet with the Oracle:** Guess whether the real historical leader made that exact choice to earn bonus combo points.
3. **Discover the outcome:** The game reveals the true historical event, or generates an alternate "What If" timeline if you chose differently.

Complete each 5-turn chapter to receive your reign verdict and royal title, then **continue your reign into the next season** or switch to a new era!

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

* **Playable Game (itch.io):** [https://taza67.itch.io/chronicle](https://taza67.itch.io/chronicle)
* **GitHub Repository:** [https://github.com/Taza67/chronicle](https://github.com/Taza67/chronicle)
