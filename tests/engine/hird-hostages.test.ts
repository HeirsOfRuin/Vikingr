import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions } from '../../src/engine/index';
import type { GameState } from '../../src/engine/state';
import { open } from '../../src/engine/director';
import { dayOf } from '../../src/engine/calendar';
import { applyEffects } from '../../src/engine/effects';
import { HIRD, hirdCount, hirdLeaves, hirdRoom, makeCandidate } from '../../src/engine/hird';
import { brokePeace, HOSTAGE, hostageYear, makeHostage, hostagesOf } from '../../src/engine/hostages';
import { plunderAction, startPlunder } from '../../src/engine/plunder';
import { RngCursor, seedRng } from '../../src/engine/rng';

const sure = { float: () => 0, int: () => 0 } as unknown as RngCursor;
const rng = (n = 1) => new RngCursor(seedRng(n));
const lord = (): GameState => {
  const s = sandboxGame(7);
  delete s.flags.owes_jarl;
  s.pending = null;
  s.service = null;
  s.day = dayOf(836, 150);
  s.phase = 'sailing';
  s.at = 'hedeby';
  s.base.level = 'hall';
  s.rings = { silver: 2, gold: 0 };
  for (const m of s.men) { m.alive = true; m.sworn = true; }
  return s;
};

describe('the hird grows', () => {
  it('makes a man from his origin: a free name, a Dane\'s arms, a line about him', () => {
    const s = lord();
    const m = makeCandidate(s, content, 'dane');
    expect(content.recruits.dane!.names).toContain(m.name);
    expect(s.men.map((x) => x.name)).not.toContain(m.name);
    expect(m.weapons).toBeGreaterThanOrEqual(3);
    expect(m.desc).toContain(m.name);
    // the same man for the same day
    expect(makeCandidate(s, content, 'dane').name).toBe(m.name);
  });

  it('a port sword swears on a ring from the chest, and the ring is gone', () => {
    let s = lord();
    open(s, 'hi_port_dane', content);
    const name = s.cand!.name;
    s = act(content, s, { t: 'choose', id: 'swear' });
    const m = s.men.find((x) => x.name === name)!;
    expect(m.sworn).toBe(true);
    expect(m.origin).toBe('dane');
    expect(s.rings!.silver).toBe(1);
    expect(s.cand).toBeNull();
  });

  it('no ring, no oath', () => {
    const s = lord();
    s.rings = { silver: 0, gold: 0 };
    open(s, 'hi_port_dane', content);
    const swear = listActions(s, content).find((o) => o.action.t === 'choose' && o.action.id === 'swear')!;
    expect(swear.enabled).toBe(false);
  });

  it('the base sets how many he can keep at his table', () => {
    const s = lord();
    expect(hirdRoom(s)).toBe(HIRD.cap.hall! - hirdCount(s));
    s.base.level = 'father';
    expect(hirdRoom(s)).toBe(0);
  });

  it('the beaten crew\'s best man is offered after the oath on the rival\'s deck', () => {
    const s = lord();
    applyEffects(s, content, rng(), [{ queue: { scene: 'hi_beaten', days: 0 } }]);
    expect(s.queue.some((q) => q.scene === 'hi_beaten')).toBe(true);
  });

  it('a new man whose loyalty runs out walks at the year\'s turn; the four do not', () => {
    const s = lord();
    const m = { ...makeCandidate(s, content, 'beaten'), sworn: true, loyalty: 1 };
    s.men.push(m);
    s.men[0]!.loyalty = 0;
    const lines = hirdLeaves(s);
    expect(lines.length).toBe(1);
    expect(s.men.some((x) => x.id === m.id)).toBe(false);
    expect(s.men[0]!.alive).toBe(true);
  });
});

