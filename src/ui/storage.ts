// Saves in localStorage. The key is a contract with saves already on players' devices:
// do not rename it without a migration (game-building skill, failure mode #6).
import type { ContentBundle } from '../content/schema';
import type { GameState } from '../engine/state';
import { fromSave, toSave } from '../engine/save';

export const SAVE_KEY = 'vikingr.save.1';

export function saveGame(state: GameState, content: ContentBundle): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(toSave(state, content)));
  } catch {
    /* storage full or blocked: the game goes on, unsaved */
  }
}

export function loadGame(content: ContentBundle): { state: GameState; warnings: string[] } | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return fromSave(JSON.parse(raw), content);
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* nothing to clear */
  }
}
