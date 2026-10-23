// Content schema. One Zod definition gives both the TypeScript types and the
// runtime validation the content compiler runs on every YAML file.
import { z } from 'zod';

export const ATTRS = ['str', 'agi', 'end', 'wit', 'pre'] as const;
export const SKILLS = ['weapons', 'shield', 'seamanship', 'command', 'cunning', 'speech', 'trade', 'lore', 'craft'] as const;
export const DUEL_MOVES = ['strike', 'guard', 'feint'] as const;
export const ORDERS = ['hold', 'push', 'missiles', 'wedge', 'give', 'flank'] as const;
export const TERRAINS = ['beach', 'field', 'ford', 'rampart', 'ship', 'woods'] as const;
export const PHASES = ['muster', 'sailing', 'return', 'winter'] as const;
export const PLACE_KINDS = ['home', 'hall', 'market', 'monastery', 'town', 'island', 'landmark'] as const;
export type PlaceKind = (typeof PLACE_KINDS)[number];
export const PEOPLES = ['norse', 'danish', 'swedish', 'gael', 'english', 'frisian', 'frankish', 'baltic', 'rus', 'pict', 'briton'] as const;
export type People = (typeof PEOPLES)[number];
export const TEMPERAMENTS = ['hot', 'steady', 'greedy', 'pious', 'ambitious', 'dour'] as const;

export type Attr = (typeof ATTRS)[number];
export type Skill = (typeof SKILLS)[number];
export type DuelMove = (typeof DUEL_MOVES)[number];
export type Order = (typeof ORDERS)[number];
export type BattleTerrain = (typeof TERRAINS)[number];
export type Phase = (typeof PHASES)[number];

const id = z.string().regex(/^[a-z][a-z0-9_]*$/, 'ids are lower_snake_case');
const attrs = z.object({ str: z.number().int(), agi: z.number().int(), end: z.number().int(), wit: z.number().int(), pre: z.number().int() });
const skills = z.object(Object.fromEntries(SKILLS.map((s) => [s, z.number().int().min(0).max(10).optional()])) as Record<Skill, z.ZodOptional<z.ZodNumber>>);
const weights = <T extends readonly [string, ...string[]]>(keys: T) =>
  z.object(Object.fromEntries(keys.map((k) => [k, z.number().min(0).optional()])) as Record<T[number], z.ZodOptional<z.ZodNumber>>);

// ---- conditions and effects ----
export type CondInput = string | CondInput[] | { all: CondInput[] } | { any: CondInput[] } | { not: CondInput };
export const condInput: z.ZodType<CondInput> = z.lazy(() =>
  z.union([z.string(), z.array(condInput), z.object({ all: z.array(condInput) }), z.object({ any: z.array(condInput) }), z.object({ not: condInput })]),
);

