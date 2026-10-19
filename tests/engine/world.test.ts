import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions } from '../../src/engine/index';
import type { BattleState, GameState } from '../../src/engine/state';
import { dayOf } from '../../src/engine/calendar';
import { scoutedOdds, scoutChance } from '../../src/engine/scout';
import { SCOUT, surpriseChance } from '../../src/engine/fights';
import { open } from '../../src/engine/director';

// docs/FRAME-WORLD.md: scouting, the chronicle, lords, land abroad, rule.
function atPlace(seed: number, place = 'lindisfarne'): GameState {
  const s = sandboxGame(seed);
  s.phase = 'sailing'; s.at = place; s.day = dayOf(833, 160); s.fedTo = s.day;
  s.crew.men = 40; s.provisions = 2000;
  s.flags.fr_833_done = 1;
  return s;
}
const opt = (s: GameState, t: string) => listActions(s, content).find((o) => o.action.t === t);

describe('A. scouting a force', () => {
  it('is offered where he can raid, once a summer; not at another man\'s oar, nor at a Norse port', () => {
    const s = atPlace(1);
    expect(opt(s, 'scout')?.enabled).toBe(true);
    const t = act(content, s, { t: 'scout' });
    expect(t.places.lindisfarne!.scout).toBeTruthy();
    const back = act(content, t, { t: 'continue' });
    expect(opt(back, 'scout')?.enabled).toBe(false);
    const svc = atPlace(2);
    svc.service = { captain: 'Ásgeir', route: [], shares: 1 };
    expect(opt(svc, 'scout')).toBeUndefined();
    expect(opt(atPlace(3, 'orkney'), 'scout')).toBeUndefined();
  });

  it('shows the numbers the raid will meet, and the raid meets them', () => {
    let checked = 0;
    for (let seed = 1; seed < 40 && checked < 6; seed++) {
      const s = atPlace(seed);
      s.hero.skills.cunning = 8;
      let t = act(content, s, { t: 'scout' });
      const odds = scoutedOdds(t, content, 'lindisfarne');
      if (!odds) continue;
      t = act(content, t, { t: 'continue' });
      expect(opt(t, 'raid')!.hint).toContain(`about ${odds.asleep} if asleep, ${odds.awake} if awake`);
      t = act(content, t, { t: 'raid' });
      const b = (t.pending as { battle: BattleState }).battle;
      expect([odds.asleep, odds.awake]).toContain(b.them.start);
      checked++;
    }
    expect(checked).toBeGreaterThanOrEqual(3);
  });

  it('a failed look warns the place: more men, less chance of catching them asleep', () => {
    let warned = 0;
    for (let seed = 1; seed < 60 && warned < 3; seed++) {
      const s = atPlace(seed, 'york');
      s.hero.skills.cunning = 0;
      const before = surpriseChance(s, content, 'york');
      const d0 = s.places.york!.defence;
      const t = act(content, s, { t: 'scout' });
      if (t.places.york!.scout!.ok) continue;
      expect(t.places.york!.defence).toBeCloseTo(d0 + SCOUT.warnDefence);
      expect(surpriseChance(t, content, 'york')).toBeCloseTo(Math.max(0.05, before - SCOUT.warned));
      warned++;
    }
    expect(warned).toBeGreaterThan(0);
  });

  it('a town is harder to look at than a monastery, and harder still the year after a raid', () => {
    const s = atPlace(4);
    expect(scoutChance(s, content, 'york')).toBeLessThan(scoutChance(s, content, 'lindisfarne'));
    const c0 = scoutChance(s, content, 'lindisfarne');
    s.places.lindisfarne!.lastRaided = s.day - 100;
    expect(scoutChance(s, content, 'lindisfarne')).toBeLessThan(c0);
  });
});

