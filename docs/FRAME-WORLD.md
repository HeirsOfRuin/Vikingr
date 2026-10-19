# Frame: the world without you (scouting, the chronicle, lords, land abroad, rule)

Follows `docs/FRAME-PLAYTEST5.md` Part 2. Josh approved all four recommendations and added a fifth.

## Josh's decisions (his words)
- **Order:** "1. yes"
- **The chronicle at about 15 events, with legends in person:** "2. hell yes"
- **Lords:** "I think you can only hold an oath to one man at a time. If you are found to have sworn an oath to two or more, you will lose honour and be cast out by both."
- **The legends:** "I also think Ragnarr would be cool."
- **Land abroad:** "4. beautiful."
- **New:** "What about making yourself king or jarl of a place, competing with the other rivals and legends? Go ahead with all of this."

Build order: A, B, C, D, E. Each is committed, measured and published on its own.

---

## A. Scouting a force

**Problem.** A raid is a blind roll. The only way to learn a place's strength is to fight it.

**Rule: what scouting shows is what the raid uses.** One roll fixes the numbers the raid will meet. Scouting shows them, and the raid that follows uses them. There is no second formula (rule 1).

**Design:**
- **The action.** At a place you can raid, "Send men up to look". It takes a day, once per place per summer. It is not offered at another man's oar, since the captain scouts.
- **The check:** cunning + wits against the place:
  - difficulty 1 at a monastery, 2 at an island, 3 at a hall, market or town;
  - +1 if the place was raided within the last year, because they are watching.
