import { describe, it, expect } from 'vitest';
import { content } from '../helpers';
import { newGame } from '../../src/engine/index';
import { applyEffects } from '../../src/engine/effects';
import { renderText } from '../../src/engine/text';
import { heroDuelSide } from '../../src/engine/fights';
import { RngCursor, seedRng } from '../../src/engine/rng';
import { dateOf } from '../../src/engine/calendar';
import { playLife } from '../../tools/bot-lib';

const start = () => newGame(content, { background: 'younger_son', seed: 3, name: 'Ari' });
const rng = () => new RngCursor(seedRng(1));

describe('the year 831', () => {
  it('the four new places are on the sea roads', () => {
    for (const id of ['kaupang', 'lindisfarne', 'skye', 'conaille']) {
      expect(content.places[id]?.active).toBe(true);
      expect(content.legs.some((l) => l.a === id || l.b === id)).toBe(true);
    }
  });

  it('captives sell at a market price, straight into the heap', () => {
    const s = start();
    s.captives = 3;
    applyEffects(s, content, rng(), [{ sell_captives: 32 }]);
    expect(s.captives).toBe(0);
    expect(s.loot).toBe(96);
  });

  it('men sign on away from home only for a captain, and only as many as there are benches', () => {
    const s = start();
    const before = s.crew.men;
    applyEffects(s, content, rng(), [{ recruit: 6 }]);
    expect(s.crew.men).toBe(before); // an oarsman hires nobody
    s.service = null;
    s.crew.men = 0;
    applyEffects(s, content, rng(), [{ recruit: 6 }]);
    expect(s.crew.men).toBe(6);
  });

  it('a mail shirt and a Frankish sword change the numbers the duel uses', () => {
    const s = start();
    const plain = heroDuelSide(s, content, 'duel');
    s.flags.mail = 1;
    s.flags.frankish_sword = 1;
    const kitted = heroDuelSide(s, content, 'duel');
    expect(kitted.armour).toBe(plain.armour + 1);
    expect(kitted.weapon).toBe(plain.weapon + 1);
  });

  it('{captain} and {ship} name the man at the steering-oar and his ship', () => {
    const s = start();
    expect(renderText('{captain} in {ship}', s, content)).toBe('Ásgeir in the Raven');
    s.service!.captain = 'Steinarr';
    expect(renderText('{captain}', s, content)).toBe('Steinarr');
  });

  it('two whole years play through to spring 832 without dead ends', () => {
    let reached = 0;
    for (let seed = 1; seed <= 24; seed++) {
      const r = playLife(content, 'raider', seed, 3, 'younger_son', (s) => s.seen.sp_832 !== undefined && !s.pending);
      expect(r.error).toBeNull();
      if (r.state.death) continue;
      expect(dateOf(r.state.day).year).toBeGreaterThanOrEqual(832);
      if (r.state.seen.sp_832 !== undefined) reached++;
    }
    expect(reached).toBeGreaterThan(12);
  });
});
