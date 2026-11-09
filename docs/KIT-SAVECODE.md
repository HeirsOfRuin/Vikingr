# Short save codes: a drop-in for every game

Josh, 2026-11-09: "Most of the games we make have huge save codes. Is there any way we could implement a shorter code?
We could then add it to the game workshop for every game to use."

**The file:** `tools/kit/savecode.js` (plain JavaScript, no dependencies; `savecode.d.ts` beside it for TypeScript
games). Copy it into a game's `src/`, or inline it into a single-file game.

## What it does
1. **Arrays of objects are stored by column** (all the days together, all the names together). Deflate packs that a
   few percent tighter. Reversed exactly on load.
2. **Deflate** with the browser's own `CompressionStream('deflate-raw')` (every current browser, Node 18+).
3. **The short form writes 14 bits in each character**, using 16,384 CJK ideographs (U+4E00 to U+8DFF), then one
   closing character that records the padding. Base64 writes 6 bits a character, so the same bytes take 2.3 times
   fewer characters. Chat boxes, text fields and most messaging apps count characters, not bytes.
4. **The plain form** (`PREFIX.` + base64url) is for places that only take plain letters, or count bytes: in UTF-8 a
   CJK character is three bytes.
5. **The decoder takes either form**, ignores the spaces and line breaks a messenger adds, and says in a sentence a
   player can act on when a code is cut short or belongs to another game.

## Measured (Vikingr, Josh's own saves)
| Save | Old code (deflate + base64) | Plain form | Short form | Short, in UTF-8 bytes |
|---|---|---|---|---|
| Ragnavald, spring 834 | 14,490 | 12,040 | 5,165 | 15,483 |
| Ragnavald, autumn 836 | 17,121 | 14,573 | 6,250 | 18,738 |
| Ragnavald, autumn 837 | 19,585 | 16,865 | 7,233 | 21,687 |
| Ragnavald, spring 838 (4 ships, 163 deeds) | not measured | 17,557 | 7,529 | 22,575 |

The 837 code was cut off at 20,000 characters, the most one Claude-app message carries. The short form of the same save
is 7,233.

**Confirmed in use (2026-11-09):** Josh pasted the 838 short code into the Claude app. It arrived whole, decoded, and
re-encoded to the identical text. At 22,575 bytes it is over 20,000 bytes, so the app's limit counts characters, not
bytes, and the short form is the one to share there.

Tried and not taken: a preset deflate dictionary built from bot saves saved a further 13% but needs a deflate library
(CompressionStream has no dictionary option), a 32 KB dictionary shipped in every build, and a version for each
dictionary. Storing only the fields that differ from a fresh game saved 2%.

## Usage
```js
import { packCode, unpackCode } from './savecode.js';
const code = await packCode('MYGAME1', save);                  // short: MYGAME1~...
const plain = await packCode('MYGAME1', save, { plain: true }); // plain: MYGAME1....
const back = await unpackCode('MYGAME1', pastedText);           // either form
```
Version the prefix with the save format (MYGAME1, MYGAME2). Keep the old decoder for the old prefix, as Vikingr does
for VIKR1 (`src/engine/savecode.ts`). Offer both buttons in the menu: the short code first, and "plain letters
(longer)" for places that will not take it.

## Adding it to the game workshop (the game-building skill)
The skill is synced from claude.ai, so it is changed there, not in a session. Three additions:
1. `scripts/savecode.js` (this file) in the skill's scripts folder.
2. A row in the skill's Files table: "`scripts/savecode.js`: short save codes; columns + deflate + 14 bits a
   character, with a plain-letter form; 2.7x shorter than base64 on a long Vikingr save."
3. A line in its Day-one checklist, beside the save-versioning line: "Save codes from `scripts/savecode.js`: short form
   by default, plain form on a second button; test a long late-game save against the 20,000-character message limit."
