# The Foundation: Discovery, Kit, the Base, and Play Beyond the Story

**Status:** built on the author's instruction (2026-10-13): "Go ahead, build all of those. Then we need to set up the main foundation of the game so that once we get past the written story so far, you can still play through generic play like raiding, building up your name, crew, ship, riches. … You need to have a base."

---

## 1. Discovery
- **A new life knows six places:** Hordaland (home), Avaldsnes, Shetland, Orkney, Iona and Bangor.
- **Ports tell you of their neighbours.** On the first landfall at a port, its people tell of one or two places nearby. The lists are written by hand (`tells:` in `places.yaml`), so each place comes with how you heard of it.
  - Friendly and allied ports tell you everything on their list. Wary and unfriendly ports tell you one. Hostile ports tell you nothing.
  - What you are told is **charted**: you know the sea road.
- **Rumours.** At halls, markets and towns you can **listen to the old sailors**, once a year per port, for the price of a round of ale. A rumour puts a far place on the map as **rumoured**: drawn faint, with no known sea road. Lore helps you get a rumour at all.
- **Expeditions.** A rumoured place can be reached only by an expedition across uncharted water, from a port that has an expedition road to it (`expedition: true` legs).
  - **Before you can set out:** at least 40 days of food, a sound hull, and a ship of your own.
  - **On the way:** expedition events break in, and storms are 50% more likely.
  - **If you arrive:** the place is charted for good, and you earn a "first to sail to…" deed.
  - **The first expedition is the Faroes.**

## 2. Kit, ship and the men's gear
- **Items** (`content/registry/items.yaml`), in four kinds:
  - **Weapons:** spear, axe, seax, sword.
  - **Armour:** shield, helmet, mail.
  - **Keepsakes:** what the story gives him.
  - **Ship fittings.**
- **What he carries:** the hero owns item instances and equips one weapon, one shield, one helmet and one body armour. His duel and battle numbers come from what he has equipped. The old `b_sword`, `frankish_sword` and `mail` flags become items.
- **Where to buy:**
  - **Home:** the smith (spear, axe, shield, helmet) and the shipwright (ship fittings).
  - **Markets** (Kaupang, Avaldsnes): also mail, a Frankish sword, and fittings.
- **Ship fittings:**
  - a new sail (10% faster);
  - caulking and new strakes (storms do 40% less damage);
  - a carved prow (the enemy's spirit starts lower in every fight);
  - a shield-rack (a better fight at sea).
- **The men's gear,** 0 to 3: spears and shields, then helmets, then mail in the front rank.
  - **Separate from experience:** it multiplies their strength in the wall.
  - **Raised** by arming the men (at home or a market), and a little by stripping a won field.
  - **Diluted** by raw recruits.

## 3. Named weapons
- **Counting:** every weapon counts its deeds (duels won, champions killed, fights won in the front rank or the wall).
- **The naming:** at five, the men name it, from period names fitted to its kind and what it has done.
- **What a name gives:** a deed; a share of extra fame on later fighting deeds done with it; the skald can sing it.
- **Taken weapons:** a weapon taken from a famous man comes with deeds already counted.

## 4. The base
- **Three steps:**

  | Base | How he gets it | Thralls it can work |
  |---|---|---|
  | **His father's farm** | Where he starts | 4 |
  | **A farm of his own** | Buy one (8 marks), build a house across the fjord (in the story), or take up Þórunn's offer on Skye (later) | 6 |
  | **A hall** | Build one on his farm (24 marks, and a name men know) | 12 |

- **What a base holds:**
  - **His wife,** if he has married. She runs the place while he is away, and adds to its yield.
  - **Thralls:** captives he keeps instead of selling. They work the land for silver every winter. They can run, sicken, or be freed.
  - **Trophies:** keepsakes he hangs on the wall. A hall full of trophies adds to the fame his feasts bring.
  - **Riches:** the hoard he keeps there.
- **What a hall adds:**
  - one more thing to do each winter;
  - feasts that tell his deeds better;
  - more men coming to his muster.
- **The Home tab** shows all of it.

### 4.2 Wives (built)
Gyða is the story's. Three more are for the years after it, one betrothal at a time. Each is met, asked for, and brought home to a wedding at the winter nights.

| Wife | Where | What she asks | What she brings |
|---|---|---|---|
| **Gyða Bárðardóttir** | Home | Bárð's price (2–4 marks), or eloping. If the story leaves it open, Bárð comes for an answer in winter 832 | Love, and nothing else |
| **Ingibjörg Hareksdóttir** | Birsay, Orkney | A ship of his own, 6 marks, and a name (living fame 20) | 3 marks of dowry; standing with Orkney +3 and Shetland +1; a deed worth 4 |
| **Þórunn Kolbeinsdóttir** | Skye | Her terms: she keeps her wool money and runs the farm while he is at sea | Her valley sold to buy a farm (or 6 marks if he has one); two thralls; standing with Skye +3 |
| **Ásta, the silversmith's widow** | Kaupang | Collect twelve marks from Ívarr the Dane (a duel), or put 4 marks in her strongbox | 10 marks; standing with Kaupang +3 |

Married, a son may be born (named for his father, for Ormr, or his own name), then a daughter. A wife at his father's farm will push him for a farm of his own.

## 5. Play beyond the written story
After spring 832 the sandbox carries on, with content that repeats:
- **Sea events:** a merchant to trade with or rob, a rival ship, wreckage, a man overboard, a whale-stranding, and so on.
- **Port events:** a market rumour, a feast invitation, a fight on the beach.
- **Winter events:** a sickness, a thrall's escape, a wedding among the crew, a skald's visit, an old man's death, a horse-fight.
- **A Yule every year:** the boasts are reckoned and new ones sworn, from a pool.
- **Measured:** ten-year bot lives must keep meeting content, not just empty sailing.

### 5.1 What was built
- **Sea (6):** a fat knarr (trade, rob, let go), a rival crew, wreckage with survivors, a man overboard, a stranded whale, a flat calm.
- **Port (5):** a cargo to carry (or steal), a feast invitation, a fight on the beach, the district champion's challenge, a slaver at the market. These fire in any port, scaled by standing there; the written place scenes always go first.
- **Winter at home (11):** Yule, a son, a daughter, a wife's word, a thrall who runs, a thrall who buys his freedom, the coughing sickness, a crew wedding, a wandering skald, an old man's land, the horse-fight.
- **Spring:** while he still rows for another man, a ship for sale each year (8 marks), or the jarl's old karvi for a quarter of the plunder. The captain he rows for now fills his benches each spring, so service does not wither.
- **Yule every year:** last year's boasts are reckoned aloud (kept, broken, still open), and new ones sworn from a pool: two raids, ten marks of plunder, two shield-walls won, a duel won, land of his own, a hall, a wife, three ships. The engine keeps them when the goal is met; the Saga shows how far along a counted one is.

