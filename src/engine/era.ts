// Later starts (docs/FRAME-LINEAGE.md D, docs/FRAME-865.md). The chronicle is run up to the start first, on the
// same engine, so the world has moved on before the first scene. The earlier chapters count as past. The boy
// heard the news by the fire.
//   843, Ragnarr's days: Dorestad stripped, the ship-forts in Ireland, Turgeis at his height, Rouen burned in 841.
//   865, the Great Army: Paris paid off, the Loire Northmen long settled, the sons of Ragnarr gathering for England.
import type { ContentBundle } from '../content/schema';
import type { GameState } from './state';
import { dayOf } from './calendar';
import { MUSTER_DOY } from './tuning';
import { tickChronicle } from './chronicle';

export type Era = 830 | 843 | 865;

export const ERAS = {
  843: { year: 843, born: 827, firstYear: 830, chapters: ['830', '831', '833'], linesPerYear: 1, maxLines: 13, start: 'e43_boyhood', flags: ['era843'] },
  865: { year: 865, born: 849, firstYear: 830, chapters: ['830', '831', '833', '843'], linesPerYear: 1, maxLines: 11, start: 'e65_boyhood', flags: ['era843', 'era865'] },
} as const;
/** Kept for the tools that name it. */
export const ERA843 = ERAS[843];

/** What history did on its own by `y`: the Norse winter in Ireland from 841, and on the Loire from 844. */
function historyBy(state: GameState, y: number): void {
  if (y >= 841 && !state.flags._lp841) {
    state.flags._lp841 = 1;
    for (const id of ['dublin', 'linn_duachaill']) if (state.places[id]) { state.places[id]!.norse = true; state.places[id]!.standing = Math.max(state.places[id]!.standing ?? 0, 4); }
  }
  if (y >= 844 && !state.flags._lp843 && state.places.noirmoutier) {
    state.flags._lp843 = 1;
    state.places.noirmoutier.norse = true;
    state.places.noirmoutier.standing = Math.max(state.places.noirmoutier.standing ?? 0, 4);
  }
}

export function startInEra(state: GameState, content: ContentBundle, bg: string, era: 843 | 865): void {
  const E = ERAS[era];
  const lines: string[] = [];
  for (let y = E.firstYear; y < E.year; y++) {
    state.day = dayOf(y, 364);
    tickChronicle(state, content);
    const heard = (state.chron?.news ?? []).filter((n) => !n.heard);
    for (const n of heard) n.heard = true;
    const big = heard.filter((n) => n.big).slice(0, E.linesPerYear);
    // a boy remembers from five or so; before that it is his father's news, not his
    if (big.length && y - E.born >= 5) lines.push(`${y}, when you were ${y - E.born}: ${big.map((n) => n.text.split(/(?<=\.)\s/)[0]).join(' ')}`);
    // the places mend between raids, as they do in his own years
    for (const [id, ps] of Object.entries(state.places)) {
      const base = content.places[id]?.raid?.wealth ?? 0;
      ps.wealth = Math.min(base, Math.round(ps.wealth + base * 0.15));
      ps.defence = 1 + (ps.defence - 1) * 0.6;
    }
    historyBy(state, y);
  }
  state.day = dayOf(E.year, MUSTER_DOY);
  state.fedTo = state.day;
  state.hero.born = E.born;
  // the early chapters are past: their scenes never open in this life
  for (const ch of E.chapters) for (const id of content.chapters[ch] ?? []) state.seen[id] = state.day;
  for (const f of E.flags) state.flags[f] = 1;
  // Eystein died in 834; his son Eiríkr holds the high seat
  state.flags.fr_jarl_eirik = 1;
  state.flags.fr_eystein_dead = 1;
  state.flags._winter = E.year - 1;
  // an outlaw can't stand on the beach in Hordaland: the ships pick men up at Kormt
  if (bg === 'outlaw') state.at = 'karmoy';
  state.journal = state.journal.filter(() => false);
  state.pending = { t: 'report', title: `Spring, ${E.year}`, lines: ['What you heard by the fire, growing up:', ...lines.slice(-E.maxLines)], next: E.start, art: 'home_fjord' };
}

/** The 843 start, by its old name. */
export function startIn843(state: GameState, content: ContentBundle, bg: string): void {
  startInEra(state, content, bg, 843);
}
