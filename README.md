# Chronicle

*Rule as history's greatest leaders. Decide as they did — or dare to differ.*

Chronicle is a mobile-first HTML5 game built for the Voodoo × Gradium × Cognition × Google DeepMind hackathon.
You sit on the throne of Cleopatra, Napoleon, Ashoka, Mansa Musa or Elizabeth I (or any real ruler you summon by name).
Voiced, animated advisors bring you real historical dilemmas; you decide, wager with the Oracle on what history
actually did, then hear what really happened — or an AI-written alternate history when you chose differently.

## Sponsor technologies

| Sponsor | Use |
| --- | --- |
| **Google DeepMind** | Gemini generates chapters, alternate histories, verdicts, summoned leaders and interprets spoken answers; Nano Banana generated every portrait, mouth/eye variant and scene; Lyria generated the court music. |
| **Gradium** | Text-to-speech for every advisor, narrator and leader line (drives the lip-sync); speech-to-text for spoken decisions. |
| **Cognition** | The game was designed and built with Devin. |
| **Voodoo** | Mobile design principles: 4-minute sessions, one-thumb play, instant onboarding. |

## Gameplay

- **Council** — 5 dilemmas per chapter. Three advisors (Gold, Stability, Legacy) argue; you pick one of three choices, or speak your own.
- **Oracle's wager** — before the reveal, bet whether your choice is what history records. Correct = Legacy × combo (max 3).
- **Advisor trust** — follow or ignore your court. A bitter advisor (trust ≤ −2) may lie to you next turn.
- **Court hourglass** — optional 10 s timer; run out and an advisor decides for you.
- **Cascades** — Gold ≤ 1 → Bankruptcy, Stability ≤ 1 → Revolt, Legacy ≥ 9 → Prophecy: generated special turns.
- **Codex** — every fun fact and alternate history you uncover, per civilisation, with completion %.
- **Chronicle** — your reign history with AI-written verdicts and epithets. Shareable verdict card.
- Works fully offline with bundled chapters, simulated speech timing and local music.

## Stack

- [Phaser 3](https://phaser.io) + TypeScript + Vite, portrait 720×1280, `Scale.FIT`.
- Portrait animation: amplitude-driven lip-sync (Web Audio `AnalyserNode`), blinking, breathing, head sway, emotional lighting, parallax and particles.
- Cloudflare Worker (`worker/`) proxies Gemini / Gradium / image / music calls so no API key ships in the build; responses are cached in KV.

## Develop

```bash
npm install
npm run dev          # http://localhost:5173
npm run typecheck
npm run lint         # Biome
npm run build
npm run package      # dist → chronicle-itch.zip (upload as an HTML5 game on itch.io)
```

`VITE_WORKER_URL` (in `.env`) points the client at the deployed Worker. Without it the game runs offline.

### Worker

```bash
cd worker
npx wrangler secret put GOOGLE_API_KEY
npx wrangler secret put GRADIUM_API_KEY
npx wrangler deploy
```

### Content tools (`tools/`)

- `gen_art.py` — Nano Banana portraits, variants (mouth open/half, eyes closed), scenes and bounding boxes → `public/art/`.
- `gen_chapters.ts` — Gemini fallback chapters → `public/data/chapters/`.
- `gen_music.py` — Lyria court themes → `public/music/`.
- `smoke.mjs`, `smoke_scenes.mjs` — Playwright mobile-viewport smoke tests against the dev server.

## Architecture decisions

- **Phaser over DOM/CSS** — real scene lifecycle, tweens, particles, camera FX; exports as plain HTML5, the only format that reaches iOS *and* Android on itch.io.
- **Hybrid content** — live Gemini generation for endless replay, with pre-generated chapters, art and music bundled so the game never depends on the network.
- **Voice-first, text-optional** — every line is spoken; subtitles are on by default but the game is playable without reading.
- **Worker proxy** — keys stay server-side; the Worker adds caching (KV) and CORS so the static itch.io build can call it.
