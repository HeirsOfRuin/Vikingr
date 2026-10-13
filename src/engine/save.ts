// Save format with a version field and a migration chain.
import type { ContentBundle } from '../content/schema';
import type { GameState } from './state';
import { kitFromFlags } from './items';

export const SAVE_FORMAT = 'vikingr-save';
export const SAVE_VERSION = 1;

export interface SaveFile {
  format: typeof SAVE_FORMAT;
  saveVersion: number;
  contentHash: string;
  state: GameState;
}

export class SaveError extends Error {}

/** fromVersion -> function producing the next version's save. */
export const migrations: Record<number, (save: SaveFile) => SaveFile> = {};

export function toSave(state: GameState, content: ContentBundle): SaveFile {
  return { format: SAVE_FORMAT, saveVersion: SAVE_VERSION, contentHash: content.hash, state };
}

export interface LoadResult {
  state: GameState;
  warnings: string[];
}

export function fromSave(raw: unknown, content: ContentBundle): LoadResult {
  const warnings: string[] = [];
  if (!raw || typeof raw !== 'object' || (raw as SaveFile).format !== SAVE_FORMAT) throw new SaveError('not a Vikingr save');
  let save = raw as SaveFile;
  if (typeof save.saveVersion !== 'number' || save.saveVersion > SAVE_VERSION) throw new SaveError(`unsupported save version ${save.saveVersion}`);
  while (save.saveVersion < SAVE_VERSION) {
    const m = migrations[save.saveVersion];
    if (!m) throw new SaveError(`no migration from save version ${save.saveVersion}`);
    save = m(save);
  }
  const state = structuredClone(save.state);
  // content may have changed since the save was written
  if (state.pending?.t === 'scene' && !content.scenes[state.pending.id]) {
    warnings.push('The scene you saved in no longer exists. It has been skipped.');
    state.pending = null;
  }
  state.queue = state.queue.filter((q) => !!content.scenes[q.scene]);
  state.rumoured ??= [];
  state.crew.gear ??= 0;
  kitFromFlags(state, content, state.hero.background);
  for (const id of Object.keys(content.places)) {
    const p = content.places[id]!;
    state.places[id] ??= { wealth: p.raid?.wealth ?? 0, defence: 1, raided: 0, lastRaided: null };
  }
  if (save.contentHash !== content.hash) warnings.push('The game content has been updated since this save was made.');
  return { state, warnings };
}
