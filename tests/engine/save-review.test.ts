// Josh's save, 2026-11-08 (Ragnavald Hallsson, 834): Ketill drowned with Gull and was "buried on a headland";
// the Danish fleet lay seven weeks in a Norwegian fjord; Cú Mara's death was told twice; small slips in the journal.
import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions } from '../../src/engine/index';
import { dayOf } from '../../src/engine/calendar';
import { joinFleet, withFleet } from '../../src/engine/sailfleet';
import { scatter } from '../../src/engine/fleet';
import { addDeed } from '../../src/engine/fame';
import { renderText } from '../../src/engine/text';
import { lowerFirst } from '../../src/engine/format';
import { RngCursor, seedRng } from '../../src/engine/rng';
import type { GameState } from '../../src/engine/state';

function captain(): GameState {
  const s = sandboxGame(34);
  s.at = 'home_fjord';
  s.day = dayOf(834, 95);
  s.phase = 'sailing';
  for (const p of ['ribe', 'dorestad', 'walcheren', 'hedeby']) if (!s.known.includes(p)) s.known.push(p);
  return s;
}

describe('joining a fleet that gathers somewhere else', () => {
  it('the Danish fleet gathers at Ribe, and he sails to join it', () => {
    let s = captain();
    joinFleet(s, content, 'danes834');
    expect(s.fleet?.camp).toBe('ribe');
    expect(s.fleet?.joining).toBe(true);
    expect(withFleet(s)).toBe(false);
    const opts = listActions(s, content);
    expect(opts[0]!.label).toMatch(/Sail to join the Danish fleet at Ribe/);
    for (let i = 0; i < 60 && s.at !== 'ribe'; i++) {
      const o = listActions(s, content);
      s = act(content, s, (o.find((x) => x.action.t === 'fleet_follow' && x.enabled) ?? o.find((x) => x.enabled)!).action);
    }
    expect(s.at).toBe('ribe');
    expect(s.fleet?.joining).toBeFalsy();
    expect(s.fleet?.posture).toBe('lying');
    expect(withFleet(s)).toBe(true);
  });

  it('turning back before he has reached it is not desertion', () => {
    let s = captain();
    joinFleet(s, content, 'danes834');
    const h = s.honour;
    const leave = listActions(s, content).find((o) => o.action.t === 'fleet_leave')!;
    expect(leave.label).toMatch(/Think better of joining/);
    s = act(content, s, leave.action);
    expect(s.fleet).toBeFalsy();
    expect(s.honour).toBe(h);
  });
});

describe('a man the sea kept', () => {
  it('a ship lost in a storm drowns her master, and his mourning has no grave in it', () => {
    let lost: GameState | null = null;
    for (let seed = 1; seed < 2000 && !lost; seed++) {
      const s = captain();
      s.ships.push({ id: 'gull', type: 'karvi', name: 'Gull', hull: 40, master: 'man:ketill' } as GameState['ships'][number]);
      const n = s.ships.length;
      scatter(s, content, new RngCursor(seedRng(seed)), []);
      if (s.ships.length < n) lost = s;
    }
    expect(lost).not.toBeNull();
    const ketill = lost!.men.find((m) => m.id === 'ketill')!;
    expect(ketill.alive).toBe(false);
    expect(ketill.drowned).toBe(true);
    const text = renderText(content.scenes.mourn_ketill!.text, lost!, content);
    expect(text).toMatch(/nothing to bury/);
    expect(text).not.toMatch(/You bury Ketill/);
  });

  it('the storm spares sound hulls under a good seaman more often than old ones under a poor one', () => {
    const losses = (hull: number, sea: number) => {
      let n = 0;
      for (let seed = 1; seed <= 3000; seed++) {
        const s = captain();
        s.hero.skills.seamanship = sea;
        s.ships.push({ id: 'gull', type: 'karvi', name: 'Gull', hull } as GameState['ships'][number]);
        scatter(s, content, new RngCursor(seedRng(seed)), []);
        if (s.ships.length === 1) n++;
      }
      return n;
    };
    expect(losses(100, 10)).toBeLessThan(losses(30, 2));
  });
});

describe('the saga tells a fight once', () => {
  it("a challenger's own scene replaces the duel's plain deed", () => {
    const s = captain();
    const before = s.deeds.length;
    addDeed(s, content, { type: 'killed_champion', text: 'Killed Cú Mara in single combat', witnesses: 10 });
    addDeed(s, content, { type: 'killed_champion', text: 'Killed Cú Mara, the Hound of the Sea, before the hosts', weight: 6, witnesses: 400 });
    expect(s.deeds.length).toBe(before + 1);
    expect(s.deeds.at(-1)!.text).toMatch(/before the hosts/);
    expect(s.deeds.at(-1)!.witnesses).toBe(400);
  });
});

describe('names in the middle of a sentence', () => {
  it('keeps the capital on a man\'s name and drops it on an article', () => {
    expect(lowerFirst("Ubbi's ring")).toBe("Ubbi's ring");
    expect(lowerFirst("Máel Brigte's sword")).toBe("Máel Brigte's sword");
    expect(lowerFirst('A Frankish sword')).toBe('a Frankish sword');
    expect(lowerFirst("Your father's axe")).toBe("your father's axe");
    expect(lowerFirst('The Danish fleet')).toBe('the Danish fleet');
  });
});

// Josh's second save, 2026-11-08 (Ragnavald, autumn 836): the year 835 never happened; Grey Goose and The Frisian sailed
// with dead masters; two knarrs called The Frisian.
import { startWinter } from '../../src/engine/season';
import { addShip, deadMasters } from '../../src/engine/fleet';

describe('the second save', () => {
  it('home after 1 November, the winter starts that day, not a year later', () => {
    const s = captain();
    s.day = dayOf(834, 331); // 28 November 834
    startWinter(s, 3);
    expect(s.day).toBe(dayOf(834, 331));
    expect(s.flags._winter).toBe(834);
    const t = captain();
    t.day = dayOf(834, 280); // home in October: the winter starts on 1 November
    startWinter(t, 3);
    expect(t.day).toBe(dayOf(834, 304));
  });

  it("a dead master's ship gets a hired steersman, and he is told", () => {
    const s = captain();
    s.ships.push({ id: 'goose', type: 'snekkja', name: 'Grey Goose', hull: 100, master: 'man:ketill' } as GameState['ships'][number]);
    s.men.find((m) => m.id === 'ketill')!.alive = false;
    const lines = deadMasters(s, content);
    expect(lines[0]).toMatch(/Ketill is dead, and Grey Goose needs a man at her steering-oar/);
    expect(s.ships[1]!.master).toMatch(/^hired:/);
    expect(deadMasters(s, content)).toEqual([]);
  });

  it('no two ships share a name', () => {
    const s = captain();
    const a = addShip(s, content, { type: 'knarr', name: 'The Frisian', hull: 55 });
    const b = addShip(s, content, { type: 'knarr', name: 'The Frisian', hull: 55 });
    expect(a.name).toBe('The Frisian');
    expect(b.name).toBe('The other Frisian');
  });
});