export type Effect = z.infer<typeof baseEffect> | { if: CondInput; then: Effect[]; else?: Effect[] };
const baseEffect = z.union([
  z.object({ set: z.string() }).strict(),
  z.object({ clear: z.string() }).strict(),
  z.object({ add: z.record(z.string(), z.number()) }).strict(),
  z.object({ deed: z.object({ type: id, text: z.string().optional(), weight: z.number().optional(), witnesses: z.number().int().optional() }).strict() }).strict(),
  z.object({ injury: id }).strict(),
  z.object({ man: z.object({ id, loyalty: z.number().optional(), join: z.boolean().optional(), leave: z.boolean().optional(), swear: z.boolean().optional(), nickname: z.string().optional() }).strict() }).strict(),
  z.object({ fight: z.object({ foe: id, kind: z.enum(['duel', 'holmgang']), lethal: z.boolean(), win: id.optional(), lose: id.optional(), parted: id.optional() }).strict() }).strict(),
  z.object({ battle: z.object({ foe: id, men: z.number().int(), terrain: z.enum(TERRAINS), raid: z.boolean().optional(), win: id.optional(), lose: id.optional(), parted: id.optional() }).strict() }).strict(),
  z.object({ queue: z.object({ scene: id, days: z.number().int().min(0) }).strict() }).strict(),
  z.object({ know: id }).strict(),
  z.object({ journal: z.string() }).strict(),
  z.object({ days: z.number().int().min(0) }).strict(),
  /** Days that pass while the fleet lives off the land (beyond the map, in docs/FRAME-FLEET-843.md §3): no stores eaten. */
  z.object({ days_foraged: z.number().int().min(0) }).strict(),
  z.object({ nickname: z.string() }).strict(),
  z.object({ boast: id }).strict(),
  z.object({ keep_boast: id }).strict(),
  z.object({ command: z.literal(true) }).strict(),
  z.object({ route: z.array(id) }).strict(),
  z.object({ voyage: id }).strict(),
  z.object({ captives: z.number().int() }).strict(),
  z.object({ shares: z.number().min(0) }).strict(),
  z.object({ plunder: z.object({ next: id.optional() }).strict() }).strict(),
  z.object({ position: z.enum(['front', 'wall', 'rear']) }).strict(),
  z.object({ captain: z.string() }).strict(),
  z.object({ sell_captives: z.number().int().min(1) }).strict(),
  z.object({ recruit: z.number().int().min(1) }).strict(),
  z.object({ progress: z.number() }).strict(),
  z.object({ item: z.object({ id, equip: z.boolean().optional() }).strict() }).strict(),
  z.object({ lose_item: id }).strict(),
  z.object({ wife: z.string() }).strict(),
  z.object({ base: z.enum(['father', 'farm', 'hall']) }).strict(),
  z.object({ keep_captives: z.literal(true) }).strict(),
  z.object({ prize: z.object({ type: id, name: z.string() }).strict() }).strict(),
  z.object({ master: z.string() }).strict(),
  z.object({ give_ship: id }).strict(),
  z.object({ desert: z.literal(true) }).strict(),
  z.object({ lose_cargo: z.number().int().min(1) }).strict(),
  z.object({ ally: z.object({ id, meet: z.boolean().optional(), rel: z.number().int().optional(), felag: z.boolean().optional(), kill: z.boolean().optional() }).strict() }).strict(),
  z.object({ favour: z.number().int() }).strict(),
  z.object({ host: z.object({
    title: z.string(), foe: id, terrain: z.enum(TERRAINS), men: z.number().int().min(1),
    wings: z.array(z.object({ name: z.string(), men: z.number().int().min(0).optional(), ally: z.boolean().optional(), foe_men: z.number().int().min(1), quality: z.number().optional() }).strict()).min(1).max(2),
    role: z.enum(['man', 'wing', 'host']).optional(), reserve: z.object({ us: z.number().int().min(0), them: z.number().int().min(0) }).strict().optional(),
    raid: z.boolean().optional(), win: id.optional(), lose: id.optional(),
  }).strict() }).strict(),
  z.object({ spread: z.object({ from: id, n: z.number().int(), church: z.boolean().optional() }).strict() }).strict(),
  z.object({ raided: z.object({ place: id, burned: z.boolean().optional(), captives: z.boolean().optional(), failed: z.boolean().optional() }).strict() }).strict(),
  z.object({ standing: z.object({ place: id.optional(), people: z.enum(PEOPLES).optional(), n: z.number().int() }).strict() }).strict(),
  z.object({ ship: z.object({ type: id, name: z.string(), crew: z.number().int().min(0) }).strict() }).strict(),
  // hardship (docs/FRAME-HARDSHIP.md)
  z.object({ envy: z.number() }).strict(),
  z.object({ give: z.enum(['generous', 'feast', 'jarl', 'ring', 'stores']) }).strict(),
  z.object({ lose_hoard: z.number().min(0).max(1) }).strict(),
  z.object({ recover_hoard: z.number().min(0).max(1) }).strict(),
  z.object({ fire: z.enum(['hoard', 'trophies', 'people']) }).strict(),
  z.object({ lose_ship: z.enum(['wreck', 'give']) }).strict(),
  z.object({ jarl_men: z.literal(true) }).strict(),
  // another man's ship (docs/FRAME-BEGINNINGS.md): the outlaw's passage west, the Raven at Birsay, Harek's oar
  z.object({ join_ship: z.object({ captain: z.string(), ship_name: z.string(), type: id, crew: z.number().int().min(0), home: id.optional(), route: z.array(id).optional(), men: z.array(id).optional() }).strict() }).strict(),
  // the outlaw's three winters served: home, at the muster
  z.object({ exile_end: z.literal(true) }).strict(),
  // arm-rings (src/engine/rings.ts): given to him (n > 0) or given away (n < 0)
  z.object({ ring: z.object({ metal: z.enum(['silver', 'gold']), n: z.number().int().optional() }).strict() }).strict(),
  // the hird grows: the scene's candidate swears on a ring, or signs on at an oar
  z.object({ swear_cand: z.enum(['silver', 'gold']) }).strict(),
  z.object({ cand_crew: z.literal(true) }).strict(),
  /** Names the child a family scene is about: "father" (for his grandfather), "own" (a fresh name), or a name. */
  z.object({ name_child: z.string() }).strict(),
  /** The people of the shore come for the fort that is home: the fight, at their full strength (docs/FRAME-LINEAGE.md C). */
  z.object({ home_defence: z.object({ win: id, lose: id }).strict() }).strict(),
  /** The settlement is lost; the household goes back to Hordaland. */
  z.object({ lose_home: z.literal(true) }).strict(),
  /** A landnám: the land where he stands becomes his (docs/FRAME-LINEAGE.md E). */
  z.object({ claim_land: z.literal(true) }).strict(),
  /** He sails with a great fleet now, or leaves it (docs/FRAME-FLEET-843.md §2). */
  z.object({ fleet: id }).strict(),
  /** Goods into the hold, as many lots as fit (playtest 8: a whale's oil is casks of oil, not a few coins). */
  z.object({ goods: z.object({ id, lots: z.number().int().min(1) }).strict() }).strict(),
  /** He buys land where he stands, as the Land action does, if he can (docs/FRAME-FLEET-843.md §3). */
  z.object({ buy_land: z.literal(true) }).strict(),
  z.object({ fleet_end: z.literal(true) }).strict(),
  /** A skald joins his household by name, or leaves it, and why (playtest 8). */
  z.object({ skald: z.string().min(1) }).strict(),
  z.object({ skald_gone: z.string().min(1) }).strict(),
  /** The skald makes a verse: of the last deed done, or of the heaviest told deed with none yet. */
  z.object({ verse: z.enum(['last', 'best']) }).strict(),
  // hostages: take one (a rival captain's kin, at sea), and what becomes of the scene's party
  z.object({ take_hostage: z.object({ kind: id, captain: id.optional(), place: id.optional(), name: z.string().optional(), who: z.string().optional(), kin: z.string().optional(), price: z.number().int().min(1).optional() }).strict() }).strict(),
  // a Norse ship-fort (longphort) holds a place, or is lost (docs/FRAME-IRELAND-SEINE.md)
  z.object({ longphort: id }).strict(),
  z.object({ longphort_lost: id }).strict(),
  // lords, land and rule (docs/FRAME-WORLD.md §C-E)
  z.object({ lord: z.object({ id, fav: z.number().int().optional(), meet: z.boolean().optional(), swear: z.enum(['first', 'open', 'secret']).optional(), call: z.enum(['answer', 'refuse']).optional() }).strict() }).strict(),
  z.object({ grant: id }).strict(),
  z.object({ rule: z.enum(['orkney', 'dublin', 'home', 'walcheren']) }).strict(),
  z.object({ lose_rule: z.literal(true) }).strict(),
  z.object({ legend: z.object({ id, fame: z.number().int() }).strict() }).strict(),
  z.object({ hostage: z.enum(['ransom', 'ransom_high', 'surety', 'sell', 'free', 'dies', 'maybe_dies', 'escape', 'fetters', 'foster', 'marry', 'hand_over', 'keep_one', 'sell_party']) }).strict(),
]);
/** An effect, or a conditional list of them: { if, then, else }. */
export const effect: z.ZodType<Effect> = z.lazy(() => z.union([baseEffect, z.object({ if: condInput, then: z.array(effect), else: z.array(effect).optional() }).strict()]));

