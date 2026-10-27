// The glue between the game state and the two combat layers: starting a fight
// from the state, and writing its result back (wounds, deaths, deeds, plunder).
import { mournMan } from './crewman';
import { strandRaided } from './strand';
import { skaldRout, skaldSees } from './skald';
import { stow } from './fleet';
import { coastMult } from './hardship';
import { sackedBy } from './chronicle';
import { raidedFriend } from './lords';
import { partner, partnerInFight } from './allies';
import { HOST, startHost } from './host';
import type { BattleTerrain, ContentBundle, Foe, Resolve } from '../content/schema';
import type { BattleState, DuelSide, DuelState, GameState } from './state';
import { RngCursor, seedRng } from './rng';
import { startWall, WALL } from './wall';
import { fighterGuile, startBout } from './bout';
import { livingFame } from './fame';
import { dateOf } from './calendar';
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
import { BATTLE, DUEL, ORTUG_PER_MARK, POSITION_FAME } from './tuning';


/** What a crew's victory is worth to an oarsman in it: the captain's deed, mostly. */
export const SERVICE_DEED = 0.5;

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
  const d = heroDuel(state, content, foeId, kind, lethal, fightRng(state, `duel:${foeId}`));
  d.win = win;
  d.lose = lose;
  state.pending = { t: 'duel', duel: d };
}

/** The duel he would fight, set up and opened: one code path for the fight and for the men's reckoning of it. */
export function heroDuel(state: GameState, content: ContentBundle, foeId: string, kind: DuelState['kind'], lethal: boolean, rng: RngCursor): DuelState {
  const f = content.fighters[foeId];
  if (!f) throw new Error(`unknown fighter ${foeId}`);
  const readChance = 0.04 * (effAttr(state, content, 'wit') + state.hero.skills.cunning);
  const d = makeDuel(kind, lethal, foeId, heroDuelSide(state, content, kind), sideFromFighter(f, kind), readChance);
  d.log.push(kind === 'holmgang'
    ? `The cloak is pegged out on the turf. Three shields each. ${f.name} spits on his palms.`
    : `${f.name} comes at you.`);
  // every single combat is fought in the second form (docs/FRAME-COMBAT-2.md)
  startBout(d, { readScore: fightEye(state, content), guile: fighterGuile(f), adviser: adviser(state), unyielding: f.unyielding }, rng);
  return d;
}

/** A fight's own chance, from the save: the same fight on the same day opens the same way after a reload. */
export function fightRngFor(state: GameState, tag: string): RngCursor { return fightRng(state, tag); }
function fightRng(state: GameState, tag: string): RngCursor {
  let h = 2166136261;
  const key = `${tag}:${state.day}:${state.stats.battles}:${state.stats.duels}`;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return new RngCursor(seedRng((state.seed ^ h) >>> 0));
}

/** His eye for a fight (docs/FRAME-COMBAT-2.md, revision 2): wits, cunning, and the fights he has lived through. */
export function fightEye(state: GameState, content: ContentBundle): number {
  // while an old hand stands at his shoulder, he lends his eye as well as his voice: the first fights are gentler
  return effAttr(state, content, 'wit') + state.hero.skills.cunning + Math.min(3, Math.floor((state.stats.battles + state.stats.duels) / 4)) + (adviser(state) ? OLD_HAND_EYE : 0);
}
const OLD_HAND_EYE = 2;

/** While he is new to fighting, an old hand shouts advice: a bench-mate, a sworn man, or the captain. */
export function adviser(state: GameState): string | null {
  if (state.stats.battles + state.stats.duels >= WALL.adviceUntil) return null;
  return state.men.find((m) => m.alive && !(m.hurtUntil && m.hurtUntil > state.day))?.name ?? state.service?.captain ?? 'An old hand';
}

/** Renown brings harder enemies (docs/FRAME-COMBAT-2.md, revision 3): from 832, a man whose name is known is more
 *  often met by picked men, who come ready for him: better armed, harder to read, and readier to die. Not while he
 *  pulls another man's oar: nobody comes looking for an oarsman. */
export const RENOWN = {
  from: 832,
  /** Living fame at or above each mark, and the chance a fight is against veterans. */
  tiers: [[40, 0.2], [90, 0.35], [160, 0.5]] as [number, number][],
};
const STEADIER: Record<Resolve, Resolve> = { levy: 'warriors', warriors: 'hird', hird: 'hird' };

export function veteranChance(state: GameState): number {
  if (state.service || dateOf(state.day).year < RENOWN.from) return 0;
  const f = livingFame(state);
  return RENOWN.tiers.reduce((c, [at, p]) => (f >= at ? p : c), 0);
}

