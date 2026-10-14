import { describe, it, expect } from 'vitest';
import { content } from '../helpers';
import { newGame } from '../../src/engine/index';
import { test as cond, validateCond, unmetLabel } from '../../src/engine/conditions';

const state = newGame(content, { background: 'younger_son', seed: 1, name: 'Test' });

describe('conditions', () => {
  it('evaluates comparisons, flags and named values', () => {
    expect(cond('skill.weapons >= 2', state, content)).toBe(true);
    expect(cond('skill.weapons >= 3', state, content)).toBe(false);
    expect(cond('phase == muster', state, content)).toBe(true);
    expect(cond('!flag.skald', state, content)).toBe(true);
    expect(cond({ any: ['flag.skald', 'age >= 16'] }, state, content)).toBe(true);
    expect(cond(['age >= 16', { not: 'man.ketill.alive' }], state, content)).toBe(false);
  });
  it('rejects unknown paths and values at validation', () => {
    expect(validateCond('flag.no_such_flag', content)).toHaveLength(1);
    expect(validateCond('phase == spring', content)[0]).toMatch(/unknown value/);
    expect(validateCond('skill.sorcery >= 1', content)[0]).toMatch(/unknown skill/);
    expect(validateCond('skill.weapons >= 3', content)).toEqual([]);
  });
  it('labels what is unmet', () => {
    expect(unmetLabel(['silver >= 48', 'skill.weapons >= 3'], state, content)).toBe('Silver 1 pound, Weapons 3');
  });
});
