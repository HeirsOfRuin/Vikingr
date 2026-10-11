import { useEffect, useRef } from 'preact/hooks';

const css = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/** An Urnes-style band: two thick strands over and under at each crossing, a thin strand beneath, a snake head. */
export function Knot() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const draw = () => {
      const c = ref.current;
      if (!c) return;
      const W = c.clientWidth, H = 40, dpr = Math.min(2, devicePixelRatio || 1);
      c.width = W * dpr;
      c.height = H * dpr;
      const g = c.getContext('2d')!;
      g.scale(dpr, dpr);
      g.lineCap = 'round';
      const mid = H / 2, amp = 11, wave = 56, end = W - 30;
      const ys = [(x: number) => mid + amp * Math.sin((x / wave) * Math.PI), (x: number) => mid - amp * Math.sin((x / wave) * Math.PI)];
      const thin = (x: number) => mid + 15 * Math.sin((x / wave) * Math.PI * 1.5 + 1);
      const seg = (f: (x: number) => number, x0: number, x1: number, w: number, col: string) => {
        g.beginPath();
        for (let x = x0; x <= x1; x++) g[x === x0 ? 'moveTo' : 'lineTo'](x, f(x));
        g.strokeStyle = css('--soot'); g.lineWidth = w + 4; g.stroke();
        g.strokeStyle = col; g.lineWidth = w; g.stroke();
      };
      const cols = [css('--rune-red'), css('--rune-red-dark')];
      seg(thin, 4, end, 1.4, css('--bone-dim'));
      seg(ys[1]!, 0, end, 4, cols[1]!);
      seg(ys[0]!, 0, end, 4, cols[0]!);
      for (let k = 1; k * wave < end; k++) {
        const top = k % 2;
        seg(ys[top]!, Math.max(0, k * wave - 10), Math.min(end, k * wave + 10), 4, cols[top]!);
      }
      const hy = ys[0]!(end);
      g.fillStyle = cols[0]!; g.strokeStyle = css('--soot'); g.lineWidth = 2;
      g.beginPath(); g.ellipse(end + 11, hy, 11, 6, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.fillStyle = css('--bone'); g.beginPath(); g.arc(end + 14, hy - 2, 1.8, 0, Math.PI * 2); g.fill();
    };
    draw();
    addEventListener('resize', draw);
    return () => removeEventListener('resize', draw);
  }, []);
  return <canvas ref={ref} class="knot" aria-hidden="true" />;
}

// 12 × 12 pixel icons. '.' is empty; letters name palette tokens.
const ICONS: Record<string, string[]> = {
  now: ['.....r......', '....rro.....', '....ror.....', '...roor.....', '...rooor....', '....rbr.....', '....kbk.....', '.....k......', '.....k......', '.....k......', '....kkk.....', '............'],
  map: ['.....b......', '.....bb.....', '.....bbb....', '.....bbbb...', '.....b......', '.r...b...r..', '.rrrrrrrrr..', '..rrrrrrr...', '...rrrrr....', '.sssssssss..', 's.s.s.s.s.s.', '............'],
  hero: ['............', '....iiii....', '...iiiiii...', '..iiiiiiii..', '..iiiiiiii..', '..iiikkiii..', '..iik..kii..', '..ii.kk.ii..', '..i..ii..i..', '.....ii.....', '............', '............'],
  crew: ['............', '............', '.rr..bb..rr.', 'rrrrbbbbrrrr', 'rrirbbibrrir', 'rrrrbbbbrrrr', '.rr..bb..rr.', '............', '.k..k..k..k.', '.k..k..k..k.', '............', '............'],
  saga: ['....bbbb....', '...bbbbbb...', '..bbrbbbbb..', '..bbbrrbbb..', '..bbbbbrbb..', '..bbrrbbbb..', '..bbbbrbbb..', '..bbbrbbbb..', '..bbbbbbbb..', '..bbbbbbbb..', '.kkkkkkkkkk.', '............'],
};
const TOKENS: Record<string, string> = { r: '--rune-red', o: '--ochre', b: '--bone', k: '--granite-500', i: '--iron', s: '--sea' };

/** A tab icon, in colour when on and in stone when off. */
export function PixelIcon({ name, on }: { name: string; on: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, 12, 12);
    (ICONS[name] ?? []).forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      g.fillStyle = on ? css(TOKENS[ch]!) : ch === 'k' || ch === 'i' ? css('--granite-700') : css('--granite-500');
      g.fillRect(x, y, 1, 1);
    }));
  }, [name, on]);
  return <canvas ref={ref} width={12} height={12} aria-hidden="true" />;
}
