import { describe, it, expect } from 'vitest';
import { content } from '../helpers';
import { newGame } from '../../src/engine/index';
import { attrPool, makeupError, skillsOf } from '../../src/engine/makeup';
import { ATTRS, SKILLS } from '../../src/content/schema';

// docs/FRAME-LINEAGE.md: character creation, family and the heir, settlement, eras, Iceland.
describe('A. character creation', () => {
  it('the defaults are the beginning as it always was', () => {
    for (const bg of Object.values(content.backgrounds)) {
      const s = newGame(content, { background: bg.id, seed: 5, name: 'Hrafn' });
      expect(s.hero.attrs).toEqual(bg.attrs);
      for (const k of SKILLS) expect(s.hero.skills[k]).toBe(bg.skill_sets[0]!.skills[k] ?? 0);
    }
  });
  it('every beginning has three ways to be raised, seven points each, and a pool of 11', () => {
    for (const bg of Object.values(content.backgrounds)) {
      expect(bg.skill_sets).toHaveLength(3);
      expect(attrPool(bg)).toBe(11);
      for (const set of bg.skill_sets) expect(Object.values(set.skills).reduce((a, v) => a + (v ?? 0), 0)).toBe(7);
    }
  });
  it('a spread and a set are taken as chosen', () => {
    const attrs = { str: 4, agi: 3, end: 2, wit: 1, pre: 1 };
    const s = newGame(content, { background: 'freedman', seed: 5, name: 'Hrafn', attrs, skillSet: 'trader' });
    expect(s.hero.attrs).toEqual(attrs);
    expect(s.hero.skills.trade).toBe(3);
    expect(s.hero.skills.craft).toBe(0);
    // presence 1 sets the first muster
    expect(s.musterPool).toBe(6);
  });
  it('a spread that overspends, underspends or leaves the bounds is refused', () => {
    const bg = content.backgrounds.younger_son!;
    expect(makeupError(bg.attrs, { str: 3, agi: 2, end: 2, wit: 2, pre: 2 })).toBeNull();
    expect(makeupError(bg.attrs, { str: 4, agi: 2, end: 2, wit: 2, pre: 2 })).toMatch(/12 of 11/);
    expect(makeupError(bg.attrs, { str: 6, agi: 1, end: 1, wit: 2, pre: 1 })).toMatch(/Strength/);
    expect(makeupError(bg.attrs, { str: 4, agi: 4, end: 3, wit: 0, pre: 0 })).toMatch(/Wits/);
    // 4 at most: a man is born strong, not a giant
    expect(makeupError(bg.attrs, { str: 5, agi: 2, end: 1, wit: 1, pre: 1 })).toMatch(/Strength/);
    expect(makeupError(bg.attrs, { str: 4, agi: 2, end: 2, wit: 2, pre: 1 })).toBeNull();
    expect(() => newGame(content, { background: 'outlaw', seed: 5, name: 'H', attrs: { str: 5, agi: 5, end: 5, wit: 5, pre: 5 } })).toThrow();
    for (const k of ATTRS) expect(bg.attrs[k]).toBeGreaterThanOrEqual(1);
  });
  it('an unknown set falls back to the first', () => {
    expect(skillsOf(content.backgrounds.outlaw!, 'nope').weapons).toBe(3);
  });
});

import { act, listActions } from '../../src/engine/index';
import { sandboxGame } from '../helpers';
import { dayOf } from '../../src/engine/calendar';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { FAMILY, familyYear, fam, heirs, winterBirth } from '../../src/engine/family';
import { kill } from '../../src/engine/hero';
import { livingFame } from '../../src/engine/fame';
import type { Child, GameState } from '../../src/engine/state';
import { pastChronicle } from '../../src/engine/chronicle';

function married(seed: number, year = 840): GameState {
  const s = sandboxGame(seed);
  s.base.wife = 'Þórunn';
  s.base.level = 'farm';
  s.day = dayOf(year, 300);
  s.at = 'home_fjord';
  s.chron = pastChronicle(s, content);
  return s;
}
const child = (s: GameState, sex: 'm' | 'f', born: number, extra: Partial<Child> = {}): Child => {
  const c: Child = { id: `c${fam(s).children.length + 1}`, name: sex === 'm' ? `Son${born}` : `Dau${born}`, sex, born, alive: true, father: s.hero.name, mother: s.base.wife ?? undefined, ...extra };
  fam(s).children.push(c);
  return c;
};

