# itch.io upload guide — Chronicle

## Upload (5 minutes)

1. https://itch.io/game/new
2. **Title**: Chronicle — **Project URL**: `chronicle`
3. **Kind of project**: HTML
4. **Uploads**: drag `chronicle-itch.zip` (from `npm run package`), tick **"This file will be played in the browser"**
5. **Embed options**:
   - Viewport: **Click to launch in fullscreen** (best on phones), or Embed in page **414 × 736**
   - Tick **Mobile friendly** and **Orientation: Portrait**
   - Tick **SharedArrayBuffer support**: no. Tick **Fullscreen button**: yes
   - Frame options: enable **Autoplay audio**? Not needed — the game unlocks audio on first tap (iOS-safe)
6. **Classification**: Game — **Genre**: Interactive Fiction / Educational — **Tags**: `history`, `narrative`, `ai`, `voice`, `mobile`, `singleplayer`, `phaser`
7. **Pricing**: No payments — **Visibility**: Public
8. Save & view. Test on a phone; the Worker URL is already baked in.

## Short description (tagline, ≤ 140 chars)

> Rule as they did. Or don't. Voiced advisors, real dilemmas, and the Oracle's bet — history you play, not read.

## Description

**Chronicle** puts you on the throne. Cleopatra, Napoleon, Ashoka, Mansa Musa, Elizabeth I — or any ruler who truly lived, summoned on demand and painted live.

Each turn, a voiced advisor brings you a real historical dilemma. Choose — by tap or by voice — then face the **Oracle**: did history make the same call? Guess right to chain a Legacy combo. Guess wrong and the Chronicle reveals what really happened… or spins the alternate history your decision would have written.

- **Five turns per chapter**, endless reigns, change of era whenever you wish
- **Three advisors** with trust, tempers and, when neglected, lies
- **Oracle's bet**, court hourglass, cascading crises (bankruptcy, revolt, prophecy)
- **Codex** of true facts and what-ifs, **Chronicle** of your past reigns
- **AI-generated verdicts**, and the real leader's judgement of your rule
- Civilization-style painted portraits that breathe, blink and speak in sync

Built in 24 h for the Voodoo × Gradium × Cognition × Google DeepMind hackathon.
Powered by **Gemini** (dilemmas, alternate histories, verdicts, on-demand leaders), **Gradium** (voices, speech input), **Nano Banana / Imagen** (portraits), **Lyria** (music), engineered with **Devin**. Phaser 3 · TypeScript · Cloudflare Workers.

Works in any modern mobile or desktop browser. Headphones recommended.

## Screenshots to take (phone, portrait)

1. Title screen
2. Leader carousel (Choose your reign)
3. Court with advisor speaking + subtitles
4. Choice cards
5. Oracle bet
6. Historical reveal parchment
7. Verdict scorecard
