// Display formatting shared by the engine (journal text) and the UI.
import { ORTUG_PER_EYRIR, ORTUG_PER_MARK } from './tuning';

/** Silver by weight: "2 marks 3 aurar", "1 eyrir 2 ørtugar", "nothing". */
export function formatSilver(ortug: number): string {
  const neg = ortug < 0;
  let n = Math.abs(Math.round(ortug));
  const marks = Math.floor(n / ORTUG_PER_MARK);
  n -= marks * ORTUG_PER_MARK;
  const aurar = Math.floor(n / ORTUG_PER_EYRIR);
  const ort = n - aurar * ORTUG_PER_EYRIR;
  const parts: string[] = [];
  if (marks) parts.push(`${marks} mark${marks === 1 ? '' : 's'}`);
  if (aurar) parts.push(`${aurar} ${aurar === 1 ? 'eyrir' : 'aurar'}`);
  if (ort) parts.push(`${ort} ${ort === 1 ? 'ørtug' : 'ørtugar'}`);
  if (!parts.length) return 'no silver';
  return (neg ? '-' : '') + parts.join(' ');
}

/** Parses "2m", "3a", "4o", "2m3a" into ørtugar. Plain numbers are ørtugar. */
export function parseSilver(text: string): number {
  const t = text.trim();
  if (/^-?\d+$/.test(t)) return Number(t);
  const m = /^(-)?(?:(\d+)m)?(?:(\d+)a)?(?:(\d+)o)?$/.exec(t);
  if (!m || t === '' || t === '-') throw new Error(`cannot read silver amount "${text}"`);
  const v = Number(m[2] ?? 0) * ORTUG_PER_MARK + Number(m[3] ?? 0) * ORTUG_PER_EYRIR + Number(m[4] ?? 0);
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
