import { describe, it, expect } from 'vitest';
import { content } from '../helpers';
import { newGame } from '../../src/engine/index';
import { addDeed, tellDeeds } from '../../src/engine/fame';
import { kill } from '../../src/engine/hero';
import { epitaph } from '../../src/engine/saga';
import { ordinal } from '../../src/engine/format';
import { dayOf } from '../../src/engine/calendar';

describe('the end of a life', () => {
  it('ordinals', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
  });
  it('an epitaph: his age, what men remembered, who carried him, his rank', () => {
    const s = newGame(content, { background: 'younger_son', seed: 3, name: 'Ragnvald' });
    s.pending = null;
    s.day = dayOf(830, 352);
    s.at = 'home_fjord';
    addDeed(s, content, { type: 'deed', text: 'Took command of the Raven on the field at Bangor', weight: 4 });
    addDeed(s, content, { type: 'deed', text: 'cut his way through their front rank at Iona', weight: 3 });
    tellDeeds(s);
    kill(s, 'duel', 'Ragnvald was killed on the holmgang cloak by Thorgils Hrappsson.');
    const lines = epitaph(s, content);
    expect(lines[0]).toMatch(/16 winters old, and had gone viking one summer/);
    expect(lines[1]).toMatch(/Took command of the Raven.*Cut his way/);
    expect(lines.some((l) => /mound above the fjord/.test(l))).toBe(true);
    expect(lines[lines.length - 1]).toMatch(/stood (first|\d+(st|nd|rd|th))\./);
  });
});
