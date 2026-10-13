# Frame: Hardship (Roadmap 2, step 1)

**Status:** built 2026-10-13, using the author's defaults from `docs/ROADMAP-2.md`: upkeep eats 40–60% of a raider's income by fame 60, and a serious setback comes about every 4 years.

## What the measure found first
`npm run measure:power` (40 raider lives over 20 years, before any of this step) showed two problems, and neither was the one expected.

- **The top tenth snowball.** By 850 they hold:
  - 5 ships;
  - 118 men;
  - fame 700.

  Nothing takes any of it back.
- **The median life falls into a poverty trap.** From about 838 the near places are hostile and well defended. The crew bleeds away, the silver goes to zero and morale sits at zero. With no silver, he can't pay a single man's sign-on gift, even with 20 to 40 men in the muster pool. He never recovers.
- **Fame never fades.** Every homecoming and feast retells every deed older than a year, at full weight, so living fame only ever rises. A bot with 2 men and no silver has fame 250.

So a flat brake is wrong. It would crush the median life further and barely touch the top. **The brake has to be progressive** (it bites in proportion to size, wealth and name), and **the bottom needs a floor**, so a ruined man can climb back. The goal is a curve that rises, levels off and wobbles.

## 1. Upkeep: the cost of size (`src/engine/hardship.ts`, at the autumn share-out)
- **Sworn men** eat at his table all winter: 8 ø each.
- **The crew** expect winter gifts and Yule meat: ½ ø a man, plus 1 ø for every 80 fame. A great captain's men expect a great captain's table.
- **Ships** must be tarred, re-roped and re-sailed: 6% of the hull's price each winter.
- **When and how it's paid.** At the autumn share-out it comes off the top of the heap, before the shares, as every ship's cost does. If the heap is short, the rest comes from his silver, then the hoard.
  - The first build charged it at the turn of the year. Bots had already spent their silver in the winter hall by then, and nine bills in ten went unpaid.
- **What goes unpaid costs him:**
  - morale −1, and the sworn men −1 loyalty;
  - a fleet's extra men go to other captains, in proportion to the shortfall. A single ship's crew goes home for the winter and comes back hungry;
  - his ships after the first start the season at hull −30. The crew always patch the flagship. An early build let the flagship rot too, and drownings doubled among poor bot lives.
- **The men's expectations rise with his name.** The share they count as a good summer is 24 ø × (1 + fame/120).
- The spring card shows the bill, and the ledger keeps each year's income and upkeep.

## 2. Envy: the cost of standing out
- `hard.envy` runs 0..10. At the turn of the year it moves halfway toward how far he outshines his peers.
- **What counts as outshining:**
  - fame over 40, at 1 per 25;
  - each ship over 2, at 1 each;
  - wealth over 30 marks, at 1 per 15 marks;
  - a hall, at 1.
- **Generosity this year lowers it:**
  - an open-handed share-out, −1;
  - a feast, −0.5;
  - a gift to the jarl, −1;
  - an arm-ring, −0.5;
  - opening his stores in a famine, −2.
- **Events** (`content/scenes/world/hardship.yaml`, path `envy`). Each draws some of the envy off when it fires:
  - **A challenger** (envy 3 or more, fame 40 or more): a young man wants his name, and offers a holmgang at Yule.
  - **A lawsuit at the thing** (envy 4 or more): an old killing raked up. Pay the wergild, find oath-helpers, or refuse and lose the jarl's favour.
  - **The farm raided while he's away** (envy 5 or more, with land of his own): the hoard dug up and thralls taken. Go after them, sue, or let it go.
  - **The jarl's suspicion** (envy 6 or more, 3 ships or more): a ship as a gift, a heavy payment, or refuse and lose favour.
  - **The district's resentment** (envy 7 or more): fewer men at the muster and food dearer, unless he feasts the district.

## 3. Disasters: the cost of the world
- **A bad harvest** (1 year in 6, never two in a row), rolled in autumn:
  - a third of the thralls die;
  - the farm yields nothing that winter;
  - food costs double in spring.

  The district comes to him. He can open his stores (silver, envy −2, favour +1, an open-handed deed), sell grain dear (silver in, envy +2), or keep it.
- **Sickness in winter quarters.** The chance rises with how crowded they are (4%, plus 0.2% a mouth, capped at 25%) and doubles abroad.
  - It takes 10–25% of the crew, and sometimes a sworn man.
  - He may come out of it with a cough that costs Endurance until spring.
