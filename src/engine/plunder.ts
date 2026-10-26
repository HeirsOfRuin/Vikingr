// Plunder against the alarm (DESIGN §11.3, step 3). After the assault, each round takes more,
// and the countryside wakes. Leave in time, or lose what you are carrying getting back to the ships.
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

export type PlunderWhat = 'grab' | 'captives' | 'burn' | 'hostage' | 'arms' | 'stores' | 'leave';
export const ALARM_MAX = 10;

export function startPlunder(state: GameState, place: string, lines: string[], next?: string, content?: ContentBundle): void {
  if (!state.seasonRaids.includes(place)) state.seasonRaids.push(place);
  // a region that has learned comes to the alarm faster (docs/FRAME-HARDSHIP.md)
  const alarm = 2 + (content ? coastPlunderStart(state, content, place) : 0);
  state.pending = { t: 'plunder', plunder: { place, round: 0, alarm, taken: 0, captives: 0, burned: false, log: lines, next } };
}

export function plunderAction(state: GameState, content: ContentBundle, rng: RngCursor, what: PlunderWhat): void {
  const pend = state.pending;
  if (pend?.t !== 'plunder') throw new Error('not plundering');
  const p = pend.plunder;
  const ps = state.places[p.place]!;
  const name = content.places[p.place]?.name ?? p.place;
  p.round += 1;
  switch (what) {
    case 'grab': {
      const take = Math.max(1, Math.round(ps.wealth * (0.14 + 0.12 * rng.float())));
      ps.wealth -= take;
      p.taken += take;
      p.alarm += 1.5 + rng.float() * 1.5;
      const things = ['altar plate and a silver-bound book', 'a reliquary and two candlesticks', 'cloth, wax and a chest of coin', 'the abbot\'s cup and a gilded cross', 'hacksilver from a hole under a floor'];
      p.log.push(`You strip the next house: ${things[rng.int(things.length)]}. ${formatSilver(take)}.`);
      const ring = plunderRing(state, rng, ps.wealth + take);
      if (ring) p.log.push(ring);
      break;
    }
    case 'captives': {
      const n = 2 + rng.int(4);
      p.captives += n;
      p.alarm += 2;
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
      p.alarm += 1.5;
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
      p.alarm += 1.5;
      const list = STORES[content.places[p.place]?.people ?? ''] ?? STORES_ANY;
      const s = list[rng.int(list.length)]!;
      const lots = 2 + rng.int(3);
      p.log.push(`You break open the stores: ${s.what}. ${stowGoods(state, content, s.good, lots)}`);
      break;
    }
    case 'burn': {
      p.burned = true;
      p.alarm += 1;
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
  const lines: string[] = [];
  let taken = p.taken;
  if (caught) {
    const dropped = Math.round(taken * (0.2 + 0.2 * rng.float()));
    const lost = 1 + rng.int(4);
    taken -= dropped;
    state.crew.men = Math.max(0, state.crew.men - lost);
    lines.push(`The countryside comes down on you before you are done: men with spears from every farm for a day's walk. You run for the ships, dropping ${formatSilver(dropped)} on the way, and ${plural(lost, 'man', 'men')} do not reach them.`);
  } else if (state.service) lines.push(`${state.service.captain}'s horn sounds from the strand, and you walk down to the ships with the rest, under the weight of it.`);
  else lines.push('You call the men off while the going is good, and walk down to the ships under the weight of it.');
  ps.raided += 1;
  onRaided(state, content, p.place, { burned: p.burned, captives: p.captives > 0 });
  ps.lastRaided = state.day;
  ps.defence = Math.min(3, ps.defence * (p.burned ? 1.8 : 1.5));
  if (p.burned) ps.wealth = Math.round(ps.wealth * 0.5);
  const left = stow(state, content, taken);
  if (left) {
    taken -= left;
    lines.push(`The ships are full. You leave ${formatSilver(left)} on the strand, and the men who carried it there look back at it all the way out of the bay.`);
  }
  state.stats.plunder += taken;
  state.stats.raids += 1;
  if (p.captives) state.captives += p.captives;
  const mult = POSITION_FAME[state.position];
  addDeed(state, content, { type: 'raid', text: `Raided ${pl.name}${p.burned ? ' and burned it' : ''}`, witnesses: state.crew.men, mult: mult * (p.burned ? 1.2 : 1) * (state.service ? SERVICE_DEED : 1) });
  lines.push(`In all: ${formatSilver(taken)}${p.captives ? `, and ${plural(p.captives, 'captive')}` : ''}.`);
  journal(state, `Raided ${pl.name}: ${formatSilver(taken)}${p.captives ? `, ${plural(p.captives, 'captive')}` : ''}${p.burned ? '; burned it' : ''}.`);
  if (!state.service) brokePeace(state, p.place, content);
  if (p.hostage) {
    lines.push(`And ${hostageWho(state, p.hostage)}, under guard in the ship.`);
    state.queue.push({ scene: 'hs_taken', day: state.day });
  }
  const burnt = `${p.place}_burning`;
  state.pending = { t: 'report', title: `Leaving ${pl.name}`, lines, next: p.next, art: p.burned && content.art[burnt] ? burnt : pl.art };
}

function hostageWho(state: GameState, id: string): string {
  return hostagesOf(state).find((h) => h.id === id)?.who ?? 'a hostage';
}
