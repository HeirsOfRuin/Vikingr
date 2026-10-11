// Animates a converted scene (DESIGN §19b). The picture is already in the master palette,
// so every pixel is an index into it. Animation moves pixels along colour ramps
// (fire flickers, light breathes, water glints) and moves strips of the picture
// (the crowd laughs). Sparks, smoke and gulls are the only things drawn on top.
// Pure pixel work on a 400 × 160 buffer: no blending, so the pixels stay pixels.
import type { ArtFx } from '../../content/schema';
import { MASTER } from './palette';

export const ART_W = 400;
export const ART_H = 160;

const RGB = MASTER.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] as const);
const lum = (i: number) => {
  const [r, g, b] = RGB[i]!;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const hexIdx = (h: string) => MASTER.indexOf(h as (typeof MASTER)[number]);
const ramp = (hexes: string[]) => hexes.map(hexIdx).filter((i) => i >= 0).sort((a, b) => lum(a) - lum(b));

/** Warm colours, dark to light: what firelight moves through. */
const WARM = ramp(['#1e1611', '#2a1e16', '#3d1410', '#3a2a1e', '#6b2018', '#5b4330', '#8f2a1f', '#7a4a1c', '#7d5e3f', '#b3352a', '#9c7a55', '#b8582a', '#a8692a', '#d0573a', '#c8913a', '#e08a3c', '#e3b558', '#f0d79a', '#f3ecdc']);
/** Water and sky, dark to light. */
const WATER = ramp(['#141f26', '#1c2a33', '#24343d', '#34495a', '#4d6773', '#6c8794', '#93abb5', '#a9b0b1', '#bcd0d6', '#c9cdca', '#e6ddc8']);
const posIn = (r: number[]) => {
  const m = new Int16Array(MASTER.length).fill(-1);
  r.forEach((idx, p) => (m[idx] = p));
  return m;
};
const WARM_POS = posIn(WARM);
const WATER_POS = posIn(WATER);
const SMOKE = [hexIdx('#30363a'), hexIdx('#434a4e'), hexIdx('#5a6266'), hexIdx('#737c80')];
const SPARK = [hexIdx('#e08a3c'), hexIdx('#e3b558'), hexIdx('#f0d79a')];
const GULL = hexIdx('#e6ddc8');
const GULL_SHADE = hexIdx('#5a6266');

// ---- noise ----
function hash(x: number, y: number, z: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(z | 0, 2147483647)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x: number, y: number, z: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y), z0 = Math.floor(z);
  const fx = x - x0, fy = y - y0, fz = z - z0;
  const s = (t: number) => t * t * (3 - 2 * t);
  const sx = s(fx), sy = s(fy), sz = s(fz);
  const l = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash(x0 + dx, y0 + dy, z0 + dz);
  return l(l(l(c(0, 0, 0), c(1, 0, 0), sx), l(c(0, 1, 0), c(1, 1, 0), sx), sy), l(l(c(0, 0, 1), c(1, 0, 1), sx), l(c(0, 1, 1), c(1, 1, 1), sx), sy), sz);
}

interface Particle { x: number; y: number; vx: number; vy: number; life: number; c: number; smoke: boolean }

export interface Mood {
  /** 0 still, 1 murmuring, 2 roaring. Drives the crowd. */
  laughter: number;
}

export class SceneAnimator {
  readonly base: Uint8Array;
  private parts: Particle[] = [];
  private seed = 1;
  private birds: { x: number; y: number; v: number; phase: number }[] = [];

  constructor(img: ImageData, readonly fx: ArtFx[]) {
    // map each pixel to its palette index (exact for converted art; nearest otherwise)
    this.base = new Uint8Array(ART_W * ART_H);
    const memo = new Map<number, number>();
    for (let i = 0; i < ART_W * ART_H; i++) {
      const r = img.data[i * 4]!, g = img.data[i * 4 + 1]!, b = img.data[i * 4 + 2]!;
      const key = (r << 16) | (g << 8) | b;
      let idx = memo.get(key);
      if (idx === undefined) {
        let best = 0, bd = Infinity;
        RGB.forEach(([pr, pg, pb], k) => {
          const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
          if (d < bd) { bd = d; best = k; }
        });
        idx = best;
        memo.set(key, idx);
      }
      this.base[i] = idx;
    }
    for (const f of fx) if (f.kind === 'birds') for (let k = 0; k < f.count; k++) this.birds.push({ x: f.rect[0] + this.rnd() * f.rect[2], y: f.rect[1] + this.rnd() * f.rect[3], v: 0.15 + this.rnd() * 0.2, phase: this.rnd() * 6 });
  }

  private rnd(): number {
    this.seed = (Math.imul(this.seed, 1103515245) + 12345) >>> 0;
    return this.seed / 4294967296;
  }