describe('hostages', () => {
  it('a raid round spent looking finds someone worth a ransom, and the scene follows the raid', () => {
    const s = lord();
    s.at = 'conaille';
    startPlunder(s, 'conaille', [], undefined, content);
    plunderAction(s, content, sure, 'hostage');
    expect(hostagesOf(s).length).toBe(1);
    expect(['king_son', 'queen', 'noble_family']).toContain(hostagesOf(s)[0]!.kind);
    plunderAction(s, content, sure, 'leave');
    expect(s.queue.some((q) => q.scene === 'hs_taken')).toBe(true);
  });

  it('only once a raid, and never at another man\'s oar', () => {
    const s = lord();
    s.at = 'bangor';
    startPlunder(s, 'bangor', [], undefined, content);
    plunderAction(s, content, sure, 'hostage');
    const look = listActions(s, content).find((o) => o.action.t === 'plunder' && o.action.what === 'hostage')!;
    expect(look.enabled).toBe(false);
    const t = lord();
    t.service = { captain: 'Ásgeir', route: [], shares: 1 };
    startPlunder(t, 'bangor', [], undefined, content);
    expect(listActions(t, content).some((o) => o.action.t === 'plunder' && o.action.what === 'hostage')).toBe(false);
  });

  it('the go-between pays the ransom; held as surety instead, the tribute comes each year', () => {
    let s = lord();
    s.at = 'home_fjord';
    s.phase = 'winter';
    const h = makeHostage(s, content, sure, 'king_son', 'conaille');
    hostagesOf(s).push(h);
    open(s, 'hs_envoy', content);
    const silver = s.silver;
    s = act(content, s, { t: 'choose', id: 'accept' });
    expect(s.silver).toBe(silver + h.price);
    expect(hostagesOf(s).length).toBe(0);

    let t = lord();
    t.at = 'home_fjord';
    t.phase = 'winter';
    hostagesOf(t).push(makeHostage(t, content, sure, 'king_son', 'conaille'));
    open(t, 'hs_envoy', content);
    t = act(content, t, { t: 'choose', id: 'surety' });
    expect(hostagesOf(t)[0]!.state).toBe('surety');
    const before = t.silver;
    hostageYear(t, content, { float: () => 0.99, int: () => 0 } as unknown as RngCursor);
    expect(t.silver).toBe(before - HOSTAGE.keep + Math.round(hostagesOf(t)[0]!.price * HOSTAGE.tribute));
  });

  it('raiding the people whose surety he holds breaks the peace', () => {
    const s = lord();
    const h = makeHostage(s, content, sure, 'king_son', 'conaille');
    h.state = 'surety';
    hostagesOf(s).push(h);
    brokePeace(s, 'armagh', content);
    expect(s.queue.some((q) => q.scene === 'hs_broken')).toBe(true);
    expect(s.flags.hs_we_broke).toBe(1);
  });

  it('a noble family\'s kin may offer the eldest daughter, and the rest go home', () => {
    let s = lord();
    s.at = 'home_fjord';
    s.phase = 'winter';
    s.base.wife = null;
    const h = makeHostage(s, content, { float: () => 0, int: (n: number) => n - 1 } as unknown as RngCursor, 'noble_family', 'dorestad');
    expect(h.daughter).toBeDefined();
    hostagesOf(s).push(h);
    open(s, 'hs_marriage', content);
    s = act(content, s, { t: 'choose', id: 'marry' });
    expect(s.base.wife).toBe(h.daughter);
    expect(hostagesOf(s).length).toBe(0);
  });

  it('a rival captain\'s son is a political prisoner', () => {
    const s = lord();
    applyEffects(s, content, rng(), [{ take_hostage: { kind: 'captain_kin' } }]);
    expect(hostagesOf(s)[0]!.people).toBe('norse');
    expect(content.scenes.hs_jarl!.requires).toContain('hostages.political >= 1');
  });
});

describe('one prize a year', () => {
  it('a second prize in the same year is refused', () => {
    const s = lord();
    s.ships = [s.ships[0]!];
    applyEffects(s, content, rng(), [{ prize: { type: 'knarr', name: 'The Frisian' } }]);
    applyEffects(s, content, rng(), [{ prize: { type: 'karvi', name: 'Sea-Thief' } }]);
    expect(s.ships.length).toBe(2);
    s.day = dayOf(837, 150);
    applyEffects(s, content, rng(), [{ prize: { type: 'karvi', name: 'Sea-Thief' } }]);
    expect(s.ships.length).toBe(3);
  });
});
