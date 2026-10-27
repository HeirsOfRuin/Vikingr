// The October 2026 cleanup: the validator's cover check, the saga's remembered choices, and the 843 matches.
import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { covers } from '../../tools/validate-lib';
import { remembered, epitaph } from '../../src/engine/saga';
import { applyEffects } from '../../src/engine/effects';
import { RngCursor, seedRng } from '../../src/engine/rng';
import type { Choice } from '../../src/content/schema';

const ch = (visible_if?: Choice['visible_if'], requires?: Choice['requires']): Choice => ({ id: 'x', text: 'x', visible_if, requires } as Choice);

describe('the cleanup', () => {
  it('a scene whose choices split on a condition and its negation is not a dead end', () => {
    expect(covers([ch('fate.a'), ch('!fate.a')])).toBe(true);
    expect(covers([ch({ any: ['!oath', 'oath == jarl'] }), ch('oath && oath != jarl')])).toBe(true);
    expect(covers([ch('fate.a'), ch('flag.b')])).toBe(false);
    // a choice with a requirement can't be counted on
    expect(covers([ch('fate.a'), ch('!fate.a', ['silver >= 5'])])).toBe(false);
  });

  it('the saga remembers the choices marked for it, and only those set', () => {
    const s = sandboxGame(3);
    expect(remembered(s, content)).toEqual([]);
    s.flags.l_spared_book = 1;
    expect(remembered(s, content)).toEqual(['Left the Lindisfarne book on the altar']);
  });

  it("the völva's words are weighed at the end of a life", () => {
    const s = sandboxGame(3);
    s.flags.y_asked_death = 1;
    s.death = { day: s.day, cause: 'straw', afterlife: 'hel', text: '' } as never;
    expect(epitaph(s, content).join(' ')).toContain('She was wrong about the bed');
  });

  it('a wedding to a Loire match ends the other courtships', () => {
    const s = sandboxGame(3);
    s.flags.betrothed = 1; s.flags.e43_ragnhild_betrothed = 1; s.flags.e43_argantlon_betrothed = 1;
    applyEffects(s, content, new RngCursor(seedRng(1)), [{ wife: 'Ragnhild' }]);
    expect(s.base.wife).toBe('Ragnhild');
    expect(s.flags.e43_argantlon_betrothed).toBeUndefined();
    expect(s.flags.betrothed).toBeUndefined();
  });
});
