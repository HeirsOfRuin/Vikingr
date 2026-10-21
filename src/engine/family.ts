// Family life and the heir (docs/FRAME-LINEAGE.md B). A married man who winters at home has children, about one
// every other winter; about one in four die before five, as they did. A son can be fostered with an ally (it binds
// them) or sail at his father's side; a daughter can be married into an alliance. When he dies and a son lives, the
// saga can go on as the son: the years pass until the boy is sixteen, the world goes on in the chronicle, and he
// inherits what is left.
import type { Attr, ContentBundle, UpbringingDef } from '../content/schema';
import { ATTRS, SKILLS } from '../content/schema';
import type { Ancestor, Child, GameState, SwornMan } from './state';
import type { RngCursor } from './rng';
import { dateOf, dayOf } from './calendar';
import { MUSTER_DOY } from './tuning';
import { journal } from './journal';
import { formatSilver, plural } from './format';
import { captain, meet, shiftRel } from './allies';
import { lordAlive, lordFav, lordName, shiftLordFav } from './lords';
import { addDeed, lastingFame, livingFame } from './fame';
import { tickChronicle } from './chronicle';
import { HEIR_ATTRS, makeupError } from './makeup';
import { hpMax } from './hero';
import { mouths } from './crew';
import { SEAT_DEF } from './rule';
import type { ActionOption } from './index';

export const FAMILY = {
  /** A winter at home with a wife: the chance of a child, and the chance the winter after one. */
  birth: 0.5,
  birthAgain: 0.15,
  maxBirths: 9,
  /** The chance a child dies, a year: under five (about one in four before five), and five to fifteen. */
  infant: 0.055,
  child: 0.01,
  fosterFrom: 7,
  fosterTo: 14,
  sailAt: 14,
  wedAt: 15,
  heirAt: 16,
  /** Fostering binds the ally: at once, and each year the boy is in his hall. */
  fosterBind: 2,
  fosterYear: 1,
  /** Who will take a fosterling: a lord's favour, a captain's regard, at least. */
  fosterLordAt: 2,
  fosterCaptainAt: 3,
  /** A daughter married into a house: what it binds, and her bride-price. */
  wedBind: 4,
  wedAt2: 2,
  brideLord: 480,
  brideCaptain: 240,
  /** The years between: what his mother spends a year, and the chance each old sworn man goes. */
  hoardSpent: 0.15,
  menGo: 0.25,
  /** A ship laid up longer than this rots. */
  shipYears: 10,
  /** What the son carries of his father's name and of the regard men had for him. */
  fameCarried: 0.5,
  regardCarried: 0.5,
  hamingjaCarried: 0.5,
} as const;

export interface FamilyState {
  children: Child[];
  /** The child a family scene is about. */
  focus?: string;
  /** His fathers, oldest first. */
  line: Ancestor[];
  /** The winter the last child was born. */
  lastBirth?: number;
  /** His mother, when he is an heir. */
  mother?: string;
}

const DAUGHTERS = ['Ása', 'Gyða', 'Ragnhildr', 'Þóra', 'Ingiríðr', 'Álfhildr', 'Sigríðr', 'Guðrún', 'Helga', 'Ástríðr', 'Bergljót', 'Þórdís', 'Hallveig', 'Jórunn', 'Ragna', 'Arnbjörg'];

export function fam(state: GameState): FamilyState {
  return (state.family ??= { children: [], line: [] });
}

export function given(name: string): string {
  return name.split(' ')[0] ?? name;
}

/** His father's given name: the beginning's, or, for an heir, the man whose mound he stood at. */
export function fatherName(state: GameState, content: ContentBundle): string {
  return state.hero.father ?? content.backgrounds[state.hero.background]?.father ?? 'your father';
}

export function childAge(state: GameState, c: Child): number {
  return dateOf(state.day).year - c.born;
}

/** A son at the oar lives and dies as a sworn man: his child record follows the man. */
export function syncChildren(state: GameState): void {
  for (const c of state.family?.children ?? []) {
    if (!c.alive || !c.man) continue;
    const m = state.men.find((x) => x.id === c.man);
    if (m && !m.alive) { c.alive = false; c.died = dateOf(m.diedOn ?? state.day).year; }
  }
}

export function living(state: GameState): Child[] {
  syncChildren(state);
  return (state.family?.children ?? []).filter((c) => c.alive);
}

/** His own children, and his father's other children. */
export function ownChildren(state: GameState): Child[] {
  return (state.family?.children ?? []).filter((c) => c.father === state.hero.name);
}

