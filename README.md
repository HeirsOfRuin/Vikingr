# Vikingr

A turn-based RPG of one man's life in the 9th century: from nothing, through fame and renown, to sea king and, if he dies well, Valhalla.

**Status:** Phase 1. The engine, real-coastline map, combat, measuring tools and a placeholder UI are built. All story text is placeholder. Design: `docs/DESIGN.md`. Writing rules: `content/style-guide.md`.

## Play as an app
Published to GitHub Pages by `.github/workflows/pages.yml` on every push, once Pages is switched on (one-time setup: Settings > Pages > Build and deployment > Source: GitHub Actions). Then: https://heirsofruin.github.io/Vikingr/

- **Phone:** open the link, then Share > Add to Home Screen (iPhone) or the menu > Install app (Android).
- **Saves** live on the device. Move a life between devices with Menu > Save as text / Load from text.

## Run
```
npm install
npm run dev          # local dev server
npm run build        # static site in dist/
```
Add `?debug=1` to the URL for the state dump in the menu.

## Check
```
npm test                    # unit tests
npm run validate            # content validator
npm run lint:style          # style-guide lint over all player-facing text
npm run bot -- --runs 100   # lives played by five policies; fails on dead ends, softlocks, non-progress
npm run measure:battle      # shield-wall balance
npm run measure:duel        # single-combat balance
npm run smoke               # Chromium at phone size; screenshots in smoke-out/ (build first)
npm run check               # typecheck + test + validate + lint + bot
npm run map                 # rebuild the map from Natural Earth (downloads into .map-cache/)
node tools/make-icons.mjs   # rebuild the app icons
```
