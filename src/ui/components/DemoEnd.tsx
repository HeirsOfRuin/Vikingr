// The end of the free demo (src/ui/demo.ts): what the two years made of him, and the save code that
// carries the life into the full game. Nothing is lost: the life stays saved in this browser too.
import { useState } from 'preact/hooks';
import type { ContentBundle } from '../../content/schema';
import type { GameState } from '../../engine/state';
import { toSave } from '../../engine/save';
import { encodeSaveCode } from '../../engine/savecode';
import { livingFame } from '../../engine/fame';
import { formatSilverShort } from '../../engine/format';
import { FULL_GAME_URL } from '../demo';
import { reckoning } from '../../engine/saga';
import { RateAsk } from './RateAsk';

export function DemoEnd({ content, state, onTitle }: { content: ContentBundle; state: GameState; onTitle: () => void }) {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const copy = async (plain: boolean) => {
    const c = await encodeSaveCode(toSave(state, content), plain ? { plain: true } : undefined);
    setCode(c);
    try { await navigator.clipboard.writeText(c); setMsg(`Copied: ${c.length} characters. Keep it somewhere safe.`); } catch { setMsg('Copy the text below.'); }
  };
  const name = state.hero.name;
  const ships = state.ships.length;
  return (
    <main class="screen">
      <h1>Spring, 832</h1>
      <p>The ice is off the fjord and the war-arrow is going round the farms. Men are asking whose ship they will row in this summer, and some of them are asking for {name}.</p>
      <p>This is where the demo ends. Your life goes on in the full game: the third summer and every one after it, to the Frankish rivers, the Irish ship-forts, the Great Army in England, land of your own, and a son to carry the saga on. The full game also opens in 843 and 865.</p>
      {/* what men say of him so far, as the death page tells a whole life (saga.ts reckoning; Josh, 2026-11-21: "it ends
          with the rate me page (like in the full build) and the save exporter") */}
      <h3>What men say of you</h3>
      {reckoning(state, content).map((l, i) => <p key={i} class="small">{l}</p>)}
      <RateAsk at="demo-end" />
      <div class="card sans small">
        <dl class="kv">
          <dt>Fame</dt><dd>{Math.round(livingFame(state))}</dd>
          <dt>Silver</dt><dd>{formatSilverShort(state.silver)}</dd>
          <dt>Ships</dt><dd>{ships ? `${ships}` : 'none of your own yet'}</dd>
          <dt>Deeds</dt><dd>{state.deeds.length}</dd>
        </dl>
      </div>
      <h3>Take your life with you</h3>
      <p class="small sans">Copy your save code, then open the full game and choose <b>Load a saved life</b>. You go on from this same morning.</p>
      <div class="choices">
        <button class="choice primary" onClick={() => copy(false)}><span class="txt">Copy my save code</span></button>
        <button class="choice" onClick={() => copy(true)}><span class="txt">Copy it in plain letters (longer)</span></button>
        {code && <textarea id="save-code" readOnly value={code} />}
        {msg && <p class="small sans">{msg}</p>}
        <a class="choice" href={FULL_GAME_URL} target="_blank" rel="noopener"><span class="txt">Get the full game<span class="hint">The years after 831, and the starts in 843 and 865</span></span></a>
        <button class="choice" onClick={onTitle}><span class="txt">Back to the title</span></button>
      </div>
      <p class="muted small sans">Your life is also still saved in this browser.</p>
    </main>
  );
}