export function focusChild(state: GameState): Child | undefined {
  const f = state.family;
  return f?.children.find((c) => c.id === f.focus);
}

function takenNames(state: GameState): Set<string> {
  return new Set([...(state.family?.children ?? []).map((c) => c.name), given(state.hero.name), ...state.men.map((m) => m.name)]);
}

function freshName(state: GameState, content: ContentBundle, sex: 'm' | 'f', rng: RngCursor): string {
  const taken = takenNames(state);
  const pool = (sex === 'm' ? content.names : DAUGHTERS).filter((n) => !taken.has(n));
  return pool.length ? pool[rng.int(pool.length)]! : sex === 'm' ? 'Ormr' : 'Ása';
}

/** A winter at home with his wife: perhaps a child. The scene names it. */
export function winterBirth(state: GameState, content: ContentBundle, rng: RngCursor, winter: number): void {
  if (!state.base.wife || state.service) return;
  const f = fam(state);
  const born = ownChildren(state).length;
  if (born >= FAMILY.maxBirths) return;
  const p = f.lastBirth === winter - 1 ? FAMILY.birthAgain : FAMILY.birth;
  if (rng.float() >= p) return;
  const sex: 'm' | 'f' = rng.float() < 0.5 ? 'm' : 'f';
  // the first son is named for his grandfather unless the scene says otherwise
  const firstSon = sex === 'm' && !ownChildren(state).some((c) => c.sex === 'm');
  const name = firstSon && !takenNames(state).has(fatherName(state, content)) ? fatherName(state, content) : freshName(state, content, sex, rng);
  const c: Child = { id: `c${f.children.length + 1}`, name, sex, born: winter + 1, alive: true, father: state.hero.name, mother: state.base.wife };
  f.children.push(c);
  f.focus = c.id;
  f.lastBirth = winter;
  // the first son and the first daughter have their own scenes, once in a saga; every child after shares one
  const first = !ownChildren(state).some((x) => x !== c && x.sex === sex);
  const own = sex === 'm' ? 'g_w_son' : 'g_w_daughter';
  const scene = first && !state.seen[own] ? own : 'fa_birth';
  state.flags[sex === 'm' ? 'child_son' : 'child_daughter'] = 1;
  state.queue.push({ scene, day: state.day });
  journal(state, `${state.base.wife} bore you a ${sex === 'm' ? 'son' : 'daughter'}, in the winter of ${winter}.`);
}

/** The scenes' naming choices: for his father, a name of the scene's own, or a fresh one. */
export function nameChild(state: GameState, content: ContentBundle, rng: RngCursor, how: string): void {
  const c = focusChild(state);
  if (!c) return;
  const taken = takenNames(state);
  taken.delete(c.name);
  const want = how === 'father' ? fatherName(state, content) : how === 'own' ? null : how;
  c.name = want && !taken.has(want) ? want : freshName(state, content, c.sex, rng);
}

export function renameChild(state: GameState, id: string, name: string): string | null {
  const c = state.family?.children.find((x) => x.id === id);
  const n = name.trim().slice(0, 20);
  if (!c || !c.alive) return 'No such child.';
  if (!n) return 'A name, first.';
  if (takenNames(state).has(n) && n !== c.name) return 'That name is taken in the family.';
  c.name = n;
  const m = c.man ? state.men.find((x) => x.id === c.man) : undefined;
  if (m) m.name = n;
  return null;
}

/** A host for a fosterling or a daughter's husband: "lord:<id>" or "cap:<id>". */
export function hostName(state: GameState, content: ContentBundle, h: string): string {
  const [k, id] = h.split(':') as [string, string];
  return k === 'lord' ? lordName(state, content, id) : content.captains[id]?.name ?? id;
}

function bind(state: GameState, content: ContentBundle, h: string, n: number): void {
  const [k, id] = h.split(':') as [string, string];
  if (k === 'lord') shiftLordFav(state, id, n);
  else { meet(state, content, id); shiftRel(state, content, id, n); }
}

function hostOk(state: GameState, content: ContentBundle, h: string, lordAt: number, capAt: number): boolean {
  const [k, id] = h.split(':') as [string, string];
  if (k === 'lord') return lordAlive(state, content, id) && state.lords?.[id]?.cast === undefined && lordFav(state, id) >= lordAt;
  const c = captain(state, content, id);
  return c.met && c.alive && c.rel >= capAt;
}

