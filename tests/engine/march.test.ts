// Overland (Josh's playtest, 2026-10-30): riding north with the army must not put him on a ship.
import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { newGame, act, listActions } from '../../src/engine/index';
import { dayOf } from '../../src/engine/calendar';
import { landPath } from '../../src/engine/march';
import { routes } from '../../src/engine/voyage';

describe('the roads', () => {
  it('riding north with the army goes by road, not by Sheppey', () => {
    let s = newGame(content, { background: 'younger_son', seed: 3, name: 'Ari', era: 865 });
    s.pending = { t: 'scene', id: 'e66_north' };
    s.seen.e66_north = s.day;
    s.at = 'gipeswic';
    s.day = dayOf(866, 280);
    s.phase = 'sailing';
    s.flags.ga_rider = 1;
    s.flags.ga_army = 1;
    s.service = { captain: 'Kolr', shipName: 'the Elk', home: 'gipeswic', route: [], shares: 1 } as never;
    s.fleet = { id: 'greatarmy', since: s.day, camp: 'gipeswic' };
    s = act(content, s, { t: 'choose', id: 'horse' });
    expect(s.marchTo).toBe('york');
    while (s.pending?.t === 'report') s = act(content, s, { t: 'continue' });
    const opts = listActions(s, content);
    const ride = opts.find((o) => o.action.t === 'march');
    expect(ride?.label).toMatch(/Ride to Jórvík/);
    expect(opts.some((o) => o.action.t === 'follow')).toBe(false);
    const day = s.day;
    s = act(content, s, ride!.action);
    expect(s.voyage).toBeFalsy();
    expect(s.at).toBe('york');
    expect(s.day - day).toBe(landPath(content, 'gipeswic', 'york')!.days);
    expect(s.marchTo).toBeUndefined();
    expect(s.journal.at(-1)!.text).toBe('Marched to Jórvík.');
  });

  it('left behind, the ships wait: no sailing until he marches back to them', () => {
    let s = sandboxGame(5);
    s.at = 'gipeswic';
    s.known.push('gipeswic', 'thetford', 'sheppey');
    s.day = dayOf(840, 150);
    s.phase = 'sailing';
    const go = listActions(s, content).find((o) => o.action.t === 'march' && (o.action as { to: string }).to === 'thetford');
    expect(go?.enabled).toBe(true);
    s = act(content, s, go!.action);
    if (s.pending?.t === 'report') s = act(content, s, { t: 'continue' });
    while (s.pending?.t === 'scene') s = act(content, s, { t: 'choose', id: listActions(s, content).find((o) => o.enabled)!.action.t === 'choose' ? (listActions(s, content).find((o) => o.enabled)!.action as { id: string }).id : '' });
    expect(s.at).toBe('thetford');
    expect(s.inland).toBe('gipeswic');
    expect(routes(s, content, 'thetford')).toEqual([]);
    expect(listActions(s, content).filter((o) => o.action.t === 'sail' && o.enabled)).toEqual([]);
  });

  it('no leg of the sea routes goes overland', () => {
    for (const l of content.legs.filter((x) => x.kind === 'land')) {
      expect(routes({ ...sandboxGame(1), at: l.a, known: [l.a, l.b] }, content, l.a).map((r) => r.to)).not.toContain(l.b);
    }
  });
});

describe('road events', () => {
  it('a march can meet the road; its account and the arrival come after', () => {
    let fired = 0;
    for (let seed = 1; seed <= 60 && fired < 3; seed++) {
      let s = sandboxGame(seed);
      s.at = 'gipeswic';
      s.known.push('gipeswic', 'thetford', 'york');
      s.day = dayOf(866, 150);
      s.phase = 'sailing';
      s.places.york!.standing = -6;
      s.fleet = { id: 'greatarmy', since: s.day, camp: 'york' };
      s.marchTo = 'york';
      const go = listActions(s, content).find((o) => o.action.t === 'march')!;
      s = act(content, s, go.action);
      if (s.pending?.t !== 'scene' || !s.pending.id.startsWith('rd_')) continue;
      fired++;
      expect(s.at).toBe('york');
      expect(s.arriveDue).toBe(true);
      const c = listActions(s, content).find((o) => o.enabled && o.action.t === 'choose')!;
      s = act(content, s, c.action);
      for (let i = 0; i < 30 && s.pending && !(s.pending.t === 'report' && s.pending.title === 'On the road'); i++) s = act(content, s, listActions(s, content).find((o) => o.enabled)!.action);
      expect(s.pending?.t === 'report' && s.pending.title).toBe('On the road');
      s = act(content, s, { t: 'continue' });
      expect(s.arriveDue).toBeUndefined();
    }
    expect(fired).toBeGreaterThan(0);
  });
});
