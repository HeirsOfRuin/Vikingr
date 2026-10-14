# Economy (first pass, 2026-10-12)

**Silver is weighed, not counted** (the author, 2026-10-14). The player sees pounds of hacksilver and coins for the change.
- **The pound** is 240 coins. That is the Carolingian reckoning the annals use for tribute ("7,000 pounds of silver" at Paris, 845).
- **The coin** is a penny's weight, about 1.7 g.
- **The engine** still counts in the old ørtug: 5 coins, 48 to the pound. So every amount in the content and in `src/engine/tuning.ts` is in ørtugar.
- **A Norse mark** is half a pound (24 ø). The prose no longer uses it.

**Arm-rings are things, not prices** (`src/engine/rings.ts`):
- **Getting them.** A lord gives only the rings he holds:
  - a **silver** ring is made by the smith, at home or at a market smith or booth, for 30 ø (150 coins: 120 coins of silver and the smith's fee);
  - rings turn up in plunder: 12% a grab in his own raids, and **gold** 3% a grab in rich places;
  - lords give them: the jarl's levy, and Ubbi at Dorestad gives gold.
- **Giving them.** A silver ring to a sworn man gives +3 loyalty; a gold ring gives +5 and a deed two and a half times the weight. A gold ring sent to the jarl is worth twice any other gift.
- **Cutting them up.** A ring cut up for hacksilver is worth its weight: silver 24 ø (120 coins), gold 96 ø (2 pounds).

## What things cost

| Thing | Cost | In ørtugar |
|---|---|---|
| Sign-on gift, one man | 15 coins | 3 |
| A three-night feast | 5 coins a mouth, plus 50 | mouths + 10 |
| A silver arm-ring from the smith | 150 coins | 30 |
| A blót | 60 coins | 12 |
| Karvi (28 oars) | 4 pounds | 192 |
| Snekkja (40 oars) | 10 pounds | 480 |
| A captive at the Kaupang trader | half a pound | 24 |
| The holmgang ransom (holmlausn) | a pound and a half | 72 |
| Thorgils's leg, by the law | a pound | 48 |
| The boast to his father | a pound and a half | 72 |
| A farm of his own | 4 pounds | 192 |
| A hall | 12 pounds | 576 |

## What a summer is worth

**Targets:**
- An ordinary oarsman in a good summer takes home about **half a pound** per share (`SHARE_EXPECTED` = 24 ø).
- A captain who keeps a fair share of a good summer takes home **5–7 pounds**: enough for a karvi, not yet a snekkja.

**How the year 830 gets there:**
- **Iona:** a fixed 400 ø in the heap (it has been picked over), plus captives.
- **Bangor:** wealth 1,500 ø. Each plunder round strips 14–26% of what is left and raises the alarm by 1.5–3 (the alarm fills at 10). Two to four rounds is the usual haul, about 600–1,000 ø.
- **At another man's oar:** the captives are sold first. A quarter of the heap goes to the ship and the captain, and the rest is split by heads: about 41 men, the hero's shares counted. Iona plus Bangor gives **about 150 coins a share**. Two shares (first through the gate, or the front rank at Bangor) give about a pound and a quarter, which is close to the boast to his father.
- **In command:** the jarl takes his quarter for the ship, and the hero keeps 15/30/50% (generous, fair, mean). A fair share of the same summer is **about 5–6 pounds**.

## Measured (`npm run measure:830`, 300 lives per policy; the bot chooses scene options at random)

| | Median at spring 831 | 10th percentile | 90th percentile |
|---|---|---|---|
| Raider | 150 coins | 30 coins | 2 pounds 60 coins |
| Random | 45 coins | 5 coins | 120 coins |

The 90th percentile is the captains.

## Known gaps

- The Phase 1 sandbox raids still use the old wealth for every place except Iona and Bangor, so the outlaw and freedman starts are poorer than the younger son. The next pass widens the target list and adds trade.
- An oarsman cannot spend much: the hall gives him work, gifts, training and a blót. That is deliberate in year one.

## Food away from home (standing in the ports, DESIGN §11.5)
- **Buying food:** at home it costs 1 ørtug per 20 man-days. Away from home the price depends on standing: double at a wary port, the home price at a friendly one, half at an allied one. Unfriendly and hostile ports sell nothing. One purchase fills the ship for 30 days.
- **Guest-right:** a friendly port gives 7 days of food, an allied one 14, free, once a year.
- **Taking cattle:** free in silver, but it costs 2 standing. At unfriendly ports it usually means a fight.
- **Hiring away from home:** the same 3 ørtug sign-on gift as at home. Friendly Norse ports have 4 men a year to hire, allied ones 8.