import { hearNews, pastChronicle, tickChronicle } from '../../src/engine/chronicle';
import { castOut, lordFav, LORD, lordDies, lordTenth, raidedFriend, secretYear, swear, swearBlock } from '../../src/engine/lords';
import { standing } from '../../src/engine/standing';
import { buyLand, holdingsYear, LAND } from '../../src/engine/land';
import { claim, claimParts, claimMargin, rivalOf, seatOpen, takeSeat, ruleYear, RULE } from '../../src/engine/rule';
import { legendTable } from '../../src/engine/fame';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { winterHere, yearEnd } from '../../src/engine/season';
import { HALL_ACTIONS } from '../../src/engine/tuning';

const always = { float: () => 0, int: () => 0, pickWeighted: <T,>(xs: T[]) => xs[0] } as unknown as RngCursor;
const never = { float: () => 0.999, int: () => 0, pickWeighted: <T,>(xs: T[]) => xs[0] } as unknown as RngCursor;

describe('B. the chronicle: the world goes on without him', () => {
  it('Dorestad is sacked in 834 whether or not he is there, and the news reaches the ports', () => {
    const s = sandboxGame(11);
    const base = s.places.dorestad!.wealth;
    s.day = dayOf(834, 200);
    tickChronicle(s, content);
    expect(s.places.dorestad!.wealth).toBeLessThan(base * 0.5);
    expect(s.places.dorestad!.sacked?.by).toBe("Horik's Danes");
    expect(s.chron!.news.some((n) => /Dorestad/.test(n.text))).toBe(true);
    expect(hearNews(s).join(' ')).toMatch(/Dorestad/);
  });

  it('if he sailed with the fleet, the chapter did the work: no second sack, no news to hear', () => {
    const s = sandboxGame(12);
    s.flags.fr_dorestad_sworn = 1;
    const base = s.places.dorestad!.wealth;
    s.day = dayOf(834, 200);
    tickChronicle(s, content);
    expect(s.places.dorestad!.wealth).toBe(base);
    expect(s.chron!.news.some((n) => /thirty ships went up the Rhine/i.test(n.text))).toBe(false);
  });

  it('the legends raid by the seed, not by what he does', () => {
    const a = sandboxGame(13), b = sandboxGame(13);
    b.silver = 9999; b.crew.men = 60; b.at = 'kaupang';
    a.day = b.day = dayOf(838, 300);
    tickChronicle(a, content); tickChronicle(b, content);
    for (const id of ['armagh', 'clonmacnoise', 'bangor', 'dorestad', 'walcheren', 'london']) expect(a.places[id]!.wealth).toBe(b.places[id]!.wealth);
    expect(Object.values(a.places).filter((p) => p.sacked).length).toBeGreaterThan(3);
  });

  it('news takes time to travel, and a save from before the chronicle starts with no backlog', () => {
    const s = atPlace(14, 'kaupang');
    s.day = dayOf(835, 160);
    s.chron = pastChronicle(s, content);
    s.day = dayOf(835, 166);
    tickChronicle(s, content);
    expect(hearNews(s)).toEqual([]);
    s.day += 30;
    expect(hearNews(s).length).toBeGreaterThan(0);
    const old = atPlace(15, 'kaupang');
    old.chron = pastChronicle(old, content);
    tickChronicle(old, content);
    expect(hearNews(old, true)).toEqual([]);
  });
});

function lordGame(seed: number): GameState {
  const s = atPlace(seed, 'orkney');
  s.chron = pastChronicle(s, content);
  return s;
}