function veterans(state: GameState, foe: Foe, rng: RngCursor, picked?: boolean): Foe | null {
  const r = rng.float();
  if (!(picked ?? r < veteranChance(state))) return null;
  const resolve = foe.resolve ?? (foe.quality < 1 ? 'levy' : foe.quality >= 2 ? 'hird' : 'warriors');
  return { ...foe, quality: Math.min(3, foe.quality + 1), guile: Math.min(3, (foe.guile ?? 0) + 1), resolve: STEADIER[resolve] };
}

export function finishDuel(state: GameState, content: ContentBundle, rng: RngCursor, d: DuelState): void {
  const foe = content.fighters[d.foeId]!;
  const lines: string[] = [];
  state.stats.duels += 1;
  state.hero.hp = Math.max(0, d.hero.hp);
  // a fight to first blood leaves scars, not cripples
  for (const h of d.hero.hits) if (h >= 5) addWound(state, content, woundFor(rng, d.lethal && h >= 7), `the fight with ${foe.name}`, rng);
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
        kill(state, 'duel', d.kind === 'holmgang' ? `${state.hero.name} was killed on the holmgang cloak by ${foe.name}, with the whole district watching.` : `${state.hero.name} was killed by ${foe.name}.`);
        return;
      }
      state.hero.hp = 1;
      addWound(state, content, woundFor(rng, d.lethal), `the fight with ${foe.name}`, rng);
      state.honour = Math.max(-10, state.honour - 1);
      lines.push(`${foe.name} beat you. You live, which is more than he meant.`);
      next = d.lose;
      break;
    }
    case 'parted':
      state.hero.hp = Math.max(1, state.hero.hp);
      lines.push('Neither of you won. It will be talked about anyway.');
      next = d.parted ?? d.win;
      break;
  }
  for (const l of [lw, ls]) if (l) lines.push(l);
  journal(state, lines[0] ?? 'A fight.');
  state.pending = { t: 'report', title: d.kind === 'holmgang' ? 'The holmgang' : 'The fight', lines, next };
}

// ---- battle ----

/** A crew's mood in camp colours how it stands in the wall; it does not decide it. Camp morale 0..10 becomes
 *  battle morale BATTLE.moraleBase .. moraleBase + 10 * moraleScale (4..8), against a foe's 6 + quality.
 *  (Playtest, 2026-10-15: battle morale was camp morale; a crew at 2 or less was broken before a blow was struck,
 *  a sullen crew broke at the first bad round, and each loss cost more morale. The author lost every fight.) */
export function battleMorale(campMorale: number): number {
  return BATTLE.moraleBase + BATTLE.moraleScale * Math.max(0, Math.min(10, campMorale));
}

export function startBattle(
  state: GameState,
  content: ContentBundle,
  opts: { foe: string; men: number; terrain: BattleTerrain; context: BattleState['context']; place: string | null; win?: string; lose?: string; noAlly?: boolean; /** Picked men or not, as the scouts saw. */ picked?: boolean },
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
    us: { name: state.service ? `${state.service.captain}'s men` : 'Your men', men: ours, start: ours, quality: state.crew.quality + (state.service ? 0 : state.crew.gear * GEAR_QUALITY + (opts.context === 'sea' && hasFitting(state.ships[0], 'shield_rack') ? FITTING.rackQuality : 0)), morale: battleMorale(state.crew.morale), doctrine: {}, last: null },
    them: { name: foe.name, men: opts.men, start: opts.men, quality: foe.quality, morale: 6 + foe.quality - (!state.service && hasFitting(state.ships[0], 'carved_prow') ? FITTING.prowMorale : 0), doctrine: foe.doctrine, last: null },
    position: state.position,
    round: 0,
    log: [...(ally.line ? [ally.line] : []), `${foe.name}: about ${opts.men} of them. ${state.service ? `${state.service.captain} has ${ours}` : `You have ${ours}`}.`, ...(!state.service && state.crew.morale <= 3 ? ['Your men are sullen and slow to lock shields. They will stand, but they will not stand long if this goes badly.'] : [])],
    heroDown: false,
    heroHp: Math.max(1, Math.round(state.hero.hp)),
    heroHpMax: hpMax(state, content),
    heroArmour: heroArmour(state, content),
    heroSkill: { weapons: state.hero.skills.weapons, shield: state.hero.skills.shield + shieldBonus(state, content), command: state.hero.skills.command, leads: !state.service },
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
  // renown: picked men, ready for him
  const rng = fightRng(state, `battle:${foe.id}`);
  const vet = veterans(state, foe, rng, opts.picked);
  if (vet) {
    b.them.quality = vet.quality;
    b.them.morale += 1;
    b.log.push(`Word of you has gone ahead of you. These are picked men, and they know whose ship it is.`);
  }
  // every battle is fought in the second form (docs/FRAME-COMBAT-2.md)
  startWall(b, !state.service, rng, { readScore: fightEye(state, content), adviser: adviser(state), foe: vet ?? foe, placed: state.placedOn === state.day });
  delete state.placedOn;
  state.pending = { t: 'battle', battle: b };
}

