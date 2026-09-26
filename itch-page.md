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

## Visual Assets (Cover & Gameplay GIFs)

Pre-generated in `showcase/` (run `npm run showcase:gifs` to re-record anytime):
- **Cover Image**: `showcase/itch-cover.gif` (630 × 500 px, animated Berthier speaking with lip-sync)
- **Advisor Gameplay GIF**: `showcase/court-advisor.gif` (portrait with audio lip-sync and dialogue box)
- **Leader Carousel GIF**: `showcase/leader-carousel.gif` (painted leader carousel: Cleopatra, Napoleon, Mansa Musa)
- **Oracle Wager GIF**: `showcase/oracle-bet.gif` (card choice & 3D gold coin flip)

## Screenshots (Pre-generated in `showcase/screenshots/`)

All 7 official mobile screenshots are captured and ready to upload to itch.io:
1. `01-title-screen.png` — Écran titre avec les 5 souverains, braises dorées et menu
2. `02-leader-carousel.png` — Galerie impériale et carrousel des souverains (Napoléon Bonaparte)
3. `03-court-advisor-speaking.png` — Chambre des Tuileries, Berthier en uniforme parlant avec sous-titres
4. `04-choice-cards.png` — Décrets royaux I, II, III avec les trois Sceaux Royaux (Prescience, Trésorerie, Décret)
5. `05-oracle-wager.png` — Sanctuaire de l'Oracle avec astrolabe, pièce d'or 3D et stèles de pari
6. `06-historical-reveal.png` — Parchemin historique révélé avec sceau de cire impérial
7. `07-verdict-scorecard.png` — Proclamation impériale, bilan du règne (4/5 Accord, Piliers, Paris de l'Oracle)
