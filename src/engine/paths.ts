// Value paths used by conditions ("skill.weapons >= 3") and effects ({ add: { silver: -24 } }).
// One resolver for reading and one checker for the validator, so a path that
// reads also validates, and an unknown path fails the build.
import { ATTRS, SKILLS, PHASES, PLACE_KINDS, PEOPLES, type Attr, type ContentBundle, type Skill } from '../content/schema';
import type { GameState } from './state';
import { dateOf } from './calendar';
import { effAttr, age } from './hero';
import { fameRank, lastingFame, livingFame } from './fame';
import { standing } from './standing';
import { captain } from './allies';
import { hirdCount, hirdRoom } from './hird';
import { hostageCount } from './hostages';

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
  favour: (s) => s.favour ?? 0,
  allies: (s, c) => Object.keys(c.captains).filter((id) => { const x = captain(s, c, id); return x.met && x.alive && x.rel >= 3; }).length,
  partner: (s) => (s.partner && s.partner.year === dateOf(s.day).year ? 1 : 0),
  /** Where his ship is bound, at sea; and who lives there (regional sea events). */
  bound: (s) => s.voyage?.to ?? '',
  'bound.people': (s, c) => (s.voyage ? c.places[s.voyage.to]?.people ?? '' : ''),
  'cargo.lots': (s) => Object.values(s.cargo ?? {}).reduce((n, c) => n + c.lots, 0),
  'sworn.free': (s) => s.men.filter((m) => m.alive && m.sworn && !s.ships.some((x) => x.master === `man:${m.id}`)).length,
  'masters.hired': (s) => s.ships.slice(1).filter((x) => x.master?.startsWith('hired:')).length,
  /** Hardship (docs/FRAME-HARDSHIP.md): how far men grudge him, his buried silver, a bad harvest this winter. */
  envy: (s) => s.hard?.envy ?? 0,
  hoard: (s) => s.base.hoard,
  /** Arm-rings he holds (src/engine/rings.ts). */
  'rings.silver': (s) => s.rings?.silver ?? 0,
  'rings.gold': (s) => s.rings?.gold ?? 0,
  trophies: (s) => s.base.trophies.length,
  dearth: (s) => (s.hard?.dearth !== undefined && s.hard.dearth === (s.flags._winter ?? -1) ? 1 : 0),
  muster: (s) => s.musterPool,
  /** The hird (docs/FRAME-HIRD-HOSTAGES.md): sworn men alive, and room at his table for more. */
  hird: (s) => hirdCount(s),
  'hird.room': (s) => hirdRoom(s),
  /** Hostages: parties held, held as sureties, those that could be, fosterlings grown, noble daughters, political prisoners. */
  hostages: (s, c) => hostageCount(s, c, 'all'),
  'hostages.held': (s, c) => hostageCount(s, c, 'held'),
  'hostages.surety': (s, c) => hostageCount(s, c, 'surety'),
  'hostages.can_surety': (s, c) => hostageCount(s, c, 'canSurety'),
  'hostages.foster': (s, c) => hostageCount(s, c, 'foster'),
  'hostages.noble': (s, c) => hostageCount(s, c, 'noble'),
  'hostages.political': (s, c) => hostageCount(s, c, 'political'),
  /** The party the open scene is about: can it stand surety; how many heads. */
  'hostage.surety': (s, c) => { const h = s.hostages?.find((x) => x.id === s.hfocus); return h ? !!c.hostages.kinds[h.kind]?.surety && h.state === 'held' : false; },
  'hostage.n': (s) => s.hostages?.find((x) => x.id === s.hfocus)?.n ?? 0,
  'hostage.kids': (s) => (s.hostages?.find((x) => x.id === s.hfocus)?.n ?? 1) - 1,
  /** A prize ship already taken this year: one a year. */
  prized: (s) => (s.flags._prize === dateOf(s.day).year ? 1 : 0),
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
  if (path === 'bound') return ['', ...Object.keys(content.places)];
  if (path === 'bound.people') return ['', ...PEOPLES];
  return undefined;
}

export function getValue(state: GameState, content: ContentBundle, path: string): Value {
  const f = SCALARS[path];
  if (f) return f(state, content);
  const [ns, a, b] = path.split('.');
  switch (ns) {
    case 'flag': return state.flags[a!] ?? 0;
    case 'seen': return state.seen[a!] !== undefined;
    /** Years since a scene was seen (99 if never): "yearsince.k_ubbi >= 1" is next year or later. */
    case 'yearsince': return state.seen[a!] !== undefined ? dateOf(state.day).year - dateOf(state.seen[a!]!).year : 99;
    case 'attr': return effAttr(state, content, a as Attr);
    case 'skill': return state.hero.skills[a as Skill];
    case 'wound': return state.hero.wounds.some((w) => w.id === a);
    case 'known': return state.known.includes(a!);
    case 'fate': return state.fates[a!] ?? 0;
    case 'standing': return standing(state, content, a!);
    case 'norse': return !!state.places[a!]?.norse;
    case 'item': return state.items.some((x) => x.id === a);
    case 'omen': return state.omens[a!] ?? 0;
    case 'captain': {
      const c = captain(state, content, a!);
      if (b === 'met') return c.met;
      if (b === 'alive') return c.alive;
      if (b === 'partner') return state.partner?.id === a && state.partner?.year === dateOf(state.day).year;
      return c.rel;
    }
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
    case 'seen': case 'yearsince': return content.scenes[a!] ? null : `"${path}": no scene "${a}"`;
    case 'attr': return (ATTRS as readonly string[]).includes(a!) && !b ? null : `unknown attribute "${a}"`;
    case 'skill': return (SKILLS as readonly string[]).includes(a!) && !b ? null : `unknown skill "${a}"`;
    case 'wound': return content.injuries[a!] ? null : `unknown injury "${a}"`;
    case 'known': return content.places[a!] ? null : `unknown place "${a}"`;
    case 'man': return content.men[a!] && ['present', 'alive', 'loyalty', 'sworn', 'master'].includes(b!) ? null : `bad sworn-man path "${path}"`;
    case 'item': return content.items[a!] && !b ? null : `unknown item "${a}"`;
    case 'standing': return content.places[a!] && !b ? null : `unknown place "${a}" for standing`;
    case 'norse': return content.places[a!] && !b ? null : `unknown place "${a}" for a ship-fort`;
    case 'fate': return content.fates[a!] && !b ? null : `unknown fate "${a}" (declare it in content/registry/fates.yaml)`;
    case 'omen': return content.fates[a!] && !b ? null : `unknown fate "${a}" for an omen`;
    case 'captain': return content.captains[a!] && ['rel', 'met', 'alive', 'partner'].includes(b!) ? null : `bad captain path "${path}"`;
    case 'boast': return content.boasts[a!] && !b ? null : `unknown boast "${a}" (declare it in content/registry/boasts.yaml)`;
  }
  return `unknown path "${path}"`;
}

/** Paths an { add } effect may change. */
export function checkAddPath(content: ContentBundle, path: string): string | null {
  if (['silver', 'loot', 'geld', 'honour', 'hamingja', 'provisions', 'crew.men', 'crew.morale', 'thralls', 'muster', 'hoard'].includes(path)) return null;
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
