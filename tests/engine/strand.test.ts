import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions } from '../../src/engine/index';
import type { GameState } from '../../src/engine/state';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { dayOf } from '../../src/engine/calendar';
import { findStrand, harried, harryBlock, harryCoast, strandRaided, STRAND } from '../../src/engine/strand';
import { plunderAction } from '../../src/engine/plunder';
import { finishBattle } from '../../src/engine/fights';
import { fightOutWall } from '../../src/engine/wall';

const captain = (at = 'lindisfarne'): GameState => {
  const s = sandboxGame(4);
  s.pending = null;
  s.service = null;
  s.voyage = null;
  s.day = dayOf(834, 160);
  s.phase = 'sailing';
  s.at = at;
  if (!s.known.includes(at)) s.known.push(at);
  s.ships = [{ id: 'a', type: 'karvi', name: 'Gull', hull: 100 }];
  s.crew.men = 30;
  s.provisions = 2000;
  return s;
};

describe('harrying the shore between the ports', () => {
  it('a raidable foreign coast can be harried; home and the Norse coasts cannot', () => {
    expect(harryCoast(captain(), content, 'lindisfarne')).toBe('northumbria');
    expect(harryCoast(captain(), content, 'home_fjord')).toBeNull();
    expect(harryCoast(captain(), content, 'kaupang')).toBeNull();
    const s = captain();
    s.service = { captain: 'Ölvir', shares: 1 } as GameState['service'];
    expect(harryBlock(s, content)).toMatch(/captain/);
  });

  it('the harry action finds an unnamed place and a day passes', () => {
    const s = captain();
    const opt = listActions(s, content).find((o) => o.action.t === 'harry');
    expect(opt?.enabled).toBe(true);
    const s2 = act(content, s, { t: 'harry' });
    expect(s2.day).toBe(s.day + STRAND.days);
    expect(s2.pending?.t).toBe('strand');
    const t = (s2.pending as { target: { anchor: string; men: number; foe: string } }).target;
    expect(t.anchor).toBe('lindisfarne');
    expect(content.foes[t.foe]).toBeDefined();
  });

  it('each raid on a coast this year brings out more men and leaves less', () => {
    const s = captain();
    const avg = (n: number) => {
      s.harried = n ? { northumbria: { year: 834, n } } : {};
      let men = 0, wealth = 0;
      for (let i = 0; i < 200; i++) { const t = findStrand(s, content, new RngCursor(seedRng(i)), 'lindisfarne'); men += t.men; wealth += t.wealth; }
      return { men, wealth };
    };
    const quiet = avg(0), roused = avg(5);
    expect(roused.men).toBeGreaterThan(quiet.men * 1.5);
    expect(roused.wealth).toBeLessThan(quiet.wealth * 0.6);
  });

  it('a place taken: its own wealth is plundered, the port is not, the cattle feed the crew, and the coast is warier', () => {
    const s = captain();
    const rng = new RngCursor(seedRng(3));
    const t = { ...findStrand(s, content, rng, 'lindisfarne'), men: 1, wealth: 100 };
    const portWealth = s.places.lindisfarne!.wealth;
    const raided = s.places.lindisfarne!.raided;
    s.pending = { t: 'strand', target: t };
    const s2 = act(content, s, { t: 'strand', what: 'land' });
    expect(s2.pending?.t).toBe('battle');
    const b = (s2.pending as { battle: Parameters<typeof finishBattle>[3] }).battle;
    fightOutWall(b, rng);
    finishBattle(s2, content, rng, b);
    expect(s2.pending?.t).toBe('plunder');
    const food0 = s2.provisions;
    plunderAction(s2, content, rng, 'grab');
    plunderAction(s2, content, rng, 'leave');
    expect(s2.places.lindisfarne!.wealth).toBe(portWealth);
    expect(s2.places.lindisfarne!.raided).toBe(raided);
    expect(s2.provisions).toBeGreaterThan(food0);
    expect(harried(s2, 'northumbria')).toBe(1);
    expect(s2.deeds.at(-1)?.text).toMatch(/^Harried/);
  });

  it('a raid beaten off still rouses the coast', () => {
    const s = captain();
    const t = findStrand(s, content, new RngCursor(seedRng(5)), 'lindisfarne');
    strandRaided(s, content, t);
    strandRaided(s, content, t);
    expect(harried(s, 'northumbria')).toBe(2);
  });
});
