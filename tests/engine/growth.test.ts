// The body and the mind grow by use (Josh, 2026-11-08: "your health, breath, and stuff should increase, like your skills do").
import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { learn, train, hpMax, breathMax, attrProgress, ATTR_GROWTH } from '../../src/engine/hero';
import { dayOf } from '../../src/engine/calendar';

const young = () => {
  const s = sandboxGame(5);
  s.hero.born = 814;
  s.day = dayOf(834, 120); // 20
  s.hero.attrs.end = 2;
  return s;
};

describe('attributes grow by use', () => {
  it('rowing builds endurance, and endurance brings blood and breath', () => {
    const s = young();
    const blood = hpMax(s, content);
    const breath = breathMax(s, content);
    let line: string | null = null;
    for (let i = 0; i < 200 && s.hero.attrs.end === 2; i++) line = learn(s, 'seamanship', 1) ?? line;
    expect(s.hero.attrs.end).toBe(3);
    expect(line).toMatch(/Endurance rises to 3/);
    expect(hpMax(s, content)).toBe(blood + 2);
    expect(breathMax(s, content)).toBe(breath + 1);
    expect(s.journal.at(-1)!.text).toMatch(/Endurance rises to 3/);
  });

  it('keeps growing after the skill has nothing more to teach', () => {
    const s = young();
    s.hero.skills.seamanship = 10;
    learn(s, 'seamanship', 20);
    expect(s.hero.xp.seamanship).toBe(0);
    expect(s.hero.axp?.end).toBeGreaterThan(0);
  });

  it('a point costs more the higher it is, and nobody passes the mark', () => {
    const s = young();
    s.hero.attrs.str = ATTR_GROWTH.max;
    expect(train(s, 'str', 1000)).toBeNull();
    expect(attrProgress(s, 'str')).toBeNull();
    expect(attrProgress(s, 'end')).toEqual([0, ATTR_GROWTH.perLevel * 3]);
  });

  it('the body grows slower from 27 and not at all from 35; wits and presence at any age', () => {
    const s = young();
    s.day = dayOf(844, 120); // 30
    train(s, 'end', 10);
    expect(s.hero.axp?.end).toBe(5);
    s.day = dayOf(850, 120); // 36
    expect(train(s, 'end', 1000)).toBeNull();
    expect(s.hero.attrs.end).toBe(2);
    const w = s.hero.attrs.wit;
    train(s, 'wit', ATTR_GROWTH.perLevel * (w + 1));
    expect(s.hero.attrs.wit).toBe(w + 1);
  });
});