describe('C. lords: one oath at a time (Josh\'s rule)', () => {
  it('his oath is offered at the lord\'s own hall, once he knows you', () => {
    const s = lordGame(21);
    const o = () => listActions(s, content).find((x) => x.action.t === 'swear');
    expect(o()!.enabled).toBe(false);
    s.lords = { harek: { fav: LORD.swearAt } };
    expect(o()!.enabled).toBe(true);
    const t = act(content, s, { t: 'swear', lord: 'harek', how: 'first' });
    expect(t.oath?.lord).toBe('harek');
    expect(swearBlock(t, content, 'harek')).toMatch(/already/);
  });

  it('an outlaw can swear to Harek, and not to the jarl who outlawed him', () => {
    const s = lordGame(22);
    s.flags.outlawed = 1;
    expect(swearBlock(s, content, 'harek')).toBeNull();
    s.favour = 5;
    expect(swearBlock(s, content, 'jarl')).toMatch(/outlaw/);
  });

  it('a lord takes his tenth, sends men to the muster, and keeps his ports friendly', () => {
    const s = lordGame(23);
    s.lords = { harek: { fav: 6 } };
    swear(s, content, 'harek', 'first');
    expect(lordTenth(s, content, 1000).cut).toBe(100);
    s.places.shetland!.standing = -8;
    expect(standing(s, content, 'shetland')).toBe(LORD.floor);
  });

  it('two oaths found out: honour falls, both cast him out, and their land goes back', () => {
    const s = lordGame(24);
    s.lords = { harek: { fav: 6 }, kolbeinn: { fav: 4 } };
    swear(s, content, 'harek', 'first');
    swear(s, content, 'kolbeinn', 'secret');
    expect(s.oath2?.lord).toBe('kolbeinn');
    s.holdings = [{ place: 'orkney', kind: 'grant', lord: 'harek', since: s.day }];
    const honour = s.honour;
    expect(secretYear(s, content, never)).toEqual([]);
    expect(secretYear(s, content, always).join(' ')).toMatch(/cast you out/);
    expect(s.honour).toBe(Math.max(-10, honour - LORD.castHonour));
    expect(s.oath).toBeUndefined();
    expect(s.oath2).toBeUndefined();
    expect(s.holdings).toEqual([]);
    expect(swearBlock(s, content, 'harek')).toMatch(/cast you out/);
    expect(swearBlock(s, content, 'kolbeinn')).toMatch(/cast you out/);
  });

  it('both lords calling in one summer: answering one brings it out for certain', () => {
    let s = lordGame(25);
    s.lords = { harek: { fav: 6 }, kolbeinn: { fav: 4 } };
    swear(s, content, 'harek', 'first');
    swear(s, content, 'kolbeinn', 'secret');
    s.flags.call_harek = 1; s.flags.call_kolbeinn = 1;
    open(s, 'lo_call_harek', content);
    s = act(content, s, { t: 'choose', id: 'answer' });
    expect(s.flags.oathbreaker).toBe(1);
    expect(s.queue.some((q) => q.scene === 'lo_cast_out')).toBe(true);
  });

  it('a raid on his lord\'s friends costs favour, and below nothing the oath', () => {
    const s = lordGame(26);
    s.lords = { irish_king: { fav: 3 } };
    swear(s, content, 'irish_king', 'first');
    raidedFriend(s, content, 'bangor');
    expect(lordFav(s, 'irish_king')).toBe(4 - LORD.raidFriend);
    raidedFriend(s, content, 'armagh');
    expect(s.oath).toBeUndefined();
  });

  it('Harek dies in a year fixed for each life, between 838 and 846', () => {
    const years = new Set(Array.from({ length: 40 }, (_, i) => lordDies(sandboxGame(100 + i), content, 'harek')));
    for (const y of years) expect(y).toBeGreaterThanOrEqual(838);
    expect(years.size).toBeGreaterThan(3);
  });
});

