// The skald (playtest 8): a poet in his household. At home, he makes the feasts in his hall tell better. Aboard, he
// sees the deeds done and makes them verse on the spot, so they weigh more; but a skald aboard can die when a fight
// goes badly. Either way, when the hero dies, his skald makes the death-song, and it lasts. He expects his gifts each
// year, or he goes to a lord who gives them.
import type { Deed, GameState } from './state';
import { journal } from './journal';
import { formatSilver } from './format';
import { shiftFavour } from './allies';

export const SKALD = {
  /** Deeds done with the skald aboard to see them. */
  aboardDeed: 1.25,
  /** A feast in his own hall, with the skald at home to tell it. */
  hallFeast: 0.15,
  /** His gifts, a year. */
  wage: 24,
  /** The chance he falls when a fight is lost with him aboard. */
  diesOnRout: 0.3,
  /** The death-song: its weight, as a verse (lasting). */
  deathSong: 10,
  /** What hiring a wandering skald costs. */
  hire: 48,
  /** Left at home for the summer, he sings at the jarl's benches: favour at the turn of the year. */
  homeFavour: 1,
} as const;

export interface SkaldState {
  name: string;
  aboard: boolean;
  since: number;
}

/** His skald, if he keeps one. A save from before skalds had names gets one. */
export function skaldOf(state: GameState): SkaldState | null {
  if (!state.flags.skald) return null;
  return (state.skald ??= { name: state.flags.o_kalfr ? 'Kálfr' : 'Bragi', aboard: false, since: state.day });
}

export function skaldAboard(state: GameState): boolean {
  const s = skaldOf(state);
  return !!s?.aboard && !state.service && state.ships.length > 0;
}

export function hireSkald(state: GameState, name: string): void {
  state.flags.skald = 1;
  state.skald = { name, aboard: false, since: state.day };
  journal(state, `${name} the skald joined your household.`);
}

export function loseSkald(state: GameState, why: string): string {
  const s = skaldOf(state);
  delete state.flags.skald;
  delete state.skald;
  if (s) journal(state, `${s.name} the skald ${why}.`);
  return s ? `${s.name} the skald ${why}.` : '';
}

/** The turn of the year: his gifts, or he goes. */
export function skaldYear(state: GameState): string[] {
  const s = skaldOf(state);
  if (!s) return [];
  if (state.silver >= SKALD.wage) {
    state.silver -= SKALD.wage;
    const out = [`${s.name} the skald has his Yule gifts from you, ${formatSilver(SKALD.wage)}, and makes a verse about your open hand.`];
    // left at home, he spent the summer in the jarl's hall with your name in his mouth
    if (!s.aboard && !state.service && (state.homeAt ?? 'home_fjord') === 'home_fjord') {
      shiftFavour(state, SKALD.homeFavour);
      out.push(`He spent the summer at the jarl's benches, and your name was in every verse. The jarl thinks the better of you for it.`);
    }
    return out;
  }
  return [loseSkald(state, 'has had no gifts from you this year, and has gone to a lord who gives them')];
}

/** A lost fight with him aboard: he may not come out of it. */
export function skaldRout(state: GameState, roll: () => number): string | null {
  if (!skaldAboard(state) || roll() >= SKALD.diesOnRout) return null;
  return loseSkald(state, 'fell in the rout, with a verse half made');
}

/** His death-song: the skald makes the last verse, and it lasts. Returns the line, or null with no skald. */
export function deathSong(state: GameState): Deed | null {
  const s = skaldOf(state);
  if (!s) return null;
  const deed: Deed = { n: state.deeds.length + 1, type: 'death_song', day: state.day, place: state.at, text: `${s.name} made the death-song for ${state.hero.name.split(' ')[0]}`, weight: SKALD.deathSong, witnesses: 0, told: state.day, verse: true };
  state.deeds.push(deed);
  return deed;
}

/** A deed done where he can see it: aboard, away from home. */
export function skaldSees(state: GameState): boolean {
  return skaldAboard(state) && state.at !== (state.homeAt ?? 'home_fjord');
}
