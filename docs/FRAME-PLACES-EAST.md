# Thin places and the East road (October 2026)

Josh agreed the order on 2026-10-28:
1. the thin places;
2. the East road;
3. later, the Mediterranean voyage of 859–861.

This frame covers 1 and 2. Each is built, measured and played before the next.

---

## Step 1: The thin places

### What exists
- 11 places have a single scene: a one-off arrival scene in `world/places2.yaml` or `places3.yaml`, gated on `!service`.
- After the first visit, nothing at the place is its own. Every later visit is the generic raid, trade and port pool.
- 7 more places have only two scenes.

### What each gets
Each of the 11 gets two more scenes:
- **a return scene** that pays off what the first visit set up (a flag it already sets, or a new one);
- **a place scene with a stake:** a fight, a deal or a person.

**Rules for the new scenes:**
- They must read the existing choice where one exists. Several first-visit flags are among the 140 saga-only flags, and this gives them a second reader.
- A scene that sits on a historical date says so in its header comment, like the 865 files.

| Place | Return scene (pays off the first) | Place scene |
|---|---|---|
| **Alt Clut** | The 870 siege: Olaf and Ívarr of Dublin come for the rock. If you asked about the well on the first visit, they want you to show them where the water comes from. Fight, guide, or warn the Britons. | The king of Strathclyde's hostage-taking: a son for safe passage up the Clyde |
| **Truso** | The dead man's race again, a year on: the winner's kin want their silver back from the outsider | Amber smuggling to Hedeby, against the Danish king's toll-men |
| **Sheppey** | The abbess who gave you bread: her minster is raided by someone else, and she sends to you | Wintering on Sheppey (the Danes did from 855): the Thames camp |
| **Jarrow** | The books: the monks have moved them inland, and a lay brother will sell the road | The Tyne at low water: a reeve's ambush on the mudflats |
| **Streoneshalh (Whitby)** | The cliff church: a holy woman says she has seen your ship before, in a dream | Northumbrian kings' feud: hired to carry one claimant's men |
| **Apurcrossan** | The monks' cattle-raid by Gaels from the hills; they ask the Northmen to get them back | A Gaelic poet who wants a Norse patron |
| **Tarbat** | The horsemen you scouted come to the shore: a Pictish fight on horseback | The stone-carvers: buy a carved stone for your father's grave |
| **Hvítaærn (Whithorn)** | The treasury door you saw: it has been moved, and a pilgrim knows where | The Galloway Gall-Gáedil, part Norse and part Gael, offer a félag |
| **Sceilig Mhichíl** | If you climbed: the monks remember you, and one of them is ill with something they can't treat | A storm-trapped week on the rock, with the monks' food |
| **Saint-Denis** | The fair again: the monks' toll-men cheat you, or you cheat them | The abbot's ransom (Louis, abbot of Saint-Denis, was ransomed in 858 for 686 pounds of gold and 3,250 of silver) |
| **Breiðafjörðr** | The neighbour you settled beside wants a boundary drawn | A whale on the shore, and who it belongs to |

### The 7 two-scene places
Gotland, Færeyjar, Clonmacnoise, Hamwic, Corcach, Jumièges and Fontenelle each get one more scene. The pattern is the same: a return beat that reads the earlier choice.

### Hooks: why a life goes there
New scenes at far-off places are useless if no one goes.
- **Rumours:** each place's second scene is advertised by a rumour at the place that tells of it, through the existing `listen` system.
- **Chronicle:** the Alt Clut siege and the Saint-Denis ransom are chronicle entries. They become scenes when the hero is there in that year.

### Built (2026-10-28)
33 scenes, plus 4 rumour hooks, in `world/places4.yaml`. Measured over 60 lives: 8 of 11 places see a second scene, and the never-seen share is unchanged at 21%.

### Size and target
- **Size:** about 29 scenes, roughly 12,000 words. No engine work, unless the Saint-Denis ransom needs a ransom mechanic. It doesn't: it's a scene choice.
- **Target:**
  - in 60 bot lives, at least 8 of these 11 places see a second scene;
  - the never-seen share of scenes does not rise above today's 21%.

---

## Step 2: The East road (Austrvegr)

### Why
- **Silver.** Most of the silver in Viking Scandinavia came from the east: Islamic coins (dirhams), paid for furs and slaves on the Russian rivers. Hoards on Gotland alone hold tens of thousands.
- **Trade.** The game has a silver economy with no source for its silver, and trade with no far destination.
- **History.** It is the largest historically important thing the game leaves out.

### The shape
It is built as an expedition off the map, like the 844 voyage south: a chain of scenes, with days passing (`days_foraged`). The rivers are not drawn.

