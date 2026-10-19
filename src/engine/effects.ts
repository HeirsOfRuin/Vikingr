// Effect ops from content (DESIGN §17). Each op mutates the state copy the engine is working on.
import { effAttr } from './hero';
import { addRings } from './rings';
import { burn, give, loseShip, recoverHoard, robHoard, shiftEnvy } from './hardship';
import { dateOf } from './calendar';
import { SAILING_DOY } from './tuning';
import { candidateToCrew, swearCandidate } from './hird';
import { hostageOp, hostagesOf, makeHostage } from './hostages';
import { bestAlly, killCaptain, meet, partner, partnerInFight, shiftFavour, shiftRel, swearFelag } from './allies';
import { startHost } from './host';
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
import { answerCall, lordState, shiftLordFav, swear } from './lords';
import { grantLand } from './land';
import { loseSeat, takeSeat } from './rule';

function addTo(state: GameState, content: ContentBundle, path: string, n: number): void {
  switch (path) {
    case 'silver': state.silver = Math.max(0, state.silver + n); return;
    case 'loot': if (n > 0) stow(state, content, n); else state.loot = Math.max(0, state.loot + n); return;
    // tribute paid in weighed silver (the Seine, 845): it goes on the heap without filling the holds
    case 'geld': state.loot += Math.max(0, n); return;
    case 'honour': state.honour = Math.max(-10, Math.min(10, state.honour + n)); return;
    case 'hamingja': state.hamingja = Math.max(-5, Math.min(5, state.hamingja + n)); return;
    case 'provisions': state.provisions = Math.max(0, state.provisions + n); return;
    case 'crew.men': state.crew.men = Math.max(0, state.crew.men + n); return;
    case 'crew.morale': state.crew.morale += n; clampMorale(state); return;
    case 'muster': state.musterPool = Math.max(0, state.musterPool + n); return;
    case 'hoard': state.base.hoard = Math.max(0, state.base.hoard + n); return;
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
    } else if ('fight' in e) {
      startDuel(state, content, e.fight.foe, e.fight.kind, e.fight.lethal, e.fight.win, e.fight.lose);
      if (e.fight.parted && state.pending?.t === 'duel') state.pending.duel.parted = e.fight.parted;
    } else if ('battle' in e) {
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
    else if ('plunder' in e) { if (state.at) startPlunder(state, state.at, [], e.plunder.next, content); }
    else if ('position' in e) { state.position = e.position; state.placedOn = state.day; }
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
      // one wife, and every other courtship ends with the wedding (playtest 5: the others' scenes kept coming)
      const promised = !!state.flags.ingibjorg_promised || !!state.flags.ingibjorg_waiting;
      for (const f of ['betrothed', 'gyda_courting', 'ingibjorg_promised', 'ingibjorg_waiting', 'ingibjorg_betrothed', 'thorunn_betrothed', 'asta_betrothed']) delete state.flags[f];
      if (promised && !e.wife.startsWith('Ingibj')) {
        state.flags.ingibjorg_jilted = 1;
        if (state.places.orkney) state.places.orkney.standing = Math.max(-10, (state.places.orkney.standing ?? 0) - 2);
        journal(state, `Word reaches Orkney that you have married ${e.wife}. Ingibjörg was promised. Harek will not forget it.`);
      }
    } else if ('base' in e) {
      if (BASE_LEVELS.indexOf(e.base) > BASE_LEVELS.indexOf(state.base.level)) state.base.level = e.base;
    } else if ('prize' in e) {
      // one prize a year (the author, 2026-10-14): a free ship is a rare thing
      if (!state.service && state.ships.length < FLEET_MAX && state.flags._prize !== dateOf(state.day).year) {
        state.flags._prize = dateOf(state.day).year;
        const sh = addShip(state, content, { type: e.prize.type, name: e.prize.name, hull: PRIZE_HULL });
        journal(state, `Took ${sh.name} as a prize.`);
      }
    } else if ('swear_cand' in e) swearCandidate(state, content, e.swear_cand);
    else if ('cand_crew' in e) candidateToCrew(state);
    else if ('take_hostage' in e) {
      const t = e.take_hostage;
      const h = makeHostage(state, content, rng, t.kind, t.place ?? state.at ?? state.voyage?.to ?? 'home_fjord', t.captain);
      // a named hostage the story knows (Forannán of Armagh): the scene says who, and what he is worth
      if (t.name) h.name = t.name;
      if (t.who) h.who = t.who.replace(/\{name\}/g, h.name);
      if (t.kin) h.kin = t.kin;
      if (t.price) h.price = t.price;
      hostagesOf(state).push(h);
      state.hfocus = h.id;
      if (h.captain) shiftRel(state, content, h.captain, -3);
      journal(state, `Took ${h.who} as a hostage.`);
    } else if ('hostage' in e) hostageOp(state, content, rng, e.hostage);
    else if ('longphort' in e) {
      const ps = state.places[e.longphort]!;
      ps.norse = true;
      ps.standing = Math.max(ps.standing ?? 0, 6);
      journal(state, `A Norse ship-fort holds ${content.places[e.longphort]!.name} now.`);
    } else if ('longphort_lost' in e) {
      const ps = state.places[e.longphort_lost]!;
      ps.norse = false;
      ps.standing = Math.min(ps.standing ?? 0, -4);
      journal(state, `The ship-fort at ${content.places[e.longphort_lost]!.name} is burned.`);
    }
    else if ('master' in e) {
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
    } else if ('host' in e) {
      const h = e.host;
      // a wing marked ally is the summer's félag partner, if he comes (he may hang back, or there may be none)
      const wings = h.wings.map((w) => {
        if (!w.ally) return { name: w.name, men: w.men ?? 0, quality: w.quality, foe_men: w.foe_men };
        const pid = partner(state, content);
        const pf = partnerInFight(state, content, ((state.day * 37 + state.stats.battles * 11) % 100) / 100);
        return { name: pid ? `${content.captains[pid]!.name}'s men` : w.name, men: pf.men, quality: 1, foe_men: w.foe_men };
      });
      startHost(state, content, { title: h.title, foe: h.foe, terrain: h.terrain, context: h.raid ? 'raid' : 'scene', place: h.raid ? state.at : null, foeMen: h.men, wings, role: h.role, reserve: h.reserve, win: h.win, lose: h.lose });
    } else if ('favour' in e) {
      shiftFavour(state, e.favour);
    } else if ('lord' in e) {
      const l = e.lord;
      if (l.meet || l.swear || l.call || l.fav) lordState(state, l.id).met = true;
      if (l.fav) shiftLordFav(state, l.id, l.fav);
      const before = state.flags.oathbreaker ?? 0;
      if (l.swear) swear(state, content, l.id, l.swear);
      else if (l.call) answerCall(state, content, rng, l.id, l.call === 'answer');
      // found out: the oath-breaker's scene follows whatever this one says
      if ((state.flags.oathbreaker ?? 0) > before) state.queue.push({ scene: 'lo_cast_out', day: state.day });
    } else if ('grant' in e) {
      grantLand(state, content, e.grant);
    } else if ('rule' in e) {
      takeSeat(state, content, e.rule);
    } else if ('lose_rule' in e) {
      loseSeat(state, content, '');
    } else if ('legend' in e) {
      (state.legends ??= {})[e.legend.id] = (state.legends[e.legend.id] ?? 0) + e.legend.fame;
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
    else if ('envy' in e) shiftEnvy(state, e.envy);
    else if ('give' in e) give(state, e.give);
    else if ('lose_hoard' in e) robHoard(state, e.lose_hoard);
    else if ('recover_hoard' in e) recoverHoard(state, e.recover_hoard);
    else if ('fire' in e) burn(state, content, e.fire);
    else if ('lose_ship' in e) loseShip(state, content, e.lose_ship);
    else if ('ring' in e) {
      const n = e.ring.n ?? 1;
      addRings(state, e.ring.metal, n);
      journal(state, n > 0 ? `You have ${n === 1 ? `a ${e.ring.metal} arm-ring` : `${n} ${e.ring.metal} arm-rings`} more.` : `Gave away ${-n === 1 ? `a ${e.ring.metal} arm-ring` : `${-n} ${e.ring.metal} arm-rings`}.`);
    }
    else if ('join_ship' in e) {
      const j = e.join_ship;
      state.service = { captain: j.captain, route: [...(j.route ?? [])], shares: state.service?.shares ?? 1, ...(j.home ? { home: j.home } : {}) };
      state.ships = [{ id: 'service', type: j.type, name: j.ship_name, hull: 90 }];
      state.crew.men = j.crew;
      // his bench-mates in her, who have not sworn to him
      for (const id of j.men ?? []) if (!state.men.some((m) => m.id === id)) state.men.push({ ...newMan(content, id), sworn: false });
      journal(state, `Took a bench in ${j.ship_name}, under ${j.captain}.`);
    }
    else if ('exile_end' in e) {
      // the three winters served: he comes home over the last of the winter, in time for the muster
      state.flags.outlaw_ended = 1;
      state.at = 'home_fjord';
      state.voyage = null;
      // the muster is a spring phase: a return outside spring keeps the season he is in (playtest 5: home on 1 November in muster)
      state.phase = dateOf(state.day).doy < SAILING_DOY + 31 ? 'muster' : 'sailing';
      if (state.service) state.service.home = 'home_fjord';
      journal(state, 'Came home to Hordaland, his three winters served.');
    }
    else if ('jarl_men' in e) {
      // the jarl mans his benches, for a quarter of the summer's heap
      state.flags.jarl_men = dateOf(state.day).year;
    }
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
