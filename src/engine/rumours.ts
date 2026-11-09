// Spring rumours (Josh, 2026-11-09: "maybe some news every spring about rumours of what may happen that year").
// At the turn of the year he hears what the beaches are saying about the summer ahead: the annals' events still to
// come, the legends who will be out, the great fleets gathering, and the people round his forts who mean to have them
// back. Rumours, not prophecy: a legend's summer may come to nothing, and the beaches name a coast, not a church.
import type { ContentBundle } from '../content/schema';
import type { GameState } from './state';
import { dateOf, dayOf } from './calendar';
import { test } from './conditions';
import { activeRaider } from './chronicle';
import { fortRisk } from './land';

/** The most rumours a spring brings: the annals first, then the fleets, the legends and the forts. */
export const RUMOURS = { max: 5, fortRisk: 0.2 } as const;

function lowerThe(s: string): string {
  return s.replace(/^The /, 'the ');
}

function regions(content: ContentBundle, ids: string[]): string {
  const rs = [...new Set(ids.map((id) => content.places[id]?.region).filter((r): r is string => !!r))].map((r) => lowerThe(r));
  return rs.length <= 1 ? (rs[0] ?? 'the coasts') : `${rs.slice(0, -1).join(', ')} or ${rs[rs.length - 1]}`;
}

/** What men say this spring about the year ahead. Kept on the state for the Saga tab, and told at the turn of the year. */
export function springRumours(state: GameState, content: ContentBundle): string[] {
  const year = dateOf(state.day).year;
  const out: string[] = [];
  const done = new Set(state.chron?.done ?? []);
  // the annals: what is coming this year, unless he has already made it his own
  const events = Object.values(content.chronicle.events)
    .filter((e) => e.year === year && !done.has(e.id) && dayOf(e.year, e.doy) > state.day && !(e.unless && test(e.unless, state, content)))
    .sort((a, b) => a.doy - b.doy);
  for (const e of events) {
    if (e.rumour) out.push(e.rumour.trim());
    else if (e.places?.length && !e.norse) out.push(`Men say ${lowerThe(e.by)} mean to be out this summer, toward ${regions(content, e.places)}.`);
  }
  // the great fleets that will gather this year
  for (const f of Object.values(content.fleets)) {
    const first = f.course?.[0];
    if (!first || first.from[0] !== year || f.id === 'own') continue;
    out.push(`Word is that ${f.leader} will take a fleet out this year. ${f.desc}`);
  }
  // the legends who will raid their own waters, if they live and have the ships
  for (const r of Object.values(content.chronicle.raiders)) {
    if (!activeRaider(content, r, year)) continue;
    if (!r.places.some((id) => state.known.includes(id))) continue;
    out.push(`${r.by.charAt(0).toUpperCase()}${r.by.slice(1)} will be out again, they say, somewhere about ${regions(content, r.places)}.`);
  }
  // his forts: the people round about, who mean to have them back before another winter
  for (const h of state.holdings ?? []) {
    if (h.kind !== 'fort') continue;
    const p = fortRisk(state, content, h);
    if (p < RUMOURS.fortRisk) continue;
    const name = content.places[h.place]!.name;
    out.push(`At ${name}, the people round the fort are saying they will have it back before another winter is out.${h.warden ? '' : ' A fort with more men in it, or a warden to keep its walls, would give them less to say.'}`);
  }
  return out.slice(0, RUMOURS.max);
}