/** Allies who would take a fosterling or a bride: lords who favour him, captains who think well of him. */
export function hosts(state: GameState, content: ContentBundle, lordAt: number, capAt: number): string[] {
  const lords = Object.keys(content.lords).map((id) => `lord:${id}`).filter((h) => (h === 'lord:jarl' || state.lords?.[h.slice(5)]?.met) && hostOk(state, content, h, lordAt, capAt));
  const caps = Object.keys(content.captains).map((id) => `cap:${id}`).filter((h) => hostOk(state, content, h, lordAt, capAt));
  const score = (h: string) => (h.startsWith('lord:') ? lordFav(state, h.slice(5)) + 2 : captain(state, content, h.slice(4)).rel);
  return [...lords, ...caps].sort((a, b) => score(b) - score(a)).slice(0, 3);
}

export function foster(state: GameState, content: ContentBundle, id: string, h: string): string[] {
  const c = state.family!.children.find((x) => x.id === id)!;
  c.foster = { with: h, since: dateOf(state.day).year };
  bind(state, content, h, FAMILY.fosterBind);
  journal(state, `Sent ${c.name} to be fostered by ${hostName(state, content, h)}.`);
  return [`${c.name} goes to ${hostName(state, content, h)} with a chest of clothes, a knife of his own, and a gift for his foster-father. A man who raises your son is bound to you as kin are bound, and his house to yours.`, `He comes home at ${FAMILY.fosterTo}, knowing what that ${h.startsWith('lord:') ? 'hall' : 'ship'} knows.`];
}

export function takeSon(state: GameState, content: ContentBundle, id: string): string[] {
  void content;
  const c = state.family!.children.find((x) => x.id === id)!;
  const m: SwornMan = {
    id: `son_${c.id}`, name: c.name, temperament: 'steady', weapons: c.fostered?.startsWith('cap:') ? 3 : 2, loyalty: 10, alive: true, slot: 'wall', deeds: 0,
    nickname: null, diedOn: null, sworn: true, hurtUntil: null, origin: 'son', desc: `Your son, ${childAge(state, c)} winters old. He would follow you into the sea.`,
  };
  state.men.push(m);
  c.man = m.id;
  journal(state, `${c.name} took an oar in your ship, at ${childAge(state, c)}.`);
  return [`${c.name} takes his place on the benches beside the men who knew him in his cradle. He is loyal to the bone, which is to say he would die for you. He can.`];
}

export function wedDaughter(state: GameState, content: ContentBundle, id: string, h: string): string[] {
  const c = state.family!.children.find((x) => x.id === id)!;
  const price = h.startsWith('lord:') ? FAMILY.brideLord : FAMILY.brideCaptain;
  c.wed = h;
  bind(state, content, h, FAMILY.wedBind);
  state.silver += price;
  journal(state, `Married ${c.name} into ${hostName(state, content, h)}'s house; the bride-price was ${formatSilver(price)}.`);
  return [`${c.name} is married into ${hostName(state, content, h)}'s house at the winter nights. Her bride-price, ${formatSilver(price)}, is counted out on your table, and her dowry goes with her.`, `Your houses are kin now. It will be hard for either to forget it.`];
}

/** The family's part of the Home tab: what can be done for each child. */
export function familyActions(state: GameState, content: ContentBundle, opt: (group: string, action: import('./index').Action, label: string, enabled?: boolean, reason?: string, hint?: string) => ActionOption): ActionOption[] {
  const out: ActionOption[] = [];
  for (const c of living(state)) {
    if (c.foster || c.man || c.wed) continue;
    const age = childAge(state, c);
    if (c.sex === 'm' && age >= FAMILY.fosterFrom && age < FAMILY.fosterTo && !c.fostered) {
      const hs = hosts(state, content, FAMILY.fosterLordAt, FAMILY.fosterCaptainAt);
      if (!hs.length) out.push(opt('Family', { t: 'foster', child: c.id, with: '' }, `Foster ${c.name}`, false, 'No lord who favours you, nor any captain who thinks well enough of you, to take him.'));
      for (const h of hs) out.push(opt('Family', { t: 'foster', child: c.id, with: h }, `Foster ${c.name} with ${hostName(state, content, h)}`, true, undefined, `Binds him to you: ${h.startsWith('lord:') ? 'favour' : 'regard'} +${FAMILY.fosterBind}, and +${FAMILY.fosterYear} each year; ${c.name} comes home at ${FAMILY.fosterTo}`));
    }
    if (c.sex === 'm' && age >= FAMILY.sailAt && state.ships.length && !state.service) out.push(opt('Family', { t: 'take_son', child: c.id }, `Take ${c.name} to sea at your side`, true, undefined, `${age} winters old; loyal to the bone, and he can die`));
    if (c.sex === 'f' && age >= FAMILY.wedAt) {
      const hs = hosts(state, content, FAMILY.wedAt2, FAMILY.wedAt2);
      if (!hs.length) out.push(opt('Family', { t: 'wed_daughter', child: c.id, to: '' }, `Find a husband for ${c.name}`, false, 'No house that thinks well enough of yours.'));
      for (const h of hs) out.push(opt('Family', { t: 'wed_daughter', child: c.id, to: h }, `Marry ${c.name} into ${hostName(state, content, h)}'s house`, true, undefined, `${h.startsWith('lord:') ? 'favour' : 'regard'} +${FAMILY.wedBind}; a bride-price of ${formatSilver(h.startsWith('lord:') ? FAMILY.brideLord : FAMILY.brideCaptain)}`));
    }
  }
  return out;
}