  /** Writes frame t (in frames at 12 fps) into out. */
  frame(t: number, mood: Mood, out: ImageData): void {
    const W = ART_W, H = ART_H;
    const buf = new Uint8Array(this.base);
    const tt = t / 12; // seconds

    for (const f of this.fx) {
      switch (f.kind) {
        case 'crowd': {
          // heads and shoulders rise and fall in a wave; louder laughter, bigger wave
          const [rx, ry, rw, rh] = f.rect;
          const amp = mood.laughter;
          for (let x = rx; x < rx + rw && x < W; x++) {
            const wave = Math.sin(tt * (2.2 + amp) + x * 0.15 + noise(x * 0.05, 0, tt * 0.5) * 4);
            const idle = noise(x * 0.12, 3, tt * 0.7) > 0.82 ? 1 : 0;
            const off = Math.max(idle, Math.round(amp * (0.5 + 0.5 * wave)));
            if (!off) continue;
            for (let y = ry; y < ry + rh - off && y < H - off; y++) buf[y * W + x] = this.base[(y + off) * W + x]!;
          }
          break;
        }
      }
    }
    for (const f of this.fx) {
      switch (f.kind) {
        case 'glow': {
          // the light on faces and timber breathes with the fire
          const [cx, cy] = f.at;
          const r2 = f.radius * f.radius;
          const x0 = Math.max(0, cx - f.radius), x1 = Math.min(W, cx + f.radius);
          const y0 = Math.max(0, cy - f.radius), y1 = Math.min(H, cy + f.radius);
          for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
            const d2 = (x - cx) ** 2 + (y - cy) ** 2;
            if (d2 > r2) continue;
            const i = y * W + x;
            const p = WARM_POS[buf[i]!]!;
            if (p < 0) continue;
            const n = noise(x / 14, y / 14, tt * 1.6);
            const fall = 1 - d2 / r2;
            const d = n > 0.72 - 0.12 * fall ? 1 : n < 0.22 ? -1 : 0;
            if (d) buf[i] = WARM[Math.max(0, Math.min(WARM.length - 1, p + d))]!;
          }
          break;
        }
        case 'fire': {
          // flames lick upward: noise scrolls up through the bright warm pixels
          const [rx, ry, rw, rh] = f.rect;
          for (let y = ry; y < ry + rh && y < H; y++) for (let x = rx; x < rx + rw && x < W; x++) {
            const i = y * W + x;
            const p = WARM_POS[this.base[i]!]!;
            if (p < WARM.length * 0.45) continue;
            const n = noise(x / 3, (y + tt * 14) / 3, tt * 2);
            const d = n > 0.66 ? 2 : n > 0.52 ? 1 : n < 0.25 ? -2 : n < 0.38 ? -1 : 0;
            buf[i] = WARM[Math.max(0, Math.min(WARM.length - 1, p + d))]!;
          }
          break;
        }
        case 'water': {
          const [rx, ry, rw, rh] = f.rect;
          for (let y = ry; y < ry + rh && y < H; y++) for (let x = rx; x < rx + rw && x < W; x++) {
            const i = y * W + x;
            const p = WATER_POS[buf[i]!]!;
            if (p < 0) continue;
            const n = noise(x / 7 - tt * 0.6, y * 0.9, tt * 0.3);
            const d = n > 0.7 ? 1 : n < 0.24 ? -1 : 0;
            if (d) buf[i] = WATER[Math.max(0, Math.min(WATER.length - 1, p + d))]!;
          }
          break;
        }
        case 'sparks':
          if (this.rnd() < (f.rate ?? 0.4)) this.parts.push({ x: f.at[0] + (this.rnd() - 0.5) * (f.spread ?? 8), y: f.at[1], vx: (this.rnd() - 0.5) * 0.5, vy: -0.8 - this.rnd() * 0.9, life: 14 + this.rnd() * 22, c: SPARK[Math.floor(this.rnd() * SPARK.length)]!, smoke: false });
          break;
        case 'smoke':
          if (this.rnd() < (f.rate ?? 0.4)) this.parts.push({ x: f.at[0] + (this.rnd() - 0.5) * (f.spread ?? 8), y: f.at[1], vx: (this.rnd() - 0.5) * 0.15, vy: -0.25 - this.rnd() * 0.2, life: 60 + this.rnd() * 60, c: SMOKE[Math.floor(this.rnd() * SMOKE.length)]!, smoke: true });
          break;
      }
    }
    // particles
    for (let k = this.parts.length - 1; k >= 0; k--) {
      const q = this.parts[k]!;
      q.x += q.vx;
      q.y += q.vy;
      q.life -= 1;
      if (q.smoke) q.vx += (this.rnd() - 0.5) * 0.04;
      if (q.life <= 0 || q.y < 0 || q.x < 0 || q.x >= W) { this.parts.splice(k, 1); continue; }
      if (q.smoke && (t + k) % 3 === 0) continue; // thin smoke flickers rather than blends
      const px = Math.round(q.x), py = Math.round(q.y);
      buf[py * W + px] = q.c;
    }
    // gulls: a two-frame wingbeat, drifting
    for (const b of this.birds) {
      b.x += b.v;
      if (b.x > W + 4) b.x = -4;
      const up = Math.sin(tt * 5 + b.phase) > 0;
      const px = Math.round(b.x), py = Math.round(b.y + Math.sin(tt * 0.7 + b.phase) * 2);
      const pts = up ? [[-2, -1], [-1, 0], [0, 0], [1, 0], [2, -1]] : [[-2, 1], [-1, 0], [0, 0], [1, 0], [2, 1]];
      for (const [dx, dy] of pts) {
        const x = px + dx!, y = py + dy!;
        if (x >= 0 && x < W && y >= 0 && y < H) buf[y * W + x] = dx === 0 ? GULL_SHADE : GULL;
      }
    }
    const d = out.data;
    for (let i = 0; i < W * H; i++) {
      const c = RGB[buf[i]!]!;
      d[i * 4] = c[0];
      d[i * 4 + 1] = c[1];
      d[i * 4 + 2] = c[2];
      d[i * 4 + 3] = 255;
    }
  }
}
