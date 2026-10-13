// Hosts (docs/FRAME-HOSTS-FRISIA.md): how often a line of wings wins, and what an absent ally or a reserve
// does to it. "Let the men handle it" for every wing.
import { loadContent } from './content-loader';
import { newGame } from '../src/engine/index';
import type { BattleState, GameState } from '../src/engine/state';
import { commitReserve, fightOutHost, hostRound, startHost, type HostWingSpec } from '../src/engine/host';
import { adaptivePolicy } from '../src/engine/battle';
import { RngCursor, seedRng } from '../src/engine/rng';

const content = loadContent();
const N = Number(process.argv[process.argv.indexOf('--n') + 1]) || 1000;

function base(seed: number, men: number): GameState {
  const s = newGame(content, { background: 'freedman', seed, name: 'H' });
  s.pending = null;
  s.service = null;
  s.crew.men = men;
  s.crew.quality = 1;
  s.crew.morale = 6;
  return s;
}

function cell(label: string, centre: number, foeCentre: number, wings: HostWingSpec[], reserve?: { us: number; them: number }, commit = false): void {
  let won = 0, lost = 0, parted = 0, crewLost = 0;
  for (let i = 0; i < N; i++) {
    const s = base(i + 1, centre);
    startHost(s, content, { title: 'Test', foe: 'frisian_levy', terrain: 'field', context: 'scene', place: null, foeMen: foeCentre, wings, reserve, role: 'host' });
    const b = (s.pending as { battle: BattleState }).battle;
    const rng = new RngCursor(seedRng(i * 7 + 3));
    if (commit) { hostRound(b, adaptivePolicy(b, 'us', rng), rng); hostRound(b, adaptivePolicy(b, 'us', rng), rng); if (!b.over) commitReserve(b); }
    fightOutHost(b, adaptivePolicy, rng);
    if (b.over === 'won') won++; else if (b.over === 'lost') lost++; else parted++;
    crewLost += b.lost;
  }
  const p = (n: number) => `${Math.round((100 * n) / N)}%`.padStart(4);
  console.log(`${label.padEnd(58)} won ${p(won)}  lost ${p(lost)}  parted ${p(parted)}  your wing loses ${(crewLost / N).toFixed(1)} men`);
}

console.log(`Hosts, ${N} battles a cell (frisian_levy, quality 1, everyone fighting on instinct)\n`);
cell('Equal hosts: 30 + 30 + 30 against 30 + 30 + 30', 30, 30, [{ name: 'Left', men: 30, foe_men: 30 }, { name: 'Right', men: 30, foe_men: 30 }]);
cell('Strong flanks: 30 + 45 + 45 against 30 + 30 + 30', 30, 30, [{ name: 'Left', men: 45, foe_men: 30 }, { name: 'Right', men: 45, foe_men: 30 }]);
cell('An ally hangs back: 30 + 0 + 30 against 30 + 30 + 30', 30, 30, [{ name: 'Left', men: 0, foe_men: 30 }, { name: 'Right', men: 30, foe_men: 30 }]);
cell('Their reserve: equal hosts, they hold back 30', 30, 30, [{ name: 'Left', men: 30, foe_men: 30 }, { name: 'Right', men: 30, foe_men: 30 }], { us: 0, them: 30 });
cell('Both reserves, ours thrown in at round 2', 30, 30, [{ name: 'Left', men: 30, foe_men: 30 }, { name: 'Right', men: 30, foe_men: 30 }], { us: 30, them: 30 }, true);
cell('Dorestad 834: 30 + Ubbi 100 + Danes 60 against 40 + 60 + 50', 30, 40, [{ name: "Ubbi's Danes", men: 100, foe_men: 60 }, { name: 'Danes', men: 60, foe_men: 50 }], { us: 0, them: 40 });
cell('Dorestad alone with a partner: 30 + 32 against 50 + 30', 30, 50, [{ name: 'Partner', men: 32, foe_men: 30 }]);
