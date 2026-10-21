// Settlement (docs/FRAME-LINEAGE.md C): he brings his family and his men's families to land he holds abroad, and
// it becomes home. He winters there as at home, musters there, shares out there. The scenes written for Hordaland
// stay in Hordaland: the jarl's levy, the district's feasts, the old neighbours. A ship-fort home can still be
// attacked in the winter, and he will be there to fight for it.
import type { ContentBundle } from '../content/schema';
import type { GameState } from './state';
import { aliveMen, clampMorale } from './crew';
import { holdingAt, LAND } from './land';
import { journal } from './journal';
import { formatSilver, plural } from './format';
import { BASE, FARM_PRICE, HALL_PRICE } from './base';
import { living } from './family';
import { addDeed } from './fame';

export const SETTLE = {
  /** Souls a ship carries for each point of her cargo, with their beasts and their gear. */
  perCargo: 4,
  /** Every sworn man brings a wife and a child; every three oarsmen, a family between them. */
  perSworn: 2,
  perOars: 3,
  /** A summer's food for each soul, man-days. */
  food: 30,
  /** What the move does for the men, at once. */
  morale: 2,
  loyalty: 2,
  /** With their wives here, no sworn man's loyalty falls below this at the turn of the year. */
  loyaltyFloor: 3,
  /** Settlers' sons: men at the muster, and in a ship-fort's garrison. */
  muster: 4,
  garrison: 10,
  /** What the old place fetches: half its price. */
  sale: 0.5,
  /** A founder's deed, in a new country: lasting, as a verse is. */
  founder: 12,
  /** The days the ships take to go and fetch them. */
  days: 24,
} as const;

/** Where home is: Hordaland, until he settles somewhere else. */
export function homeOf(state: GameState): string {
  return state.homeAt ?? 'home_fjord';
}

export function atHome(state: GameState): boolean {
  return state.at === homeOf(state);
}

/** Settled abroad: home is not Hordaland. */
export function settledAbroad(state: GameState): boolean {
  return !!state.homeAt && state.homeAt !== 'home_fjord';
}

/** The souls who come: his household, his thralls, and his men's families. */
export function souls(state: GameState): number {
  const kin = (state.base.wife ? 1 : 0) + (state.family?.mother ? 1 : 0) + living(state).filter((c) => !c.wed && !c.man && !c.foster && !c.hero).length;
  const sworn = aliveMen(state).filter((m) => m.sworn).length;
  return kin + state.base.thralls + sworn * SETTLE.perSworn + Math.ceil(state.crew.men / SETTLE.perOars);
}

export function settleRoom(state: GameState, content: ContentBundle): number {
  return state.ships.reduce((n, s) => n + (content.ships[s.type]?.cargo ?? 1), 0) * SETTLE.perCargo;
}

export function settleFood(state: GameState): number {
  return souls(state) * SETTLE.food;
}

/** What a new longhouse costs a man with no farm of his own to sell. */
export function settleCost(state: GameState): number {
  return state.base.level === 'father' ? Math.round(FARM_PRICE * SETTLE.sale) : 0;
}

/** Why he can't settle here now, or null. */
export function settleBlock(state: GameState, content: ContentBundle): string | null {
  const at = state.at;
  if (!at || state.voyage || state.service) return 'Not now.';
  if (!holdingAt(state, at)) return 'You hold no land here.';
  if (homeOf(state) === at) return 'This is home already.';
  if (!state.ships.length) return 'You have no ships to fetch them in.';
  const need = souls(state), room = settleRoom(state, content);
  if (room < need) return `${plural(need, 'soul')} to carry, and room in your ships for ${room}. A knarr carries ${(content.ships.knarr?.cargo ?? 10) * SETTLE.perCargo}.`;
  if (state.provisions < settleFood(state)) return `A summer's food for ${plural(need, 'soul')}: ${settleFood(state)} days' rations, and you have ${state.provisions}.`;
  if (state.silver < settleCost(state)) return `A longhouse to raise: ${formatSilver(settleCost(state))}.`;
  return null;
}

export function settleHint(state: GameState, content: ContentBundle): string {
  const old = BASE[state.base.level].name.toLowerCase();
  const sale = state.base.level === 'father' ? `a longhouse to raise, ${formatSilver(settleCost(state))}` : `${old} sold for ${formatSilver(oldSale(state))}`;
  return `${plural(souls(state), 'soul')} (room for ${settleRoom(state, content)}); ${settleFood(state)} days' food; ${sale}; ${SETTLE.days} days. Hordaland's own doings stay in Hordaland`;
}