describe('B. children', () => {
  it('a married man wintering at home has a child about every other winter', () => {
    let born = 0;
    for (let seed = 0; seed < 200; seed++) {
      const s = married(seed);
      const rng = new RngCursor(seedRng(seed));
      for (let w = 840; w < 850; w++) winterBirth(s, content, rng, w);
      born += s.family?.children.length ?? 0;
    }
    // ten winters: between 3 and 5 children on average
    expect(born / 200).toBeGreaterThan(3);
    expect(born / 200).toBeLessThan(5);
  });
  it('a birth queues its scene, and the first son and daughter have their own', () => {
    const s = married(3);
    const rng = new RngCursor(seedRng(1));
    for (let w = 840; w < 860 && (s.family?.children.length ?? 0) < 4; w++) winterBirth(s, content, rng, w);
    const scenes = s.queue.map((q) => q.scene);
    expect(scenes.filter((x) => x === 'g_w_son' || x === 'g_w_daughter').length).toBeGreaterThan(0);
    expect(scenes.length).toBe(s.family!.children.length);
  });
  it('about one child in four dies before five', () => {
    let died = 0, n = 0;
    for (let seed = 0; seed < 400; seed++) {
      const s = married(seed, 840);
      const c = child(s, 'm', 841);
      const rng = new RngCursor(seedRng(seed + 7));
      for (let y = 842; y <= 846; y++) { s.day = dayOf(y, 59); familyYear(s, content, rng); }
      n++; if (!c.alive) died++;
    }
    expect(died / n).toBeGreaterThan(0.17);
    expect(died / n).toBeLessThan(0.33);
  });
  it('fostering binds the ally each year, and the boy comes home at fourteen', () => {
    const s = married(5, 850);
    s.lords = { jarl: { fav: 3 } } as never;
    s.favour = 3;
    const c = child(s, 'm', 842);
    const o = listActions(s, content).find((x) => x.action.t === 'foster' && x.enabled)!;
    expect(o).toBeTruthy();
    const before = s.favour;
    let t = act(content, s, o.action);
    expect(t.family!.children[0]!.foster).toBeTruthy();
    expect(t.favour!).toBe(before + FAMILY.fosterBind);
    const rng = new RngCursor(seedRng(9));
    t.family!.children[0]!.alive = true;
    for (let y = 851; y <= 856; y++) { t.day = dayOf(y, 59); t.family!.children[0]!.alive = true; familyYear(t, content, rng); }
    expect(t.family!.children[0]!.fostered).toBe(o.action.t === 'foster' ? o.action.with : '');
    expect(t.family!.children[0]!.foster).toBeUndefined();
    void c;
  });
  it('a son of fourteen can sail as a sworn man, loyal to the bone; a daughter of fifteen can be married for a bride-price', () => {
    const s = married(6, 850);
    s.favour = 3;
    child(s, 'm', 836);
    child(s, 'f', 834);
    const take = listActions(s, content).find((x) => x.action.t === 'take_son')!;
    let t = act(content, act(content, s, take.action), { t: 'continue' });
    // a spring scene may have opened behind the report: set it aside
    t.pending = null;
    const man = t.men.find((m) => m.origin === 'son')!;
    expect(man.loyalty).toBe(10);
    const wed = listActions(t, content).find((x) => x.action.t === 'wed_daughter' && x.enabled)!;
    const silver = t.silver;
    t = act(content, t, wed.action);
    expect(t.silver).toBeGreaterThan(silver);
    expect(t.family!.children.find((c) => c.sex === 'f')!.wed).toBeTruthy();
    // he dies at the oar: the child record follows the man
    t.men.find((m) => m.origin === 'son')!.alive = false;
    expect(heirs(t).length).toBe(0);
  });
});

