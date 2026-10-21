// Ragnarr's days (docs/FRAME-LINEAGE.md D): a life begun in the spring of 843. Thirteen years of the chronicle are
// run first, on the same engine, so the world has moved on before the first scene: Dorestad stripped, the ship-forts
// in Ireland, Turgeis at his height. The early chapters count as past. The boy heard the news by the fire.
import type { ContentBundle } from '../content/schema';
import type { GameState } from './state';
import { dayOf } from './calendar';
import { MUSTER_DOY } from './tuning';
import { tickChronicle } from './chronicle';

export const ERA843 = { year: 843, born: 827, firstYear: 830, chapters: ['830', '831', '833'], linesPerYear: 1 } as const;

export function startIn843(state: GameState, content: ContentBundle, bg: string): void {
  const lines: string[] = [];
  for (let y = ERA843.firstYear; y < ERA843.year; y++) {
    state.day = dayOf(y, 364);
    tickChronicle(state, content);
    const heard = (state.chron?.news ?? []).filter((n) => !n.heard);
    for (const n of heard) n.heard = true;
    const big = heard.filter((n) => n.big).slice(0, ERA843.linesPerYear);
    if (big.length) lines.push(`${y}, when you were ${y - ERA843.born}: ${big.map((n) => n.text.split(/(?<=\.)\s/)[0]).join(' ')}`);
    // the places mend between raids, as they do in his own years
    for (const [id, ps] of Object.entries(state.places)) {
      const base = content.places[id]?.raid?.wealth ?? 0;
      ps.wealth = Math.min(base, Math.round(ps.wealth + base * 0.15));
      ps.defence = 1 + (ps.defence - 1) * 0.6;
    }
    // 841: the Norse winter in Ireland, in ship-forts (season.ts does this at the turn of a played year)
    if (y >= 841 && !state.flags._lp841) {
      state.flags._lp841 = 1;
      for (const id of ['dublin', 'linn_duachaill']) if (state.places[id]) { state.places[id]!.norse = true; state.places[id]!.standing = Math.max(state.places[id]!.standing ?? 0, 4); }
    }
  }
  state.day = dayOf(ERA843.year, MUSTER_DOY);
  state.fedTo = state.day;
  state.hero.born = ERA843.born;
  // the early chapters are past: their scenes never open in this life
  for (const ch of ERA843.chapters) for (const id of content.chapters[ch] ?? []) state.seen[id] = state.day;
  state.flags.era843 = 1;
  // Eystein died in 834; his son Eiríkr holds the high seat
  state.flags.fr_jarl_eirik = 1;
  state.flags.fr_eystein_dead = 1;
  state.flags._winter = ERA843.year - 1;
  // an outlaw can't stand on the beach in Hordaland: the Vestfold ships pick men up at Kormt
  if (bg === 'outlaw') state.at = 'karmoy';
  state.journal = state.journal.filter(() => false);
  state.pending = { t: 'report', title: 'Spring, 843', lines: ['What you heard by the fire, growing up:', ...lines], next: 'e43_boyhood', art: 'home_fjord' };
}
