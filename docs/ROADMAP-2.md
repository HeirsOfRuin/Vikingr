# Roadmap 2: the next five steps (836–840)

**Status:** planned 2026-10-13, at the author's request; the author approved the defaults below the same day. Roadmap 1 (`docs/ROADMAP.md`) is built. **Step 1 is built** (`docs/FRAME-HARDSHIP.md`).

**The author asked for:**
- large fleets, and more than one raiding group at a time;
- disasters and hardships, so a player can't snowball the game;
- children;
- the next five years of story;
- a larger list of legendary rivals, real where possible.

## Order, and why
1. **Hardship.** This comes first. Every later step adds power (more ships, more men, allies with fleets), and without a counterweight the game is solved by year eight. The counterweights must exist before the things they weigh against.
2. **Large fleets and raiding groups.** The power the hardship step is built to hold in check.
3. **Legends.** The real rivals become actors on the map, not a fame table. The story needs them to exist before it can use them.
4. **Children and the household.** Independent of the others. It can be built alongside 2 or 3 if the author wants it sooner.
5. **The story, 835–840.** Two chapters, built last because it uses all of the above.

Every step keeps the usual process: a frame doc, the build, then measurement (bots plus a step-specific measure), then the author's playtest.

---

## Step 1: Hardship (the counterweight) — built

See `docs/FRAME-HARDSHIP.md` for what was built and measured. Two things differ from the plan below:
- the measure found the median life already falls into a poverty trap, so the step also built a floor (men on promise, the lean spring);
- fame now fades with retelling, because it never faded before.

**The problem, measured.** Ten-year lives today only climb:
- silver, ships, fame and men all rise;
- the share-out, the hoard and the farm compound;
- nothing takes back what was won, except death.

The historical north was not like that. Fleets were lost, harvests failed, halls burned, and a man who grew too strong drew knives.

### Upkeep (the cost of size)
- **Winter keep.** Every man who winters at home eats at the hero's table: a winter bill per head.
  - Sworn men and hirdmen cost more.
  - Unpaid men leave in spring, taking their stories with them.
- **Ship upkeep.**
  - Each hull decays over winter unless tarred, re-roped and re-sailed (a per-ship bill at the turn of the year).
  - An unkept ship starts the season leaking: lower speed, worse storms.
  - A fleet of ten is ten bills.
- **The men's expectations rise with his name.** The share a man expects grows with the hero's fame. A great captain's crew expects a great captain's shares, and grumbles at an ordinary summer.
- **Measure:** at a given fame, upkeep should eat about 40–60% of a raider's yearly income. Expansion is possible, but only for a player who chooses it.

### Envy (the cost of standing out)
- **Envy**, 0..10, rises when his fame and wealth outrun his peers' (the jarl's, the captains', the district's) and fades slowly. At thresholds it fires events:
  - **A rival's raid on his farm while he's away:** the hoard dug up, thralls taken, the wife's courage tested.
  - **A lawsuit at the thing.** An old killing raked up, and wergild or outlawry.
  - **The jarl's suspicion.** A subject with five ships is a threat. His favour falls unless he's fed with gifts and service.
  - **Challengers.** A young man wants his name, a holmgang at Yule.
  - **The district's resentment.** Muster pool down, prices up.
- **The pressure valve:** generosity. Open-handed share-outs, feasts and gifts to the jarl lower envy. This keeps a historical truth: a lord stayed safe by giving.

### Disasters (the cost of the world)
- **A bad harvest** (yearly roll, about 1 year in 6, and regional):
  - food costs double;
  - thralls and livestock die;
  - the farm yields nothing;
  - the jarl's call for grain.
- **The coughing sickness or the bloody flux**, in winter quarters or a crowded camp. It takes men and can take sworn men, the wife or a child (rare, written with care).
- **Fire.** The hall burns, by accident or by an enemy. Trophies lost unless saved, the hoard half melted, a choice of what to drag out.
- **Storms at anchor.** A fleet drawn up badly loses ships without ever leaving the beach.
- **The coast learns.**
  - Raided regions raise their defences across the region, not just at one place: the Irish build ringforts and gather hostings faster; the Franks garrison the river mouths.
  - Defence escalates with the number of raids in a region per decade, and recovers slowly.
  - This is the historical arms race, and the strongest brake on a raider.

