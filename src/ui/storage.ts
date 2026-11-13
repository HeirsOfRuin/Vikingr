// Saves in localStorage. The key is a contract with saves already on players' devices:
// do not rename it without a migration (game-building skill, failure mode #6).
import type { ContentBundle } from '../content/schema';
import type { GameState } from '../engine/state';
import { fromSave, toSave } from '../engine/save';

export const SAVE_KEY = 'vikingr.save.1';

let works: boolean | null = null;
/** Whether this browser keeps anything here (a private window, a blocked frame, or storage turned off: it doesn't). */
export function storageWorks(): boolean {
  if (works !== null) return works;
  try {
    const k = 'vikingr.probe';
    localStorage.setItem(k, '1');
    works = localStorage.getItem(k) === '1';
    localStorage.removeItem(k);
  } catch {
    works = false;
  }
  return works;
}

/** Saves the life. False if this browser would not keep it. */
export function saveGame(state: GameState, content: ContentBundle): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(toSave(state, content)));
    return true;
  } catch {
    /* storage full or blocked: the game goes on, unsaved, and says so */
    return false;
  }
}

/** A save whose shape the game can draw: the arrays and objects every screen reads. */
function sound(s: unknown): s is GameState {
  const g = s as Record<string, unknown> | null;
  if (!g || typeof g !== 'object') return false;
  const obj = (k: string) => !!g[k] && typeof g[k] === 'object' && !Array.isArray(g[k]);
  const arr = (k: string) => Array.isArray(g[k]);
  return obj('hero') && obj('flags') && obj('crew') && obj('places') && obj('base') && arr('deeds') && arr('journal') && arr('boasts') && arr('men') && arr('ships') && arr('known')
    && typeof g.day === 'number' && (g.pending === null || g.pending === undefined || typeof g.pending === 'object') && (g.death === null || g.death === undefined || typeof g.death === 'object');
}

export function loadGame(content: ContentBundle): { state: GameState; warnings: string[] } | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const l = fromSave(JSON.parse(raw), content);
    return sound(l.state) ? l : null;
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
