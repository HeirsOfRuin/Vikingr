// What trade pays (docs/FRAME-TRADE-ALLIES.md): greedy round trips between two markets, buying while the
// price is under what it fetches at the other end, selling while it fetches more than it cost.
import { loadContent } from './content-loader';
import { newGame } from '../src/engine/index';
import type { GameState } from '../src/engine/state';
import { buyLot, buyPrice, canBuy, sellLot, sellPrice } from '../src/engine/trade';
import { formatSilver } from '../src/engine/format';
import { dayOf } from '../src/engine/calendar';

const content = loadContent();
const MARGIN = 1.15; // buy while the far market pays at least this much more

function trader(skill: number, ship: string, silver: number): GameState {
  const s = newGame(content, { background: 'freedman', seed: 1, name: 'T' });
  s.pending = null;
  s.service = null;
  s.ships = [{ id: 'a', type: ship, name: 'Trader', hull: 100 }];
  s.silver = silver;
  s.loot = 0;
  s.hero.skills.trade = skill;
  s.day = dayOf(833, 150);
  for (const id of Object.keys(content.places)) s.places[id] ??= { wealth: 0, defence: 1, raided: 0, lastRaided: null };
  for (const id of ['hedeby', 'ribe', 'birka', 'kaupang', 'faroes']) s.places[id]!.standing = 3; // friendly
  return s;
}

function leg(s: GameState, from: string, to: string): void {
  // sell everything worth selling here
  for (const g of Object.keys(s.cargo ?? {})) {
    while (s.cargo?.[g] && sellPrice(s, content, from, g) >= (s.cargo[g]!.cost / s.cargo[g]!.lots) * 0.9) sellLot(s, content, from, g);
  }
  // buy what the next market pays well for
  const goods = content.places[from]!.trade!.cheap.filter((g) => content.places[to]!.trade?.dear.includes(g));
  let bought = true;
  while (bought) {
    bought = false;
    for (const g of goods) {
      if (!canBuy(s, content, from, g) && buyPrice(s, content, from, g) * MARGIN < sellPrice(s, content, to, g)) { buyLot(s, content, from, g); bought = true; }
    }
  }
  s.day += 6;
}

for (const [ship, skill, purse] of [['karvi', 1, 300], ['karvi', 4, 600], ['knarr', 4, 1200], ['knarr', 7, 2400]] as const) {
  for (const [a, b] of [['home_fjord', 'hedeby'], ['kaupang', 'hedeby'], ['faroes', 'hedeby'], ['birka', 'ribe']] as const) {
    const s = trader(skill, ship, purse);
    const start = s.silver;
    for (let i = 0; i < 4; i++) { leg(s, a, b); leg(s, b, a); }
    leg(s, a, b); // sell the last load
    const profit = s.silver - start;
    console.log(`${ship.padEnd(6)} trade ${skill} purse ${formatSilver(purse).padEnd(22)} ${a} <-> ${b}: 4 round trips, profit ${formatSilver(profit)} (${(profit / 4 / 24).toFixed(1)} marks a trip)`);
  }
}
