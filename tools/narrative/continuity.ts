// Continuity: text that contradicts the run's state. Plays bot runs, renders every step, and
// checks each sentence two ways:
//  1. Phrase rules: a phrase may appear only while a condition holds.
//  2. Dead names (if the adapter has dead()): a dead person named in a sentence that is not
//     about their death or memory. "Dead stay dead" was the commonest continuity bug.
//
//   npx tsx tools/narrative/continuity.ts [--runs=8] [--strict]
//
// The rules file (adapter.continuityFile) is YAML, a list or { rules: [...], dead_names_ok }:
//   rules:
//     - match: "your father (says|laughs|nods)"   # a regex, case-sensitive unless flags: i
//       allow: npc.father.alive                   # the game's condition grammar
//       why: the father dies of the fever in ch2   # what a hit means
//       chapters: [ch2, ch3]                      # optional: only in these groups
//       except: [mourn_father]                    # optional: scenes where it is right anyway
//   dead_names_ok:
//     c3_funeral: [hamon_darrell]                 # scene -> ids of the dead it may name ('*': any)
//   memorial:                                     # the game's own words for mourning, toasts, rites
//     - "under (his|her) tongue"                  # (added to MEMORIAL below; regexes, case-insensitive)
//
// The rules that paid for themselves: the dead do not speak or walk in; a title or office only
// once it is held; a ruler only while they rule; ages and years from state, never typed (one
// continuity report on Knight of Adalia led to 47 more of the same class).
import { readFileSync, existsSync } from 'node:fs';
import YAML from 'yaml';
import { loadAdapter, args, sentences } from './adapter';

export interface PhraseRuleSrc { match: string; allow: unknown; why?: string; flags?: string; chapters?: string[]; except?: string[] }

/** A sentence about a death or a memory may name the dead. */
export const MEMORIAL = /\b(dead|died|dies|die|death|dying|grave|graves|buried|bury|burial|remember|remembers|remembered|memory|ghost|late|killed|kill|kills|slain|mourn|mourned|mourning|pray|prayers?|mass|soul|tomb|widow|widowed|was|were|had|used to|always did|would have|named|name|after him|after her|lost|gone|missing|fell|fallen|body|bones|corpse|hanged|shot)\b/i;

if (import.meta.url === `file://${process.argv[1]}`) {
  const opt = args();
  const a = await loadAdapter();
  const content = a.load();
  const raw = a.continuityFile && existsSync(a.continuityFile) ? YAML.parse(readFileSync(a.continuityFile, 'utf8')) : null;
  const srcs: PhraseRuleSrc[] = Array.isArray(raw) ? raw : raw?.rules ?? [];
  const deadOk: Record<string, string[]> = (Array.isArray(raw) ? {} : raw?.dead_names_ok) ?? {};
  const memorial = [MEMORIAL, ...((Array.isArray(raw) ? [] : raw?.memorial) ?? []).map((m: string) => new RegExp(m, 'i'))];
  if (!srcs.length && !a.dead) { console.log('continuity: no rules file and no dead() in the adapter; nothing to check'); process.exit(0); }
  if (srcs.length && !a.cond) { console.error('continuity: rules need adapter.cond (the game\'s condition grammar)'); process.exit(1); }
  const errors: string[] = [];
  const rules = srcs.flatMap((src) => {
    const errs = a.cond!.validate(src.allow, content);
    if (errs.length) { errors.push(`rule "${src.match}": ${errs.join('; ')}`); return []; }
    return [{ src, re: new RegExp(src.match, src.flags ?? '') }];
  });
  const seen = new Map<string, string>();
  const hit = (k: string, line: string) => { if (!seen.has(k)) seen.set(k, line); };
  let views = 0;
  a.play(content, opt.runs ?? 8, (o) => {
    views++;
    const esc = (n: string) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dead = (a.dead?.(o.state, content) ?? []).filter((d) => d.names.length).map((d) => ({ id: d.id, re: new RegExp(`\\b(${d.names.map(esc).join('|')})\\b`) }));
    for (const t of o.texts) {
      const group = a.groupOf?.(content, t.scene);
      for (const sen of sentences(t.text)) {
        for (const r of rules) {
          if (r.src.except?.includes(t.scene)) continue;
          if (r.src.chapters && (!group || !r.src.chapters.includes(group))) continue;
          if (!r.re.test(sen) || a.cond!.test(r.src.allow, o.state, content)) continue;
          hit(`${r.src.match} @ ${t.scene}`, `${r.src.match} @ ${t.scene}${r.src.why ? `  (${r.src.why})` : ''}\n    ${sen.slice(0, 220)}`);
        }
        for (const d of dead) {
          if (!d.re.test(sen) || memorial.some((m) => m.test(sen)) || deadOk[t.scene]?.includes(d.id) || deadOk[t.scene]?.includes('*')) continue;
          hit(`dead: ${d.id} | ${sen}`, `dead: ${d.id} @ ${t.scene}  (named after their death)\n    ${sen.slice(0, 220)}`);
        }
      }
    }
  });
  for (const e of errors) console.log(`ERROR ${e}`);
  for (const line of seen.values()) console.log(line);
  console.log(`\ncontinuity: ${rules.length} rules, ${views} views, ${seen.size} distinct problems, ${errors.length} rule errors`);
  if (opt.strict && (seen.size || errors.length)) process.exit(1);
}
