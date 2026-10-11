import { useEffect, useState } from 'preact/hooks';
import type { ContentBundle } from '../content/schema';
import type { GameState } from '../engine/state';
import type { MapData } from '../engine/mapgrid';
import { act, newGame, screenOf, type Action } from '../engine/index';
import { toSave, fromSave } from '../engine/save';
import { encodeSaveCode, decodeSaveCode } from '../engine/savecode';
import { dateOf, dayOf, MONTHS } from '../engine/calendar';
import { formatSilver } from '../engine/format';
import { livingFame, untoldCount } from '../engine/fame';
import { saveGame, loadGame, clearSave } from './storage';
import { NowView } from './components/NowView';
import { MapView } from './components/MapView';
import { HeroPanel, CrewPanel, SagaPanel } from './components/Panels';
import { Knot, PixelIcon } from './components/Ornament';
import { SceneArt } from './scene/SceneArt';

type Tab = 'now' | 'map' | 'hero' | 'crew' | 'saga';
const TABS: { id: Tab; label: string }[] = [
  { id: 'now', label: 'Now' }, { id: 'map', label: 'Map' }, { id: 'hero', label: 'Hero' }, { id: 'crew', label: 'Crew' }, { id: 'saga', label: 'Saga' },
];
const NAMES = ['Hrafn', 'Asbjorn', 'Ketil', 'Orm', 'Thorir', 'Ulfar', 'Eyvind', 'Halldor', 'Arni', 'Bjorn'];

/** The calibration scenes (FRAME-PHASE2 §7): where and when each one opens. */
const CALIBRATION: { scene: string; label: string; year: number; doy: number; at: string; phase: GameState['phase'] }[] = [
  { scene: 'cal_ormr', label: "Ormr's night", year: 828, doy: 345, at: 'home_fjord', phase: 'winter' },
  { scene: 'cal_iona', label: 'The approach to Iona', year: 830, doy: 158, at: 'iona', phase: 'sailing' },
  { scene: 'cal_yule', label: 'Yule: the flyting', year: 830, doy: 358, at: 'home_fjord', phase: 'winter' },
];

function shortDate(day: number): string {
  const d = dateOf(day);
  return `${d.dom} ${MONTHS[d.month]!.slice(0, 3)} ${d.year}`;
}

function Title({ content, hasSave, start, onContinue, onNew, onPreview }: { content: ContentBundle; hasSave: boolean; start: 'title' | 'preview'; onContinue: () => void; onNew: (bg: string, name: string) => void; onPreview: (scene: string, name: string) => void }) {
  const [step, setStep] = useState<'title' | 'new' | 'preview'>(start);
  const [bg, setBg] = useState('younger_son');
  const [name, setName] = useState(NAMES[Math.floor(Math.random() * NAMES.length)]!);
  if (step === 'title') {
    return (
      <div class="title">
        {content.art.title && <SceneArt entry={content.art.title} mood={{ laughter: 0 }} />}
        <h1>VIKINGR</h1>
        <Knot />
        <div class="sub">From nothing, to sea king, to Valhalla.</div>
        <div class="choices">
          {hasSave && <button class="choice primary" onClick={onContinue}><span class="txt">Continue your life</span></button>}
          <button class="choice" onClick={() => setStep('new')}><span class="txt">Begin a new life</span></button>
          <button class="choice" onClick={() => setStep('preview')}><span class="txt">Calibration scenes<span class="hint">Three finished scenes, for your verdict on voice, length and look</span></span></button>
        </div>
        <p class="note">This game is brutal in the way the 9th century was. Killing, slavery and death are part of it, never glorified.</p>
      </div>
    );
  }
  if (step === 'preview') {
    return (
      <main class="screen">
        <h1>Calibration</h1>
        <p>Three scenes written at full quality, before the rest of the year is written. Play each, then say what to change: the voice, the length, the look, the animation.</p>
        <h3>His name</h3>
        <input type="text" id="cal-name" value={name} maxLength={20} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        <div class="choices">
          {CALIBRATION.map((c) => (
            <button key={c.scene} class="choice" onClick={() => onPreview(c.scene, name)}><span class="txt">{c.label}<span class="hint">{content.scenes[c.scene]?.title}</span></span></button>
          ))}
          <button class="choice" onClick={() => setStep('title')}><span class="txt">Back</span></button>
        </div>
      </main>
    );
  }
  return (
    <main class="screen">
      <h1>Spring, 830</h1>
      <p>You are sixteen. You grew up on the stories: ships that came home low in the water, old men at the hearth with one hand and an arm-ring. Who are you?</p>
      <h3>Name</h3>
      <input type="text" id="new-name" value={name} maxLength={20} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      <h3 style={{ marginTop: 18 }}>Born as</h3>
      <div class="bgs">
        {Object.values(content.backgrounds).map((b) => (
          <button key={b.id} class={`choice bg${bg === b.id ? ' on' : ''}`} onClick={() => setBg(b.id)}>
            <span class="txt">{b.label}<span class="hint">{b.desc}</span></span>
          </button>
        ))}
      </div>
      <div class="choices">
        <button class="choice primary" onClick={() => onNew(bg, name)}><span class="txt">Begin</span></button>
        <button class="choice" onClick={() => setStep('title')}><span class="txt">Back</span></button>
      </div>
    </main>
  );
}

