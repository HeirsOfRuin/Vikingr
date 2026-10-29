# The gauntlet: a playtest tool that tests everything it can (October 2026)

Josh approved this on 2026-10-29.

**The problem:** the bugs that cost his playtests were ones no existing tool looked for:
- a scene in the wrong season;
- a text that promised two pounds and paid one;
- goods that never showed;
- a fight designed to fail;
- saves that would not load;
- an expedition impossible from abroad.

**The idea:** one command plays thousands of lives in every way we can describe, checks everything it can at every step, and writes one report: what broke, where, and a save code that lands you exactly there.

## The eight checks
1. **Invariants on every step:**
   - the date only moves forward;
   - phase and season agree;
   - no negative or broken numbers;
   - ships, cargo and men within bounds;
   - no dead man in a role;
   - the open scene exists;
   - text renders clean.
2. **Explorer bot.** It seeks the choices and places no life has tried yet. It reports reach per scene, with a repro for each first sighting and the blocking condition for scenes never reached.
3. **Chaos and save fuzz.** Random legal actions, with save → load round-trips during the life; every reload must equal the life before it. It also catches dead ends, softlocks, crashes, and untested era × background combinations.
4. **Promise checker.** Numbers and goods named in a result's text, compared with what its effects actually did.
5. **Fight fairness.** Every fight in the content, run many times from the states players reach it in, with its win rate flagged when it is outside 10–95% and not tagged as meant to be.
6. **Phone UI sweep.** The real build, driven at 390 px through recorded lives, checking:
   - overflow;
   - tap targets;
   - clipped text;
   - console errors.
   A contact sheet of screenshots comes with it.
7. **Persona dashboard.** Trader, settler, family man, explorer and East-road bots beside the existing ones; per-system numbers, compared with the last run.
8. **Golden lives.** Fixed seeds replayed on every change, with outcome diffs.

**Output:** one HTML report (green, amber, red per area). Every problem comes with a save code, and the report ends with a short playtest script: the least-tested and most-changed places, each with a save code to jump to.

## Phases
| Phase | Checks | Size |
|---|---|---|
| 1 | Invariants, chaos and save fuzz, explorer and coverage with repro codes | About a day |
| 2 | Promise checker, fight fairness, persona dashboard | About a day |
| 3 | Phone UI sweep, golden lives, the HTML report and playtest script | About a day |

**Run time:**
- the full run, about 20–30 minutes;
- a fast mode, about 3 minutes, which joins `npm run check`.

## Limits
It cannot judge fun, pacing or writing. Those stay with the human playtest; the report's playtest script points that playtest at the riskiest places.