/** The turn of the year: the small graves, the fosterlings' years, the fosterlings come home. */
export function familyYear(state: GameState, content: ContentBundle, rng: RngCursor): string[] {
  const lines: string[] = [];
  syncChildren(state);
  const year = dateOf(state.day).year;
  let mourned = false;
  for (const c of state.family?.children ?? []) {
    if (!c.alive || c.wed) continue;
    const age = year - c.born;
    if (c.man) { const m = state.men.find((x) => x.id === c.man); if (m) m.loyalty = 10; continue; }
    if (age >= 1 && age <= 15 && rng.float() < (age <= 5 ? FAMILY.infant : FAMILY.child)) {
      c.alive = false;
      c.died = year - 1;
      journal(state, `${c.name}, your ${c.sex === 'm' ? 'son' : 'daughter'}, died in the winter, at ${age - 1 || 'less than a year'}.`);
      if (!mourned && c.father === state.hero.name) { state.family!.focus = c.id; state.queue.push({ scene: 'fa_child_dies', day: state.day }); mourned = true; }
      else lines.push(`${c.name} died in the winter.`);
      continue;
    }
    if (c.foster) {
      bind(state, content, c.foster.with, FAMILY.fosterYear);
      if (age >= FAMILY.fosterTo) {
        lines.push(`${c.name} comes home from ${hostName(state, content, c.foster.with)}'s ${c.foster.with.startsWith('lord:') ? 'hall' : 'ship'}, a head taller and full of another house's stories. His foster-father sends gifts with him.`);
        journal(state, `${c.name} came home from fosterage.`);
        c.fostered = c.foster.with;
        delete c.foster;
      }
    }
  }
  return lines;
}

// ---- the heir ----

/** Who can go on: his own sons first, eldest first; then his brothers. */
export function heirs(state: GameState): Child[] {
  const alive = living(state).filter((c) => c.sex === 'm' && !c.hero);
  const own = alive.filter((c) => c.father === state.hero.name);
  const brothers = alive.filter((c) => c.father !== state.hero.name);
  return [...own.sort((a, b) => a.born - b.born), ...brothers.sort((a, b) => a.born - b.born)];
}

/** The three ways he can have been raised: two always, and the one his years earned. */
export function heirSets(state: GameState, content: ContentBundle, c: Child): UpbringingDef[] {
  const all = Object.values(content.upbringing);
  const when = c.man ? 'sailed' : c.fostered?.startsWith('lord:') ? 'fostered_lord' : c.fostered?.startsWith('cap:') ? 'fostered_captain' : 'plain';
  void state;
  return [...all.filter((u) => u.when === 'always'), all.find((u) => u.when === when)!];
}

const LINES_PER_YEAR = 3;

