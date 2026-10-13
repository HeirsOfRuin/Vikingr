// The glue between the game state and the two combat layers: starting a fight
// from the state, and writing its result back (wounds, deaths, deeds, plunder).
import { stow } from './fleet';
import { partner, partnerInFight } from './allies';
import { HOST, startHost } from './host';
import type { BattleTerrain, ContentBundle } from '../content/schema';
import type { BattleState, DuelSide, DuelState, GameState } from './state';
import type { RngCursor } from './rng';
import { makeDuel, sideFromFighter } from './duel';
import { effAttr, hpMax, addWound, woundFor, kill, learn } from './hero';
import { addDeed } from './fame';
import { aliveMen, addLoyalty, clampMorale, fitMen } from './crew';
import { banter } from './banter';
import { startPlunder } from './plunder';
import { formatSilver, plural } from './format';
import { journal } from './journal';
import { onRaided } from './standing';
import { creditWeapon, FITTING, GEAR_MAX, GEAR_QUALITY, hasFitting, heroArmour, heroWeapon, shieldBonus } from './items';
import { DUEL, ORTUG_PER_MARK, POSITION_FAME } from './tuning';


export function heroDuelSide(state: GameState, content: ContentBundle, kind: DuelState['kind']): DuelSide {
  const end = effAttr(state, content, 'end');
  return {
    name: state.hero.name,
    hp: Math.max(1, Math.round(state.hero.hp)),
    hpMax: hpMax(state, content),
    stamina: 6 + end,
    staminaMax: 6 + end,
    shields: kind === 'holmgang' ? DUEL.holmgangShields : 1,
    integrity: kind === 'holmgang' ? DUEL.holmgangShieldIntegrity : DUEL.shieldIntegrity,
    str: effAttr(state, content, 'str'),
    agi: effAttr(state, content, 'agi'),
    weapons: state.hero.skills.weapons,
    shield: state.hero.skills.shield + shieldBonus(state, content),
    armour: heroArmour(state, content),
    weapon: heroWeapon(state, content),
    habits: {},
    bled: false,
    hits: [],
  };
}

export function startDuel(state: GameState, content: ContentBundle, foeId: string, kind: DuelState['kind'], lethal: boolean, win?: string, lose?: string): void {
  const f = content.fighters[foeId];
  if (!f) throw new Error(`unknown fighter ${foeId}`);
  const readChance = 0.04 * (effAttr(state, content, 'wit') + state.hero.skills.cunning);
  const d = makeDuel(kind, lethal, foeId, heroDuelSide(state, content, kind), sideFromFighter(f, kind), readChance);
  d.win = win;
  d.lose = lose;
  d.log.push(kind === 'holmgang'
    ? `The cloak is pegged out on the turf. Three shields each. ${f.name} spits on his palms.`
    : `${f.name} comes at you.`);
  state.pending = { t: 'duel', duel: d };
}

export function finishDuel(state: GameState, content: ContentBundle, rng: RngCursor, d: DuelState): void {
  const foe = content.fighters[d.foeId]!;
  const lines: string[] = [];
  state.stats.duels += 1;
  state.hero.hp = Math.max(0, d.hero.hp);
  // a fight to first blood leaves scars, not cripples
  for (const h of d.hero.hits) if (h >= 5) addWound(state, content, woundFor(rng, d.lethal && h >= 7), `the fight with ${foe.name}`);
  const lw = learn(state, 'weapons', 4);
  const ls = learn(state, 'shield', 3);
  let next: string | undefined;
  switch (d.over) {
    case 'won':
    case 'foe_yielded': {
      state.stats.duelsWon += 1;
      const champion = foe.weapons >= 4;
      const type = d.kind === 'holmgang' ? 'holmgang_won' : champion ? 'killed_champion' : 'duel_won';
      const how = d.over === 'foe_yielded' ? 'yielded to you' : d.lethal ? 'died under your blade' : 'went down and stayed down';
      addDeed(state, content, { type, text: `${foe.name} ${how}`, witnesses: d.kind === 'holmgang' ? 40 : 10 });
      if (d.over === 'foe_yielded') {
        state.silver += DUEL.holmlausnMarks * ORTUG_PER_MARK;
        lines.push(`${foe.name} pays the holmlausn: ${formatSilver(DUEL.holmlausnMarks * ORTUG_PER_MARK)}.`);
      }
      lines.push(`${foe.name} ${how}.`);
      state.hero.hp = Math.max(1, state.hero.hp);
      const named = creditWeapon(state, content, rng, champion ? 2 : 1);
      if (named) lines.push(named);
      next = d.win;
      break;
    }
    case 'yielded': {
      const pay = Math.min(state.silver, DUEL.holmlausnMarks * ORTUG_PER_MARK);
      state.silver -= pay;
      state.honour = Math.max(-10, state.honour - 1);
      state.hero.hp = Math.max(1, state.hero.hp);
      lines.push(`You step off the cloak with your blood on it and pay ${formatSilver(pay)}. Men will remember who stepped off.`);
      next = d.lose;
      break;
    }
    case 'lost': {
      if (d.lethal && rng.float() < DUEL.lethalDeathChance) {
        kill(state, d.kind === 'holmgang' ? 'duel' : 'duel', `${state.hero.name} was killed by ${foe.name}.`);
        return;
      }
      state.hero.hp = 1;
      addWound(state, content, woundFor(rng, d.lethal), `the fight with ${foe.name}`);
      state.honour = Math.max(-10, state.honour - 1);
      lines.push(`${foe.name} beat you. You live, which is more than he meant.`);
      next = d.lose;
      break;
    }
    case 'parted':
      state.hero.hp = Math.max(1, state.hero.hp);
      lines.push('Neither of you won. It will be talked about anyway.');
      next = d.win;
      break;
  }
  for (const l of [lw, ls]) if (l) lines.push(l);
  journal(state, lines[0] ?? 'A fight.');
  state.pending = { t: 'report', title: d.kind === 'holmgang' ? 'The holmgang' : 'The fight', lines, next };
}

