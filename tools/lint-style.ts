// Style lint: the banned and warning lists in content/style-guide.md, run over every
// piece of player-facing text in /content. Exit 1 on a banned pattern.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent } from './content-loader';
import type { ContentBundle } from '../src/content/schema';

const guide = readFileSync(join(import.meta.dirname, '..', 'content', 'style-guide.md'), 'utf8');

function fence(name: string): RegExp[] {
  const m = new RegExp('```' + name + '\\n([\\s\\S]*?)```').exec(guide);
  if (!m) throw new Error(`style-guide.md has no \`\`\`${name} block`);
  return m[1]!.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => {
    if (l.startsWith('/') && l.endsWith('/')) return new RegExp(l.slice(1, -1), 'i');
    return new RegExp(`\\b${l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  });
}

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
      for (const e of [...(ch.effects ?? []), ...(ch.success?.effects ?? []), ...(ch.failure?.effects ?? [])]) if ('journal' in e) add(w, e.journal);
    }
  }
  for (const p of Object.values(c.places)) add(`place ${p.id}`, p.desc);
  for (const b of Object.values(c.backgrounds)) add(`background ${b.id}`, b.desc);
  for (const i of Object.values(c.injuries)) add(`injury ${i.id}`, i.desc);
  for (const m of Object.values(c.men)) add(`man ${m.id}`, m.desc);
  for (const f of Object.values(c.fighters)) add(`fighter ${f.id}`, f.desc);
  for (const f of Object.values(c.foes)) add(`foe ${f.id}`, f.desc);
  for (const s of Object.values(c.ships)) add(`ship ${s.id}`, s.desc);
  for (const r of Object.values(c.rivals)) add(`rival ${r.id}`, r.note);
  return out;
}

const banned = fence('banned');
const warning = fence('warning');
const content = loadContent();
let errors = 0;
let warns = 0;
for (const { where, text } of texts(content)) {
  for (const re of banned) if (re.test(text)) { console.log(`  BANNED ${re} in ${where}: "${text.match(re)![0]}"`); errors++; }
  for (const re of warning) if (re.test(text)) { console.log(`  warning ${re} in ${where}`); warns++; }
}
console.log(`lint-style: ${errors} banned, ${warns} warnings`);
if (errors) process.exit(1);
