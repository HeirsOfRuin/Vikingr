import { describe, it, expect } from 'vitest';
import { content } from '../helpers';
import { playLife } from '../../tools/bot-lib';
import { dateOf } from '../../src/engine/calendar';

// Playtest 5 (2026-10-19): the outlaw came home on 1 November 833 in the muster phase; the younger son's 831 and
// 832 spring scenes fired that day, the spring of 834 never came, and the 830 Yule feast fired in January 835.
const OTHER_STORY = /^(sp_831|j_council|sp_832|y_feast|y_volva|y_flyting|h_return|h_ormr|w1_|h1_return|sp_father|j_gyda)/;

describe('playtest 5: the outlaw comes home in spring, into his own story', () => {
  it('never sees the younger son\'s scenes, comes home in spring, and every year has its spring', () => {
    for (let i = 0; i < 10; i++) {
      const s = playLife(content, 'raider', 2000 + i, 7, 'outlaw').state;
      for (const id of Object.keys(s.seen)) expect(id).not.toMatch(OTHER_STORY);
      if (s.seen.o_return !== undefined) expect(dateOf(s.seen.o_return as number).month + 1).toBeLessThanOrEqual(5);
      const springs = new Set(s.journal.filter((j) => /^Spring of \d+/.test(j.text)).map((j) => Number(/\d+/.exec(j.text)![0])));
      for (let y = 831; y < dateOf(s.day).year; y++) expect(springs.has(y)).toBe(true);
    }
  }, 60000);
});

import { sandboxGame } from '../helpers';
import { test as cond } from '../../src/engine/conditions';
import { applyEffects } from '../../src/engine/effects';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { dayOf } from '../../src/engine/calendar';
import { listActions } from '../../src/engine/index';
import { goalMet, swearBoast } from '../../src/engine/boasts';
import { callName, shipOf } from '../../src/engine/format';
import { unmetLabel } from '../../src/engine/conditions';

const rng = () => new RngCursor(seedRng(5));

describe('playtest 5: the smaller reports', () => {
  it('names a man without a given name "He" in a fight, and a ship named for its owner "his"', () => {
    expect(callName('A big man off a fishing boat')).toBe('He');
    expect(callName('The local champion')).toBe('He');
    expect(callName('Thorgils Hrappsson')).toBe('Thorgils');
    expect(shipOf('Þórir', "Þórir's knarr")).toBe('his knarr');
    expect(shipOf('Ásgeir', 'The Raven')).toBe('The Raven');
  });

  it('says what Ubbi needs in words, not "Captain ubbi rel 3"', () => {
    const s = sandboxGame(1);
    expect(unmetLabel(['captain.ubbi.rel >= 3'], s, content)).toBe('Ubbi must think well of you (3)');
  });

  it('a man sworn to Ubbi meets his fleet when he comes to Hedeby in March, not the stranger\'s welcome', () => {
    const s = sandboxGame(2);
    s.flags.ubbi_sworn = 1;
    s.seen.k_ubbi = dayOf(834, 120);
    s.day = dayOf(835, 70);
    s.at = 'hedeby';
    expect(cond(content.scenes.hd_ubbi!.requires!, s, content)).toBe(true);
    expect(cond(content.scenes.cap_ubbi!.requires!, s, content)).toBe(false);
  });

  it('one wife: a wedding ends every other courtship, and a broken promise to Ingibjörg costs Orkney', () => {
    const s = sandboxGame(3);
    s.flags.ingibjorg_promised = 1;
    s.flags.asta_met = 1;
    s.flags.thorunn_betrothed = 1;
    s.flags.betrothed = 1;
    const before = s.places.orkney?.standing ?? 0;
    applyEffects(s, content, rng(), [{ wife: 'Þórunn' }]);
    expect(s.flags.ingibjorg_promised).toBeUndefined();
    expect(s.flags.betrothed).toBeUndefined();
    expect(s.flags.ingibjorg_jilted).toBe(1);
    expect(s.places.orkney!.standing).toBe(before - 2);
    // and nobody else is courted while he is promised
    const t = sandboxGame(4);
    t.flags.ingibjorg_promised = 1; t.flags.asta_met = 1; t.flags.sk_thorunn_friend = 1;
    t.day = dayOf(833, 150);
    expect(cond(content.scenes.g_asta_ask!.requires!, t, content)).toBe(false);
    expect(cond(content.scenes.g_thorunn_ask!.requires!, t, content)).toBe(false);
  });

  it('a boast to be first over the wall is kept by a fight won in the front rank; Dorestad has three summers and a raid', () => {
    const s = sandboxGame(5);
    swearBoast(s, content, 'first_over');
    const b = s.boasts.find((x) => x.id === 'first_over')!;
    expect(goalMet(s, content, b)).toBe(false);
    s.stats.frontWins += 1;
    expect(goalMet(s, content, b)).toBe(true);
    expect(content.boasts.dorestad!.days).toBeGreaterThan(1000);
    swearBoast(s, content, 'dorestad');
    const d = s.boasts.find((x) => x.id === 'dorestad')!;
    s.places.dorestad!.raided = 1;
    expect(goalMet(s, content, d)).toBe(true);
  });

  it('abroad, he can haul up for the winter from 1 October', () => {
    const s = sandboxGame(6);
    s.phase = 'sailing'; s.at = 'kaupang'; s.day = dayOf(833, 280);
    expect(listActions(s, content).some((o) => o.action.t === 'winter_here')).toBe(true);
    s.day = dayOf(833, 250);
    expect(listActions(s, content).some((o) => o.action.t === 'winter_here')).toBe(false);
  });
});

