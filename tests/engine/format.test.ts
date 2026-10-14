import { describe, it, expect } from 'vitest';
import { formatSilver, formatSilverShort, parseSilver } from '../../src/engine/format';

describe('silver', () => {
  it('is weighed: pounds of hacksilver, and coins for the change', () => {
    expect(formatSilver(0)).toBe('no silver');
    expect(formatSilver(1)).toBe('5 coins');
    expect(formatSilver(24)).toBe('120 coins');
    expect(formatSilver(48)).toBe('1 pound');
    expect(formatSilver(48 * 3 + 8)).toBe('3 pounds 40 coins');
    expect(formatSilverShort(48 * 3 + 8)).toBe('3 lb 40c');
    expect(formatSilverShort(3)).toBe('15c');
  });
  it('parses what it formats', () => {
    expect(parseSilver('3lb40c')).toBe(152);
    expect(parseSilver('2 lb')).toBe(96);
    expect(parseSilver('12')).toBe(12);
    expect(() => parseSilver('lots')).toThrow();
  });
});
