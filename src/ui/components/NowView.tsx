import { focusChild, heirSets } from '../../engine/family';
import { HEIR_ATTRS } from '../../engine/makeup';
import { Makeup } from './Makeup';
import { goodsRoom } from '../../engine/trade';
import { epitaph } from '../../engine/saga';
import { useEffect, useState } from 'preact/hooks';
import type { ContentBundle, Scene } from '../../content/schema';
import type { GameState } from '../../engine/state';
import { listActions, screenOf, type Action } from '../../engine/index';
import type { MapData } from '../../engine/mapgrid';
import { dateOf, formatDate, seasonName } from '../../engine/calendar';
import { formatSilver, capitalise, shipOf } from '../../engine/format';
import { lastingFame, livingFame, legendTable } from '../../engine/fame';
import { mouths } from '../../engine/crew';
import { LATE_SEASON_DOY } from '../../engine/tuning';
import { Actions } from './Actions';
import { DuelView, BattleView } from './Fights';
import { MapView } from './MapView';
import { moraleWord } from './Panels';
import { SceneArt } from '../scene/SceneArt';
import { getValue } from '../../engine/paths';
import { renderText } from '../../engine/text';
import { tierAt, TIER_NAMES, TIER_HINTS } from '../../engine/standing';
import { gearWord } from '../../engine/items';
import { PlunderView } from './Fights';

const AFTERLIFE: Record<string, { title: string; text: string }> = {
  valhalla: { title: 'Valhalla', text: 'A woman in mail stands over the place where you fell, and you rise to meet her. The hall has five hundred and forty doors. Every one of them is open, and they are shouting your name.' },
  folkvangr: { title: 'Fólkvangr', text: 'Half the slain go to Freyja. She chooses first. Her field is wide and green, and the men in it are glad to see you.' },
  ran: { title: "Rán's hall", text: 'Rán draws the drowned down in her net. Her hall is under the sea, lit with gold, and the drowned sit there at her benches, cold, and not unkindly treated.' },
  hel: { title: 'Hel', text: 'The road goes down and north. At the bottom is a hall where those who died in their beds wait for the end of things. It is quiet there.' },
};

/** A scene's picture and how loud the hall is, if the scene names one. */
function Art({ content, state, art }: { content: ContentBundle; state: GameState; art: Scene['art'] | { key: string; laughter?: string } | undefined }) {
  if (!art) return null;
  const key = typeof art === 'string' ? art : art.key;
  const entry = content.art[key];
  if (!entry) return null;
  let laughter = 0;
  if (typeof art !== 'string' && art.laughter) {
    try { laughter = Math.max(0, Math.min(2, Number(getValue(state, content, art.laughter)) || 0)); } catch { laughter = 0; }
  }
  return <SceneArt entry={entry} mood={{ laughter }} />;
}

const paras = (text: string) => text.trim().split(/\n\s*\n/).map((t, i) => <p key={i}>{t}</p>);
const BREAK = /^\s*\[break\]\s*$/m;

/** A scene read in beats: [break] lines split it into pages; the choices come on the last page. */
function SceneView({ content, state, scene, onAct }: { content: ContentBundle; state: GameState; scene: Scene; onAct: (a: Action) => void }) {
  const pages = renderText(scene.text, state, content, { keepDead: scene.id.startsWith('mourn_') }).split(BREAK).map((t) => t.trim()).filter(Boolean);
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [scene.id, state.day]);
  const last = page >= pages.length - 1;
  const danger = (a: Action) => a.t === 'choose' && !!scene.choices.find((c) => c.id === a.id)?.danger;
  return (
    <>
      <Art content={content} state={state} art={scene.art} />
      <div class="screen prose">
        {scene.when && <div class="pagecount">{scene.when}</div>}
        <h2>{scene.title}</h2>
        <div class={scene.placeholder ? 'placeholder' : ''}>{paras(pages[Math.min(page, pages.length - 1)] ?? '')}</div>
        {last ? (
          <Actions options={listActions(state, content)} onAct={onAct} danger={danger} />
        ) : (
          <div class="choices">
            <button class="choice" onClick={() => { setPage(page + 1); window.scrollTo(0, 0); }}><span class="txt">Continue</span><span class="pagecount">{page + 1} / {pages.length}</span></button>
          </div>
        )}
      </div>
    </>
  );
}

