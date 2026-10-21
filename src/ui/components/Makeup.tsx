// Character creation (docs/FRAME-LINEAGE.md A): attributes bought from a pool, and one of three skill sets.
import { useState } from 'preact/hooks';
import type { Attr, Skill } from '../../content/schema';
import { ATTRS } from '../../content/schema';
import { ATTR_WORDS, MAKEUP } from '../../engine/makeup';

export interface SkillSet { id: string; label: string; desc: string; skills: Partial<Record<Skill, number>> }

const cap = (s: string) => s[0]!.toUpperCase() + s.slice(1);

export function skillLine(skills: Partial<Record<Skill, number>>): string {
  return Object.entries(skills).filter(([, v]) => v).sort((a, b) => b[1]! - a[1]!).map(([k, v]) => `${cap(k)} ${v}`).join(', ');
}

export function Makeup({ title, intro, start, sets, begin, onBegin, onBack }: {
  title: string; intro: string; start: Record<Attr, number>; sets: SkillSet[]; begin: string;
  onBegin: (attrs: Record<Attr, number>, set: string) => void; onBack?: () => void;
}) {
  const pool = ATTRS.reduce((a, k) => a + start[k], 0);
  const [attrs, setAttrs] = useState<Record<Attr, number>>({ ...start });
  const [set, setSet] = useState(sets[0]!.id);
  const left = pool - ATTRS.reduce((a, k) => a + attrs[k], 0);
  const bump = (k: Attr, d: number) => setAttrs({ ...attrs, [k]: attrs[k] + d });
  const changed = ATTRS.some((k) => attrs[k] !== start[k]);
  return (
    <main class="screen">
      <h1>{title}</h1>
      <p>{intro}</p>
      <h3>What you were born with</h3>
      <p class="small sans muted">{left === 0 ? `All ${pool} points spent.` : left > 0 ? `${left} of ${pool} points left to spend.` : `${-left} points too many.`} Each is {MAKEUP.min} to {MAKEUP.max}.</p>
      <div class="makeup">
        {ATTRS.map((k) => (
          <div key={k} class="attr-row">
            <div class="attr-txt"><b>{ATTR_WORDS[k].name}</b><span class="hint">{ATTR_WORDS[k].does}</span></div>
            <div class="attr-ctl">
              <button class="step" aria-label={`Less ${ATTR_WORDS[k].name}`} disabled={attrs[k] <= MAKEUP.min} onClick={() => bump(k, -1)}>−</button>
              <span class="attr-val" id={`attr-${k}`}>{attrs[k]}</span>
              <button class="step" aria-label={`More ${ATTR_WORDS[k].name}`} disabled={attrs[k] >= MAKEUP.max || left <= 0} onClick={() => bump(k, 1)}>+</button>
            </div>
          </div>
        ))}
      </div>
      {changed && <button class="choice" onClick={() => setAttrs({ ...start })}><span class="txt">Back to the spread you began with</span></button>}
      <h3 style={{ marginTop: 18 }}>How you were raised</h3>
      <div class="bgs">
        {sets.map((s) => (
          <button key={s.id} class={`choice bg${set === s.id ? ' on' : ''}`} onClick={() => setSet(s.id)}>
            <span class="txt">{s.label}<span class="hint">{s.desc}</span><span class="hint skills">{skillLine(s.skills)}</span></span>
          </button>
        ))}
      </div>
      <div class="choices">
        <button class="choice primary" disabled={left !== 0} onClick={() => onBegin(attrs, set)}><span class="txt">{begin}{left !== 0 && <span class="hint">Spend every point first.</span>}</span></button>
        {onBack && <button class="choice" onClick={onBack}><span class="txt">Back</span></button>}
      </div>
    </main>
  );
}
