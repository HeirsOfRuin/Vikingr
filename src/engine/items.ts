// Kit, ship fittings, the men's gear, and weapons that earn names (FRAME-FOUNDATION §2–3).
import type { ContentBundle, ItemDef } from '../content/schema';
import type { GameState, ItemInst, KitSlot, Ship } from './state';
import type { RngCursor } from './rng';
import { journal } from './journal';
import { formatSilver } from './format';
import { addDeed } from './fame';

export const DEFAULT_KIT = ['spear', 'shield', 'leather'];
const SLOT_OF: Partial<Record<ItemDef['kind'], KitSlot>> = { weapon: 'weapon', shield: 'shield', helmet: 'helmet', armour: 'armour' };

// ---- owning and carrying ----

export function slotOf(def: ItemDef): KitSlot | null {
  return SLOT_OF[def.kind] ?? null;
}

export function giveItem(state: GameState, content: ContentBundle, id: string, equip = false): ItemInst {
  const def = content.items[id];
  if (!def) throw new Error(`unknown item ${id}`);
  const inst: ItemInst = { uid: `${id}${state.items.length}_${state.day}`, id, name: null, deeds: def.deeds ?? 0 };
  state.items.push(inst);
  const slot = slotOf(def);
  if (slot && (equip || !state.kit[slot])) state.kit[slot] = inst.uid;
  return inst;
}

export function loseItem(state: GameState, id: string): void {
  const i = state.items.findIndex((x) => x.id === id);
  if (i < 0) return;
  const [gone] = state.items.splice(i, 1);
  for (const slot of Object.keys(state.kit) as KitSlot[]) if (state.kit[slot] === gone!.uid) delete state.kit[slot];
}

export function hasItem(state: GameState, id: string): boolean {
  return state.items.some((x) => x.id === id);
}

export function equipped(state: GameState, slot: KitSlot): ItemInst | null {
  const uid = state.kit[slot];
  return (uid && state.items.find((x) => x.uid === uid)) || null;
}

export function equip(state: GameState, content: ContentBundle, uid: string): void {
  const inst = state.items.find((x) => x.uid === uid);
  const slot = inst && slotOf(content.items[inst.id]!);
  if (inst && slot) state.kit[slot] = uid;
}

/** The display name: "Leggbítr (your grandfather's sword)", or just the item's name. */
export function itemName(content: ContentBundle, inst: ItemInst): string {
  const base = content.items[inst.id]?.name ?? inst.id;
  return inst.name ? `${inst.name} (${base.charAt(0).toLowerCase()}${base.slice(1)})` : base;
}

// ---- what the kit does in a fight ----

/** How hard he hits: the weapon in his hand (bare hands 1). */
export function heroWeapon(state: GameState, content: ContentBundle): number {
  const w = equipped(state, 'weapon');
  return w ? content.items[w.id]?.value ?? 1 : 1;
}

/** Blows turned: body armour (wool 0) and a helmet. */
export function heroArmour(state: GameState, content: ContentBundle): number {
  const body = equipped(state, 'armour');
  const helm = equipped(state, 'helmet');
  return (body ? content.items[body.id]?.value ?? 0 : 0) + (helm ? content.items[helm.id]?.value ?? 0 : 0);
}

/** A better shield adds to his guard. */
export function shieldBonus(state: GameState, content: ContentBundle): number {
  const s = equipped(state, 'shield');
  return s ? content.items[s.id]?.value ?? 0 : -1;
}

// ---- the ship's fittings ----

export const FITTING = { sailSpeed: 1.1, caulkingStorm: 0.6, prowMorale: 1, rackQuality: 0.15 } as const;

export function hasFitting(ship: Ship | undefined, id: string): boolean {
  return !!ship?.fittings?.includes(id);
}

// ---- the men's gear ----

export const GEAR_MAX = 3;
/** What their gear adds to their quality in the wall, per level. */
export const GEAR_QUALITY = 0.2;
/** Silver per man to raise them one level: helmets cost more than shields, mail more than helmets. */
export const GEAR_COST_PER_MAN = [4, 8, 14] as const;
export const GEAR_WORDS = ['spears and shields', 'iron caps for every man', 'mail in the front rank', 'mail for every man'] as const;

