# Economy (first pass, 2026-10-12)

Silver is counted in ørtugar: 3 ørtugar = 1 eyrir, 8 aurar = 1 mark (24 ørtugar). All numbers are provisional and live in `src/engine/tuning.ts`, `src/engine/season.ts` and `content/places/places.yaml`.

## What things cost

| Thing | Cost | In marks |
|---|---|---|
| Sign-on gift, one man | 3 ø | ⅛ |
| A three-night feast | mouths + 10 ø | about 2 for a full ship |
| An arm-ring for a sworn man | 24 ø | 1 |
| A blót | 12 ø | ½ |
| Karvi (28 oars) | 192 ø | 8 |
| Snekkja (40 oars) | 480 ø | 20 |
| A captive at the Kaupang trader | 24 ø | 1 |
| The holmgang ransom (holmlausn) | 72 ø | 3 |
| Thorgils's leg, by the law | 48 ø | 2 |
| The boast to his father | 72 ø | 3 |

## What a summer is worth

**Targets:**
- An ordinary oarsman in a good summer takes home about **1 mark** per share (`SHARE_EXPECTED` = 24 ø).
- A captain who keeps a fair share of a good summer takes home **10–15 marks**: enough for a karvi, not yet a snekkja.

**How the year 830 gets there:**
- **Iona:** a fixed 400 ø in the heap (it has been picked over), plus captives.
- **Bangor:** wealth 1,500 ø. Each plunder round strips 14–26% of what is left and raises the alarm by 1.5–3 (the alarm fills at 10). Two to four rounds is the usual haul, about 600–1,000 ø.
- **At another man's oar:** the captives are sold first. A quarter of the heap goes to the ship and the captain, and the rest is split by heads: about 41 men, the hero's shares counted. Iona plus Bangor gives **about 1¼ marks a share**. Two shares (first through the gate, or the front rank at Bangor) give about 2½ marks, which is close to the boast to his father.
- **In command:** the jarl takes his quarter for the ship, and the hero keeps 15/30/50% (generous, fair, mean). A fair share of the same summer is **about 10–12 marks**.

## Measured (`npm run measure:830`, 300 lives per policy; the bot chooses scene options at random)

| | Median at spring 831 | 10th percentile | 90th percentile |
|---|---|---|---|
| Raider | 1 mark 2 aurar | 2 aurar | 4 marks 4 aurar |
| Random | 3 aurar | 1 ørtug | 1 mark |

The 90th percentile is the captains.

## Known gaps

- The Phase 1 sandbox raids still use the old wealth for every place except Iona and Bangor, so the outlaw and freedman starts are poorer than the younger son. The next pass widens the target list and adds trade.
- An oarsman cannot spend much: the hall gives him work, gifts, training and a blót. That is deliberate in year one.
