#!/usr/bin/env node
// The store rules a tool can check (references/store-page.md). Run in a game repo:
//   node tools/check-store.mjs [--slug=<itch slug>] [--account=heirs-of-ruin] [--dir=.]
//
// 1. Links: no link to the old account (edmodo1) anywhere in a tracked file, and every *.itch.io game link on the
//    account. The account was renamed 2026-11-21 and three games had the old address built in.
// 2. The rating ask: both markers in the game's own code, data-rate="first-stop" and data-rate="end" (or
//    rate:first-stop / rate:end in a comment). Seven ratings in about 4,200 views, and nothing had asked.
// 3. The listing: a short description under 120 characters, and the cover's verb row filled in (The Lists).
// History is exempt from the link check: docs/audit/, retrospectives/, transcripts/, playthroughs/.
// Exit 1 on any failure; prints what to fix. Run on all sixteen HeirsOfRuin game repos, 2026-11-21: it found the
// old address in Vikingr and on the House of Adalia branch, and no rating ask in any game.

import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); return [m[1], m[2] ?? true]; }));
const dir = resolve(String(args.dir || '.'));
const account = String(args.account || 'heirs-of-ruin');
const OLD = ['edmodo1'];
const HISTORY = /(^|\/)(audit|retrospectives?|transcripts|playthroughs)\//;
const exists = async (p) => !!(await stat(p).catch(() => null));

let fails = 0;
const ok = (m) => console.log(`ok  ${m}`);
const bad = (m, detail = []) => { fails++; console.log(`!!  ${m}`); for (const d of detail.slice(0, 12)) console.log(`      ${d}`); if (detail.length > 12) console.log(`      ... and ${detail.length - 12} more`); };
const note = (m) => console.log(`--  ${m}`);

// the files git tracks (a checkout without git: say so and stop, rather than scan node_modules)
let files;
try { files = execFileSync('git', ['ls-files'], { cwd: dir, encoding: 'utf8' }).split('\n').filter(Boolean); }
catch { console.log('!!  not a git repository: run from a game checkout'); process.exit(1); }
const TEXT = /\.(m?[jt]sx?|cjs|json|ya?ml|html?|css|md|txt|webmanifest|xml|gradle|kt|java)$/i;
const texts = files.filter((f) => TEXT.test(f) && !/(^|\/)(package-lock\.json|node_modules\/)/.test(f));
const read = async (f) => readFile(join(dir, f), 'utf8').catch(() => '');

// ---- 1. links
const oldHits = [], foreign = [];
const itchLink = /https?:\/\/([a-z0-9-]+)\.itch\.io\b[^\s"'`)<>\]]*/gi;
for (const f of texts) {
  if (HISTORY.test(f)) continue;
  const lines = (await read(f)).split('\n');
  lines.forEach((l, i) => {
    for (const o of OLD) if (l.includes(`${o}.itch.io`) || l.includes(`itch.io/profile/${o}`)) oldHits.push(`${f}:${i + 1}: ${l.trim().slice(0, 110)}`);
    for (const m of l.matchAll(itchLink)) {
      const sub = m[1].toLowerCase();
      if (sub === account || sub === 'html-classic' || sub === 'html' || OLD.includes(sub)) continue;
      foreign.push(`${f}:${i + 1}: ${m[0]}`);
    }
  });
}
if (oldHits.length) bad(`links to the old account (use https://${account}.itch.io/...)`, oldHits);
else ok('no links to the old account');
if (foreign.length) bad(`itch links under another account (should be https://${account}.itch.io/...)`, foreign);
else ok(`every itch game link is on ${account}.itch.io`);
if (args.slug) {
  const want = `${account}.itch.io/${args.slug}`;
  const all = (await Promise.all(texts.filter((f) => !HISTORY.test(f)).map(read))).join('\n');
  if (all.includes(want)) ok(`the game links to its own page (${want})`);
  else note(`nothing links to https://${want} yet (the rating ask should)`);
}

// ---- 2. the rating ask, in the game's own source (not its docs)
const code = texts.filter((f) => /\.(m?[jt]sx?|cjs|html?|ya?ml)$/i.test(f) && !/(^|\/)(docs|tests?|tools|sim|prototypes|android|\.github)\//.test(f) && !HISTORY.test(f));
const where = { 'first-stop': [], end: [] };
for (const f of code) {
  const t = await read(f);
  for (const k of Object.keys(where)) if (new RegExp(`data-rate=["']${k}["']|rate:${k}\\b`).test(t)) where[k].push(f);
}
for (const [k, fs] of Object.entries(where)) {
  if (fs.length) ok(`rating ask at ${k === 'end' ? 'the end' : 'the first stopping point'} (${fs.join(', ')})`);
  else bad(`no rating ask at ${k === 'end' ? 'the end' : 'the first stopping point'}: mark it data-rate="${k}" (templates/rate-prompt.js)`);
}

// ---- 3. the listing
const shortPaths = ['docs/itch/short-description.txt', 'store/short-description.txt', ...files.filter((f) => /(^|\/)docs\/itch\/short-description\.txt$/.test(f))];
let short = null, shortAt = null;
for (const p of shortPaths) if (await exists(join(dir, p))) { short = (await read(p)).trim(); shortAt = p; break; }
if (short === null) note('no short-description.txt: write the one-line field down as docs/itch/short-description.txt (the verbs, then the arc, under 120 characters), so it is checked and kept');
else if (short.length > 120) bad(`short description is ${short.length} characters (itch cuts it at about 120): ${shortAt}`);
else if (/^\s*</.test(short) || /<[a-z][^>]*>/i.test(short)) bad(`short description still holds a placeholder: ${shortAt}`);
else ok(`short description, ${short.length} characters: "${short}"`);
const covers = files.filter((f) => /(^|\/)(docs\/itch|store)\/cover\.html$/.test(f));
for (const c of covers) {
  if (/Verb · Verb|VERB · VERB/.test(await read(c))) bad(`${c}: the verb row is still the placeholder (The Lists: "Joust · Court · Marry · Choose a side")`);
  else ok(`${c}: the verb row is filled in`);
}
if (!covers.length) note('no cover.html in docs/itch or store: if the cover is drawn elsewhere, check its verb row by eye');

console.log(fails ? `\n${fails} store problem(s): references/store-page.md says why each matters` : '\nstore checks clean');
process.exit(fails ? 1 : 0);