export function gearWord(gear: number): string {
  return GEAR_WORDS[Math.max(0, Math.min(GEAR_MAX, Math.floor(gear)))]!;
}

export function armCost(state: GameState): number | null {
  const lvl = Math.floor(state.crew.gear);
  if (lvl >= GEAR_MAX) return null;
  return state.crew.men * GEAR_COST_PER_MAN[lvl]!;
}

// ---- buying ----

export type Shop = 'smith' | 'market' | 'shipwright';

/** What can be bought here now: kit he doesn't already own, fittings his ship lacks. */
export function forSale(state: GameState, content: ContentBundle, shops: Shop[]): ItemDef[] {
  return Object.values(content.items).filter((d) => {
    if (!d.price || !d.sold?.some((s) => shops.includes(s))) return false;
    if (d.kind === 'fitting') return !state.service && state.ships.length > 0 && !hasFitting(state.ships[0], d.id);
    return !hasItem(state, d.id);
  });
}

export function buy(state: GameState, content: ContentBundle, id: string): string[] {
  const d = content.items[id]!;
  state.silver -= d.price!;
  if (d.kind === 'fitting') {
    const ship = state.ships[0]!;
    ship.fittings = [...(ship.fittings ?? []), id];
    journal(state, `Fitted ${ship.name} with ${d.name.charAt(0).toLowerCase()}${d.name.slice(1)}.`);
    return [`${d.desc}`, `${ship.name} has it now.`];
  }
  giveItem(state, content, id, true);
  journal(state, `Bought ${d.name.charAt(0).toLowerCase()}${d.name.slice(1)}.`);
  return [d.desc, 'You carry it from now on.'];
}

// ---- weapons that earn names ----

/** Deeds a weapon must see before the men give it a name. */
export const NAME_AT = 5;
/** Extra fame on fighting deeds done with a named weapon in his hand. */
export const NAMED_FAME = 1.15;
export const FIGHT_DEEDS = ['duel_won', 'killed_champion', 'holmgang_won', 'front_deed', 'battle_won', 'sea_fight_won', 'first_over'];

const WEAPON_NAMES: Record<string, [string, string][]> = {
  sword: [['Leggbítr', 'Leg-biter'], ['Hvítingr', 'the White One'], ['Gramr', 'Wrath'], ['Naðr', 'the Adder'], ['Fótbítr', 'Foot-biter'], ['Hneitir', 'the Wounder'], ['Brynjubítr', 'Mail-biter']],
  axe: [['Rimmugýgr', 'Battle-hag'], ['Skeggöx', 'Old Beard'], ['Hel', 'Hel'], ['Járnglumra', 'Iron-clatter']],
  spear: [['Grásíða', 'Grey-flank'], ['Hrafnsfæða', 'Raven-feeder'], ['Ulfr', 'the Wolf']],
  seax: [['Tanni', 'the Tooth'], ['Ormstunga', 'Snake-tongue']],
};
const KIND_OF_WEAPON: Record<string, keyof typeof WEAPON_NAMES> = {
  spear: 'spear', axe: 'axe', ormr_seax: 'seax', grandfather_sword: 'sword', frankish_sword: 'sword', mael_brigte_sword: 'sword',
};

/** A deed done with the weapon in his hand. At NAME_AT the men name it. Returns a line to tell, or null. */
export function creditWeapon(state: GameState, content: ContentBundle, rng: RngCursor, n = 1): string | null {
  const w = equipped(state, 'weapon');
  if (!w || n <= 0) return null;
  w.deeds += n;
  if (w.name || w.deeds < NAME_AT) return null;
  const pool = WEAPON_NAMES[KIND_OF_WEAPON[w.id] ?? 'sword']!;
  const taken = new Set(state.items.map((x) => x.name));
  const free = pool.filter(([nm]) => !taken.has(nm));
  const [nm, gloss] = (free.length ? free : pool)[rng.int((free.length ? free : pool).length)]!;
  w.name = nm;
  const base = content.items[w.id]!.name.toLowerCase().replace(/^an? /, 'the ');
  addDeed(state, content, { type: 'weapon_named', text: `His weapon was given a name: ${nm}, ${gloss}`, witnesses: state.crew.men });
  journal(state, `The men call ${base} ${nm} now: ${gloss}.`);
  return `Somewhere between the fight and the fire, the men start calling ${base} by a name: ${nm}. ${gloss}. You didn't choose it. Nobody ever does.`;
}

