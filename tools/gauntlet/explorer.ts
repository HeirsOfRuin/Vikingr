// The explorer (docs/FRAME-GAUNTLET.md, check 2): a bot that goes where no life has gone. It tries the least-tried
// choice in every scene, and sails to the least-visited places; for everything else it plays like a raider.
import type { ContentBundle } from '../../src/content/schema';
import type { GameState } from '../../src/engine/state';
import { listActions, type Action } from '../../src/engine/index';
import type { RngCursor } from '../../src/engine/rng';
import { Bot } from '../bot-lib';

export class Coverage {
  choices = new Map<string, number>();
  places = new Map<string, number>();
  bump(m: Map<string, number>, k: string): void { m.set(k, (m.get(k) ?? 0) + 1); }
}

export class Explorer {
  private inner: Bot;
  constructor(private cov: Coverage, private rng: RngCursor) { this.inner = new Bot('raider', rng); }
  choose(state: GameState, content: ContentBundle): Action | null {
    const opts = listActions(state, content).filter((o) => o.enabled);
    if (state.pending?.t === 'scene') {
      const id = state.pending.id;
      const ch = opts.filter((o) => o.action.t === 'choose');
      if (ch.length) {
        const n = (o: (typeof ch)[number]) => this.cov.choices.get(`${id}/${(o.action as { id: string }).id}`) ?? 0;
        const least = Math.min(...ch.map(n));
        const pick = ch.filter((o) => n(o) === least);
        const a = pick[this.rng.int(pick.length)]!.action;
        this.cov.bump(this.cov.choices, `${id}/${(a as { id: string }).id}`);
        return a;
      }
    }
    if (!state.pending && state.at && state.phase === 'sailing' && this.rng.float() < 0.3) {
      const roads = opts.filter((o) => o.action.t === 'sail' || o.action.t === 'expedition');
      if (roads.length) {
        const to = (o: (typeof roads)[number]) => (o.action as { to: string }).to;
        roads.sort((a, b) => (this.cov.places.get(to(a)) ?? 0) - (this.cov.places.get(to(b)) ?? 0));
        this.cov.bump(this.cov.places, to(roads[0]!));
        return roads[0]!.action;
      }
    }
    return this.inner.choose(state, content);
  }
}
