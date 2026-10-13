// Value paths used by conditions ("skill.weapons >= 3") and effects ({ add: { silver: -24 } }).
// One resolver for reading and one checker for the validator, so a path that
// reads also validates, and an unknown path fails the build.
import { ATTRS, SKILLS, PHASES, PLACE_KINDS, type Attr, type ContentBundle, type Skill } from '../content/schema';
import type { GameState } from './state';
import { dateOf } from './calendar';
import { effAttr, age } from './hero';
import { fameRank, lastingFame, livingFame } from './fame';
import { standing } from './standing';

export type Value = number | string | boolean;

const SCALARS: Record<string, (s: GameState, c: ContentBundle) => Value> = {
  honour: (s) => s.honour,
  hamingja: (s) => s.hamingja,
  silver: (s) => s.silver,
  loot: (s) => s.loot,
  provisions: (s) => s.provisions,
  age: (s) => age(s),
  year: (s) => dateOf(s.day).year,
  month: (s) => dateOf(s.day).month + 1,
  phase: (s) => s.phase,
  place: (s) => s.at ?? 'sea',
  'at.kind': (s, c) => (s.at ? c.places[s.at]?.kind ?? 'none' : 'sea'),
  /** Standing where he is now (0 at sea): for scenes that fire in any port. */
  'at.standing': (s, c) => (s.at ? standing(s, c, s.at) : 0),
  background: (s) => s.hero.background,
  ships: (s) => s.ships.length,
  'crew.men': (s) => s.crew.men,
  'crew.morale': (s) => s.crew.morale,
  'crew.quality': (s) => s.crew.quality,
  'fame.living': (s) => livingFame(s),
  'fame.lasting': (s) => lastingFame(s),
  'fame.rank': (s, c) => fameRank(s, c),
  'hero.hp': (s) => s.hero.hp,
  service: (s) => (s.service ? 1 : 0),
  captives: (s) => s.captives,
  nickname: (s) => !!s.hero.nickname,
  shares: (s) => s.service?.shares ?? 0,
  expedition: (s) => (s.voyage?.expedition ? 1 : 0),
  base: (s) => s.base.level,
  thralls: (s) => s.base.thralls,
  married: (s) => (s.base.wife ? 1 : 0),
  'masters.sworn': (s) => s.ships.slice(1).filter((x) => x.master?.startsWith('man:') && s.men.some((m) => m.alive && `man:${m.id}` === x.master)).length,
  'sworn.free': (s) => s.men.filter((m) => m.alive && m.sworn && !s.ships.some((x) => x.master === `man:${m.id}`)).length,
  'masters.hired': (s) => s.ships.slice(1).filter((x) => x.master?.startsWith('hired:')).length,
  /** The year the current (or last) winter belongs to: winter 830 runs from November 830 to February 831. */
  winter: (s) => s.flags._winter ?? 0,
};

/** Paths that take a named value, and the names they take. */
export function namedValues(content: ContentBundle, path: string): string[] | undefined {
  if (path === 'phase') return [...PHASES];
  if (path === 'place') return ['sea', ...Object.keys(content.places)];
  if (path === 'at.kind') return ['sea', 'none', ...PLACE_KINDS];
  if (path === 'background') return Object.keys(content.backgrounds);
  if (path === 'base') return ['father', 'farm', 'hall'];
  return undefined;
}

