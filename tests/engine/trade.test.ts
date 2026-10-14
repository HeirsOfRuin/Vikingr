import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions, newGame } from '../../src/engine/index';
import type { GameState } from '../../src/engine/state';
import { buyLot, buyPrice, cargoBulk, goodsRoom, priceAt, sellLot, sellPrice, TRADE, tradesHere } from '../../src/engine/trade';
import { holdRoom } from '../../src/engine/fleet';
import { applyEffects } from '../../src/engine/effects';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { dayOf } from '../../src/engine/calendar';

const trader = (): GameState => {
  const s = sandboxGame(4);
  s.pending = null;
  s.service = null;
  s.day = dayOf(833, 150);
  s.phase = 'sailing';
  s.at = 'home_fjord';
  s.ships = [{ id: 'a', type: 'karvi', name: 'Gull', hull: 100 }];
  s.silver = 2000;
  s.loot = 0;
  s.hero.skills.trade = 0;
  return s;
};

describe('trade', () => {
  it('a market sells what it makes cheap and pays well for what it wants', () => {
    const s = trader();
    expect(priceAt(s, content, 'home_fjord', 'furs')).toBeCloseTo(30 * TRADE.cheap);
    expect(priceAt(s, content, 'hedeby', 'furs')).toBeCloseTo(30 * TRADE.dear);
    expect(priceAt(s, content, 'kaupang', 'grain')).toBeCloseTo(8);
  });

  it('buying pushes the price up, selling pushes it down, and the push fades', () => {
    const s = trader();
    const p0 = buyPrice(s, content, 'home_fjord', 'furs');
    for (let i = 0; i < 10; i++) buyLot(s, content, 'home_fjord', 'furs');
    expect(buyPrice(s, content, 'home_fjord', 'furs')).toBeGreaterThan(p0);
    s.day += TRADE.halfLife * 4;
    expect(Math.abs(buyPrice(s, content, 'home_fjord', 'furs') - p0)).toBeLessThanOrEqual(1);
  });

  it('trade skill narrows the spread, and a wary port takes its toll', () => {
    const s = trader();
    const raw = sellPrice(s, content, 'hedeby', 'furs');
    s.hero.skills.trade = 5;
    expect(sellPrice(s, content, 'hedeby', 'furs')).toBeGreaterThan(raw);
    s.places.hedeby!.standing = 0; // wary
    const wary = sellPrice(s, content, 'hedeby', 'furs');
    s.places.hedeby!.standing = 6; // allied
    expect(sellPrice(s, content, 'hedeby', 'furs')).toBeGreaterThan(wary);
  });

  it('goods and plunder share the holds', () => {
    const s = trader();
    const room = holdRoom(s, content);
    buyLot(s, content, 'home_fjord', 'soapstone');
    expect(cargoBulk(s, content)).toBe(content.goods.soapstone!.bulk);
    expect(holdRoom(s, content)).toBe(room - content.goods.soapstone!.bulk);
    s.loot = 1500;
    expect(goodsRoom(s, content)).toBe(0);
  });

  it('selling at a profit counts toward the year, and ten marks of it is a deed', () => {
    const s = trader();
    for (let i = 0; i < 10; i++) buyLot(s, content, 'home_fjord', 'furs');
    s.at = 'hedeby';
    s.places.hedeby!.standing = 6;
    const deeds = s.deeds.length;
    for (let i = 0; i < 10; i++) sellLot(s, content, 'hedeby', 'furs');
    expect(s.tradeYear!.profit).toBeGreaterThan(0);
    if (s.tradeYear!.profit >= TRADE.deedProfit) expect(s.deeds.length).toBe(deeds + 1);
  });

  it('the trading beach opens where a port trades, and not where it hates him', () => {
    let s = trader();
    expect(tradesHere(s, content)).toBe(true);
    s = act(content, s, { t: 'trade' });
    const opts = listActions(s, content);
    expect(opts.some((o) => o.action.t === 'trade_buy' && o.action.good === 'furs')).toBe(true);
    s = act(content, s, { t: 'trade_buy', good: 'furs' });
    expect(s.cargo?.furs?.lots).toBe(1);
    s.at = 'hedeby';
    s.pending = null;
    s.places.hedeby!.standing = -8;
    expect(tradesHere(s, content)).toBe(false);
  });

  it('pirates take the heaviest goods first', () => {
    const s = trader();
    buyLot(s, content, 'home_fjord', 'soapstone');
    buyLot(s, content, 'home_fjord', 'furs');
    applyEffects(s, content, new RngCursor(seedRng(1)), [{ lose_cargo: 1 }]);
    expect(s.cargo?.soapstone).toBeUndefined();
    expect(s.cargo?.furs?.lots).toBe(1);
  });
});