### Age and the body
- **After 30,** strength and endurance begin to drop (slowly; faster after 40).
- **Old wounds.** Each wound has a small chance of becoming permanent (a bad knee, a weak arm), and they accumulate.
- **Sworn men age too.** Ketill, if he lives, is old by 838 and wants to go home.

### Measures
- **`measure:power`, the power curve.** Over 20-year bot lives, silver, ships, men and fame should rise, plateau and wobble, not climb without limit.
- **Targets:**
  - the median raider's fleet should plateau at 3–5 ships;
  - no bot life should hold more than 8 ships for more than 2 years;
  - at least 1 serious setback every 4 years per life.

---

## Step 2: Large fleets and raiding groups

### What changes
- **The fleet cap rises from 5 to 12 ships**, but command now has a limit.
  - **Command span:** he can lead 3 ships himself, plus 1 for every 2 points of command skill.
  - **Beyond that, ships must sail as separate raiding groups** under a shipmaster. Otherwise they straggle: desertion, quarrels, ships "lost" in the night.
- **Raiding groups.** Ships can be formed into groups, each under a sworn or hired master:
  - **Send a group on its own summer:** choose a target region and its orders (raid, trade or escort) and how long it's out. It sails off-screen and comes back with a report: plunder, losses, a dead master, a master who kept more than his share, a master who didn't come back at all.
  - **Odds:** the master's skill, loyalty and temperament, the group's strength and the region's defences decide the outcome. The engine is the existing raid and storm logic, resolved in summary.
  - **Ambition:** a master who brings back good summers grows in fame and ambition (Roadmap 1's "a ship of his own" events, sharper).
- **Fleet battles at sea.** Two fleets meet: each ship-group is a wing in a host (Roadmap 1, step 4). Boarding, ships lashed together, the old way.
- **Wintering abroad as a host.** With 6 or more ships and allies, a winter camp, or longphort, on a foreign shore. Historical: Lough Neagh, 840–41; Noirmoutier, 843.
  - **Gains:** an early start, the region cowed, a base to raid from.
  - **Costs:** food, sickness, a camp that can be stormed, men who want to go home.
- **The levy at scale.** The jarl's call becomes a real host in which he commands a wing.

### Measures
- `measure:fleet`: group outcomes by master and region, and how often a group fails to come back.
- A fleet-size distribution over 20-year lives, checked against Step 1's caps.

---

## Step 3: Legends (the real rivals as actors)

### What changes
- **Legends act on the map.** Each has:
  - historical years of activity;
  - a region;
  - a fleet that grows and shrinks;
  - a fame curve;
  - a temperament;
  - a fixed fate where history records one (Turgeis drowned in Lough Owel, 845).
- **Inside his years, a legend:**
  - **raids his region first.** Places he has hit are emptier and angrier;
  - **appears in scenes:** met in port, seen at sea, at a fleet gathering;
  - **can be allied with or served under,** using the captains system with a much larger fleet;
  - **can become a rival.** Fights, a race for the same target, envy;
  - **dies when history says.** Before then, only in the rarest cases, and only after the history allows.
- **The legends table** (Saga tab) compares the hero with the living legends, year by year.

### The roster
About 28, real wherever possible. "Saga" means the sources are sagas written centuries later; "history" means the Frankish, Irish or English annals.

| Legend | Active | Region | Source and note |
|---|---|---|---|
| Horik I, king of the Danes | 827–854 | Denmark, Frisia | History. Burned Hamburg in 845. Killed in civil war, 854. |
| Harald Klak | 812–852 | Frisia, Rüstringen | History. Exiled Danish king, baptized 826, a Frankish vassal. |
| Rorik of Dorestad | 834–873 | Frisia | History. Harald's kinsman; held Dorestad for Lothar. |
| Hemming Halfdansson | 830s–837 | Walcheren | History. A Dane in Frankish service; killed by Danes on Walcheren, 837. |
| Godfrid Haraldsson | 850s | Frisia, Seine | History. Harald Klak's son. |
| Turgeis | 839–845 | Ireland | History. Drowned in Lough Owel by Máel Sechnaill, 845. |
| Ásgeir (Oscherus) | 841–851 | Seine, Aquitaine | History. Sacked Rouen in 841. A different Ásgeir; the game will make use of the name. |
| Ragnar (Reginherus) | 845 | Seine | History, and saga as Loðbrók. Paris, 845. |
| Hásteinn | 859–893 | Loire, Mediterranean | History. |
| Björn Ironside | 855–862 | Seine, Mediterranean | History and saga. |
| Weland | 860–863 | Seine | History. Paid by Charles the Bald to fight other Danes. |
| Sigfrid | 873–887 | Frisia, Seine | History. Paris, 885–886. |
| Olaf (Amlaíb) of Dublin | 853–873 | Ireland | History. |
| Ívarr (Ímar) | 857–873 | Ireland, England | History. |
| Hálfdan Ragnarsson | 865–877 | England | History. |
| Ubba | 865–878 | England | History. A different Ubbi from ours. |
| Ketill Flatnose | 840s–870 | the Hebrides | Saga. |
| Auðr the Deep-Minded | 850s–900 | Dublin, Hebrides, Iceland | Saga. A woman of power. Not a raider: a matriarch and settler. |
| Naddoðr | c. 850s | the far west | Saga. Blown to Iceland. |
| Garðarr Svávarsson | c. 860 | the far west | Saga. Sailed round Iceland. |
| Hrafna-Flóki | c. 865 | the far west | Saga. Named Iceland. |
| Rurik | 860s–879 | Ladoga, Novgorod | Chronicle. |
| Askold and Dir | 860s | Kyiv, Constantinople | Chronicle. Constantinople, 860. |
| Ohthere (Óttarr) of Hálogaland | c. 890 | the far north, England | History. A trader and explorer. Late, but a model for the trader path. |
| Hálfdan the Black | 830s–860 | Vestfold, Norway | Saga. Harald Fairhair's father; a near neighbour to the hero's world. |
| Harald Fairhair | 870s–930 | Norway | Saga and history. |
| Niall Caille, High King of Ireland | 833–846 | Ireland | History. Beat the Norse at Derry, 833. An enemy legend. |
| Máel Sechnaill | 845–862 | Ireland | History. Killed Turgeis. An enemy legend. |

Most of these lie beyond 840. They're in the roster so that a long life (to the 870s) meets them in their years. **Inside 836–840 the active ones are:**
- Horik, Harald Klak, Rorik and Hemming in Frisia;
- Turgeis's arrival in Ireland, with Niall Caille against him;
- Hálfdan the Black at home;
- the Rus in the east.

### Measures
Legend activity per year matches the dates. No legend dies before history allows (a test). How often a bot life meets or fights each legend.

---

## Step 4: Children and the household

### What changes
- **Children as people.** Each child has:
  - a name, chosen at the naming;
  - a birth year;
  - a temperament (one of the sworn men's six), shown as he or she grows;
  - a few attributes;
  - a mother, which matters for inheritance and kin.
- **Birth and early years:**
  - **Births:** about one every two or three winters while married, with a fertility curve.
  - **The naming,** on the floor at your feet: the old custom, and the choice to raise the child or not. Historical, and written as such: hard, and shown without comment.
  - **Infant illness:** some children die. Written once, with care, not repeated as a mechanic the player grinds through.
- **Ages 5–7: fostering.** Send a son or daughter to foster with a captain, a jarl or a father-in-law.
  - **Gains:** a strong tie (relationship +3, a lasting alliance).
  - **Costs:** the child grows up half someone else's.
  - **Or keep them home:** closer, and less useful.
- **Age 12:** a son's first weapons and his first boast. A daughter's first say in her marriage.
- **Ages 15–16:**
  - **A son:** can join the crew as a named man, in the battle line and on the bench, with his own arc. He can die. He can outshine his father.
  - **A daughter:** a marriage alliance with a captain's or jarl's son (favour, relationship, a fleet's support), or her own choice and the consequences.
- **The heir and the dynasty.**
  - At the hero's death, a grown son (16 or older) can take up the life: dynasty mode. The fame, ships, hall and enemies pass on, diminished.
  - Without a grown son, the life ends as it does now.
  - This is the long game's spine. Within 835–840 the hero's children are small (at most 8), so this step builds the system and the first decade of a child's life. Grown children arrive with the chapters after 845.
- **The wife grows too.** Each of the four wives has events of her own in the household (Ingibjörg's ambition, Þórunn's land, Ásta's trade, Gyða's long memory).

### Measures
Children per married life over 20 years; survival rates set historically (high infant mortality, not lurid); fostering ties; and whether dynasty handover works with no dead ends.

---

## Step 5: The story, 835–840 (two chapters)

Built in the usual way: a frame for approval, a calibration round on 3 scenes, then the writing. About 25–30k words in all.

### Chapter 1: "The Divided Road" (835–837)
It opens on the 835 choice (Frankia, Ireland, the east, home). Each road has its own spine, and the shared beats bind them.
- **Frankia (835–837):**
  - **835:** Noirmoutier, the monastery island at the mouth of the Loire. The monks of Saint Philibert are already packing to leave; history has them abandon it in 836.
  - **836:** Dorestad and Antwerp burned again, with Horik's Danes.
  - **837:** **Walcheren**, where Hemming Halfdansson dies fighting for the Franks against the Danes. Which side the hero is on is the chapter's question. A host battle.
- **Ireland (835–837):**
  - **835–836:** Turgeis's rumour grows. Raids go inland for the first time (Brega, Connacht, 836). Clonmore at Christmas.
  - **837:** **the two fleets of sixty ships** on the Boyne and the Liffey, the largest Norse force yet seen in Ireland. The hero's fleet is one of them, or comes too late. A host battle against the men of Brega.
  - **Throughout:** Hákon Eysteinsson's thread, if he went west after the succession.
- **The east (835–837):**
  - **835:** Birka.
  - **836:** the expedition to **Ladoga** (Aldeigjuborg), first of all in the game's east: the river road, the portages, the Slavs and the Finns, furs and dirhams.
  - **837:** the Rus who want a Norse chieftain to settle their quarrels. The seed of 862.
- **Home (any road):** the new jarl's demands, Envy's first knives, the children's naming, a hall's first decade.

### Chapter 2: "The Emperor's Death" (838–840)
- **838:** **the great storm.** The Annals of St-Bertin record a Danish fleet lost at sea in a sudden storm. A disaster set piece that falls on any hero at sea that summer. Also a famine winter.
- **839:**
  - **The east:** Rus envoys appear at the emperor's court at Ingelheim, sent on by Constantinople. The Franks find they are Swedes. The hero's eastern contacts are in that party, or he's asked to escort it home.
  - **Ireland:** a Norse fleet on **Lough Neagh**.
- **840:**
  - **June:** **the emperor Louis dies.** His sons go to war in earnest (Fontenoy, 841). The coasts open wider than ever, and the north knows it.
  - **Winter:** the first Norse **wintering in Ireland**, on Lough Neagh, 840–841. The hero's longphort, if he dares (Step 2). The seed of Dublin, 841.
- **Throughout:** the household (a son's naming, a daughter's fostering), Envy's reckoning, a legend met or crossed (Turgeis, Rorik, Horik), and the hero turning 26 with the century opening in front of him.

### Measures
Story beats reached per surviving bot life, at least 80% for each road's spine. Host and set-piece win rates. The `measure:power` curve still plateaus with the story's rewards in.

---

## Decisions for the author (proposed defaults in brackets)
1. **Dynasty mode.** Play on as a grown son after the hero dies? [Yes, built in Step 4, used from the 840s.]
2. **Infant death and child exposure.** Historical but sensitive. [Included once each, written with restraint, never as a repeated mechanic.]
3. **How hard the brake.** [Upkeep eats 40–60% of a raider's income at fame 60; one serious setback every 4 years.]
4. **Writing scale for Step 5.** [About 25–30k words across two chapters, with a calibration round first.]
5. **Order.** [Hardship → fleets → legends → children → story. Children can move earlier if wanted.]
