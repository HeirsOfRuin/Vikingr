# Vikingr: itch.io store page (draft)

## Tagline

A life in the Viking age, 830 to 878, from an oar-bench in another man's ship to a hall, ships and land of your own. A story you choose your way through, and a strategy game about men, silver, ships and names.

## Description

Vikingr is one man's life in the age of the great raids. You start with almost nothing, rowing in another captain's ship. What follows is up to you: the monasteries of Iona and Bangor, the trading beaches of Kaupang and Hedeby, the Irish ship-forts, the Frankish rivers, and in time the Great Army in England.

It is a story, read in short scenes with choices, and a strategy game underneath. You sign on men and keep them fed and paid. You buy and mend ships. You fight in the shield-wall and in single combat, plunder and trade, swear to a lord or refuse to, take land and try to hold it through the winters you are away. Your fame grows when your deeds are told at a feast. When you die, your son can go on with what is left.

The world follows the annals: the Irish, Frankish and English chronicles, and the sagas written down later. Real men such as Turgeis, Ragnarr and Ívarr come and go on their own dates.

It is made for a phone and plays in any browser. There is no account, no ads and no analytics. Your life is saved on your own device, and you can copy it out as a short text save code.

The 9th century was brutal. Killing, slavery and death are part of this game. They are never glorified.

## Features

- 636 written scenes, about 67,000 words of story, with over 1,500 choices.
- 56 places to sail to, from Iceland to Garðaríki and from Hordaland to Aquitaine, across 28 regions.
- 3 starting eras: Horik's days (830), Ragnarr's days (843) and the Great Army (865).
- 3 backgrounds (younger son, outlaw, freedman) and 6 upbringings (farm, sword, oar, hall, ship, stories).
- 13 historical rivals whose fame rises against yours, and 7 lords to serve, defy or betray.
- Shield-wall battles and single combat, round by round. Plunder, trade, captives and ransom.
- Land of your own: farms bought abroad, ship-forts taken and garrisoned, lordships, and in the end a sea-jarldom.
- A family and an heir: when you die, a son can carry the saga on.
- Pixel art in one fixed palette, animated in code.
- Made for a phone: one column, thumb-sized buttons, a tab bar at the bottom.

How the counts were taken: `npx tsx tools/make-press.ts --only=counts` loads `content/` through the game's own content loader (`tools/content-loader.ts`, which validates every file against the schema) and writes `store/counts.json`. Scenes, places, backgrounds, upbringings, rivals and lords are the sizes of those collections in the bundle. Words are the whitespace-separated words in all scene texts. Choices are every scene's choice list added up. Regions are the distinct `region` names of the 56 places. Eras are the default 830 start plus the two later starts in `src/engine/era.ts`. Six of the 642 scenes in the bundle are old Phase 1 placeholders (`p1_*`) that need `flag.placeholder_start`, which nothing in the game sets: no player reaches them, so the page counts 636, and the words and choices are rounded down to cover them.

The lords count includes the home jarl (the jarl, Harek, Kolbeinn, King Horik, Turgeis, Niall Caille, Rorik). "6 lords abroad, and your own jarl" is the stricter wording.

## Screenshots (upload in this order)

1. `shot-1-story.png`: a story scene with its picture and three choices (the wedding on the benches, 833).
2. `shot-2-map.png`: the map of the known world in 842, with sea roads and the Lindisfarne card open.
3. `shot-3-battle.png`: a shield-wall in round 3 against a rival crew, 49 men a side.
4. `shot-4-plunder.png`: plundering Bangor with the alarm rising.
5. `shot-5-lords.png`: the Saga tab's Lords, land and rule card twelve years in: a ship-fort, two farms abroad, a lordship.

Cover: `cover.png` (630 x 500). `cover-315.png` is only there to check how the cover reads at the size itch uses in its grids. Do not upload it.

## itch.io settings

- **Kind of project:** HTML.
- **Upload:** run `npm run build:itch` and upload `release/vikingr-1.0.0-itch.zip`. `index.html` is at the root of the zip, there is no service worker, and the font licences are in `LICENSES/`. Tick "This file will be played in the browser".
- **Pricing:** USD 2.00. Leave "Allow people to pay more" on if you want it.
- **Embed options:** "Embed in page", viewport **540 x 960** (portrait, 9:16).
  - Measured with `npx tsx tools/make-press.ts --only=embed`, which loads the built game in an iframe of each size and checks that every title button and the About link is on screen without scrolling. The results are in `store/embed-check.txt`.
  - 540 x 960: everything is visible, for a first visit and with a saved life (the About link ends at 806 and 864 px).
  - 540 x 860 also fits, but with a saved life the About link sits 4 px from the bottom edge.
  - 720 x 900 and 480 x 800 put the About link below the fold when there is a saved life (the life itself is still reachable).
  - The layout is one column up to 720 px wide, so a wider frame only adds empty margins.
- **Mobile friendly:** on. **Orientation:** portrait.
- **Fullscreen button:** on. Turn off "Automatically start on page load" only if you want a click-to-launch cover. Starting on load is fine, because the game opens on its title screen.
- **Scrollbars:** leave "Enable scrollbars" on. The scene text scrolls inside the frame and the tab bar stays fixed at the bottom.
- **Genre:** Interactive Fiction, or Strategy. **Tags:** historical, vikings, text-based, choices-matter, medieval, singleplayer, mobile, pixel-art, turn-based, story-rich.
- **Content warning (description, and the itch "content" questionnaire):** violence, death and slavery.

## Privacy

No account, no ads, no analytics. Nothing leaves the page: an earlier audit of the build checked this, and `tools/make-press.ts` checks it again on every run, failing if the page requests anything outside its own files. Your life is kept in this browser only.

## Known constraints

Saves live in this browser, on this device. Clearing site data, using a private window, or playing on another device starts you fresh. To move a life between devices, or to keep it safe, open the menu and use **Save as text**. Paste the code into **Load a saved life** on the title screen.

## AI disclosure (Josh to fill in)

> **[JOSH: fill in before publishing.]** The scene pictures were made with an image generator and then cropped, reduced to 400 x 160 and redrawn in the game's fixed palette by `tools/art.ts` (notes in `docs/ART.md`). itch.io asks about generative AI on the upload form ("AI generation disclosure"): say which tool made the source images, and whether any of the text or code was AI-assisted. The in-game About screen credits the fonts, map data and sources, but not the pictures yet, so add a line there too.