- **Success** fixes the raid roll for 7 days and tells you:
  - how many if you catch them asleep, and how many if they see you;
  - the chance of catching them asleep, including the scouting bonus (+25%);
  - who they are (levy, warriors or a lord's hird) and who leads them;
  - how rich the place is, and who stripped it if someone did (B);
  - whether they are still on edge from the last raid.
- **Failure:** they see your men. The place is warned: defence +0.25, and the next raid's chance of surprise falls by 20 points. One time in four, a man does not come back.
- **The raid button** carries the scouted numbers while they are fresh. You can now choose not to raid. That choice is the point.

**Measure.** Bot lives with scout-then-decide against blind raids, same seeds: raid win rate, men lost per raid, plunder per life. Target: scouting pays most lives, and failures cost something visible.

---

## B. The chronicle and the legends in person

**Problem.** The famous Vikings are rows in a table. Nothing happens in the world unless the hero does it.

**Rule: the legends play by the hero's rules (skill rule 7).** A legend's raid uses the same place wealth, defence and recovery as the hero's. A sacked place stays poor for years, whoever sacked it.

**Design:**
- **A dated registry,** `content/registry/chronicle.yaml`. Each entry has:
  - a date, a legend and a place;
  - what it does to the world: wealth kept, defence added, Norse-held or not;
  - the news line;
  - optionally, a flag that means the hero was there. The chapter applies the effect instead, and the news says so.
- **Events (sources: the Annals of Ulster, the Annals of St-Bertin, the Anglo-Saxon Chronicle; where tradition fills a gap, the doc says so):**

  | Year | Event | Legend |
  |---|---|---|
  | 832 | Armagh plundered three times in one month | Turgeis (tradition) |
  | 834 | Dorestad sacked | Horik's Danes (the existing chapter) |
  | 835 | Dorestad again; Sheppey ravaged; Noirmoutier | Danes |
  | 836 | Dorestad and Antwerp burned | Danes |
  | 837 | Walcheren: Count Eccihard killed. Sixty ships on the Boyne and sixty on the Liffey | Danes; Turgeis |
  | 838 | A Danish fleet off Frisia lost to a storm | Horik |
  | 839 | A fleet on Lough Neagh plunders the north of Ireland | Turgeis |
  | 840 | The emperor Louis dies; Armagh burned from Lough Neagh | Turgeis |
  | 841 | Rouen and Jumièges burned; ship-forts at Dublin and Linn Duachaill (existing chapters) | Oscherus; the Norse in Ireland |
  | 842 | Quentovic and London sacked | Danes |
  | 843 | Nantes taken on St John's Day by the Vestfold fleet, which winters on Noirmoutier | Vestfold men; Hastein (tradition) |
  | 844 | Seville sacked by the Majus. Lough Ree fleet; Clonmacnoise burned | Turgeis |
  | 845 | Hamburg burned; Paris (existing chapter); Turgeis drowned (existing) | Horik; Ragnarr; Máel Sechnaill |
  | 848 | Bordeaux taken | Hastein (tradition) |
  | 850 | Rorik takes Dorestad and holds it for Lothar | Rorik |
  | 851 | The Danes fall on the Norse of Dublin | Danes |

- **Legends raid every summer in their own waters,** as the hero does. While active, each legend sacks one place a summer, seven times in ten:
  - Turgeis in Ireland, 832–845;
  - Horik's Danes in Frisia, 834–845;
  - Ragnarr on the Frankish coast, 840–846;
  - Hastein on the Loire, 843 onward.

  A legend's sack keeps 60% of a place's wealth and raises its defence. The place remembers who did it. Arrive after them and the raid, the scouting and the news all say so.
- **News reaches you:**
  - in any Norse or Danish port, any market, or at home, once it has had time to travel (20 days);
  - when you stand the old sailors a round;
  - at the turn of the year, on the spring card, for anything you missed.
- **Joinable windows,** new host chapters on top of the existing Dorestad 834, Rouen 841, Dublin 841 and Paris 845:
  - **837, Turgeis's fleet on the Liffey:** sail with him, or fight him.
  - **839–840, the Lough Neagh fleet and Armagh.**
  - **843, Nantes with the Vestfold fleet,** on St John's Day. The Vestfold men are Norwegians: the obvious summer for a Hordaland man.
- **Legends in person** (once each, in their years and places):
  - Horik at Hedeby;
  - Turgeis in Ireland;
  - Ragnarr gathering ships on the Frisian coast before Paris;
  - Hastein, young, at Noirmoutier after Nantes;
  - Rorik at Walcheren.

  Each can be met, crossed or sworn to (C).
- **Legends' fame moves with what happens,** not only by their fixed curve. Beat one, cross one or outdo one, and his fame takes the hit, or he takes yours.

**Measure.** Per bot life: events heard, windows joined, cameos met; how much legend raids cut plunder (target: no more than 15%); how fast sacked places recover.

---

## C. Lords: one oath at a time

**Problem.** The jarl is the only lord. A man who leaves home, by choice or as an outlaw, has nobody to swear to.

**Rule: one oath.** You are any one lord's man, or no one's. You can leave a lord openly, at a cost to his favour. Or you can swear to a second lord and say nothing. Each year a second oath is kept secret, the chance grows that it comes out. If both lords call you in the same summer, it comes out for certain. When it does, Josh's rule applies: **honour −3, cast out by both.** Neither will take your oath again, any land from them is gone, and their ports remember.

**The lords:**

| Lord | Seat | Years | His friends: raiding them costs his favour |
|---|---|---|---|
| The jarl (Eystein, then Hákon or Eiríkr) | Hordaland | always | Norse ports |
| Harek | Orkney | to his death | Norse ports in the isles |
| Kolbeinn | Skye | always | the Hebrides |
| King Horik | Hedeby | to 854 | Danish ports |
| Turgeis | Ireland (Dublin from 841) | 832–845 | Norse-held Irish ports |
| The king of Tara (Niall Caille, then Máel Sechnaill) | Armagh, then Clonmacnoise | always | every Irish place |
| Rorik | Walcheren | 841 onward | the Frisians |

**What a lord gives** (one table in the engine; nothing declared without an effect):
- **Men:** sworn to him, you take 2 + a third of his favour extra men at every muster.
- **Protection:** his ports never treat you as worse than friendly.
- **A seat:** winter at his hall as at home, with a full winter's actions.
- **Land:** see D.

**What a lord asks:**
- **His call:** about one summer in three, a call scene. Answer it (a host fight at his side, +2 favour, a deed) or refuse (−3).
- **His tenth:** a tenth of every share-out heap.
- **His friends left alone:** a raid on them costs 4 favour. Below zero he gives you back your oath. That is not oath-breaking, but it is the end of his protection.

**The outlaw** can swear to Harek. That is the natural road for a man the jarl cannot take back.

**Measure.** How many bot lives swear, change lords, keep a secret oath, and get found out; what each lord's oath pays in men and land, and what it costs in tenths.

---

## D. Land abroad

**Problem.** The only land is at home.

**Design: a holding** is a place where you can winter as at home, call out men in spring, and draw a yield at the turn of the year.

| Kind | How | Yield a year | Spring men | Risk |
|---|---|---|---|---|
| Granted | Your lord, at favour 6 and after you have answered his call: Harek's land in Orkney, Kolbeinn's third valley on Skye, Horik's land at Ribe, Rorik's on Walcheren, Turgeis's at Linn Duachaill | 24 | 4 | Lost with his favour, or with your oath |
| Bought | In a Norse place, for 6 pounds, if they are at least friendly: Shetland, Orkney, the Faroes, Skye, or a Norse-held port | 18 | 2 | None |
| Taken | After winning a raid on a coast that is not Norse, with 40 men and a name (fame 40): dig a ship-fort and leave a garrison | 40 | 3 | They try to take it back every year |

- **A taken fort:** its garrison holds or falls by the same arithmetic as a raid's defenders. If you winter there, you fight for it yourself, as a host.
- **Wintering at a holding** is wintering at home: a full winter's actions, the feast, the yield.
- **Scope call:** your family's home stays the home fjord. Moving the hero's home port touches every scene written since 830. I'd rather make holdings real homes in winter and spring than half-move the whole story. Say if you want the full move.

**Measure.** Yield and losses for each kind over 10-year lives, and how often a fort is lost.

---

## E. Rule: jarl or king of a place

**Problem.** A great captain has nowhere to rise to. The legends hold kingdoms; the hero can only hold a hall.

**Design: four seats, each a contest.**
- **The claim** is one number, shown in full: your fame, your men, your lord's favour and your kin by marriage, against the rival's.
- **The rival** is a real man. Where history gives one, he is a legend whose fame is on the same table as yours.
- **You can press the claim three ways:**
  - at the thing: a speech check whose difficulty is the gap between the claims;
  - with silver: gifts close the gap;
  - by the sword: a holmgang with the claimant, or a host fight.

| Seat | When it opens | Rival | Who keeps it from you |
|---|---|---|---|
| Jarl in Orkney | Harek's death (between 838 and 846, fixed per life) | Harek's sister's son | Your Orkney standing; marriage to Ingibjörg counts for a great deal |
| King in Dublin | After Turgeis drowns (845). Before that, only by beating him | Hákon or Eiríkr Eysteinsson, whichever brother lost the thing in 834 and went to Ireland | 851: the Danes fall on Dublin |
| Jarl in Hordaland | The jarl's death (between 842 and 850, fixed per life) | The jarl's son | Your district favour and fame |
| Count of Walcheren | From 841: Lothar wants a Norseman to hold the coast against other Norsemen | Rorik | Rorik's fleet takes Dorestad in 850 and wants the coast |

**What rule gives:**
- tribute of 2.5 pounds a year;
- 10 extra men at every muster;
- allied standing in the seat's ports;
- a deed of weight 40;
- a title in your name and on the legend table.

**What it asks:**
- **You must be seen.** Winter at your seat at least every other year, or it falls to the rival.
- **You must hold it:** a rival's challenge one year in four, and the legend's year (above) when it comes.

**Measure.** How many bot lives win a seat, and when; how many lose it; fame at death for rulers against non-rulers.

---

## Size
- **Engine:** scouting, the chronicle and legend raids, lords and oaths, holdings, rule. Each has a measurement tool and tests.
- **Writing:** about 25 scenes, plus news lines for about 17 events. Roughly 12,000 words.
- **Commits:** one per step, each published.

---

## Built: what was measured

### A. Scouting (`npm run measure:scout`)
120 lives a row, 8 years, the same seeds with and without scouting. The world was held still (no chronicle) to isolate scouting.

| Bot | Raids tried | Raids won | Plunder | Alive | Battle deaths |
|---|---|---|---|---|---|
| Careful, blind | 17.8 | 71% | 3,569 | 87% | 2% |
| Careful, scouts and walks away | 15.9 | **92%** | 3,720 | 83% | 1% |
| Raider, blind | 22.3 | 70% | 4,079 | 74% | 13% |
| Raider, scouts | 21.0 | **76%** | 4,034 | 69% | 17% |

- Scouting pays: a careful captain wins nine raids in ten and takes more home.
- The raider's survival moved within one standard error (about 4.5 points at 120 lives).
- The careful bot's extra deaths are duels: more fame brings more challengers.
- **Rule 1 held:** the number the scouts show is the number the raid meets (a test checks it on the same seeds).

### B. The chronicle (`npm run measure:world`)
- **A/B,** 60 raider lives, 8 years: plunder 4,048 without the legends at work and 3,960 with them (−2%; target was at most −15%). Survival 78% and 80%.
- **Over 16-year lives:**
  - about 19 pieces of news reach a life;
  - about 15 places are stripped by legends;
  - every cameo is met in some lives (Turgeis in 48 of 60 raider lives, Horik in 18);
  - fleets joined: the Liffey 837 in 16 of 60, Armagh 21, Nantes 2 (the bots seldom reach the Loire by midsummer).

### C. Lords
- 80–88% of careful lives swear an oath.
- Six raider lives in 60 took a second oath in secret; four were found out and cast out.
- The reckless bot always swears in secret when it can: 7 of 9 were found out.

### D. Land
- Raider lives bought land 8 times and were granted it 4 times in 60 lives.
- Forts are covered by tests. The bots that dig them die young, so the retake rate is measured in the tests, not the batch.

### E. Rule
First pass (fame counted in full, rivals 90–130, a five-pound bribe): **35 of 60 raider lives took a seat by 846. Far too easy.**

Tuned:
- your name counts for half;
- rivals' claims 170–180;
- a legend's claim is 100 plus half his fame;
- the seat opens only at fame 120 (Orkney) or 150 (the others);
- the thing is harder (difficulty 5, 7 or 8 by the margin);
- silver closes only a gap of 15, for 10 pounds.

Second pass, still too easy: 35 of 60. Any famous captain could claim any seat.

**Third pass: a claim needs a tie to the place.**
- **Orkney:** Harek's sworn man, his favour at 3 or more, or his daughter for a wife.
- **Hordaland:** the jarl's favour at 3 or more, or a hall of your own.
- **Dublin:** a ship in the fort, or land there or at Linn Duachaill.
- **Walcheren:** the Frisians there must not be hostile.

| Policy (60 lives, 16 years) | Took a seat | Lost it | Median fame, rulers | Median fame, the rest |
|---|---|---|---|---|
| Raider | 11 (Hordaland 8, Dublin 2, Walcheren 1) | 1 | 303 | 251 |
| Careful | 2 (Dublin 2) | 0 | 250 | 139 |
| Reckless | 1 | 0 | 439 | 108 |

A seat is now the reward of the strongest lives with roots somewhere. Orkney went from the easiest seat to one no bot reached: the bots rarely court Harek or marry his daughter. It stays open to a player who does.
