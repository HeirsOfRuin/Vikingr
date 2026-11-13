# Vikingr

A turn-based RPG of one man's life in the 9th century: from nothing, through fame and renown, to sea king and, if he dies well, Valhalla.

**Status:** version 1.0. 642 written scenes over three eras (830, 843, 865), 56 places on a real-coastline map, shield-wall battles and single combat, fleets, trade, lords, land and rule. Design and every decision: `docs/DESIGN.md`. Writing rules: `content/style-guide.md`. Store page draft: `store/ITCH.md`.

## Play as an app
Published to GitHub Pages by `.github/workflows/pages.yml` on every push, once Pages is switched on (one-time setup: Settings > Pages > Build and deployment > Source: GitHub Actions). Then: https://heirsofruin.github.io/Vikingr/

- **Phone:** open the link, then Share > Add to Home Screen (iPhone) or the menu > Install app (Android).
- **Saves** live on the device. Move a life between devices with Menu > Save as text / Load from text.

## Run
```
npm install
npm run dev          # local dev server
npm run build        # release site in dist/ (what players get)
npm run build:dev    # the same with the playtest chapter jumps and ?debug=1 state dump
npm run build:itch   # release build zipped for itch.io: release/vikingr-<version>-itch.zip
npm run build:artifact  # one self-contained file for a claude.ai preview (keeps the playtest jumps)
```

## Check
```
npm test                    # unit tests
npm run validate            # content validator
npm run lint:style          # style-guide lint over all player-facing text
npm run bot -- --runs 100   # lives played by five policies; fails on dead ends, softlocks, non-progress
npm run measure:battle      # shield-wall balance
npm run measure:duel        # single-combat balance
npm run smoke               # Chromium at phone size; screenshots in smoke-out/ (npm run build:dev first)
npm run check               # typecheck + test + validate + lint + bot
npm run map                 # rebuild the map from Natural Earth (downloads into .map-cache/)
node tools/make-icons.mjs   # rebuild the app icons
```
