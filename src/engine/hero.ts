// The hero's body: attributes after wounds, hit points, skills learned by use,
// wounds that heal or stay, ageing, and death.
import type { Attr, ContentBundle, Skill } from '../content/schema';
import type { Death, GameState } from './state';
import type { RngCursor } from './rng';
import { ageOn } from './calendar';
import { HP_BASE, HP_PER_END, SKILL_XP_PER_LEVEL, STRAW_DEATH_AGE, STRAW_DEATH_PER_YEAR } from './tuning';
import { addDeed, lastingFame, livingFame } from './fame';
import { journal } from './journal';

export function effAttr(state: GameState, content: ContentBundle, a: Attr): number {
  let v = state.hero.attrs[a];
  for (const w of state.hero.wounds) v += content.injuries[w.id]?.attrs?.[a] ?? 0;
  const age = ageOn(state.day, state.hero.born);
  if (age >= 45 && (a === 'str' || a === 'agi' || a === 'end')) v -= Math.floor((age - 40) / 8);
  return Math.max(1, v);
}

export function hpMax(state: GameState, content: ContentBundle): number {
  return HP_BASE + HP_PER_END * effAttr(state, content, 'end');
}

export function age(state: GameState): number {
  return ageOn(state.day, state.hero.born);
}

/** Learning by use. Returns a line when the skill rises. */
export function learn(state: GameState, skill: Skill, xp: number, ceiling = 10): string | null {
  const h = state.hero;
  if (h.skills[skill] >= ceiling) return null;
  h.xp[skill] += xp;
  const need = SKILL_XP_PER_LEVEL * (h.skills[skill] + 1);
  if (h.xp[skill] >= need) {
    h.xp[skill] -= need;
    h.skills[skill] += 1;
    return `${skill[0]!.toUpperCase()}${skill.slice(1)} rises to ${h.skills[skill]}.`;
  }
  return null;
}

export function addWound(state: GameState, content: ContentBundle, injury: string, from: string): void {
  const def = content.injuries[injury];
  if (!def) throw new Error(`unknown injury ${injury}`);
  const existing = state.hero.wounds.find((w) => w.id === injury);
  if (existing && existing.until === -1) return;
  const until = def.days === undefined ? -1 : state.day + def.days;
  if (existing) existing.until = Math.max(existing.until, until);
  else state.hero.wounds.push({ id: injury, until, from });
  journal(state, `${def.name}: ${from}.`);
  if (def.deed) addDeed(state, content, { type: 'scar', text: `${def.name}, from ${from}`, witnesses: 10 });
}

const LIGHT = ['gashed_arm', 'cracked_ribs', 'gashed_leg', 'broken_nose'];
const SEVERE = ['lost_eye', 'broken_hand', 'bad_knee', 'face_scar', 'lost_fingers'];

/** A wound for a hit of this weight. Severe hits are more likely to leave something permanent. */
export function woundFor(rng: RngCursor, severe: boolean): string {
  const list = severe && rng.float() < 0.6 ? SEVERE : LIGHT;
  return list[rng.int(list.length)]!;
}

/** Rest and time: hit points come back and wounds close. Slower with age. */
export function heal(state: GameState, content: ContentBundle, days: number, rate = 0.5): void {
  const a = age(state);
  const r = rate * (a > 35 ? 0.7 : 1) * (a > 50 ? 0.7 : 1);
  state.hero.hp = Math.min(hpMax(state, content), state.hero.hp + days * r);
  state.hero.wounds = state.hero.wounds.filter((w) => w.until === -1 || w.until > state.day);
}

/** Dying of age or sickness, rolled once a year past the age. */
export function strawDeathCheck(state: GameState, rng: RngCursor): boolean {
  const over = age(state) - STRAW_DEATH_AGE;
  if (over < 0) return false;
  return rng.float() < STRAW_DEATH_PER_YEAR * (over + 1);
}

/** Where the dead go. Phase 1 rules; DESIGN §14 has the full judgment. */
export function afterlife(state: GameState, cause: Death['cause']): Death['afterlife'] {
  if (cause === 'drowned') return 'ran';
  if (cause === 'straw') return 'hel';
  const score = lastingFame(state) + livingFame(state) * 0.5 + state.honour * 2 + state.hamingja;
  return score >= 30 ? 'valhalla' : 'folkvangr';
}

export function kill(state: GameState, cause: Death['cause'], text: string): void {
  state.hero.alive = false;
  state.hero.hp = 0;
  state.death = { day: state.day, cause, text, afterlife: afterlife(state, cause) };
  journal(state, text);
}
