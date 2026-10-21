# Frame: pacing (the long middle drags)

Josh sent a save (Ragnavald Leysingsson, the freedman's son, Skye, 26 July 834). His words: "Analyze and reveal how much gameplay I have yet to uncover. If there is a lot, I feel we may be making it drag too much."

## Where he is
- **4.5 years in.** He has seen 136 of the game's 368 scenes.
- **About 85 of the unseen scenes he can never see in this life:** they belong to other beginnings (the outlaw, the younger son's boyhood) or to branches he didn't take.
- **What is still ahead in this life:** roughly 70–80 new scenes, spread over 16 more years (to 851).

## The measurement (`npm run measure:pace`, 30 freedman raider lives, 830–850)

| Year | Taps a year | New scenes a year | Taps per new scene |
|---|---|---|---|
| 830 | 86 | 29.7 | 3 |
| 831 | 76 | 16.7 | 5 |
| 832 | 82 | 11.6 | 7 |
| 833 | 210 | 20.4 | 10 |
| 834 | 249 | 17.4 | 14 |
| 835 | 280 | 12.0 | 23 |
| 836 | 292 | 7.3 | 40 |
| 838 | 301 | 5.0 | 60 |
| 840 | 337 | 4.2 | 80 |
| 844 | 314 | 2.6 | 121 |
| 848 | 399 | 1.6 | 249 |
| 850 | 448 | 0.9 | 498 |

"Taps a year" counts every action: sail, continue, buy, fight orders, and so on.

**Two curves cross, and the game gets heavier as it gets emptier.**
- **Taps a year triple once he has his own fleet** (833 onward), and keep rising: sea legs go from about 7 a year to 20–35.
- **New scenes a year fall by 90%** from 834 to 850. The written story is dense to 835, then thins to one dated beat every year or two.

**What is dated ahead of him:**

| Year | Dated beat |
|---|---|
| 834 | Dorestad (still open: he must reach it by the end of August) |
| 835 | The road from here |
| 837 | The Liffey fleets |
| 839 | Lough Neagh |
| 840 | Ragnarr |
| 841 | The two fleets, the Dublin fort, Rouen, Rorik |
| 843 | Nantes, Hastein |
| 845 | Paris, Turgeis drowned |
| 846–851 | Harek's and the jarl's deaths open seats |

**836, 838, 842, 844 and 847–849 have nothing dated in them.**

**The cost to finish this life:** about 5,500 taps from here to 851, for about 75 new scenes. At 4 seconds a tap that's about 6 hours, most of it sailing legs between ports he has seen. The first 4.5 years took about 600 taps.

**Verdict: yes, it drags.** The content is not thin. The problem is that the time between new things grows tenfold while the taps per year triple.

## Options
1. **Fewer taps per year, no content lost.**
   - **Set a course:** one tap sails to any known port by the shortest road, stopping only when something happens. Arrival reports appear only when there's news, a scene or a choice.
   - **Target:** sea legs from 20–35 taps a year to about 6.
2. **Let a quiet year pass.**
   - **When it's offered:** at the spring muster, when no dated beat is due that year.
   - **What it does:** the summer is played for you from standing orders (raid where, how bold, trade or not, winter where). The same engine runs it: the same fights, losses, plunder, fame and deaths. You get a summary card.
   - **The cost:** 3–5 taps instead of 300. Any scene that fires in the run still stops for you.
   - **The spring card names what is ahead this year,** so you know which summers to play in full.
3. **More content for the empty years.** About 12 dated beats and 30 scenes for 836–850. It fills the gaps but doesn't fix the tap count. Expensive. Later, if wanted.
4. **Shorten the life.** End the saga at 845 or at a seat taken. Cuts the long tail, and with it the rule ambition you asked for. Not recommended.

## Recommendation
**1 and 2 together.** Expected effect: the rest of a life goes from about 5,500 taps to about 1,500, roughly 6 hours down to under 2, with every new scene still played in full.

Measure with `measure:pace` before and after. The target: no year after 835 above 40 taps per new scene for a player who skips quiet years.

## Decisions needed
- Approve 1 + 2?
- **Quiet years:** should the auto-played summer be allowed to kill the hero? Recommended: yes, as the same fights would. Otherwise it's a safe skip, and players would skip everything.

---

## Josh's answers (playtest 6)
- **On options 1 and 2:** "1. Yes. 2. Yes, but I want to be careful it isn't just a tap to simulate the year and suddenly you're dead. There's no investment."
- **The end of a fight:** "Battles and duels immediately switch to the after-battle screen (looting, etc.) once the winning blow is struck, and it can be disorienting."
- **Region raiding:** "The ports feel few and too many at once. What if we looked at a region raiding mechanic where you could set to raiding a specific region/coastline under certain settings for a set amount of days, aiming for a certain ratio of loot and captives? Then visit specific ports afterwards."

His region idea and option 2 are the same machinery, so they are built as one: **going a-viking along a coast on standing orders.** A quiet summer is a coast raid with "the rest of the summer" and "sail home afterwards".

## Built

**1. The end of a fight.** The last blow lands and the field stays on screen, with the outcome in a box at the top ("They break. The field is yours."). Continue goes on to the plunder or the report. The same applies to single combat.

**2. Set a course.**
- Tap any known port on the Map: "Set a course for X". It sails by the shortest known road, leg by leg, through the same voyage engine.
- It stops for anything that happens: a scene, a fight, a storm. "Hold your course" then picks it up.
- If there's not enough food for the next leg, the button is greyed out and says so.
- Reports that a scene interrupted are now told after the scene. Before, a storm's losses could vanish behind a sea event.

**3. A-viking along a coast.** The orders screen asks:
- **the coast** (Ireland, the Hebrides and the north, the Irish Sea, Northumbria, the south of England, Frisia, Frankia and the Seine, the Baltic), with the places you know listed;
- **how long:** 10, 20 or 30 days, or the rest of the summer;
- **what to take:** silver, both, or captives;
- **how bold:**
  - careful scouts every place, leaves it alone above 0.9 of them to each of yours, and leaves before the countryside comes;
  - bold attacks up to 1.5 of them to each of yours;
- **which fights you lead:** every fight; the close ones (0.6 to each of yours, or more); or none;
- **where you stand** when the men fight;
- **afterwards:** sail home, or stay on the coast.

**Answering "no investment":**
- **The reckoning before you go.** The "Set out" button carries your men's reckoning: the same summer run 20 times on the same engine, with every fight left to the men. It reads, for example: "none of 20 summers like it killed a captain in your place. The rest brought home about 16 pounds and 9 captives, for 8 men lost." You decide with the risk in front of you.
- **You choose which fights are yours.** "Every fight" means you fight each raid yourself: the cruise stops on the battle screen.
- **It stops for you:**
  - blood below 40%;
  - a third of your men gone;
  - full holds;
  - no food;
  - every scene, as always.
- **Nothing is skipped silently.** Each day that mattered is in the report: "Dyflinn. Taken: 3 pounds 140 coins, 4 captives; 2 men lost." or "Armagh. About 53 of them against your 46. You leave it alone." Death, if it comes, comes in a fight whose odds were on the screen when you set out.

## Measured (`npm run measure:pace`, 30 freedman raider lives, the same seeds; `--orders` goes a-viking on standing orders)

| Year | Taps, the old way | Taps on orders | Sea legs, old way | Sea legs on orders |
|---|---|---|---|---|
| 836 | 312 | 202 | 21 | 6 |
| 840 | 355 | 238 | 20 | 7 |
| 845 | 379 | 275 | 34 | 7 |
| 850 | 465 | 224 | 33 | 5 |
| **835–850 in all** | **5,750** | **3,640** | | |

- **37% fewer taps over 835–850**, with the same new scenes a year.
- **Short of the estimate.** The frame expected about 1,500. The sailing went as planned (legs down by three quarters). What is left is not sailing. Per year after 836, on orders:
  - 63 Continue taps on reports;
  - 24 scene choices;
  - 20 taps deploying the wall (3 a fight);
  - 20 taps of the bot's own trading, which a player can skip.

  A player who doesn't trade should see about 150–200 taps a year.
- **Further cuts, if wanted:**
  - "Deploy as last time": one tap instead of three, about 13 a year;
  - folding a scene's result into the next screen instead of a separate report.

  Both are small. Neither is built yet.
- **Two loops found and fixed while measuring:**
  - "Set a course" with too little food for the first leg did nothing, silently, and could be tapped forever;
  - the bots fell back on buttons that pass no time.

  Both buttons are now greyed out with the reason.