function Menu({ content, state, onClose, onLoad, onQuit }: { content: ContentBundle; state: GameState; onClose: () => void; onLoad: (s: GameState) => void; onQuit: () => void }) {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const debug = new URLSearchParams(location.search).has('debug');
  return (
    <div class="menu" onClick={onClose}>
      <div class="sheet" onClick={(e) => e.stopPropagation()}>
        <h2>Menu</h2>
        <p class="muted small sans">The game saves itself after every choice, on this device.</p>
        <div class="choices">
          <button class="choice" onClick={async () => { const c = await encodeSaveCode(toSave(state, content)); setCode(c); try { await navigator.clipboard.writeText(c); setMsg('Copied. Keep it somewhere safe.'); } catch { setMsg('Copy the text below.'); } }}><span class="txt">Save as text</span></button>
          <button class="choice" onClick={async () => {
            try { const s = fromSave(await decodeSaveCode(code), content); onLoad(s.state); setMsg(s.warnings.join(' ') || 'Loaded.'); }
            catch (e) { setMsg((e as Error).message); }
          }}><span class="txt">Load from the text below</span></button>
          <textarea id="save-code" value={code} placeholder="Paste a saved life here (it starts VIKR1.)" onInput={(e) => setCode((e.target as HTMLTextAreaElement).value)} />
          {msg && <p class="small sans">{msg}</p>}
          <button class="choice" onClick={onQuit}><span class="txt">Back to the title</span></button>
          <button class="choice primary" onClick={onClose}><span class="txt">Close</span></button>
        </div>
        {debug && <pre class="small sans" style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>seed {state.seed}{'\n'}{JSON.stringify({ ...state, journal: undefined, deeds: state.deeds.length }, null, 1)}</pre>}
      </div>
    </div>
  );
}

export function App({ content, map }: { content: ContentBundle; map: MapData }) {
  const [state, setState] = useState<GameState | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [hasSave, setHasSave] = useState(() => !!loadGame(content));
  const [tab, setTab] = useState<Tab>('now');
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState('');
  const [titleStep, setTitleStep] = useState<'title' | 'preview'>('title');

  // calibration lives never overwrite a real save
  useEffect(() => { if (state && !preview) saveGame(state, content); }, [state]);
  useEffect(() => { window.scrollTo(0, 0); }, [state?.pending, tab]);

  const toTitle = (step: 'title' | 'preview' = 'title') => { setTitleStep(step); setPreview(null); setState(null); setHasSave(!!loadGame(content)); };

  if (!state) {
    return (
      <div class="app">
        <Title
          content={content}
          hasSave={hasSave}
          start={titleStep}
          onContinue={() => { const l = loadGame(content); if (l) setState(l.state); }}
          onNew={(bg, name) => { setPreview(null); setState(newGame(content, { background: bg, seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, name })); setTab('now'); }}
          onPreview={(scene, name) => {
            const c = CALIBRATION.find((x) => x.scene === scene)!;
            const s = newGame(content, { background: 'younger_son', seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, name });
            s.day = dayOf(c.year, c.doy);
            s.at = c.at;
            s.phase = c.phase;
            if (!s.known.includes(c.at)) s.known.push(c.at);
            s.pending = { t: 'scene', id: scene };
            s.seen[scene] = s.day;
            setPreview(scene);
            setState(s);
            setTab('now');
          }}
        />
      </div>
    );
  }

  const onAct = (a: Action) => {
    try {
      setState(act(content, state, a));
      setError('');
      if (a.t !== 'slot') setTab('now');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const screen = screenOf(state);
  const busy = !['place', 'hall', 'muster', 'return'].includes(screen);
  const untold = untoldCount(state);
  const where = state.at ? content.places[state.at]?.name : state.voyage ? `Bound for ${content.places[state.voyage.to]?.name}` : '';
  const previewDone = preview && !state.pending && !state.death;

  return (
    <div class="app">
      <header class="topbar">
        <span class="where">{where}</span>
        <span class="stat">{shortDate(state.day)}</span>
        <span class="stat silver">{formatSilver(state.silver)}</span>
        <span class="stat">Fame {Math.round(livingFame(state))}{untold ? <span class="untold"> +{untold}</span> : ''}</span>
        <button class="iconbtn" aria-label="Menu" onClick={() => setMenu(true)}><i /><i /><i /></button>
      </header>
      <main>
        {error && <p class="card small sans">{error}</p>}
        {previewDone ? (
          <div class="screen">
            <h2>End of the calibration scene</h2>
            <p>That is as far as this scene goes. In the game, the year carries on from here.</p>
            <div class="choices"><button class="choice primary" onClick={() => toTitle('preview')}><span class="txt">Back to the calibration scenes</span></button></div>
          </div>
        ) : (
          <>
            {tab === 'now' && <NowView content={content} map={map} state={state} onAct={onAct} />}
            {tab === 'map' && <div class="screen"><h2>The known world</h2><MapView content={content} map={map} state={state} /></div>}
            {tab === 'hero' && <div class="screen"><HeroPanel content={content} state={state} /></div>}
            {tab === 'crew' && <div class="screen"><CrewPanel content={content} state={state} onAct={onAct} /></div>}
            {tab === 'saga' && <div class="screen"><SagaPanel content={content} state={state} /></div>}
          </>
        )}
        {state.death && tab === 'now' && (
          <div class="choices"><button class="choice primary" onClick={() => { if (!preview) clearSave(); toTitle(preview ? 'preview' : 'title'); }}><span class="txt">{preview ? 'Back to the calibration scenes' : 'Begin another life'}</span></button></div>
        )}
      </main>
      <nav class="tabs">
        {TABS.map((t) => (
          <button key={t.id} class={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <PixelIcon name={t.id} on={tab === t.id} />
            {t.label}
            {t.id === 'now' && tab !== 'now' && busy && <span class="dot" />}
          </button>
        ))}
      </nav>
      {menu && <Menu content={content} state={state} onClose={() => setMenu(false)} onLoad={(s) => { setPreview(null); setState(s); setMenu(false); }} onQuit={() => { setMenu(false); toTitle(preview ? 'preview' : 'title'); }} />}
    </div>
  );
}
