import { describe, it, expect } from 'vitest';
import { content } from '../helpers';
import { act, listActions, newGame } from '../../src/engine/index';
import type { GameState } from '../../src/engine/state';
import { renderText } from '../../src/engine/text';
import { open, trigger } from '../../src/engine/director';
import { routes } from '../../src/engine/voyage';
import { provision, recruit } from '../../src/engine/season';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { dayOf } from '../../src/engine/calendar';

const rng = () => new RngCursor(seedRng(1));
const captain = (): GameState => {
  const s = newGame(content, { background: 'freedman', seed: 4, name: 'Ari' });
  s.pending = null;
  s.service = null;
  s.day = dayOf(831, 150);
  s.phase = 'sailing';
  s.at = 'home_fjord';
  return s;
};
const kill = (s: GameState, id: string) => {
  const m = s.men.find((x) => x.id === id) ?? (s.men.push({ ...s.men[0]!, id, name: content.men[id]!.name }), s.men[s.men.length - 1]!);
  m.alive = false;
  (s.standIns ??= {})[id] = 'Thorkell';
};

describe('playtest 3', () => {
  it('a dead sworn man is not named in scenes written before his death; his bench-heir is', () => {
    const s = captain();
    kill(s, 'ketill');
    expect(renderText('Ketill finds you behind the byre.', s, content)).toBe('Thorkell finds you behind the byre.');
    // a passage written around him keeps his name
    expect(renderText('[if !man.ketill.alive]You miss Ketill.[/if]', s, content)).toBe('You miss Ketill.');
    // and his mourning keeps it too
    expect(renderText('You bury Ketill.', s, content, { keepDead: true })).toBe('You bury Ketill.');
  });

  it('a choice that needs a dead man is not offered at all', () => {
    const s = captain();
    kill(s, 'ketill');
    open(s, 'y_holm_eve');
    const ids = listActions(s, content).map((o) => (o.action as { id?: string }).id);
    expect(ids).not.toContain('ketill');
    expect(ids.length).toBeGreaterThan(0);
  });

  it('choice text renders its tokens', () => {
    const s = captain();
    s.service = { captain: 'Ásgeir', route: [], shares: 1 };
    open(s, 'j_council');
    expect(listActions(s, content).some((o) => o.label.includes('{captain}'))).toBe(false);
    expect(listActions(s, content).some((o) => o.label.includes('Ásgeir'))).toBe(true);
  });

  it('the ship\'s food and sign-on gifts come out of the plunder heap when his own purse is empty', () => {
    const s = captain();
    s.silver = 0;
    s.loot = 500;
    s.provisions = 0;
    s.musterPool = 10;
    s.crew.men = 10;
    provision(s);
    expect(s.provisions).toBeGreaterThan(0);
    expect(s.loot).toBeLessThan(500);
    const before = s.crew.men;
    recruit(s, content);
    expect(s.crew.men).toBeGreaterThan(before);
    expect(s.silver).toBe(0);
  });

  it('the hoard takes as much as he chooses', () => {
    let s = captain();
    s.silver = 240;
    const ins = listActions(s, content).filter((o) => o.action.t === 'hoard_in').map((o) => (o.action as { n?: number }).n);
    expect(ins).toEqual([48, 120, 192]);
    s = act(content, s, { t: 'hoard_in', n: 48 });
    expect(s.silver).toBe(192);
    expect(s.base.hoard).toBe(48);
  });

  it('a rumoured place on a known sea road can be sailed to', () => {
    const s = captain();
    s.at = 'kaupang';
    if (!s.known.includes('kaupang')) s.known.push('kaupang');
    s.known = s.known.filter((x) => x !== 'birka');
    expect(routes(s, content, 'kaupang').some((r) => r.to === 'birka')).toBe(false);
    s.rumoured.push('birka');
    expect(routes(s, content, 'kaupang').some((r) => r.to === 'birka')).toBe(true);
  });

  it('Ubbi waits at Hedeby for the man who swore, and the Frisian summer pays', () => {
    let s = captain();
    s.flags.ubbi_sworn = 1;
    s.at = 'hedeby';
    trigger(s, content, rng(), 'arrive');
    expect(s.pending?.t === 'scene' && s.pending.id).toBe('hd_ubbi');
    s = act(content, s, { t: 'choose', id: 'sail' });
    if (s.pending?.t === 'report') s = act(content, s, { t: 'continue' });
    expect(s.pending?.t === 'scene' && s.pending.id).toBe('hd_frisia');
  });

  it('the jarl answers for his ship when a boy brings her home', () => {
    const s = captain();
    s.flags.bg_command = 1;
    s.flags.bg_left = 1;
    s.fates.asgeir_falls = 1;
    open(s, 'h_return');
    const after = act(content, s, { t: 'choose', id: 'embrace' });
    expect(after.queue.some((q) => q.scene === 'h_jarl')).toBe(true);
  });

  it('beaten by the king, he can still drink from the king\'s cup', () => {
    let s = captain();
    s.boasts.push({ id: 'irish_cup', sworn: s.day - 100, due: s.day + 300, state: 'open' });
    open(s, 'c_king_lost');
    s = act(content, s, { t: 'choose', id: 'cup' });
    expect(s.boasts.find((b) => b.id === 'irish_cup')!.state).toBe('kept');
  });

  it('he can walk away from Gyða', () => {
    let s = captain();
    s.flags.gyda_courting = 1;
    open(s, 'j_gyda');
    s = act(content, s, { t: 'choose', id: 'release' });
    expect(s.flags.gyda_courting ?? 0).toBe(0);
    expect(s.flags.gyda_declined).toBe(1);
  });
});
