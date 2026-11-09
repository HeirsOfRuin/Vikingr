// Plunder against the alarm (DESIGN §11.3, step 3). After the assault, each round takes more,
// and the countryside wakes. Leave in time, or lose what you are carrying getting back to the ships.
import { earn } from './hardship';
import { ownFleetMen, ownFleetPlunder } from './ownfleet';
import { strandRaided } from './strand';
import { aliveMen, mouths } from './crew';
/** A raid on an unnamed place on the shore is a smaller deed than a named one (base raid weight is 3). */
const STRAND_DEED = 1.5;
import { SERVICE_DEED } from './fights';
import { stow } from './fleet';
import type { ContentBundle } from '../content/schema';
import type { GameState, PlunderState } from './state';
import type { RngCursor } from './rng';
import { addDeed } from './fame';
import { journal } from './journal';
import { formatSilver, plural } from './format';
import { POSITION_FAME } from './tuning';
import { onRaided } from './standing';
import { coastPlunderStart } from './hardship';
import { plunderRing } from './rings';
import { brokePeace, findHostage, hostagesOf, HOSTAGE } from './hostages';
import { giveItem } from './items';
import { stowGoods } from './trade';

/** What a raid's stores hold, by the people raided: goods into the hold (playtest 9: "select specific things to keep"). */
const STORES: Record<string, { good: string; what: string }[]> = {
  frankish: [{ good: 'wine', what: 'casks of wine from the cellar' }, { good: 'salt', what: 'sacks of salt from the store-house' }, { good: 'glass', what: 'crates of Rhenish glass from a merchant\'s house' }],
  frisian: [{ good: 'wool', what: 'bales of Frisian cloth' }, { good: 'wine', what: 'casks of Rhine wine' }],
  english: [{ good: 'wool', what: 'bales of English wool' }, { good: 'grain', what: 'sacks of grain from the barns' }],
  gael: [{ good: 'hides', what: 'bales of cattle hides' }, { good: 'grain', what: 'sacks of oats from the barns' }],
  pict: [{ good: 'hides', what: 'bales of hides' }, { good: 'wool', what: 'bales of wool' }],
  briton: [{ good: 'hides', what: 'bales of hides' }, { good: 'wool', what: 'bales of wool' }],
};
const STORES_ANY = [{ good: 'grain', what: 'sacks of grain from the barns' }, { good: 'hides', what: 'bales of hides' }];

/** War-gear on the dead and in the hall: the chance of each, best first. One find a search. */
export const ARMS = [
  { id: 'mail', p: 0.15, line: 'a mail shirt, off a dead man who will not need it, with only one ring burst' },
  { id: 'frankish_sword', p: 0.15, line: 'a Frankish sword, pattern-welded, from a rack in the hall' },
  { id: 'helmet', p: 0.3, line: 'an iron cap, dented but sound' },
] as const;

/** How much of a place one crew can strip before it wakes (Josh, 2026-11-08: "too easy to become big and rich"; two or
 *  three ships took 47 pounds out of Dorestad in an afternoon). A town is many houses and a crew is so many men: every
 *  man in the line searches (a félag partner's too, who takes his men's part at the share-out) against the place's own
 *  men. A monastery's handful is stripped whole; Dorestad by sixty men is not. In a host, the other wings strip the town
 *  alongside him, faster than one crew could, and his crews' part of each round is their share of the men. */
export const REACH = { perDefender: 1.5, floor: 0.25, hostMax: 2 } as const;

export function plunderReach(men: number, defenders: number, host = false): number {
  if (defenders <= 0) return 1;
  return Math.max(REACH.floor, Math.min(host ? REACH.hostMax : 1, men / (defenders * REACH.perDefender)));
}

/** What each choice in the plunder rounds is worth, so that each is best somewhere (Josh, 2026-11-08: "captives and goods
 *  are only worth it when the place has been tested too often"). A round of captives was 2-5 people at half a pound,
 *  a third of a first grab in a monastery; now 3-6, more where more people live, at the price below: a little over half
 *  a monastery's first grab, its equal by the third, and about a grab's worth in a town. The stores are once a raid,
 *  goods for a market and food for the voyage home: the choice when the hold is empty of bread. */
