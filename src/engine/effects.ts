// Effect ops from content (DESIGN §17). Each op mutates the state copy the engine is working on.
import { bestAlly, killCaptain, meet, shiftFavour, shiftRel, swearFelag } from './allies';
import { addShip, appoint, desert, FLEET_MAX, hiredShip, PRIZE_HULL, shipOf, stow, swornShip } from './fleet';
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
import { giveItem, loseItem } from './items';
import { BASE, BASE_LEVELS, keepCaptives } from './base';
import { keepBoast, swearBoast } from './boasts';
import { onRaided, shiftPeople, shiftStanding, spread } from './standing';

function addTo(state: GameState, content: ContentBundle, path: string, n: number): void {
  switch (path) {
    case 'silver': state.silver = Math.max(0, state.silver + n); return;
    case 'loot': if (n > 0) stow(state, content, n); else state.loot = Math.max(0, state.loot + n); return;
    case 'honour': state.honour = Math.max(-10, Math.min(10, state.honour + n)); return;
    case 'hamingja': state.hamingja = Math.max(-5, Math.min(5, state.hamingja + n)); return;
    case 'provisions': state.provisions = Math.max(0, state.provisions + n); return;
    case 'crew.men': state.crew.men = Math.max(0, state.crew.men + n); return;
    case 'crew.morale': state.crew.morale += n; clampMorale(state); return;
    case 'thralls': state.base.thralls = Math.max(0, Math.min(BASE[state.base.level].thralls, state.base.thralls + n)); return;
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
    else if ('add' in e) for (const [k, v] of Object.entries(e.add)) addTo(state, content, k, v);
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
      swearBoast(state, content, e.boast);
    } else if ('keep_boast' in e) {
      const b = state.boasts.find((x) => x.id === e.keep_boast && x.state === 'open');
      if (b) keepBoast(state, content, b);
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
    } else if ('item' in e) {
      giveItem(state, content, e.item.id, !!e.item.equip);
      journal(state, `You have ${content.items[e.item.id]!.name.charAt(0).toLowerCase()}${content.items[e.item.id]!.name.slice(1)}.`);
    } else if ('wife' in e) {
      state.base.wife = e.wife;
    } else if ('base' in e) {
      if (BASE_LEVELS.indexOf(e.base) > BASE_LEVELS.indexOf(state.base.level)) state.base.level = e.base;
    } else if ('prize' in e) {
      if (!state.service && state.ships.length < FLEET_MAX) {
        const sh = addShip(state, content, { type: e.prize.type, name: e.prize.name, hull: PRIZE_HULL });
        journal(state, `Took ${sh.name} as a prize.`);
      }
    } else if ('master' in e) {
      const ship = hiredShip(state) ?? state.ships[state.ships.length - 1];
      if (ship && state.ships.length > 1) appoint(state, content, ship.id, e.master);
    } else if ('ally' in e) {
      const a = e.ally;
      const id = a.id === 'best' ? bestAlly(state, content) : a.id;
      if (id) {
        if (a.meet) meet(state, content, id);
        if (a.rel) shiftRel(state, content, id, a.rel);
        if (a.felag) swearFelag(state, content, id);
        if (a.kill) killCaptain(state, content, id);
      }
    } else if ('favour' in e) {
      shiftFavour(state, e.favour);
    } else if ('lose_cargo' in e) {
      // the heaviest goods go first
      for (let n = e.lose_cargo; n > 0 && state.cargo && Object.keys(state.cargo).length; n--) {
        const g = Object.keys(state.cargo).sort((a, b) => (content.goods[b]?.bulk ?? 0) - (content.goods[a]?.bulk ?? 0))[0]!;
        const c = state.cargo[g]!;
        c.cost -= c.cost / c.lots;
        c.lots -= 1;
        if (c.lots <= 0) delete state.cargo[g];
      }
    } else if ('desert' in e) {
      desert(state, content);
    } else if ('give_ship' in e) {
      const sid = e.give_ship === 'master' ? swornShip(state)?.master?.split(':')[1] ?? '' : e.give_ship;
      const ship = shipOf(state, sid);
      const m = state.men.find((x) => x.id === sid);
      if (ship && m) {
        const cap = content.ships[ship.type]?.crew ?? 0;
        const total = capacity(state, content);
        state.crew.men = Math.max(0, state.crew.men - Math.round((state.crew.men * cap) / Math.max(1, total)));
        state.ships.splice(state.ships.indexOf(ship), 1);
        state.men = state.men.filter((x) => x !== m);
        journal(state, `Gave ${ship.name} to ${m.name}, and he sailed her away as his own.`);
      }
    } else if ('keep_captives' in e) {
      keepCaptives(state);
    } else if ('lose_item' in e) {
      loseItem(state, e.lose_item);
    } else if ('progress' in e) {
      // fair-wind days gained (or lost) on the voyage under way
      if (state.voyage) state.voyage.progress = Math.max(0, state.voyage.progress + e.progress);
    } else if ('spread' in e) {
      spread(state, content, e.spread.from, e.spread.n, !!e.spread.church);
    } else if ('raided' in e) {
      const { place, ...how } = e.raided;
      onRaided(state, content, place, how);
    } else if ('standing' in e) {
      // neither place nor people: the place he is in now
      const here = !e.standing.place && !e.standing.people ? state.at : null;
      if (here) shiftStanding(state, content, here, e.standing.n);
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
