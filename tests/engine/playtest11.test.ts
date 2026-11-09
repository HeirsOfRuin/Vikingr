import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions } from '../../src/engine/index';
import type { GameState } from '../../src/engine/state';
import { dayOf } from '../../src/engine/calendar';
import { pastChronicle } from '../../src/engine/chronicle';
import { fortRisk, holdingAt, holdingsYear, holdingYield, LAND, WARDEN } from '../../src/engine/land';
import { addShip } from '../../src/engine/fleet';
import { aliveMen } from '../../src/engine/crew';
import { onRaided, tierAt } from '../../src/engine/standing';
import { springRumours } from '../../src/engine/rumours';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { yearEnd } from '../../src/engine/season';

// Josh, 2026-11-09 (save of spring 839): a warden for a ship-fort; a button for home; spring rumours; his own fort
// turned hostile over raids next door.
const never = { float: () => 0.999, int: () => 0, pickWeighted: <T,>(xs: T[]) => xs[0] } as unknown as RngCursor;
const always = { float: () => 0, int: () => 0, pickWeighted: <T,>(xs: T[]) => xs[0] } as unknown as RngCursor;

function withFort(seed: number): GameState {
  let s = sandboxGame(seed);
  s.phase = 'sailing'; s.at = 'bangor'; s.day = dayOf(839, 120); s.fedTo = s.day;
  s.flags.fr_833_done = 1;
  s.chron = pastChronicle(s, content);
  s.crew.men = 80; s.provisions = 3000;
  for (let i = 0; i < 8; i++) s.deeds.push({ n: i + 1, type: 'deed', day: s.day, place: null, text: 'x', weight: 8, witnesses: 50, told: s.day, verse: false });
  s.places.bangor!.wonOn = s.day;
  s = act(content, s, { t: 'dig_fort' });
  s = act(content, s, { t: 'continue' });
  addShip(s, content, { type: 'karvi', name: 'Sea-Thief', hull: 90 });
  return s;
}
const opt = (s: GameState, t: string) => listActions(s, content).filter((o) => o.action.t === t);