- **Fire**, at a farm or hall: 1 in 25 a year, more when envy is high (an enemy's torch). He chooses what to drag out of the burning hall:
  - the hoard (the trophies burn);
  - the trophies (the hoard half melts);
  - the people (half of each is lost, honour +1).

  A burned hall falls back to a farm, and rebuilds at half price.
- **Storms at anchor.** A port scene for a fleet of 3 or more: the worst-kept ship is driven ashore and lost, with some of her men.
- **The coast learns.**
  - Every raid raises its region's alarm (+0.5, or +0.75 if burned). Alarm falls by 40% each winter.
  - Defenders are multiplied by 1 + 0.06 × alarm (at most 1.6), and the plunder rounds start with the countryside's alarm up to 1.5 higher.
  - At alarm 2 and 4 the journal says, once each, what the region has done: the Irish build ringforts, the Franks garrison the river mouths, the Northumbrians call out the fyrd.
  - The first tuning (+1 a raid, decaying by a fifth, up to double) was the strongest brake by far. On its own it held the top tenth to 19 men by 840.

## 4. Age and the body
- **Strength, Agility and Endurance decline:** −1 for every 8 years past 32, and another −1 for every 8 past 44. Hit points fall with Endurance.
- **Old wounds.** A healing wound of 40 days or more has a 12% chance of leaving a permanent old wound:
  - an old shoulder (Strength −1);
  - old ribs (Endurance −1);
  - a leg that never healed right (Agility −1).
- **The sworn men age too.** By 838 Ketill is old and asks to go home.

## 5. Fame fades unless renewed
- Retelling an old deed refreshes it, but each retelling after the first tells it at four-fifths of the weight before ("the same story for the fifth winter").
- Verses don't fade.
- A feast in his own hall tells a **new** deed better, as before; an old one is an old one in any hall. Without this rule a hall's feast multiplier outran the fade, and fame grew 8% a year on old deeds alone.
- Living fame therefore levels off at about five years' worth of deeds. A man has to keep doing things to stay famous.

## 6. The floor: a ruined man can climb back
- **Men on promise.** When he can't pay sign-on gifts, men still sign on for the promise of a share: up to 6 + fame/10 of them, once a spring. They come in green and sour (morale −1). Each brings 20 man-days of food, as men answering a levy do; without it, hunger doubled among poor bot lives.
- **The lean spring** (`ha_lean`). At the muster with fewer than 10 men and less than a mark, the jarl's steward offers to man his benches: 18 young men for the summer, for a quarter of the heap at the share-out. Once every two years at most.

## Measures (`npm run measure:power`)
**Targets, against the baseline above:**
- the top tenth levels off: 3–5 ships by 845, no life with more than 8 ships for more than 2 years, fame at the 90th percentile under 300;
- upkeep is 40–60% of income for lives at fame 60 or more;
- at least one serious setback every 4 living years;
- the median life's men no longer fall below 10 for good.

**Setbacks are journal lines tagged `[kind]`:**
- `[harvest]`, `[sickness]`, `[fire]`, `[storm]`, `[lawsuit]`, `[raided]`, `[jarl]`, `[district]`, `[unpaid]`.
- `[coast]` lines record a region's alarm; the measure counts them too, though they are not disasters on their own.

## Measured (`npm run measure:power`, 60 raider lives × 20 years; `--off` switches brakes off for comparison)

| | Before (all brakes off) | Built |
|---|---|---|
| Men, 90th percentile, 838 / 845 / 850 | 58 / 76 / 88 | 32 / 28 / 33 |
| Fame, 90th percentile, 840 / 850 | 324 / 654 | 133 / 258 |
| Wealth, 90th percentile, 845 (marks) | 39 | 5 |
| Ships, 90th percentile | 2–3 | 2 |
| Setbacks (disasters, envy, unpaid fleets) | none | one every 4.7 years, counting harvest, sickness, fire, raids on the farm and storms |
| Median men from 838 | 8–12 | 6–8 |

**Reading the table:**
- **The top tenth now level off and wobble** instead of climbing. Fame at the 90th percentile reaches legend level (Ragnar is about 200 in 846) and keeps rising slowly, from deeds, not old stories.
- **One brake at a time** (40 lives × 12 years, men at the 90th percentile in 840; all off: about 78):
  - coast: 19 at the first tuning, before it was softened;
  - fame: about 50;
  - disasters: about 65;
  - expectations, envy or upkeep alone: little change.
- **Ships stay at 2 or so even with every brake off,** because the reference bot rarely buys more. The 3–5-ship plateau can't be measured until the bot builds fleets (Step 2 needs that bot anyway, for raiding groups).
- **The median life still falls into a poverty trap from about 837, as it did before this step.** The bot raids the same exhausted, hostile, alarmed places near home and never goes trading or looking for new coasts. The floor (men on promise, the lean spring) is there for a player, but the bot doesn't climb out with it. A smarter bot is part of Step 2.
- **The 10-year bot check (`npm run bot -- --off ...`), against the same lives with every brake off:**
  - the raider's living fame after ten years falls from 85 to 49 (the fade);
  - raids fall from 9 to 7.7 a life, and plunder from 16.8 to 15.4 marks a year;
  - battles won (33% against 31%), drowning (4% against 3%) and hunger are unchanged, after the two fixes above.
