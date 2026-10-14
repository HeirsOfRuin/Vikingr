// Display formatting shared by the engine (journal text) and the UI.
import { COINS_PER_ORTUG, COINS_PER_POUND, ORTUG_PER_POUND } from './tuning';

/** Silver by weight, as a Northman reckoned it: pounds of hacksilver, and coins for the change.
 *  "3 pounds 40 coins", "1 pound", "15 coins", "no silver". Takes ørtugar (the engine's unit). */
export function formatSilver(ortug: number): string {
  const neg = ortug < 0;
  const coins = Math.abs(Math.round(ortug * COINS_PER_ORTUG));
  const pounds = Math.floor(coins / COINS_PER_POUND);
  const rest = coins - pounds * COINS_PER_POUND;
  const parts: string[] = [];
  if (pounds) parts.push(`${pounds} pound${pounds === 1 ? '' : 's'}`);
  if (rest) parts.push(`${rest} coin${rest === 1 ? '' : 's'}`);
  if (!parts.length) return 'no silver';
  return (neg ? '-' : '') + parts.join(' ');
}

/** For tight spaces (the top bar): "3 lb 40c", "15c". */
export function formatSilverShort(ortug: number): string {
  const coins = Math.abs(Math.round(ortug * COINS_PER_ORTUG));
  const pounds = Math.floor(coins / COINS_PER_POUND);
  const rest = coins - pounds * COINS_PER_POUND;
  const s = pounds ? `${pounds} lb${rest ? ` ${rest}c` : ''}` : `${rest}c`;
  return (ortug < 0 ? '-' : '') + s;
}

/** Parses "2lb", "40c", "2lb40c" into ørtugar (coins round to the nearest ørtug). Plain numbers are ørtugar. */
export function parseSilver(text: string): number {
  const t = text.trim().replace(/\s+/g, '');
  if (/^-?\d+$/.test(t)) return Number(t);
  const m = /^(-)?(?:(\d+)lb)?(?:(\d+)c)?$/.exec(t);
  if (!m || t === '' || t === '-' || (!m[2] && !m[3])) throw new Error(`cannot read silver amount "${text}"`);
  const v = Number(m[2] ?? 0) * ORTUG_PER_POUND + Math.round(Number(m[3] ?? 0) / COINS_PER_ORTUG);
  return m[1] ? -v : v;
}

export function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
export function numberWord(n: number): string {
  return WORDS[n] ?? String(n);
}

export function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`;
}
