import type { ContentBundle } from '../../content/schema';
import { SKILLS, ATTRS } from '../../content/schema';
import type { GameState, Position } from '../../engine/state';
import type { Action } from '../../engine/index';
import { effAttr, hpMax, age } from '../../engine/hero';
import { ATTR_NAMES } from '../../engine/paths';
import { capacity, mouths, aliveMen } from '../../engine/crew';
import { legendTable, livingFame, lastingFame, deedFame } from '../../engine/fame';
import { formatDate } from '../../engine/calendar';
import { formatSilver, capitalise } from '../../engine/format';
import { POSITION_NAMES } from '../../engine/battle';
import { SKILL_XP_PER_LEVEL } from '../../engine/tuning';
import { Bar } from './Actions';

const QUALITY = ['green', 'blooded', 'seasoned', 'veterans'];
export const qualityWord = (q: number) => QUALITY[Math.max(0, Math.min(3, Math.floor(q)))]!;
export const moraleWord = (m: number) => (m >= 8 ? 'eager' : m >= 6 ? 'steady' : m >= 4 ? 'grumbling' : m >= 2 ? 'sullen' : 'close to leaving');
const luckWord = (h: number) => (h >= 3 ? 'The men say your luck is strong. They want to stand near you.' : h >= 1 ? 'The men say your luck holds.' : h <= -2 ? 'The men no longer look you in the eye.' : h < 0 ? 'Some of the men touch their amulets when you pass.' : 'Nobody has said anything about your luck yet.');
const honourWord = (h: number) => (h >= 5 ? 'a man of his word, known for it' : h >= 2 ? 'well thought of' : h >= -1 ? 'neither praised nor blamed' : h >= -4 ? 'talked about, and not kindly' : 'a name men spit after');
const loyaltyWord = (l: number) => (l >= 8 ? 'would die for you' : l >= 6 ? 'loyal' : l >= 4 ? 'his oath holds' : l >= 2 ? 'restless' : 'about to leave');

export function HeroPanel({ content, state }: { content: ContentBundle; state: GameState }) {
  const h = state.hero;
  const bg = content.backgrounds[h.background];
  return (
    <div>
      <h2>{h.name}{h.nickname ? ` ${h.nickname}` : ''}</h2>
      <p class="muted">{bg?.label}, {age(state)} winters old. {capitalise(honourWord(state.honour))}.</p>
      <div class="card">
        <h3>Body</h3>
        Blood {Math.round(h.hp)}/{hpMax(state, content)}
        <Bar value={h.hp} max={hpMax(state, content)} kind="red" />
        <dl class="kv">
          {ATTRS.map((a) => {
            const e = effAttr(state, content, a);
            return [<dt key={a}>{capitalise(ATTR_NAMES[a]!)}</dt>, <dd key={a + 'v'}>{e}{e !== h.attrs[a] ? ` (${h.attrs[a]})` : ''}</dd>];
          })}
        </dl>
      </div>
      <div class="card">
        <h3>Skills</h3>
        <dl class="kv">
          {SKILLS.map((s) => [<dt key={s}>{capitalise(s)}</dt>, <dd key={s + 'v'}>{h.skills[s]} <span class="muted small">({h.xp[s]}/{SKILL_XP_PER_LEVEL * (h.skills[s] + 1)})</span></dd>])}
        </dl>
        <p class="muted small sans" style={{ marginTop: 8 }}>Skills rise by use: fight to learn Weapons and Shield, sail to learn Seamanship, lead to learn Command.</p>
      </div>
      <div class="card">
        <h3>Wounds and scars</h3>
        {h.wounds.length ? h.wounds.map((w) => {
          const inj = content.injuries[w.id];
          return <p key={w.id + w.until}><b>{inj?.name}</b> <span class="muted small">— {w.from}. {w.until === -1 ? 'For life.' : `Heals by ${formatDate(w.until)}.`}</span><br /><span class="small">{inj?.desc}</span></p>;
        }) : <p class="empty">Unmarked, so far.</p>}
      </div>
      <div class="card">
        <h3>Luck</h3>
        <p>{luckWord(state.hamingja)}</p>
      </div>
    </div>
  );
}