export function getValue(state: GameState, content: ContentBundle, path: string): Value {
  const f = SCALARS[path];
  if (f) return f(state, content);
  const [ns, a, b] = path.split('.');
  switch (ns) {
    case 'flag': return state.flags[a!] ?? 0;
    case 'seen': return state.seen[a!] !== undefined;
    case 'attr': return effAttr(state, content, a as Attr);
    case 'skill': return state.hero.skills[a as Skill];
    case 'wound': return state.hero.wounds.some((w) => w.id === a);
    case 'known': return state.known.includes(a!);
    case 'fate': return state.fates[a!] ?? 0;
    case 'standing': return standing(state, content, a!);
    case 'item': return state.items.some((x) => x.id === a);
    case 'omen': return state.omens[a!] ?? 0;
    case 'boast': {
      const bt = state.boasts.find((x) => x.id === a);
      return !bt ? 0 : bt.state === 'open' ? 1 : bt.state === 'kept' ? 2 : 3;
    }
    case 'man': {
      const m = state.men.find((x) => x.id === a);
      if (b === 'present') return !!m && m.alive;
      if (b === 'sworn') return !!m && m.alive && m.sworn;
      if (b === 'master') return !!m && m.alive && state.ships.some((x) => x.master === `man:${m.id}`);
      if (!m) return b === 'alive' ? false : 0;
      if (b === 'alive') return m.alive;
      if (b === 'loyalty') return m.loyalty;
      return 0;
    }
  }
  throw new Error(`unknown path ${path}`);
}

/** Validator: an error string for an unknown path, or null. */
export function checkPath(content: ContentBundle, path: string): string | null {
  if (SCALARS[path]) return null;
  const [ns, a, b, ...rest] = path.split('.');
  if (rest.length) return `unknown path "${path}"`;
  switch (ns) {
    case 'flag': return content.flags[a!] ? null : `undeclared flag "${a}" (declare it in content/registry/flags.yaml)`;
    case 'seen': return content.scenes[a!] ? null : `"${path}": no scene "${a}"`;
    case 'attr': return (ATTRS as readonly string[]).includes(a!) && !b ? null : `unknown attribute "${a}"`;
    case 'skill': return (SKILLS as readonly string[]).includes(a!) && !b ? null : `unknown skill "${a}"`;
    case 'wound': return content.injuries[a!] ? null : `unknown injury "${a}"`;
    case 'known': return content.places[a!] ? null : `unknown place "${a}"`;
    case 'man': return content.men[a!] && ['present', 'alive', 'loyalty', 'sworn', 'master'].includes(b!) ? null : `bad sworn-man path "${path}"`;
    case 'item': return content.items[a!] && !b ? null : `unknown item "${a}"`;
    case 'standing': return content.places[a!] && !b ? null : `unknown place "${a}" for standing`;
    case 'fate': return content.fates[a!] && !b ? null : `unknown fate "${a}" (declare it in content/registry/fates.yaml)`;
    case 'omen': return content.fates[a!] && !b ? null : `unknown fate "${a}" for an omen`;
    case 'boast': return content.boasts[a!] && !b ? null : `unknown boast "${a}" (declare it in content/registry/boasts.yaml)`;
  }
  return `unknown path "${path}"`;
}

/** Paths an { add } effect may change. */
export function checkAddPath(content: ContentBundle, path: string): string | null {
  if (['silver', 'loot', 'honour', 'hamingja', 'provisions', 'crew.men', 'crew.morale', 'thralls'].includes(path)) return null;
  const [ns, a, b] = path.split('.');
  if (ns === 'flag') return content.flags[a!] ? null : `undeclared flag "${a}"`;
  if (ns === 'skill' || ns === 'attr') return checkPath(content, path);
  if (ns === 'man' && b === 'loyalty') return content.men[a!] ? null : `unknown sworn man "${a}"`;
  return `cannot add to "${path}"`;
}

export function labelFor(path: string): string {
  const [ns, a] = path.split('.');
  const nice = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (ns === 'skill' || ns === 'attr') return nice(ATTR_NAMES[a!] ?? a!);
  if (path === 'fame.living') return 'Fame';
  if (path === 'fame.lasting') return 'Lasting fame';
  if (path === 'crew.men') return 'Men';
  if (path === 'crew.morale') return 'Crew morale';
  return nice(path.replace(/\./g, ' '));
}

export const ATTR_NAMES: Record<string, string> = { str: 'strength', agi: 'agility', end: 'endurance', wit: 'wits', pre: 'presence' };
