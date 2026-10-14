import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions, newGame } from '../../src/engine/index';
import type { GameState } from '../../src/engine/state';
import { applyEffects } from '../../src/engine/effects';
import { addShip, appoint, CARGO_UNIT, hold, masterOf, masterShares, MASTER_SHARES, scatter, stow } from '../../src/engine/fleet';
import { shareOut } from '../../src/engine/season';
import { startPlunder, plunderAction } from '../../src/engine/plunder';
import { open } from '../../src/engine/director';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { dayOf } from '../../src/engine/calendar';

const rng = (n = 1) => new RngCursor(seedRng(n));
const captain = (): GameState => {
  const s = sandboxGame(4);
  s.pending = null;
  s.service = null;
  s.day = dayOf(832, 150);
  s.phase = 'sailing';
  s.at = 'home_fjord';
  s.ships = [{ id: 'flag', type: 'karvi', name: 'Raven', hull: 100 }];
  s.crew.men = 26;
  s.silver = 1000;
  for (const m of s.men) { m.alive = true; m.sworn = true; }
  return s;
};

describe('the fleet', () => {
  it('a second ship comes with a hired steersman, and a scene to choose her master', () => {
    const s = captain();
    addShip(s, content, { type: 'karvi', name: 'Gull', hull: 100 });
    expect(masterOf(s, s.ships[1]!)?.kind).toBe('hired');
    expect(s.queue.some((q) => q.scene === 'fl_master')).toBe(true);
  });

  it('appointing a sworn man raises his loyalty, and moves him off any ship he had', () => {
    const s = captain();
    const id = s.men[0]!.id;
    const before = s.men[0]!.loyalty;
    addShip(s, content, { type: 'karvi', name: 'Gull', hull: 100 });
    addShip(s, content, { type: 'karvi', name: 'Otter', hull: 100 });
    appoint(s, content, s.ships[1]!.id, id);
    expect(s.men[0]!.loyalty).toBe(Math.min(10, before + 2));
    appoint(s, content, s.ships[2]!.id, id);
    expect(masterOf(s, s.ships[1]!)?.kind).toBe('hired');
    expect(masterOf(s, s.ships[2]!)).toMatchObject({ kind: 'sworn', id });
  });

  it('the holds cap what a raid carries home, and scene plunder too', () => {
    const s = captain();
    expect(hold(s, content)).toBe(3 * CARGO_UNIT);
    s.loot = 1400;
    expect(stow(s, content, 300)).toBe(200);
    expect(s.loot).toBe(1500);
    applyEffects(s, content, rng(), [{ add: { loot: 500 } }]);
    expect(s.loot).toBe(1500);
    addShip(s, content, { type: 'knarr', name: 'Belly', hull: 100 });
    expect(hold(s, content)).toBe(13 * CARGO_UNIT);
  });

  it('a raid with full holds leaves silver on the strand', () => {
    const s = captain();
    s.at = 'iona';
    s.loot = 1490;
    startPlunder(s, 'iona', []);
    for (let i = 0; i < 3 && s.pending?.t === 'plunder'; i++) plunderAction(s, content, rng(i + 2), 'grab');
    if (s.pending?.t === 'plunder') plunderAction(s, content, rng(), 'leave');
    expect(s.loot).toBe(1500);
    expect(s.pending?.t === 'report' && s.pending.lines.join(' ')).toMatch(/ships are full/);
  });

  it('shipmasters take their extra shares at the share-out', () => {
    const s = captain();
    addShip(s, content, { type: 'karvi', name: 'Gull', hull: 100 });
    appoint(s, content, s.ships[1]!.id, s.men[0]!.id);
    addShip(s, content, { type: 'karvi', name: 'Otter', hull: 100 });
    expect(masterShares(s).shares).toBe(MASTER_SHARES.sworn + MASTER_SHARES.hired);
    s.loot = 1000;
    s.phase = 'return';
    const lines = shareOut(s, content, 'fair');
    expect(lines.join(' ')).toMatch(/shipmasters take 5 extra shares/);
  });

  it('a prize joins the fleet; a hull can be bought where there is a shipwright', () => {
    let s = captain();
    applyEffects(s, content, rng(), [{ prize: { type: 'knarr', name: 'The Frisian' } }]);
    expect(s.ships.map((x) => x.name)).toContain('The Frisian');
    s.queue = [];
    s = act(content, s, { t: 'shop' });
    const buy = listActions(s, content).find((o) => o.action.t === 'buy_hull' && o.action.type === 'karvi');
    expect(buy?.enabled).toBe(true);
    s = act(content, s, buy!.action);
    expect(s.ships).toHaveLength(3);
    expect(s.silver).toBe(1000 - Math.round(content.ships.karvi!.cost * 0.7));
  });

  it('storms scatter a fleet: a ship comes in late, or goes down with her master', () => {
    let late = 0, lost = 0;
    for (let i = 0; i < 300; i++) {
      const s = captain();
      addShip(s, content, { type: 'karvi', name: 'Gull', hull: 100 });
      appoint(s, content, s.ships[1]!.id, s.men[0]!.id);
      const day = s.day;
      scatter(s, content, rng(i + 10), []);
      if (s.ships.length === 1) { lost++; expect(s.men[0]!.alive).toBe(false); }
      else if (s.day > day) late++;
    }
    expect(late).toBeGreaterThan(50);
    expect(lost).toBeGreaterThan(5);
    expect(lost).toBeLessThan(late);
  });

  it('a hired steersman who is faced down badly sails off with his ship', () => {
    const s = captain();
    addShip(s, content, { type: 'karvi', name: 'Gull', hull: 100 });
    s.queue = [];
    applyEffects(s, content, rng(), [{ desert: true }]);
    expect(s.ships).toHaveLength(1);
    expect(s.crew.men).toBeLessThan(26);
  });

  it('giving a sworn master his ship loses the ship and the man, and wins a deed', () => {
    let s = captain();
    addShip(s, content, { type: 'karvi', name: 'Gull', hull: 100 });
    appoint(s, content, s.ships[1]!.id, s.men[0]!.id);
    s.queue = [];
    s.phase = 'winter';
    open(s, 'fl_ambition');
    const deeds = s.deeds.length;
    s = act(content, s, { t: 'choose', id: 'give' });
    expect(s.ships).toHaveLength(1);
    expect(s.men).toHaveLength(captain().men.length - 1);
    expect(s.deeds.length).toBe(deeds + 1);
  });
});