export function CrewPanel({ content, state, onAct }: { content: ContentBundle; state: GameState; onAct: (a: Action) => void }) {
  const days = Math.floor(state.provisions / Math.max(1, mouths(state)));
  return (
    <div>
      <h2>Ships and men</h2>
      <div class="card">
        <h3>Ships</h3>
        {state.ships.length ? state.ships.map((s) => (
          <div key={s.id}>
            {s.name} <span class="muted small">— {content.ships[s.type]?.name}, sound {Math.max(0, s.hull)}%</span>
            <Bar value={s.hull} max={100} kind="sea" />
          </div>
        )) : <p class="empty">You have no ship.</p>}
        {state.building && <p class="muted small">Building over the winter: a {content.ships[state.building]?.name.toLowerCase()}.</p>}
      </div>
      <div class="card">
        <h3>The crew</h3>
        <dl class="kv">
          <dt>Men</dt><dd>{state.crew.men}, and {aliveMen(state).length} sworn men <span class="muted">(the ships carry {capacity(state, content)})</span></dd>
          <dt>Quality</dt><dd>{qualityWord(state.crew.quality)}</dd>
          <dt>Mood</dt><dd>{moraleWord(state.crew.morale)}</dd>
          <dt>Food</dt><dd>{days} days</dd>
          <dt>Silver</dt><dd>{formatSilver(state.silver)}</dd>
          <dt>Plunder to share</dt><dd>{formatSilver(state.loot)}</dd>
        </dl>
      </div>
      <h3>Sworn men</h3>
      {state.men.length ? state.men.map((m) => {
        const def = content.men[m.id];
        return (
          <div class="card" key={m.id}>
            <b>{m.name}{m.nickname ? ` ${m.nickname}` : ''}</b> <span class="muted small sans">— {m.temperament}{m.alive ? `, ${loyaltyWord(m.loyalty)}` : ''}</span>
            {m.alive ? (
              <>
                <Bar value={m.loyalty} max={10} kind="gold" />
                <p class="small">{def?.desc}</p>
                <div class="row sans small">
                  {(['front', 'wall', 'rear'] as Position[]).map((p) => (
                    <button key={p} class={`choice${m.slot === p ? ' primary' : ''}`} style={{ minHeight: 36, padding: '4px 8px' }} onClick={() => onAct({ t: 'slot', man: m.id, slot: p })}>{POSITION_NAMES[p]}</button>
                  ))}
                </div>
              </>
            ) : <p class="muted small">Dead, {m.diedOn !== null ? formatDate(m.diedOn) : ''}.</p>}
          </div>
        );
      }) : <p class="empty">No one has sworn to you.</p>}
    </div>
  );
}

export function SagaPanel({ content, state }: { content: ContentBundle; state: GameState }) {
  const table = legendTable(state, content);
  const deeds = [...state.deeds].reverse();
  return (
    <div>
      <h2>The saga so far</h2>
      <p class="muted">Fame {Math.round(livingFame(state))}. Lasting fame {lastingFame(state)}. A deed counts only once it has been told: at a feast, by a skald, or by the men who saw it.</p>
      <div class="card">
        <h3>The greatest living legends</h3>
        <table class="list">
          <tbody>
            {table.map((r, i) => (
              <tr key={r.id} class={r.hero ? 'me' : ''}><td>{i + 1}</td><td>{r.name}</td><td>{r.fame}</td></tr>
            ))}
          </tbody>
        </table>
        <p class="muted small sans" style={{ marginTop: 8 }}>What men say of the others is rumour, and grows in the telling.</p>
      </div>
      <div class="card">
        <h3>Deeds</h3>
        {deeds.length ? (
          <table class="list">
            <tbody>
              {deeds.map((d) => (
                <tr key={d.n}>
                  <td>{d.text}<br /><span class="muted">{formatDate(d.day)}</span></td>
                  <td>{d.verse ? 'In verse' : d.told === null ? 'Untold' : `Told (${Math.round(deedFame(d, state.day) * 10) / 10})`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p class="empty">Nothing yet. Nobody sings about a man who stayed home.</p>}
      </div>
      <div class="card">
        <h3>Journal</h3>
        <div class="log" style={{ maxHeight: 360 }}>
          {[...state.journal].reverse().slice(0, 80).map((j, i) => <p key={i}><span class="muted">{formatDate(j.day)}:</span> {j.text}</p>)}
        </div>
      </div>
    </div>
  );
}
