import { useEffect, useState } from 'preact/hooks';
import type { ContentBundle } from '../content/schema';
import type { GameState } from '../engine/state';
import type { MapData } from '../engine/mapgrid';
import { act, newGame, screenOf, type Action } from '../engine/index';
import { toSave, fromSave } from '../engine/save';
import { encodeSaveCode, decodeSaveCode } from '../engine/savecode';
import { formatDate } from '../engine/calendar';
import { formatSilver } from '../engine/format';
import { livingFame, untoldCount } from '../engine/fame';
import { saveGame, loadGame, clearSave } from './storage';
import { NowView } from './components/NowView';
import { MapView } from './components/MapView';
import { HeroPanel, CrewPanel, SagaPanel } from './components/Panels';

type Tab = 'now' | 'map' | 'hero' | 'crew' | 'saga';
const NAMES = ['Hrafn', 'Asbjorn', 'Ketil', 'Orm', 'Thorir', 'Ulfar', 'Eyvind', 'Halldor', 'Arni', 'Bjorn'];

function Title({ content, hasSave, onContinue, onNew }: { content: ContentBundle; hasSave: boolean; onContinue: () => void; onNew: (bg: string, name: string) => void }) {
  const [step, setStep] = useState<'title' | 'new'>('title');
  const [bg, setBg] = useState('younger_son');
  const [name, setName] = useState(NAMES[Math.floor(Math.random() * NAMES.length)]!);
  if (step === 'title') {
    return (
      <div class="title">
        <h1>VIKINGR</h1>
        <div class="sub">From nothing, to sea king, to Valhalla.</div>
        <div class="choices">
          {hasSave && <button class="choice primary" onClick={onContinue}>Continue your life</button>}
          <button class="choice" onClick={() => setStep('new')}>Begin a new life</button>
        </div>
        <p class="note">This game is brutal in the way the 9th century was: killing, slavery and death are part of it, never glorified. Phase 1 build: the engine and placeholder text.</p>
      </div>
    );
  }
  return (
    <main>
      <h1>Spring, 830</h1>
      <p>You are sixteen. You grew up on the stories: the ships that came home low in the water with silver, the old men at the hearth with one hand and an arm-ring. Who are you?</p>
      <h3>Name</h3>
      <input type="text" value={name} maxLength={20} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
      <h3 style={{ marginTop: 18 }}>Born as</h3>
      <div class="bgs">
        {Object.values(content.backgrounds).map((b) => (
          <button key={b.id} class={`choice bg${bg === b.id ? ' on' : ''}`} onClick={() => setBg(b.id)}>
            {b.label}
            <span class="hint">{b.desc}</span>
          </button>
        ))}
      </div>
      <div class="choices">
        <button class="choice primary" onClick={() => onNew(bg, name)}>Begin</button>
        <button class="choice" onClick={() => setStep('title')}>Back</button>
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
          <button class="choice" onClick={async () => { const c = await encodeSaveCode(toSave(state, content)); setCode(c); try { await navigator.clipboard.writeText(c); setMsg('Copied. Keep it somewhere safe.'); } catch { setMsg('Copy the text below.'); } }}>Save as text</button>
          <button class="choice" onClick={async () => {
            try { const s = fromSave(await decodeSaveCode(code), content); onLoad(s.state); setMsg(s.warnings.join(' ') || 'Loaded.'); }
            catch (e) { setMsg((e as Error).message); }
          }}>Load from the text below</button>
          <textarea value={code} placeholder="Paste a saved life here (it starts VIKR1.)" onInput={(e) => setCode((e.target as HTMLTextAreaElement).value)} />
          {msg && <p class="small sans">{msg}</p>}
          <button class="choice" onClick={onQuit}>Back to the title</button>
          <button class="choice primary" onClick={onClose}>Close</button>
        </div>
        {debug && <pre class="small sans" style={{ whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>seed {state.seed}{'\n'}{JSON.stringify({ ...state, journal: undefined, deeds: state.deeds.length }, null, 1)}</pre>}
      </div>
    </div>
  );
}

export function App({ content, map }: { content: ContentBundle; map: MapData }) {
  const [state, setState] = useState<GameState | null>(null);
  const [hasSave, setHasSave] = useState(() => !!loadGame(content));
  const [tab, setTab] = useState<Tab>('now');
  const [menu, setMenu] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (state) saveGame(state, content); }, [state]);
  useEffect(() => { window.scrollTo(0, 0); }, [state?.pending, tab]);

  if (!state) {
    return (
      <div class="app">
        <Title
          content={content}
          hasSave={hasSave}
          onContinue={() => { const l = loadGame(content); if (l) setState(l.state); }}
          onNew={(bg, name) => { setState(newGame(content, { background: bg, seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, name })); setTab('now'); }}
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
  const busy = screenOf(state) !== 'place' && screenOf(state) !== 'hall' && screenOf(state) !== 'muster' && screenOf(state) !== 'return';
  const untold = untoldCount(state);
  const where = state.at ? content.places[state.at]?.name : state.voyage ? `At sea, bound for ${content.places[state.voyage.to]?.name}` : '';

  return (
    <div class="app">
      <div class="topbar">
        <span class="where">{where}</span>
        <button class="iconbtn" onClick={() => setMenu(true)}>Menu</button>
        <span class="stats">
          <span class="stat"><b>{formatDate(state.day)}</b></span>
          <span class="stat">Silver <b>{formatSilver(state.silver)}</b></span>
          <span class="stat">Men <b>{state.crew.men}</b></span>
          <span class="stat">Fame <b>{Math.round(livingFame(state))}</b>{untold ? ` (${untold} untold)` : ''}</span>
        </span>
      </div>
      <main>
        {error && <p class="card small sans">{error}</p>}
        {tab === 'now' && <NowView content={content} map={map} state={state} onAct={onAct} />}
        {tab === 'map' && <><h2>The known world</h2><MapView content={content} map={map} state={state} /></>}
        {tab === 'hero' && <HeroPanel content={content} state={state} />}
        {tab === 'crew' && <CrewPanel content={content} state={state} onAct={onAct} />}
        {tab === 'saga' && <SagaPanel content={content} state={state} />}
        {state.death && tab === 'now' && (
          <div class="choices"><button class="choice primary" onClick={() => { clearSave(); setHasSave(false); setState(null); }}>Begin another life</button></div>
        )}
      </main>
      <nav class="tabs">
        {(['now', 'map', 'hero', 'crew', 'saga'] as Tab[]).map((t) => (
          <button key={t} class={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'now' ? 'Now' : t === 'map' ? 'Map' : t === 'hero' ? 'Hero' : t === 'crew' ? 'Crew' : 'Saga'}
            {t === 'now' && tab !== 'now' && busy && <span class="dot" />}
          </button>
        ))}
      </nav>
      {menu && <Menu content={content} state={state} onClose={() => setMenu(false)} onLoad={(s) => { setState(s); setMenu(false); }} onQuit={() => { setMenu(false); setHasSave(true); setState(null); }} />}
    </div>
  );
}
