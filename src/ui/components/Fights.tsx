import type { ContentBundle } from '../../content/schema';
import { DUEL_MOVES, ORDERS } from '../../content/schema';
import type { DuelSide, DuelState, BattleState, PlunderState } from '../../engine/state';
import { formatSilver, plural } from '../../engine/format';
import { ALARM_MAX } from '../../engine/plunder';
import type { Action, ActionOption } from '../../engine/index';
import { MOVE_NAMES, foeForecast } from '../../engine/duel';
import { ORDER_NAMES, POSITION_NAMES, enemyForecast } from '../../engine/battle';
import { Actions, Bar } from './Actions';
import { BOUT, BOUT_WAYS, FOE_NEXT, FOE_TELL, boutAdvice } from '../../engine/bout';
import { INTENT_SHORT, INTENT_TEXT, WALL, WALL_WAYS, spiritWord, wallAdvice } from '../../engine/wall';

function Fighter({ s, you }: { s: DuelSide; you?: boolean }) {
  return (
    <div class="fighter">
      <div class="name">{you ? 'You' : s.name}</div>
      Blood {Math.max(0, s.hp)}/{s.hpMax}
      <Bar value={s.hp} max={s.hpMax} kind="red" />
      Breath {Math.max(0, s.stamina)}/{s.staminaMax}
      <Bar value={s.stamina} max={s.staminaMax} kind="gold" />
      {s.shields > 0
        ? <>Shields <span class="shields">{'◆'.repeat(s.shields)}</span> <span class="muted">({s.integrity} blows left in this one)</span></>
        : <span class="muted">No shield left</span>}
    </div>
  );
}

/** The second form of single combat (docs/FRAME-COMBAT-2.md): what he is about to do is shown; every move shows its price. */
function BoutView({ content, d, options, onAct }: { content: ContentBundle; d: DuelState; options: ActionOption[]; onAct: (a: Action) => void }) {
  const foe = content.fighters[d.foeId];
  const b = d.bout!;
  const holm = d.kind === 'holmgang';
  return (
    <div>
      <h2>{holm ? 'The holmgang' : 'Single combat'}{d.lethal && <span class="tag lethal" style={{ marginLeft: 10 }}>Lethal</span>}</h2>
      {foe && <p class="muted small">{foe.desc}</p>}
      <div class="fighters">
        <Fighter s={d.hero} you />
        <Fighter s={d.foe} />
      </div>
      <div class="card sans small">
        <div><b>{readLine(d.foe.name.split(' ')[0]!, b.read, b.shown.map((m) => FOE_TELL[m]))}</b>{b.foeOff ? ' He is off balance.' : ''}</div>
        {b.foeNext && <div class="muted">You can read him further: after that, he means to {FOE_NEXT[b.foeNext]}.</div>}
        {b.heroOff && <div>You are off balance: your next blow lands soft, and his lands hard.</div>}
        {holm && <div class="muted">The cloak: you are {BOUT.edge - b.heroEdge} step{BOUT.edge - b.heroEdge === 1 ? '' : 's'} from the edge; he is {BOUT.edge - b.foeEdge}.</div>}
        <Advice a={boutAdvice(d)} />
        <Ways title="How single combat goes" lines={BOUT_WAYS} />
      </div>
      <div class="log recent">{d.log.slice(-4).map((l, i) => <p key={d.log.length + i}>{l}</p>)}</div>
      <Actions options={options} onAct={onAct} />
      {d.log.length > 4 && <div class="log">{d.log.slice(0, -4).reverse().map((l, i) => <p key={i}>{l}</p>)}</div>}
    </div>
  );
}

