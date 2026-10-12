// Effect ops from content (DESIGN §17). Each op mutates the state copy the engine is working on.
import type { ContentBundle, Effect } from '../content/schema';
import type { GameState } from './state';
import type { RngCursor } from './rng';
import { addDeed } from './fame';
import { addWound, heal } from './hero';
import { addLoyalty, addRecruits, capacity, clampMorale, newMan } from './crew';
import { startDuel, startBattle } from './fights';
import { startVoyage } from './voyage';
import { startPlunder } from './plunder';
import { test } from './conditions';
import { journal } from './journal';
import { onRaided, shiftPeople, shiftStanding, spread } from './standing';

function addTo(state: GameState, path: string, n: number): void {
  switch (path) {
    case 'silver': state.silver = Math.max(0, state.silver + n); return;
    case 'loot': state.loot = Math.max(0, state.loot + n); return;
    case 'honour': state.honour = Math.max(-10, Math.min(10, state.honour + n)); return;
    case 'hamingja': state.hamingja = Math.max(-5, Math.min(5, state.hamingja + n)); return;
    case 'provisions': state.provisions = Math.max(0, state.provisions + n); return;
    case 'crew.men': state.crew.men = Math.max(0, state.crew.men + n); return;
    case 'crew.morale': state.crew.morale += n; clampMorale(state); return;
  }
  const [ns, a, b] = path.split('.');
  if (ns === 'flag') state.flags[a!] = (state.flags[a!] ?? 0) + n;
  else if (ns === 'skill') state.hero.skills[a as keyof GameState['hero']['skills']] = Math.max(0, Math.min(10, state.hero.skills[a as keyof GameState['hero']['skills']] + n));
  else if (ns === 'attr') state.hero.attrs[a as keyof GameState['hero']['attrs']] = Math.max(1, Math.min(6, state.hero.attrs[a as keyof GameState['hero']['attrs']] + n));
  else if (ns === 'man' && b === 'loyalty') {
    const m = state.men.find((x) => x.id === a);
    if (m) addLoyalty(m, n);
  } else throw new Error(`cannot add to ${path}`);
}

export function applyEffects(state: GameState, content: ContentBundle, rng: RngCursor, effects: Effect[] | undefined): void {
  for (const e of effects ?? []) {
    if ('if' in e) {
      applyEffects(state, content, rng, test(e.if, state, content) ? e.then : e.else);
      continue;
    }
    if ('set' in e) state.flags[e.set.replace(/^flag\./, '')] = 1;
    else if ('clear' in e) delete state.flags[e.clear.replace(/^flag\./, '')];
    else if ('add' in e) for (const [k, v] of Object.entries(e.add)) addTo(state, k, v);
    else if ('deed' in e) addDeed(state, content, { ...e.deed, witnesses: e.deed.witnesses ?? state.crew.men });
    else if ('injury' in e) addWound(state, content, e.injury, 'what happened');
    else if ('man' in e) {
      const m = state.men.find((x) => x.id === e.man.id);
      if (e.man.join && !m) {
        state.men.push(newMan(content, e.man.id));
        journal(state, `${content.men[e.man.id]!.name} gave you his oath.`);
      } else if (m && e.man.leave) {
        state.men = state.men.filter((x) => x !== m);
        journal(state, `${m.name} left your service.`);
      }
      if (m && e.man.loyalty) addLoyalty(m, e.man.loyalty);
      if (m && e.man.swear && !m.sworn && m.alive) {
        m.sworn = true;
        journal(state, `${m.name} swore his oath to you.`);
      }
      if (m && e.man.nickname) {
        m.nickname = e.man.nickname;
        journal(state, `${m.name} is called ${e.man.nickname} now.`);
      }
    } else if ('fight' in e) startDuel(state, content, e.fight.foe, e.fight.kind, e.fight.lethal, e.fight.win, e.fight.lose);
    else if ('battle' in e) {
      const { raid, parted, ...b } = e.battle;
      startBattle(state, content, { ...b, context: raid ? 'raid' : state.voyage ? 'sea' : 'scene', place: state.at });
      if (parted && state.pending?.t === 'battle') state.pending.battle.parted = parted;
      if (raid && state.at && !state.seasonRaids.includes(state.at)) state.seasonRaids.push(state.at);
    }
    else if ('queue' in e) state.queue.push({ scene: e.queue.scene, day: state.day + e.queue.days });
    else if ('know' in e) { if (!state.known.includes(e.know)) state.known.push(e.know); }
    else if ('journal' in e) journal(state, e.journal);
    else if ('days' in e) { state.day += e.days; heal(state, content, e.days); }
    else if ('nickname' in e) {
      state.hero.nickname = e.nickname;
      journal(state, `Men call you ${e.nickname} now.`);
    } else if ('boast' in e) {
      const def = content.boasts[e.boast]!;
      if (!state.boasts.some((b) => b.id === e.boast)) state.boasts.push({ id: e.boast, sworn: state.day, due: state.day + def.days, state: 'open' });
      journal(state, `You swore over the cup: ${def.text}`);
    } else if ('keep_boast' in e) {
      const b = state.boasts.find((x) => x.id === e.keep_boast && x.state === 'open');
      if (b) {
        b.state = 'kept';
        addDeed(state, content, { type: 'boast_kept', text: `Kept his boast: ${content.boasts[b.id]!.text}`, witnesses: state.crew.men });
      }
    } else if ('command' in e) {
      if (state.service) {
        journal(state, `You took command of ${state.ships[0]?.name ?? 'the ship'}.`);
        state.service = null;
      }
    } else if ('route' in e) {
      if (state.service) state.service.route = [...e.route];
    } else if ('voyage' in e) {
      if (state.at && state.at !== e.voyage) startVoyage(state, content, e.voyage, true);
    } else if ('captives' in e) state.captives = Math.max(0, state.captives + e.captives);
    else if ('shares' in e) { if (state.service) state.service.shares = e.shares; }
    else if ('plunder' in e) { if (state.at) startPlunder(state, state.at, [], e.plunder.next); }
    else if ('position' in e) state.position = e.position;
    else if ('sell_captives' in e) {
      // a market price, straight into the heap
      if (state.captives > 0) {
        state.loot += state.captives * e.sell_captives;
        journal(state, `Sold ${state.captives} captives at the market.`);
        state.captives = 0;
      }
    } else if ('recruit' in e) {
      // men who sign on away from home: as many as the ship has benches for
      if (!state.service) {
        const room = Math.max(0, capacity(state, content) - state.crew.men - state.men.filter((m) => m.alive).length);
        const n = Math.min(room, e.recruit);
        if (n > 0) { addRecruits(state, n); journal(state, `${n} men signed on.`); }
      }
    } else if ('spread' in e) {
      spread(state, content, e.spread.from, e.spread.n, !!e.spread.church);
    } else if ('raided' in e) {
      const { place, ...how } = e.raided;
      onRaided(state, content, place, how);
    } else if ('standing' in e) {
      if (e.standing.place) shiftStanding(state, content, e.standing.place, e.standing.n);
      if (e.standing.people) shiftPeople(state, content, e.standing.people, e.standing.n, e.standing.place);
    } else if ('captain' in e) { if (state.service) state.service.captain = e.captain; }
    else if ('ship' in e) {
      // a ship of his own, in place of the bench in another man's: the old crew stays with the old ship
      state.ships = [{ id: `ship${state.day}`, type: e.ship.type, name: e.ship.name, hull: 80 }];
      state.crew.men = e.ship.crew;
      state.service = null;
      journal(state, `Took ${e.ship.name} for his own.`);
    }
  }
  void rng;
}
