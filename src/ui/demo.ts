// The free demo (VITE_DEMO=1, `npm run build:demo`): the full game with two limits.
//  - Only Horik's days (830) can be begun; the later eras are shown, marked as the full game's.
//  - On 1 March 832, when the spring muster opens, play stops. The life is kept: the end screen gives
//    its save code, and the full game loads that code and goes on from the same morning.
// Two summers is the length the author chose (2026-11-20): 830 on another man's bench, and 831 with
// the first chance of a ship of your own. The muster of 832 is a door, not an ending.
import { dayOf } from '../engine/calendar';

export const DEMO_END_DAY = dayOf(832, 59); // 1 March 832

/** The game's itch page on the account (renamed from edmodo1 to Heirs of Ruin, 2026-11-21): the demo's end screen,
 *  the title and the rating ask all link here. The one place the address is written. */
export const FULL_GAME_URL = 'https://heirs-of-ruin.itch.io/vikingr';

export const demoOver = (day: number): boolean => __DEMO__ && day >= DEMO_END_DAY;