const check = z.object({ skill: z.enum(SKILLS), attr: z.enum(ATTRS), difficulty: z.number().int() }).strict();
const outcome = z.object({ text: z.string().optional(), effects: z.array(effect).optional(), next: id.optional() }).strict();

export const choice = z.object({
  id,
  text: z.string(),
  requires: condInput.optional(),
  visible_if: condInput.optional(),
  /** Open at the oar on purpose: a man's own act (going over the side), or advice the captain takes (docs/FRAME-FLEET-843.md). */
  oar: z.boolean().optional(),
  effects: z.array(effect).optional(),
  check: check.optional(),
  success: outcome.optional(),
  failure: outcome.optional(),
  next: id.optional(),
  result: z.string().optional(),
  danger: z.boolean().optional(),
}).strict();
export type Choice = z.infer<typeof choice>;

// ---- scene art (DESIGN §19b) ----
const rect = z.tuple([z.number().int(), z.number().int(), z.number().int(), z.number().int()]);
const point = z.tuple([z.number().int(), z.number().int()]);
export const artFx = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fire'), rect }).strict(),
  z.object({ kind: z.literal('glow'), at: point, radius: z.number().int() }).strict(),
  z.object({ kind: z.literal('water'), rect }).strict(),
  z.object({ kind: z.literal('smoke'), at: point, spread: z.number().int().optional(), rate: z.number().optional() }).strict(),
  z.object({ kind: z.literal('sparks'), at: point, spread: z.number().int().optional(), rate: z.number().optional() }).strict(),
  z.object({ kind: z.literal('crowd'), rect }).strict(),
  z.object({ kind: z.literal('birds'), rect, count: z.number().int() }).strict(),
]);
export type ArtFx = z.infer<typeof artFx>;
export const artEntry = z.object({ id, title: z.string(), fx: z.array(artFx).optional() }).strict();
export type ArtEntry = z.infer<typeof artEntry>;
/** A scene's picture: a key, or a key plus a value path that drives the crowd (0 still, 1 murmuring, 2 roaring). */
export const sceneArt = z.union([id, z.object({ key: id, laughter: z.string().optional() }).strict()]);