export const CAPTIVES = { min: 3, spread: 4, popFrom: 0.6, popPer: 50, popMax: 2 } as const;
export const STORES_TAKE = { lots: 3, spread: 4, foodDays: [6, 10] as const } as const;
export const GRAB_RATE = { base: 0.14, spread: 0.12 } as const;
/** The noise each choice makes, against the ALARM_MAX the countryside can take (the hostage's is HOSTAGE.alarm). */
export const NOISE = { grab: [1.5, 3] as const, captives: 2, arms: 1.5, stores: 1.5, burn: 1 } as const;

/** How many more people live here than in a monastery's handful, as far as his men can reach (1 to 2). */
export function captivePop(content: ContentBundle, p: PlunderState): number {
  if (p.strand) return 1;
  const def = content.places[p.place]?.raid?.defenders ?? 0;
  const pop = Math.min(CAPTIVES.popMax, Math.max(1, CAPTIVES.popFrom + def / CAPTIVES.popPer));
  return Math.max(1, pop * Math.min(1, (p.reach ?? 1) * 2));
}

/** What the next round of each choice should bring, by the rules the round itself uses (shown on the buttons). */
export function plunderPreview(state: GameState, content: ContentBundle, p: PlunderState): { grab: number; captives: [number, number]; storesFood: number } {
  const src = p.strand ?? state.places[p.place]!;
  const reach = p.strand ? 1 : p.reach ?? 1;
  const share = p.strand ? 1 : p.share ?? 1;
  const grab = Math.round(src.wealth * (GRAB_RATE.base + GRAB_RATE.spread / 2) * reach * share);
  const pop = captivePop(content, p);
  return { grab, captives: [Math.round(CAPTIVES.min * pop), Math.round((CAPTIVES.min + CAPTIVES.spread - 1) * pop)], storesFood: STORES_TAKE.foodDays[0] };
}

export type PlunderWhat = 'grab' | 'captives' | 'burn' | 'hostage' | 'arms' | 'stores' | 'leave';
export const ALARM_MAX = 10;

export function startPlunder(state: GameState, place: string, lines: string[], next?: string, content?: ContentBundle, line?: { allyMen?: number; hostMen?: number }): void {
  if (!state.seasonRaids.includes(place)) state.seasonRaids.push(place);
  // a region that has learned comes to the alarm faster (docs/FRAME-HARDSHIP.md)
  const alarm = 2 + (content ? coastPlunderStart(state, content, place) : 0);
  const defenders = content?.places[place]?.raid?.defenders ?? 0;
  // his crew and a félag partner's (the partner takes his men's part at the share-out); his own fleet's crews and a
  // host's other wings strip the same streets alongside, each for themselves
  const ours = state.crew.men + aliveMen(state).length + (line?.allyMen ?? 0);
  const fleet = state.service ? 0 : ownFleetMen(state);
  const host = line?.hostMen ?? 0;
  const all = Math.max(1, ours + fleet + host);
  const reach = content ? plunderReach(all, defenders, host + fleet > 0) : 1;
  state.pending = { t: 'plunder', plunder: { place, round: 0, alarm, taken: 0, captives: 0, burned: false, log: lines, next, reach, share: ours / all, fleetShare: fleet / all, fleetTaken: 0 } };
}

