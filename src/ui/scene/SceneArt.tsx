import { useEffect, useRef } from 'preact/hooks';
import type { ArtEntry } from '../../content/schema';
import { ART_H, ART_W, SceneAnimator, type Mood } from './render';

// Every converted picture, bundled by Vite (inlined in the single-file preview, separate files in the app).
const FILES = import.meta.glob('../../art/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
export const ART_URLS: Record<string, string> = Object.fromEntries(Object.entries(FILES).map(([p, u]) => [p.replace(/^.*\/(.*)\.png$/, '$1'), u]));

const FPS = 12;
const decoded = new Map<string, Promise<ImageData>>();

function load(key: string): Promise<ImageData> {
  let p = decoded.get(key);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = ART_W;
        c.height = ART_H;
        const g = c.getContext('2d')!;
        g.drawImage(img, 0, 0, ART_W, ART_H);
        resolve(g.getImageData(0, 0, ART_W, ART_H));
      };
      img.onerror = () => reject(new Error(`art ${key} did not load`));
      img.src = ART_URLS[key]!;
    });
    decoded.set(key, p);
  }
  return p;
}

/** A scene's picture, animated at 12 frames a second while it is on screen. Still for reduced motion. */
export function SceneArt({ entry, mood }: { entry: ArtEntry; mood: Mood }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const moodRef = useRef(mood);
  moodRef.current = mood;

  useEffect(() => {
    const cv = canvas.current;
    if (!cv || !ART_URLS[entry.id]) return;
    let stop = false;
    let raf = 0;
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = !!e?.isIntersecting; });
    io.observe(cv);
    load(entry.id).then((img) => {
      if (stop) return;
      const g = cv.getContext('2d')!;
      const out = g.createImageData(ART_W, ART_H);
      const anim = new SceneAnimator(img, entry.fx ?? []);
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches || !(entry.fx ?? []).length;
      let t = 0;
      anim.frame(0, { laughter: 0 }, out);
      g.putImageData(out, 0, 0);
      if (still) return;
      let last = 0;
      const loop = (now: number) => {
        if (stop) return;
        raf = requestAnimationFrame(loop);
        if (!visible || document.hidden || now - last < 1000 / FPS) return;
        last = now;
        anim.frame(++t, moodRef.current, out);
        g.putImageData(out, 0, 0);
      };
      raf = requestAnimationFrame(loop);
    }).catch(() => undefined);
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [entry.id]);

  return (
    <div class="art">
      <canvas ref={canvas} width={ART_W} height={ART_H} role="img" aria-label={entry.title} />
    </div>
  );
}
