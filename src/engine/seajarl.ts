// The sea-jarldom (Josh, 2026-11-13: "a way to connect all of your lands and ship forts into a sea-jarl network or
// something once you have a hall and 3 other pieces of land/ship forts"). Not a seat taken from a rival (rule.ts):
// a network he builds out of his own holdings, the way the Orkney jarls and the kings of the Isles held the sea
// between their islands. While it holds:
//   - one muster: every holding sends its men to his spring muster by ship, without his sailing round for them;
//   - the forts stand together: a fort's people count part of the other forts' garrisons when they think of retaking it;
//   - skatt: his landholders send a share on top of what the land yields;
//   - his own harbours feed his ships free.
// It costs gifts at Yule to every landholder, and it comes apart if he loses his hall or falls below three holdings.
import type { ContentBundle } from '../content/schema';
import type { GameState } from './state';
import { dateOf } from './calendar';
import { journal } from './journal';
import { formatSilver, plural } from './format';
import { addDeed, livingFame } from './fame';
import { FORT_SUPPORT, holdingYield, LAND, type Holding } from './land';
import { homeOf } from './settle';
import { earn } from './hardship';

export const SEAJARL = {
  /** Holdings needed besides the one that is his home. */
  holdings: 3,
  minFame: 100,
  /** The feast at which his landholders name him: silver, and days. */
  feast: 96,
  feastDays: 10,
  deed: 30,
  /** What his landholders send on top of the yield, as a share of it. */
  skatt: 0.3,
  /** Gifts at Yule to every landholder (silver a holding); unpaid, the wardens' loyalty suffers. */
  gifts: 6,
  /** A fort counts this share of the other forts' garrisons against a retaking (land.ts fortRisk). */
  support: FORT_SUPPORT,
  /** A warden in the network grows this much more loyal a year: he is part of something. */
  wardenLoyalty: 1,
} as const;

export interface SeaJarlState { since: number }

/** His holdings, the home excepted: the network's members. */
export function networkHoldings(state: GameState): Holding[] {
  return (state.holdings ?? []).filter((h) => h.place !== homeOf(state));
}

export function isSeaJarl(state: GameState): boolean {
  return !!state.seajarl;
}

/** Whether he can be named sea-jarl now, and if not, every reason with the way past it. */
export function seaJarlStatus(state: GameState, content: ContentBundle): { open: boolean; why: string[] } {
  const why: string[] = [];
  if (state.seajarl) return { open: false, why: ['You are sea-jarl already.'] };
  if (state.service) why.push('Not while you row in another man\'s ship.');
  if (state.base.level !== 'hall') why.push('You need a hall of your own: a high seat to call your landholders to.');
  const n = networkHoldings(state).length;
  if (n < SEAJARL.holdings) why.push(`You need land or ship-forts at ${SEAJARL.holdings} places besides your home: you have ${n}.`);
  if (livingFame(state) < SEAJARL.minFame) why.push(`Your name is not great enough yet: ${Math.round(livingFame(state))} of ${SEAJARL.minFame}.`);
  if (state.at !== homeOf(state)) why.push(`Your landholders come to your hall at ${content.places[homeOf(state)]?.name ?? 'home'}: be there.`);
  if (state.silver < SEAJARL.feast) why.push(`The feast and the gifts cost ${formatSilver(SEAJARL.feast)}.`);
  return { open: why.length === 0, why };
}

/** Whether he would still qualify, at the turn of the year: a hall and the holdings. */
function stillHolds(state: GameState): boolean {
  return state.base.level === 'hall' && networkHoldings(state).length >= SEAJARL.holdings;
}

export function proclaimSeaJarl(state: GameState, content: ContentBundle): string[] {
  state.silver -= SEAJARL.feast;
  state.day += SEAJARL.feastDays;
  state.seajarl = { since: state.day };
  const names = networkHoldings(state).map((h) => content.places[h.place]!.name);
  const list = `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  addDeed(state, content, { type: 'deed', text: `Was named sea-jarl by his landholders from ${list}`, weight: SEAJARL.deed, witnesses: 300 });
  journal(state, `Named sea-jarl by the landholders of ${list}.`);
  return [
    `They come in by ship over ten days, from ${list}: the men who hold your land, the wardens of your forts, their sons and their steersmen, with gifts that are not quite tribute and not quite anything else. The hall has never been so full.`,
    `On the third night they put you in the high seat and carry the cup to you, and the oldest of them says it for all of them: that the sea between their shores is one road now, and the road is yours. Sea-jarl, they call you. No king gave you the name. That is how you know it is yours.`,
    `From now on: every holding sends its men to your spring muster; your forts stand together; your landholders send skatt on top of the yield; your own harbours feed your ships. At Yule you owe each of them a gift, ${formatSilver(SEAJARL.gifts)} a holding.`,
  ];
}

/** The skatt his landholders send at the turn of the year, on top of the yields. */
export function seaSkatt(state: GameState): number {
  if (!state.seajarl) return 0;
  return Math.round((state.holdings ?? []).reduce((n, h) => n + holdingYield(h), 0) * SEAJARL.skatt);
}

/** The men his holdings send to the spring muster, by ship: what he would have called out on each shore. */
export function networkMuster(state: GameState): number {
  if (!state.seajarl) return 0;
  return networkHoldings(state).reduce((n, h) => n + LAND[h.kind].men, 0);
}

export function yuleGifts(state: GameState): number {
  return state.seajarl ? networkHoldings(state).length * SEAJARL.gifts : 0;
}

/** The turn of the year: skatt in, gifts out, the muster sent; and whether it still holds together. */
export function seaJarlYear(state: GameState, content: ContentBundle): string[] {
  if (!state.seajarl) return [];
  const year = dateOf(state.day).year;
  if (!stillHolds(state)) {
    delete state.seajarl;
    journal(state, 'The sea-jarldom came apart.');
    return [`The landholders do not come to Yule this year. ${state.base.level !== 'hall' ? 'There is no hall to come to.' : `With land at ${plural(networkHoldings(state).length, 'place')} now, there is not enough of the road left to call it one.`} The name sea-jarl goes out of men's mouths the way it came in, without anybody saying so.`];
  }
  const lines: string[] = [];
  const skatt = seaSkatt(state);
  const gifts = yuleGifts(state);
  state.silver += skatt;
  earn(state, skatt);
  const wardens = networkHoldings(state).map((h) => h.warden?.ship.master).filter((m): m is string => !!m?.startsWith('man:')).map((m) => state.men.find((x) => x.id === m.slice(4))).filter((m) => !!m);
  if (state.silver >= gifts) {
    state.silver -= gifts;
    for (const m of wardens) m!.loyalty = Math.min(10, m!.loyalty + SEAJARL.wardenLoyalty);
    lines.push(`As sea-jarl: your landholders sent ${formatSilver(skatt)} in skatt at Yule, and went home with ${formatSilver(gifts)} in gifts and their cups refilled.`);
  } else {
    for (const m of wardens) m!.loyalty = Math.max(0, m!.loyalty - 2);
    lines.push(`As sea-jarl: your landholders sent ${formatSilver(skatt)} in skatt at Yule, and went home without the gifts a jarl owes them. ${wardens.length ? 'Your wardens noticed.' : 'They noticed.'}`);
  }
  // the holdings' men come to the muster by ship, and are not called out again on their own shores
  const men = networkMuster(state);
  for (const h of networkHoldings(state)) h.mustered = year;
  state.musterPool += men;
  if (men) lines.push(`${plural(men, 'man', 'men')} from your holdings are on their way to your spring muster by ship.`);
  return lines;
}
