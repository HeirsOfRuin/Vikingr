// How to play, and About (the release audit, 2026-11-13: nothing explained the top bar, and no credits, version or
// licences were shown anywhere). Numbers come from the engine's own constants, so the words cannot drift from the rules.
import { COINS_PER_POUND, MUSTER_DOY, SEA_CLOSED_FROM_DOY } from '../../engine/tuning';
import { dateOf, dayOf, MONTHS } from '../../engine/calendar';
import { storageWorks } from '../storage';

const onDay = (doy: number) => { const d = dateOf(dayOf(830, doy)); return `${d.dom} ${MONTHS[d.month]}`; };

export function HowToPlay({ onBack }: { onBack: () => void }) {
  return (
    <main class="screen">
      <h1>How to play</h1>
      <p>One life, from sixteen to whatever end it comes to. You make the choices; the year turns.</p>
      <h3>The tabs</h3>
      <dl class="kv">
        <dt>Now</dt><dd>What is happening, and what you can do about it. Every choice says what it costs, and how good your chances are: risky, even or favourable.</dd>
        <dt>Map</dt><dd>The world you know. Tap a place. Sailing takes days, and the crew eats every day of it.</dd>
        <dt>Hero</dt><dd>You: your body, your skills, your gear. They grow by being used.</dd>
        <dt>Crew</dt><dd>Your ships, your men, and the men sworn to you. Their loyalty is worth more than their number.</dd>
        <dt>Home</dt><dd>Your farm or hall, your family, and the winter.</dd>
        <dt>Saga</dt><dd>What men say of you; the great names of your century; your lords and your land.</dd>
      </dl>
      <h3>The top bar</h3>
      <p>Where you are, the date, your silver, and your fame. Silver is reckoned by weight: a pound is {COINS_PER_POUND} coins ("lb" and "c"). Fame +N means deeds not yet told: they count when they are told at a feast or round the winter fires.</p>
      <h3>The year</h3>
      <p>Spring comes on {onDay(MUSTER_DOY)}, when the men come to the muster. Sail, raid, trade, fight and find out through the summer; be somewhere with a roof by {onDay(SEA_CLOSED_FROM_DOY)}, when the sea closes until spring. Winter is for the hall: feasts, building, your family, and what the year cost you.</p>
      <h3>Dying</h3>
      <p>You can die: in a fight, at sea, in your bed. Some deaths are better told than others. If you leave a son, the saga can go on as his (the years pass until he is grown): the same world, what is left of the farm, his father's name and his father's feuds. If not, the saga is what is left.</p>
      <h3>Saves</h3>
      <p>{storageWorks() ? 'The game saves itself after every choice, in this browser on this device.' : 'This browser is not keeping anything here: when you close the page, the life is gone, unless you save it as text.'} To keep a life safe, or move it to another device, use Menu, Save as text, and keep the code somewhere. Load it from the title screen.</p>
      <div class="choices"><button class="choice primary" onClick={onBack}><span class="txt">Back</span></button></div>
    </main>
  );
}

export function About({ onBack }: { onBack: () => void }) {
  return (
    <main class="screen">
      <h1>Vikingr</h1>
      <p class="small sans muted">Version {__VERSION__}</p>
      <p>A life in the Viking age, 830 to 878, told from the annals: the Irish, Frankish and English chronicles of the raids, and the sagas written down later about the men who made them.</p>
      <h3>Privacy</h3>
      <p>No account, no ads, no analytics. Nothing leaves this page. Your life is kept in this browser only.</p>
      <h3>Credits</h3>
      <dl class="kv">
        <dt>Fonts</dt><dd>Alegreya, Alegreya Sans and Alegreya SC by Juan Pablo del Peral, Huerta Tipográfica; Noto Sans Runic by Google. All under the SIL Open Font License 1.1 (the licence is in the download, in LICENSES).</dd>
        <dt>Map</dt><dd>Coastlines and rivers from Natural Earth, public domain.</dd>
        <dt>Pictures</dt><dd>Made for this game: generated source images, cropped and redrawn in the game's own fixed palette.</dd>
        <dt>Sources</dt><dd>The Annals of Ulster, the Annals of St-Bertin, the Anglo-Saxon Chronicle, the Cogad Gáedel re Gallaib, and the Icelandic sagas and Landnámabók, among others; dates and places follow them where they agree.</dd>
      </dl>
      <div class="choices"><button class="choice primary" onClick={onBack}><span class="txt">Back</span></button></div>
    </main>
  );
}