describe('D. land abroad', () => {
  it('bought land: winter there as at home, and its yield at the turn of the year', () => {
    const s = lordGame(31);
    s.places.orkney!.standing = 4;
    s.silver = 1000;
    expect(listActions(s, content).find((x) => x.action.t === 'buy_land')!.enabled).toBe(true);
    buyLand(s, content, 'orkney');
    s.day = dayOf(835, 280);
    winterHere(s, content, new RngCursor(seedRng(1)));
    expect(s.hallLeft).toBe(HALL_ACTIONS);
    const silver = s.silver;
    expect(holdingsYear(s, content, never, 'orkney').join(' ')).toMatch(/brought in/);
    expect(s.silver).toBe(silver + LAND.bought.yield);
  });

  it('a ship-fort: dug only where he has won, held by its garrison, and taken back when they come', () => {
    let s = atPlace(32, 'bangor');
    s.chron = pastChronicle(s, content);
    s.crew.men = 60;
    for (let i = 0; i < 8; i++) s.deeds.push({ n: i + 1, type: 'deed', day: s.day, place: null, text: 'x', weight: 8, witnesses: 50, told: s.day, verse: false });
    expect(listActions(s, content).find((x) => x.action.t === 'dig_fort')).toBeUndefined();
    s.places.bangor!.wonOn = s.day;
    s = act(content, s, { t: 'dig_fort' });
    expect(s.places.bangor!.norse).toBe(true);
    expect(s.holdings![0]!.garrison).toBe(20);
    expect(s.crew.men).toBe(40);
    expect(holdingsYear(s, content, never, 'home_fjord').join(' ')).toMatch(/held/);
    expect(holdingsYear(s, content, always, 'bangor').join(' ')).toMatch(/held/); // he was there
    expect(holdingsYear(s, content, always, 'home_fjord').join(' ')).toMatch(/came back for the fort/);
    expect(s.places.bangor!.norse).toBe(false);
  });
});

describe('E. rule: jarl or king of a place', () => {
  it('the claim is the sum of its parts, against a rival with a name', () => {
    const s = lordGame(41);
    s.flags.wife_ingibjorg = 1;
    const parts = claimParts(s, content, 'orkney');
    expect(claim(s, content, 'orkney')).toBe(parts.reduce((n, p) => n + p.n, 0));
    expect(parts.some((p) => /daughter/.test(p.label))).toBe(true);
    expect(claimMargin(s, content, 'orkney')).toBe(claim(s, content, 'orkney') - rivalOf(s, content, 'orkney').claim);
    expect(rivalOf(s, content, 'walcheren').legend).toBe('rorik');
  });

  it('Orkney opens at Harek\'s death, to a man with a name and a tie to the islands', () => {
    const s = lordGame(42);
    const dies = lordDies(s, content, 'harek')!;
    s.day = dayOf(dies - 1, 200);
    for (let i = 0; i < 16; i++) s.deeds.push({ n: i + 1, type: "deed", day: s.day, place: null, text: "x", weight: 8, witnesses: 50, told: s.day, verse: false });
    expect(seatOpen(s, content, 'orkney')).toBe(false);
    s.day = dayOf(dies, 100);
    for (const d of s.deeds) d.told = s.day;
    // a stranger, however famous, is not asked: he needs a tie to the islands
    expect(seatOpen(s, content, 'orkney')).toBe(false);
    s.lords = { harek: { fav: 3 } };
    expect(seatOpen(s, content, 'orkney')).toBe(true);
  });

  it('a ruler is named in the legend table, takes tribute, and loses the seat if he is never seen there', () => {
    const s = lordGame(43);
    takeSeat(s, content, 'orkney');
    expect(legendTable(s, content).find((r) => r.hero)!.name).toMatch(/jarl in Orkney/);
    const silver = s.silver;
    ruleYear(s, content, never, 'orkney');
    expect(s.silver).toBe(silver + RULE.tribute);
    s.day = dayOf(dateYear(s) + RULE.absent + 1, 70);
    expect(ruleYear(s, content, never, 'home_fjord').join(' ')).toMatch(/high seat now/);
    expect(s.rule).toBeUndefined();
    expect(seatOpen(s, content, 'orkney')).toBe(false);
  });
});

function dateYear(s: GameState): number { return Math.floor(s.day / 365) + 830; }
void yearEnd; void castOut;
