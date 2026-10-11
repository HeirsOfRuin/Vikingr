import { describe, it, expect } from 'vitest';
import { dateOf, dayOf, nextDoy, ageOn, formatDate } from '../../src/engine/calendar';
import { MUSTER_DOY, WINTER_DOY } from '../../src/engine/tuning';

describe('calendar', () => {
  it('day 0 is 1 January 830', () => {
    expect(formatDate(0)).toBe('1 January 830');
    expect(dateOf(dayOf(830, MUSTER_DOY))).toMatchObject({ year: 830, month: 2, dom: 1 });
  });
  it('rolls over years', () => {
    expect(dateOf(365).year).toBe(831);
    expect(formatDate(364)).toBe('31 December 830');
  });
  it('finds the next day of the year', () => {
    const d = dayOf(830, 100);
    expect(nextDoy(d, WINTER_DOY)).toBe(dayOf(830, WINTER_DOY));
    expect(nextDoy(dayOf(830, 320), WINTER_DOY)).toBe(dayOf(831, WINTER_DOY));
  });
  it('the hero is 16 at the first muster and 17 a year later', () => {
    expect(ageOn(dayOf(830, MUSTER_DOY))).toBe(16);
    expect(ageOn(dayOf(831, MUSTER_DOY))).toBe(17);
    expect(ageOn(dayOf(831, 10))).toBe(16);
  });
});
