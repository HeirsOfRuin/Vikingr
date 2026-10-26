import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { listActions } from '../../src/engine/index';
import { choiceFight, duelOdds, reckonWords } from '../../src/engine/reckon';
import { dayOf } from '../../src/engine/calendar';

const hero = (weapons: number) => {
  const s = sandboxGame(7);
  s.day = dayOf(834, 160);
  s.hero.skills.weapons = weapons;
  s.hero.skills.shield = weapons;
  return s;
};

describe("the men's reckoning before a single combat", () => {
  it('a raw boy is told a champion will kill him; a seasoned man is told he will win', () => {
    const boy = duelOdds(hero(1), content, 'ch_grjotgard', 'holmgang', true);
    expect(boy.instinct).toBeLessThan(0.15);
    expect(reckonWords(boy, true)).toMatch(/he'd kill you/);
    const man = duelOdds(hero(8), content, 'beach_brawler', 'duel', false);
    expect(man.instinct).toBeGreaterThan(0.85);
    expect(reckonWords(man, false)).toMatch(/easily/);
  });

  it('says so when watching him closely would turn it', () => {
    expect(reckonWords({ instinct: 0.3, reading: 0.6 }, true)).toMatch(/unless you watch him very closely/);
    expect(reckonWords({ instinct: 0.65, reading: 0.9 }, true)).toMatch(/more if you watch him well/);
    expect(reckonWords({ instinct: 0.5, reading: 0.55 }, true)).not.toMatch(/watch/);
  });

  it('finds the fight behind a choice, in its effects or behind its check', () => {
    expect(choiceFight({ effects: [{ fight: { foe: 'x', kind: 'duel', lethal: true } }] })).toEqual({ foe: 'x', kind: 'duel', lethal: true });
    expect(choiceFight({ failure: { effects: [{ fight: { foe: 'y', kind: 'holmgang', lethal: false } }] } })?.foe).toBe('y');
    expect(choiceFight({ effects: [{ add: { honour: 1 } }] })).toBeNull();
  });

  it("a challenger's fight choice carries the reckoning on screen", () => {
    const s = hero(2);
    s.pending = { t: 'scene', id: 'ch_cu_mara' };
    const fight = listActions(s, content).find((o) => o.action.t === 'choose' && o.action.id === 'fight');
    expect(fight?.hint).toMatch(/The men reckon/);
  });
});
