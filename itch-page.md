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

> Rule as history's leaders. Face real crises, balance your empire, and bet on what history actually did.

## Description

**Chronicle** is a historical decision visual novel designed for mobile and desktop browsers.

Take the throne of iconic rulers (Napoleon, Cleopatra, Elizabeth I, Ashoka, Mansa Musa) or summon any historical figure to face authentic dilemmas from their reign.

### How it works:
* **Face real crises:** Court advisors present historical dilemmas. Decide your policy by tapping or speaking out loud.
* **Manage your empire:** Balance Gold, Stability, and Legacy across a 5-turn reign to avoid bankruptcy or rebellion.
* **Bet with the Oracle:** Guess whether your decision matches what the historical ruler actually did to earn bonus score multipliers.
* **Learn history & "What If":** Discover verified historical facts when you follow history, or explore plausible alternate timelines when you choose differently.
* **The Codex & Chronicle:** Collect historical records across civilisations and review past reign scorecards.

Built for the **Voodoo × Gradium × Cognition × Google DeepMind** hackathon.  
Powered by Gemini 3.8, Gradium (voice synthesis & speech recognition), and engineered with Devin.  
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
