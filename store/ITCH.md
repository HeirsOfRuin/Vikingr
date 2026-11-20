# Vikingr: the itch.io launch kit

Paid full game with a free demo (the author, 2026-11-20: "it is worth charging some money for it", with "a free
demo download that lets you play 2 or 3 years"). Everything to upload is built by the commands below; the page
copy is `store/description.html`; the files in the order to upload them are in the launch kit zip's START-HERE.

## Files

| File | What it is | Built by |
|---|---|---|
| `release/vikingr-1.0.0-demo-itch.zip` | The free demo, played on the page: the 830 start only, ends 1 March 832 with a save code | `npm run build:itch:demo` |
| `release/vikingr-1.0.0-download.zip` | The full game for Windows, macOS and Linux: one HTML file that plays offline, with the fonts' licences | `npm run build:single` |
| `vikingr.apk` | The full game for Android, signed with the HeirsOfRuin key | GitHub Actions, `android.yml` (`docs/ANDROID.md`) |
| `release/vikingr-1.0.0-itch.zip` | The full game as a browser zip: only needed for Plan B below | `npm run build:itch` |

The demo is the full game with two limits (`src/ui/demo.ts`): only Horik's days (830) can be begun, the later eras
are shown as the full game's, and on 1 March 832, as the spring muster opens, play stops on an end screen that
gives the save code and links to this page. The full game loads that code and goes on. Proved 2026-11-20 on three
bot lives (raider, reckless, homebody) played to February 832: each reached the end screen in the demo, the end
screen held after a reload, and each code loaded into the full game, which played one of them on to 836.

## Pricing

| Field | Value |
|---|---|
| Pricing | Paid, **$5.00**, "Allow people to pay more" on (name your price, $5 minimum) |
| Launch sale | 20% off for the first 7 days (Edit game > Sales). A sale lists the game on itch's sale pages. |
| If it does not sell | Drop to "No payments" with donations on, or $0 minimum. Nobody who paid loses anything. |

## Uploads: Plan A, one page (try this first)

1. **Upload 1:** `vikingr-1.0.0-demo-itch.zip`. Tick **"This file will be played in the browser"**, and tick
   **"This file is a demo"** if the upload form offers it.
2. **Upload 2:** the download zip. Platforms: Windows, macOS, Linux. Display name: "Vikingr (full game, opens in any browser)".
3. **Upload 3:** the APK. Platform: Android only. Display name: "Vikingr (Android)".
4. **Check it as a visitor before going public.** Save as a draft, open the page in a private window while logged
   out, and confirm the demo plays on the page without paying. Not verified from here: whether itch lets a paid
   project's browser game be played free. If it asks for payment first, use Plan B.

## Uploads: Plan B, two pages (if the demo will not play free on a paid page)

- **"Vikingr (demo)"**, free (No payments): the demo zip played in the browser. In its description, a line and a
  link: "The full game: [Vikingr](https://edmodo1.itch.io/vikingr)".
- **"Vikingr"**, paid as above: the download zip and the APK. Its description links back to the demo page.
- In `src/ui/demo.ts`, `FULL_GAME_URL` already points at the paid page; if the paid page's address differs,
  change it and rebuild the demo.

## Page settings

| Field | Value |
|---|---|
| Kind of project | HTML |
| Embed | **540 x 960** (`npx tsx tools/make-press.ts --only=embed`, results in `store/embed-check.txt`) |
| Mobile friendly | On, orientation portrait |
| Fullscreen button | On. Automatically start on page load: on (the game opens on its title screen) |
| Scrollbars | Enable scrollbars: on (scene text scrolls inside the frame; the tab bar stays at the bottom) |
| Classification | Games |
| Release status | Released |
| Genre | Simulation (the life-simulation and simulation listings send this account most of its visits) |
| Tags | historical, vikings, medieval, life-simulation, text-based, interactive-fiction, choices-matter, rpg, turn-based, pixel-art |
| Cover | `store/cover.png` (630 x 500). `cover-315.png` is only for checking it at listing size; do not upload it. |
| Screenshots | In order: `shot-1-story.png`, `shot-2-map.png`, `shot-3-battle.png`, `shot-4-plunder.png`, `shot-5-lords.png` |
| Short description | `store/short-description.txt` |
| Description | `store/description.html`, pasted with the <> (HTML) button |
| Content | Violence, death and slavery: say so in the description (it does) and in itch's content questionnaire |
| Community | Comments on, so players can post save codes with bug reports |

## AI disclosure

Filled 2026-11-20 with the wording the author's other pages use; the author confirms or edits it. In the upload
form's "AI generation disclosure", tick **Text**, **Graphics** and **Code**. The page line (last line of the
description):

> Made with AI assistance. I designed the game, its systems and its world, and directed, edited and play-tested it;
> the code, the text and the pictures were generated with AI models to that design, and the pictures redrawn in the
> game's own fixed palette.

The in-game About screen already says the pictures are "generated source images, cropped and redrawn in the game's
own fixed palette" (`src/ui/components/Help.tsx`).

## Privacy

No account, no ads, no analytics. Nothing leaves the page: `tools/make-press.ts` fails if the page requests
anything outside its own files, and the download was opened from disk on 2026-11-20 with every network request
refused: 4 typefaces loaded from the file, a life loaded and played, no outside requests.

## Known constraints

- Saves live in the browser or app they were made in. To move a life between the demo, the download, the app and
  another device, use the menu's **Save as text**, then **Load a saved life** on the title screen.
- The download does not keep saves in Safari when opened from a file; Chrome, Edge and Firefox do.
- The demo's browser game and the full download keep separate saves: the demo's end screen gives the code.

## Before going public

- [ ] `npm run check` green on the commit being released
- [ ] The three files built from that commit (demo zip, download zip, APK from GitHub)
- [ ] The draft opened logged out in a private window: the demo plays on the page; Plan A or B decided
- [ ] On a phone: the demo to its end screen (or load a code near the end), copy the code, open the full game, load it
- [ ] The APK installed on an Android phone, a life begun, a save code loaded
- [ ] Then Public, and post the launch devlog (`store/devlog-launch.md`)

## After publishing

Watch the comments the first week and ask for a save code with every bug report. Each fix: rebuild the files,
upload over the old ones (the page stays), and a devlog for anything players would notice.