/** What to do now: the scene, the fight, the place, the hall. */
export function NowView({ content, map, state, onAct }: { content: ContentBundle; map: MapData; state: GameState; onAct: (a: Action) => void }) {
  const screen = screenOf(state);
  const options = listActions(state, content);
  const p = state.pending;

  if (screen === 'death' && state.death) {
    const a = AFTERLIFE[state.death.afterlife]!;
    return (
      <div class="screen prose">
        <h1>{formatDate(state.death.day)}</h1>
        <p>{state.death.text}</p>
        <h2>{a.title}</h2>
        <p>{a.text}</p>
        {epitaph(state, content).map((l, i, all) => i === all.length - 1 ? <div key={i} class="card sans small">{l} The deeds are in the Saga tab.</div> : <p key={i}>{l}</p>)}
        {options.length > 0 && <><h2>His sons</h2><p>The saga can go on as his son's: the same world, what is left of the farm, his father's name, his father's feuds.</p><Actions options={options} onAct={onAct} /></>}
      </div>
    );
  }
  if (p?.t === 'heir') {
    const c = focusChild(state)!;
    const sets = heirSets(state, content, c);
    return <Makeup title={state.hero.name} intro={`Son of ${state.hero.father}, sixteen this spring. Spread what you were born with, and say how you were raised.`} start={HEIR_ATTRS} sets={sets} begin="Stand at his mound" onBegin={(attrs, set) => onAct({ t: 'heir_make', attrs, set })} />;
  }
  if (p?.t === 'scene') return <SceneView content={content} state={state} scene={content.scenes[p.id]!} onAct={onAct} />;
  if (p?.t === 'report') {
    return (
      <>
        <Art content={content} state={state} art={p.art ? { key: p.art, laughter: p.laughter } : undefined} />
        <div class="screen prose">
          <h2>{p.title}</h2>
          {p.lines.map((l, i) => <p key={i}>{l}</p>)}
          <Actions options={options} onAct={onAct} />
        </div>
      </>
    );
  }
  if (p?.t === 'duel') return <div class="screen"><DuelView content={content} d={p.duel} options={options} onAct={onAct} /></div>;
  if (p?.t === 'battle') return <div class="screen"><BattleView content={content} b={p.battle} options={options} onAct={onAct} /></div>;
  if (p?.t === 'cruise') {
    return (
      <>
        <Art content={content} state={state} art={{ key: 'open_sea' }} />
        <div class="screen">
          <h2>Orders for the coast</h2>
          <p>You tell the men where, how long, what to take and how far to push it. They sail, scout and raid, and they come and find you whenever something needs you: a fight you said you would lead, a bad wound, heavy losses, a stranger on the beach.</p>
          <Actions options={options} onAct={onAct} />
        </div>
      </>
    );
  }
  if (p?.t === 'trade') {
    const place = content.places[state.at!]!;
    const wants = place.trade!.dear.map((g) => content.goods[g]!.name.toLowerCase());
    return (
      <div class="screen">
        <h2>The trading beach</h2>
        <p>Goods laid out on cloths and hides along the strand, and men who have done this all their lives watching you work out what things are worth.{wants.length ? ` Here they pay well for ${wants.join(', ')}.` : ''}</p>
        {state.shopNote && <p class="card small">{state.shopNote}</p>}
        <p class="muted small sans">Silver: {formatSilver(state.silver)}. Room for goods: {formatSilver(goodsRoom(state, content))} of hold space.{state.tradeYear?.year === dateOf(state.day).year ? ` Profit this year: ${formatSilver(Math.round(state.tradeYear.profit))}.` : ''}</p>
        <Actions options={options} onAct={onAct} />
      </div>
    );
  }
  if (p?.t === 'shop') {
    const smith = p.shops.includes('smith');
    return (
      <div class="screen">
        <h2>{smith ? 'The smith and the shipwright' : 'The market'}</h2>
        <p>{smith ? 'The smith works at the back of his father\'s house, black to the elbows. The shipwright works on the shingle, with an adze and an opinion about everything.' : 'Booths of iron and cloth along the beach, men shouting prices in four languages, and a shipwright\'s yard at the end of it where the tar-pots smoke.'}</p>
        {state.shopNote && <p class="card small">{state.shopNote}</p>}
        <p class="muted small sans">Silver: {formatSilver(state.silver)}.{state.service ? '' : ` Your men carry ${gearWord(state.crew.gear)}.`}</p>
        <Actions options={options} onAct={onAct} />
      </div>
    );
  }
  if (p?.t === 'plunder') {
    const pl = content.places[p.plunder.place];
    const burnt = `${p.plunder.place}_burning`;
    return (
      <>
        <Art content={content} state={state} art={p.plunder.burned && content.art[burnt] ? burnt : pl?.art} />
        <div class="screen"><PlunderView content={content} p={p.plunder} options={options} onAct={onAct} /></div>
      </>
    );
  }

  const d = dateOf(state.day);
  const food = Math.floor(state.provisions / Math.max(1, mouths(state)));
  const place = state.at ? content.places[state.at] : null;
  const svc = state.service;
  const ship = state.ships[0]?.name ? state.ships[0].name.replace(/^the /, 'The ') : 'The ship';
  const head = (() => {
    switch (screen) {
      case 'voyage': {
        const v = state.voyage!;
        return <><h2>At sea</h2><p>Bound for {content.places[v.to]!.name}{svc ? ` in ${svc.captain}'s ship` : ''}. {v.daysAtSea} days out, the wind {v.wind}.{svc ? '' : ` Food for ${food} days.`}</p></>;
      }
      case 'muster':
        if (svc) return <><h2>{ship}</h2><p>The ice is off the fjord. {svc.captain} has {shipOf(svc.captain, state.ships[0]?.name ?? 'his ship')} down on the jarl's landing, loaded with water, meal, dried fish and spare oars, and he is waiting for the spring storms to blow out. Your sea-chest is under your bench. All that is left is to row.</p><p class="muted small sans">Silver: {formatSilver(state.silver)}.</p></>;
        return <><h2>The spring muster</h2><p>The ice is off the fjord. Men come down from the farms to see who is going west this year, and on whose ship. Sign them on, fill the ship with food, mend her, and go.</p><p class="muted small sans">{state.musterPool} men in the district would still sign on. Food for {food} days. Silver: {formatSilver(state.silver)}.</p></>;
      case 'return':
        if (svc) return <><h2>Home</h2><p>{ship} is hauled up on the jarl's landing, and the men are on the strand round the heap, waiting for {svc.captain} to divide the summer.</p><p class="muted small sans">In the heap: {formatSilver(state.loot)}{state.captives ? `, and ${state.captives} captives for the trader` : ''}. Your shares: {svc.shares}.</p></>;
        return <><h2>Home</h2><p>The ships are hauled up and the men want their shares. How you divide the plunder is how they will remember the summer.</p><p class="muted small sans">Plunder: {formatSilver(state.loot)}. {state.flags.owes_jarl ? 'The jarl takes a quarter first, for the loan of the ship. ' : ''}The crew is {moraleWord(state.crew.morale)}.</p></>;
      case 'hall':
        return <><h2>The winter hall</h2><p>Snow to the eaves, and the long nights. {state.hallLeft === 1 ? 'One more thing to do before spring.' : `${state.hallLeft} things to do before spring.`}</p><p class="muted small sans">Silver: {formatSilver(state.silver)}. {state.deeds.some((x) => x.told === null) ? 'Some deeds have not been told yet: a feast would tell them.' : 'Every deed has been told.'}</p></>;
      default:
        return (
          <>
            <h2>{place?.name}</h2>
            <p>{place?.desc}</p>
            {place && place.kind !== 'home' && (() => {
              const t = tierAt(state, content, place.id);
              return <p class="small sans"><span class={`pill standing-${t}`}>{TIER_NAMES[t]}</span> {TIER_HINTS[t]}</p>;
            })()}
            <p class="muted small sans">{capitalise(seasonName(state.day))}. {svc ? `You row in ${svc.captain}'s ship. The men are ${moraleWord(state.crew.morale)}.` : `Food for ${food} days. The crew is ${moraleWord(state.crew.morale)}.`} {state.loot ? `Plunder aboard: ${formatSilver(state.loot)}.` : ''}{state.at === (state.homeAt ?? 'home_fjord') && d.doy < LATE_SEASON_DOY ? ' The summer is still young.' : ''}</p>
          </>
        );
    }
  })();
  const art = screen === 'voyage' ? 'open_sea' : screen === 'muster' ? 'muster' : screen === 'hall' ? 'hearth_ormr' : screen === 'return' ? 'ship_home' : place?.art;
  return (
    <>
      <Art content={content} state={state} art={art} />
      <div class={art ? 'screen art-led' : 'screen'}>
        {head}
        {(screen === 'place' || screen === 'voyage') && <MapView content={content} map={map} state={state} mini />}
        <Actions options={options.filter((o) => o.group !== 'Course')} onAct={onAct} />
        {options.some((o) => o.group === 'Course') && <p class="muted small sans">To sail further than one leg, tap a port on the Map and set a course for it.</p>}
      </div>
    </>
  );
}