export function DuelView({ content, d, options, onAct }: { content: ContentBundle; d: DuelState; options: ActionOption[]; onAct: (a: Action) => void }) {
  if (d.bout) return <BoutView content={content} d={d} options={options} onAct={onAct} />;
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

/** The second form of the shield-wall (docs/FRAME-COMBAT-2.md): deployment, then their move shown, and the price of each answer. */
function WallView({ content, b, options, onAct }: { content: ContentBundle; b: BattleState; options: ActionOption[]; onAct: (a: Action) => void }) {
  const foe = content.foes[b.foeId];
  const w = b.wall!;
  const groundWord = w.ground === 0 ? 'the lines are where they met' : w.ground > 0 ? `you have pushed them back ${w.ground} step${w.ground === 1 ? '' : 's'} (at 3 they break)` : `they have pushed you back ${-w.ground} step${w.ground === -1 ? '' : 's'} (at 3 your line breaks)`;
  return (
    <div>
      <h2>{b.host ? b.host.title : 'The shield-wall'}<span class="tag lethal" style={{ marginLeft: 10 }}>Lethal</span></h2>
      {foe && <p class="muted small">{foe.desc}</p>}
      {w.phase === 'deploy' ? (
        <div class="card sans small">
          <div><b>{b.them.name}: about {b.them.men}. {b.us.name}: {b.us.men}.</b></div>
          <div>Before the horns: {w.step === 'sworn' ? 'where do your sworn men stand?' : w.step === 'reserve' ? 'how many men do you hold back?' : 'where do you stand?'}</div>
          {!w.leads && <div class="muted">You do not command this wall. Where you stand, and what you shout, is yours.</div>}
        </div>
      ) : (
        <>
          <div class="walls">
            <WallSide name={b.us.name} men={b.us.men} start={b.us.start} cohesion={b.us.morale} stamina={w.usStamina} />
            <WallSide name={b.them.name} men={b.them.men} start={b.them.start} cohesion={b.them.morale} stamina={w.themStamina} them />
          </div>
          <div class="card sans small">
            <div><b>{readLine('They', w.read, w.shown.map((x) => INTENT_TEXT[x].replace(/^they /, '')))}</b></div>
            {b.position === 'rear' && !b.heroDown && w.read === 'sure' && w.guile <= 1 && <div class="muted">From behind the wall you can see what comes after: {INTENT_SHORT[w.next]}.</div>}
            {w.leader && <div>{w.leader.charAt(0).toUpperCase() + w.leader.slice(1)}: {w.leaderDown ? 'down' : 'standing'}. {w.resolve === 'levy' ? 'A levy: it breaks early, and runs if he falls.' : w.resolve === 'hird' ? 'His own sworn men: they will close round him.' : 'Fighting men: they hold until their spirit goes.'}</div>}
            <div>Round {b.round + 1} of {w.maxRounds}. Ground: {groundWord}.{w.reserveMen > 0 && !w.reserveIn ? ` Reserve: ${w.reserveMen} men, waiting.` : ''}</div>
            <div>You stand: <b>{b.heroDown ? 'carried out of the wall' : POSITION_NAMES[b.position].toLowerCase()}</b>. Blood {Math.max(0, b.heroHp)}/{b.heroHpMax}.</div>
            <Advice a={wallAdvice(b)} />
            <Ways title="How the wall fights" lines={WALL_WAYS} />
          </div>
        </>
      )}
      <div class="log recent">{b.log.slice(-4).map((l, i) => <p key={b.log.length + i}>{l}</p>)}</div>
      <Actions options={options} onAct={onAct} />
      {b.log.length > 4 && <div class="log">{b.log.slice(0, -4).reverse().map((l, i) => <p key={i}>{l}</p>)}</div>}
    </div>
  );
}

/** What he can see of the other side's next move: sure, likely, or one of two. */
function readLine(who: string, read: 'sure' | 'likely' | 'torn', seen: string[]): string {
  if (read === 'sure') return `${who} ${seen[0]}.`;
  if (read === 'likely') return `${who} look${who === 'They' ? '' : 's'} as if ${who === 'They' ? 'they' : 'he'} ${seen[0]}, but ${who === 'They' ? 'they are' : 'he is'} hard to read.`;
  return `You cannot tell: ${who === 'They' ? 'they' : 'he'} ${seen[0]}, or ${seen[1]}.`;
}

function Advice({ a }: { a: { who: string; text: string } | null }) {
  return a ? <div class="advice">{a.who}: “{a.text}”</div> : null;
}

function Ways({ title, lines }: { title: string; lines: string[] }) {
  return (
    <details class="ways">
      <summary>{title}</summary>
      <ul>{lines.map((l) => <li key={l}>{l}</li>)}</ul>
    </details>
  );
}

function WallSide({ name, men, start, cohesion, stamina, them }: { name: string; men: number; start: number; cohesion: number; stamina: number; them?: boolean }) {
  return (
    <div class={`wall${them ? ' them' : ''}`}>
      <div>{name}: {Math.max(0, men)} of {start} standing</div>
      <div class="strip" style={{ width: `${Math.max(2, (100 * men) / Math.max(start, 1))}%` }} />
      <div class="muted">Spirit: {spiritWord(cohesion)}</div>
      <Bar value={Math.max(0, cohesion)} max={10} kind={them ? 'red' : 'sea'} />
      <div class="muted">Breath {stamina}/{WALL.stamina}</div>
      <Bar value={stamina} max={WALL.stamina} kind="gold" />
    </div>
  );
}

export function BattleView({ content, b, options, onAct }: { content: ContentBundle; b: BattleState; options: ActionOption[]; onAct: (a: Action) => void }) {
  if (b.wall) return <WallView content={content} b={b} options={options} onAct={onAct} />;
  const fc = enemyForecast(b);
  const likely = [...ORDERS].filter((o) => fc[o] > 0).sort((x, y) => fc[y] - fc[x]).slice(0, 2);
  const foe = content.foes[b.foeId];
  return (
    <div>
      <h2>{b.host ? b.host.title : 'The shield-wall'}<span class="tag lethal" style={{ marginLeft: 10 }}>Lethal</span></h2>
      {foe && <p class="muted small">{foe.desc}</p>}
      {b.host && (
        <div class="card sans small">
          <div class="muted">The line ({b.host.role === 'host' ? 'yours to command' : b.host.role === 'wing' ? 'you hold the centre' : 'you stand in it'}){b.host.reserve.us > 0 ? `; reserve ${b.host.reserve.usIn ? 'committed' : `${b.host.reserve.us} men, waiting`}` : ''}{b.host.reserve.them > 0 && b.host.reserve.themIn ? '; their reserve is in' : ''}:</div>
          {[{ name: 'Your part of the line', us: b.us, them: b.them, over: b.over }, ...b.host.wings].map((w, i) => (
            <div key={i} style={{ marginTop: 4 }}>
              <b>{w.name}</b>{w.over ? <span class="muted"> — {w.over === 'won' ? 'they broke the men in front of them' : w.over === 'lost' ? 'broken' : 'spent, fallen back'}</span> : <span class="muted"> — {Math.max(0, w.us.men)} against {Math.max(0, w.them.men)}</span>}
              {!w.over && <Bar value={Math.max(0, w.us.morale)} max={10} kind="gold" />}
            </div>
          ))}
        </div>
      )}
      <div class="walls">
        <Wall name={b.us.name} men={b.us.men} start={b.us.start} morale={b.us.morale} />
        <Wall name={b.them.name} men={b.them.men} start={b.them.start} morale={b.them.morale} them />
      </div>
      <div class="card sans small">
        <div>Round {b.round}. You stand: <b>{b.heroDown ? 'carried out of the wall' : POSITION_NAMES[b.position].toLowerCase()}</b>. Blood {Math.max(0, b.heroHp)}/{b.heroHpMax}.</div>
        <div class="forecast">{b.position === 'rear' ? 'From behind the wall you can see their whole line' : b.position === 'wall' ? 'From the wall you can see some of their line' : 'In the front rank you see the shield in front of you'}: they look likely to {likely.map((o) => ORDER_NAMES[o].toLowerCase()).join(' or ')}.</div>
        {b.us.name !== 'Your men' && <div class="muted">You do not command this wall. But a wall moves with its loudest voices, and what you shout, the men round you take up.</div>}
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
