// sfc32 seeded PRNG. State is four uint32s stored in the save, so a reload
// replays the same draws: no rerolling by reloading.
import type { RngState } from "./state";

export function seedRng(seed: number): RngState {
  // splitmix32 to spread a small integer seed across the state
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    return (z ^ (z >>> 16)) >>> 0;
  };
  const st: RngState = [next(), next(), next(), next()];
  // warm up
  let r = st;
  for (let i = 0; i < 12; i++) r = rngNext(r)[1];
  return r;
}

/** Returns [float in [0,1), next state]. Pure. */
export function rngNext(st: RngState): [number, RngState] {
  let [a, b, c, d] = st;
  a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
  const t = (((a + b) >>> 0) + d) >>> 0;
  d = (d + 1) >>> 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) >>> 0;
  c = ((c << 21) | (c >>> 11)) >>> 0;
  c = (c + t) >>> 0;
  return [t / 4294967296, [a >>> 0, b >>> 0, c, d]];
}

/** Mutable cursor over a state copy; used inside a single engine step. */
export class RngCursor {
  constructor(public state: RngState) {}
  float(): number {
    const [v, n] = rngNext(this.state);
    this.state = n;
    return v;
  }
  int(maxExclusive: number): number {
    return Math.floor(this.float() * maxExclusive);
  }
  pickWeighted<T>(items: T[], weight: (t: T) => number): T | undefined {
    const total = items.reduce((s, i) => s + Math.max(0, weight(i)), 0);
    if (total <= 0) return undefined;
    let r = this.float() * total;
    for (const i of items) {
      r -= Math.max(0, weight(i));
      if (r < 0) return i;
    }
    return items[items.length - 1];
  }
}
