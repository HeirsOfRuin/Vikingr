// The gauntlet's one-page report (docs/FRAME-GAUNTLET.md): everything the last run found, the phone sweep's
// screens, and the playtest script with save codes to copy. Reads gauntlet-out/report.json and phone.json.
// Usage: npm run gauntlet && npm run build && npm run gauntlet:phone && npm run gauntlet:report
// Writes gauntlet-out/report.html (self-contained: screenshots are embedded).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = join(import.meta.dirname, '..', '..', 'gauntlet-out');
const r = JSON.parse(readFileSync(join(OUT, 'report.json'), 'utf8'));
const phone: { screen: string; tab: string; shot: string; problems: string[] }[] = existsSync(join(OUT, 'phone.json')) ? JSON.parse(readFileSync(join(OUT, 'phone.json'), 'utf8')) : [];
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

type Finding = { rule: string; severity: string; detail: string; life: { n: number; era: number; bg: string; style: string; seed: number }; step: number; date: string; where: string; code?: string };
const findings = Object.values(r.findings as Record<string, Finding[]>).flat();
const errors = findings.filter((f) => f.severity === 'error');
const texts = findings.filter((f) => f.severity === 'text');
const seasons = findings.filter((f) => f.severity === 'season');
const fair = (r.fairness as { scene: string; choice: string; fought: number; won: number; died: number }[]).filter((f) => f.fought >= 20);
const lop = fair.filter((f) => f.won / f.fought < 0.1 || f.won / f.fought > 0.95).sort((a, b) => a.won / a.fought - b.won / b.fought);
const phoneBad = phone.filter((p) => p.problems.length);
const total = r.never.length + Object.keys(r.counts).length; void total;
const seenPct = (() => { const m = /(\d+) of (\d+) scenes seen/.exec(readFileSync(join(OUT, 'report.md'), 'utf8')); return m ? { seen: +m[1]!, all: +m[2]!, pct: Math.round((100 * +m[1]!) / +m[2]!) } : null; })();
const golden = r.golden as { baseline: boolean; total: number; changed: string[] } | null;

const chip = (label: string, value: string, state: 'ok' | 'warn' | 'bad') => `<div class="chip ${state}"><span class="k">${esc(label)}</span><span class="v">${esc(value)}</span></div>`;
let id = 0;
const code = (c: string | undefined) => (c ? `<div class="code"><textarea id="code-${++id}" readonly rows="2">${esc(c)}</textarea><button type="button" data-copy="code-${id}">Copy code</button></div>` : '');
const finding = (f: Finding) => `<li><p><b>${esc(f.rule)}</b>: ${esc(f.detail)}</p><p class="meta">${esc(f.where)}, ${esc(f.date)}. Life ${f.life.n}: ${f.life.era}, ${esc(f.life.bg.replace('_', ' '))}, played ${esc(f.life.style)}.</p>${code(f.code)}</li>`;
const pct = (f: { won: number; fought: number }) => Math.round((100 * f.won) / f.fought);
const imgs = phone.map((p) => {
  const file = join(OUT, 'phone', p.shot);
  const src = existsSync(file) ? `data:image/jpeg;base64,${readFileSync(file).toString('base64')}` : '';
  return `<figure class="${p.problems.length ? 'bad' : ''}"><img src="${src}" alt="${esc(p.screen)} screen, ${esc(p.tab)} tab, at phone width" loading="lazy" width="195" height="422"><figcaption>${esc(p.screen.replace(/-\d+$/, '').replace(/^place-/, 'ashore, '))}${p.tab !== 'now' ? ` · ${esc(p.tab)}` : ''}${p.problems.map((x) => `<span class="prob">${esc(x)}</span>`).join('')}</figcaption></figure>`;
}).join('');
const dash = r.dashboard as Record<string, Record<string, number>>;

