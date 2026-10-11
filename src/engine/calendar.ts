// The calendar: day 0 is 1 January 830. 365-day years, no leap days.
import { START_YEAR, YEAR_DAYS, MONTH_START, BIRTH_YEAR } from './tuning';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

export interface DateParts {
  year: number;
  doy: number; // day of year, 0-based
  month: number; // 0-based
  dom: number; // 1-based
}

export function dateOf(day: number): DateParts {
  const yi = Math.floor(day / YEAR_DAYS);
  const doy = day - yi * YEAR_DAYS;
  let month = 0;
  while (month < 11 && MONTH_START[month + 1]! <= doy) month++;
  return { year: START_YEAR + yi, doy, month, dom: doy - MONTH_START[month]! + 1 };
}

export function dayOf(year: number, doy: number): number {
  return (year - START_YEAR) * YEAR_DAYS + doy;
}

export function doyOf(day: number): number {
  return dateOf(day).doy;
}

/** The next day (at or after `day`) that falls on this day of the year. */
export function nextDoy(day: number, doy: number): number {
  const d = dateOf(day);
  const same = dayOf(d.year, doy);
  return same >= day ? same : dayOf(d.year + 1, doy);
}

/** Seasons as the people of the time counted them: two halves, summer and winter, with their parts. */
export function seasonName(day: number): string {
  const m = dateOf(day).month;
  if (m <= 1 || m === 11) return 'deep winter';
  if (m <= 3) return 'spring';
  if (m <= 5) return 'early summer';
  if (m <= 7) return 'high summer';
  if (m === 8) return 'late summer';
  return 'autumn';
}

export function formatDate(day: number): string {
  const d = dateOf(day);
  return `${d.dom} ${MONTHS[d.month]} ${d.year}`;
}

export function ageOn(day: number, born = BIRTH_YEAR): number {
  // born in early spring, so he is a year older from 1 March
  const d = dateOf(day);
  return d.year - born - (d.doy < 59 ? 1 : 0);
}