// ---- battle ----

export function startBattle(
  state: GameState,
  content: ContentBundle,
  opts: { foe: string; men: number; terrain: BattleTerrain; context: BattleState['context']; place: string | null; win?: string; lose?: string; noAlly?: boolean },
): void {
  const foe = content.foes[opts.foe];
  if (!foe) throw new Error(`unknown foe ${opts.foe}`);
  const named = fitMen(state).map((m) => ({ id: m.id, name: m.name, slot: m.slot, weapons: m.weapons, down: false, hurt: false }));
  // a félag partner's men, unless he hangs back (docs/FRAME-TRADE-ALLIES.md)
  const ally = opts.noAlly ? { men: 0, line: null } : partnerInFight(state, content, ((state.day * 37 + state.stats.battles * 11) % 100) / 100);
  const ours = state.crew.men + named.length + ally.men;
  const b: BattleState = {
    foeId: foe.id,
    terrain: opts.terrain,
    // his men's arms, and the ship's fittings, count only in a ship he commands (FRAME-FOUNDATION §2)
    us: { name: state.service ? `${state.service.captain}'s men` : 'Your men', men: ours, start: ours, quality: state.crew.quality + (state.service ? 0 : state.crew.gear * GEAR_QUALITY + (opts.context === 'sea' && hasFitting(state.ships[0], 'shield_rack') ? FITTING.rackQuality : 0)), morale: state.crew.morale, doctrine: {}, last: null },
    them: { name: foe.name, men: opts.men, start: opts.men, quality: foe.quality, morale: 6 + foe.quality - (!state.service && hasFitting(state.ships[0], 'carved_prow') ? FITTING.prowMorale : 0), doctrine: foe.doctrine, last: null },
    position: state.position,
    round: 0,
    log: [...(ally.line ? [ally.line] : []), `${foe.name}: about ${opts.men} of them. ${state.service ? `${state.service.captain} has ${ours}` : `You have ${ours}`}.`],
    heroDown: false,
    heroHp: Math.max(1, Math.round(state.hero.hp)),
    heroHpMax: hpMax(state, content),
    heroArmour: heroArmour(state, content),
    heroHits: [],
    named,
    deeds: [],
    over: null,
    context: opts.context,
    place: opts.place,
    win: opts.win,
    lose: opts.lose,
    killed: 0,
    ...(ally.men ? { allyMen: ally.men } : {}),
    lost: 0,
  };
  state.pending = { t: 'battle', battle: b };
}

