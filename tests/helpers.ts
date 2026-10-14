import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent } from '../tools/content-loader';
import type { MapData } from '../src/engine/mapgrid';
import type { GameState } from '../src/engine/state';
import { newGame } from '../src/engine/index';

export const content = loadContent();
export const map = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'src', 'content', 'map.json'), 'utf8')) as MapData;

/** The old Phase 1 sandbox: a captain with a borrowed karvi and four sworn men, outside the written story.
 *  Every beginning now starts at another man's oar (docs/FRAME-BEGINNINGS.md); systems tests start here. */
export function sandboxGame(seed: number, name = 'Ari'): GameState {
  const s = newGame(content, { background: 'freedman', seed, name });
  s.pending = null;
  s.service = null;
  s.ships = [{ id: 'borrowed', type: 'karvi', name: "The jarl's old karvi", hull: 80 }];
  s.crew.men = 20;
  for (const m of s.men) m.sworn = true;
  s.flags.placeholder_start = 1;
  s.flags.owes_jarl = 1;
  return s;
}