describe('B. the heir', () => {
  function deathWithSon(sonBorn: number, deathYear = 850): GameState {
    const s = married(11, deathYear);
    s.day = dayOf(deathYear, 200);
    s.base.hoard = 2400;
    s.silver = 300;
    s.oath = { lord: 'harek', since: dayOf(845, 100) };
    s.holdings = [{ place: 'skye', kind: 'bought', since: dayOf(846, 1) }, { place: 'orkney', kind: 'grant', lord: 'harek', since: dayOf(846, 1) }] as never;
    s.ships.push({ id: 's2', type: 'karvi', name: 'Second', hull: 90 });
    for (let i = 0; i < 6; i++) s.deeds.push({ n: i + 1, type: 'deed', day: s.day - 30, place: null, text: 'A deed', weight: 20, witnesses: 10, told: s.day - 30, verse: false });
    child(s, 'm', sonBorn);
    kill(s, 'battle', 'He fell.');
    return s;
  }
  it('the death screen offers to go on as a living son', () => {
    const s = deathWithSon(842);
    const o = listActions(s, content);
    expect(o.length).toBe(1);
    expect(o[0]!.action.t).toBe('heir');
  });
  it('the years pass until he is sixteen; the world moves; he inherits what is left', () => {
    const s = deathWithSon(842);
    const fatherFame = livingFame(s);
    let t = act(content, s, listActions(s, content)[0]!.action);
    expect(t.death).toBeNull();
    expect(t.pending?.t).toBe('report');
    const p = t.pending as { lines: string[]; title: string };
    expect(p.title).toBe('The years between');
    // the chronicle ran: news of 854 (Horik's death) is in the summary
    expect(p.lines.join(' ')).toMatch(/Horik/);
    expect(t.day).toBe(dayOf(858, 59));
    expect(t.hero.name).toMatch(/^Son842 Arisson$/);
    expect(t.oath).toBeUndefined();
    expect((t.holdings ?? []).map((h) => h.place)).toEqual(['skye']);
    expect(t.ships.length).toBe(1);
    expect(t.base.hoard).toBeLessThan(2400 + 300);
    const d = t.deeds[0]!;
    expect(d.weight).toBe(Math.round(fatherFame * FAMILY.fameCarried));
    expect(t.family!.line[0]!.name).toBe(s.hero.name);
    // the report, then who he is, then the mound
    t = act(content, t, { t: 'continue' });
    expect(t.pending?.t).toBe('heir');
    expect(() => act(content, t, { t: 'heir_make', attrs: { str: 5, agi: 5, end: 1, wit: 1, pre: 1 }, set: 'farm' })).toThrow();
    t = act(content, t, { t: 'heir_make', attrs: { str: 2, agi: 2, end: 3, wit: 2, pre: 2 }, set: 'sword' });
    expect(t.hero.skills.weapons).toBe(3);
    expect(t.hero.hp).toBeGreaterThan(0);
    expect(t.pending).toEqual({ t: 'scene', id: 'fa_mound' });
  });
  it('a son already grown takes over at the next spring, with his ships and his crew', () => {
    const s = deathWithSon(832);
    const t = act(content, s, listActions(s, content)[0]!.action);
    expect(t.day).toBe(dayOf(851, 59));
    expect(t.ships.length).toBe(2);
    expect(t.crew.men).toBeGreaterThan(0);
  });
  it('a fostered son is offered the hall he grew up in', () => {
    const s = deathWithSon(842);
    s.family!.children[0]!.fostered = 'lord:jarl';
    const t = act(content, act(content, s, listActions(s, content)[0]!.action), { t: 'continue' });
    expect(listActions(t, content)).toEqual([]);
    const sets = (content.upbringing);
    expect(sets.hall).toBeTruthy();
    const u = act(content, t, { t: 'heir_make', attrs: { str: 3, agi: 2, end: 2, wit: 2, pre: 2 }, set: 'hall' });
    expect(u.hero.skills.lore).toBe(2);
  });
});

import { settleBlock, souls, settleRoom, homeOf, SETTLE } from '../../src/engine/settle';
import { yearEnd, startWinter } from '../../src/engine/season';
import { holdingsYear } from '../../src/engine/land';

