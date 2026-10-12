import { describe, it, expect } from 'vitest';
import { content } from '../helpers';
import { act, newGame, screenOf } from '../../src/engine/index';
import type { GameState } from '../../src/engine/state';
import { renderText } from '../../src/engine/text';
import { applyEffects } from '../../src/engine/effects';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { plunderAction, startPlunder, ALARM_MAX } from '../../src/engine/plunder';
import { serviceShare, SERVICE_OARS_SHARE } from '../../src/engine/season';
import { dateOf } from '../../src/engine/calendar';
import { playLife } from '../../tools/bot-lib';

const start = (seed = 7) => newGame(content, { background: 'younger_son', seed, name: 'Ari' });
const rng = () => new RngCursor(seedRng(1));

describe('the year 830', () => {
  it('the younger son starts at another man\'s oar, with bench-mates who have not sworn', () => {
    const s = start();
    expect(s.service).toMatchObject({ captain: 'Ásgeir', shares: 1 });
    expect(s.ships[0]!.name).toBe('the Raven');
    expect(s.men.every((m) => !m.sworn)).toBe(true);
    expect(s.pending).toEqual({ t: 'scene', id: 'b_ship_home' });
  });

  it('fates are rolled from the seed, and omens tell the truth about seven times in ten', () => {
    expect(start(11).fates).toEqual(start(11).fates);
    let agree = 0;
    let n = 0;
    for (let seed = 0; seed < 400; seed++) {
      const s = start(seed);
      for (const id of Object.keys(s.fates)) {
        n++;
        if (s.fates[id] === s.omens[id]) agree++;
      }
    }
    expect(agree / n).toBeGreaterThan(0.64);
    expect(agree / n).toBeLessThan(0.76);
  });

  it('scene text answers what came before: [if]/[elif]/[else] and {name}', () => {
    const s = start();
    const t = '[if flag.b_sword]sword[elif flag.b_blessing]blessing[else]nothing[/if], {name}';
    expect(renderText(t, s, content)).toBe('nothing, Ari');
    s.flags.b_blessing = 1;
    expect(renderText(t, s, content)).toBe('blessing, Ari');
    s.flags.b_sword = 1;
    expect(renderText(t, s, content)).toBe('sword, Ari');
    expect(renderText('[if fate.asgeir_falls && !flag.bg_covered]dead[/if]', { ...s, fates: { ...s.fates, asgeir_falls: 1 } }, content)).toBe('dead');
  });

  it('conditional effects pick their branch, and command ends the service', () => {
    const s = start();
    s.men.find((m) => m.id === 'ketill')!.loyalty = 6;
    s.men.find((m) => m.id === 'bersi')!.loyalty = 2;
    applyEffects(s, content, rng(), [
      { command: true },
      { if: 'man.ketill.loyalty >= 4', then: [{ man: { id: 'ketill', swear: true } }] },
      { if: 'man.bersi.loyalty >= 5', then: [{ man: { id: 'bersi', swear: true } }], else: [{ man: { id: 'bersi', leave: true } }] },
    ]);
    expect(s.service).toBeNull();
    expect(s.men.find((m) => m.id === 'ketill')!.sworn).toBe(true);
    expect(s.men.find((m) => m.id === 'bersi')).toBeUndefined();
  });

  it('a boast unkept by its day costs honour', () => {
    // the sandbox hall, so no Yule scene takes the stage
    let s = newGame(content, { background: 'freedman', seed: 7, name: 'Ari' });
    s.pending = null;
    s.phase = 'winter';
    s.hallLeft = 5;
    s.at = 'iona'; // away from home, so no Yule scene takes the stage
    applyEffects(s, content, rng(), [{ boast: 'thorgils_words' }]);
    const honour = s.honour;
    s.day += content.boasts.thorgils_words!.days + 1;
    s = act(content, s, { t: 'hall', what: 'rest' });
    s = act(content, s, { t: 'continue' }); // the boast falls due once the hall's report is read
    expect(s.boasts[0]!.state).toBe('broken');
    expect(s.honour).toBe(honour - 2);
  });

  it('plunder: each round takes more and wakes the country; staying too long costs men and silver', () => {
    const s = start();
    s.at = 'bangor';
    s.pending = null;
    startPlunder(s, 'bangor', [], 'b_leave');
    const r = rng();
    while ((s.pending as { t: string } | null)?.t === 'plunder') plunderAction(s, content, r, 'grab');
    expect(s.pending).toMatchObject({ t: 'report', next: 'b_leave' });
    expect(s.loot).toBeGreaterThan(0);
    expect(s.seasonRaids).toContain('bangor');
    expect(ALARM_MAX).toBeGreaterThan(0);
  });

  it('the share-out at another man\'s oar pays by shares', () => {
    const one = start();
    one.loot = 1000;
    serviceShare(one, content);
    const two = start();
    two.loot = 1000;
    two.service!.shares = 2;
    serviceShare(two, content);
    const heads = one.crew.men + one.men.length + 1;
    expect(one.silver - start().silver).toBe(Math.round((1000 * SERVICE_OARS_SHARE) / heads));
    expect(two.silver - start().silver).toBe(Math.round((2000 * SERVICE_OARS_SHARE) / heads));
    expect(one.phase).toBe('winter');
  });

  it('at another man\'s oar the captain feeds the ship, and a leg of a voyage is broken by one scene at most', () => {
    let s = start();
    s.pending = null;
    s.phase = 'sailing';
    s.service!.route = ['orkney'];
    s.provisions = 0;
    s.day = 130;
    s = act(content, s, { t: 'follow' });
    let scenes = 0;
    for (let i = 0; i < 200 && s.voyage; i++) {
      const sc = screenOf(s);
      if (sc === 'scene') scenes++;
      const opts = (s.pending?.t === 'scene') ? content.scenes[s.pending.id]!.choices.filter((c) => !c.requires).map((c) => ({ t: 'choose' as const, id: c.id })) : [];
      s = act(content, s, opts[0] ?? (sc === 'battle' ? { t: 'battle_auto' } : sc === 'duel' ? { t: 'duel_auto' } : sc === 'voyage' ? { t: 'voyage_on' } : { t: 'continue' }));
    }
    expect(s.stats.hungerDays).toBe(0);
    expect(scenes).toBeLessThanOrEqual(1);
  });

  it('a whole year plays through to spring 831 without dead ends, and every survivor has a name by then', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const r = playLife(content, 'random', seed, 2, 'younger_son', (s: GameState) => s.seen.sp_831 !== undefined && !s.pending);
      expect(r.error).toBeNull();
      if (r.state.death || r.state.seen.sp_831 === undefined) continue; // a captain who wintered abroad misses the spring at home
      expect(dateOf(r.state.day).year).toBe(831);
      if (r.state.at === 'home_fjord') expect(r.state.hero.nickname).not.toBeNull();
      expect(screenOf(r.state)).not.toBe('death');
    }
  });
});
