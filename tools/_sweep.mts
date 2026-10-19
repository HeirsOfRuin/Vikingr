import { loadContent } from './content-loader';
import { playLife } from './bot-lib';
import { dateOf } from '../src/engine/calendar';
const content = loadContent();
const YS = /^(sp_831|j_council|sp_832|y_feast|y_volva|y_flyting|h_return|h_ormr|w1_|h1_return|sp_father|j_gyda)/;
for (const bg of ['outlaw', 'younger_son', 'freedman']) {
  let bad = 0, returns: number[] = [], missingSpring = 0, lives = 0;
  for (let i = 0; i < 60; i++) {
    const r = playLife(content, 'raider', 2000 + i, 8, bg);
    lives++;
    const s = r.state;
    if (r.error) console.log(bg, 'ERROR', r.error);
    if (bg === 'outlaw') {
      for (const [id, d] of Object.entries(s.seen)) if (YS.test(id)) { bad++; if (bad < 6) console.log(bg, i, 'saw', id, JSON.stringify(dateOf(d as number))); }
      if (s.seen.o_return !== undefined) returns.push(dateOf(s.seen.o_return as number).month + 1);
    }
    const springs = new Set(s.journal.filter((j) => /^Spring of \d+/.test(j.text)).map((j) => Number(/\d+/.exec(j.text)![0])));
    const last = dateOf(s.day).year;
    for (let y = 831; y < last; y++) if (!springs.has(y)) { missingSpring++; if (missingSpring < 4) console.log(bg, i, 'no spring of', y, s.death ? 'dead' : ''); }
  }
  const months: Record<number, number> = {}; for (const m of returns) months[m] = (months[m] ?? 0) + 1;
  console.log(bg, 'lives', lives, 'wrong-story scenes', bad, 'return month', JSON.stringify(months), 'missing springs', missingSpring);
}
