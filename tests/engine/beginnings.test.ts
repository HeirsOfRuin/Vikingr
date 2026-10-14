import { describe, it, expect } from 'vitest';
import { content } from '../helpers';
import { act, listActions, newGame } from '../../src/engine/index';
import type { GameState } from '../../src/engine/state';
import { open } from '../../src/engine/director';
import { dayOf } from '../../src/engine/calendar';
import { legendTable } from '../../src/engine/fame';
import { routes } from '../../src/engine/voyage';
import { winterWork } from '../../src/engine/season';

// docs/FRAME-BEGINNINGS.md: two summers at another man's oar before a ship of his own.
const oarsman = (): GameState => {
  const s = newGame(content, { background: 'younger_son', seed: 11, name: 'Ari' });
  s.pending = null;
  s.day = dayOf(830, 170);
  s.phase = 'sailing';
  s.at = 'bangor';
  return s;
};

describe('the slower rise', () => {
  it('the men choose him at Bangor, and he takes the prow, not the ship', () => {
    let s = oarsman();
    s.fates.asgeir_falls = 1;
    open(s, 'b_oaths');
    s = act(content, s, { t: 'choose', id: 'take' });
    expect(s.service).not.toBeNull();
    expect(s.service!.captain).toBe('Steinarr');
    expect(s.service!.shares).toBe(2);
    expect(s.flags.bg_acclaimed).toBe(1);
  });

  it('no road out of spring 831 gives him a ship', () => {
    const s = oarsman();
    s.day = dayOf(831, 60);
    s.phase = 'muster';
    s.at = 'home_fjord';
    s.flags.bg_acclaimed = 1;
    s.silver = 1000;
    open(s, 'sp_831');
    for (const o of listActions(s, content).filter((x) => x.enabled)) {
      const after = act(content, s, o.action);
      expect(after.service).not.toBeNull();
    }
  });

  it('spring 832: the jarl keeps his word to the boy he noticed', () => {
    let s = oarsman();
    s.day = dayOf(832, 60);
    s.phase = 'muster';
    s.at = 'home_fjord';
    s.flags.h_jarl_trust = 1;
    s.seen.j_council = 1;
    open(s, 'sp_832');
    s = act(content, s, { t: 'choose', id: 'promised' });
    expect(s.service).toBeNull();
    expect(s.ships[0]!.name).toBe("The jarl's old karvi");
  });

  it('a boy of sixteen does not outrank the legends of his day', () => {
    const s = oarsman();
    s.day = dayOf(830, 350);
    const table = legendTable(s, content);
    expect(table.slice(0, 4).some((r) => r.hero)).toBe(false);
  });
});

describe("the freedman's son", () => {
  it('starts in the boatyard and comes to the Raven as her bailer, on half a share', () => {
    let s = newGame(content, { background: 'freedman', seed: 3, name: 'Ari' });
    expect(s.pending).toEqual({ t: 'scene', id: 'f_yard' });
    expect(s.service?.captain).toBe('Ásgeir');
    s = act(content, s, { t: 'choose', id: 'hold' });
    for (const id of ['still', 'learn', 'take']) {
      while (s.pending && !listActions(s, content).some((o) => o.enabled && o.action.t === 'choose' && o.action.id === id)) s = act(content, s, listActions(s, content).find((o) => o.enabled)!.action);
      s = act(content, s, { t: 'choose', id });
    }
    expect(s.flags.irish).toBe(1);
    expect(s.service!.shares).toBe(0.5);
    while (s.pending && !(s.pending.t === 'scene' && s.pending.id === 'm_landing')) s = act(content, s, listActions(s, content).find((o) => o.enabled)!.action);
    expect(s.pending).toEqual({ t: 'scene', id: 'm_landing' });
  });

  it('his homecoming is his own; the younger son\'s brother is not in it', () => {
    expect(content.scenes.h_return!.requires).toContain('background == younger_son');
    expect(content.scenes.f_return!.requires).toContain('background == freedman');
  });

  it("winters in his father's boatyard, not on a brother's farm", () => {
    const s = oarsman();
    s.hero.background = 'freedman';
    s.at = 'home_fjord';
    expect(winterWork(s)!.label).toBe("Work in your father's boatyard");
    s.hero.background = 'outlaw';
    s.at = 'orkney';
    s.flags.outlawed = 1;
    expect(winterWork(s)!.label).toBe("Work for Harek's steward");
  });

  it('spring 832: he launches the ship he built with his father', () => {
    let s = oarsman();
    s.hero.background = 'freedman';
    s.day = dayOf(832, 60);
    s.phase = 'muster';
    s.at = 'home_fjord';
    s.flags.f_building = 1;
    s.flags.irish = 1;
    s.seen.j_council = 1;
    open(s, 'sp_832');
    s = act(content, s, { t: 'choose', id: 'launch' });
    expect(s.service).toBeNull();
    expect(s.ships[0]!.name).toBe('Órlaith');
  });
});

describe('the outlaw', () => {
  it('starts at the horse-fight, outlawed, working his passage west on a trader', () => {
    const s = newGame(content, { background: 'outlaw', seed: 3, name: 'Ari' });
    expect(s.pending).toEqual({ t: 'scene', id: 'o_horses' });
    expect(s.flags.outlawed).toBe(1);
    expect(s.men.length).toBe(0);
  });

  it('cannot sail home while his time is not served', () => {
    const s = newGame(content, { background: 'outlaw', seed: 3, name: 'Ari' });
    s.pending = null;
    s.at = 'karmoy';
    expect(routes(s, content, 'karmoy').some((r) => r.to === 'home_fjord')).toBe(false);
    s.flags.outlaw_ended = 1;
    expect(routes(s, content, 'karmoy').some((r) => r.to === 'home_fjord')).toBe(true);
  });

  it('joins the Raven at Birsay, with the four bench-mates; her season ends at Orkney for him', () => {
    let s = newGame(content, { background: 'outlaw', seed: 3, name: 'Ari' });
    s.pending = null;
    s.at = 'orkney';
    s.phase = 'sailing';
    s.day = dayOf(830, 130);
    open(s, 'o_birsay');
    s = act(content, s, { t: 'choose', id: 'oar' });
    expect(s.service).toMatchObject({ captain: 'Ásgeir', home: 'orkney' });
    expect(s.men.map((m) => m.id).sort()).toEqual(['bersi', 'hallvard', 'ketill', 'ulf']);
    expect(s.men.every((m) => !m.sworn)).toBe(true);
  });

  it('three winters served: he comes home at the muster, and the 833 council can take him', () => {
    let s = newGame(content, { background: 'outlaw', seed: 3, name: 'Ari' });
    s.pending = null;
    s.at = 'orkney';
    s.phase = 'sailing';
    s.day = dayOf(833, 60);
    s.silver = 300;
    open(s, 'o_return');
    s = act(content, s, { t: 'choose', id: 'pay' });
    expect(s.at).toBe('home_fjord');
    expect(s.phase).toBe('muster');
    expect(s.flags.o_peace).toBe(1);
    expect(s.flags.outlaw_ended).toBe(1);
  });
});