describe('C. settlement', () => {
  function atSkye(seed = 21): GameState {
    const s = married(seed, 845);
    s.day = dayOf(845, 200);
    s.phase = 'sailing';
    s.at = 'skye';
    s.holdings = [{ place: 'skye', kind: 'bought', since: dayOf(844, 100) }] as never;
    s.crew.men = 30;
    s.provisions = 5000;
    s.base.thralls = 4;
    child(s, 'm', 842);
    return s;
  }
  it('the ships must have room for the families', () => {
    const s = atSkye();
    expect(souls(s)).toBeGreaterThan(settleRoom(s, content));
    expect(settleBlock(s, content)).toMatch(/room in your ships/);
    s.ships.push({ id: 'k', type: 'knarr', name: 'Knarr', hull: 90 });
    expect(settleBlock(s, content)).toBeNull();
  });
  it('the move makes the holding home: muster, winter and the household there', () => {
    const s = atSkye();
    s.ships.push({ id: 'k', type: 'knarr', name: 'Knarr', hull: 90 });
    const loyal = s.men.filter((m) => m.alive && m.sworn).map((m) => m.loyalty);
    const silver = s.silver;
    let t = act(content, s, listActions(s, content).find((o) => o.action.t === 'settle')!.action);
    expect(homeOf(t)).toBe('skye');
    expect(t.silver).toBeGreaterThan(silver); // the farm in Hordaland sold
    expect(t.men.filter((m) => m.alive && m.sworn).map((m) => m.loyalty)).toEqual(loyal.map((l) => Math.min(10, l + SETTLE.loyalty)));
    // the winter at home there, and the spring muster there
    t.pending = null;
    const rng = new RngCursor(seedRng(4));
    startWinter(t, 6, content, rng);
    t.queue = [];
    for (const m of t.men) m.loyalty = 1;
    yearEnd(t, content, rng);
    expect(t.phase).toBe('muster');
    expect(t.at).toBe('skye');
    t.pending = null; t.queue = [];
    expect(listActions(t, content).some((o) => o.action.t === 'recruit')).toBe(true);
    expect(listActions(t, content).some((o) => o.action.t === 'hoard_in' || o.action.t === 'hoard_out')).toBe(true);
    // their wives are here: nobody's loyalty runs out at the turn of the year
    expect(t.men.filter((m) => m.alive && m.sworn).every((m) => m.loyalty >= SETTLE.loyaltyFloor)).toBe(true);
  });
  it('a fort that is home is fought for when he winters in it, and lost with the household if he is away', () => {
    let fought = 0, lost = 0;
    for (let seed = 0; seed < 60; seed++) {
      const s = atSkye(seed);
      s.holdings = [{ place: 'dublin', kind: 'fort', since: dayOf(843, 100), garrison: 10 }] as never;
      s.homeAt = 'dublin';
      s.at = 'dublin';
      holdingsYear(s, content, new RngCursor(seedRng(seed)), 'dublin');
      if (s.queue.some((q) => q.scene === 'st_fort_attack')) fought++;
      expect(homeOf(s)).toBe('dublin');
      const away = atSkye(seed);
      away.holdings = [{ place: 'dublin', kind: 'fort', since: dayOf(843, 100), garrison: 10 }] as never;
      away.homeAt = 'dublin';
      holdingsYear(away, content, new RngCursor(seedRng(seed)), 'skye');
      if (!away.homeAt) lost++;
    }
    expect(fought).toBeGreaterThan(5);
    expect(lost).toBeGreaterThan(5);
  });
});

import { playLife } from '../../tools/bot-lib';