const html = `<title>Vikingr Gauntlet</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alegreya+SC:wght@500;700&family=Alegreya+Sans:wght@400;500;700&family=Alegreya:ital@0;1&display=swap">
<style>
/* Layout: a test log read top to bottom, verdict first: status strip, what to play, what broke, then the evidence. The game's own iron and ochre. */
:root {
  --bg: #f1eee6; --panel: #e7e2d6; --ink: #24262a; --muted: #5e6467; --rule: #c9c1ae;
  --accent: #9a6a1f; --ok: #3f6b4a; --warn: #9a6a1f; --bad: #a2382a;
  --f-display: 'Alegreya SC', 'Alegreya', Georgia, serif; --f-body: 'Alegreya', Georgia, serif; --f-ui: 'Alegreya Sans', system-ui, sans-serif;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #16191c; --panel: #1f2428; --ink: #e6ddc8; --muted: #8a9397; --rule: #343b40; --accent: #c8913a; --ok: #7fa88a; --warn: #c8913a; --bad: #d0644f; color-scheme: dark } }
:root[data-theme="dark"] { --bg: #16191c; --panel: #1f2428; --ink: #e6ddc8; --muted: #8a9397; --rule: #343b40; --accent: #c8913a; --ok: #7fa88a; --warn: #c8913a; --bad: #d0644f; color-scheme: dark }
body { background: var(--bg); color: var(--ink); font: 17px/1.5 var(--f-body); }
main { max-width: 60rem; margin: 0 auto; padding-block: 28px 64px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 36px; }
h1 { font: 700 2rem/1.1 var(--f-display); letter-spacing: 0.08em; margin: 0; text-wrap: balance; }
h2 { font: 500 1.3rem/1.2 var(--f-display); letter-spacing: 0.06em; margin: 0 0 10px; color: var(--accent); text-wrap: balance; }
h3 { font: 500 0.8rem var(--f-ui); text-transform: uppercase; letter-spacing: 0.14em; color: var(--muted); margin: 14px 0 6px; }
p { margin: 0; max-width: 65ch; }
.lede { color: var(--muted); font-family: var(--f-ui); font-size: 0.95rem; margin-top: 6px; }
.strip { display: grid; grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr)); gap: 8px; }
.chip { border: 1px solid var(--rule); border-left: 4px solid var(--rule); padding: 8px 10px; display: grid; gap: 2px; font-family: var(--f-ui); }
.chip .k { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--muted); }
.chip .v { font-size: 1.05rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.chip.ok { border-left-color: var(--ok); } .chip.warn { border-left-color: var(--warn); } .chip.bad { border-left-color: var(--bad); } .chip.bad .v { color: var(--bad); }
ol.script { margin: 0; padding-left: 1.4em; display: grid; gap: 14px; }
ul.list { margin: 0; padding: 0; list-style: none; display: grid; gap: 12px; }
ul.list > li { border-top: 1px solid var(--rule); padding-top: 10px; display: grid; gap: 6px; min-width: 0; }
.meta { color: var(--muted); font: 0.88rem var(--f-ui); }
.code { display: flex; gap: 8px; align-items: stretch; flex-wrap: wrap; }
.code textarea { flex: 1 1 14rem; min-width: 0; font: 0.75rem/1.3 ui-monospace, Menlo, monospace; color: var(--muted); background: var(--panel); border: 1px solid var(--rule); padding: 6px; resize: none; }
button { font: 500 0.9rem var(--f-ui); color: var(--ink); background: var(--panel); border: 1px solid var(--rule); padding: 0 14px; min-height: 44px; cursor: pointer; }
button:focus-visible, summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.scroll { overflow-x: auto; }
table { border-collapse: collapse; font: 0.92rem var(--f-ui); font-variant-numeric: tabular-nums; min-width: 100%; }
th, td { text-align: left; padding: 6px 10px 6px 0; border-bottom: 1px solid var(--rule); white-space: nowrap; }
th { font-weight: 500; color: var(--muted); font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.08em; }
td.num, th.num { text-align: right; }
.low { color: var(--bad); font-weight: 700; } .high { color: var(--warn); font-weight: 700; }
details { border-top: 1px solid var(--rule); padding-top: 8px; }
summary { cursor: pointer; font: 500 0.95rem var(--f-ui); color: var(--muted); min-height: 32px; }
.shots { display: grid; grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr)); gap: 12px; }
figure { margin: 0; display: grid; gap: 4px; min-width: 0; }
figure img { width: 100%; height: auto; border: 1px solid var(--rule); }
figure.bad img { border: 2px solid var(--bad); }
figcaption { font: 0.78rem var(--f-ui); color: var(--muted); display: grid; gap: 2px; }
.prob { color: var(--bad); }
.ok-line { color: var(--ok); font-family: var(--f-ui); }
@media (prefers-reduced-motion: no-preference) { button { transition: background 0.15s; } }
button:hover { background: var(--rule); }
</style>
<main>
  <header>
    <h1>Vikingr Gauntlet</h1>
    <p class="lede">${r.lives} lives over the eras of 830, 843 and 865, three backgrounds and six ways of playing; ${r.years} years and ${r.steps.toLocaleString('en')} actions, every one checked; ${r.secs} seconds.</p>
  </header>

  <section aria-label="Verdict" class="strip">
    ${chip('Errors', String(errors.length), errors.length ? 'bad' : 'ok')}
    ${chip('Text slips', String(texts.length), texts.length ? 'warn' : 'ok')}
    ${chip('Calendar', String(seasons.length), seasons.length ? 'warn' : 'ok')}
    ${chip('Broken promises', String(r.promises.length), r.promises.length ? 'bad' : 'ok')}
    ${chip('Lopsided fights', `${lop.length} of ${fair.length}`, lop.length > 15 ? 'warn' : 'ok')}
    ${chip('Phone screens', `${phone.length - phoneBad.length} of ${phone.length} clean`, phoneBad.length ? 'warn' : 'ok')}
    ${golden ? chip('Golden lives', golden.baseline ? `${golden.changed.length} of ${golden.total} changed` : 'baseline set', golden.changed.length ? 'warn' : 'ok') : ''}
    ${seenPct ? chip('Scenes reached', `${seenPct.pct}%`, seenPct.pct >= 80 ? 'ok' : 'warn') : ''}
  </section>

  <section>
    <h2>Play these next</h2>
    <p class="lede">Recently written scenes the lives met least. Copy a code, open the game, choose <i>Load a saved life</i>, and you stand where the scene opens.</p>
    <ol class="script">${(r.playtest as { id: string; title: string; seen: number; era: number; code: string }[]).map((x) => `<li><p><b>${esc(x.title)}</b> <span class="meta">(${x.era} start; met in ${x.seen} of ${r.lives} lives)</span></p>${code(x.code)}</li>`).join('')}</ol>
  </section>

  <section>
    <h2>What broke</h2>
    ${errors.length ? `<ul class="list">${errors.map(finding).join('')}</ul>` : '<p class="ok-line">Nothing: no crash, dead end, softlock, bad save, impossible number or broken text in any life.</p>'}
    ${texts.length ? `<h3>Text slips</h3><ul class="list">${texts.map(finding).join('')}</ul>` : ''}
    ${seasons.length ? `<h3>Calendar</h3><ul class="list">${seasons.map(finding).join('')}</ul>` : ''}
    <h3>Promises: what the words say against what the choice does</h3>
    ${r.promises.length ? `<ul class="list">${r.promises.map((b: { scene: string; choice: string; rule: string; detail: string }) => `<li><p><b>${esc(b.scene)} / ${esc(b.choice)}</b>: ${esc(b.detail)}</p></li>`).join('')}</ul>` : '<p class="ok-line">All kept: every sum named in a choice matches the silver it moves, and no goods are given without a word.</p>'}
  </section>

  <section>
    <h2>Fights</h2>
    <p class="lede">Every fight the lives met with a crew of fighting size, fought ${30} times from that moment with fresh dice. Under 10% or over 95% is listed for a person to judge: some are one-sided in history too.</p>
    <div class="scroll"><table><thead><tr><th>Fight</th><th class="num">Won</th><th class="num">Fought</th><th class="num">Died</th></tr></thead><tbody>
    ${lop.map((f) => `<tr><td>${esc(f.scene)} / ${esc(f.choice)}</td><td class="num ${pct(f) < 10 ? 'low' : 'high'}">${pct(f)}%</td><td class="num">${f.fought}</td><td class="num">${f.died}</td></tr>`).join('')}
    </tbody></table></div>
    <details><summary>All ${fair.length} fights</summary><div class="scroll"><table><thead><tr><th>Fight</th><th class="num">Won</th><th class="num">Fought</th><th class="num">Died</th></tr></thead><tbody>
    ${fair.sort((a, b) => pct(a) - pct(b)).map((f) => `<tr><td>${esc(f.scene)} / ${esc(f.choice)}</td><td class="num">${pct(f)}%</td><td class="num">${f.fought}</td><td class="num">${f.died}</td></tr>`).join('')}
    </tbody></table></div></details>
  </section>

  <section>
    <h2>Ways of playing</h2>
    <div class="scroll"><table><thead><tr><th>Played</th><th class="num">Lives</th><th class="num">Years</th><th class="num">Died</th><th class="num">Silver and hoard</th><th class="num">Fame</th><th class="num">Married</th><th class="num">Hall</th><th class="num">Scenes</th><th class="num">East road</th></tr></thead><tbody>
    ${Object.entries(dash).map(([k, d]) => `<tr><td>${esc(k)}</td><td class="num">${d.lives}</td><td class="num">${d.years}</td><td class="num">${d.died}%</td><td class="num">${d.wealth}</td><td class="num">${d.fame}</td><td class="num">${d.married}%</td><td class="num">${d.hall}%</td><td class="num">${d.scenes}</td><td class="num">${d.east}%</td></tr>`).join('')}
    </tbody></table></div>
    <p class="meta">${r.moved?.length ? `Moved by more than a quarter since the last run: ${esc(r.moved.join('; '))}.` : 'Nothing moved by more than a quarter since the last run.'} Groups of ten lives swing by ten points on luck alone.</p>
    ${golden ? `<h3>Golden lives</h3>${golden.changed.length ? `<ul class="list">${golden.changed.map((c) => `<li><p>${esc(c)}</p></li>`).join('')}</ul>` : `<p class="ok-line">${golden.baseline ? `All ${golden.total} fixed lives play out exactly as in the baseline.` : `Baseline written for ${golden.total} fixed lives; the next run compares against it.`}</p>`}` : ''}
  </section>

  <section>
    <h2>On a phone</h2>
    <p class="lede">${phone.length} screens loaded into the real game at 390 pixels and checked for sideways scrolling, buttons too small for a thumb, cut-off text and errors. ${phoneBad.length ? `${phoneBad.length} have problems, outlined in red.` : 'All clean.'}</p>
    <div class="shots">${imgs}</div>
  </section>

  <section>
    <h2>Reach</h2>
    <p>${seenPct ? `${seenPct.seen} of ${seenPct.all} scenes were met in at least one life.` : ''} Never met, by group: ${esc(Object.entries((r.never as { id: string }[]).reduce((m: Record<string, number>, s) => { const k = s.id.split('_')[0]!; m[k] = (m[k] ?? 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '))}.</p>
  </section>
</main>
<script>
document.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-copy]');
  if (!b) return;
  const t = document.getElementById(b.dataset.copy);
  const done = () => { b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy code'; }, 1500); };
  navigator.clipboard.writeText(t.value).then(done, () => { t.focus(); t.select(); b.textContent = 'Selected: copy it'; });
});
</script>
`;
writeFileSync(join(OUT, 'report.html'), html);
console.log(`report: gauntlet-out/report.html (${Math.round(html.length / 1024)} KB)`);