export const scene = z.object({
  id,
  kind: z.enum(['spine', 'pool', 'queued', 'place', 'phase']),
  title: z.string(),
  when: z.string().optional(),
  placeholder: z.boolean().optional(),
  calibration: z.boolean().optional(),
  art: sceneArt.optional(),
  at: z.array(id).optional(),
  at_kind: z.array(z.enum(PLACE_KINDS)).optional(),
  phase: z.array(z.enum(PHASES)).optional(),
  trigger: z.enum(['arrive', 'sea', 'phase_start', 'hall']).optional(),
  requires: condInput.optional(),
  weight: z.number().optional(),
  chance: z.number().min(0).max(1).optional(),
  once: z.boolean().optional(),
  cooldown_days: z.number().int().optional(),
  /** A recruiting scene: the man it offers is made from this origin when it opens ({cand}, {cand_desc}). */
  candidate: id.optional(),
  /** A hostage scene: which party it is about ({hostage}, {hostage_name}, {hostage_kin}, {hostage_price}). */
  hostage: z.enum(['newest', 'ransom', 'surety', 'broken', 'foster', 'noble', 'political', 'any']).optional(),
  text: z.string(),
  choices: z.array(choice).min(1),
}).strict();
export type Scene = z.infer<typeof scene>;

// ---- world ----
export const place = z.object({
  id,
  name: z.string(),
  lon: z.number(),
  lat: z.number(),
  kind: z.enum(PLACE_KINDS),
  /** Who lives there: what one of them thinks of a raider, the rest of them hear (DESIGN §11.6). */
  people: z.enum(PEOPLES),
  /** Where his standing starts, if not the people's usual (-10 hostile .. 10 allied). */
  standing: z.number().int().min(-10).max(10).optional(),
  /** Places its people tell of on his first landfall: their sea roads become known (FRAME-FOUNDATION §1). */
  tells: z.array(id).optional(),
  /** Far places its old sailors can tell of, as rumours. */
  rumours: z.array(id).optional(),
  /** What the old sailors say of this place, when it is the rumour. */
  rumour: z.string().optional(),
  region: z.string(),
  desc: z.string(),
  known: z.boolean().optional(),
  active: z.boolean().optional(),
  market: z.boolean().optional(),
  /** What its market makes cheaply and wants dearly (docs/FRAME-TRADE-ALLIES.md). */
  trade: z.object({ cheap: z.array(id), dear: z.array(id) }).strict().optional(),
  art: id.optional(),
  raid: z.object({ wealth: z.number().int(), defenders: z.number().int(), foe: id, terrain: z.enum(TERRAINS) }).strict().optional(),
  /** Not heard of, nor sailed to, before this year (Iceland: docs/FRAME-LINEAGE.md E). */
  from: z.number().int().optional(),
  /** Its people trade from this year; before it there is nobody to trade with. */
  trade_from: z.number().int().optional(),
  /** Land can be taken here, free, from this year: a landnám. */
  landnam: z.number().int().optional(),
}).strict();
export type Place = z.infer<typeof place>;