export function plunderAction(state: GameState, content: ContentBundle, rng: RngCursor, what: PlunderWhat): void {
  const pend = state.pending;
  if (pend?.t !== 'plunder') throw new Error('not plundering');
  const p = pend.plunder;
  const ps = state.places[p.place]!;
  const name = p.strand ? p.strand.label : content.places[p.place]?.name ?? p.place;
  p.round += 1;
  switch (what) {
    case 'grab': {
      // an unnamed place on the shore has its own wealth, not the port's (src/engine/strand.ts)
      const src = p.strand ?? ps;
      // the shore's own farms are stripped whole; a place, as far as his men can reach, and in a host his crews' part
      const reach = p.strand ? 1 : p.reach ?? 1;
      const share = p.strand ? 1 : p.share ?? 1;
      const stripped = Math.max(1, Math.round(src.wealth * (GRAB_RATE.base + GRAB_RATE.spread * rng.float()) * reach));
      const take = Math.max(1, Math.round(stripped * share));
      src.wealth -= stripped;
      p.taken += take;
      if (!p.strand && p.fleetShare) p.fleetTaken = (p.fleetTaken ?? 0) + stripped * p.fleetShare;
      p.alarm += NOISE.grab[0] + rng.float() * (NOISE.grab[1] - NOISE.grab[0]);
      const things = ['altar plate and a silver-bound book', 'a reliquary and two candlesticks', 'cloth, wax and a chest of coin', 'the abbot\'s cup and a gilded cross', 'hacksilver from a hole under a floor'];
      p.log.push(share < 1
        ? `The host goes through the streets house by house. Your crews' part of this street: ${things[rng.int(things.length)]}. ${formatSilver(take)}.`
        : `You strip the next house${reach < 0.6 ? ' you can reach before the place wakes' : ''}: ${things[rng.int(things.length)]}. ${formatSilver(take)}.`);
      const ring = plunderRing(state, rng, src.wealth + take);
      if (ring) p.log.push(ring);
      break;
    }
    case 'captives': {
      const n = Math.round((CAPTIVES.min + rng.int(CAPTIVES.spread)) * captivePop(content, p));
      p.captives += n;
      p.alarm += NOISE.captives;
      p.log.push(`${plural(n, 'person', 'people')} roped at the neck and walked down to the ships. One of them is praying the whole way.`);
      break;
    }
    case 'hostage': {
      // once a raid: the round spent asking, and searching, and dragging someone out from behind an altar
      p.searched = true;
      p.alarm += HOSTAGE.alarm;
      const h = findHostage(state, content, rng, p.place);
      if (h) {
        p.hostage = h.id;
        p.log.push(`You find ${h.who}. You know what they are worth by the way the others try to hide them.`);
      } else p.log.push('You turn the place over for anyone worth a ransom, and find only the poor, who are worth what the poor are worth.');
      break;
    }
    case 'arms': {
      p.armed = true;
      p.alarm += NOISE.arms;
      // the Franks keep swords and mail; a monastery's dead have none (but the abbot's hall may)
      const rich = ['frankish', 'frisian', 'english'].includes(content.places[p.place]?.people ?? '') ? 1.3 : 0.8;
      const roll = rng.float();
      let acc = 0;
      const find = ARMS.find((a) => (acc += a.p * rich) > roll);
      if (find && content.items[find.id]) {
        giveItem(state, content, find.id);
        p.log.push(`You go through the dead and the hall for war-gear, and come out with ${find.line}. It's yours, not the heap's.`);
        journal(state, `Took ${content.items[find.id]!.name.toLowerCase()} at ${name}.`);
      } else p.log.push('You go through the dead and the hall for war-gear, and find spears, a broken shield and a sword with half a blade. Nothing worth carrying.');
      break;
    }
    case 'stores': {
      p.stores = true;
      p.alarm += NOISE.stores;
      const list = STORES[content.places[p.place]?.people ?? ''] ?? STORES_ANY;
      const s = list[rng.int(list.length)]!;
      const lots = STORES_TAKE.lots + rng.int(STORES_TAKE.spread);
      // and the bread, the cheese and the dried fish: food for the voyage home
      const days = STORES_TAKE.foodDays[0] + rng.int(STORES_TAKE.foodDays[1] - STORES_TAKE.foodDays[0] + 1);
      state.provisions += Math.round(mouths(state) * days);
      p.log.push(`You break open the stores: ${s.what}. ${stowGoods(state, content, s.good, lots)} And bread, cheese and dried fish from the kitchens: food for ${days} days.`);
      break;
    }
    case 'burn': {
      p.burned = true;
      p.alarm += NOISE.burn;
      p.log.push('You put fire to the thatch. The smoke will be seen for a day\'s ride in every direction.');
      break;
    }
    case 'leave':
      finish(state, content, rng, p, false);
      return;
  }
  if (p.alarm >= ALARM_MAX) finish(state, content, rng, p, true);
}

