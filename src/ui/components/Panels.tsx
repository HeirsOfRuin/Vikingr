import type { ContentBundle } from '../../content/schema';
import { goalProgress } from '../../engine/boasts';
import { freeSworn, hold, MASTER_SHARES, masterOf } from '../../engine/fleet';
import { captain, favour, favourMuster, favourWord, partner, relWord } from '../../engine/allies';
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
import { tierAt, TIER_NAMES } from '../../engine/standing';
import { BASE, FARM_PRICE, HALL_FAME, HALL_PRICE, winterYield } from '../../engine/base';
import { baseActions } from '../../engine/index';
import { Actions } from './Actions';
import { equipped, gearWord, itemName, NAME_AT } from '../../engine/items';
import type { KitSlot } from '../../engine/state';

const SLOT_NAMES: Record<KitSlot, string> = { weapon: 'In his hand', shield: 'On his arm', helmet: 'On his head', armour: 'On his back' };

/** What he carries, what he could carry instead, and what he keeps for what it means (FRAME-FOUNDATION §2–3). */
function KitCard({ content, state, onAct }: { content: ContentBundle; state: GameState; onAct?: (a: Action) => void }) {
  const inHand = new Set(Object.values(state.kit));
  const spare = state.items.filter((x) => !inHand.has(x.uid) && content.items[x.id]?.kind !== 'keepsake');
  const keepsakes = state.items.filter((x) => content.items[x.id]?.kind === 'keepsake');
  return (
    <div class="card">
      <h3>Kit</h3>
      <dl class="kv">
        {(['weapon', 'shield', 'helmet', 'armour'] as KitSlot[]).map((slot) => {
          const it = equipped(state, slot);
          return [<dt key={slot}>{SLOT_NAMES[slot]}</dt>, <dd key={slot + 'v'}>{it ? itemName(content, it) : <span class="muted">nothing</span>}{it && slot === 'weapon' ? <span class="muted small"> — {it.deeds} {it.deeds === 1 ? 'deed' : 'deeds'}{it.name ? '' : `; at ${NAME_AT} the men will name it`}</span> : null}</dd>];
        })}
      </dl>
      {spare.length > 0 && (
        <div class="row sans small" style={{ flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {spare.map((x) => <button key={x.uid} class="choice" style={{ minHeight: 36, padding: '4px 8px' }} onClick={() => onAct?.({ t: 'equip', uid: x.uid })}>Take up {itemName(content, x).replace(/^(A|An|The) /, (m) => m.toLowerCase())}</button>)}
        </div>
      )}
      {spare.length > 0 && !state.voyage && state.men.some((m) => m.alive && m.sworn) && (
        <div class="small" style={{ marginTop: 8 }}>
          <span class="muted">Give what you don't carry to a man sworn to you (it binds him closer; a blade makes him better with it). Or sell it at the smith or the market.</span>
          {spare.map((x) => (
            <div key={`g${x.uid}`} class="row sans small" style={{ flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {state.men.filter((m) => m.alive && m.sworn).map((m) => (
                <button key={m.id} class="choice" style={{ minHeight: 32, padding: '4px 8px' }} onClick={() => onAct?.({ t: 'give_item', uid: x.uid, man: m.id })}>{itemName(content, x).replace(/^(A|An|The) /, (w) => w.toLowerCase())} to {m.name}</button>
              ))}
            </div>
          ))}
        </div>
      )}
      {keepsakes.length > 0 && <p class="small" style={{ marginTop: 8 }}><span class="muted">Kept for what they mean:</span> {keepsakes.map((x) => itemName(content, x)).join('; ')}.</p>}
    </div>
  );
}

const QUALITY = ['green', 'blooded', 'seasoned', 'veterans'];
export const qualityWord = (q: number) => QUALITY[Math.max(0, Math.min(3, Math.floor(q)))]!;
export const moraleWord = (m: number) => (m >= 8 ? 'eager' : m >= 6 ? 'steady' : m >= 4 ? 'grumbling' : m >= 2 ? 'sullen' : 'close to leaving');
const luckWord = (h: number) => (h >= 3 ? 'The men say your luck is strong. They want to stand near you.' : h >= 1 ? 'The men say your luck holds.' : h <= -2 ? 'The men no longer look you in the eye.' : h < 0 ? 'Some of the men touch their amulets when you pass.' : 'Nobody has said anything about your luck yet.');
const honourWord = (h: number) => (h >= 5 ? 'a man of his word, known for it' : h >= 2 ? 'well thought of' : h >= -1 ? 'neither praised nor blamed' : h >= -4 ? 'talked about, and not kindly' : 'a name men spit after');
const loyaltyWord = (l: number) => (l >= 8 ? 'would die for you' : l >= 6 ? 'loyal' : l >= 4 ? 'his oath holds' : l >= 2 ? 'restless' : 'about to leave');

export function HeroPanel({ content, state, onAct }: { content: ContentBundle; state: GameState; onAct?: (a: Action) => void }) {
  const h = state.hero;
  const bg = content.backgrounds[h.background];
  return (
    <div>
      <h2>{h.name}{h.nickname ? ` ${h.nickname}` : ''}</h2>
      <p class="muted">{bg?.label}, {age(state)} winters old. {state.service ? `An oarsman in ${state.service.captain}'s ship` : state.ships.length ? "A ship's captain" : 'Without a ship'}. {capitalise(honourWord(state.honour))}.</p>
      <KitCard content={content} state={state} onAct={onAct} />
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
      {state.boasts.length > 0 && (
        <div class="card">
          <h3>Boasts sworn over the cup</h3>
          {state.boasts.map((b) => (
            <p key={b.id}>{content.boasts[b.id]?.text} <span class="muted small sans">— {b.state === 'open' ? `due by ${formatDate(b.due)}${goalProgress(state, content, b) ? `; ${goalProgress(state, content, b)}` : ''}` : b.state === 'kept' ? 'kept' : 'broken'}</span></p>
          ))}
        </div>
      )}
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
        {state.ships.length ? state.ships.map((s, i) => {
          const m = masterOf(state, s);
          const free = freeSworn(state);
          const inPort = !state.voyage && !state.service;
          return (
            <div key={s.id} style={{ marginBottom: 8 }}>
              {s.name} <span class="muted small">— {content.ships[s.type]?.name}, sound {Math.max(0, s.hull)}%</span>
              <Bar value={s.hull} max={100} kind="sea" />
              {!state.service && <p class="small" style={{ margin: '2px 0' }}>{i === 0 ? 'Your own steering-oar.' : m ? (m.kind === 'sworn' ? `${m.name} has her steering-oar (${MASTER_SHARES.sworn} extra shares).` : `${m.name}, a hired steersman, has her (${MASTER_SHARES.hired} extra shares).`) : 'Nobody at her steering-oar.'}</p>}
              {i > 0 && inPort && free.length > 0 && (
                <div class="row sans small">
                  {free.map((id) => (
                    <button key={id} class="choice" style={{ minHeight: 32, padding: '4px 8px' }} onClick={() => onAct({ t: 'appoint', ship: s.id, man: id })}>Give her to {content.men[id]?.name}</button>
                  ))}
                </div>
              )}
            </div>
          );
        }) : <p class="empty">You have no ship.</p>}
        {!state.service && state.ships.length > 0 && <p class="small">The holds carry {formatSilver(hold(state, content))} of plunder and goods; {formatSilver(state.loot)} of plunder aboard.</p>}
        {Object.keys(state.cargo ?? {}).length > 0 && <p class="small">Goods aboard: {Object.entries(state.cargo!).map(([g, c]) => `${c.lots} × ${content.goods[g]?.name.toLowerCase()} (paid ${formatSilver(Math.round(c.cost / c.lots))} a lot)`).join(', ')}.</p>}
        {state.building && <p class="muted small">Building over the winter: a {content.ships[state.building]?.name.toLowerCase()}.</p>}
        {!state.service && state.ships[0] && (
          <p class="small">Fitted with: {state.ships[0].fittings?.length ? state.ships[0].fittings.map((f) => content.items[f]?.name.toLowerCase()).join(', ') : <span class="muted">nothing yet. The shipwright at home, or at a market, can change that.</span>}</p>
        )}
        {!state.service && <p class="small">The men carry {gearWord(state.crew.gear)}.</p>}
      </div>
      <div class="card">
        <h3>{state.service ? `${state.service.captain}'s ship` : 'The crew'}</h3>
        {state.service ? (
          <dl class="kv">
            <dt>Ship</dt><dd>{state.ships[0]?.name ?? 'none'}, {state.service.captain} at the steering-oar</dd>
            <dt>Men</dt><dd>{state.crew.men + aliveMen(state).length + 1} at the oars, you among them</dd>
            <dt>Mood</dt><dd>{moraleWord(state.crew.morale)}</dd>
            <dt>Your shares</dt><dd>{state.service.shares}</dd>
            <dt>Silver</dt><dd>{formatSilver(state.silver)}</dd>
            <dt>In the heap</dt><dd>{formatSilver(state.loot)}</dd>
          </dl>
        ) : (
        <dl class="kv">
          <dt>Men</dt><dd>{state.crew.men}, and {aliveMen(state).length} sworn men <span class="muted">(the ships carry {capacity(state, content)})</span></dd>
          <dt>Quality</dt><dd>{qualityWord(state.crew.quality)}</dd>
          <dt>Mood</dt><dd>{moraleWord(state.crew.morale)}</dd>
          <dt>Food</dt><dd>{days} days</dd>
          <dt>Silver</dt><dd>{formatSilver(state.silver)}</dd>
          <dt>Plunder to share</dt><dd>{formatSilver(state.loot)}</dd>
        </dl>
        )}
      </div>
      <h3>{state.men.some((m) => m.sworn) ? 'Your men' : 'Your bench-mates'}</h3>
      {state.men.length ? state.men.map((m) => {
        const def = content.men[m.id];
        return (
          <div class="card" key={m.id}>
            <b>{m.name}{m.nickname ? ` ${m.nickname}` : ''}</b> <span class="muted small sans">— {m.temperament}{m.alive ? (m.sworn ? `, sworn to you, ${loyaltyWord(m.loyalty)}` : ', a bench-mate; he has not sworn to you') : ''}{m.alive && m.hurtUntil !== null && m.hurtUntil > state.day ? ', hurt' : ''}</span>
            {m.alive ? (
              <>
                <Bar value={m.loyalty} max={10} kind="gold" />
                <p class="small">{def?.desc}</p>
                {m.sworn && <div class="row sans small">
                  {(['front', 'wall', 'rear'] as Position[]).map((p) => (
                    <button key={p} class={`choice${m.slot === p ? ' primary' : ''}`} style={{ minHeight: 36, padding: '4px 8px' }} onClick={() => onAct({ t: 'slot', man: m.id, slot: p })}>{POSITION_NAMES[p]}</button>
                  ))}
                </div>}
              </>
            ) : <p class="muted small">Dead, {m.diedOn !== null ? formatDate(m.diedOn) : ''}.</p>}
          </div>
        );
      }) : <p class="empty">No one has sworn to you.</p>}
    </div>
  );
}

/** The base (FRAME-FOUNDATION §4): what he has, who keeps it, and what is on its walls. */
export function HomePanel({ content, state, onAct }: { content: ContentBundle; state: GameState; onAct: (a: Action) => void }) {
  const b = state.base;
  const def = BASE[b.level];
  const acts = baseActions(state, content);
  const next = b.level === 'father' ? `A farm of your own costs ${formatSilver(FARM_PRICE)}: buy one at home, in the winter.` : b.level === 'farm' ? `A hall costs ${formatSilver(HALL_PRICE)}, and a name men know (fame ${HALL_FAME}). Build it at home, in the winter.` : 'You have a hall. Men say your name at its door.';
  return (
    <div>
      <h2>{def.name}</h2>
      <p class="muted">{def.desc}</p>
      <div class="card">
        <dl class="kv">
          <dt>Household</dt><dd>{b.wife ? `${b.wife}, your wife, keeps the place.` : state.flags.betrothed ? 'Betrothed; the wedding is at the winter nights.' : 'No wife yet.'}{state.flags.child_son ? ` A son${state.flags.child_daughter ? ' and a daughter' : ''}.` : ''}</dd>
          <dt>Thralls</dt><dd>{b.thralls} of {def.thralls} the land can use{b.thralls ? '' : <span class="muted"> — captives you keep instead of selling</span>}</dd>
          <dt>Each winter</dt><dd>{formatSilver(winterYield(state)) || 'nothing'}{b.wife ? <span class="muted"> (a quarter more, for her running of it)</span> : null}</dd>
          <dt>Hoard</dt><dd>{formatSilver(b.hoard)}<span class="muted small"> — safe from the sea</span></dd>
        </dl>
        <p class="muted small">{next}</p>
      </div>
      <div class="card">
        <h3>On the wall</h3>
        {b.trophies.length ? <p>{b.trophies.map((id) => content.items[id]?.name).join('; ')}.</p> : <p class="empty">Nothing yet. Keepsakes worth showing can be hung here, and feasts in your own hall go better under them.</p>}
      </div>
      {acts.length > 0 ? <Actions options={acts} onAct={onAct} /> : <p class="muted small sans">You are away from home. The hoard and the wall wait for you.</p>}
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
        <h3>Your name in the ports</h3>
        <p class="muted small">What each place you know thinks of you. A raid is remembered at the place, and heard of by its kin nearby; a sacked church is heard of further, because the Church writes letters. Fair trade and kept faith mend it, slowly; so does time.</p>
        <table class="ports sans small">
          <tbody>
            {Object.values(content.places).filter((p) => p.active && p.kind !== 'home' && state.known.includes(p.id)).map((p) => {
              const t = tierAt(state, content, p.id);
              return <tr key={p.id}><td>{p.name}</td><td class="muted">{p.region}</td><td><span class={`pill standing-${t}`}>{TIER_NAMES[t]}</span></td></tr>;
            })}
          </tbody>
        </table>
      </div>
      <div class="card">
        <h3>The jarl and the captains</h3>
        <p class="small">Jarl Eystein: you are {favourWord(favour(state))}.{state.service ? '' : ` His favour sends ${Math.max(0, favourMuster(state))} more men to your muster.`}</p>
        {Object.keys(content.captains).filter((id) => captain(state, content, id).met).length ? (
          <dl class="kv">
            {Object.values(content.captains).filter((c) => captain(state, content, c.id).met).map((c) => {
              const cs = captain(state, content, c.id);
              return [<dt key={`${c.id}t`}>{c.name}</dt>, <dd key={`${c.id}d`}>{cs.alive ? `${relWord(cs.rel)}; ${c.ships === 1 ? 'one ship' : `${c.ships} ships`}, ${c.men} men, at ${content.places[c.home]?.name}${partner(state, content) === c.id ? '. Sworn to you in félag this summer.' : '.'}` : 'dead.'}</dd>];
            })}
          </dl>
        ) : <p class="muted small">You haven't met the other shipmasters of the north yet. They keep to their own landings.</p>}
      </div>
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