/** expedition: uncharted water; sailed only as an expedition until the far end is charted. */
export const leg = z.object({ a: id, b: id, days: z.number().min(0.5), kind: z.enum(['coastal', 'open', 'river']), expedition: z.boolean().optional() }).strict();
export type Leg = z.infer<typeof leg>;

export const shipType = z.object({ id, name: z.string(), oars: z.number().int(), crew: z.number().int(), cargo: z.number().int(), speed: z.number(), cost: z.number().int(), desc: z.string() }).strict();
export type ShipType = z.infer<typeof shipType>;

export const RESOLVES = ['levy', 'warriors', 'hird'] as const;
export type Resolve = (typeof RESOLVES)[number];
export const foe = z.object({
  id, name: z.string(), quality: z.number().int().min(0).max(3), doctrine: weights(ORDERS), desc: z.string(),
  /** How they hold (docs/FRAME-COMBAT-2.md, revision 2): a levy breaks early and runs when its leader falls; a lord's
   *  sworn men close round him and die rather than run. Defaults from quality. */
  resolve: z.enum(RESOLVES).optional(),
  /** How hard they are to read, 0..3: the chance their next move is shown as only likely, or one of two. */
  guile: z.number().int().min(0).max(3).optional(),
  /** The man who holds them together. When he falls, they waver. */
  leader: z.string().optional(),
}).strict();
export type Foe = z.infer<typeof foe>;

export const fighter = z.object({
  id,
  name: z.string(),
  attrs,
  weapons: z.number().int(),
  shield: z.number().int(),
  armour: z.number().int().min(0).max(3),
  weapon: z.number().int().min(1).max(3),
  habits: weights(DUEL_MOVES),
  /** How hard he is to read, 0..3. Defaults from his wits and how much he likes a feint. */
  guile: z.number().int().min(0).max(3).optional(),
  /** He came to kill: on the holmgang cloak he will not pay his way off when his blood falls on it. */
  unyielding: z.boolean().optional(),
  desc: z.string(),
}).strict();
export type Fighter = z.infer<typeof fighter>;

export const swornMan = z.object({ id, name: z.string(), temperament: z.enum(TEMPERAMENTS), weapons: z.number().int(), loyalty: z.number().int().min(0).max(10), desc: z.string() }).strict();
export type SwornManDef = z.infer<typeof swornMan>;

/** Where new sworn men come from (docs/FRAME-HIRD-HOSTAGES.md): names, temper, arms, loyalty, and how they are described. */
export const recruitOrigin = z.object({
  id,
  /** A name list, or "norse" for the shared names registry. */
  names: z.union([z.literal('norse'), z.array(z.string()).min(4)]),
  temperaments: z.array(z.enum(TEMPERAMENTS)).min(1),
  weapons: z.tuple([z.number().int(), z.number().int()]),
  loyalty: z.tuple([z.number().int().min(0).max(10), z.number().int().min(0).max(10)]),
  /** One line each; {he} is his name. */
  descs: z.array(z.string()).min(2),
}).strict();
export type RecruitOrigin = z.infer<typeof recruitOrigin>;

/** A kind of hostage (docs/FRAME-HIRD-HOSTAGES.md). {name} {place} {people} {kids} are filled when he is taken. */
export const hostageKind = z.object({
  id,
  at: z.array(z.enum(PLACE_KINDS)),
  sex: z.enum(['m', 'f']),
  /** Extra heads in the party besides the notable (a mother's children). */
  kids: z.tuple([z.number().int().min(0), z.number().int().min(0)]).optional(),
  price: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
  surety: z.boolean(),
  who: z.string(),
  kin: z.string(),
  desc: z.string(),
}).strict();
export type HostageKind = z.infer<typeof hostageKind>;
export const hostageNames = z.partialRecord(z.enum(PEOPLES), z.object({ m: z.array(z.string()).min(3), f: z.array(z.string()).min(3) }).strict());