function oldSale(state: GameState): number {
  return state.base.level === 'hall' ? Math.round(HALL_PRICE * SETTLE.sale) : state.base.level === 'farm' ? Math.round(FARM_PRICE * SETTLE.sale) : 0;
}

/** The move. The old place is sold; the household, the hoard, the thralls and the men's families come. */
export function settleHere(state: GameState, content: ContentBundle): string[] {
  const at = state.at!;
  const name = content.places[at]!.name;
  const n = souls(state);
  const from = homeOf(state) === 'home_fjord' ? 'Hordaland' : content.places[homeOf(state)]!.name;
  state.provisions -= settleFood(state);
  const cost = settleCost(state);
  const sale = oldSale(state);
  state.silver += sale - cost;
  if (state.base.level === 'father') state.base.level = 'farm';
  state.day += SETTLE.days;
  state.homeAt = at;
  state.flags._settled = 1;
  const h = holdingAt(state, at)!;
  if (h.kind === 'fort') h.garrison = (h.garrison ?? 0) + SETTLE.garrison;
  state.crew.morale += SETTLE.morale;
  clampMorale(state);
  for (const m of aliveMen(state)) if (m.sworn) m.loyalty = Math.min(10, m.loyalty + SETTLE.loyalty);
  journal(state, `Settled at ${name}, with ${plural(n, 'soul')}: the household, the thralls, and the men's families.`);
  // a founder in a new country: his name goes into the book of the land-takings, and stays there
  if (content.places[at]!.landnam !== undefined) {
    const d = addDeed(state, content, { type: 'deed', text: `Settled ${content.places[at]!.region} at ${name}, and founded a house there`, weight: SETTLE.founder, witnesses: n });
    d.verse = true;
  }
  const lines = [
    `The ships go back to ${from} for them, and come back low in the water: ${plural(n, 'soul')}, with their cows and their looms and their seed-corn, and ${state.base.wife ? `${state.base.wife} standing in the bow of the first ship as if she had planned the whole thing` : 'the old women complaining the whole way'}.`,
    sale ? `${BASE[state.base.level].name} in ${from} is sold, for ${formatSilver(sale)}. You build again here, ${state.base.level === 'hall' ? 'a hall with carved posts, as long as the old one' : 'a longhouse'}, with the hoard under the floor and the trophies on the walls.` : `You raise a longhouse here, for ${formatSilver(cost)} in timber and turf, and bury the hoard under its floor.`,
    `The men's wives are here now. They will fight harder for this shore, and none of them will go home at the turn of the year: home is here.`,
    h.kind === 'fort' ? `The settlers' sons take their turns on the stockade: ${plural(h.garrison ?? 0, 'man', 'men')} hold it now. They will still come for it in the winter. You will be here.` : `${name} is home. The jarl's levy, the district's feasts and the old neighbours stay in Hordaland. That is what leaving means.`,
  ];
  return lines;
}

/** The muster at a settled home: the settlers' sons and the land, instead of the jarl's district. */
export function settledMuster(state: GameState): number {
  if (!settledAbroad(state)) return 0;
  const h = holdingAt(state, homeOf(state));
  return SETTLE.muster + (h ? LAND[h.kind].men : 0);
}

/** The fort that is home has fallen: the family gets away in the ships, and goes back to kin in Hordaland. */
export function loseHome(state: GameState, content: ContentBundle): string[] {
  const at = homeOf(state);
  const name = content.places[at]?.name ?? at;
  state.holdings = (state.holdings ?? []).filter((h) => h.place !== at);
  if (state.places[at]) { state.places[at]!.norse = false; state.places[at]!.standing = Math.min(state.places[at]!.standing ?? 0, -6); }
  delete state.homeAt;
  const lost = Math.round(state.base.hoard * 0.5);
  state.base.hoard -= lost;
  state.base.trophies = [];
  if (state.base.level === 'hall') state.base.level = 'farm';
  state.base.thralls = Math.floor(state.base.thralls / 2);
  journal(state, `Lost the settlement at ${name}. The household went back to Hordaland.`);
  return [`The settlement at ${name} is gone. The families got away in the ships, most of them, with what they could carry; the hall burned with the trophies on its walls, and they dug up half the hoard before you could. Your kin in Hordaland take you in.`];
}
