# Chronicle ❖

> **Step into the shoes of history's greatest leaders. Learn history through play.**

🎮 **Play now:** [https://taza67.itch.io/chronicle](https://taza67.itch.io/chronicle)

**Chronicle** is a voice-powered historical visual novel designed for mobile and web. It turns history into an interactive story: you sit on the throne, listen to your court advisors speak to you, make tough royal decisions, and discover what really happened — all while having fun!

---

## 👑 What is Chronicle?

Think of Chronicle as an **interactive visual novel where you rule an empire**:

* **Play legendary rulers:** Lead as **Napoleon**, **Cleopatra**, **Elizabeth I**, **Ashoka**, **Mansa Musa**, or summon any real historical figure you want by name.
* **Living, voiced characters:** Your advisors don't just display silent text. They actually **talk to you with full voice and mouth movement (lip-sync)**.
* **Learn real history through play:** Every turn brings a real dilemma that the leader actually faced. You decide how to solve it, and learn the real historical outcome.
* **Explore "What If" alternate history:** If you make a different choice than the real ruler did, the story doesn't stop — the game creates and narrates a brand-new alternate history timeline for you!

---

## 🎮 How to Play (In 4 Simple Steps)

You can pick up and play the game in less than 30 seconds:

```
[ 1. Pick a Leader ] ──► [ 2. Listen & Choose ] ──► [ 3. Bet with the Oracle ] ──► [ 4. Discover History ]
```

1. **Pick your leader:** Choose from the portrait gallery or type in any ruler from history.
2. **Listen to your advisors:** Your ministers (Gold, Stability, Legacy) voice their opinions. Choose your royal decree with a **single tap** or by **speaking your answer out loud**.
3. **Bet with the Oracle:** Before the result is revealed, place a bet: *"Did the real historical leader make this choice, or did they do something else?"* Guess correctly to score bonus combo points!
4. **Discover what happened:**
   * **If you matched history:** You unlock authentic, verified historical facts in your royal Codex.
   * **If you chose differently:** You hear a fun, AI-narrated alternate history ("What If") showing how your choice would have changed the world.
5. **Get your reign verdict:** After 5 dilemmas, receive a fun report card evaluating your reign with a unique royal title (like *"Cleopatra the Visionary"* or *"Napoleon the Reckless"*).

---

## ✨ Why You'll Love It

* **Super fun & casual:** Designed to be played easily with one thumb on any phone.
* **Hear your court come alive:** Characters breathe, blink, and sync their lips to real speech audio.
* **Play your way (Tap or Voice):** Relax and tap decree cards, or speak directly to your phone like a true monarch.
* **Collect real knowledge:** Fill your historical **Codex** with fascinating true facts and unexpected stories.
* **Endless replay:** If you run out of built-in eras, you can summon any figure in world history (e.g. *Marcus Aurelius*, *Joan of Arc*, *Saladin*) for an instant new game!

---

## 📱 How to Play on Mobile

1. Open [https://taza67.itch.io/chronicle](https://taza67.itch.io/chronicle) on your smartphone browser (Safari or Chrome).
2. Tap **"Run Game"** (or fullscreen).
3. Tap the screen once to enable the sound and voice acting.
4. Hold your phone in **portrait mode** and start ruling!

---

## 🏆 Hackathon & Technology (For Judges & Developers)

Chronicle was created for the **Voodoo × Gradium × Cognition × Google DeepMind** Hackathon (*Track: Build a Game*).

### Sponsor Integrations

| Sponsor | Role in Chronicle |
| :--- | :--- |
| **Google DeepMind** | **Gemini 3.8 Flash** generates dynamic chapters, alternate history timelines, end-of-reign verdicts, and parses voice intents. **Nano Banana / Imagen** created the painted portraits, scene backgrounds, and facial lip-sync frames. **Lyria** composed authentic period court music. |
| **Gradium** | **Ultra-fast TTS** powers the character voices for every advisor and narrator (driving real-time audio lip-sync). **Streaming ASR** provides speech-to-text so players can speak their decrees hands-free. |
| **Cognition** | The game was engineered, iterated, and tested end-to-end with **Devin**. |
| **Voodoo** | Guided the mobile-first UX: vertical portrait view, one-thumb ergonomics, and instant player feedback. |

---

### Tech Stack & Architecture

* **Frontend Engine:** [Phaser 3](https://phaser.io) (HTML5 2D game framework), TypeScript, Vite.
* **Audio & Animation:** Web Audio API (`AnalyserNode`) for real-time lip-sync driving canvas sprite mouth and eye variants.
* **API Gateway:** Cloudflare Worker (`worker/`) handles Gemini and Gradium requests, caching results in KV for instant load times and protecting API keys.
* **Offline-Ready:** Bundled fallback chapters, pre-recorded audio, and local assets ensure the game works seamlessly even offline.

---

### Local Development

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev
# Open http://localhost:5173

# 3. Check types & linter
npm run typecheck
npm run lint

# 4. Package for itch.io / Web
npm run package
# Creates chronicle-itch.zip
```

---

## 🔗 Links

* **Playable Game:** [https://taza67.itch.io/chronicle](https://taza67.itch.io/chronicle)
* **GitHub Repository:** [https://github.com/Taza67/chronicle](https://github.com/Taza67/chronicle)