export const rival = z.object({ id, name: z.string(), born: z.number().int(), died: z.number().int(), curve: z.array(z.tuple([z.number().int(), z.number()])).min(2), note: z.string() }).strict();
export type Rival = z.infer<typeof rival>;

/** The chronicle (docs/FRAME-WORLD.md §B): a dated event that changes the world whether or not he is there. */
export const chronEvent = z.object({
  id,
  year: z.number().int(),
  doy: z.number().int().min(1).max(365),
  /** The legend it is told of, if any (a rival id). */
  who: id.optional(),
  /** How men name the doers: "Horik's Danes". */
  by: z.string(),
  /** Places it strikes: wealth kept, defence added, or held by the Norse from now on. */
  places: z.array(id).optional(),
  keep: z.number().min(0).max(1).optional(),
  defence: z.number().optional(),
  norse: z.boolean().optional(),
  /** He was part of it: the chapter has done its work, and there is no news to hear. */
  unless: condInput.optional(),
  news: z.string(),
}).strict();
export type ChronEvent = z.infer<typeof chronEvent>;
/** A legend who raids his own waters every summer while he lives, by the hero's own rules. */
export const chronRaider = z.object({ id, who: id.optional(), by: z.string(), from: z.number().int(), to: z.number().int(), places: z.array(id).min(2), chance: z.number().min(0).max(1) }).strict();
export type ChronRaider = z.infer<typeof chronRaider>;

/** A lord a man can swear to (docs/FRAME-WORLD.md §C). */
export const lordDef = z.object({
  id,
  name: z.string(),
  /** Later holders of the same lordship: from this year, this name. */
  names: z.array(z.object({ from: z.number().int(), name: z.string() }).strict()).optional(),
  title: z.string(),
  seat: id.optional(),
  from: z.number().int(),
  to: z.number().int(),
  /** He dies in a year between these, fixed for each life. */
  dies: z.tuple([z.number().int(), z.number().int()]).optional(),
  friends: z.array(id),
  grant: id.optional(),
  desc: z.string(),
}).strict();
export type LordDef = z.infer<typeof lordDef>;

/** A coast to go a-viking along on standing orders (docs/FRAME-PACING.md). */
export const coastDef = z.object({ id, name: z.string(), regions: z.array(z.string()).min(1), desc: z.string() }).strict();
export type CoastDef = z.infer<typeof coastDef>;

export const injury = z.object({ id, name: z.string(), desc: z.string(), days: z.number().int().optional(), attrs: z.record(z.string(), z.number()).optional(), deed: z.boolean().optional() }).strict();
export type Injury = z.infer<typeof injury>;

export const deedType = z.object({ id, name: z.string(), weight: z.number() }).strict();
export type DeedType = z.infer<typeof deedType>;

export const background = z.object({
  id,
  label: z.string(),
  desc: z.string(),
  patronymic: z.string(),
  /** His father's name, for the {father} token. */
  father: z.string(),
  /** The default spread, and the point-buy pool (its total). */
  attrs,
  /** Three ways he was raised, 7 skill points each; the first is the default. */
  skill_sets: z.array(z.object({ id, label: z.string(), desc: z.string(), skills }).strict()).length(3),
  honour: z.number().int(),
  silver: z.number().int(),
  flags: z.array(z.string()).optional(),
  men: z.array(id),
  crew: z.number().int(),
  ship: id,
  start_scene: id,
  /** Starts at another man's oar: the ship and crew are his, and the hero's men are bench-mates, not sworn. */
  service: z.object({ captain: z.string(), ship_name: z.string() }).strict().optional(),
  /** What he carries on the first day (item ids, equipped). Default: a spear, a shield, a leather jerkin. */
  kit: z.array(id).optional(),
}).strict();
export type Background = z.infer<typeof background>;

/** How an heir was raised (docs/FRAME-LINEAGE.md B). */
export const upbringingDef = z.object({ id, when: z.enum(['always', 'sailed', 'fostered_lord', 'fostered_captain', 'plain']), label: z.string(), desc: z.string(), skills }).strict();
export type UpbringingDef = z.infer<typeof upbringingDef>;

