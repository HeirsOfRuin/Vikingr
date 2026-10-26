// Render scan: plays bot runs, renders every step, and flags text a player should never see:
// raw {tokens} or [if] tags ([break] is the UI's page break and passes), "undefined"/NaN/null, @refs, doubled words, a sentence that
// starts lower-case, stray spaces before punctuation. Glitches found this way survive every
// content test, because they only appear in one state of one path.
//
//   npx tsx tools/narrative/render-scan.ts [--runs=15] [--strict]
//
// Hard patterns (a template that leaked) fail under --strict; soft ones are leads to read:
// an ellipsis or a quoted lower-case word can be right.
import { loadAdapter, args } from './adapter';

export const HARD: [string, RegExp][] = [
  ['brace', /[{}]/],
  ['tag', /\[(if|elif|else|\/if)\b/], // [break] is a page break the UI splits on, not a leak
  ['undefined', /\bundefined\b|\bNaN\b|\bnull\b|\[object Object\]/],
  ['at-ref', /(^|\s)@[a-z]/],
];
export const SOFT: [string, RegExp][] = [
  ['double-space', /\S {2,}\S/],
  ['space-punct', / [,.;:!?](\s|$)/],
  ['empty-quote', /""|“”/],
  ['dup-word', /\b(\w{2,}) \1\b/i],
  ['lower-after-stop', /[.!?] [a-z]/],
  ['start-lower', /^[a-z]/],
  ['stop-stop', /[!?,;][.,]|(?<!\.)\.,/],
];

export interface ScanHit { pattern: string; hard: boolean; where: string; excerpt: string }

export function scanText(where: string, text: string): ScanHit[] {
  const hits: ScanHit[] = [];
  for (const [list, hard] of [[HARD, true], [SOFT, false]] as const) {
    for (const [name, re] of list) {
      const m = re.exec(text);
      if (m) hits.push({ pattern: name, hard, where, excerpt: text.slice(Math.max(0, m.index - 50), m.index + 50).replace(/\n/g, ' ') });
    }
  }
  return hits;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const opt = args();
  const a = await loadAdapter();
  const content = a.load();
  const found = new Map<string, ScanHit>();
  let views = 0;
  a.play(content, opt.runs ?? 15, (o) => {
    views++;
    for (const t of o.texts) for (const h of scanText(`${t.scene} ${t.kind}`, t.text)) found.set(`${h.pattern}|${h.where}`, h);
  });
  const hits = [...found.values()];
  const by = new Map<string, ScanHit[]>();
  for (const h of hits) by.set(h.pattern, [...(by.get(h.pattern) ?? []), h]);
  for (const [p, list] of by) {
    console.log(`== ${p}${list[0]!.hard ? ' (template leak)' : ''} (${list.length})`);
    for (const h of list.slice(0, 12)) console.log(`  ${h.where}: …${h.excerpt}…`);
  }
  const hard = hits.filter((h) => h.hard).length;
  console.log(`\nrender scan: ${views} views, ${hard} template leaks, ${hits.length - hard} leads to read`);
  if (opt.strict && hard) process.exit(1);
}
