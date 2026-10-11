// Condition grammar (from Knight of Adalia). Strings like "skill.weapons >= 3",
// "flag.met_jarl", "!man.ketill.alive", "phase == winter", combined with
// lists (all), { all }, { any }, { not }. Parsed once and cached.
import type { ContentBundle, CondInput } from '../content/schema';
import type { GameState } from './state';
import { getValue, checkPath, namedValues, labelFor, type Value } from './paths';
import { formatSilver } from './format';

export type Op = '>=' | '<=' | '>' | '<' | '==' | '!=';
export type Cond =
  | { t: 'cmp'; path: string; op: Op; value: number | string | boolean; src: string }
  | { t: 'truthy'; path: string; neg: boolean; src: string }
  | { t: 'all'; of: Cond[] }
  | { t: 'any'; of: Cond[] }
  | { t: 'not'; of: Cond };

export class ConditionError extends Error {}

const EXPR = /^\s*([a-z_][a-z0-9_.]*)\s*(>=|<=|==|!=|>|<)\s*(-?\d+(?:\.\d+)?|true|false|[a-z_][a-z0-9_]*)\s*$/;
const BARE = /^\s*(!?)\s*([a-z_][a-z0-9_.]*)\s*$/;

const cache = new Map<string, Cond>();
const objCache = new WeakMap<object, Cond>();

export function parseExpr(src: string): Cond {
  const hit = cache.get(src);
  if (hit) return hit;
  let c: Cond;
  const m = EXPR.exec(src);
  if (m) {
    const raw = m[3]!;
    const value = /^-?\d/.test(raw) ? Number(raw) : raw === 'true' ? true : raw === 'false' ? false : raw;
    c = { t: 'cmp', path: m[1]!, op: m[2] as Op, value, src };
  } else {
    const b = BARE.exec(src);
    if (!b) throw new ConditionError(`cannot parse condition "${src}"`);
    c = { t: 'truthy', path: b[2]!, neg: b[1] === '!', src };
  }
  cache.set(src, c);
  return c;
}

export function compileCond(input: CondInput): Cond {
  if (typeof input === 'string') return parseExpr(input);
  const hit = objCache.get(input);
  if (hit) return hit;
  let c: Cond;
  if (Array.isArray(input)) c = { t: 'all', of: input.map(compileCond) };
  else if ('all' in input) c = { t: 'all', of: input.all.map(compileCond) };
  else if ('any' in input) c = { t: 'any', of: input.any.map(compileCond) };
  else c = { t: 'not', of: compileCond(input.not) };
  objCache.set(input, c);
  return c;
}

function compare(a: Value, op: Op, e: number | string | boolean): boolean {
  switch (op) {
    case '==': return a === e;
    case '!=': return a !== e;
    case '>=': return (a as number) >= (e as number);
    case '<=': return (a as number) <= (e as number);
    case '>': return (a as number) > (e as number);
    case '<': return (a as number) < (e as number);
  }
}

export function evalCond(cond: Cond, state: GameState, content: ContentBundle): boolean {
  switch (cond.t) {
    case 'cmp': return compare(getValue(state, content, cond.path), cond.op, cond.value);
    case 'truthy': {
      const v = !!getValue(state, content, cond.path);
      return cond.neg ? !v : v;
    }
    case 'all': return cond.of.every((c) => evalCond(c, state, content));
    case 'any': return cond.of.some((c) => evalCond(c, state, content));
    case 'not': return !evalCond(cond.of, state, content);
  }
}

export function test(input: CondInput | undefined, state: GameState, content: ContentBundle): boolean {
  return input === undefined ? true : evalCond(compileCond(input), state, content);
}

/** Static validation. Returns error strings. */
export function validateCond(input: CondInput, content: ContentBundle): string[] {
  let cond: Cond;
  try {
    cond = compileCond(input);
  } catch (e) {
    return [(e as Error).message];
  }
  const errs: string[] = [];
  const visit = (c: Cond) => {
    if (c.t === 'all' || c.t === 'any') c.of.forEach(visit);
    else if (c.t === 'not') visit(c.of);
    else {
      const pe = checkPath(content, c.path);
      if (pe) errs.push(pe);
      if (c.t === 'cmp' && typeof c.value === 'string') {
        const known = namedValues(content, c.path);
        if (!known) errs.push(`"${c.src}": path does not take a named value`);
        else if (!known.includes(c.value)) errs.push(`"${c.src}": unknown value "${c.value}"`);
      }
    }
  };
  visit(cond);
  return errs;
}

/** Every leaf path referenced (for flag usage tracking). */
export function condPaths(input: CondInput): string[] {
  const out: string[] = [];
  const visit = (c: Cond) => {
    if (c.t === 'all' || c.t === 'any') c.of.forEach(visit);
    else if (c.t === 'not') visit(c.of);
    else out.push(c.path);
  };
  visit(compileCond(input));
  return out;
}

function leafLabel(c: Extract<Cond, { t: 'cmp' | 'truthy' }>, content: ContentBundle): string {
  if (c.t === 'truthy') {
    const [ns, id] = c.path.split('.');
    let base: string;
    if (ns === 'flag') base = content.flags[id!]?.description ?? id!;
    else if (ns === 'man') base = `${content.men[id!]?.name ?? id} with you`;
    else if (ns === 'wound') base = content.injuries[id!]?.name ?? id!;
    else base = labelFor(c.path);
    return c.neg ? `not: ${base}` : base;
  }
  const { op, value, path } = c;
  if (path === 'silver' && typeof value === 'number') return `Silver ${formatSilver(value)}`;
  const [ns, id, sub] = path.split('.');
  const name = ns === 'man' && sub === 'loyalty' ? `${content.men[id!]?.name ?? id}'s loyalty` : labelFor(path);
  if (typeof value === 'number') {
    if (op === '>=') return `${name} ${value}`;
    if (op === '<=') return `${name} ${value} or less`;
    return `${name} ${op} ${value}`;
  }
  return `${name} ${op} ${value}`;
}

/** Requirement label describing what is unmet ("Weapons 3, Silver 2 marks"). */
export function unmetLabel(input: CondInput, state: GameState, content: ContentBundle): string {
  const describe = (c: Cond, onlyUnmet: boolean): string[] => {
    if (onlyUnmet && evalCond(c, state, content)) return [];
    switch (c.t) {
      case 'all': return c.of.flatMap((x) => describe(x, onlyUnmet));
      case 'any': return [c.of.map((x) => describe(x, false).join(' and ')).join(' or ')];
      case 'not': return [`not (${describe(c.of, false).join(', ')})`];
      default: return [leafLabel(c, content)];
    }
  };
  return describe(compileCond(input), true).join(', ');
}
