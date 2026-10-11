import type { ContentBundle } from '../../content/schema';
import type { GameState } from '../../engine/state';
import { listActions, screenOf, type Action } from '../../engine/index';
import type { MapData } from '../../engine/mapgrid';
import { dateOf, formatDate, seasonName } from '../../engine/calendar';
import { formatSilver, capitalise } from '../../engine/format';
import { lastingFame, livingFame, legendTable } from '../../engine/fame';
import { mouths } from '../../engine/crew';
import { LATE_SEASON_DOY } from '../../engine/tuning';
import { Actions } from './Actions';
import { DuelView, BattleView } from './Fights';
import { MapView } from './MapView';
import { moraleWord } from './Panels';

const AFTERLIFE: Record<string, { title: string; text: string }> = {
  valhalla: { title: 'Valhalla', text: 'A woman in mail stands over the place where you fell, and you rise to meet her. The hall has five hundred and forty doors. Every one of them is open, and they are shouting your name.' },
  folkvangr: { title: 'Fólkvangr', text: 'Half the slain go to Freyja. She chooses first. Her field is wide and green, and the men in it are glad to see you.' },
  ran: { title: "Rán's hall", text: 'Rán draws the drowned down in her net. Her hall is under the sea, lit with gold, and the drowned sit there at her benches, cold, and not unkindly treated.' },
  hel: { title: 'Hel', text: 'The road goes down and north. At the bottom is a hall where those who died in their beds wait for the end of things. It is quiet there.' },
};

/** What to do now: the scene, the fight, the place, the hall. */
export function NowView({ content, map, state, onAct }: { content: ContentBundle; map: MapData; state: GameState; onAct: (a: Action) => void }) {
  const screen = screenOf(state);
  const options = listActions(state, content);
  const p = state.pending;

  if (screen === 'death' && state.death) {
    const a = AFTERLIFE[state.death.afterlife]!;
    const rank = legendTable(state, content).findIndex((r) => r.hero) + 1;
    return (
      <div class="prose">
        <h1>{formatDate(state.death.day)}</h1>
        <p>{state.death.text}</p>
        <h2>{a.title}</h2>
        <p>{a.text}</p>
        <div class="card sans small">
          Fame {Math.round(livingFame(state))}, lasting fame {lastingFame(state)}. Among the living legends of his day he stood {rank === 1 ? 'first' : `${rank}th`}. {state.deeds.length} deeds; {state.deeds.filter((d) => d.verse).length} in verse.
        </div>
        <p class="muted small">[Phase 1: the full saga and the judgment are written in a later phase. The deeds are in the Saga tab.]</p>
      </div>
    );
  }
  if (p?.t === 'scene') {
    const scene = content.scenes[p.id]!;
    const danger = (a: Action) => a.t === 'choose' && !!scene.choices.find((c) => c.id === a.id)?.danger;
    return (
      <div class="prose">
        <h2>{scene.title}</h2>
        <div class={scene.placeholder ? 'placeholder' : ''}>{scene.text.trim().split(/\n\s*\n/).map((t, i) => <p key={i}>{t}</p>)}</div>
        <Actions options={options} onAct={onAct} danger={danger} />
      </div>
    );
  }
  if (p?.t === 'report') {
    return (
      <div class="prose">
        <h2>{p.title}</h2>
        {p.lines.map((l, i) => <p key={i}>{l}</p>)}
        <Actions options={options} onAct={onAct} />
      </div>
    );
  }
  if (p?.t === 'duel') return <DuelView content={content} d={p.duel} options={options} onAct={onAct} />;
  if (p?.t === 'battle') return <BattleView content={content} b={p.battle} options={options} onAct={onAct} />;

  const d = dateOf(state.day);
  const food = Math.floor(state.provisions / Math.max(1, mouths(state)));
  const place = state.at ? content.places[state.at] : null;
  const head = (() => {
    switch (screen) {
      case 'voyage': {
        const v = state.voyage!;
        return <><h2>At sea</h2><p>Bound for {content.places[v.to]!.name}. {v.daysAtSea} days out, the wind {v.wind}. Food for {food} days.</p></>;
      }
      case 'muster':
        return <><h2>The spring muster</h2><p>The ice is off the fjord. Men come down from the farms to see who is going west this year, and on whose ship. Sign them on, fill the ship with food, mend her, and go.</p><p class="muted small sans">{state.musterPool} men in the district would still sign on. Food for {food} days. Silver: {formatSilver(state.silver)}.</p></>;
      case 'return':
        return <><h2>Home</h2><p>The ships are hauled up and the men want their shares. How you divide the plunder is how they will remember the summer.</p><p class="muted small sans">Plunder: {formatSilver(state.loot)}. {state.flags.owes_jarl ? 'The jarl takes a quarter first, for the loan of the ship. ' : ''}The crew is {moraleWord(state.crew.morale)}.</p></>;
      case 'hall':
        return <><h2>The winter hall</h2><p>Snow to the eaves, and the long nights. {state.hallLeft === 1 ? 'One more thing to do before spring.' : `${state.hallLeft} things to do before spring.`}</p><p class="muted small sans">Silver: {formatSilver(state.silver)}. {state.deeds.some((x) => x.told === null) ? 'Some deeds have not been told yet: a feast would tell them.' : 'Every deed has been told.'}</p></>;
      default:
        return (
          <>
            <h2>{place?.name}</h2>
            <p>{place?.desc}</p>
            <p class="muted small sans">{capitalise(seasonName(state.day))}. Food for {food} days. The crew is {moraleWord(state.crew.morale)}. {state.loot ? `Plunder aboard: ${formatSilver(state.loot)}.` : ''}{state.at === 'home_fjord' && d.doy < LATE_SEASON_DOY ? ' The summer is still young.' : ''}</p>
          </>
        );
    }
  })();
  return (
    <div>
      {head}
      {(screen === 'place' || screen === 'voyage') && <MapView content={content} map={map} state={state} mini />}
      <Actions options={options} onAct={onAct} />
    </div>
  );
}
