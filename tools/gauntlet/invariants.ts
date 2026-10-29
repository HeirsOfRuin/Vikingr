// What must always be true of a life, checked after every action (docs/FRAME-GAUNTLET.md, check 1).
// `error`: the game is broken. `season`: the calendar says something no Norseman would believe.
import type { ContentBundle } from '../../src/content/schema';
import type { GameState } from '../../src/engine/state';
import { dateOf } from '../../src/engine/calendar';
import { renderText } from '../../src/engine/text';
import { test } from '../../src/engine/conditions';
import { seaClosed } from '../../src/engine/tuning';

export type Severity = 'error' | 'season' | 'text';
export interface Problem { rule: string; severity: Severity; detail: string }

const NUMBERS: [string, (s: GameState) => number][] = [
  ['silver', (s) => s.silver], ['loot', (s) => s.loot], ['provisions', (s) => s.provisions], ['captives', (s) => s.captives],
  ['crew.men', (s) => s.crew.men], ['crew.morale', (s) => s.crew.morale], ['hero.hp', (s) => s.hero.hp], ['hamingja', (s) => s.hamingja],
  ['honour', (s) => s.honour], ['musterPool', (s) => s.musterPool], ['hoard', (s) => s.base.hoard],
];
const NEVER_NEGATIVE = new Set(['silver', 'loot', 'provisions', 'captives', 'crew.men', 'musterPool', 'hoard']);
/** A scene's text, rendered as the player sees it, must have no template left in it. */
const LEFTOVER = /\{[a-z_]+\}|\[\/?(if|else|elif)\b[^\]]*\]/; // [break] is a page break the screen splits on

export function checkStep(prev: GameState | null, s: GameState, content: ContentBundle): Problem[] {
  const out: Problem[] = [];
  const err = (rule: string, detail: string) => out.push({ rule, severity: 'error', detail });
  const season = (rule: string, detail: string) => out.push({ rule, severity: 'season', detail });
  if (prev && s.day < prev.day) err('time ran backwards', `day ${prev.day} to ${s.day}`);
  for (const [k, f] of NUMBERS) {
    const v = f(s);
    if (typeof v !== 'number' || !Number.isFinite(v)) err('broken number', `${k} = ${v}`);
    else if (NEVER_NEGATIVE.has(k) && v < 0) err('negative amount', `${k} = ${v}`);
  }
  for (const sh of s.ships) if (!(sh.hull >= 0 && sh.hull <= 100)) err('hull out of range', `${sh.name}: ${sh.hull}`);
  for (const [g, c] of Object.entries(s.cargo ?? {})) {
    if (!content.goods[g]) err('unknown goods in the hold', g);
    if (!(c.lots > 0)) err('empty goods entry', `${g}: ${c.lots} lots`);
  }
  if (!s.death && !s.at && !s.voyage) err('nowhere', 'neither in a place nor at sea');
  if (s.at && !content.places[s.at]) err('unknown place', s.at);
  for (const q of s.queue) if (!content.scenes[q.scene]) err('queued scene missing', q.scene);
  for (const sh of s.ships) {
    const [kind, who] = (sh.master ?? '').split(':');
    if (kind === 'sworn' && who && !s.men.some((m) => m.id === who && m.alive)) err('dead or gone shipmaster', `${sh.name}: ${who}`);
  }
  // a scene just opened: it exists, and what the player reads has no template left in it
  const opened = s.pending?.t === 'scene' && (prev?.pending?.t !== 'scene' || (prev.pending as { id: string }).id !== s.pending.id);
  if (s.pending?.t === 'scene') {
    const sc = content.scenes[s.pending.id];
    if (!sc) err('open scene missing', s.pending.id);
    else if (opened) {
      const texts = [renderText(sc.text, s, content, { keepDead: sc.id.startsWith('mourn_') }), renderText(sc.title ?? '', s, content), ...sc.choices.filter((c) => test(c.visible_if, s, content)).map((c) => renderText(c.text, s, content))];
      for (const t of texts) { const m = LEFTOVER.exec(t); if (m) err('template left in text', `${sc.id}: "${m[0]}"`); }
      if (!sc.choices.some((c) => test(c.visible_if, s, content))) err('scene with no visible choice', sc.id);
    }
  }
  // a report just shown: no template, and no "It took 0 men"
  if (s.pending?.t === 'report' && (prev?.pending !== s.pending)) {
    for (const l of (s.pending as { lines: string[] }).lines) {
      const m = LEFTOVER.exec(l);
      if (m) err('template left in text', `report "${(s.pending as { title: string }).title}": "${m[0]}"`);
      const lower = /(?:^|[.!?]\s+)(the|a|an|her|his|their|your)\s+[A-ZÞÐÁ]/.exec(l);
      if (lower) out.push({ rule: 'sentence starts in lower case', severity: 'text', detail: `report "${(s.pending as { title: string }).title}": "${l.slice(Math.max(0, lower.index), lower.index + 40)}"` });
      const z = /\b(?:took|lost|cost|died|killed|paid|gave)\s+(?:0|no)\s+(men|man|coins?|pounds?)\b|\b0 (men|coins|pounds|days|lots)\b/.exec(l);
      if (z) out.push({ rule: 'nothing in the text', severity: 'text', detail: `report "${(s.pending as { title: string }).title}": "${l.slice(Math.max(0, z.index - 40), z.index + 30)}"` });
    }
  }
  // the calendar
  const { doy } = dateOf(s.day);
  if (s.phase === 'winter' && doy >= 120 && doy < 243) season('winter in summer', `phase winter on day ${doy}`);
  // the sea is closed from December to the end of February: no ship may put out (a voyage under way may finish)
  if (prev && prev.at && !prev.voyage && s.voyage && seaClosed(dateOf(prev.day).doy)) err('put to sea in the closed season', `from ${prev.at} on day ${dateOf(prev.day).doy}`);
  if (s.phase === 'muster' && doy > 150) season('muster after May', `phase muster on day ${doy} at ${s.at}`);
  return out;
}
