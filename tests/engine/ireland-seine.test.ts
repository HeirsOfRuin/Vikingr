import { describe, it, expect } from 'vitest';
import { content, sandboxGame } from '../helpers';
import { act, listActions } from '../../src/engine/index';
import type { GameState, Pending } from '../../src/engine/state';
import { open } from '../../src/engine/director';
import { dayOf } from '../../src/engine/calendar';
import { yearEnd } from '../../src/engine/season';
import { canHire, norseHeld } from '../../src/engine/standing';
import { hostagesOf } from '../../src/engine/hostages';
import { RngCursor, seedRng } from '../../src/engine/rng';

// docs/FRAME-IRELAND-SEINE.md
const lord = (year: number, at: string): GameState => {
  const s = sandboxGame(5);
  delete s.flags.owes_jarl;
  s.pending = null;
  s.service = null;
  s.day = dayOf(year, 140);
  s.phase = 'sailing';
  s.at = at;
  return s;
};

describe('the ship-forts of 841', () => {
  it('appear at the turn of 841 whether he goes or not, and make Dublin a Norse port', () => {
    const s = lord(840, 'home_fjord');
    s.flags._winter = 840;
    s.phase = 'winter';
    yearEnd(s, content, new RngCursor(seedRng(1)));
    expect(norseHeld(s, 'dublin')).toBe(true);
    expect(norseHeld(s, 'linn_duachaill')).toBe(true);
    s.at = 'dublin';
    s.phase = 'sailing';
    s.pending = null;
    const acts = listActions(s, content);
    expect(acts.some((o) => o.action.t === 'raid')).toBe(false);
    expect(acts.some((o) => o.action.t === 'shop')).toBe(true);
    expect(canHire(s, content, 'dublin')).toBeGreaterThan(0);
  });

  it('spring 841 offers two fleets: Ireland or the Seine', () => {
    const s = lord(841, 'home_fjord');
    s.phase = 'muster';
    open(s, 'sp_841', content);
    const ids = listActions(s, content).filter((o) => o.action.t === 'choose').map((o) => (o.action as { id: string }).id);
    expect(ids).toEqual(['ireland', 'seine', 'neither']);
  });

  it('a lost hosting burns the fort', () => {
    let s = lord(841, 'dublin');
    s.places.dublin!.norse = true;
    open(s, 'ir_hosting_lost', content);
    s = act(content, s, { t: 'choose', id: 'go' });
    expect(norseHeld(s, 'dublin')).toBe(false);
  });

  it('Forannán of Armagh can be bought from the Luimnech men, and is worth his price', () => {
    let s = lord(845, 'dublin');
    s.silver = 500;
    open(s, 'ir_845', content);
    s = act(content, s, { t: 'choose', id: 'buy' });
    const h = hostagesOf(s)[0]!;
    expect(h.name).toBe('Forannán');
    expect(h.price).toBe(1200);
    expect(h.who).toContain('Armagh');
  });
});

describe('the Seine', () => {
  it('Rouen in 841 is a host battle that goes on to the plunder', () => {
    let s = lord(841, 'rouen');
    s.crew.men = 30;
    open(s, 'sn_rouen', content);
    s = act(content, s, { t: 'choose', id: 'line' });
    expect(s.flags.sn_841_sworn).toBe(1);
    const pd = s.pending as Pending | null;
    expect(pd?.t === 'battle' && !!pd.battle.host).toBe(true);
  });

  it('the seven thousand pounds are shared by the ship', () => {
    let s = lord(845, 'paris');
    s.ships = [s.ships[0]!, { id: 'b', type: 'karvi', name: 'Gull', hull: 100 }];
    s.loot = 0;
    open(s, 'sn_danegeld', content);
    s = act(content, s, { t: 'choose', id: 'share' });
    expect(s.loot).toBe(3200);
    expect(s.queue.some((q) => q.scene === 'sn_flux')).toBe(true);
  });
});

describe('the third batch of places', () => {
  const NEW = ['jarrow', 'whitby', 'gipeswic', 'hamwic', 'applecross', 'tarbat', 'whithorn', 'alt_clut', 'linn_duachaill', 'rechru', 'glendalough', 'cork', 'skellig', 'jumieges', 'fontenelle', 'saint_denis', 'rouen', 'paris'];
  it('are active, on a sea road, heard of, and each has an arrival scene', () => {
    for (const id of NEW) {
      expect(content.places[id]!.active, id).toBe(true);
      expect(content.legs.some((l) => (l.a === id || l.b === id) && !l.expedition), id).toBe(true);
      expect(Object.values(content.places).some((p) => p.id !== id && (p.tells?.includes(id) || p.rumours?.includes(id))), id).toBe(true);
      expect(Object.values(content.scenes).some((s) => s.kind === 'place' && s.at?.includes(id)), id).toBe(true);
    }
  });
});