describe("D. Ragnarr's days", () => {
  it('the world has moved on: thirteen years of the chronicle, then the Vestfold arrow', () => {
    const s = newGame(content, { background: 'younger_son', seed: 3, name: 'Ari', era: 843 });
    expect(s.day).toBe(dayOf(843, 59));
    expect(s.hero.born).toBe(827);
    expect(s.places.dublin!.norse).toBe(true);
    expect(s.places.dorestad!.wealth).toBeLessThan(content.places.dorestad!.raid!.wealth);
    expect(s.seen.b_ship_home).toBeDefined();
    expect(s.pending?.t).toBe('report');
    expect((s.pending as { lines: string[] }).lines.join(' ')).toMatch(/Dorestad/);
    let t = act(content, s, { t: 'continue' });
    expect(t.pending).toEqual({ t: 'scene', id: 'e43_boyhood' });
    t = act(content, t, { t: 'choose', id: 'yard' });
    t = act(content, t, { t: 'continue' });
    expect(t.pending).toEqual({ t: 'scene', id: 'e43_arrow' });
    t = act(content, t, { t: 'choose', id: 'bench' });
    expect(t.service?.captain).toBe('Ölvir');
    expect(t.flags.cw_nantes_sworn).toBe(1);
  });
  it('the outlaw starts outside Hordaland, and the 830 exile scenes stay shut', () => {
    const s = newGame(content, { background: 'outlaw', seed: 4, name: 'Ari', era: 843 });
    expect(s.at).toBe('karmoy');
    expect(s.flags.outlawed).toBe(1);
  });
  it('bot lives in 843 play on without dead ends', () => {
    for (const bg of ['younger_son', 'outlaw', 'freedman']) {
      const r = playLife(content, 'raider', 500, 3, bg, undefined, { era: 843 });
      expect(r.error).toBeFalsy();
      expect(r.state.seen.cw_nantes).toBeDefined();
    }
  }, 60000);
});

import { claimBlock } from '../../src/engine/land';
import { lastingFame } from '../../src/engine/fame';

describe('E. Iceland', () => {
  it('nobody hears of it before 860; then the Faroes tell of it, and an expedition finds it', () => {
    const s = married(31, 850);
    s.at = 'faroes';
    s.known.push('faroes');
    s.phase = 'sailing';
    expect(listActions(s, content).some((o) => o.action.t === 'listen')).toBe(false);
    s.day = dayOf(862, 150);
    s.chron = pastChronicle(s, content);
    expect(listActions(s, content).some((o) => o.action.t === 'listen' && o.enabled)).toBe(true);
    s.rumoured.push('island');
    expect(listActions(s, content).some((o) => o.action.t === 'expedition' && (o.action as { to: string }).to === 'island')).toBe(true);
  });
  it('land is free to take from 870; settling it makes a founder, which lasts', () => {
    const s = married(32, 869);
    s.at = 'island'; s.phase = 'sailing'; s.known.push('island');
    s.day = dayOf(869, 160);
    expect(claimBlock(s, content, 'island')).toMatch(/870/);
    s.day = dayOf(871, 160);
    s.chron = pastChronicle(s, content);
    expect(claimBlock(s, content, 'island')).toBeNull();
    let t = act(content, s, { t: 'claim_land' });
    expect(t.pending).toEqual({ t: 'scene', id: 'is_landnam' });
    t = act(content, t, { t: 'choose', id: 'fire' });
    expect(t.holdings!.some((h) => h.place === 'island' && h.kind === 'claimed')).toBe(true);
    t.pending = null;
    t.ships.push({ id: 'k', type: 'knarr', name: 'Knarr', hull: 90 }, { id: 'k2', type: 'knarr', name: 'Knarr II', hull: 90 });
    t.provisions = 9000;
    const before = lastingFame(t);
    t = act(content, t, listActions(t, content).find((o) => o.action.t === 'settle')!.action);
    expect(t.homeAt).toBe('island');
    expect(lastingFame(t)).toBeGreaterThan(before);
  });
  it('Reykjarvík trades only once Ingólfr is there', () => {
    const s = married(33, 872);
    s.at = 'island'; s.phase = 'sailing'; s.known.push('island');
    s.day = dayOf(872, 160);
    expect(listActions(s, content).some((o) => o.action.t === 'trade')).toBe(false);
    s.day = dayOf(875, 160);
    s.chron = pastChronicle(s, content);
    expect(listActions(s, content).some((o) => o.action.t === 'trade')).toBe(true);
  });
});
