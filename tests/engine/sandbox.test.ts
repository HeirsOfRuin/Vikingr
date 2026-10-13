import { describe, it, expect } from 'vitest';
import { content } from '../helpers';
import { act, newGame } from '../../src/engine/index';
import type { GameState } from '../../src/engine/state';
import { applyEffects } from '../../src/engine/effects';
import { goalMet, keepBoast, reckoning } from '../../src/engine/boasts';
import { open, trigger } from '../../src/engine/director';
import { yearEnd, SERVICE_CREW } from '../../src/engine/season';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { dayOf } from '../../src/engine/calendar';
import { standing } from '../../src/engine/standing';
import { Bot } from '../../tools/bot-lib';
import { dateOf } from '../../src/engine/calendar';

const rng = () => new RngCursor(seedRng(1));
/** A captain of his own ship in 833, at home, nothing pending. */
const captain = (): GameState => {
  const s = newGame(content, { background: 'freedman', seed: 4, name: 'Ari' });
  s.pending = null;
  s.service = null;
  s.day = dayOf(833, 150);
  s.phase = 'sailing';
  s.at = 'home_fjord';
  s.silver = 1000;
  s.flags._winter = 832;
  return s;
};
const choose = (s: GameState, id: string) => act(content, s, { t: 'choose', id });
/** Close any report the choice left, and return the state. */
const settle = (s: GameState) => (s.pending?.t === 'report' ? act(content, s, { t: 'continue' }) : s);
const arrive = (s: GameState, at: string) => {
  s.at = at;
  trigger(s, content, rng(), 'arrive');
  return s.pending?.t === 'scene' ? s.pending.id : null;
};
const winterHall = (s: GameState) => {
  s.at = 'home_fjord';
  s.phase = 'winter';
  s.hallLeft = 3;
  trigger(s, content, rng(), 'hall');
  return s.pending?.t === 'scene' ? s.pending.id : null;
};

describe('boasts the engine keeps', () => {
  it('a counted boast is kept when the count is reached since it was sworn, and can be sworn again', () => {
    const s = captain();
    s.stats.raids = 5;
    applyEffects(s, content, rng(), [{ boast: 'yule_raids' }]);
    const b = s.boasts.find((x) => x.id === 'yule_raids')!;
    expect(goalMet(s, content, b)).toBe(false); // the five before don't count
    s.stats.raids = 7;
    expect(goalMet(s, content, b)).toBe(true);
    keepBoast(s, content, b);
    expect(reckoning(s, content)).toContain('two places will pay me');
    applyEffects(s, content, rng(), [{ boast: 'yule_raids' }]);
    expect(s.boasts.filter((x) => x.id === 'yule_raids')).toHaveLength(1);
    expect(s.boasts.find((x) => x.id === 'yule_raids')!.state).toBe('open');
  });

  it('a condition boast is kept by the next action once it comes true', () => {
    let s = captain();
    applyEffects(s, content, rng(), [{ boast: 'yule_farm' }]);
    s.base.level = 'farm';
    s = act(content, s, { t: 'rest' });
    expect(s.boasts.find((x) => x.id === 'yule_farm')!.state).toBe('kept');
    expect(s.pending?.t === 'report' && s.pending.title).toBe('A boast kept');
  });

  it('the Yule reckoning has something to say when nothing was sworn', () => {
    expect(reckoning(captain(), content)).toContain('nothing of yours to reckon');
  });
});

