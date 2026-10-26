// Vikingr on the game-narrative text tools (tools/narrative/): lint-style, render-scan,
// continuity and audit-choices read the game through this file only.
import { join } from 'node:path';
import { loadContent } from './content-loader';
import { Bot, POLICIES } from './bot-lib';
import { newGame, act } from '../src/engine/index';
import { renderText } from '../src/engine/text';
import { RngCursor, seedRng } from '../src/engine/rng';
import { dateOf } from '../src/engine/calendar';
import { validateCond, test } from '../src/engine/conditions';
import type { ContentBundle, Effect } from '../src/content/schema';
import type { GameState } from '../src/engine/state';
import type { NarrativeAdapter, Seen } from './narrative/adapter';

const CONTENT = join(import.meta.dirname, '..', 'content');
const YEARS = 10;

/** Every player-facing string, with where it lives. */
export function texts(c: ContentBundle): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  const add = (where: string, text: string | undefined) => { if (text) out.push({ where, text }); };
  for (const s of Object.values(c.scenes)) {
    add(`scene ${s.id}`, s.title);
    add(`scene ${s.id}`, s.text);
    for (const ch of s.choices) {
      const w = `scene ${s.id}/${ch.id}`;
      add(w, ch.text);
      add(w, ch.result);
      add(w, ch.success?.text);
      add(w, ch.failure?.text);
      const walk = (es: Effect[] | undefined): void => {
        for (const e of es ?? []) {
          if ('if' in e) { walk(e.then); walk(e.else); }
          else if ('journal' in e) add(w, e.journal);
          else if ('nickname' in e) add(w, e.nickname);
        }
      };
      walk(ch.effects); walk(ch.success?.effects); walk(ch.failure?.effects);
    }
  }
  for (const p of Object.values(c.places)) add(`place ${p.id}`, p.desc);
  for (const b of Object.values(c.backgrounds)) { add(`background ${b.id}`, b.desc); for (const k of b.skill_sets) add(`background ${b.id} ${k.id}`, k.desc); }
  for (const i of Object.values(c.injuries)) add(`injury ${i.id}`, i.desc);
  for (const m of Object.values(c.men)) add(`man ${m.id}`, m.desc);
  for (const f of Object.values(c.fighters)) add(`fighter ${f.id}`, f.desc);
  for (const f of Object.values(c.foes)) add(`foe ${f.id}`, f.desc);
  for (const s of Object.values(c.ships)) add(`ship ${s.id}`, s.desc);
  for (const r of Object.values(c.rivals)) add(`rival ${r.id}`, r.note);
  c.banter.forEach((b, i) => add(`banter ${i} (${b.who})`, b.text));
  for (const b of Object.values(c.boasts)) add(`boast ${b.id}`, b.text);
  return out;
}

/** One life per (background, policy, seed), YEARS long, rendered as the UI renders it. */
function play(content: ContentBundle, runs: number, observe: (o: { state: GameState; scene: string; texts: Seen[] }) => void): void {
  for (const bg of Object.keys(content.backgrounds)) for (const [pi, policy] of POLICIES.entries()) for (let i = 0; i < runs; i++) {
    const seed = 11 + i * 104729 + pi * 7919;
    let state = newGame(content, { background: bg, seed, name: 'Bot' });
    const bot = new Bot(policy, new RngCursor(seedRng(seed ^ 0x5bd1e995)));
    const start = dateOf(state.day).year;
    for (let step = 0; step < 4000 && !state.death && dateOf(state.day).year < start + YEARS; step++) {
      const p = state.pending;
      const texts: Seen[] = [];
      if (p?.t === 'scene') {
        const sc = content.scenes[p.id];
        if (sc) {
          const keepDead = sc.id.startsWith('mourn_');
          texts.push({ kind: 'text', scene: sc.id, text: renderText(sc.text, state, content, { keepDead }) }, { kind: 'title', scene: sc.id, text: renderText(sc.title ?? '', state, content) });
          for (const c of sc.choices) texts.push({ kind: 'choice', scene: sc.id, text: renderText(c.text, state, content) });
        }
      } else if (p?.t === 'report') {
        texts.push({ kind: 'outcome', scene: `report: ${p.title}`, text: p.lines.join('\n\n') }, { kind: 'title', scene: `report: ${p.title}`, text: p.title });
      }
      if (texts.length) observe({ state, scene: p?.t === 'scene' ? p.id : `(${p?.t})`, texts });
      const a = bot.choose(state, content);
      if (!a) break;
      try { state = act(content, state, a); } catch { break; }
    }
  }
}

export const adapter: NarrativeAdapter<ContentBundle, GameState> = {
  name: 'Vikingr',
  load: () => loadContent(),
  styleGuide: join(CONTENT, 'style-guide.md'),
  textsOf: texts,
  play,
  scenes: (content) => Object.values(content.scenes).map((s) => ({ ...s, group: s.id.split('_')[0]! }) as never),
  // registries read flags too (a captain's bias, the chronicle, deeds): everything but the scenes
  readsFrom: (content) => Object.entries(content).filter(([k]) => k !== 'scenes').map(([, v]) => v),
  textKeys: ['text', 'result', 'title', 'when', 'journal', 'nickname', 'desc', 'note'],
  cond: { validate: (src, c) => validateCond(src as never, c), test: (src, s, c) => test(src as never, s, c) },
  continuityFile: join(CONTENT, 'continuity.yaml'),
  dead: (s, content) => [
    ...Object.entries(s.captains ?? {}).filter(([, c]) => !c.alive).map(([id]) => ({ id, names: [content.captains[id]?.name ?? id].filter((n) => n.length > 3) })),
    ...s.men.filter((m) => !m.alive).map((m) => ({ id: m.id, names: [m.name] })),
  ],
};
