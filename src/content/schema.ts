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
export const PEOPLES = ['norse', 'danish', 'swedish', 'gael', 'english', 'frisian', 'frankish', 'baltic', 'rus'] as const;
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
  z.object({ fight: z.object({ foe: id, kind: z.enum(['duel', 'holmgang']), lethal: z.boolean(), win: id.optional(), lose: id.optional() }).strict() }).strict(),
  z.object({ battle: z.object({ foe: id, men: z.number().int(), terrain: z.enum(TERRAINS), raid: z.boolean().optional(), win: id.optional(), lose: id.optional(), parted: id.optional() }).strict() }).strict(),
  z.object({ queue: z.object({ scene: id, days: z.number().int().min(0) }).strict() }).strict(),
  z.object({ know: id }).strict(),
  z.object({ journal: z.string() }).strict(),
  z.object({ days: z.number().int().min(0) }).strict(),
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
}).strict();
export type Place = z.infer<typeof place>;

/** expedition: uncharted water; sailed only as an expedition until the far end is charted. */
export const leg = z.object({ a: id, b: id, days: z.number().min(0.5), kind: z.enum(['coastal', 'open', 'river']), expedition: z.boolean().optional() }).strict();
export type Leg = z.infer<typeof leg>;

export const shipType = z.object({ id, name: z.string(), oars: z.number().int(), crew: z.number().int(), cargo: z.number().int(), speed: z.number(), cost: z.number().int(), desc: z.string() }).strict();
export type ShipType = z.infer<typeof shipType>;

export const foe = z.object({ id, name: z.string(), quality: z.number().int().min(0).max(3), doctrine: weights(ORDERS), desc: z.string() }).strict();
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
  desc: z.string(),
}).strict();
export type Fighter = z.infer<typeof fighter>;

export const swornMan = z.object({ id, name: z.string(), temperament: z.enum(TEMPERAMENTS), weapons: z.number().int(), loyalty: z.number().int().min(0).max(10), desc: z.string() }).strict();
export type SwornManDef = z.infer<typeof swornMan>;

export const rival = z.object({ id, name: z.string(), born: z.number().int(), died: z.number().int(), curve: z.array(z.tuple([z.number().int(), z.number()])).min(2), note: z.string() }).strict();
export type Rival = z.infer<typeof rival>;

export const injury = z.object({ id, name: z.string(), desc: z.string(), days: z.number().int().optional(), attrs: z.record(z.string(), z.number()).optional(), deed: z.boolean().optional() }).strict();
export type Injury = z.infer<typeof injury>;

export const deedType = z.object({ id, name: z.string(), weight: z.number() }).strict();
export type DeedType = z.infer<typeof deedType>;

export const background = z.object({
  id,
  label: z.string(),
  desc: z.string(),
  patronymic: z.string(),
  attrs,
  skills,
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

export const BOAST_STATS = ['raids', 'plunder', 'battlesWon', 'duelsWon', 'legs'] as const;
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
  names: string[];
  art: Record<string, ArtEntry>;
  boasts: Record<string, BoastDef>;
  goods: Record<string, GoodDef>;
  captains: Record<string, CaptainDef>;
  items: Record<string, ItemDef>;
  fates: Record<string, FateDef>;
  banter: BanterLine[];
}
