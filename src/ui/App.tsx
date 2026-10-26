import { useEffect, useState } from 'preact/hooks';
import { pastChronicle } from '../engine/chronicle';
import type { Attr, ContentBundle } from '../content/schema';
import type { GameState } from '../engine/state';
import type { MapData } from '../engine/mapgrid';
import { act, newGame, screenOf, type Action } from '../engine/index';
import { toSave, fromSave } from '../engine/save';
import { encodeSaveCode, decodeSaveCode } from '../engine/savecode';
import { dateOf, dayOf, MONTHS } from '../engine/calendar';
import { formatSilverShort } from '../engine/format';
import { livingFame, untoldCount } from '../engine/fame';
import { saveGame, loadGame, clearSave } from './storage';
import { NowView } from './components/NowView';
import { MapView } from './components/MapView';
import { HeroPanel, CrewPanel, SagaPanel, HomePanel } from './components/Panels';
import { Knot, PixelIcon } from './components/Ornament';
import { Makeup } from './components/Makeup';
import { SceneArt } from './scene/SceneArt';

type Tab = 'now' | 'map' | 'hero' | 'crew' | 'home' | 'saga';
const TABS: { id: Tab; label: string }[] = [
  { id: 'now', label: 'Now' }, { id: 'map', label: 'Map' }, { id: 'hero', label: 'Hero' }, { id: 'crew', label: 'Crew' }, { id: 'home', label: 'Home' }, { id: 'saga', label: 'Saga' },
];
const NAMES = ['Hrafn', 'Asbjorn', 'Ketil', 'Orm', 'Thorir', 'Ulfar', 'Eyvind', 'Halldor', 'Arni', 'Bjorn'];

/** Playtest jumps into the year 830: where and when each chapter opens, and what has to be true first. Never saved. */
const CHAPTERS: { scene: string; label: string; year: number; doy: number; at: string; phase: GameState['phase']; setup?: (s: GameState) => void }[] = [
  { scene: 'i_approach', label: 'Iona', year: 830, doy: 158, at: 'iona', phase: 'sailing', setup: (s) => { s.flags.o_iona = 1; if (s.service) s.service.route = ['bangor']; } },
  { scene: 'b_lough', label: 'Bangor', year: 830, doy: 170, at: 'bangor', phase: 'sailing', setup: (s) => { s.flags.o_iona = 1; s.loot = 400; if (s.service) s.service.route = []; } },
  { scene: 'y_feast', label: 'Yule', year: 830, doy: 358, at: 'home_fjord', phase: 'winter', setup: (s) => { s.flags.o_iona = 1; s.flags.bg_left = 1; s.flags._winter = 830; s.hallLeft = 3; } },
  { scene: 'y_holm_eve', label: 'The Yule holmgang', year: 830, doy: 359, at: 'home_fjord', phase: 'winter', setup: (s) => { s.flags.o_iona = 1; s.flags.bg_left = 1; s.flags._winter = 830; s.hallLeft = 3; } },
  { scene: 'j_council', label: 'Spring 831, as captain of the Raven', year: 831, doy: 60, at: 'home_fjord', phase: 'muster', setup: captain },
  { scene: 'c_approach', label: 'Conaille, 831, as captain', year: 831, doy: 170, at: 'conaille', phase: 'sailing', setup: captain },
  { scene: 'l_approach', label: 'Lindisfarne, 831, as captain', year: 831, doy: 165, at: 'lindisfarne', phase: 'sailing', setup: captain },
  // the world without him (docs/FRAME-WORLD.md): a seasoned captain with a name
  { scene: 'cw_839', label: 'The fleet on Lough Neagh, 839', year: 839, doy: 160, at: 'conaille', phase: 'sailing', setup: veteran },
  { scene: 'lg_ragnar', label: 'Ragnarr on a Frisian beach, 842', year: 842, doy: 150, at: 'walcheren', phase: 'sailing', setup: veteran },
  { scene: 'lo_call_harek', label: "Harek's call, as his sworn man, 840", year: 840, doy: 120, at: 'orkney', phase: 'sailing', setup: (s) => { veteran(s); s.lords = { harek: { fav: 5, met: true } }; s.oath = { lord: 'harek', since: s.day - 400 }; s.flags.call_harek = 1; } },
  { scene: 'ru_orkney', label: 'The high seat at Birsay, after Harek, 846', year: 846, doy: 150, at: 'orkney', phase: 'sailing', setup: (s) => { veteran(s); s.lords = { harek: { fav: 6, met: true } }; s.flags.wife_ingibjorg = 1; s.base.wife = 'Ingibjörg'; } },
];

