// The journal: what happened, dated. The UI shows it; the saga is built from deeds, not from this.
import type { GameState } from './state';

export function journal(state: GameState, text: string): void {
  state.journal.push({ day: state.day, text });
}
