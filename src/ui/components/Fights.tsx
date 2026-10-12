import type { ContentBundle } from '../../content/schema';
import { DUEL_MOVES, ORDERS } from '../../content/schema';
import type { DuelSide, DuelState, BattleState, PlunderState } from '../../engine/state';
import { formatSilver, plural } from '../../engine/format';
import { ALARM_MAX } from '../../engine/plunder';
import type { Action, ActionOption } from '../../engine/index';
import { MOVE_NAMES, foeForecast } from '../../engine/duel';
import { ORDER_NAMES, POSITION_NAMES, enemyForecast } from '../../engine/battle';
import { Actions, Bar } from './Actions';

function Fighter({ s, you }: { s: DuelSide; you?: boolean }) {
  return (
    <div class="fighter">
      <div class="name">{you ? 'You' : s.name}</div>
      Blood {Math.max(0, s.hp)}/{s.hpMax}
      <Bar value={s.hp} max={s.hpMax} kind="red" />
      Wind {Math.max(0, s.stamina)}/{s.staminaMax}
      <Bar value={s.stamina} max={s.staminaMax} kind="gold" />
      {s.shields > 0
        ? <>Shields <span class="shields">{'◆'.repeat(s.shields)}</span> <span class="muted">({s.integrity} blows left in this one)</span></>
        : <span class="muted">No shield left</span>}
    </div>
  );
}

export function DuelView({ content, d, options, onAct }: { content: ContentBundle; d: DuelState; options: ActionOption[]; onAct: (a: Action) => void }) {
  const fc = foeForecast(d);
  const foe = content.fighters[d.foeId];
  const seen = DUEL_MOVES.filter((m) => d.seen[m]).map((m) => `${MOVE_NAMES[m]} ${d.seen[m]}`).join(', ');
  const likely = [...DUEL_MOVES].sort((a, b) => fc[b] - fc[a]).slice(0, 2);
  return (
    <div>
      <h2>{d.kind === 'holmgang' ? 'The holmgang' : 'Single combat'}{d.lethal && <span class="tag lethal" style={{ marginLeft: 10 }}>Lethal</span>}</h2>
      {foe && <p class="muted small">{foe.desc}</p>}
      <div class="fighters">
        <Fighter s={d.hero} you />
        <Fighter s={d.foe} />
      </div>
      <div class="card sans small">
        <div>Exchange {d.exchange}. {seen ? `He has used: ${seen}.` : 'He has not shown you anything yet.'}</div>
        {d.read.length > 0 && <div>You have read him: he leans on the {d.read.map((m) => MOVE_NAMES[m].toLowerCase()).join(', ')}.</div>}
        {d.exchange > 0 && <div class="muted">Your guess: {likely.map((m) => MOVE_NAMES[m].toLowerCase()).join(' or ')} next.</div>}
        <div class="muted">Strike catches a feint. Guard turns a strike. Feint draws a guard.</div>
      </div>
      <div class="log recent">{d.log.slice(-4).map((l, i) => <p key={d.log.length + i}>{l}</p>)}</div>
      <Actions options={options} onAct={onAct} />
      {d.log.length > 4 && <div class="log">{d.log.slice(0, -4).reverse().map((l, i) => <p key={i}>{l}</p>)}</div>}
    </div>
  );
}

function Wall({ name, men, start, morale, them }: { name: string; men: number; start: number; morale: number; them?: boolean }) {
  return (
    <div class={`wall${them ? ' them' : ''}`}>
      <div>{name}: {men} of {start} standing</div>
      <div class="strip" style={{ width: `${Math.max(2, (100 * men) / Math.max(start, 1))}%` }} />
      <div class="muted">Spirit</div>
      <Bar value={morale} max={10} kind={them ? 'red' : 'sea'} />
    </div>
  );
}

export function BattleView({ content, b, options, onAct }: { content: ContentBundle; b: BattleState; options: ActionOption[]; onAct: (a: Action) => void }) {
  const fc = enemyForecast(b);
  const likely = [...ORDERS].filter((o) => fc[o] > 0).sort((x, y) => fc[y] - fc[x]).slice(0, 2);
  const foe = content.foes[b.foeId];
  return (
    <div>
      <h2>The shield-wall<span class="tag lethal" style={{ marginLeft: 10 }}>Lethal</span></h2>
      {foe && <p class="muted small">{foe.desc}</p>}
      <div class="walls">
        <Wall name="Your men" men={b.us.men} start={b.us.start} morale={b.us.morale} />
        <Wall name={b.them.name} men={b.them.men} start={b.them.start} morale={b.them.morale} them />
      </div>
      <div class="card sans small">
        <div>Round {b.round}. You stand: <b>{b.heroDown ? 'carried out of the wall' : POSITION_NAMES[b.position].toLowerCase()}</b>. Blood {Math.max(0, b.heroHp)}/{b.heroHpMax}.</div>
        <div class="forecast">{b.position === 'rear' ? 'From behind the wall you can see their whole line' : b.position === 'wall' ? 'From the wall you can see some of their line' : 'In the front rank you see the shield in front of you'}: they look likely to {likely.map((o) => ORDER_NAMES[o].toLowerCase()).join(' or ')}.</div>
        <div class="muted">Front rank: more fame, more danger, the men fight harder. Behind the wall: you see more and the men notice.</div>
      </div>
      <div class="log recent">{b.log.slice(-4).map((l, i) => <p key={b.log.length + i}>{l}</p>)}</div>
      <Actions options={options} onAct={onAct} />
      {b.log.length > 4 && <div class="log">{b.log.slice(0, -4).reverse().map((l, i) => <p key={i}>{l}</p>)}</div>}
    </div>
  );
}

export function PlunderView({ content, p, options, onAct }: { content: ContentBundle; p: PlunderState; options: ActionOption[]; onAct: (a: Action) => void }) {
  const name = content.places[p.place]?.name ?? p.place;
  return (
    <div>
      <h2>Plunder: {name}</h2>
      <div class="card sans small">
        <div>Carrying {formatSilver(p.taken)}{p.captives ? `, and ${plural(p.captives, 'captive')}` : ''}.</div>
        <div class="muted">The alarm{p.alarm >= ALARM_MAX - 3 ? ': men are gathering in the hills' : ': the countryside is waking'}</div>
        <Bar value={p.alarm} max={ALARM_MAX} kind="red" />
        <div class="muted">When it fills, every farm for a day's walk comes down on you, and you lose some of what you carry getting back to the ships.</div>
      </div>
      <div class="log recent">{p.log.slice(-4).map((l, i) => <p key={p.log.length + i}>{l}</p>)}</div>
      <Actions options={options} onAct={onAct} />
    </div>
  );
}