describe('a warden for a ship-fort', () => {
  it('leaves a ship and her master, with her crew, and he is out of the crew while he holds it', () => {
    let s = withFort(1);
    const sworn = aliveMen(s).find((m) => m.sworn) ?? aliveMen(s)[0]!;
    const ship = s.ships[s.ships.length - 1]!;
    ship.master = `man:${sworn.id}`;
    const g0 = holdingAt(s, 'bangor')!.garrison!;
    const risk0 = fortRisk(s, content, holdingAt(s, 'bangor')!);
    const o = opt(s, 'ward_fort').find((x) => (x.action as { ship: string }).ship === ship.id)!;
    expect(o.label).toMatch(/Leave Sea-Thief and .* to hold the fort/);
    s = act(content, s, o.action);
    const h = holdingAt(s, 'bangor')!;
    expect(h.warden?.ship.name).toBe('Sea-Thief');
    expect(s.ships.some((x) => x.name === 'Sea-Thief')).toBe(false);
    expect(h.garrison).toBe(g0 + content.ships.karvi!.crew!);
    expect(fortRisk(s, content, h)).toBeLessThan(risk0);
    expect(aliveMen(s).some((m) => m.id === sworn.id)).toBe(false);
    expect(s.men.find((m) => m.id === sworn.id)!.alive).toBe(true);
  });

  it('takes in men every spring, keeps a third of a growing yield, and gives the ship back with her name', () => {
    let s = withFort(2);
    const ship = s.ships[s.ships.length - 1]!;
    s = act(content, s, { t: 'ward_fort', ship: ship.id });
    s = act(content, s, { t: 'continue' });
    const h = holdingAt(s, 'bangor')!;
    const g = h.garrison!;
    const silver = s.silver;
    const lines = holdingsYear(s, content, never, 'man').join(' ');
    expect(lines).toMatch(/held through the winter under/);
    expect(h.garrison).toBe(g - WARDEN.winterLoss + WARDEN.recruits);
    const y = LAND.fort.yield + WARDEN.grow;
    expect(holdingYield(h)).toBe(y);
    expect(s.silver - silver).toBe(y - Math.round(y * WARDEN.share));
    s = act(content, s, { t: 'unward_fort' });
    expect(s.ships[s.ships.length - 1]!.name).toBe('Sea-Thief');
    expect(holdingAt(s, 'bangor')!.warden).toBeUndefined();
  });

  it('a sworn warden who has stopped loving his lord may keep the fort for himself', () => {
    let s = withFort(3);
    const m = aliveMen(s)[0]!;
    const ship = s.ships[s.ships.length - 1]!;
    ship.master = `man:${m.id}`;
    s = act(content, s, { t: 'ward_fort', ship: ship.id });
    s.men.find((x) => x.id === m.id)!.loyalty = 1;
    expect(holdingsYear(s, content, always, 'man').join(' ')).toMatch(/taken the high seat there for his own/);
    expect(holdingAt(s, 'bangor')).toBeUndefined();
  });

  it('a fort lost in the winter takes its warden and his ship with it', () => {
    let s = withFort(4);
    const ship = s.ships[s.ships.length - 1]!;
    s = act(content, s, { t: 'ward_fort', ship: ship.id });
    // a hired master walks under WARDEN.hiredTurn; at 0.1 he stays, and the fort (risk 0.6 with nobody in it) falls
    const roll = { float: () => 0.1, int: () => 0, pickWeighted: <T,>(xs: T[]) => xs[0] } as unknown as RngCursor;
    holdingAt(s, 'bangor')!.garrison = 0;
    expect(holdingsYear(s, content, roll, 'man').join(' ')).toMatch(/came back for the fort[\s\S]*was burned on the shore/);
  });
});

describe('his own land is never hostile to him', () => {
  it('raids next door do not turn the people of his fort against him', () => {
    const s = withFort(5);
    for (let i = 0; i < 4; i++) onRaided(s, content, 'conaille', { burned: true, captives: true });
    expect(tierAt(s, content, 'bangor')).toBe('friendly');
  });
});

describe('a button for home', () => {
  it('sets a course home from any port with a road there, and warns when the summer is ending', () => {
    const s = withFort(6);
    const home = listActions(s, content).find((o) => o.action.t === 'course' && /Sail for home/.test(o.label))!;
    expect(home).toBeTruthy();
    expect((home.action as { to: string }).to).toBe('home_fjord');
    expect(listActions(s, content).filter((o) => o.action.t === 'course' && (o.action as { to: string }).to === 'home_fjord').length).toBe(1);
    s.day = dayOf(839, 250);
    expect(listActions(s, content).find((o) => /Sail for home/.test(o.label))!.hint).toMatch(/sea closes on 1 November/);
  });
});

describe('spring rumours', () => {
  it('tell of the annals still to come this year, the legends who will be out, and a fort at risk', () => {
    const s = withFort(7);
    s.day = dayOf(839, 90);
    holdingAt(s, 'bangor')!.garrison = 5;
    const r = springRumours(s, content).join(' ');
    expect(r).toMatch(/Lough Neagh/);
    expect(r).toMatch(/Turgeis's men will be out again/);
    expect(r).toMatch(/At Bangor, the people round the fort/);
  });

  it('are told at the turn of the year and kept for the Saga tab', () => {
    const s = withFort(8);
    s.day = dayOf(839, 320); s.at = 'home_fjord'; s.phase = 'winter'; s.flags._winter = 839;
    const lines = yearEnd(s, content, new RngCursor(seedRng(8))).join(' ');
    expect(s.rumours?.year).toBe(840);
    expect(s.rumours!.lines.join(' ')).toMatch(/emperor Louis is failing/);
    expect(lines).toMatch(/What the beaches are saying about this summer/);
  });
});
