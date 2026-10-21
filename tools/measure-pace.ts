// Pacing (docs/FRAME-PACING.md): taps a year, scenes a year, new scenes a year, and taps per scene, 830-850.
// 30 freedman raider lives. The drag shows as taps per new scene climbing year on year.
import { loadContent } from './content-loader';
import { Bot, BOT_OPTS } from './bot-lib';
import { act, newGame, screenOf } from '../src/engine/index';
import { RngCursor, seedRng } from '../src/engine/rng';
import { dateOf } from '../src/engine/calendar';
const c = loadContent();
// --orders: the same lives, going a-viking on standing orders
BOT_OPTS.cruise = process.argv.includes('--orders');
const per: Record<number, { acts: number; scenes: number; unique: number; dated: number; lives: number; legs: number; choice: number }> = {};
const isDated = (id: string) => /^(sp_|fr_|do_|ir_|sn_|cw_|lg_|ru_|j_|y_|c_|l_|k_|sk_|b_|i_)/.test(id) || /^(83\d|84\d)/.test(id);
for (let i = 0; i < 30; i++) {
  let s = newGame(c, { background: 'freedman', seed: 8800 + i, name: 'B' });
  const bot = new Bot('raider', new RngCursor(seedRng((8800 + i) ^ 0x5bd1e995)));
  const seenAt = new Set<string>();
  let lastPending = '';
  const yrs = new Set<number>();
  let steps = 0;
  while (!s.death && dateOf(s.day).year < 851 && steps < 60000) {
    const y = dateOf(s.day).year;
    if (!yrs.has(y)) { yrs.add(y); (per[y] ??= { acts: 0, scenes: 0, unique: 0, dated: 0, lives: 0, legs: 0, choice: 0 }).lives++; }
    const a = bot.choose(s, c)!;
    const scr = screenOf(s);
    try { s = act(c, s, a); } catch { break; }
    steps++;
    const p = per[y]!;
    p.acts++;
    if (a.t === 'sail' || a.t === 'follow') p.legs++;
    if (scr === 'scene') p.choice++;
    const pid = s.pending?.t === 'scene' ? `${s.pending.id}@${s.day}` : '';
    if (pid && pid !== lastPending) { p.scenes++; const id = s.pending!.t === 'scene' ? (s.pending as any).id : ''; if (!seenAt.has(id)) { seenAt.add(id); p.unique++; } if (isDated(id)) p.dated++; }
    lastPending = pid;
  }
}
console.log('year lives | actions/yr | scenes/yr  new  story-ish | actions per scene | sea legs');
for (const [y, p] of Object.entries(per)) {
  const n = p.lives;
  console.log(`${y} ${String(n).padStart(3)} | ${(p.acts / n).toFixed(0).padStart(5)} | ${(p.scenes / n).toFixed(1).padStart(5)} ${(p.unique / n).toFixed(1).padStart(5)} ${(p.dated / n).toFixed(1).padStart(5)} | ${(p.acts / Math.max(1, p.scenes)).toFixed(1).padStart(5)} | ${(p.legs / n).toFixed(1)}`);
}