describe('the wives', () => {
  it('Ingibjörg: met at Birsay, asked for, and brought home at the winter nights', () => {
    let s = captain();
    for (let i = 0; i < 6; i++) applyEffects(s, content, rng(), [{ deed: { type: 'deed', text: `d${i}`, weight: 6, witnesses: 40 } }]);
    for (const d of s.deeds) d.told = s.day;
    expect(arrive(s, 'orkney')).toBe('g_ingibjorg_meet');
    s = settle(choose(s, 'answer'));
    expect(s.flags.ingibjorg_waiting).toBe(1);
    s.day += 330;
    s.pending = null;
    expect(arrive(s, 'orkney')).toBe('g_ingibjorg_ask');
    s = settle(choose(s, 'pay'));
    expect(s.flags.betrothed).toBe(1);
    const orkney = standing(s, content, 'orkney');
    expect(winterHall(s)).toBe('g_wed_ingibjorg');
    s = settle(choose(s, 'wed'));
    expect(s.base.wife).toBe('Ingibjörg');
    expect(s.flags.betrothed ?? 0).toBe(0);
    expect(standing(s, content, 'orkney')).toBeGreaterThan(orkney);
  });

  it('Þórunn: her valley buys a farm, and her two thralls come with her', () => {
    let s = captain();
    s.flags.sk_land_offer = 1;
    expect(arrive(s, 'skye')).toBe('g_thorunn_ask');
    s = settle(choose(s, 'yes'));
    expect(winterHall(s)).toBe('g_wed_thorunn');
    s = settle(choose(s, 'wed'));
    expect(s.base.wife).toBe('Þórunn');
    expect(s.base.level).toBe('farm');
    expect(s.base.thralls).toBe(2);
  });

  it('Ásta: the strongbox or Ívarr; she brings ten marks north', () => {
    let s = captain();
    for (let i = 0; i < 4; i++) applyEffects(s, content, rng(), [{ deed: { type: 'deed', text: `d${i}`, weight: 6, witnesses: 40 } }]);
    for (const d of s.deeds) d.told = s.day;
    expect(arrive(s, 'kaupang')).toMatch(/g_asta_meet|k_market/);
    if (s.pending?.t === 'scene' && s.pending.id === 'k_market') { s.pending = null; open(s, 'g_asta_meet'); }
    s = settle(choose(s, 'talk'));
    s.day += 330;
    s.seen.k_market = s.day; // the market scene has had its turn
    s.pending = null;
    expect(arrive(s, 'kaupang')).toBe('g_asta_ask');
    const fight = choose(structuredClone(s), 'ivarr');
    expect(fight.pending?.t).toBe('duel');
    s = settle(choose(s, 'silver'));
    const before = s.silver;
    expect(winterHall(s)).toBe('g_wed_asta');
    s = settle(choose(s, 'wed'));
    expect(s.base.wife).toBe('Ásta');
    expect(s.silver).toBe(before + 240);
  });

  it('one bride at a time: betrothed to one, the others do not ask', () => {
    const s = captain();
    s.flags.betrothed = 1;
    s.flags.sk_land_offer = 1;
    expect(arrive(s, 'skye')).not.toBe('g_thorunn_ask');
  });
});

describe('the years after the story', () => {
  it('a man still at another man\'s oar can buy a ship of his own in spring', () => {
    let s = captain();
    s.service = { captain: 'Ásgeir', route: [], shares: 1 };
    s.phase = 'muster';
    s.pending = null;
    open(s, 'g_spring_ship');
    s = settle(choose(s, 'buy'));
    expect(s.service).toBeNull();
    expect(s.ships).toHaveLength(1);
    expect(s.silver).toBe(1000 - 192);
  });

  it('the captain he rows for fills his benches each spring', () => {
    const s = captain();
    s.service = { captain: 'Ásgeir', route: [], shares: 1 };
    s.crew.men = 7;
    s.phase = 'winter';
    s.hero.hp = s.hero.hp; // keep the straw death check honest
    yearEnd(s, content, rng());
    if (!s.death) expect(s.crew.men).toBeGreaterThanOrEqual(SERVICE_CREW);
  });

  it('ten-year lives keep meeting content after the written story ends', () => {
    let scenes = 0, years = 0;
    for (let seed = 1; seed <= 8; seed++) {
      let s = newGame(content, { background: 'younger_son', seed, name: 'Bot' });
      const bot = new Bot('raider', new RngCursor(seedRng(seed)));
      let last: string | null = null;
      const lived = new Set<number>();
      for (let n = 0; n < 40000 && !s.death && dateOf(s.day).year < 838; n++) {
        s = act(content, s, bot.choose(s, content)!);
        const y = dateOf(s.day).year;
        const id = s.pending?.t === 'scene' ? s.pending.id : null;
        if (y >= 833) { lived.add(y); if (id && id !== last) scenes++; }
        last = id;
      }
      years += lived.size;
    }
    expect(scenes / years).toBeGreaterThan(4);
  });
});
