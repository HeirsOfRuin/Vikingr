import { describe, it, expect } from 'vitest';
import { formatSilver, parseSilver } from '../../src/engine/format';

describe('silver', () => {
  it('formats by weight', () => {
    expect(formatSilver(0)).toBe('no silver');
    expect(formatSilver(1)).toBe('1 ørtug');
    expect(formatSilver(3)).toBe('1 eyrir');
    expect(formatSilver(24)).toBe('1 mark');
    expect(formatSilver(24 * 2 + 3 * 3 + 2)).toBe('2 marks 3 aurar 2 ørtugar');
  });
  it('parses what it formats', () => {
    expect(parseSilver('2m3a2o')).toBe(59);
    expect(parseSilver('12')).toBe(12);
    expect(() => parseSilver('lots')).toThrow();
  });
});
