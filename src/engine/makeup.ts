// Character creation (docs/FRAME-LINEAGE.md A): the attributes are bought from a pool, the beginning's own total;
// the skills come from one of three ways he was raised. The beginning's spread and its first set are the defaults,
// so a life begun without changing anything plays as before.
import type { Attr, Background, Skill } from '../content/schema';
import { ATTRS, SKILLS } from '../content/schema';

export const MAKEUP = { min: 1, max: 5, skillPoints: 7 } as const;

/** What each attribute does, in a line, from the rules that read it. */
export const ATTR_WORDS: Record<Attr, { name: string; does: string }> = {
  str: { name: 'Strength', does: 'How hard your heavy blows land, and who wins when shields meet.' },
  agi: { name: 'Agility', does: 'Your quick cuts, and getting your guard up in time.' },
  end: { name: 'Endurance', does: 'Your blood and wind in a fight, and living through a wreck.' },
  wit: { name: 'Wits', does: 'Reading a fight and a coast, hearing what matters, and most checks of sense.' },
  pre: { name: 'Presence', does: 'How many men come to your muster, and most checks of standing among men.' },
};

/** The pool: the beginning's own total. */
export function attrPool(bg: Background): number {
  return ATTRS.reduce((a, k) => a + bg.attrs[k], 0);
}

/** An heir's starting spread (docs/FRAME-LINEAGE.md B): the same pool as every beginning. */
export const HEIR_ATTRS: Record<Attr, number> = { str: 3, agi: 2, end: 2, wit: 2, pre: 2 };

/** Why a spread can't be had, or null. The pool is the starting spread's total. */
export function makeupError(start: Record<Attr, number>, attrs: Record<Attr, number>): string | null {
  for (const k of ATTRS) {
    const v = attrs[k];
    if (!Number.isInteger(v) || v < MAKEUP.min || v > MAKEUP.max) return `${ATTR_WORDS[k].name} must be ${MAKEUP.min} to ${MAKEUP.max}.`;
  }
  const spent = ATTRS.reduce((a, k) => a + attrs[k], 0);
  const pool = ATTRS.reduce((a, k) => a + start[k], 0);
  return spent === pool ? null : `${spent} of ${pool} points spent.`;
}

/** The skills of the chosen set (the first if none, or an unknown one). */
export function skillsOf(bg: Background, set?: string): Record<Skill, number> {
  const s = bg.skill_sets.find((x) => x.id === set) ?? bg.skill_sets[0]!;
  return Object.fromEntries(SKILLS.map((k) => [k, s.skills[k] ?? 0])) as Record<Skill, number>;
}
