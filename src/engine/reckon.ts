// The men's reckoning before a single combat (docs/FRAME-DUEL-3.md): the fight he is offered, run on the same
// engine forty times on instinct and forty times read with care, said in words. A challenge was accepted blind:
// the danger mark looked the same on a fight he would win almost always and one he would never win.
import type { ContentBundle, Effect } from '../content/schema';
import type { DuelState, GameState } from './state';
import { RngCursor, seedRng } from './rng';
import { heroDuel } from './fights';
import { boutAuto, boutExchange, fightOutBout } from './bout';

export const RECKON = {
  /** Fights run each way. */
  runs: 40,
  /** A careful reading this much better than instinct is worth saying. */
  readGain: 0.15,
} as const;

export interface Reckoning { instinct: number; reading: number }

const cache = new Map<string, Reckoning>();

/** How often he wins this fight: on instinct, and read with care. */
export function duelOdds(state: GameState, content: ContentBundle, foe: string, kind: DuelState['kind'], lethal: boolean): Reckoning {
  const key = [foe, kind, lethal, state.day, state.seed, state.stats.duels, state.stats.battles, state.hero.hp, JSON.stringify(state.hero.skills), JSON.stringify(state.kit)].join('|');
  const hit = cache.get(key);
  if (hit) return hit;
  let instinct = 0, reading = 0;
  for (let i = 0; i < RECKON.runs; i++) {
    const rng = new RngCursor(seedRng((state.seed ^ (i * 2654435761) ^ state.day) >>> 0));
    const a = heroDuel(state, content, foe, kind, lethal, rng);
    fightOutBout(a, rng, false);
    if (a.over === 'won' || a.over === 'foe_yielded') instinct++;
    const b = heroDuel(state, content, foe, kind, lethal, rng);
    for (let g = 0; g < 60 && !b.over; g++) boutExchange(b, boutAuto(b), rng);
    if (b.over === 'won' || b.over === 'foe_yielded') reading++;
  }
  const r = { instinct: instinct / RECKON.runs, reading: reading / RECKON.runs };
  if (cache.size > 200) cache.clear();
  cache.set(key, r);
  return r;
}

/** The reckoning in the men's words. */
export function reckonWords(r: Reckoning, lethal: boolean): string {
  const p = r.instinct;
  const base = p >= 0.85 ? 'The men reckon you\'d beat him easily'
    : p >= 0.6 ? 'The men reckon you\'d beat him more often than not'
    : p >= 0.4 ? 'The men reckon it could go either way'
    : p >= 0.15 ? 'The men reckon he\'d likely beat you'
    : lethal ? 'The men reckon he\'d kill you' : 'The men reckon he\'d beat you';
  const read = r.reading - r.instinct >= RECKON.readGain
    ? (r.reading >= 0.5 && p < 0.4 ? ', unless you watch him very closely' : ', more if you watch him well')
    : '';
  return `${base}${read}`;
}

/** The fight a choice offers, if any: in its effects, or behind its check. */
export function choiceFight(c: { effects?: Effect[]; success?: { effects?: Effect[] }; failure?: { effects?: Effect[] } }): { foe: string; kind: DuelState['kind']; lethal: boolean } | null {
  for (const list of [c.effects, c.success?.effects, c.failure?.effects]) {
    for (const e of list ?? []) if ('fight' in e) return { foe: e.fight.foe, kind: e.fight.kind, lethal: e.fight.lethal };
  }
  return null;
}