function finish(state: GameState, content: ContentBundle, rng: RngCursor, p: PlunderState, caught: boolean): void {
  const ps = state.places[p.place]!;
  const pl = content.places[p.place]!;
  const t = p.strand;
  const where = t ? `${t.label} near ${pl.name}` : pl.name;
  const lines: string[] = [];
  let taken = p.taken;
  if (caught) {
    const dropped = Math.round(taken * (0.2 + 0.2 * rng.float()));
    const lost = 1 + rng.int(4);
    taken -= dropped;
    state.crew.men = Math.max(0, state.crew.men - lost);
    lines.push(`The countryside comes down on you before you are done: men with spears from every farm for a day's walk. You run for the ships, dropping ${formatSilver(dropped)} on the way, and ${plural(lost, 'man', 'men')} ${lost === 1 ? 'does' : 'do'} not reach them.`);
  } else if (state.service) lines.push(`${state.service.captain}'s horn sounds from the strand, and you walk down to the ships with the rest, under the weight of it.`);
  else lines.push('You call the men off while the going is good, and walk down to the ships under the weight of it.');
  if (t) {
    // the shore: the coast's alarm and the port's memory, and the cattle driven down to the boats
    strandRaided(state, content, t);
    const food = Math.round(mouths(state) * t.food);
    if (food > 0) { state.provisions += food; lines.push(`You drive the cattle down to the boats and carry off the stores: food for ${t.food} days.`); }
  } else {
    ps.raided += 1;
    onRaided(state, content, p.place, { burned: p.burned, captives: p.captives > 0 });
    ps.lastRaided = state.day;
    ps.defence = Math.min(3, ps.defence * (p.burned ? 1.8 : 1.5));
    if (p.burned) ps.wealth = Math.round(ps.wealth * 0.5);
  }
  // his fleet's crews take their own, and he takes a leader's share of it (docs/FRAME-FLEETS-REALMS.md, Part C)
  const fl = state.service ? { extra: 0, line: null } : ownFleetPlunder(state, p.fleetTaken ?? 0);
  // the leader's share is his own: it goes in his purse, not the crew's heap
  if (fl.line) { state.silver += fl.extra; earn(state, fl.extra); journal(state, `Took a leader's share from the fleet: ${formatSilver(fl.extra)}.`); lines.push(fl.line); }
  const left = stow(state, content, taken);
  if (left) {
    taken -= left;
    lines.push(`The ships are full. You leave ${formatSilver(left)} on the strand, and the men who carried it there look back at it all the way out of the bay.`);
  }
  state.stats.plunder += taken;
  state.stats.raids += 1;
  if (p.captives) state.captives += p.captives;
  const mult = POSITION_FAME[state.position];
  addDeed(state, content, { type: 'raid', text: t ? `Harried ${where}${p.burned ? ' and burned it' : ''}` : `Raided ${pl.name}${p.burned ? ' and burned it' : ''}`, weight: t ? STRAND_DEED : undefined, witnesses: state.crew.men, mult: mult * (p.burned ? 1.2 : 1) * (state.service ? SERVICE_DEED : 1) });
  lines.push(`In all: ${formatSilver(taken)}${p.captives ? `, and ${plural(p.captives, 'captive')}` : ''}.`);
  journal(state, `${t ? 'Harried' : 'Raided'} ${where}: ${formatSilver(taken)}${p.captives ? `, ${plural(p.captives, 'captive')}` : ''}${p.burned ? '; burned it' : ''}.`);
  if (!state.service && !t) brokePeace(state, p.place, content);
  if (p.hostage) {
    lines.push(`And ${hostageWho(state, p.hostage)}, under guard in the ship.`);
    state.queue.push({ scene: 'hs_taken', day: state.day });
  }
  const burnt = `${p.place}_burning`;
  state.pending = { t: 'report', title: `Leaving ${t ? t.label : pl.name}`, lines, next: p.next, art: t ? 'open_sea' : p.burned && content.art[burnt] ? burnt : pl.art };
}

function hostageWho(state: GameState, id: string): string {
  return hostagesOf(state).find((h) => h.id === id)?.who ?? 'a hostage';
}
