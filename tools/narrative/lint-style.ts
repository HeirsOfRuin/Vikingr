// Style lint: the ```banned and ```watch fences in the game's style guide, run over every
// player-facing string as written. A banned phrase fails (exit 1); a watched one is listed.
//
//   npx tsx tools/narrative/lint-style.ts
//
// Fences: ```banned (errors) and ```watch or ```warning (warnings). A fence line is a phrase (matched as whole words, either apostrophe) or /a regex/.
// Lines starting # are comments. Template syntax ({var}, [if ...]) is stripped first so
// condition paths cannot trip a rule. Knight of Adalia and Vikingr shipped near-identical
// copies of this; this is the one.
import { readFileSync } from 'node:fs';
import { loadAdapter, type Written } from './adapter';

export interface StyleRule { pattern: RegExp; source: string; severity: 'error' | 'warning' }
export interface StyleHit { severity: 'error' | 'warning'; where: string; rule: string; excerpt: string }

export function parseStyleGuide(md: string): StyleRule[] {
  const rules: StyleRule[] = [];
  for (const [kind, severity] of [['banned', 'error'], ['watch', 'warning']] as const) {
    // the watch list's fence may be ```watch or ```warning (Vikingr's name for it)
    const block = new RegExp('```' + (kind === 'watch' ? '(?:watch|warning)' : kind) + '\\n([\\s\\S]*?)```').exec(md);
    if (!block) throw new Error(`style guide: missing \`\`\`${kind} block`);
    for (const raw of block[1]!.split('\n')) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const re = line.startsWith('/') && line.endsWith('/') && line.length > 2
        ? new RegExp(line.slice(1, -1), 'gi')
        : new RegExp(`(?<![\\w'])${line.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/'/g, "['\u2019]")}(?![\\w'])`, 'gi');
      rules.push({ pattern: re, source: line, severity });
    }
  }
  return rules;
}

export function lint(texts: Written[], rules: StyleRule[]): StyleHit[] {
  const hits: StyleHit[] = [];
  for (const { where, text } of texts) {
    const plain = text.replace(/\[(?:if|elif) [^\]]*\]|\[else\]|\[\/if\]|\[break\]|\{[A-Za-z_.@]+\}/g, ' ');
    for (const r of rules) {
      r.pattern.lastIndex = 0;
      for (const m of plain.matchAll(r.pattern)) {
        const i = m.index ?? 0;
        hits.push({ severity: r.severity, where, rule: r.source, excerpt: plain.slice(Math.max(0, i - 30), i + m[0].length + 30).replace(/\s+/g, ' ').trim() });
      }
    }
  }
  return hits;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = await loadAdapter();
  const content = a.load();
  const rules = parseStyleGuide(readFileSync(a.styleGuide, 'utf8'));
  const texts = a.textsOf(content);
  const hits = lint(texts, rules);
  for (const h of hits) console.log(`${h.severity === 'error' ? 'ERROR  ' : 'warning'} ${h.where}: "${h.rule}" in "...${h.excerpt}..."`);
  const errors = hits.filter((h) => h.severity === 'error').length;
  console.log(`style: ${rules.length} rules over ${texts.length} strings, ${errors} errors, ${hits.length - errors} warnings`);
  process.exit(errors ? 1 : 0);
}
