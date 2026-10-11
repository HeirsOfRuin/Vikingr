// Content schema. One Zod definition gives both the TypeScript types and the
// runtime validation the content compiler runs on every YAML file.
import { z } from 'zod';

export const ATTRS = ['str', 'agi', 'end', 'wit', 'pre'] as const;
export const SKILLS = ['weapons', 'shield', 'seamanship', 'command', 'cunning', 'speech', 'trade', 'lore', 'craft'] as const;
export const DUEL_MOVES = ['strike', 'guard', 'feint', 'bind', 'bash'] as const;
export const ORDERS = ['hold', 'push', 'missiles', 'wedge', 'give', 'flank'] as const;
export const TERRAINS = ['beach', 'field', 'ford', 'rampart', 'ship', 'woods'] as const;
export const PHASES = ['muster', 'sailing', 'return', 'winter'] as const;
export const PLACE_KINDS = ['home', 'hall', 'market', 'monastery', 'town', 'island', 'landmark'] as const;
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

export const effect = z.union([
  z.object({ set: z.string() }).strict(),
  z.object({ clear: z.string() }).strict(),
  z.object({ add: z.record(z.string(), z.number()) }).strict(),
  z.object({ deed: z.object({ type: id, text: z.string().optional(), weight: z.number().optional(), witnesses: z.number().int().optional() }).strict() }).strict(),
  z.object({ injury: id }).strict(),
  z.object({ man: z.object({ id, loyalty: z.number().optional(), join: z.boolean().optional(), leave: z.boolean().optional() }).strict() }).strict(),
  z.object({ fight: z.object({ foe: id, kind: z.enum(['duel', 'holmgang']), lethal: z.boolean(), win: id.optional(), lose: id.optional() }).strict() }).strict(),
  z.object({ battle: z.object({ foe: id, men: z.number().int(), terrain: z.enum(TERRAINS), win: id.optional(), lose: id.optional() }).strict() }).strict(),
  z.object({ queue: z.object({ scene: id, days: z.number().int().min(1) }).strict() }).strict(),
  z.object({ know: id }).strict(),
  z.object({ journal: z.string() }).strict(),
  z.object({ days: z.number().int().min(0) }).strict(),
]);
export type Effect = z.infer<typeof effect>;

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
  region: z.string(),
  desc: z.string(),
  known: z.boolean().optional(),
  active: z.boolean().optional(),
  market: z.boolean().optional(),
  art: id.optional(),
  raid: z.object({ wealth: z.number().int(), defenders: z.number().int(), foe: id, terrain: z.enum(TERRAINS) }).strict().optional(),
}).strict();
export type Place = z.infer<typeof place>;

export const leg = z.object({ a: id, b: id, days: z.number().min(0.5), kind: z.enum(['coastal', 'open', 'river']) }).strict();
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
}).strict();
export type Background = z.infer<typeof background>;

export const flagDef = z.object({ description: z.string() }).strict();

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
}
