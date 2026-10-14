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

export type PlunderWhat = 'grab' | 'captives' | 'burn' | 'leave';
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
  const burnt = `${p.place}_burning`;
  state.pending = { t: 'report', title: `Leaving ${pl.name}`, lines, next: p.next, art: p.burned && content.art[burnt] ? burnt : pl.art };
}