/** A captain of some years: two ships, sixty men, a name told in every port, and silver. */
function veteran(s: GameState): void {
  captain(s);
  s.crew.men = 60;
  s.silver = 600;
  s.ships.push({ id: 'second', type: 'karvi', name: 'Sea-Wolf', hull: 90 });
  for (let i = 0; i < 12; i++) s.deeds.push({ n: i + 1, type: 'deed', day: s.day, place: null, text: 'A deed of the years between', weight: 12, witnesses: 100, told: s.day, verse: false });
  for (const p of ['dublin', 'orkney', 'walcheren', 'dorestad', 'hedeby', 'armagh', 'linn_duachaill']) if (!s.known.includes(p)) s.known.push(p);
}

/** A chapter in 831 as if he had taken the Raven at Bangor: his own ship, the bench-mates sworn, a name. */
function captain(s: GameState): void {
  s.service = null;
  s.flags.bg_command = 1;
  s.flags.owes_jarl = 1;
  s.flags.bg_left = 1;
  s.flags._winter = 830;
  s.seen.sp_831 = s.day;
  s.hero.nickname = 'Raven';
  s.crew.men = 30;
  s.provisions = 900;
  for (const m of s.men) m.sworn = true;
  for (const p of ['iona', 'bangor', 'kaupang', 'lindisfarne', 'skye', 'conaille']) if (!s.known.includes(p)) s.known.push(p);
}

function shortDate(day: number): string {
  const d = dateOf(day);
  return `${d.dom} ${MONTHS[d.month]!.slice(0, 3)} ${d.year}`;
}