export function finishBattle(state: GameState, content: ContentBundle, rng: RngCursor, b: BattleState): void {
  const lines: string[] = [];
  state.stats.battles += 1;
  const won = b.over === 'won';
  if (won) state.stats.battlesWon += 1;
  if (won && b.position === 'front' && !b.heroDown) state.stats.frontWins += 1;

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
      mournMan(state, content, m);
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
  state.crew.morale += won ? BATTLE.wonMorale : b.over === 'lost' ? -BATTLE.lostMorale : -0.5;
  // a skald aboard is in the rout with everyone else (playtest 8)
  if (b.over === 'lost') { const l = skaldRout(state, () => rng.float()); if (l) lines.push(l); }
  state.crew.morale -= namedLost.length * 0.5;
  for (const m of aliveMen(state)) addLoyalty(m, won ? 1 : 0);

  // the hero
  state.hero.hp = Math.max(0, b.heroHp);
  for (const h of b.heroHits) if (h >= 5) addWound(state, content, woundFor(rng, h >= 7), b.place ? `the fight at ${content.places[b.place]?.name ?? b.place}` : 'a fight at sea', rng);
  if (b.heroDown) {
    // a man cut down in a wall that holds is carried out by his own; one left on a field his men ran from is not
    if (rng.float() < (won ? BATTLE.downDeathWon : BATTLE.downDeathLost)) {
      kill(state, 'battle', `${state.hero.name} fell${b.place ? ' at ' + (content.places[b.place]?.name ?? b.place) : ' in a fight at sea'}, in the ${b.position === 'front' ? 'front rank' : 'shield-wall'}.`);
      return;
    }
    state.hero.hp = 1;
    addWound(state, content, woundFor(rng, true), 'being carried out of the wall', rng);
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
  const atWhere = b.place ? ` at ${where}` : ' at sea';
  // "the Ulster levy", not "The Ulster levy", in the middle of a sentence
  const foeName = (content.foes[b.foeId]?.name ?? 'them').replace(/^The /, 'the ');
  // at another man's oar the crew's victory is the captain's: he was there (docs/FRAME-BEGINNINGS.md)
  const crewMult = mult * (state.service ? SERVICE_DEED : 1);
  if (won && b.context === 'sea') addDeed(state, content, { type: 'sea_fight_won', text: `Beat ${foeName === 'them' ? 'a crew' : foeName} at sea`, witnesses, mult: crewMult });
  if (won && b.context === 'scene') addDeed(state, content, { type: 'battle_won', text: `Beat ${foeName}${b.place ? atWhere : ''}`, witnesses, mult: crewMult });
  // a skald who saw the fight wants to make it a verse while the blood is wet: once a summer (playtest 8)
  if (won && skaldSees(state) && (state.flags._sk_verse ?? 0) < dateOf(state.day).year) { state.flags._sk_verse = dateOf(state.day).year; state.queue.push({ scene: 'sk_verse', day: state.day }); }
  for (const d of b.deeds) {
    if (d.who) {
      const m = state.men.find((x) => x.id === d.who);
      if (m) m.deeds += 1;
      addDeed(state, content, { type: 'man_deed', text: `${d.text}${atWhere}`, witnesses });
    } else addDeed(state, content, { type: d.type, text: `${d.text}${atWhere}`, witnesses });
  }

  // the shore between the ports (src/engine/strand.ts): its own plunder, its own wealth
  if (b.context === 'raid' && b.strand) {
    const t = b.strand;
    const name = t.label.charAt(0).toUpperCase() + t.label.slice(1);
    if (won) {
      lines.unshift(`${name} is yours for the afternoon.`);
      clampMorale(state);
      startPlunder(state, t.anchor, lines, b.win, content);
      if (state.pending?.t === 'plunder') state.pending.plunder.strand = { ...t };
      return;
    }
    strandRaided(state, content, t);
    lines.unshift(`${name} held. You get back to the boats with your wounded and nothing else.`);
    journal(state, `Beaten off at ${t.label} near ${content.places[t.anchor]?.name ?? t.anchor}.`);
    clampMorale(state);
    state.pending = { t: 'report', title: 'Beaten off', lines };
    return;
  }
  // plunder: a raid you command goes on to the plunder rounds; in another man's ship, he divides it
  if (b.context === 'raid' && b.place && won && !state.service) {
    const pl = content.places[b.place]!;
    lines.unshift(`${pl.name} is yours for the afternoon.`);
    clampMorale(state);
    startPlunder(state, b.place, lines, b.win, content);
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
    if (won) ps.wonOn = state.day;
    // under a lord's peace (docs/FRAME-WORLD.md §C)
    lines.push(...raidedFriend(state, content, b.place));
    const left = stow(state, content, take);
    state.stats.plunder += take - left;
    if (left) lines.push(`The ships are full: ${formatSilver(left)} stays on the strand.`);
    if (won) {
      state.stats.raids += 1;
      addDeed(state, content, { type: 'raid', text: `Raided ${pl.name}`, witnesses, mult: crewMult });
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

export const SCOUTED_SURPRISE = 0.25;
/** Scouting (docs/FRAME-WORLD.md §A): how long what the scouts saw holds; what a failed look costs. */
export const SCOUT = { freshDays: 7, warned: 0.2, warnDefence: 0.25, lostMan: 0.25, asleep: 0.45 } as const;

/** What his scouts saw at a place, if they looked within the last week. */
export function freshScout(state: GameState, placeId: string): NonNullable<import('./state').PlaceState['scout']> | null {
  const s = state.places[placeId]?.scout;
  return s && state.day - s.day <= SCOUT.freshDays ? s : null;
}

/** The chance a raid catches them asleep: the dawn, his cunning and wits, and what the scouts saw (or let them see). */
export function surpriseChance(state: GameState, content: ContentBundle, placeId: string): number {
  const sc = freshScout(state, placeId);
  // a place he has scouted (its arrival scene: the walls counted, the feast-day learned; or his own men, this week)
  const scouted = state.flags[`${placeId}_scouted`] || sc?.ok ? SCOUTED_SURPRISE : 0;
  const warned = sc && !sc.ok ? SCOUT.warned : 0;
  return Math.min(0.95, Math.max(0.05, 0.3 + scouted - warned + 0.05 * state.hero.skills.cunning + 0.03 * effAttr(state, content, 'wit')));
}

/** The defenders a raid meets: the place's men, how warned it is, how alarmed its coast, whether they are asleep. */
export function raidMen(state: GameState, content: ContentBundle, placeId: string, asleep: boolean, roll: number): number {
  const p = content.places[placeId]!;
  const ps = state.places[placeId]!;
  return Math.max(3, Math.round(p.raid!.defenders * ps.defence * coastMult(state, content, placeId) * (asleep ? SCOUT.asleep : 1) * (0.85 + 0.3 * roll)));
}

/** A raid on a place: the approach decides how many of the defenders are awake. */
export function startRaid(state: GameState, content: ContentBundle, rng: RngCursor, placeId: string): void {
  const p = content.places[placeId];
  const ps = state.places[placeId];
  if (!p?.raid || !ps) throw new Error(`${placeId} cannot be raided`);
  const sc = freshScout(state, placeId);
  const surprise = rng.float() < surpriseChance(state, content, placeId);
  // what the scouts counted is what he meets (one roll, shown and used)
  const roll = sc?.ok && sc.roll !== undefined ? sc.roll : rng.float();
  const men = raidMen(state, content, placeId, surprise, roll);
  delete ps.scout;
  learn(state, 'cunning', 2);
  state.seasonRaids.push(placeId);
  // a big place, and a partner beside him: the raid is fought as a host, his men in the centre, the partner's on the flank
  const pid = partner(state, content);
  if (pid && men >= HOST.raidAt && !state.service) {
    const pf = partnerInFight(state, content, ((state.day * 37 + state.stats.battles * 11) % 100) / 100);
    const flankMen = Math.round(men * 0.4);
    startHost(state, content, { title: `The assault on ${p.name}`, foe: p.raid.foe, terrain: p.raid.terrain, context: 'raid', place: placeId, foeMen: men - flankMen, wings: [{ name: `${content.captains[pid]!.name}'s men`, men: pf.men, foe_men: flankMen }] });
    if (pf.line && state.pending?.t === 'battle') state.pending.battle.log.push(pf.line);
  } else startBattle(state, content, { foe: p.raid.foe, men, terrain: p.raid.terrain, context: 'raid', place: placeId, picked: sc?.ok ? sc.picked : undefined });
  if (state.pending?.t === 'battle') {
    state.pending.battle.log.unshift(surprise ? 'You come in with the dawn and most of them are still asleep.' : 'They saw your sails. They are waiting.');
    const by = sackedBy(state, content, placeId);
    if (by) state.pending.battle.log.unshift(`${by} You can see where.`);
  }
}

/** A name for the oarsman who takes a fallen sworn man's bench: one nobody aboard already answers to. */
export function benchHeir(state: GameState, content: ContentBundle): string {
  const taken = new Set([...state.men.map((m) => m.name), ...Object.values(state.standIns ?? {}), state.hero.name.split(' ')[0]]);
  const free = content.names.filter((n) => !taken.has(n));
  return free[(state.day * 7 + state.men.length * 13) % Math.max(1, free.length)] ?? 'Grim';
}