export function finishBattle(state: GameState, content: ContentBundle, rng: RngCursor, b: BattleState): void {
  const lines: string[] = [];
  state.stats.battles += 1;
  const won = b.over === 'won';
  if (won) state.stats.battlesWon += 1;

  // the men
  const namedLost = b.named.filter((n) => n.down);
  for (const n of namedLost) {
    const m = state.men.find((x) => x.id === n.id);
    if (m) {
      m.alive = false;
      m.diedOn = state.day;
      lines.push(`${m.name} is dead.`);
      journal(state, `${m.name} fell${b.place ? ' at ' + (content.places[b.place]?.name ?? b.place) : ''}.`);
      const heir = benchHeir(state, content);
      (state.standIns ??= {})[m.id] = heir;
      journal(state, `${heir} took ${m.name}'s bench.`);
      // a death is mourned, if a scene has been written for it
      if (content.scenes[`mourn_${m.id}`]) state.queue.push({ scene: `mourn_${m.id}`, day: state.day + 1 });
    }
  }
  for (const n of b.named.filter((x) => x.hurt && !x.down)) {
    const m = state.men.find((x) => x.id === n.id);
    if (m) {
      m.hurtUntil = state.day + 25 + Math.floor(rng.float() * 20);
      lines.push(`${m.name} is hurt, and will sit out a fight or two.`);
    }
  }
  // a partner's men die in proportion, and they are his to bury
  const ownShare = b.allyMen ? (b.us.start - b.allyMen) / b.us.start : 1;
  const crewLost = Math.max(0, Math.round(b.lost * ownShare) - namedLost.length);
  state.crew.men = Math.max(0, state.crew.men - crewLost);
  lines.push(`You lost ${plural(crewLost, 'man', 'men')}${namedLost.length ? ' and ' + plural(namedLost.length, 'sworn man', 'sworn men') : ''}. They lost ${b.killed}.`);
  if (won) state.crew.quality = Math.min(2.5, state.crew.quality + 0.08);
  // a won field is stripped: helmets and mail off the dead
  if (won && !state.service) state.crew.gear = Math.min(GEAR_MAX, state.crew.gear + 0.05);
  if (won && b.position !== 'rear' && !b.heroDown) {
    const named = creditWeapon(state, content, rng, 1);
    if (named) lines.push(named);
  }
  state.crew.morale += won ? 1 : b.over === 'lost' ? -2 : -0.5;
  state.crew.morale -= namedLost.length * 0.5;
  for (const m of aliveMen(state)) addLoyalty(m, won ? 1 : 0);

  // the hero
  state.hero.hp = Math.max(0, b.heroHp);
  for (const h of b.heroHits) if (h >= 5) addWound(state, content, woundFor(rng, h >= 7), b.place ? `the fight at ${content.places[b.place]?.name ?? b.place}` : 'a fight at sea');
  if (b.heroDown) {
    if (rng.float() < 0.4) {
      kill(state, 'battle', `${state.hero.name} fell${b.place ? ' at ' + (content.places[b.place]?.name ?? b.place) : ' in a fight at sea'}, in the ${b.position === 'front' ? 'front rank' : 'shield-wall'}.`);
      return;
    }
    state.hero.hp = 1;
    addWound(state, content, woundFor(rng, true), 'being carried out of the wall');
    lines.push('You were carried out of the wall. You will live.');
  }
  const lc = learn(state, 'command', 3);
  if (lc) lines.push(lc);
  if (b.position !== 'rear') {
    const l = learn(state, 'shield', 2);
    if (l) lines.push(l);
  }
  // fighting from behind the wall, again and again, is noticed
  state.rearFights = b.position === 'rear' ? state.rearFights + 1 : 0;
  if (state.rearFights >= 3) {
    state.crew.morale -= 1;
    state.honour = Math.max(-10, state.honour - 1);
    lines.push('The men have started saying you lead from behind.');
    state.rearFights = 0;
  }

  // deeds
  const mult = POSITION_FAME[b.position] * (b.heroDown ? 1.2 : 1);
  const witnesses = state.crew.men;
  const where = b.place ? content.places[b.place]?.name ?? b.place : 'at sea';
  if (won && b.context === 'sea') addDeed(state, content, { type: 'sea_fight_won', text: `Beat ${content.foes[b.foeId]?.name ?? 'a crew'} at sea`, witnesses, mult });
  if (won && b.context === 'scene') addDeed(state, content, { type: 'battle_won', text: `Beat ${content.foes[b.foeId]?.name ?? 'them'} ${b.place ? 'at ' + where : ''}`.trim(), witnesses, mult });
  for (const d of b.deeds) {
    if (d.who) {
      const m = state.men.find((x) => x.id === d.who);
      if (m) m.deeds += 1;
      addDeed(state, content, { type: 'man_deed', text: d.text, witnesses });
    } else addDeed(state, content, { type: d.type, text: `${d.text} at ${where}`, witnesses });
  }

  // plunder: a raid you command goes on to the plunder rounds; in another man's ship, he divides it
  if (b.context === 'raid' && b.place && won && !state.service) {
    const pl = content.places[b.place]!;
    lines.unshift(`${pl.name} is yours for the afternoon.`);
    clampMorale(state);
    startPlunder(state, b.place, lines, b.win);
    return;
  }
  if (b.context === 'raid' && b.place) {
    const ps = state.places[b.place]!;
    const pl = content.places[b.place]!;
    const share = won ? 0.35 + 0.25 * rng.float() : b.over === 'parted' ? 0.1 : 0;
    const take = Math.round(ps.wealth * share);
    ps.wealth -= take;
    ps.defence = Math.min(3, ps.defence * 1.5);
    ps.raided += 1;
    ps.lastRaided = state.day;
    onRaided(state, content, b.place, { failed: !won });
    const left = stow(state, content, take);
    state.stats.plunder += take - left;
    if (left) lines.push(`The ships are full: ${formatSilver(left)} stays on the strand.`);
    if (won) {
      state.stats.raids += 1;
      addDeed(state, content, { type: 'raid', text: `Raided ${pl.name}`, witnesses, mult });
      lines.unshift(`${pl.name} is yours for the afternoon. You carry off ${formatSilver(take)} in silver, plate and cloth.`);
      journal(state, `Raided ${pl.name}: ${formatSilver(take)}.`);
    } else if (take) {
      lines.unshift(`You grab what you can, ${formatSilver(take)}, and get back to the ships.`);
    } else {
      lines.unshift(`${pl.name} held. You get back to the ships with nothing.`);
      journal(state, `Beaten off at ${pl.name}.`);
    }
  } else if (won && b.context === 'sea') {
    const take = b.them.start * 3 - stow(state, content, b.them.start * 3);
    state.stats.plunder += take;
    lines.unshift(`Their ship is yours to strip: ${formatSilver(take)} in silver and gear.`);
  } else {
    lines.unshift(won ? 'The field is yours.' : b.over === 'lost' ? 'You are beaten.' : 'Neither side holds the field.');
  }
  const talk = banter(state, content, rng, 'fight', 0.7);
  if (talk) lines.push(talk);
  clampMorale(state);
  const next = won ? b.win : b.over === 'lost' ? b.lose : b.parted ?? b.lose;
  state.pending = { t: 'report', title: won ? 'Victory' : b.over === 'lost' ? 'Defeat' : 'The fight is broken off', lines, next };
}