/** A great fleet he can sail with (docs/FRAME-FLEET-843.md §2). */
export const fleetDef = z.object({ id, name: z.string(), leader: z.string(), ships: z.number().int().min(2), until: z.number().int(), desc: z.string() }).strict();
export type FleetDef = z.infer<typeof fleetDef>;

export const flagDef = z.object({ description: z.string() }).strict();

export const ITEM_KINDS = ['weapon', 'shield', 'helmet', 'armour', 'keepsake', 'fitting'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
export const itemDef = z.object({
  id,
  name: z.string(),
  kind: z.enum(ITEM_KINDS),
  value: z.number().int().optional(),
  price: z.number().int().optional(),
  sold: z.array(z.enum(['smith', 'market', 'shipwright'])).optional(),
  deeds: z.number().int().optional(),
  trophy: z.boolean().optional(),
  /** Family or a dead man's gift: selling it costs honour; giving it binds a man closer. */
  heirloom: z.boolean().optional(),
  desc: z.string(),
}).strict();
export type ItemDef = z.infer<typeof itemDef>;

export const BOAST_STATS = ['raids', 'plunder', 'battlesWon', 'duelsWon', 'legs', 'frontWins'] as const;
/** A boast the engine can keep by itself: a count reached since it was sworn, or a condition come true. */
const boastGoal = z.union([
  z.object({ stat: z.enum(BOAST_STATS), n: z.number().int().min(1) }).strict(),
  z.object({ when: condInput }).strict(),
]);
export const captainDef = z.object({
  id,
  name: z.string(),
  home: id,
  people: z.enum(PEOPLES),
  temperament: z.enum(TEMPERAMENTS),
  ships: z.number().int().min(1),
  men: z.number().int().min(1),
  rel: z.number().int().min(-10).max(10),
  bias: z.array(z.object({ if: condInput, n: z.number().int() }).strict()).optional(),
  desc: z.string(),
}).strict();
export type CaptainDef = z.infer<typeof captainDef>;
export const goodDef = z.object({ id, name: z.string(), lot: z.string(), price: z.number().int().min(1), bulk: z.number().int().min(1) }).strict();
export type GoodDef = z.infer<typeof goodDef>;
export const boastDef = z.object({ id, text: z.string(), days: z.number().int().min(1), goal: boastGoal.optional(), repeat: z.boolean().optional() }).strict();
export type BoastDef = z.infer<typeof boastDef>;
export const fateDef = z.object({ id, chance: z.number().min(0).max(1), desc: z.string() }).strict();
export type FateDef = z.infer<typeof fateDef>;
export const banterLine = z.object({
  who: id,
  when: z.enum(['sea', 'fight', 'arrive', 'hall']),
  requires: condInput.optional(),
  text: z.string(),
}).strict();
export type BanterLine = z.infer<typeof banterLine>;

export interface ContentBundle {
  hash: string;
  places: Record<string, Place>;
  legs: Leg[];
  ships: Record<string, ShipType>;
  foes: Record<string, Foe>;
  fighters: Record<string, Fighter>;
  men: Record<string, SwornManDef>;
  rivals: Record<string, Rival>;
  injuries: Record<string, Injury>;
  deeds: Record<string, DeedType>;
  flags: Record<string, { description: string }>;
  backgrounds: Record<string, Background>;
  scenes: Record<string, Scene>;
  /** Scene ids by chapter folder (830, 831, 833, 841, world, ...). */
  chapters: Record<string, string[]>;
  names: string[];
  art: Record<string, ArtEntry>;
  boasts: Record<string, BoastDef>;
  goods: Record<string, GoodDef>;
  captains: Record<string, CaptainDef>;
  items: Record<string, ItemDef>;
  fates: Record<string, FateDef>;
  banter: BanterLine[];
  recruits: Record<string, RecruitOrigin>;
  hostages: { kinds: Record<string, HostageKind>; names: z.infer<typeof hostageNames> };
  chronicle: { events: Record<string, ChronEvent>; raiders: Record<string, ChronRaider> };
  lords: Record<string, LordDef>;
  coasts: Record<string, CoastDef>;
  upbringing: Record<string, UpbringingDef>;
  fleets: Record<string, FleetDef>;
}