/** Death, and the years until the boy is a man. The world moves; the farm keeps itself as it can. */
export function goOnAs(state: GameState, content: ContentBundle, rng: RngCursor, id: string): void {
  const f = fam(state);
  const c = f.children.find((x) => x.id === id)!;
  const death = state.death!;
  const dead = dateOf(death.day);
  const father = state.hero;
  const fatherFame = Math.max(livingFame(state), lastingFame(state));
  f.line.push({ name: father.name, nickname: father.nickname, born: father.born, died: dead.year, cause: death.cause, afterlife: death.afterlife, fame: Math.round(fatherFame), deeds: state.deeds.length, text: death.text });
  // he takes over at the spring muster: the next one, or the one of his sixteenth year
  const startYear = Math.max(c.born + FAMILY.heirAt, dead.doy > MUSTER_DOY ? dead.year + 1 : dead.year);
  const years = startYear - dead.year;
  const lines: string[] = [];
  const sailing = !!c.man;
  lines.push(`${given(father.name)} ${father.nickname ? `${father.nickname} ` : ''}is buried in the winter of ${dead.year}, in a mound above the fjord, with his weapons. ${c.name} is ${dead.year - c.born}.`);
  // the ships come home, with what he carried
  const carried = state.silver + state.loot;
  if (carried > 0) { state.base.hoard += Math.round(carried * 0.8); lines.push(`His men bring home what he carried, ${formatSilver(carried)}, and take their shares of it; the rest goes under the floor.`); }
  state.silver = 0;
  state.loot = 0;
  state.captives = 0;
  // the news, year by year, as the boy heard it by the fire
  const oldMen = state.men.filter((m) => m.alive && m.sworn && m.origin !== 'son');
  for (let y = dead.year; y < startYear; y++) {
    state.day = Math.max(state.day, dayOf(y, 364));
    tickChronicle(state, content);
    const heard = (state.chron?.news ?? []).filter((n) => !n.heard && n.day <= state.day);
    for (const n of heard) n.heard = true;
    // the annals' news first; a legend's summer raid only if the year had little else
    const said = [...heard.filter((n) => n.big), ...heard.filter((n) => !n.big)].slice(0, LINES_PER_YEAR).map((n) => n.text.split(/(?<=\.)\s/)[0]!);
    if (said.length && y > dead.year) lines.push(`${y}, when he was ${y - c.born}: ${said.join(' ')}`);
    else if (said.length) lines.push(`That year: ${said.join(' ')}`);
    if (y === dead.year) continue;
    // home: his mother keeps the farm; the hoard is spent on it; the old men drift away; the ships rot
    state.base.hoard = Math.round(state.base.hoard * (1 - FAMILY.hoardSpent));
    for (const m of oldMen) if (m.alive && rng.float() < FAMILY.menGo) { m.alive = false; m.diedOn = state.day; }
    for (const ps of Object.values(state.places)) ps.defence = 1 + (ps.defence - 1) * 0.6;
    for (const [pid, ps] of Object.entries(state.places)) { const base = content.places[pid]?.raid?.wealth ?? 0; ps.wealth = Math.min(base, Math.round(ps.wealth + base * 0.15)); }
  }
  // what is left
  const home: string[] = [];
  if (years > 1) home.push(`${f.mother ?? state.base.wife ?? 'His mother'} kept the farm through ${plural(years, 'winter')}${state.base.thralls ? `, with ${plural(state.base.thralls, 'thrall')}` : ''}.`);
  const sold = state.ships.length > 1 && years > 1 ? state.ships.slice(1) : [];
  if (sold.length) { state.ships = state.ships.slice(0, 1); home.push(`${sold.map((s) => s.name).join(' and ')} ${sold.length === 1 ? 'was' : 'were'} sold to pay for the winters.`); }
  // the best ship is kept in the boatshed, and dries out; past ten winters she is past saving
  const rotted = years > FAMILY.shipYears ? state.ships : [];
  if (rotted.length) { state.ships = []; home.push(`${rotted.map((s) => s.name).join(' and ')} rotted in the boatshed.`); }
  else if (years > 1) for (const s of state.ships) { s.hull = Math.min(s.hull, 100 - 5 * years); home.push(`${s.name} is in the boatshed, dried out and in need of tar.`); }
  const gone = oldMen.filter((m) => !m.alive);
  const stayed = oldMen.filter((m) => m.alive);
  if (gone.length) home.push(`Of his father's sworn men, ${gone.map((m) => m.name).join(', ')} ${gone.length === 1 ? 'is' : 'are'} gone: dead of age or the sea, or off to other lords.`);
  if (stayed.length) home.push(`${stayed.map((m) => m.name).join(', ')} ${stayed.length === 1 ? 'is' : 'are'} still here, and will give him their oath if he is worth it.`);
  // a winter's turn and the crew is still his; longer, and they have found other benches
  if (years > 1) state.crew.men = 0;
  // his lord's land and his seat were his father's; bought land is the family's
  const lost: string[] = [];
  state.holdings = (state.holdings ?? []).filter((h) => {
    const keep = h.kind === 'bought' || (h.kind === 'fort' && years <= 1 && (sailing || stayed.length > 0));
    if (!keep) lost.push(content.places[h.place]!.name);
    return keep;
  });
  if (lost.length) home.push(`The land at ${lost.join(' and ')} went back to other men.`);
  if (state.rule) { home.push(`The high seat at ${content.places[SEAT_DEF[state.rule.seat].place]!.name} went to another man.`); delete state.rule; }
  delete state.oath; delete state.oath2;
  // regard and favour are a father's; the son has half of it, and his father's feuds whole
  for (const ls of Object.values(state.lords ?? {})) ls.fav = Math.round(ls.fav * FAMILY.regardCarried);
  if (state.favour) state.favour = Math.round(state.favour * FAMILY.regardCarried);
  for (const cs of Object.values(state.captains ?? {})) cs.rel = Math.round(cs.rel * FAMILY.regardCarried);
  home.push(`In the hoard: ${formatSilver(state.base.hoard)}.`);
  // the son
  const fatherGiven = given(father.name);
  c.hero = true;
  state.hero = {
    name: `${c.name} ${fatherGiven}sson`, background: father.background, born: c.born, father: fatherGiven,
    attrs: { ...HEIR_ATTRS }, skills: Object.fromEntries(SKILLS.map((s) => [s, 0])) as GameState['hero']['skills'],
    xp: Object.fromEntries(SKILLS.map((s) => [s, 0])) as GameState['hero']['xp'], hp: 0, wounds: [], nickname: null, alive: true,
  };
  f.mother = c.mother ?? f.mother;
  state.base.wife = null;
  state.death = null;
  state.day = dayOf(startYear, MUSTER_DOY);
  state.fedTo = state.day;
  state.phase = 'muster';
  state.at = state.homeAt ?? 'home_fjord';
  state.voyage = null;
  state.service = null;
  state.boasts = [];
  state.hostages = [];
  state.queue = [];
  state.cand = null;
  state.building = null;
  state.seasonRaids = [];
  state.rearFights = 0;
  state.position = 'wall';
  delete state.course; delete state.cruise; delete state.cruisePlan; delete state.after; delete state.partner;
  state.hamingja = Math.round(state.hamingja * FAMILY.hamingjaCarried);
  state.stats = { legs: 0, storms: 0, battles: 0, battlesWon: 0, duels: 0, duelsWon: 0, raids: 0, plunder: 0, hungerDays: 0, frontWins: 0 };
  for (const fl of PERSONAL_FLAGS) delete state.flags[fl];
  for (const m of state.men) if (m.alive && m.sworn && m.origin !== 'son') m.loyalty = Math.max(0, m.loyalty - 2);
  if (c.man) { state.men = state.men.filter((m) => m.id !== c.man); delete c.man; c.sailed = true; }
  state.deeds = [];
  if (fatherFame >= 1) addDeed(state, content, { type: 'deed', text: `Son of ${fatherGiven}${father.nickname ? ` ${father.nickname}` : ''}`, weight: Math.round(fatherFame * FAMILY.fameCarried) });
  for (const d of state.deeds) { d.told = state.day; d.place = state.at; }
  state.provisions = mouths(state) * 20;
  journal(state, `The saga of ${father.name} ends. It goes on as his son's: ${state.hero.name}.`);
  f.focus = c.id;
  state.pending = { t: 'report', title: 'The years between', lines: [...lines, ...home], then: 'heir' };
}

/** He decides who he is: the spread and the upbringing (the same point-buy as a new life). */
export function makeHeir(state: GameState, content: ContentBundle, attrs: Record<Attr, number>, set: string): string | null {
  const c = focusChild(state);
  if (!c) return 'No heir.';
  const e = makeupError(HEIR_ATTRS, attrs);
  if (e) return e;
  const u = heirSets(state, content, c).find((x) => x.id === set);
  if (!u) return 'Not a way he was raised.';
  state.hero.attrs = { ...attrs };
  for (const s of SKILLS) state.hero.skills[s] = u.skills[s] ?? 0;
  state.hero.hp = hpMax(state, content);
  void ATTRS;
  return null;
}

/** Flags that were the father's own life, not the family's: his outlawry, his courting, his betrothal. */
export const PERSONAL_FLAGS = ['outlawed', 'betrothed', 'gyda_courting', 'ingibjorg_promised', 'ingibjorg_waiting', 'ingibjorg_betrothed', 'thorunn_betrothed', 'asta_betrothed', 'ingibjorg_jilted', '_prize'];
