// What does each choice actually do? For every outcome of every choice it classifies the effects:
//   now      changes something the player can see (stats, standing, coin, people, items)
//   later    sets a flag or counter that a later condition, check or branch reads, or branches itself
//   flavour  sets a flag that only later text reads
//   none     does nothing at all
// A choice is "hollow" when none of its outcomes is better than flavour. Hollow choices are not
// always wrong (a choice of voice can be the point), but a chapter full of them reads as a
// corridor, and playtesters say "my choices don't matter" (Knight of Adalia, Vikingr).
//
//   npx tsx tools/narrative/audit-choices.ts [--group=ch2] [--list]
import { loadAdapter, args, type AuditChoice } from './adapter';

type Kind = 'now' | 'later' | 'flavour' | 'none';
const RANK: Record<Kind, number> = { none: 0, flavour: 1, later: 2, now: 3 };
const OUTCOMES = ['success', 'partial', 'failure'];

if (import.meta.url === `file://${process.argv[1]}`) {
  const opt = args();
  const a = await loadAdapter();
  const content = a.load();
  const scenes = a.scenes(content);
  const TEXT_KEYS = new Set(a.textKeys ?? ['text', 'text_after', 'result', 'title', 'label', 'warn', 'description', 'journal', 'die', 'desc']);

  // every flag.x / counter.x a scene reads: in mechanics (conditions, checks) or only in text
  const mechReads = new Set<string>();
  const textReads = new Set<string>();
  const collect = (node: unknown, inText: boolean): void => {
    if (typeof node === 'string') { for (const m of node.matchAll(/\b(flag|counter)\.([a-z0-9_]+)/g)) (inText ? textReads : mechReads).add(`${m[1]}.${m[2]}`); return; }
    if (Array.isArray(node)) { node.forEach((n) => collect(n, inText)); return; }
    if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) {
      if (k === 'set' || k === 'clear') continue; // writes, not reads
      if (k === 'add' && v && typeof v === 'object') continue;
      collect(v, inText || TEXT_KEYS.has(k));
    }
  };
  for (const s of scenes) collect(s, false);
  for (const extra of a.readsFrom?.(content) ?? []) collect(extra, false);

  const classify = (effects: unknown[]): Kind => {
    let best: Kind = 'none';
    const up = (k: Kind) => { if (RANK[k] > RANK[best]) best = k; };
    const walk = (es: unknown[]) => {
      for (const e of es as Record<string, unknown>[]) {
        if (!e || typeof e !== 'object') continue;
        if ('if' in e || 'chance' in e) { walk((e.then as unknown[]) ?? []); walk((e.else as unknown[]) ?? []); continue; }
        if ('set' in e) { const f = String(e.set); up(mechReads.has(f) ? 'later' : textReads.has(f) ? 'flavour' : 'none'); }
        else if ('add' in e && e.add && typeof e.add === 'object') {
          for (const p of Object.keys(e.add)) up(p.startsWith('counter.') ? (mechReads.has(p) ? 'later' : 'none') : 'now');
        } else if ('clear' in e || 'journal' in e) { /* no lasting change by itself */ }
        else up('now');
      }
    };
    walk(effects);
    return best;
  };
  const outcomes = (c: AuditChoice): [string, unknown[], unknown][] => {
    if (!c.check) return [['direct', c.effects ?? [], c.next]];
    return OUTCOMES.filter((k) => c[k]).map((k) => {
      const o = c[k] as { effects?: unknown[]; next?: unknown };
      return [k, [...(c.effects ?? []), ...(o.effects ?? [])], o.next ?? c.next];
    });
  };

  const by: Record<string, Record<Kind | 'total', number>> = {};
  const hollow: string[] = [];
  for (const s of scenes) {
    if (opt.group && s.group !== opt.group) continue;
    if (s.choices.length < 2) continue; // a "Go on." bridge is not a choice
    const nexts = s.choices.map((c) => JSON.stringify(c.next ?? null));
    const common = [...nexts].sort((x, y) => nexts.filter((n) => n === y).length - nexts.filter((n) => n === x).length)[0];
    for (const c of s.choices) {
      const kinds = outcomes(c).map(([label, es, next]) => [label, classify(es), JSON.stringify(next ?? null)] as const);
      let best = kinds.reduce<Kind>((b, [, k]) => (RANK[k] > RANK[b] ? k : b), 'none');
      if (kinds.some(([, , n]) => n !== common) && RANK[best] < RANK.later) best = 'later'; // a branch matters
      const t = (by[s.group] ??= { now: 0, later: 0, flavour: 0, none: 0, total: 0 });
      t[best]++; t.total++;
      if (RANK[best] <= 1) hollow.push(`${s.group.padEnd(8)} ${s.id}/${c.id}: ${best} [${kinds.map(([l, k]) => `${l}=${k}`).join(' ')}] "${String(c.text).slice(0, 70)}"`);
    }
  }
  console.log(`${a.name}: what each choice does`);
  console.log('group     choices  now  later  flavour  none');
  for (const [g, t] of Object.entries(by)) console.log(`${g.padEnd(9)} ${String(t.total).padStart(7)} ${String(t.now).padStart(4)} ${String(t.later).padStart(6)} ${String(t.flavour).padStart(8)} ${String(t.none).padStart(5)}`);
  console.log(`\nhollow choices (nothing better than flavour): ${hollow.length}${opt.list ? '' : '  (--list to see them)'}`);
  if (opt.list) hollow.forEach((h) => console.log('  ' + h));
}