export function namedWeaponInHand(state: GameState): boolean {
  return !!equipped(state, 'weapon')?.name;
}

/** Old saves: the kit is rebuilt from the flags that used to stand for it. */
export function kitFromFlags(state: GameState, content: ContentBundle, background: string): void {
  if (state.items) return;
  state.items = [];
  state.kit = {};
  for (const id of content.backgrounds[background]?.kit ?? DEFAULT_KIT) giveItem(state, content, id, true);
  if (state.flags.b_blessing) giveItem(state, content, 'father_shield', true);
  if (state.flags.b_ormr_seax) giveItem(state, content, 'ormr_seax');
  if (state.flags.b_sword) giveItem(state, content, 'grandfather_sword', true);
  if (state.flags.frankish_sword) giveItem(state, content, 'frankish_sword', true);
  if (state.flags.mail) giveItem(state, content, 'mail', true);
}

// ---- selling and giving away what he no longer carries (playtest 4) ----

/** Kit he owns and isn't using: weapons, shields, helmets, armour. */
export function spareKit(state: GameState, content: ContentBundle): ItemInst[] {
  const inHand = new Set(Object.values(state.kit));
  return state.items.filter((x) => !inHand.has(x.uid) && slotOf(content.items[x.id]!) !== null);
}

/** What a trader will give for it: half its price, more for a blade with a name and a history. */
export function sellValue(content: ContentBundle, inst: ItemInst): number {
  const def = content.items[inst.id]!;
  const base = def.price ?? (def.value ?? 1) * 24;
  return Math.round(base * 0.5 * (inst.name ? 1.5 : 1) + inst.deeds * 2);
}

export function sellItem(state: GameState, content: ContentBundle, uid: string): string {
  const i = state.items.findIndex((x) => x.uid === uid);
  if (i < 0) return '';
  const inst = state.items[i]!;
  const def = content.items[inst.id]!;
  const price = sellValue(content, inst);
  state.items.splice(i, 1);
  state.silver += price;
  const name = itemName(content, inst);
  journal(state, `Sold ${name.charAt(0).toLowerCase()}${name.slice(1)} for ${formatSilver(price)}.`);
  if (def.heirloom) {
    state.honour = Math.max(-10, state.honour - 1);
    return `You sell ${name.charAt(0).toLowerCase()}${name.slice(1)} for ${formatSilver(price)}. The trader can't believe his luck. Neither, when they hear of it at home, can anyone else.`;
  }
  return `You sell ${name.charAt(0).toLowerCase()}${name.slice(1)} for ${formatSilver(price)}.`;
}

/** A blade or a mail-shirt given to a sworn man, in front of the others: it binds him closer, and he fights better for it. */
export function giveKitTo(state: GameState, content: ContentBundle, uid: string, manId: string): string {
  const i = state.items.findIndex((x) => x.uid === uid);
  const m = state.men.find((x) => x.id === manId && x.alive && x.sworn);
  if (i < 0 || !m || Object.values(state.kit).includes(uid)) return '';
  const inst = state.items[i]!;
  const def = content.items[inst.id]!;
  state.items.splice(i, 1);
  m.loyalty = Math.min(10, m.loyalty + (def.heirloom || inst.name ? 3 : 2));
  if (def.kind === 'weapon') m.weapons = Math.min(6, m.weapons + 1);
  const name = itemName(content, inst);
  journal(state, `Gave ${name.charAt(0).toLowerCase()}${name.slice(1)} to ${m.name}.`);
  return `You give ${name.charAt(0).toLowerCase()}${name.slice(1)} to ${m.name}, in front of the others.`;
}