/** A raid on a place: the approach decides how many of the defenders are awake (Phase 1: one roll). */
export function startRaid(state: GameState, content: ContentBundle, rng: RngCursor, placeId: string): void {
  const p = content.places[placeId];
  const ps = state.places[placeId];
  if (!p?.raid || !ps) throw new Error(`${placeId} cannot be raided`);
  const surprise = rng.float() < 0.3 + 0.05 * state.hero.skills.cunning + 0.03 * effAttr(state, content, 'wit');
  const men = Math.max(3, Math.round(p.raid.defenders * ps.defence * (surprise ? 0.45 : 1) * (0.85 + 0.3 * rng.float())));
  learn(state, 'cunning', 2);
  state.seasonRaids.push(placeId);
  // a big place, and a partner beside him: the raid is fought as a host, his men in the centre, the partner's on the flank
  const pid = partner(state, content);
  if (pid && men >= HOST.raidAt && !state.service) {
    const pf = partnerInFight(state, content, ((state.day * 37 + state.stats.battles * 11) % 100) / 100);
    const flankMen = Math.round(men * 0.4);
    startHost(state, content, { title: `The assault on ${p.name}`, foe: p.raid.foe, terrain: p.raid.terrain, context: 'raid', place: placeId, foeMen: men - flankMen, wings: [{ name: `${content.captains[pid]!.name}'s men`, men: pf.men, foe_men: flankMen }] });
    if (pf.line && state.pending?.t === 'battle') state.pending.battle.log.push(pf.line);
  } else startBattle(state, content, { foe: p.raid.foe, men, terrain: p.raid.terrain, context: 'raid', place: placeId });
  if (state.pending?.t === 'battle') state.pending.battle.log.unshift(surprise ? 'You come in with the dawn and most of them are still asleep.' : 'They saw your sails. They are waiting.');
}

/** A name for the oarsman who takes a fallen sworn man's bench: one nobody aboard already answers to. */
export function benchHeir(state: GameState, content: ContentBundle): string {
  const taken = new Set([...state.men.map((m) => m.name), ...Object.values(state.standIns ?? {}), state.hero.name.split(' ')[0]]);
  const free = content.names.filter((n) => !taken.has(n));
  return free[(state.day * 7 + state.men.length * 13) % Math.max(1, free.length)] ?? 'Grim';
}