function Title({ content, hasSave, start, onContinue, onNew, onPreview, onLoad }: { content: ContentBundle; hasSave: boolean; start: 'title' | 'preview'; onContinue: () => void; onLoad: (s: GameState) => void; onNew: (bg: string, name: string, attrs: Record<Attr, number>, set: string, era: 830 | 843) => void; onPreview: (scene: string, name: string) => void }) {
  const [step, setStep] = useState<'title' | 'new' | 'make' | 'preview' | 'load'>(start);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [bg, setBg] = useState('younger_son');
  const [era, setEra] = useState<830 | 843>(830);
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
          <button class="choice" onClick={() => setStep('load')}><span class="txt">Load a saved life<span class="hint">Paste a save code (it starts VIKR1.)</span></span></button>
          <button class="choice" onClick={() => setStep('preview')}><span class="txt">Play from a chapter<span class="hint">For playtesting: jump into a chapter part-way through. Not saved.</span></span></button>
        </div>
        <p class="note">This game is brutal in the way the 9th century was. Killing, slavery and death are part of it, never glorified.</p>
      </div>
    );
  }
  if (step === 'load') {
    // playtest 9: "no way to load games from save text" — the menu had it, but only once a life was under way
    return (
      <main class="screen">
        <h1>Load a saved life</h1>
        <p>Paste the text you saved from the menu (Save as text). It starts VIKR1.</p>
        <textarea id="title-save-code" value={code} placeholder="VIKR1.…" onInput={(e) => setCode((e.target as HTMLTextAreaElement).value)} style={{ width: '100%', minHeight: 160 }} />
        {msg && <p class="small sans">{msg}</p>}
        <div class="choices">
          <button class="choice primary" onClick={async () => {
            try { const s = fromSave(await decodeSaveCode(code), content); if (s.warnings.length) setMsg(s.warnings.join(' ')); onLoad(s.state); }
            catch (e) { setMsg((e as Error).message || 'That is not a save code.'); }
          }}><span class="txt">Load</span></button>
          <button class="choice" onClick={() => { setMsg(''); setStep('title'); }}><span class="txt">Back</span></button>
        </div>
      </main>
    );
  }
  if (step === 'preview') {
    return (
      <main class="screen">
        <h1>Chapters</h1>
        <p>Jump into the story part-way through, as if everything so far had gone quietly. The 831 chapters start you as captain of the Raven. Nothing you do here is saved.</p>
        <h3>His name</h3>
        <input type="text" id="cal-name" value={name} maxLength={20} onInput={(e) => setName((e.target as HTMLInputElement).value)} />
        <div class="choices">
          {CHAPTERS.map((c) => (
            <button key={c.scene} class="choice" onClick={() => onPreview(c.scene, name)}><span class="txt">{c.label}<span class="hint">{content.scenes[c.scene]?.title}</span></span></button>
          ))}
          <button class="choice" onClick={() => setStep('title')}><span class="txt">Back</span></button>
        </div>
      </main>
    );
  }
  if (step === 'make') {
    const b = content.backgrounds[bg]!;
    return <Makeup key={bg} title={b.label} intro={`${name.trim() || 'Hrafn'} ${b.patronymic}. Spread what you were born with, and choose how you were raised. Left as it is, it is the ${b.label.replace(/^The /, '')} as he has always begun.`} start={b.attrs} sets={b.skill_sets} begin="Begin" onBegin={(a, set) => onNew(bg, name, a, set, era)} onBack={() => setStep('new')} />;
  }
  return (
    <main class="screen">
      <h1>Spring, {era}</h1>
      <p>You are sixteen. {era === 830 ? 'You grew up on the stories: ships that came home low in the water, old men at the hearth with one hand and an arm-ring.' : 'You grew up on the news: Dorestad stripped, the ship-forts in Ireland, Rouen burned on the Seine.'} Who are you?</p>
      <h3>Your days</h3>
      <div class="bgs">
        <button class={`choice bg${era === 830 ? ' on' : ''}`} onClick={() => setEra(830)}><span class="txt">Horik's days, 830<span class="hint">The first great raids. The written story from your boyhood: Orkney, Iona, Bangor, Dorestad.</span></span></button>
        <button class={`choice bg${era === 843 ? ' on' : ''}`} onClick={() => setEra(843)}><span class="txt">Ragnarr's days, 843<span class="hint">The world has moved on: the Norse winter in Ireland and on the Loire. The Vestfold fleet for Nantes, Hastein on Noirmoutier, Paris in 845.</span></span></button>
      </div>
      <h3 style={{ marginTop: 18 }}>Name</h3>
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
        <button class="choice primary" onClick={() => setStep('make')}><span class="txt">Next<span class="hint">What you were born with, and how you were raised</span></span></button>
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

  // chapter jumps never overwrite a real save
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
          onLoad={(s) => { setPreview(null); setState(s); setTab('now'); }}
          onNew={(bg, name, attrs, skillSet, era) => { setPreview(null); setState(newGame(content, { background: bg, seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, name, attrs, skillSet, era })); setTab('now'); }}
          onPreview={(scene, name) => {
            const c = CHAPTERS.find((x) => x.scene === scene)!;
            const s = newGame(content, { background: 'younger_son', seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, name });
            s.day = dayOf(c.year, c.doy);
            s.at = c.at;
            s.phase = c.phase;
            if (!s.known.includes(c.at)) s.known.push(c.at);
            c.setup?.(s);
            // the world's past up to the jump is past: no backlog of news (docs/FRAME-WORLD.md §B)
            s.chron = pastChronicle(s, content);
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

  return (
    <div class="app">
      <header class="topbar">
        <span class="where">{where}</span>
        <span class="stat">{shortDate(state.day)}</span>
        <span class="stat silver">{formatSilverShort(state.silver)}</span>
        <span class="stat">Fame {Math.round(livingFame(state))}{untold ? <span class="untold"> +{untold}</span> : ''}</span>
        <button class="iconbtn" aria-label="Menu" onClick={() => setMenu(true)}><i /><i /><i /></button>
      </header>
      <main>
        {error && <p class="card small sans">{error}</p>}
        {preview && <p class="note small sans">Playtest chapter: not saved.</p>}
        {(
          <>
            {tab === 'now' && <NowView content={content} map={map} state={state} onAct={onAct} />}
            {tab === 'map' && <div class="screen"><h2>The known world</h2><MapView content={content} map={map} state={state} onAct={onAct} /></div>}
            {tab === 'hero' && <div class="screen"><HeroPanel content={content} state={state} onAct={onAct} /></div>}
            {tab === 'crew' && <div class="screen"><CrewPanel content={content} state={state} onAct={onAct} /></div>}
            {tab === 'home' && <div class="screen"><HomePanel content={content} state={state} onAct={onAct} /></div>}
            {tab === 'saga' && <div class="screen"><SagaPanel content={content} state={state} /></div>}
          </>
        )}
        {state.death && tab === 'now' && (
          <div class="choices"><button class="choice primary" onClick={() => { if (!preview) clearSave(); toTitle(preview ? 'preview' : 'title'); }}><span class="txt">{preview ? 'Back to the chapters' : 'Begin another life'}</span></button></div>
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
