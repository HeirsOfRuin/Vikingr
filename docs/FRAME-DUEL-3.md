# The duel, revision 4: the odds before the cloak

The review (`docs/REVIEW-2026-10.md` §1) called the duel "solvable rather than tense". That was a misreading of `measure:duel`: the rows it quoted were the hero at 35, at the top of his skill. This note corrects it and proposes the fix the numbers actually support.

## What the numbers say
From `measure:duel`, 600 fights a cell, holmgang rules, fought to the end:

| Hero | Opponent | Careful reading | Instinct | Random |
|---|---|---|---|---|
| 16, weapons 2 | Thorgils (the first Yule) | 100% | 87% | 16% |
| 16 | Máel Brigte (Conaille, 831) | 84% | 80% | 27% |
| 16 | Ögmundr Wolf-coat (challenger) | **91%** | **6%** | 0% |
| 16 | Cú Mara, Þorvaldr, Grjótgarðr (challengers) | 0% | 0% | 0% |
| 25, weapons 5 | Cú Mara | 74% | 69% | 16% |
| 25 | Þorvaldr | 58% | 43% | 10% |
| 25 | Grjótgarðr the Old | 8% | 4% | 1% |
| 35, weapons 7 | everyone | 61–100% | – | – |

The progression is sound:
- **At 16,** a boy beats boys and dies to champions.
- **At 25,** a skilled man beats most of them.
- **At 35,** he beats nearly everyone.

Two things are wrong.

**1. The hero accepts a challenge blind.**
- In 120 bot lives, 33 died in single combat.
- Nearly all were challengers who arrive with fame, before the skill to match it: Cú Mara, Þorvaldr, Grjótgarðr, the Wolf-coat. They kill heroes aged 19–25.
- Refusing costs 1 honour and 1 standing, which is cheap. But nothing on the screen tells the player that this man will kill him.
- The `danger` marker says "this can kill you" on a fight he would win 98% of the time, and on one he would win 0% of the time. Both look the same.

**2. Guile 0 makes a champion a puzzle.**
- The Wolf-coat (guile 0) goes from 6% on instinct to 91% read carefully.
- A man the district fears should not be beaten by a sixteen-year-old who watches his feet.

## Proposal
1. **The reckoning before the cloak.** When a fight is offered (a challenge, a holmgang, a story duel), the choice shows what the men think of it, worked out by the same engine. Before the cruise it runs 20 summers; here it runs the duel 40 times on instinct and 40 times read carefully. What the player sees: *"The men reckon you'd beat him four times in ten, more if you watch him well. He has killed better men than you."* No number on screen: words, in five bands from "you'd kill him" to "he'd kill you". Refusing stays cheap, so an informed refusal is a real choice.
2. **Guile for the Wolf-coat:** 0 → 2. **Target:**
   - at 16, careful reading wins no more than 30% against a challenger;
   - at 25, 55–80%;
   - instinct stays 10–25 points below reading.
3. **Check the other challengers against the same target.** Raise guile only where the numbers miss it. No other change to the duel engine.

## Out of scope
- No rework of the exchange (strike, guard, feint, distance, stamina); it works.
- Story duels (Thorgils, Máel Brigte) keep their odds; they are a boy's fights and he mostly wins them.

## Measure after
- `measure:duel`: the target above.
- Bot duel deaths: they should fall, because the bots will read the reckoning and refuse a fight the men call deadly. The bots get that rule.
- Smoke test of the challenge scene at 390 px: the reckoning shows on the choice.