import { act } from '../../src/engine/index';
import { mouths } from '../../src/engine/crew';
import { serviceShare, SERVICE_OARS_SHARE } from '../../src/engine/season';

describe('playtest 5: food and shares, checked', () => {
  it('every day abroad eats from the stores, at sea or ashore; at home the farm feeds them', () => {
    let s = sandboxGame(7);
    s.phase = 'sailing'; s.at = 'kaupang'; s.provisions = 500; s.fedTo = s.day;
    const m = mouths(s);
    s = act(content, s, { t: 'rest' });
    expect(s.provisions).toBe(500 - 3 * m);
    let h = sandboxGame(8);
    h.phase = 'sailing'; h.at = 'home_fjord'; h.provisions = 500; h.fedTo = h.day;
    h = act(content, h, { t: 'rest' });
    expect(h.provisions).toBe(500);
  });

  it("the oarsman's share is three quarters of the heap over the oars, and the line shows the working", () => {
    const s = sandboxGame(9);
    s.service = { captain: 'Ásgeir', route: [], shares: 1.5 } as never;
    s.loot = 960; s.captives = 0; s.silver = 0;
    const heads = s.crew.men + s.men.filter((x) => x.alive).length + 1;
    const lines = serviceShare(s, content);
    expect(s.silver).toBe(Math.round(((960 * SERVICE_OARS_SHARE) / heads) * 1.5));
    expect(lines.join(' ')).toMatch(/heap comes to/);
    expect(lines.join(' ')).toMatch(/1.5 shares come/);
  });
});

import { open as openScene } from '../../src/engine/director';

describe("playtest 5: the jarl's levy is fought with the jarl", () => {
  it('opens as a host: the jarl\'s hird and the district\'s ships in the line beside his own men', () => {
    let s = sandboxGame(10);
    s.day = dayOf(834, 70); s.phase = 'muster'; s.at = 'home_fjord';
    openScene(s, 'g_levy', content);
    s = act(content, s, { t: 'choose', id: 'answer' });
    const b = (s.pending as unknown as { battle: { host?: { wings: { name: string }[] } } }).battle;
    expect(b.host?.wings.map((w) => w.name)).toEqual(["The jarl's hird", "The district's ships"]);
  });
});
