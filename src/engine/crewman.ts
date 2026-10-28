// The crew as people (docs/FRAME-CREW.md). Past the four bench-mates, every sworn man has a temperament; now he
// speaks by it (banter), a scene can be about him ({man}), his death is remembered, and his deeds earn him a name.
import type { ContentBundle } from '../content/schema';
import type { GameState, SwornMan } from './state';
import type { RngCursor } from './rng';
import { addLoyalty } from './crew';
import { journal } from './journal';
import { addDeed } from './fame';

export const TEMPERAMENTS = ['steady', 'hot', 'greedy', 'pious', 'ambitious', 'dour'] as const;
export type Temperament = (typeof TEMPERAMENTS)[number];

export const CREW = {
  /** Deeds that earn a sworn man a byname from the crew. */
  bynameAt: 3,
  /** A man of his own fights on the cloak: his chance, by his weapons against the other man's. */
  fightBase: 0.5,
  fightStep: 0.1,
  /** A man settled on his lord's land brings this many to the spring muster. */
  settleMuster: 2,
} as const;

/** What the crew calls a man who has done enough, by his temperament. */
const BYNAMES: Record<Temperament, string[]> = {
  steady: ['the Patient', 'Stone-foot', 'the Anvil'],
  hot: ['the Bold', 'Hothead', 'Axe-biter'],
  greedy: ['Ring-counter', 'the Purse', 'Silver-tooth'],
  pious: ['Raven-watcher', 'the Godly', 'Hammer-kisser'],
  ambitious: ['the Eager', 'High-reach', 'Steer-oar'],
  dour: ['the Grim', 'Rain-cloud', 'Sour-milk'],
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A living sworn man of this temperament, the one with the most deeds (the crew's best-known of his kind). */
export function pickCrewman(state: GameState, temperament: string): SwornMan | undefined {
  return state.men.filter((m) => m.alive && m.sworn && m.temperament === temperament && !(m.hurtUntil && m.hurtUntil > state.day))
    .sort((a, b) => b.deeds - a.deeds || a.name.localeCompare(b.name))[0];
}

/** The man the open scene is about. */
export function focusMan(state: GameState): SwornMan | undefined {
  return state.mfocus ? state.men.find((m) => m.id === state.mfocus) : undefined;
}

/** His name as the crew says it: with his byname, if he has earned one. */
export function manName(m: SwornMan): string {
  return m.nickname ? `${m.name} ${m.nickname}` : m.name;
}

/** A sworn man has died: his own mourning scene if one is written, else the hird's. */
export function mournMan(state: GameState, content: ContentBundle, m: SwornMan): void {
  if (content.scenes[`mourn_${m.id}`]) state.queue.push({ scene: `mourn_${m.id}`, day: state.day + 1 });
  else if (m.sworn && content.scenes.mourn_hird) state.queue.push({ scene: 'mourn_hird', day: state.day + 1, man: m.id });
}

export type CrewmanEffect = { loyalty?: number; leave?: string; dies?: string; settle?: boolean; deed?: string; fights?: { foe: string; win?: string; lose?: string } };

/** What a crew scene's choice does to the man it is about. */
export function crewmanEffect(state: GameState, content: ContentBundle, rng: RngCursor, e: CrewmanEffect): void {
  const m = focusMan(state);
  if (!m || !m.alive) return;
  if (e.loyalty) addLoyalty(m, e.loyalty);
  if (e.deed) { m.deeds += 1; addDeed(state, content, { type: 'man_deed', text: e.deed.replace(/\{man\}/g, m.name) }); }
  if (e.fights) {
    // his life on the cloak, not the hero's: settled in one throw, by his weapons against the other man's
    const foe = content.fighters[e.fights.foe];
    const p = Math.min(0.9, Math.max(0.1, CREW.fightBase + CREW.fightStep * (m.weapons - (foe?.weapons ?? 3))));
    if (rng.float() < p) {
      m.deeds += 1;
      addDeed(state, content, { type: 'man_deed', text: `${m.name} won a holmgang` });
      if (e.fights.win) state.queue.push({ scene: e.fights.win, day: state.day, man: m.id });
    } else {
      m.alive = false;
      m.diedOn = state.day;
      journal(state, `${m.name} was killed on the holmgang cloak.`);
      if (e.fights.lose) state.queue.push({ scene: e.fights.lose, day: state.day, man: m.id });
    }
  }
  if (e.dies) {
    m.alive = false;
    m.diedOn = state.day;
    journal(state, `${m.name} ${e.dies}.`);
  }
  if (e.leave || e.settle) {
    state.men = state.men.filter((x) => x !== m); (state.usedNames ??= []).push(m.name);
    journal(state, e.settle ? `${m.name} left the benches to farm your land.` : `${m.name} ${e.leave}.`);
    // a man settled on his lord's land answers the muster at home
    if (e.settle) state.musterPool += CREW.settleMuster;
  }
}

/** The turn of the year: a man with enough deeds gets a name from the crew. Returns the lines. */
export function crewBynames(state: GameState): string[] {
  const out: string[] = [];
  for (const m of state.men) {
    if (!m.alive || m.nickname || m.deeds < CREW.bynameAt) continue;
    const list = BYNAMES[m.temperament as Temperament] ?? BYNAMES.steady;
    m.nickname = list[hash(m.id) % list.length]!;
    out.push(`The crew have started calling ${m.name} "${m.nickname}". He pretends not to like it.`);
    journal(state, `${m.name} is called ${m.nickname} now.`);
  }
  return out;
}
