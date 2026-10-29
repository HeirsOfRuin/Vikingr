// The promise checker (docs/FRAME-GAUNTLET.md, check 4): what a choice's words say it costs or pays, against what
// its effects do. Two rules:
//   money: the text names a sum, the effects move silver, and no sum moved is near the one named;
//   goods: the effects put goods in the hold and the words never mention them (playtest 9: "I was told nothing").
import type { ContentBundle, Effect, Choice } from '../../src/content/schema';
import { ORTUG_PER_POUND } from '../../src/engine/tuning';

const WORD: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100 };
const NUM = '\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|a hundred|hundred';
const num = (w: string) => (/^\d+$/.test(w) ? Number(w) : w.toLowerCase() === 'a hundred' ? 100 : WORD[w.toLowerCase()]);
const P = ORTUG_PER_POUND;
/** Fractions of a pound, longest phrase first: each is taken out of the text once read. */
const FRACTIONS: [RegExp, number][] = [
  [/(a|one) pound and a half/gi, 1.5], [/(a|one) pound and a third/gi, 4 / 3], [/(a|one) pound and a quarter/gi, 1.25],
  [/three-quarters of a pound/gi, 0.75], [/a quarter[- ]of[- ]a[- ]pound|a quarter-pound|quarter-pound/gi, 0.25], [/half a pound|a half-pound|half-pound/gi, 0.5], [/a third of a pound/gi, 1 / 3],
];

/** Sums of silver named in a text, in ørtugar, and their total. Large sums (other men's ransoms, kings' tribute) are skipped. */
export function moneyIn(text: string): number[] {
  const out: number[] = [];
  let t = text.replace(/\n/g, ' ');
  for (const [re, f] of FRACTIONS) t = t.replace(re, () => { out.push(f * P); return ' '; });
  for (const m of t.matchAll(new RegExp(`\\b(${NUM})\\s+pounds?\\b(?! of gold)`, 'gi'))) { const n = num(m[1]!); if (n && n <= 20) out.push(n * P); }
  for (const m of t.matchAll(new RegExp(`\\b(${NUM})\\s+coins?\\b`, 'gi'))) { const n = num(m[1]!); if (n) out.push(n / 5); }
  if (out.length > 1) out.push(out.reduce((a, b) => a + b, 0));
  return out;
}

function amounts(effects: Effect[] | undefined, into: number[]): number[] {
  for (const e of effects ?? []) {
    if ('add' in e) for (const k of ['silver', 'loot'] as const) { const v = (e.add as Record<string, number>)[k]; if (v) into.push(Math.abs(v)); }
    if ('if' in e) { amounts(e.then, into); amounts(e.else, into); }
  }
  return into;
}
function goodsIn(effects: Effect[] | undefined, into: string[]): string[] {
  for (const e of effects ?? []) {
    if ('goods' in e) into.push(e.goods.id);
    if ('if' in e) { goodsIn(e.then, into); goodsIn(e.else, into); }
  }
  return into;
}
const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(4, 0.2 * b);

export interface Broken { scene: string; choice: string; rule: 'money' | 'goods'; detail: string }

export function checkPromises(content: ContentBundle): Broken[] {
  const out: Broken[] = [];
  const goodWords = (id: string) => {
    const g = content.goods[id];
    const words = [id, g?.name, ...(g?.lot ?? '').split(/\s+/).filter((w) => w.length > 3)].filter(Boolean).map((w) => w!.toLowerCase());
    // the common names a scene uses for them
    const extra: Record<string, string[]> = { furs: ['fur', 'pelt', 'marten', 'sable', 'squirrel'], wine: ['wine', 'cask'], salt: ['salt'], silk: ['silk'], amber: ['amber'], oil: ['oil', 'blubber', 'whale'], wool: ['wool', 'cloth', 'fleece'], glass: ['glass'], grain: ['grain', 'corn', 'barley', 'wheat'], hides: ['hide', 'leather'], stockfish: ['fish'], ivory: ['ivory', 'tusk', 'walrus'], down: ['down', 'eider'], falcons: ['falcon', 'hawk'], soapstone: ['soapstone', 'pot'], whetstones: ['whetstone', 'stone'] };
    return [...words, ...(extra[id] ?? [])];
  };
  for (const s of Object.values(content.scenes)) {
    for (const c of s.choices as Choice[]) {
      const branches: [string, Effect[]][] = [];
      const base = c.effects ?? [];
      if (c.check) {
        branches.push([`${c.text}\n${c.success?.text ?? ''}`, [...base, ...(c.success?.effects ?? [])]]);
        branches.push([`${c.text}\n${c.failure?.text ?? ''}`, [...base, ...(c.failure?.effects ?? [])]]);
      } else branches.push([`${c.text}\n${c.result ?? ''}`, base]);
      for (const [text, eff] of branches) {
        // a branch's own words name what it pays; the choice's words (a stake, a price) only when the branch names nothing
        const own = moneyIn(text.slice(c.text.length));
        const named = !c.check ? moneyIn(text) : own.length ? own : moneyIn(c.text);
        const moved = amounts(eff, []);
        if (named.length && moved.length && !named.some((n) => moved.some((m) => near(m, n)))) {
          out.push({ scene: s.id, choice: c.id, rule: 'money', detail: `text names ${named.map((n) => `${n} ø`).join(', ')}; effects move ${moved.map((m) => `${m} ø`).join(', ')}` });
        }
        const words = `${s.text}\n${text}`.toLowerCase();
        for (const g of goodsIn(eff, [])) if (!goodWords(g).some((w) => words.includes(w))) out.push({ scene: s.id, choice: c.id, rule: 'goods', detail: `puts ${g} in the hold; the text never mentions it` });
      }
    }
  }
  return out;
}
