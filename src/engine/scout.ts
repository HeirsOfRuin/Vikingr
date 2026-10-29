// Scouting a force before a raid (docs/FRAME-WORLD.md §A). One roll fixes the numbers the raid will meet;
// the scouts' report shows them, and the raid uses them. Nothing here is a second formula.
import type { ContentBundle, PlaceKind, Resolve } from '../content/schema';
import type { GameState } from './state';
import type { RngCursor } from './rng';
import { dateOf } from './calendar';
import { checkP, learn } from './hero';
import { fightRngFor, freshScout, raidMen, SCOUT, surpriseChance, veteranChance } from './fights';
import { aliveMen } from './crew';
import { plural } from './format';
import { sackedBy } from './chronicle';

/** How hard a place is to look at unseen. */
export const SCOUT_DIFFICULTY: Record<PlaceKind, number> = { monastery: 1, island: 2, landmark: 2, hall: 3, market: 3, town: 3, home: 9 };

export function scoutDifficulty(state: GameState, content: ContentBundle, id: string): number {
  const ps = state.places[id];
  // raided within the year: they are watching the sea
  const last = Math.max(ps?.lastRaided ?? -9999, ps?.sacked?.day ?? -9999);
  const watched = state.day - last <= 365 ? 1 : 0;
  return SCOUT_DIFFICULTY[content.places[id]!.kind] + watched;
}

export function scoutChance(state: GameState, content: ContentBundle, id: string): number {
  return checkP(state, content, { skill: 'cunning', attr: 'wit', difficulty: scoutDifficulty(state, content, id) });
}

/** He has already sent men up to look at this place this summer. */
export function scoutedThisYear(state: GameState, id: string): boolean {
  const s = state.places[id]?.scout;
  return !!s && dateOf(s.day).year === dateOf(state.day).year;
}

export const RESOLVE_WORDS: Record<Resolve, string> = {
  levy: 'a farmers\' levy. They will break early, and run if their leader falls',
  warriors: 'fighting men. They will hold a while',
  hird: 'a lord\'s sworn men. They will die where they stand',
};

export function foeResolve(content: ContentBundle, foeId: string): Resolve {
  const f = content.foes[foeId]!;
  return f.resolve ?? (f.quality < 1 ? 'levy' : f.quality >= 2 ? 'hird' : 'warriors');
}

/** What a raid here would meet, as the scouts counted it: asleep, awake, and the chance of catching them asleep. */
export function scoutedOdds(state: GameState, content: ContentBundle, id: string): { asleep: number; awake: number; p: number } | null {
  const sc = freshScout(state, id);
  if (!sc?.ok || sc.roll === undefined) return null;
  return { asleep: raidMen(state, content, id, true, sc.roll), awake: raidMen(state, content, id, false, sc.roll), p: surpriseChance(state, content, id) };
}

/** How the place's wealth looks, and why. */
export function wealthWords(state: GameState, content: ContentBundle, id: string): string {
  const base = content.places[id]!.raid?.wealth ?? 0;
  const ps = state.places[id]!;
  const r = base ? ps.wealth / base : 0;
  const by = sackedBy(state, content, id);
  const why = by ? ` ${by}` : ps.raided && ps.lastRaided !== null ? ' You know why: you were here yourself.' : '';
  if (r >= 0.85) return 'It is rich. Nobody has touched it in years.';
  if (r >= 0.5) return `It has been picked over, but there is silver still.${why}`;
  return `It has been stripped. There is little left worth the walk.${why}`;
}

/** Send men up to look. A day; cunning and wits against the place. */
export function scoutPlace(state: GameState, content: ContentBundle, rng: RngCursor, id: string): string[] {
  const p = content.places[id]!;
  const ps = state.places[id]!;
  const ok = rng.float() < scoutChance(state, content, id);
  learn(state, 'cunning', ok ? 2 : 3);
  state.day += 1;
  const lines: string[] = [];
  if (!ok) {
    ps.scout = { day: state.day, ok: false };
    ps.defence += SCOUT.warnDefence;
    const lost = rng.float() < SCOUT.lostMan && state.crew.men > 6;
    if (lost) state.crew.men -= 1;
    lines.push(`A dog barks, and then every dog in ${p.name}. Your men come back down to the ships at a run, and by the time they are aboard there are torches on the walls and men who were not there yesterday.`);
    if (lost) lines.push('One of them does not come back. Nobody saw what happened to him.');
    lines.push(`They know you are here. Your chance of catching them asleep is down to about ${Math.round(surpriseChance(state, content, id) * 10)} in 10.`);
    return lines;
  }
  // the raid's roll, fixed now: what they count is what you will meet
  const r = fightRngFor(state, `scout:${id}`);
  ps.scout = { day: state.day, ok: true, roll: r.float(), picked: r.float() < veteranChance(state) };
  const odds = scoutedOdds(state, content, id)!;
  const foe = content.foes[p.raid!.foe]!;
  const ours = state.crew.men + aliveMen(state).filter((m) => m.hurtUntil === null || m.hurtUntil <= state.day).length;
  lines.push(`Your men go up in the dark and come back before dawn, wet to the waist and pleased with themselves. They counted the houses, the boats, the spears by the doors and the men on the walls.`);
  lines.push(`${foe.name}: ${RESOLVE_WORDS[foeResolve(content, foe.id)]}.${foe.leader ? ` ${foe.leader.charAt(0).toUpperCase()}${foe.leader.slice(1)} holds them together.` : ''}`);
  if (ps.scout.picked) lines.push('And they have heard of you. Some of the men on the walls are picked men, brought in because your name came ahead of you.');
  lines.push(`Catch them asleep, and about ${odds.asleep} will stand against you. If they see your sails, about ${odds.awake}. ${ours ? `You have ${plural(ours, 'man', 'men')}.` : 'You have nobody at the oars to take against them.'}`);
  lines.push(`Your chance of catching them asleep: about ${Math.round(odds.p * 10)} in 10.`);
  lines.push(wealthWords(state, content, id));
  if (ps.defence > 1.15) lines.push('They are still on edge from the last raid. There are more men on the walls than a place this size should keep.');
  lines.push(`What they saw holds for ${SCOUT.freshDays} days. After that, the place will have changed.`);
  return lines;
}