**1. The door.**
- Aldeigjuborg (Staraya Ladoga) becomes active.
- It is reached by an expedition leg from Birka or Gotland, once rumoured. Birka already rumours it.
- At Aldeigjuborg the arrival scene offers the river road.

**2. The ship rule.**
- Only a karvi or smaller can go up the rivers, because the portages need a ship men can drag on rollers.
- A larger fleet waits at Aldeigjuborg, or goes home.
- A new condition (`ship.portable`) gates the choice. Its text explains why.

**3. Two roads.**

| | **Dnieper: Miklagarðr** | **Volga: the silver** |
|---|---|---|
| Route | Lovat, the portages, Kiev, the rapids, the Black Sea | Volga, Bulghar, the Khazars' city at Itil, the Caspian |
| Character | Fighting, glory, the emperor's city | Trade, long distance, the most silver |
| Anchors | The Rus attack on Constantinople, 18 June 860 (Photius's sermons); Askold and Dir at Kiev (Primary Chronicle, later) | Ibn Khordadbeh (c. 870): Rus merchants carry furs and swords to the Caspian and on by camel to Baghdad; they say they are Christians to pay the lower tax |
| Danger | The rapids and the Pechenegs at the portages (later source, used as colour); the emperor's fire-ships | Khazar tolls, the Caspian, being cheated a thousand miles from anyone who knows your name |
| Return | Silk, silver, a Greek sword, fame | Dirhams by the sack, silk, a much smaller crew |
| Scenes | About 9 | About 8 |

**4. Time.**
- A road takes a summer out and a winter at the far end (Kiev or Itil), and comes back the next summer.
- The life is away from home for over a year: hardship at home runs, and the wife and the farm hear nothing. That cost is the point.

**5. Goods.**
- Out: furs and captives, sold at the far end.
- Back: silk and silver, already in the goods registry.
- Two new goods are possible: Greek glass and Islamic silver as a trade good. I'd rather keep dirhams as plain silver by weight, which is how the Norse treated them.

**6. Eras.**
- **830 lives:** reach it after about 835. The Annals of St-Bertin (839) record Rus envoys at the emperor's court: an early anchor for a rumour.
- **843 lives:** the main audience.
- **865 lives:** late; Kiev is already Norse-ruled.
- The 860 attack scene only fires in 860.

**7. Hooks.**
- A Swedish trader at Birka or Hedeby who has been.
- The `ru_` legends: Rurik is in the chronicle (862).
- A sworn man of the ambitious temperament who wants to go. A crew-scene hook already exists for this.

### Built (2026-10-28)
21 scenes in `world/east.yaml`. Changes from this frame: a fleet can't leave ships at Aldeigjuborg (the door just asks for one light ship); a Swedish convoy at Birka or Gotland takes a first-timer across; ports where an expedition starts now sell 40 days' food. Measured: 6 of 60 843 lives take the road, all come home.

### Engine work (small)
- Activate Aldeigjuborg, and add an expedition leg from Birka.
- The `ship.portable` condition (karvi or smaller, one ship).
- If a fleet is left behind, a "leave the other ships at Aldeigjuborg" choice.
- The off-map passage reuses `days_foraged`.
- A bot policy that takes the road now and then, so it gets measured.

### Size and target
- **Size:** about 18 scenes (two openers, about 9 and about 8 per road, the return), roughly 9,000 words.
- **Target:**
  - **Trade return:** a Volga round trip pays 1.5–2× a good raiding summer for the time spent. It takes two seasons, so per year it is close to raiding.
  - **Risk:** the Dnieper's death risk is about that of a Seine summer.
  - **Reach:** in 60 bot lives (843 start), at least 5 take the road.

---

## Assumptions and risks
- **Sources.** Primary sources for the 9th-century rivers are thin. Ibn Khordadbeh and Photius are contemporary. The Primary Chronicle and Constantine VII's rapids are 10th–12th century, and appear only as colour, as the men telling it.
- **Content lines.** The slave trade was the core of this route. It is shown honestly, as the style guide's rules on thralls require, and never as a picked-up commodity screen: captives are already a number, and the text names what that means.
- **Balance.** If the Volga pays too well, it becomes the dominant strategy. The year-plus absence and the crew losses are the brake. This is measured before it ships.
- **Reach.** Like Iceland, this can end up unseen content. The hooks (a trader, a crewman, rumours) are part of the build, not an afterthought.

## Out of scope
- Drawing the rivers on the map.
- Service in the Varangian guard: that is 10th century.
- The Mediterranean voyage, which is step 3, framed separately.
