// Trade (docs/FRAME-TRADE-ALLIES.md §Step 2): goods bought where they are made and sold where they are wanted.
// Prices move with what he buys and sells, and recover; one good a year is in the news. His own venture:
// his silver in, his silver out.
import { earn } from './hardship';
import type { ContentBundle } from '../content/schema';
import type { GameState } from './state';
import type { RngCursor } from './rng';
import { dateOf } from './calendar';
import { journal } from './journal';
import { formatSilver } from './format';
import { tierAt } from './standing';
import { addDeed } from './fame';
import { hold } from './fleet';

export const TRADE = {
  cheap: 0.75,
  dear: 1.35,
  /** Each lot bought raises the price there by this much; each lot sold lowers it. */
  step: 0.02,
  /** Days for the push a trader gives a price to halve. */
  halfLife: 120,
  newsDear: 1.5,
  newsCheap: 0.65,
  /** The spread, narrowed by his trade skill. */
  buyMarkup: 1.05,
  sellMarkdown: 0.95,
  perSkill: 0.01,
  /** What a man at another's oar can stow in his sea-chest. */
  seaChest: 60,
  /** A year's profit that is a deed. */
  deedProfit: 240,
} as const;
export const TOLL: Record<string, number> = { home: 0, allied: 0, friendly: 0.05, wary: 0.1 };

export interface CargoLot { lots: number; cost: number }

export function tradesHere(state: GameState, content: ContentBundle, at = state.at): boolean {
  if (!at || state.voyage) return false;
  const p = content.places[at];
  if (!p?.trade) return false;
  if (p.kind === 'home') return true;
  const t = tierAt(state, content, at);
  return t !== 'hostile' && t !== 'unfriendly';
}

function toll(state: GameState, content: ContentBundle, at: string): number {
  if (content.places[at]?.kind === 'home') return 0;
  return TOLL[tierAt(state, content, at)] ?? 0.1;
}

/** The push his own buying and selling has given a price here, faded with time. */
function push(state: GameState, at: string, good: string): number {
  const s = state.places[at]?.supply?.[good];
  if (!s) return 0;
  return s.n * Math.pow(0.5, (state.day - s.day) / TRADE.halfLife);
}

/** The middle price of a lot here, before the spread. */
export function priceAt(state: GameState, content: ContentBundle, at: string, good: string): number {
  const g = content.goods[good]!;
  const t = content.places[at]?.trade;
  const local = t?.cheap.includes(good) ? TRADE.cheap : t?.dear.includes(good) ? TRADE.dear : 1;
  const news = state.tradeNews && state.tradeNews.good === good && state.tradeNews.year === dateOf(state.day).year ? state.tradeNews.mult : 1;
  return g.price * local * news * Math.pow(1 + TRADE.step, push(state, at, good));
}

export function buyPrice(state: GameState, content: ContentBundle, at: string, good: string): number {
  return Math.max(1, Math.round(priceAt(state, content, at, good) * (TRADE.buyMarkup - TRADE.perSkill * state.hero.skills.trade)));
}

export function sellPrice(state: GameState, content: ContentBundle, at: string, good: string): number {
  const spread = Math.min(1, TRADE.sellMarkdown + TRADE.perSkill * state.hero.skills.trade);
  return Math.max(1, Math.round(priceAt(state, content, at, good) * spread * (1 - toll(state, content, at))));
}

export function cargoBulk(state: GameState, content: ContentBundle): number {
  return Object.entries(state.cargo ?? {}).reduce((n, [g, c]) => n + c.lots * (content.goods[g]?.bulk ?? 0), 0);
}

export function cargoLots(state: GameState): number {
  return Object.values(state.cargo ?? {}).reduce((n, c) => n + c.lots, 0);
}

/** Room for goods: the holds less plunder and goods aboard; a sea-chest at another man's oar. */
export function goodsRoom(state: GameState, content: ContentBundle): number {
  const cap = state.service ? TRADE.seaChest : hold(state, content) - state.loot;
  return Math.max(0, cap - cargoBulk(state, content));
}

function nudge(state: GameState, at: string, good: string, d: number): void {
  const ps = state.places[at];
  if (!ps) return;
  ps.supply ??= {};
  ps.supply[good] = { n: push(state, at, good) + d, day: state.day };
}

export function canBuy(state: GameState, content: ContentBundle, at: string, good: string): string | null {
  if (buyPrice(state, content, at, good) > state.silver) return 'You have not the silver.';
  if ((content.goods[good]?.bulk ?? 0) > goodsRoom(state, content)) return state.service ? 'Your sea-chest is full.' : 'The holds are full.';
  return null;
}

export function buyLot(state: GameState, content: ContentBundle, at: string, good: string): string {
  const price = buyPrice(state, content, at, good);
  state.silver -= price;
  state.cargo ??= {};
  const c = (state.cargo[good] ??= { lots: 0, cost: 0 });
  c.lots += 1;
  c.cost += price;
  nudge(state, at, good, 1);
  return `You buy ${content.goods[good]!.lot} for ${formatSilver(price)}.`;
}

export function sellLot(state: GameState, content: ContentBundle, at: string, good: string): string {
  const c = state.cargo?.[good];
  if (!c || c.lots <= 0) return '';
  const price = sellPrice(state, content, at, good);
  const basis = c.cost / c.lots;
  c.lots -= 1;
  c.cost -= basis;
  if (c.lots <= 0) delete state.cargo![good];
  state.silver += price;
  nudge(state, at, good, -1);
  const year = dateOf(state.day).year;
  if (state.tradeYear?.year !== year) state.tradeYear = { year, profit: 0, deed: false };
  state.tradeYear.profit += price - basis;
  earn(state, price - basis);
  const lines = [`You sell ${content.goods[good]!.lot} for ${formatSilver(price)}${price > basis ? `, ${formatSilver(price - basis)} more than it cost you` : price < basis ? `, ${formatSilver(basis - price)} less than it cost you` : ''}.`];
  if (!state.tradeYear.deed && state.tradeYear.profit >= TRADE.deedProfit) {
    state.tradeYear.deed = true;
    addDeed(state, content, { type: 'deed', text: 'Made a rich trading voyage', weight: 3, witnesses: 30 });
    journal(state, `Five pounds' profit in trade this year.`);
    lines.push('Five pounds of silver clear profit this year, and the merchants on the beach have started greeting you by name.');
  }
  return lines.join(' ');
}

/** The year's news: one good dear or cheap everywhere. */
export function rollTradeNews(state: GameState, content: ContentBundle, rng: RngCursor): void {
  const goods = Object.keys(content.goods);
  if (!goods.length) return;
  const good = goods[rng.int(goods.length)]!;
  state.tradeNews = { good, mult: rng.float() < 0.5 ? TRADE.newsDear : TRADE.newsCheap, year: dateOf(state.day).year };
}

export function tradeNewsLine(state: GameState, content: ContentBundle): string | null {
  const n = state.tradeNews;
  if (!n || n.year !== dateOf(state.day).year) return null;
  const g = content.goods[n.good]!;
  return n.mult > 1
    ? `They say ${g.name.toLowerCase()} is dear everywhere this year: a bad season for it somewhere, and every market short.`
    : `They say ${g.name.toLowerCase()} is cheap everywhere this year: too much of it, and nobody buying.`;
}
