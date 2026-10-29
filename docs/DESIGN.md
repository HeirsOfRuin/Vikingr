# DESIGN — Vikingr

Status: **Phase 1 built (2026-10-11):** engine, map, instruments and placeholder UI. See "Phase 1 as built" before the decisions log. Next: Phase 2, the one-year vertical slice.

## Context
This is an RPG about one man's life in the 9th century. He starts with nothing, builds fame and renown, becomes a sea king, and tries to earn his way into Valhalla. The aim is to be the greatest living legend of the 800s.

It is the fifth game in the HeirsOfRuin set. It reuses the tooling and process of **Knight of Adalia**: a pure engine, YAML content, a validator, a bot and a PWA on Pages. It reuses the combat-resolution principle of **Free Company**: one `resolveRound()` serves fighting by hand, auto-resolve and the measurement harness. It does not reuse either game's content, world or balance numbers.

---

## 0. Decisions already made (2026-10-11)

| Question | Decision |
|---|---|
| Platform | HTML, installable PWA, phone first, same as the earlier games |
| Form | A sea map you travel freely, with the story told through scenes and events. Turn-based throughout; nothing happens in real time. |
| Campaign | One long life, not a roguelite |
| Depth | Deeper than two phases a year. The character, his relationships and his actions should carry real investment. |
| Combat | A core pillar, in three layers: single combat, shield-wall, raid |
| Mythology | Always present, never confirmed. Grounded, with ambiguity. |
| Setting | The real 9th-century world: real geography and real historical events and figures |
| Starts | 3 backgrounds with distinct first years that merge into one shared life |
| Personal combat | A full layer of its own, not occasional |
| Start | 830, aged 16. He grew up on the stories of the first raids and the silver they brought home. |
| Slavery | Present, as a player choice, never required, never glorified, with consequences |
| Tone | Brutal, realistic and gory, cut with humour, glory, valour, brotherhood, love and comedy. Touchstones: *Vikings*, *The Last Kingdom*, and the sagas themselves. See §1a and `content/style-guide.md`. |

---

## 1. Design pillars

1. **Fame is given, not hoarded.** A lord was praised as a ring-giver. Silver in a chest earns nothing. Silver given away becomes loyalty, followers and verses. This is the core loop.
2. **You win by dying well.** Valhalla takes the battle-slain. The stronger he gets, the harder a good death becomes. The late game is about choosing when and how the story ends.
3. **Fame exists only when it is told.** Deeds become fame when a skald composes them, a feast hears them, or traders carry them. Deeds no one tells fade.
4. **Every fight puts him at risk.** He chooses where to stand: front rank, in the wall, or behind it. Fame and danger come together. Wounds stay with him.
5. **The men have names.** The sworn men are people with temperaments, oaths, grudges and ambitions. Most stories come from them.
6. **The gods are in the weather.** Every omen has an explanation without the gods. The game never says which reading is true until the very end.
7. **The century moves without him.** Dublin is founded, Paris burns and the Great Army lands whether he is there or not. Historical figures compete with him for fame.

## 1a. Tone

**Brutal and funny in the same breath.** The touchstones are *Vikings* and *The Last Kingdom* for energy and the Icelandic sagas for voice. The sagas are the model for the mix: men die mid-sentence with a joke. Atli in *Grettis saga*, run through with a spear, remarks that broad spears are in fashion these days, and falls dead.

| Element | How it shows up |
|---|---|
| **Brutality and gore** | Wounds are anatomical and specific. Fights are short, ugly and decided by small things. The aftermath is shown: the smell, the flies, the wound that goes bad a week later. |
| **Humour** | Comes from people, not from the narrator: banter at the oars, insults, drink, bad luck, the crew's running jokes, the hero's own failures. Never anachronistic. |
| **Glory and valour** | Earned by cost. A scene earns its glory by showing what was risked. |
| **Brotherhood** | Shown in acts: the last water shared, a wounded man carried to the ship, an oath kept when breaking it would pay. |
| **Love** | The wife, the children, a lover, a blood-brother. Physical, unsentimental, real, and with real stakes: they can be lost. |
| **Comedy** | Allowed to be broad at the feast and in the hall. A drunk boast that must then be honoured is a classic engine. |

### Systems that carry the tone
- **Nicknames.** The hero and his named men earn nicknames from what they do, the way history gave us Ironside, the Boneless and Hairy-breeches. Some are glorious and some are humiliating, and the player does not choose. The nickname appears in the saga and in how others address him.
- **Flyting and man-matching** (*senna*, *mannjafnaðr*). A hall contest of insults and boasts, played as a short exchange in the duel style with words instead of stances. Winning gives fame and laughter; losing can start a real fight.
- **Boasts** (*heitstrenging*). A drunk vow at the feast becomes a queued obligation. Keep it and it is a deed. Break it and the hall remembers.
- **Crew banter.** Short lines from named men between legs and after fights, chosen by temperament and recent events. This is the cheapest and most frequent source of warmth and humour.

### Content lines
- **Sexual violence** was part of raiding. It is **acknowledged** in implication and aftermath, **never depicted**, and **never a player action**.
- **Killing children** is never shown or offered.
- **Torture** happens and is shown with its weight. The **blood eagle** is treated as the sources leave it: possibly real, possibly a skald's image, which suits the ambiguity pillar.
- **Thralls** are people with names when the story meets them. Their treatment is shown honestly. Freeing them is possible and has its own consequences.
- A single **content note** on the title screen. No gore slider, so there is one text to write and test.

### Where the touchstones are not followed
The shows compress and invent history. This game does not: no horned helmets, no Ragnar as a farmer in the 790s, no Lindisfarne and Paris in the same decade. The energy is borrowed; the history is not.

---

## 2. Stack

Same as Knight of Adalia. Each choice was right there for the same reasons, and the tooling already exists.

| Choice | Decision | Why |
|---|---|---|
| Language/build | TypeScript (strict) + Vite | Builds to static files that work offline on any static host. Large enough to need modules and types. |
| UI | Preact + `@preact/signals` | Small. The map, combat and hall screens are separate components. |
| Map rendering | Canvas 2D | Pixel-art terrain painted once, with overlays drawn on top. Same approach as Adalia's `worldart.ts`. |
| Content | YAML authored, compiled to one JSON bundle at build time | Prose is easier to write in YAML. The validator, bot and tests all read the same bundle. |
| Schema | Zod | One definition gives both the TypeScript types and runtime validation. |
| Tests | Vitest | |
| Deploy | GitHub Actions to Pages, installable PWA, offline after the first load | Same workflow as Adalia |
| Saves | localStorage autosave, plus save-as-text codes | Same format family as Adalia (`VIKR1.` + base64url of deflated JSON) |

**Not single-file.** Silk Road and Free Company were single files because of their constraints. This game is larger than Adalia, so it needs the build step.

---

## 3. Architecture

Three layers. Imports only go downward.

```
UI (Preact)  ->  Engine facade  ->  Engine modules (pure)  ->  Content bundle (data)
                       ^
     tools/ (validator, linter, bot, measure-*) use the engine directly in Node
```

**Engine rule (from Adalia):** every function is pure, `(state, input, content) -> newState`. No DOM, no `Date.now()`, no `Math.random()`. The seeded RNG state lives in the save, so reloading cannot reroll an outcome.

**One code path rule (from Free Company):** a fight played by hand, a fight auto-resolved and a fight run 10,000 times by `measure-combat` all call the same `resolveExchange()` / `resolveRound()`. Auto-resolve is a *policy*, never a second formula.

**One derivation rule (from the Silk Road and Cradle post-mortems):** every number the UI shows, such as odds, fame rank or crew morale, is computed by the same function that resolves it.

### Facade API
```ts
newGame(content, { background, seed, name }): GameState
view(content, state): View        // the current screen: scene | map | hall | duel | battle | raid | death
act(content, state, action): { state, result }
```

### Engine modules (`src/engine/`)

| Module | Responsibility | Phase |
|---|---|---|
| `rng.ts` | sfc32 seeded PRNG (from Adalia) | 1 |
| `calendar.ts` | Days, seasons, years, sailing season, ageing | 1 |
| `conditions.ts` / `effects.ts` / `checks.ts` / `text.ts` | Content grammar (from Adalia, extended) | 1 |
| `director.ts` | Scene and event selection: queued, spine, pool, place-bound | 1 |
| `map.ts` | Place graph, sea legs, travel time, weather, known places | 1 |
| `voyage.ts` | Daily sailing: wind, provisions, storms, landfall | 1 |
| `hero.ts` | Attributes, skills, use-based learning, wounds, ageing, death | 1 |
| `fame.ts` | Deeds, telling, fading, verses, fame rank against historical rivals | 1 |
| `silver.ts` | Silver by weight, loot, shares, gifts, upkeep | 1 |
| `crew.ts` | Unnamed crew (numbers, quality, morale) and named sworn men | 1 |
| `ships.ts` | Ship types, condition, repairs, building | 1 |
| `duel.ts` | Single combat: exchanges, stances, shields, wounds | 1 |
| `battle.ts` | Shield-wall: rounds, orders, morale, where the hero stands | 1 |
| `raid.ts` | Approach, assault (uses `battle.ts`), plunder against the alarm | 2 |
| `people.ts` | Key NPCs, trust and respect, agendas, marriage | 2 |
| `feud.ts` | Kin-groups, blood debts, wergild, revenge scheduling | 2 |
| `omens.ts` | Omens and prophecies generated from real future state (§12) | 2 |
| `history.ts` | Historical timeline, rival legends, opportunities that open and close | 2 |
| `rank.ts` | Rank ladder and recognition (§8) | 2 |
| `judgment.ts` | Death classification, afterlife, saga assembly | 2 |
| `save.ts` / `savecode.ts` | Versioned saves, migrations, text codes | 1 |

---

## 4. Time

Time is a calendar measured in days. What the player does uses up days. There are no fixed rounds.

### The year
| Season | Months (approx.) | Where | What happens |
|---|---|---|---|
| **Spring muster** | Mar–Apr | Home | Recruit, refit ships, take oaths, choose the summer's venture. 1–3 actions. |
| **Sailing season** | May–Sep | **Map** | Travel, raid, trade, visit, fight. Days pass per leg and per action. Storm risk climbs from mid-September. |
| **Autumn return** | Oct | Home | Divide the loot (the share-out), hold the homecoming feast, settle accounts, hear what the men think of the summer. |
| **Winter hall** | Nov–Feb | **Hall** | 4–6 actions: feasts, gift-giving, a Thing, courtship, training, ship-building, healing, a blót, a visit to a jarl, a skald composing. Winter events. |

- Sailing out of season is allowed. It is very risky, and sometimes a scene requires it.
- **Quiet years can be passed quickly:** "Stay home this year" resolves the year with a short summary and lets events interrupt.
- **Pacing target:** a typical life of about 35–40 years takes about 8–15 hours of play. The first decade gets the most detail. Later years compress, because his men can carry out routine ventures.

### Age and dates
- **Start year:** **830 at age 16** (recommended; see §16). That puts him at 31 for Paris (845), 46 for the Mediterranean expedition (859) and 51 for the Great Army (865). He can be present at the peak of the century as a grown man.
- Ageing worsens recovery after 35 and attributes after 45. The risk of a "straw death" (dying in bed of illness or age) climbs after 50. He usually feels the clock before it runs out.

---

## 5. The map

### Geography
- **Real coastlines.** Natural Earth land polygons (public domain) are projected and rasterised to a tile grid by a committed generator, `tools/build-map.ts`. Both the generator and its output are committed (failure mode #13).
- Terrain is pixel art painted on canvas with a palette per biome: fjord, moor, forest, farmland, marsh, ice and sea depth. This is the same approach as Adalia.
- **Places, not a full sandbox world:** about 30 named locations at full scope. Each is a node with a kind (home, hall, market, monastery, town, island, river-mouth, open-sea landmark) and an owner. Its state changes over time, for example how much it has been raided and how well it is defended.

### Places (full scope; the Phase 2 slice is in bold)
| Region | Places |
|---|---|
| West Norway | **Home fjord (Hordaland)**, **Karmøy / Avaldsnes**, Hlaðir (Trøndelag) |
| Vik and Denmark | Kaupang (Skíringssalr), Hedeby, Ribe |
| Baltic and East | Birka, Uppsala, Gotland, Truso, Aldeigjuborg (Staraya Ladoga) |
| Atlantic islands | **Shetland**, **Orkney**, Faroes, **Hebrides (Iona)**, Isle of Man |
| Ireland | **Ulster coast monastery (Bangor)**, Dublin (from 841), Armagh, Clonmacnoise |
| Britain | Lindisfarne, York, Thanet / Sheppey, London, East Anglia |
| Frisia and Frankia | Dorestad, Walcheren, Noirmoutier, Nantes, Rouen, Paris |
| Late-game reach | Seville, the Mediterranean, the Dnieper route to Miklagarðr (Constantinople) |

### Travel
- **Sea legs** connect places, each with a base distance in days. There are two kinds:
  - **Coastal:** safer, slower, and needs places to put ashore.
  - **Open sea:** faster, with storm and navigation risk. An example is Norway to Shetland, about 2 days with a fair wind.
- **Rivers:** Seine, Loire, Liffey and Shannon are traversable by longship. Rowing upstream is slow, and the men tire.
- **Each leg** is resolved day by day: wind (rolled per leg, with persistence), provisions consumed, storm checks, and encounters (other ships, coastguards, wreckage).
- **Choices while sailing:** press on, put ashore, wait for wind, or turn back. These are the map's main decisions.
- **Places become known** through travel, rumour, trade and the people he knows. Unknown places do not show on the map.

---

## 6. The hero

### Attributes (1–5)
**Strength, Agility, Endurance, Wits, Presence.** Every background starts with a total of 11.

### Skills (0–10, improved by use with a ceiling set by training, as in Adalia)
| Skill | Covers |
|---|---|
| **Weapons** | Sword, axe and spear in single combat |
| **Shield** | Guarding, the wall, holding a line |
| **Seamanship** | Steering, weather, navigation |
| **Command** | Leading the wall, keeping men in hand |
| **Cunning** | Ruses, scouting, approaches, reading an opponent |
| **Speech** | Persuasion, the Thing, negotiation, oaths |
| **Trade** | Prices, haggling, ransom |
| **Lore** | Runes, law, the old stories, omens |
| **Craft** | Repair, ship-building, smithing (minor) |

### Body
- **Wounds:** a wound track plus named injuries, each with a mechanical effect and a duration, or permanent. Examples: lost eye (−reading the enemy, +fearsome), bad knee, broken hand, cracked ribs, a scar across the face.
- **Scars are deeds.** Every permanent wound is recorded as a deed in its own right, with the fight that gave it.
- **Health declines with age**, and recovery from wounds slows.

### Hamingja (luck)
- A hidden value, never shown as a number.
- **The UI reports it as what people say:** "the men say your luck is strong" or "they no longer look you in the eye."
- **What it does:** it shifts outcomes slightly (storm checks, critical wounds, omen accuracy) and it drives crew morale.
- **What raises it:** victories, a good blót, gifts honoured, oaths kept.
- **What lowers it:** a broken oath, a kinslayer's guilt, defeats, insulting a seeress.

---

## 7. Fame, honour and silver

### Deeds and fame
- A **deed** is created by an action. It records a type, a place, a date, witnesses, and a base weight.
  - *Examples:* first man over the rampart at Bangor; slew a champion in a holmgang; sailed to Orkney in October; gave his own arm-ring to a wounded man.
- A deed adds to fame **only when it is told.** There are four ways:
  1. **A skald composes verses** about it. This is the strongest and most permanent, and needs a skald in his household or as a guest.
  2. **It is told at a feast.** Hall feasts tell the year's deeds.
  3. **Witnesses carry it.** Surviving crew and enemies spread it at markets and Things. It is weaker and decays.
  4. **The deed is famous enough to tell itself.** Paris-scale deeds do this.
- **Untold deeds fade.** After about 2 years with no telling they drop out of fame. They stay in the hero's own memory, and the end-of-life saga includes them.
- **Two measures:**
  - **Living fame:** the current score, with decay. It ranks him against the historical figures (§13).
  - **Lasting fame:** composed verses only. This feeds the Valhalla judgment and the saga.

### Honour (separate axis, −10 to +10)
- **Raised by:** keeping oaths, generosity, paying debts, mercy to the defenceless where custom expects it, avenging kin.
- **Lowered by:** oath-breaking, stinginess, killing at night or by stealth (*morð*, which is murder, not killing), cowardice seen by others, failing to avenge kin.
- **Fame and honour are independent.** A famous oathbreaker is possible, and men will follow him for silver and despise him for it.

### Silver
- **Silver by weight.** It is stored internally as an integer number of *ørtugar*. It displays as marks and aurar (1 mark = 8 aurar = 24 ørtugar). Hacksilver, coins and rings are all just weight. Arm-rings are gift objects with a fame bonus when given.
- **Sources:**
  - plunder;
  - trade margins;
  - ransom of hostages;
  - tribute and Danegeld;
  - service to a foreign king (Irish and Frankish rulers hired Norse fleets);
  - thralls (see §16).
- **Sinks:**
  - the crew's shares;
  - gifts;
  - feasts;
  - ship-building and repair;
  - wergild;
  - bride-price (*mundr*);
  - sacrifices;
  - upkeep of the hall and men.
- **The ring-giver loop:** gifts to named men raise loyalty. Gifts at feasts raise fame and honour. Silver held beyond a threshold relative to his rank produces "stingy" talk, which costs loyalty and honour. This makes hoarding a mistake.

---

## 8. Rank ladder

Ranks are recognition, not offices. The engine checks holdings and reputation; other people decide whether to recognise them.

| Rank | Means | Typical gate |
|---|---|---|
| **Oarsman** (*háseti*) | Rows in another man's ship for a share | Start |
| **Sworn man** (*hirðmaðr*) | Has given an oath to a chieftain and is fed and gifted by him | A chieftain accepts the oath. Weapons 2+ or a deed. |
| **Ship's captain** (*styrimaðr*) | Commands a ship and its crew | Owns or is given a ship, holds a crew through one season |
| **Hersir** | Local war-leader with a hall, land or followers | A hall, about 60+ men across ships, fame threshold, recognised at a Thing |
| **Jarl** | A great lord, by a king's grant or by his own power | Several ships, sworn hersar or equivalent, a king's recognition **or** enough power that none challenge it |
| **Sea king** (*sækonungr*) | A king of men and ships with no land kingdom | A fleet (5+ ships), no lord above him, the title used of him in verse |

The **land-king path** (taking a kingdom such as Dublin, York or a Norwegian petty kingdom) is an alternative late-game branch, not the main line.

---

## 9. Crew, ships and the sworn men

### Ships
| Type | Oars | Crew | Notes |
|---|---|---|---|
| *Færing* / small boat | 4–6 | 4–8 | Prologue and fishing only |
| *Karvi* | 26–32 | ~30 | A chieftain's working ship. Shallow draught, good on rivers. |
| *Snekkja* | ~40 | 40–50 | The standard warship |
| *Skeið* | 60+ | 60–80+ | Great warship. Expensive, slow to build, a statement. |
| *Knarr* | few | 6–12 | Cargo. Deep and seaworthy, poor in a fight. |

All numbers are provisional. Each ship tracks hull condition, sail, provisions and its crew.

### Unnamed crew
Each crew is tracked as a group: **count**, **quality** (green, blooded or veteran), **morale** and **share expectations**. Men leave if a season pays less than they expected.

### Named sworn men (the hirð)
- **6–12 named men** at full scope, 4 in the Phase 2 slice.
- **Each has:**
  - **temperament:** hot, steady, greedy, pious, ambitious or dour;
  - two notable skills;
  - **loyalty** (0–10);
  - a **grievance list**;
  - their oath status;
  - relationships to each other and to the hero.
- **What they do:**
  - fight beside him, with their position chosen in battle;
  - give counsel before decisions, often disagreeing;
  - ask for things: a ship of their own, a bride, revenge, a larger share;
  - die, which creates a deed, a grief event, and possibly a feud.
- **Archetypes the cast includes:**
  - one **blood-brother candidate** (the *fóstbræðralag* rite of mixing blood under raised turf);
  - one **future rival**, who may break away or betray him;
  - one **berserkr**, rare and frightening, and possibly mad.

---

## 10. People and relationships

### Key NPCs
Each tracks **trust** and **respect** separately (−5..+5) and has an agenda that advances on the calendar whether the player engages or not.

| Role | Function |
|---|---|
| The jarl patron | First lord. Opens doors, then becomes something to outgrow or overthrow. |
| The wife | A marriage alliance. A political choice with her own kin, ambitions and agency. Possibly a second marriage later. |
| Children | Sons and daughters who grow up. Possibly heirs, hostages, warriors, or a daughter's marriage alliance. |
| The skald | The fame engine. Can be lost, insulted or lured away. |
| The völva (seeress) | Prophecy (§12). Respected and feared. |
| The lifelong enemy | Born of a feud or a rivalry. Recurs across decades. |
| Foreign rulers | Irish kings, Frankish counts, Northumbrian ealdormen. Enemies, employers or both. |

### Feud
- A killing creates a **blood debt** owed to the dead man's kin-group.
- **Ways to settle:** pay wergild (honour-neutral if offered properly), take outlawry, or wait for revenge.
- **Revenge is scheduled:** the director queues it with a delay of years, weighted by the kin's power and his visibility. This is the Adalia queued-event system applied to feuds.
- Feuds can be **inherited**, by him from his father's quarrels, and by his sons from his.

### Marriage
- **Bride-price**, **the bride's kin as allies**, and a **dowry** (*heimanfylgja*).
- **The wife runs the household** while he is at sea. Her skill and loyalty affect the hall's income and safety.
- **Divorce was possible** and is handled as a story outcome, not a menu option.

---

## 11. Combat

Three layers. All are turn-based, all share the wound system, and every fight offers **"let the men handle it"**, which runs the same code under a policy.

### 11.1 Single combat (`duel.ts`)
Used for holmgang, duels, champion fights, killings at feasts, and the first man over the wall.

- **Exchanges.** Each exchange, both fighters choose one of five actions:

  | Move | Beats | Loses to |
  |---|---|---|
  | **Strike** | Feint (catches it) | Guard |
  | **Guard** (take it on the rim and turn it) | Strike | Feint |
  | **Feint** (draw the guard up, cut under) | Guard | Strike |

  Cut from five moves to three on 2026-10-11 after the calibration playtest: five felt like too many options on a phone. Shield-bash and Bind folded into Guard, which now turns the blow on the rim (Ormr's trick) and staggers the attacker. Wins are not equal: a won Strike wounds badly, a won Feint cuts and tires, a won Guard ripostes and tires. Shields still break: a turned strike costs the guard one blow, and a trade of strikes costs both.
- **Resources:** stamina, **shield integrity** (shields break, and holmgang allows a fixed number, three by the customary rules), and wounds.
- **Reading the opponent.** Each opponent has habits, such as favouring the strike or tiring after round 4. Wits + Cunning reveals them over the exchanges. A lost eye reduces this.
- **Holmgang rules as custom tells them:** fought on a cloak, three shields each, and the first to bleed on the cloak may yield and pay the *holmlausn* (three marks of silver). Yielding costs fame and honour. Fighting on risks death.
- **Death is possible and signposted.** Every lethal fight is marked before it starts (Adalia's lethal-check rule). The validator enforces this.

### 11.2 Shield-wall (`battle.ts`)
Used for pitched fights, defending a beach, and the assault phase of a raid.

- **Rounds.** Each round, each side picks an order:
  - **Hold**;
  - **Push**;
  - **Missiles** (spears, stones, arrows);
  - **Swine-array** (*svínfylking*, a wedge);
  - **Give ground**;
  - **Flank**, if numbers allow.

  Orders counter each other on a table, with terrain modifiers: beach, ford, rampart, woodland or ship-to-ship.
- **State:** men, morale and cohesion per side. A side breaks on morale, not when the last man dies.
- **Where the hero stands** is chosen before the battle and can be changed between rounds:

  | Position | Fame from the fight | Risk to him | Effect |
  |---|---|---|---|
  | Front rank | High | High | +morale, +push, and his own duel moments may trigger |
  | In the wall | Moderate | Moderate | +cohesion |
  | Behind the wall | Low | Low | +command (better orders, sees more). Men notice if he always stands here. |

- **Named men** are placed in slots beside him or on the flanks. Each round produces short log lines naming who did what. **These lines are the raw material for deeds and verses.**
- **Moments.** In some rounds the battle zooms into a short duel exchange (11.1): their champion seeks you out, or the standard-bearer falls.

### 11.3 Raid (`raid.ts`)
1. **Approach.** Scout first or go blind. Strike at dawn, row upriver, pose as traders, or land at night. Wits + Cunning + local knowledge decide surprise.
2. **Assault.** A short shield-wall (11.2) against the defenders the approach left awake. Surprise can skip it entirely.
3. **Plunder against the alarm.** Each round, take more silver, goods, livestock or captives, while the alarm clock advances. When it fills, the local levy arrives. Leave in time, or fight a second, worse battle.
4. **Aftermath.** Burn or spare, take hostages for ransom, and decide how the place remembers you. Places remember: defences rise and silver moves elsewhere.

### 11.4 Measurement (from day one)
- `tools/measure-duel.ts`: a win-rate matrix by fighter profile, with exchange counts. It asserts that exchanges happened (failure mode #2: a harness that measures nothing).
- `tools/measure-battle.ts`: win rate and losses by order mix, terrain and odds. The hero's death rate by position, which must differ measurably (failure mode #8).
- `tools/measure-raid.ts`: plunder against losses by approach and greed.

---

### 11.5 Standing in the ports (`standing.ts`, decided 2026-10-12)
Every port has one number for what it thinks of him, from −10 to 10. Everything the port will or won't do for him comes from that number. The author's brief: "events like allowing you to dock, resupply, recruit, or to be attacked on sight if you try to land should be derived."

**Where it starts.** Each place has a people (Norse, Danish, Swedish, Gael, English, Frisian, Frankish, Baltic, Rus), and each people has a usual starting point. Norse ports start at 2, Gaels and the English at −2. A place can override this from its own history: Orkney starts at 3 (Harek), Conaille at −4 (the king who hanged Norse traders), and home is always 10.

**The tiers:**

| Tier | Standing | Landing | Food | Guest-right | Men | Winter |
|---|---|---|---|---|---|---|
| Hostile | −10 to −6 | Fought on the beach. Only a raid, a fight ashore for water and cattle, or sailing on. | none | none | none | no |
| Unfriendly | −5 to −2 | May put in; taking cattle usually means a fight | none | none | none | no |
| Wary | −1 to 1 | May put in | at double price | none | none | yes |
| Friendly | 2 to 5 | Welcome | at a fair price | 7 days, free, once a year | 4 a year | yes |
| Allied | 6 to 10 | Welcome | at half price | 14 days, free, once a year | 8 a year | yes |

Only Norse, Danish and Swedish ports will put men on his benches.

**What moves it:**
- **A raid, at the place:** −5. Burning it is a further −2, and taking captives a further −1.
- **A raid beaten off:** −3 at the place.
- **Word travels, and fades with distance** (the author, 2026-10-12: "the church would definitely spread opinions, but to a lesser extent the further away it is; the other cultures would do the same to a lesser extent"). A raid sends −2 outward, −3 if the place was burned. Each place takes a share, rounded, and a share under half a point is lost:
  - **Kin:** places of the same people take 60% of it, falling by e (to about 37%) every 300 km. So a raid on Conaille costs 1 at Armagh, Dublin and Bangor, and nothing in England.
  - **The Church:** a sacked monastery is heard of across the Christian peoples (Gaels, English, Franks, Frisians). Its own people take the full strength and the others 60%, falling by e every 500 km. Burning Iona costs 2 at Bangor, Conaille and Dublin, 1 at Lindisfarne and York, and nothing at London or Paris.
  - **Content can send word on purpose** with `spread: { from, n, church }`. A king killed in his doorway sends −3 through his kin. Sparing the Lindisfarne book, and walking unarmed with Colmán, each send +1 through the Church.
- **Taking cattle:** −2.
- **Fighting your way ashore:** −1.
- **Buying food:** +1, up to 3 above where the place started.
- **Story choices** (`standing` and `raided` effects): for example, Kolbeinn's valley (+3), the ransomed king (+3), walking unarmed with Colmán (+3), breaking guest-right at Conaille (−2), and killing the king in his doorway (−2 to every Gaelic port).
- **The turn of each year:** standing moves a third of the way back to where it started. The hiring pool refills.

**Measured** (`npm run measure:831`, two raiding summers as the younger son):
- The Irish coast closes: Bangor is hostile in about 85% of lives, Conaille in 90–98%, and Iona in about 60%. Iona's burning in 830 and the hanged traders mean Conaille is usually hostile before he first sees it.
- The Norse ports stay friendly bases.
- In the 5-year bot runs, days hungry at sea rise from about 3 a year to 30–40, with plunder and survival unchanged. Food away from home now matters.

Scenes can test it with `standing.<place>`. The port screen, the map (each marker's ring) and the Saga tab ("Your name in the ports") all show it.

## 12. Mythology: present and ambiguous

### Writing rules (enforced by the style guide and `lint-style`)
1. Every supernatural event offers a mundane reading **in the text itself**: ravens are ravens, the berserkr may be mad, the draugr may be a grave-robber.
2. The game never states divine cause in UI copy or mechanics labels. "Your sacrifice was accepted" is banned; "the blood ran clean, and the godi seemed satisfied" is allowed.
3. **The only exception is death.** The judgment scene (§14) is the one place the myth speaks plainly, and only for a death that earns it.

### Mechanics
- **Omens are real forecasts, delivered with some error.** `omens.ts` reads the pre-rolled future, such as next leg's weather, an ambush queued at a place, or a sworn man's betrayal flag. It turns that into an omen that is **right about 70% of the time** (tunable, modified by Lore and hamingja). The game does not lie, and it does not tell the player when it is wrong.
- **Völva prophecies** are drawn from queued long-term events: feuds, historical events, a son's fate. They are phrased in the verse riddle style, and their timing is vague.
- **Blót (sacrifice):**
  - It costs livestock, silver or, in rare dark branches, more.
  - It quietly shifts hamingja and omen accuracy. It never visibly changes an outcome.
- **Rare mythic events, earned late, tied to fame.** Examples:
  - a one-eyed wanderer at the hall in winter;
  - a valkyrie dream before a battle he dies in;
  - a barrow-wight.

  Each is written so it could be literal, or what the skalds made of it later.
- **The spear mark.** An old man may cut himself with a spear point and give himself to Odin, as Ynglinga saga tells of Odin himself. It is a late-life option with an **uncertain** result at judgment. It is the bridge between dying in bed and dying in battle.

---

## 13. The century

### The timeline
`history.ts` holds the dated events. Each opens and closes opportunities and moves the political situation. The player can join, compete, or be elsewhere.

| Year | Event | Opportunity |
|---|---|---|
| 830s | Repeated raids on Dorestad (from 834) and Irish monasteries | Early-career targets |
| 841 | The longphort at Dublin | A base, a market, Irish politics |
| 843 | Nantes sacked | Loire ventures |
| 844 | Seville raided | Far-south voyage |
| 845 | Paris (Reginherus, "Ragnar"), paid 7,000 pounds of silver. Hamburg sacked. Turgeis killed in Ireland. | The headline deed of the decade |
| 850s | Danish wars over Horik's succession (d. 854). Olaf and Ivar in Dublin (853). | Service, alliances, rival kings |
| 859–861 | Björn and Hastein's Mediterranean expedition | Legendary late voyage |
| 860 | The Rus attack on Constantinople | The eastern alternative |
| 865–867 | The Great Heathen Army; York taken (866) | Join, lead or compete |
| c. 872 | Hafrsfjord (traditional date). Harald Fairhair's consolidation. | Exile pressure on western Norwegian chieftains |
| 874 | Iceland settlement (traditional) | A legacy ending for him or his sons |

### Rival legends
- About 8–10 historical and semi-legendary figures each have a fame curve over time:
  - Ragnar / Reginherus;
  - Björn Ironside;
  - Hastein;
  - Ivar and Halfdan;
  - Olaf of Dublin;
  - Turgeis;
  - Harald Fairhair;
  - Rurik.
- **The "Greatest living legend" table** ranks the hero against them by living fame. It shows on the hall screen and the death screen.
- **Semi-legendary figures** are presented the way the period would have heard of them: rumour, verse and exaggeration. "Men say Ragnar…" fits the ambiguity pillar.
- **He can meet, serve, fight or outlive them.** Historical deaths are fixed unless he is the cause. If he is, the timeline records the divergence.

---

## 14. Death and judgment

### How he dies
| Death | Classification |
|---|---|
| In battle, weapon in hand | Battle-slain. Valhalla or Fólkvangr eligible. |
| From battle wounds, days later | Battle-slain if he never recovered |
| Drowned at sea | Rán's hall |
| Illness, age, accident ("straw death") | Hel, unless marked with the spear (§12) |
| Executed or killed by stealth | Depends on circumstance and honour |

### Judgment (`judgment.ts`)
Inputs are the manner of death, **lasting fame** (composed verses), honour, the last deed, and hamingja.

Outcomes:
- **Valhalla.** Chosen by Odin's valkyries.
- **Fólkvangr.** Freyja takes half the slain. This is not a failure; it is a different honour.
- **Rán's hall.**
- **Hel.**

### The saga
At death the game assembles **his saga** from the deed record: chapters by decade, the verses composed, his named men's fates, his feuds, and his rank and fame against the rivals. Then comes the judgment, written as the one plainly mythic scene.

- The saga can be exported as text.
- This is the payoff screen, and it gets a disproportionate share of the writing budget.

### Failure states
- **Early death** is possible, and the game warns before every lethal fight.
- At **straw death without fame**, the saga still assembles and is short, which is the point.

---

## 15. Backgrounds

All three start in west Norway in 830, aged 16, with nothing of their own. They differ in the first year (the prologue) and in starting stats, relationships and problems. After the first year they share one life.

**Shared childhood.** He grew up on the stories. Each background's prologue opens with a remembered scene from boyhood, before the game proper starts:
- the ship that came home with silver when he was small;
- an old raider at the hearth with one hand and an arm-ring, telling it differently every winter;
- the names of Iona and the Frankish coast said like the names of rich farms.

That longing for what lies beyond the horizon is the first want the game gives him.

| Background | Start | Edge | Burden |
|---|---|---|---|
| **The younger son** | A bóndi's second son; the farm goes to his brother | Balanced stats, a family, a father's name that means something locally | A brother who resents him, no inheritance |
| **The outlaw** | Killed a man at 16; outlawed from the district | Weapons +, a deed already | A blood feud from day one, honour negative, no home harbour |
| **The freedman's son** | Son of a *leysingi*, a freed thrall | Craft and Seamanship +, a hunger others lack | The leysingi stain: the same prejudice idea as Adalia's new man, and a former master's family with claims |

---

## 16. Assumptions and open decisions

| # | Topic | Recommendation | Status |
|---|---|---|---|
| 1 | Start year | **830 at age 16.** It puts the peak of the century (841–866) in his prime. The earliest raids (793–820s) are the stories he grew up on. | **Confirmed** |
| 2 | Thralls and slaving | Present, because slave-taking was a central source of raid profit and leaving it out would be dishonest to the period. **A player choice, never required, never glorified.** Taking captives has consequences: unrest, escapes, the freedman's-son background seeing it differently. Content lines in §1a. | **Confirmed** |
| 3 | Hero's sex | Male, per the brief | Assumed |
| 4 | Hero's name | Player picks from a period name list or types one. Patronymic from the background (e.g. *Hallsson*). | Assumed |
| 5 | Christianity | Present as the faith of the targets and later of some Norse. Conversion is a possible late-game political choice with real consequences at judgment. | Assumed, expanded later |
| 6 | Language | Old Norse terms used where they carry meaning (*hirð*, *drengr*, *holmgang*, *blót*), always glossed on first use and in a codex | Assumed |
| 7 | Art | Pixel-art map plus small pixel scene art, generated in code or from committed generators. No external image pipeline in Phase 1–2. | Assumed |
| 8 | Narration | Static authored text. No LLM calls (same as Adalia). | Assumed |

---

## 17. Content schema

Reuses Adalia's grammar: conditions as short strings combined with `all` / `any` / `not`, effects as ops, scenes and events in YAML, and every reference declared in a registry. The validator rejects anything undeclared.

### Additions for this game
**Conditions:**
```
place == bangor           at.kind == monastery       season == sailing
fame.living >= 40         fame.rank <= 3             honour >= 2
rank >= captain           man.ketill.loyalty >= 6    man.ketill.alive
feud.hordar.open          year >= 845                hist.dublin_founded
silver >= 3m              ships >= 2                 crew.morale >= 5
hamingja.band == strong   wound.lost_eye             age >= 50
```

**Effects:**
```yaml
- deed: { type: first_over_wall, weight: 6, witnesses: crew }
- verse: { deed: last, skald: hallfred }          # composes a verse from the last deed
- silver: -2m                                      # marks, aurar, ørtugar: 2m, 3a, 4o
- gift: { to: ketill, item: arm_ring }
- man: { id: ketill, loyalty: +2, grievance: -share_cut }
- feud: { open: hordar, cause: last_killing }
- fight: { kind: holmgang, foe: thorgils, lethal: true, next_win: s_after_holm, next_lose: s_holm_lost }
- battle: { foe: ulster_levy, terrain: beach, next: s_after_beach }
- travel: { to: orkney }
- omen: { source: next_leg_weather }
- queue: { event: hordar_revenge, delay: { years: 3 } }
```

**Place-bound scenes:**
- A scene can declare `at: [bangor]` or `at_kind: monastery` with conditions.
- The director offers it on arrival.
- This is how the map and the authored story meet.

---

## 18. Instruments: validation, bot, measurement

Built alongside the engine from the first commit, not later.

| Tool | Question it answers | Must assert |
|---|---|---|
| `validate.ts` | Is the content well-formed? Broken links, undeclared refs, unset or unread flags, lethal fights without a warning, scenes unreachable from any background. | — |
| `lint-style.ts` | Banned phrases, modern idioms, confirmed-divine-cause wording (§12), show-history anachronisms (§1a). Lists live in `content/style-guide.md`. | — |
| `bot.ts` | Can a life be played start to death without dead ends or softlocks? Policies: raider, trader, homebody, reckless, random. | **The year advanced and the hero aged** (failure mode #2) |
| `measure-duel.ts` / `measure-battle.ts` / `measure-raid.ts` | Combat balance | Exchanges or rounds actually happened. The positions differ measurably. |
| `measure-economy.ts` | Income share by source over a life | **Composition bands**: no single source above about 60% of lifetime silver (failure mode #11) |
| `measure-life.ts` | Death age distribution, death types, Valhalla rate by policy, fame rank by year | Each policy produces a different distribution (failure mode #8) |
| `smoke.ts` | Browser smoke test of the built app at phone width | — |

---

## 19. UI

**Phone first.** Every screen is tested at 390 px width (failure mode #4).

| Screen | Content |
|---|---|
| **Map** (sailing season) | Pixel map, his ships, known places, sea legs with day estimates, the day and the wind, provisions, crew morale, and the place panel on tap |
| **Hall** (winter) | Hall action cards, named men around the fire (loyalty shown as demeanour), the fame table, the winter's events |
| **Scene** | Adalia-style prose column with choices, requirement labels and odds bands (Risky / Even / Favourable) |
| **Duel** | Two fighters, stamina, shields, wounds, the five actions, what he has read of the opponent |
| **Battle** | Two walls drawn as strips whose length tracks the men (as in Free Company), morale bars, the order picker, his position, the log of named deeds |
| **Raid** | The approach choice, then the assault, then plunder with the alarm clock |
| **Saga** | The deed record, composed verses and the rival table. At death, the full saga and the judgment. |

**Empty states always explain themselves** (failure mode #5). For example, "No skald in your household — deeds this year will fade unless told at a feast."

---

## 19a. Visual identity: Runestone (decided 2026-10-11)

The look of a painted runestone: cold granite and bone, runes cut and painted red and black, knotwork in the Urnes style, with sea-slate and iron for the cold North Sea. It must look nothing like Knight of Adalia (warm brown and burgundy) or Silk Road, and nothing like the Phase 1 placeholder.

### Palette (CSS tokens; the pixel art uses the same colours)
| Token | Hex | Use |
|---|---|---|
| `--soot` | `#111213` | Deepest shadow; the black paint in the runes |
| `--granite-900` | `#191b1c` | Page background |
| `--granite-800` | `#222628` | Panels |
| `--granite-700` | `#30363a` | Lines and borders |
| `--granite-500` | `#5a6266` | Quiet text, inactive icons |
| `--iron` | `#8a9397` | Secondary text, metal |
| `--bone` | `#e6ddc8` | Body text |
| `--bone-dim` | `#b5ac97` | Hints |
| `--rune-red` | `#b3352a` | Primary accent: headings, danger, the selected thing. Red ochre, as painted on the stones. |
| `--rune-red-dark` | `#6b2018` | Pressed states, blood bars |
| `--ochre` | `#c8913a` | Used sparingly: silver, fame, gold |
| `--sea` | `#4d6773` | Sea-slate: sailing, morale, the map's water |
| `--sea-deep` | `#24343d` | Deep water |
| `--lichen` | `#8a9860` | Good outcomes, health |

The ratio is mostly stone (about 85%), then bone text, with red used where the eye should go. Gold is rare, which keeps it worth something.

### Typography
- **Fonts:** Alegreya for prose, Alegreya Sans for the interface, and Alegreya SC (small capitals, widely tracked) for headings, as if cut in stone. All are under the open font licence.
- **Runes:** Younger Futhark glyphs from Noto Sans Runic, as ornament only: section dividers and the date line. They are never needed to understand anything.
- **Offline:** the fonts are self-hosted through `@fontsource` and bundled, so the installed app works offline. No font CDN.

### Ornament
- **Knotwork frames:** Urnes-style ribbon animals (thin and fat strands, snake heads), as SVG components generated in code.
- **Where they go:** they frame only the important things, which are scene art, the title, chapter cards and the death saga. Everyday UI stays plain.
- **Divider:** a rune line, for example ᚢᛁᚴᛁᚾᚴᛦ, set in `--granite-500`.

### Sleek and efficient
- **One column:**
  - the scene art band at the top;
  - prose;
  - choices;
  - nothing else on the main screen.
- **Top bar:** a single line (place · date · silver · fame) with the menu as an icon.
- **Secondary detail** goes into bottom sheets opened on demand, never inline: crew, wounds, the legends table.
- **Tabs:** five, with pixel icons drawn in the palette and short labels.
- **Choices:** text with one line of hint. Requirements and odds appear as small pill tags, not sentences. Lethal is a red rune mark.
- **Motion:** short and purposeful. Screens slide; nothing bounces.

## 19b. Art and animation (decided 2026-10-11)

### Hybrid pipeline
1. **Josh supplies a source image** for each key scene (from an image generator, a photograph or a painting), following the shot list in `docs/ART.md`.
2. **`tools/art.ts` converts it to fine pixel art:**
   - crops to 2.5:1 (changed from 2:1 on 2026-10-11 to fit the first sources; a wider band also costs less of the phone screen);
   - scales to 400 × 160 (fine enough to read as illustration, coarse enough to read as pixel art at phone width);
   - quantises to the **fixed master palette** in `tools/art.ts` (52 colours: the tokens, their ramps, skin, firelight oranges) rather than a palette per image, so every scene in the game shares one palette. A scene uses 20–47 of them;
   - no dithering, a Silk Road lesson: on photographs it turns to checkerboard noise.
3. **Sources are kept** in `art/src/` and the generator is committed (failure mode #13).
4. **Missing art:** every key has a code-drawn fallback, so a missing image never blocks the game.

### Animation (code, over the stills)
- **Palette cycling** for fire, torchlight, water and sea spray. Painted masks mark which pixels cycle. This is the classic technique that makes fine pixel art move cheaply.
- **Sprite loops** for figures, oars, banners, cups and shields: palette-indexed sprite strings authored in code.
- **Particles** for sparks, snow, rain, spray and ash.
- **Battle animation is driven by the live battle state:**
  - each wall's length follows the men standing;
  - the line leans with morale;
  - each round's orders play out: the wall braces, pushes, throws, wedges or gives ground;
  - wounds and falls show as they happen.
- **Animated events for the slice:** the feast, the shield-wall, the raid with fire, and a storm at sea.
- **Budget:** a fixed low frame rate (about 12 frames a second, which suits pixel art and battery life); animation stops when the scene is off screen.
- **Reduced motion:** `prefers-reduced-motion` shows the still with a single static pose.

## 20. Scope and risks

1. **This is the largest of the five games.** The bottleneck is prose and balance, not code. Adalia's chapters were 30–40 scenes each. This game needs place scenes, sworn-man arcs, winter events, historical set pieces and the saga assembly.
2. **A sandbox map can dilute the story.** The counter is place-bound scenes plus queued consequences, so that the map is the delivery system for the story, not a replacement for it.
3. **Three combat layers means three balance problems.** Each gets its harness in Phase 1, before content depends on it.
4. **History is a constraint.** Every dated event and named figure is checked. Uncertain dates are labelled "traditional" in the codex. Semi-legendary figures are presented as rumour.
5. **The 40-year life must not drag.** Later decades compress (§4). The bot reports turns per year, and a target ceiling is set in Phase 2.
6. **Real geography needs a coastline generator.** If Natural Earth rasterisation produces poor results at our tile size, the fallback is hand-traced simplified polygons, still generated by a committed tool.

---

## 21. Build plan

### Phase 1: engine and instruments (no real prose)
- **Scaffold:** Vite + Preact + TS, the content compiler, Zod schema, the save system, the Pages workflow and the PWA.
- **Engine:** RNG, calendar, conditions and effects, director, map and voyage, hero, fame, silver, crew, ships, duel and battle.
- **Map:** the coastline generator and the pixel map, with the 6 slice places and their sea legs.
- **Instruments:** validator, bot skeleton, `measure-duel`, `measure-battle`, and the progress assertions.
- **UI shells:** map, scene, duel and battle screens working with placeholder text.

**Exit criteria:**
- The bot sails, fights and ages a placeholder hero through 10 years.
- The duel and battle harnesses report sensible, varied matrices.
- The app installs on a phone.

### Phase 2: the one-year vertical slice
- **Background:** the younger son (the other two follow in Phase 3).
- **The year:** 830, from spring muster to the end of winter.
- **Places:** home fjord, Karmøy, Shetland, Orkney, Iona, Bangor.
- **Set pieces:**
  - one raid (Bangor), with approach, assault and plunder;
  - one holmgang (a winter quarrel);
  - one shield-wall (a beach fight with a coastguard or a rival crew).
- **People:**
  - 4 named sworn men with at least 3 events each;
  - the jarl patron;
  - a skald;
  - a völva at a winter feast.
- **Systems:** the fame loop end to end (deed, telling, verse), ring-giving at the share-out, omens live, and a saga fragment at year end.
- **Tone:** one flyting at the winter feast, one drunk boast that becomes an obligation, crew banter on every leg, and at least one nickname earned.

**Exit criteria:**
- A human plays the year and wants to play the next one.
- The bot runs 500 years with no softlocks.
- Fame differs measurably between front-rank and rear-rank play.

### Phase 3 onward (outline)
1. Backgrounds 2 and 3.
2. The 830s decade: Dorestad, Ireland, Dublin 841.
3. Marriage and feud systems in full.
4. Paris 845.
5. Rank up to hersir and jarl.
6. Ageing and the late game.
7. Judgment and the full saga.
8. The 850s–870s, the eastern and Mediterranean reaches.

Each step follows the Adalia rhythm: frame, approval, build, playtest, revise.

---

## 21a. Campaign variety: goals for later phases (recorded 2026-10-11)

The campaign must offer real options and real variety: two lives should be different stories, not the same route with different numbers. The Phase 2 slice gets its variety from choices inside one route (3–5 approaches to each major beat, and pool events). The rest of the campaign builds these:

1. **Career paths**, each a complete way to gain fame, silver and rank:
   - **Raider:** the default.
   - **Trader:** markets, cargo, the knarr, prices that move.
   - **Mercenary:** in the pay of Irish kings or Frankish counts, with the politics that come with that.
   - **Settler or jarl-builder:** land, a hall, farms, tenants, defence.
   - **Explorer:** the Faroes, Iceland and beyond.
   - **The eastern river road:** Ladoga, the portages, Miklagarðr.

   Paths mix, and a life can change course.
2. **A yearly ambition.** Each spring the hero states a vow or aim for the year (in the hall, as a boast or in private). It shapes what the director offers and pays fame when met.
3. **Rival crews with careers of their own:**
   - they raid the same places;
   - they compete for the same men and silver;
   - they grow or die;
   - they can become allies, sworn men or lifelong enemies.
4. **Places that change:**
   - raided places fortify or empty;
   - markets rise and fall;
   - history changes what each place is (Dublin from 841; the Seine after 845).
5. **Regional event pools,** so the Irish Sea, Frisia, the Baltic and the far east each feel different.
6. **Several routes up each rank** (Adalia's lesson: at least two to three per gate).
7. **Historical openings that close:** be at Paris in 845 or miss it. The century does not wait.
8. **Different deaths:** many kinds of good death, many kinds of bad death, and the late-life choice of how to end it.

## Phase 1 as built (2026-10-11)

### What exists
- **Stack:** Vite + Preact + TypeScript (strict), YAML content compiled to `src/content/bundle.json`, Zod schema, Vitest. PWA files and the Pages workflow (one-time setup: Settings > Pages > Source: GitHub Actions).
- **Map:** `tools/build-map.ts` turns Natural Earth land, lakes and rivers into a 468 × 360 tile grid (about 6.6 km a tile) from 16°W to 34°E, 45°N to 66.5°N. Biomes come from coarse zone polygons with domain warping. The output (`src/content/map.json`, 51 KB) is committed with its generator. Iceland, Iberia, the Mediterranean and Constantinople are outside the grid: they need a wider grid or regional insets later.
- **Places:** 30 real locations on the map; the 6 slice places are active and joined by 7 sea legs. Arriving somewhere teaches you the places next to it.
- **Engine (`src/engine/`):** calendar, conditions and effects (Adalia grammar), director (queued, arrival, sea, phase and hall triggers), voyage (daily wind, food, storms, foundering, encounters), duel, battle, raid (Phase 1 form: one surprise roll, then a shield-wall, then plunder), fame (deeds, telling, fading, verses, the legends table), share-out, the winter hall, the turn of the year, saves and `VIKR1.` save codes.
- **Instruments:** `validate` (links, references, lethal choices without `danger: true`, places off the map, unreachable places and scenes), `lint:style` (the lists in the style guide), `bot` (five policies, progress assertions), `measure:duel`, `measure:battle`, `smoke` (Chromium at 390 px, 18 screenshots), 34 unit tests.
- **UI:** title and new game, scene, report, muster, place with a mini map, voyage, duel, shield-wall, share-out, winter hall, death; tabs for the map, the hero, the crew and the saga.

### Measurements (all provisional)
**Shield-wall** (`measure:battle`, 1,000 battles a cell, "let the men handle it"):

| Scenario | Win | Lost | Broken off |
|---|---|---|---|
| Iona, 26 green men against 15 alert defenders | 100% | 0% | 0% |
| Bangor, surprised (15 levy) | 99% | 1% | 0% |
| Bangor, alert (29 levy) | 11% | 36% | 53% |
| Rival crew at sea, 26 against 20 | 97% | 3% | 0% |
| Equal crews, equal quality | 90% | 10% | 0% |

The hero went down in 8% of hard battles in the front rank, about 1% in the wall, and almost never behind it.

**Duels** (`measure:duel`, 3,000 holmgangs a cell, fighting on instinct): the hero at 16 wins 72% against Thorgils, 46% against an Irish champion and 83% against a farmer's boy. At 25 he wins 78–98%. Reading the opponent adds about 2–4 points: real, but small.

**Lives** (`bot`, 50 lives × 3 backgrounds, 10 years):

| Policy | Alive at 10 years | Fame | Raids | Battles won | Valhalla |
|---|---|---|---|---|---|
| Front rank (reckless) | 57% | 60 | 5.3 | 49% | 8% |
| In the wall (raider) | 85% | 47 | 5.6 | 44% | 1% |
| Behind the wall (coward) | 94% | 36 | 4.5 | 35% | 0% |
| Stays home | 98% | 11 | 0 | — | 0% |

The front rank buys fame with risk, as §1 intends.

### Found and fixed by the instruments
- **The year skipped:** after a winter in the hall the calendar jumped a whole year. Found by a unit test. It had also halved the bot's real play time.
- **Drowning:** about a quarter of lives drowned, so storm frequency and damage were cut and winter repairs added.
- **Order choice:** veterans lost to an equal levy, and "let the men handle it" always picked the wedge. Crew quality now also reduces blows taken, and the auto-picker scores morale, not raw losses.
- **Reading the opponent did nothing:** unread opponents were already 40% known. Unread is now a guess.
- **Instinct was too good:** it beat careful play. It now acts randomly 30% of the time, and skilled foes counter the hero's favourite move.
- **Instinct fought to the death in a holmgang:** it now stops once, when the hero is badly hurt, to offer the yield.

### Known gaps to carry into Phase 2
1. **The economy is thin:** about 3–6 marks of plunder a year, and battles in raids are won less than half the time across a life. Raid targets are too few and Bangor is a trap. Needs the full raid approach (§11.3), more targets, trade, and an economy pass (`docs/ECONOMY.md`).
2. **"Let the men handle it" is stronger than random play in the wall**, so fighting by hand needs a reason. Phase 2 should show a by-hand player beating the auto-picker.
3. **Duel deaths come mostly from the placeholder hall quarrel.** Its frequency and lethality are placeholder.
4. **Judgment** is a one-line formula (§14). The saga screen is a stub.
5. **Missing systems:** wounds on named men, nicknames, flyting, boasts, omens, feuds, marriage and rank are designed but not built.
6. **All 9 scenes are placeholders**, marked as such.

## Phase 2 as built: the year 830 (2026-10-12)

### What exists
- **The younger son's year, written in full:** 11 files in `content/scenes/830/`, from the boyhood (age 8) to the spring of 831.
  - Boyhood (4 scenes), the muster (3), the crossing pool (8), Birsay (2), Iona (7), Bangor (7), the way home and the homecoming (5), Yule (7), the holmgang (4), spring 831 (2), and a mourning scene for each of the four bench-mates.
  - 24 banter lines.
  - The calibration scenes have been folded into the real year and retired. The title screen's preview list is now **Play from a chapter** (Iona, Bangor, Yule), for playtesting; nothing played there is saved.
- **Bangor is the gate:**
  - Ásgeir's fate is rolled at the start of a life (`fate.asgeir_falls`, 50%).
  - Standing at his shoulder turns a death into a maiming.
  - **Command routes:** a speech, the deeds the men saw, Ketill's word, first blood against Steinarr, or Ásgeir naming him. Otherwise he serves on, under Ásgeir or Steinarr.
- **Spring 831:**
  - **In command:** he takes the Raven out again.
  - **At the oar:** he can get the jarl's old karvi through Ásgeir, or by asking himself; buy a karvi; or take his bench again.
  - The bench-mates swear to him, or leave, by loyalty.
- **Engine additions this round:**
  - effects: `captain` and `ship`; `queue` with zero days;
  - service pacing: the captain sails on 1 May and hauls up on 1 September, and goes west the way he went last year when no scene says otherwise;
  - first-blood duels leave light wounds only;
  - his grandfather's sword hits harder;
  - spring scenes open after the chapter card has been read.
- **Instruments:**
  - `npm run measure:830`;
  - a smoke test that plays the whole year in the browser (26 screenshots);
  - 8 new tests (42 in all);
  - the style lint now reads banter, boasts and effects nested inside `if`.

### Measurements (300 lives per policy; scene choices are random, so this is a careless player)
| | Raider | Random |
|---|---|---|
| Alive at spring 831 | 97% | 95% |
| Ásgeir's fate on him | 44% | 45% |
| Took command at Bangor | 21% | 15% |
| A ship of his own in 831 | 40% | 33% |
| Grautr (Porridge) | 38% | 38% |
| Other names | 11 others, 1–11% each | the same |

Economy: `docs/ECONOMY.md`.

### Known gaps
1. **Grautr is the commonest name**, because a careless player loses the flyting. A deliberate player wins it more often. Watch this in the playtest.
2. **Hand play against auto-resolve** in the shield-wall has not been re-measured since the economy and Bangor changes.
3. **Not yet ported from Adalia:** the scripted plans and transcripts.
4. **The outlaw and the freedman's son** still start in the Phase 1 sandbox, with placeholder scenes.
5. **Art still needed** for regeneration and for new scenes, as listed in `docs/ART.md`.

## Decisions log
| Date | Decision |
|---|---|
| 2026-10-29 | **The closed sea; the gauntlet, phase 2** (`docs/FRAME-GAUNTLET.md`). Josh: close the sea in winter. From 1 December to the end of February no ship puts out (a voyage under way finishes); a man can always winter where he is, with his captain at another man's oar, or under his ships on a beach where nobody will take him in (one hall day, morale, a tenth of the crew). The gauntlet now also runs the promise checker (every choice's words against its effects: money named against silver moved, goods given that the text never mentions) and fight fairness (every fight the lives met from a crew of fighting size, fought 30 times from that start with fresh dice), and keeps a dashboard per way of playing, compared with the last run. The promise checker found ten broken promises, all fixed (Kolgrímr's silence 'twelve coins' took sixty; Lambert's 'two pounds a ship' paid one; 'a pound for the ship' was five; the East Angles trade paid a quarter not three-quarters of a pound; Sigtrygg 'five coins' was half a pound; the fleet dice 'a pound' was half; York's wool and the East road's silk given without a word). Fight fairness: 81 fights; lopsided for Josh to judge, below. |
| 2026-10-29 | **The gauntlet, phase 1** (`docs/FRAME-GAUNTLET.md`). `npm run gauntlet`: 90 lives over the three eras, three backgrounds and six ways of playing (an explorer bot that tries the least-tried choice in every scene and sails to the least-visited places, beside raider, coward, reckless, homebody and random), every action checked against invariants (time, numbers, hulls, cargo, places, queued and open scenes, shipmasters, text that renders clean, report text), saves round-tripped every 150 actions and the copyable save code at the end of every life; each finding with a save code to stand where it happened. `--fast` (18 lives) joins `npm run check`. First run found and fixed: saves that did not round-trip (three death paths gave no stand-in name, so a reload changed later text), silver below zero (hostages' keep charged with nothing in the purse), the muster phase still on in June (a scene's `days` didn't end it), and five texts with nothing in them ("It took 0 men", "You lost 0 men", "0 men go down with her", "with 0 men at the oars", "The other 0 men take about no silver each") and one in lower case. Coverage 457 of 555 scenes (82%, was 79% with the old bots). Open, for Josh: ships can sail in December and January (4 of 36 lives, mostly captains with the Great Army; it also stretches a late winter into April). |
| 2026-10-28 | **The East road** (`docs/FRAME-PLACES-EAST.md` step 2). Aldeigjuborg opens (from 836), reached from Birka or Gotland; one karvi or smaller goes up the rivers (`ships.portable`). The Dnieper: the portage on rollers, Kiev, the rapids, the steppe horsemen at the ford, Miklagarðr (trade, or a Greek sword), and in 860 the Rus attack on the city; winter at Kiev. The Volga: Bulghar (furs, or captives sold, told plainly), the Khazars' tenth at Itil, the Caspian and Jurjan (say you're a Christian, as Ibn Khordadbeh says the Rus did, or pay the heathen's tax), or raid the south shore; winter at Itil. The far winter is a normal winter kept at Aldeigjuborg on the map (`winter_far`); the road home in spring. Hooks: a Swede with dirhams (Birka, Hedeby, Kaupang, Gotland, Truso, Ribe), the Rhos at Ingelheim (839–842), and a Swedish convoy that takes a first-timer across (`sail_with`). Fixed for everyone: a port where an expedition starts sells 40 days' food, not 30, so an expedition can be mounted from abroad at all. Measured: 6 of 60 843 lives take the road (target 5), all come home, about 6 men lost; a Volga round trip about 1,050 in silver and silk, a Dnieper trip about 670 plus the fame, against about 670 a raiding year. Changed from the frame: a fleet can't leave ships at Aldeigjuborg; the door just asks for one light ship. |
| 2026-10-28 | **The thin places** (`docs/FRAME-PLACES-EAST.md` step 1). Eleven places had only their first landfall. Each now has a return scene that remembers it (new flags on the first visits) and a scene with a stake: Alt Clut's siege of 870 (the well you asked about), the Pictish horsemen and a carved stone at Tarbat, the Sheppey abbess and the Danes' first Thames winter, Jarrow's hidden books, the Whitby nun's dream, the Saint-Denis ransom of 858, the Skellig fever and the storm, the Gall-Gáedil at Whithorn, the Truso race again, the Breiðafjörðr boundary and whale; a third scene for the seven two-scene places. Four rumour hooks at neighbouring ports, because bots (and players) never went to places nobody told them of. Engine: `goods.<id>` condition, `unload` effect. Measured, 60 lives over three eras: 8 of 11 thin places see a second scene (target 8); never-seen scenes held at 21%. Still unreached: the Skellig (known in 27 lives, visited in 1: nothing to raid), Saint-Denis, Breiðafjörðr (Iceland settlers only). |
| 2026-10-27 | **Silver that builds, 843 marriages, no decoration, the Great Army** (`docs/REVIEW-2026-10.md` §1–4, `docs/FRAME-865.md`). The hall pays back: 10 men at the muster (farm 3), 48 a winter, and a first step at half the price (raise the frame one winter, roof it later); halls by year 8 in 4 of 16 raider lives (target 1 in 3; bots spend on sign-on gifts). 843: Argantlon of Retz through Lambert's war or Nantes standing, Ragnhild of Vestfold through Hrói or his father; a bride-price can be owed and paid at the wedding; 843 lives marrying 20 in 60 (was 5 in 30). Cleanup: the validator now warns on any flag nothing reads (condition, text, engine, measure tool or saga) and proves choice cover by truth table (the three dead-end warnings were complementary pairs); 6 bookkeeping flags deleted, 4 wired into new text (Ulf's mourning, the völva at the epitaph, Bersi's son), 140 remembered choices shown in a new Saga card, What men remember. The third era: spring 865 at Kolr's oar with the sons of Ragnarr, 31 scenes from East Anglia to Repton, then Hálfdan's land in the Vale of York or Guthrum's war to Edington and Aller; the army keeps a winter camp a captain may winter in; five inland places and two English hosts. Measured: 12 bot lives, no errors, all reach York, 8 reach Nottingham, 3 the parting at Repton (the rest die, desert, or go home); narrative tools now sample all three eras. |
| 2026-10-27 | **The duel's odds, engine speed, the crew as people** (`docs/FRAME-DUEL-3.md`, `docs/FRAME-CREW.md`, `docs/REVIEW-2026-10.md`). The review's duel finding was corrected: it had read the hero-at-35 rows; the progression is sound (at 16 champions kill a careful boy, at 25 he beats most). The real faults: challenges accepted blind, and one champion (the Wolf-coat, guile 0) trivially read. Built: the men's reckoning on every offered duel or holmgang (the fight run 40 times each way on the same engine, in words), the Wolf-coat to guile 2, bots that heed the reckoning (duel deaths 33 to 25 in 120 lives). Engine: courses as one shortest-path tree per place, and act() without the safety copy for bots and tools: the full check 30 to 10 minutes, identical results; npm run continuity joins the check. The crew: 48 temperament banter lines spoken by any sworn man of the kind, 8 scenes about one man picked by temperament, mourning for every fallen sworn man, bynames at three deeds. Measured: 6 sworn men heard in years 3–8 (target 4), 4.1 crew scenes a life (target 3), continuity 0. |
| 2026-10-26 | **Playtest 9: the Loire life, from a save** (`docs/FRAME-FLEET-843.md`, Playtest 9 section). Josh: a fleet fight against 34 with 17 men and no way to hire; 2 pounds for a month up the Garonne, 5 for Seville; goods said gained but not in the stash; home from the Moors with Yule in May–June and no share-out; "a bit empty without more fights or more opportunities to spend money or hire more men, or select specific things to keep as loot ... a slave who could become my wife"; the monks' island winter wording; no way to load a save from text. Found from the save: season-start scenes fired mid-winter (the Loire spring and the southern fleet on 12 January, so the voyage ran January to April and the winter's scenes came in June). Built: season-start scenes wait for the spring unless written for the winter; fleet fights take a ratio (the men in front of your ship counted from your crew), and the Asturian beach, the island night attack and the Poitou raid are fought beside allied crews; southern pay raised to match the text (Seville 900 and silk, the Garonne 260 and wine); a goods card on the Hero tab and a 120 sea-chest; hiring in a fleet camp and at Noirmoutier from 843; two plunder choices (war-gear for yourself, the stores as goods); Aude of Nantes (bought out of the captives, ransomed home or kept, and when grown freed and married, or freed with a dowry); three fights (the camp duel, the island attack, the Poitou raid); winter wording abroad; loading a save from the title screen. |
| 2026-10-23 | **Playtest 8: goods as cargo, the skald, the voyage south, coastal routes** (`docs/FRAME-FLEET-843.md`, Playtest 8 section). Josh: events "gave you a smaller amount of money than the text suggested ... it would make more sense if events like that gave you actual resource cargo"; "more use for the skald, like bringing them onto your boat or your hall"; "add the voyage south and more 846–848 scenes"; "the map has all routes in straight lines". Built: a `goods` effect that puts lots in the hold (whale oil, salt, amber, down, wool, wine, glass, silk, hides; three new goods), silver raised to match the text where it named a sum, the Nantes share-out paid in silver and goods; the skald as a named member of the household, aboard (deeds he sees ×1.25, 30% death in a rout, a verse after a won fight) or at home (jarl's favour), better feasts, Yule gifts or he leaves, the death-song, six scenes; five scenes on the 843 voyage south and five year-scenes 845–848 met wherever the life is; sea routes found over the map's water and rivers, preferring the coast, drawn on the map and followed by the ship. Measured: an 843 life's first two years now meet 22.1 new story scenes and 16.6 world scenes (38.7 against 42.7 for 830; target 28). The voyage scenes reach 17–18 of 18 lives, the year-scenes 15–17. Ransoms checked and unchanged. The bot run is 23% slower (more scenes, more steps); state cloning (43%) and course plotting (20%) dominate and are the place to optimize. |
| 2026-10-23 | **Playtest 7: the oarsman, the fleet, the Loire years** (`docs/FRAME-FLEET-843.md`). Josh: "not enough story built for the later start date, nor events for while you are in a fleet ... too many events that don't handle being an oarsman well." Measured: 13 events gave an oarsman the captain's decisions; an 843 life met about 5 written scenes in two years against 42 for 830. Built: the oarsman rule (at the oar you choose what you do, not what the ship does), enforced by the validator, with 12 events rewritten; sailing in a great fleet (five fleets, fleet pace, no lone raiders, storms scatter instead of sink, 15 fleet events, a captain's voice at the council); the Loire years 843–848 (33 scenes: the Vestfold gathering, Lambert, the reeds, the share-out of Nantes, the winter on Noirmoutier, the southern fleet to Seville and Tablada, the Hart's first crew, Lambert's war, a house on the island, Bordeaux with Hastein). The map grows south to 42.5°N for Bordeaux. Measured after: about 24 written scenes in an 843 life's first two years (target 28): short, with the next additions named. |
| 2026-10-21 | **Lineage** (`docs/FRAME-LINEAGE.md`). Josh's answers: an heir with a time skip to 16 and a summary of the news he grew up on; Ragnarr's days as the second era; Iceland as a port and a late landnám; settlement with the men's families; more choice at creation. Built: an 11-point attribute pool and three upbringings per beginning (also used for the heir); children, fostering, a son at the oar, daughters married into allies; going on as a son through "The years between" (the chronicle now runs to 878); settling at land held abroad, which becomes home (a home fort is fought for in winter); an 843 start with the chronicle run from 830 and a five-scene opening (Ölvir's Hart, Nantes, Noirmoutier); the map widened to Iceland, with land free to take from 870 and Reykjarvík trading from 874. Changed on measurement: attributes 1–4, not 1–5 (endurance 5 kept 85–93% of raider lives alive against 70–73%); the freedman's grandmother set trimmed three times. Measured: 5.9 children per married life, 63% of deaths go on as an heir; 843 lives within a few points of 830 lives. |
| 2026-10-21 | **Pacing** (`docs/FRAME-PACING.md`). Josh's save (summer 834) had seen 136 of 368 scenes; 30 freedman lives showed taps a year rising from about 80 to 300–450 while new scenes a year fell from 17 to 1. Approved, with his condition: "careful it isn't just a tap to simulate the year and suddenly you're dead." Built: a fight ends on the field, with Continue to the aftermath (his report: "disorienting"); set a course to any known port; and his region-raiding idea as the quiet year: a-viking along a coast on standing orders (coast, days, silver or captives, careful or bold, which fights you lead, where you stand, home after). The "Set out" button shows the men's reckoning: the same summer run 20 times on the same engine. The cruise stops for every scene, a led fight, blood below 40%, a third of the men lost, full holds or no food. Measured, 835–850: 5,750 taps a life → 3,640 (−37%); sea legs 20–35 a year → 5–7. The rest is reports, scenes and deployment. Framed, not built: family and an heir, eras, great fleets on campaign, diplomacy, the east road, the Mediterranean, Iceland (`docs/FRAME-NEXT.md`). |
| 2026-10-19 | **The world without him** (`docs/FRAME-WORLD.md`). Josh approved scouting, the chronicle with the legends in person, lords and land abroad, and added rule: "what about making yourself king or jarl of a place, competing with the other rivals and legends?" His rule for lords, built as he wrote it: "you can only hold an oath to one man at a time. If you are found to have sworn an oath to two or more, you will lose honour and be cast out by both." **A. Scouting:** one roll fixes the raid's numbers, shown and used. 120 lives a row, same seeds: the careful bot's raid wins 71% → 92%, plunder +4%; the raider's 70% → 76%, survival within the noise. **B. The chronicle:** 24 dated events, 830–851, from the annals; five legends raid their own waters each summer by the hero's rules (wealth, defence, recovery). It costs the raider 2% of his plunder over 8 years (60 lives). News reaches the ports in 20 days, the old sailors, and the spring card: about 19 items a 16-year life. Cameos: Horik, Turgeis, Ragnarr (renamed from Ragnar, with the other Old Norse forms), Hastein, Rorik, the high king's poet. Fleets to join: the Liffey 837, Lough Neagh and Armagh 839–840, Nantes 843. **C. Lords:** seven lords. One oath; a secret second is found out at 30% a year and rising, and for certain if both call in one summer. Found out: honour −3, cast out by both, their land and ports lost. 80–88% of careful lives swear; secret oaths are found out in about two lives of three. **D. Land abroad:** granted, bought or taken as a ship-fort; winter there as at home, men each spring, a yield. Scope call: the family home stays the home fjord. **E. Rule:** four seats (Orkney after Harek, Dublin, Hordaland after the jarl, Walcheren against Rorik); the claim is shown in full. First pass too easy (35 of 60 raider lives by 846); tuned to 11 of 60 by halving fame's weight, stronger rivals, legends' claims from their fame, a harder thing, and a tie to the place. |
| 2026-10-19 | **Playtest 5: the outlaw life** (`docs/FRAME-PLAYTEST5.md`). Reproduced on the author's two saves. The outlaw came home on 1 November 833 in the muster phase: the younger son's 831 and 832 spring scenes fired that day, the spring of 834 never came, and the 830 Yule fired in 835. Over 60 outlaw lives there were 370 wrong-story scenes and 64 lost springs before the fix, none after. Also fixed: Ubbi's fleet from March; one wife at a time; boasts that could never be kept (Dorestad, the father's silver, first over the wall); winter abroad from October; one eating rule for every day away from home; share-outs that show their working; requirement labels in words. The jarl's levy and Ubbi's Frisian raid are fought as hosts beside the jarl's and Ubbi's men. Framed for approval: scouting a force, a chronicle of real events with the famous Vikings in it, lords other than the jarl, and land abroad. |
| 2026-10-16 | **Every fight converted; renown and challengers** (`docs/FRAME-COMBAT-2.md`, revision 3). The author: "Update the rest of the fights." Every battle (story, raids, landings, sea fights, hosts) and every single combat now starts in the second form from one code path. In a host, your own part of the line is the new wall, with the other wings beside it; equal hosts won 96% (was 94%). Fixes the conversion turned up: a false read is now a bait, so read score matters (63% to 97%); at day's end a side clearly steadier that has also gained ground holds the field, so locking shields all day takes nothing; weapons skill scales single-combat blows by 8% a point; a much stronger man's great blow comes through a raised shield in part; a cornered man doesn't step off the cloak; while the old hand advises, he adds 2 to the read. Renown: from 832, fights may be against veterans (20% at fame 40, 35% at 90, 50% at 160). Five challengers come looking, from fame 40 to 160: Hrafn the Dane, Cú Mara, a dead man's brother, Ögmundr Wolf-coat, Grjótgarðr the Old. A 25-year-old reading well beats them 94%, 49%, 58%, 64% and 8%. The Yule holmgang: younger son 87% won, 8% dead. |
| 2026-10-15 | **Combat, revision 2: fog, resolve, leaders** (`docs/FRAME-COMBAT-2.md`, revision 2). The author's verdict: better, but "it reveals too much. It just becomes choosing the one with the best numbers"; crowded buttons; a little long; levies, warriors and a lord's men should hold differently; cunning foes harder to read, and renown should bring harder enemies. The buttons now say what an order does and costs, not what it will do. The enemy's move is read against its guile (sure, likely, or one of two). An old hand shouts advice for the first 6 fights. Each foe has a resolve (levy, warriors, hird) and a leader, and there is a new order, Strike at their lord. Battles last at most 7 rounds and duels 16 exchanges. Bangor in the wall, warned: instinct 65%, always push 25%, random 25%. Thorgils: instinct 77% for the younger son. Renown scaling (veterans, hirds, challengers who come looking) comes with converting every fight. |
| 2026-10-15 | **Combat, second form: a preview at Bangor and the Yule holmgang** (`docs/FRAME-COMBAT-2.md`). The author: "It doesn't feel like there is any real strategy or tactics, just guessing and getting lucky." Approved: the enemy's next move is shown before you choose, and every order or move shows what it will do (losses both ways, both lines' cohesion, breath, ground); chance moves the numbers ±15% and never decides what beats what. **The shield-wall:** deployment first (sworn men front, spread or in reserve; a reserve of none, 15% or 30%; your place, and from behind the wall you see their move after next), then up to 8 rounds of six orders against seven enemy moves, with breath, two spear volleys, ground (pushed back 3 steps, a line breaks) and an enemy that learns (push every round and he locks shields and feigns; stand still and he flanks). At Bangor with the Irish warned and the hero in the front rank: instinct wins 79%, always push 32%, random 35% (in the wall: 67%, 18%, 23%). **Single combat:** five moves (great blow, quick cut, shield up, shield rush, step back) against his shown move, with breath, three shields, off balance (rush him, then the great blow through his late shield) and, on the holmgang cloak, three steps back and you have run. Instinct slips to a great blow about one exchange in three for an untrained man; against Thorgils it wins 71–82%, random 22–39%, careful reading about 95%. Lindisfarne's beach fight (831) also uses the new wall, so deployment can be tried as captain from the chapter jump. Every other fight keeps the old system until the author's verdict. |
| 2026-10-15 | **Playtest: what beats what, said plainly.** The author's outlaw lost Bangor giving orders by hand. With his crew there, "let the men handle it" wins 91–97%; always "hold" wins 27–36%; random orders 58–74%. The battle screen said what the enemy looked likely to do but never what beats what, so the counter table had to be learned by losing. Each order now says what it beats and what beats it, which orders hit hard or cost few men, and marks the best answer to the enemy's likely orders (following that mark wins Bangor 89–97%). Duel moves say the triangle (strike beats feint, guard turns strike, feint draws guard) and mark the answer to what the opponent has been read to lean on. |
| 2026-10-15 | **Playtest: "I haven't won one since."** The first fix only floored a sullen crew's battle morale at 3, one bad round from breaking, so a shaken crew still lost nearly every fight and each loss kept it shaken. Now camp morale is a modifier: a crew starts a fight at 4 + 0.4 × camp morale (4 to 8) against a foe's 6 + quality, and a lost battle costs 1 camp morale, not 2. On the author's save (22 green men, morale 0), the fight against an even rival crew went from 6% to 19% with poor orders and to 53% once the men's spirits are up. With fights no longer collapsing in round 1, the hero spent longer in the press and bot raiders died in battle three times as often; the chance a blade finds the hero is down by about a quarter (front 0.16 → 0.12, wall 0.07 → 0.05), and a hero cut down dies 20% of the time if his side wins (carried out) and 50% if it loses, was 40% either way. Bot raiders over 16 years: battle deaths 15 of 40 in 3,188 fights (about 0.5% a fight). Duels are unchanged. |
| 2026-10-15 | **Playtest: a sullen crew lost every fight.** The author lost every battle of 833, "100 to 32, and even 93 to 14". A side breaks at morale 2 or less, and a crew's battle morale was its camp morale; his crew was at 0, so it counted as broken before a blow was struck and lost in the first round against any odds, and each loss cost 2 more morale. Fixed: a crew starts a fight at least just above breaking (3), fights worse for low morale and breaks at the first bad turn, and the battle says so ("your men are sullen"). A crew's spirits can now be mended in port: three days' rest steadies them up to 5; a round of ale (half an ørtug a man, once every 20 days at a port) lifts them by 2, up to 7; guest-right by 1. The trap had caught the bots too: before the fix 64% of their fights were fought at morale 3 or less. With it fixed, bot raiders win more and rise faster (median fame 120 by 840, was 59), and die in battle more often (14 of 40 raider lives over 16 years, was 6). The hardship brakes were calibrated against those crippled crews and need a second look. |
| 2026-10-15 | **Ireland, the Seine, and eighteen more places** (`docs/FRAME-IRELAND-SEINE.md`). The author: "continue with your suggestions, and several more English, Scottish and Irish towns, ports and monasteries". Spring 841 offers two fleets: the ship-fort at Duibhlinn or Ásgeir's Seine raid (the Franks' Oscherus; the player's own Ásgeir if he lived). Ireland: the fort, its high seat, the hosting of Leinster, a winter in the fort, Turgeis drowned and Forannán of Armagh for sale in 845. The Seine: Rouen, the abbeys, the monks of Saint-Denis buying back captives; Ragnar's Paris in 845, the hanging on the island, the seven thousand pounds, the flux. Norse-held places trade and hire and can't be raided; in 841 the forts appear whether or not he goes. Picts and Britons join the peoples. Sixteen new places plus Rouen and Paris made reachable. The author's painting of a Gaelic monastery is the art for four of them. |
| 2026-10-14 | **Twelve new places** (`docs/FRAME-PLACES-2.md`). The author: "another dozen locations". Of the fifteen places on the map for later phases, twelve are reachable: Hlaðir, Uppsala, Gotland, Truso, Man, Dublin, Clonmacnoise, York, Sheppey, London, Noirmoutier, Nantes. Each has an arrival scene; four new sea events cover their waters. Six new foes. A place scouted in its arrival scene is a quarter likelier to be caught asleep. York holds 120 men, so one crew takes it about one time in five; the rumour says it is too big for one ship. Rouen, Paris and Ladoga stay for later chapters. |
| 2026-10-14 | **The hird grows, and hostages** (`docs/FRAME-HIRD-HOSTAGES.md`). The author: "how do we get more sworn men?" and "what about taking hostages, like the king, but wives and children, or even political prisoners?" New sworn men are generated from an origin (one of his own oarsmen, the man who took a fallen sworn man's bench, a Norse, Danish or Irish-Norse sword for hire in the ports, the best of a beaten crew, a wife's brother, a young kinsman, a freed thrall) and swear on an arm-ring from the chest: no ring, no oath. The base sets how many he keeps (4 at his father's, 8 on a farm, 15 with a hall). New men whose loyalty runs out walk at the year's turn. Hostages are parties (a king's son; a queen or a lord's wife with her children; an abbot; a fosterling at the monks' school; a merchant's heir; a beaten shipmaster's son) taken by a plunder round spent looking, or after a sea fight; held for ransom through a go-between, held as a surety for a yearly tribute and a people's peace (broken by his own raid or by their kin), fostered, married into, sold, freed, or handed to the jarl. Side decisions: one prize ship a year; the holmgang stays lethal (step off the cloak and pay to live); a sworn man hit in the wall dies 30% of the time, not 40%, because a raider's sworn men were dying about one a year, faster than any hird could grow. |
| 2026-10-14 | **The other two beginnings, and a slower rise** (`docs/FRAME-BEGINNINGS.md`). The author: "I have trouble enjoying a game where it is my first year raiding, and I become a near legend and a rich shipmaster before I am 17." Every beginning now spends two summers at another man's oar. At Bangor the men may choose him, but Steinarr steers: he gets the prow. The jarl notices him ("two summers in the prow, then come to me"), and the first ship comes in spring 832. A crew's victories count half for an oarsman; the legends of the 830s start higher. **The freedman's son:** the boatyard, his father's freedom-ale at Hrapp's hall, his grandmother Órlaith (taken at Rechru in 795) and her Irish, the bailer's half share; Irish at Iona and at Conaille's gate; a karvi built with his father, with Hrapp's sons claiming a patron's due. **The outlaw:** Ozurr Hrappsson killed at the spring horse-fight, three winters' outlawry, passage west, the Raven at Birsay, Harek's hall and Ingibjörg, Kolgrímr and Önundr, Harek's karvi, and home in 833 with the wergild or without it. The Phase 1 placeholder starts are gone. |
| 2026-10-14 | **Playtest 5: skills in the wall, and the death screen.** The author asked how much skills matter. Scene checks and single combat already used them; the shield-wall did not use the hero's weapons, shield or command at all. Now: each weapons point above 2 adds 2% to the line's blows in the front rank (less in the wall, little behind it); each shield point above 2 cuts the chance a blade finds him by 6% (between 60% and 120% of the base); each command point above 1, when he leads, adds 2.5% to the blows and steadies the men by as much (at most 20%). Measured over ten-year bot lives: raids 7.6 → 8.5, battles won 30% → 33%, deaths in battle unchanged. Writing fixes from the playtest: the death screen tells a short epitaph (age, summers, what men remembered, who carried him, where he lies) in place of the Phase 1 placeholder; ordinals ("2nd", not "2th"); the jarl's favour line reads properly when it sends no men, and names the jarl of the day; deed texts read as sentences ("the Ulster levy", "Ulf broke their shield-wall at Lindisfarne", "at sea" not "at at sea"). |
| 2026-10-14 | **Silver by weight, and arm-rings as things** (the author: "count it in silver coins and pounds of hacksilver; arm-rings can only be given if you have them made or are given them first"). Silver shows as pounds and coins, 240 to the pound (the annals' tribute reckoning); one weighed pool, not two purses, because a Northman weighed coin and hacksilver alike and two purses would be bookkeeping without decisions. The engine still counts in ørtugar (5 coins). About 70 amounts in the prose were converted at the same weight (a mark is half a pound). Arm-rings of silver and gold are held and given: the smith makes silver ones (150 coins), plunder turns up silver and, in rich places, gold, and lords give them (the jarl's levy; Ubbi at Dorestad). A ring cut up is hacksilver by its weight. A gold ring is +5 loyalty to a sworn man, or twice any other gift to the jarl. |
| 2026-10-13 | **Roadmap 2, step 1: hardship** (`docs/FRAME-HARDSHIP.md`), with the author's defaults. `npm run measure:power` (20-year lives) found the top tenth snowballing (118 men, fame 650 by 850), the median life already in a poverty trap, and fame that never faded. So the brake is progressive, with a floor. **Upkeep:** the winter's keep (men, sworn men, ships) comes off the top of the heap at the autumn share-out. **Envy** rises with outshining the district and falls with open-handedness; at thresholds it brings a challenger, a lawsuit, a raid on the farm, the jarl's question, the district's resentment. **Disasters:** bad harvests (1 in 6), winter sickness by crowding, fire (what he drags out), storms at anchor. **The coast learns:** each region arms against raiders and says so. **The body ages** from 32, and bad wounds can leave old ones. **Fame fades** with each retelling (four-fifths). **The floor:** men sign on for a promise, and the jarl mans a ruined man's benches for a quarter. Measured: the top tenth level off at about 30 men and fame about 250 by 850; a disaster every 4.7 years; drowning, hunger and battles won unchanged. |
| 2026-10-13 | **Hosts and the Frisian Road** (`docs/FRAME-HOSTS-FRISIA.md`, Roadmap steps 4 and 5). **Hosts:** his wing is the ordinary battle; one or two other wings fight beside it round by round by the same rules. A broken wing turns half its victors onto the next part of the line; flanks bleed morale; reserves; signals; three ranks of command; the field goes to whoever holds more wings. Big raids with a partner become hosts. Measured: equal hosts won 94%; an ally hanging back leaves a drawn field at best (2% won); Dorestad with Ubbi's fleet won 80%. The first, morale-only flank made an empty wing certain defeat and was replaced by men turning onto the flank. **The Frisian Road (833–835):** about 5,000 words in 15 story scenes, plus 6 regional sea events (about 1,300 words) and 3 new places (Dorestad, Walcheren, Armagh). The emperor's sons and the jarl's sons; Hessel's ways into Dorestad; Armagh as a host, a night raid or tribute; Dorestad 834 as a host on the jetties, with the sack after; the death of Jarl Eystein and the thing that chooses Eiríkr or Hákon; the road divides in 835. Regional events are gated to 832 on, so the written years keep their exact rolls. Measured (40 ten-year lives a policy): about 90% of surviving lives meet each story beat; a quarter reach the Dorestad fleet; 15–19 scenes a year in 833–835. |
| 2026-10-13 | **Playtest 4 fixes.** (1) **Share out on the strand:** the heap can be divided in any port mid-summer (fair or open-handed), so full holds no longer strand the player. It runs the partner's, the jarl's, the masters' and the men's parts as the autumn share-out does, but the men's mood only rises (the summer is reckoned in autumn), and nobody leaves until autumn. (2) **Ubbi waits for next spring:** Hedeby's fleet scene needs a year since his oath (new path `yearsince.<scene>`); an early arrival meets his steward instead. (3) **Spare kit:** sold at the smith or the booths (half price, more for a named blade with deeds), or given to a sworn man (loyalty +2, +3 for an heirloom or a named blade; a weapon makes him better with it). Selling an heirloom (grandfather's sword, father's shield, Ormr's seax, Ásgeir's sword) costs honour. Bot: instant actions are never a fallback (a hoard in/out loop softlocked one coward life). |
| 2026-10-13 | **Trade and allies** (`docs/FRAME-TRADE-ALLIES.md`, Roadmap steps 2 and 3). **Trade:** 12 goods; ten ports make some cheaply and want others; prices move 2% a lot and recover; a yearly news item makes one good dear or cheap everywhere; spread by trade skill, toll by standing; goods share the holds with plunder; his own silver; a yearly deed for ten marks' profit; pirates for ships riding low. The first tuning paid 13 marks a round trip (about 50 a season) and was cut. As built, the best circuit pays 4–5 marks a round trip, about a raider's whole heap for a season spent at nothing else, with no men's shares and little fame. **Allies:** six captains with a relationship that starts from what they've heard of you; a meeting scene each; the summer's félag (his men in your fights, his holds, his men's share; he may hang back if he is no friend, and a greedy one takes more); the jarl's favour (gifts, the levy, a land grant; it moves his cut and the muster). Measured (40 ten-year lives a policy): about 2 captains met a life, 11–23 félags sworn across 40 lives; the jarl's favour ends slightly negative on average, because bots refuse his levy at random and never send gifts. |
| 2026-10-13 | **The fleet** (`docs/FRAME-FLEET.md`, Roadmap step 1). Every ship but the flagship has a master: a sworn man (2 extra shares, loyalty) or a hired steersman (3 extra shares, loyal to the silver, can sail off with her). Holds carry cargo × 500 ørtugar; raids and scene plunder stop at full holds. Storms can scatter a fleet (a ship late, or lost with her master). Prizes from sea fights; secondhand hulls wherever there is a shipwright; +3 muster per extra ship. Measured (40 ten-year lives a policy): 24–44% of lives reach two ships, mostly by prizes; a hired steersman sails off in about 1 life in 15; a scattered ship is lost in about 1 in 12. |
| 2026-10-13 | **Playtest 3 fixes.** (1) **The dead stay dead in the prose:** a fallen sworn man's bench goes to a named heir, and scenes written before the death name the heir instead; passages written around him (their condition names him) and his mourning keep his name; choices that need him are hidden, not greyed. A scan found 176 unguarded mentions, so this is engine-side, not hand-guarded. Choice labels now render tokens. (2) **The ship's purse:** food, sign-on gifts, hiring and refits come off the plunder heap before the share-out, then his own silver. (3) **The hoard** takes a mark, half, or all but a mark, and gives back a mark or all. (4) **Rumours lead somewhere:** a rumoured place on a known sea road can be sailed to; the old sailors give the way. Hedeby, Ribe and Birka are active markets with arrival scenes; Ubbi waits at Hedeby for the man who swore, and the Frisian summer with his Danes pays (or breaking the oath costs). (5) **The jarl's reckoning** when a boy of sixteen brings the jarl's ship home without his sister's son. (6) The Irish king's cup can be drunk even when the king beat him in the doorway. (7) Gyða's courtship can be declined at each step. |
| 2026-10-13 | **The foundation for play beyond the story** (`docs/FRAME-FOUNDATION.md`), on the author's instruction: discovery and expeditions; kit, fittings, men's gear and named weapons; the base (father's farm, own farm, hall; thralls, hoard, trophies); three more wives (Ingibjörg, Þórunn, Ásta) at the author's request; repeatable sea, port and winter events and a Yule every year with a sworn-boast pool the engine keeps. The captain he rows for now fills his benches each spring, and a ship is for sale each spring while he rows for another man (without it, 60% of ten-year lives were still oarsmen in 839 with a crew of ten). Measured (`npm run measure:sandbox`): 6–10 scenes a year through 838; a quarter to a third of lives buy a farm; about 30% marry. Ten-year raider lives: lasting fame 4.6 → 23.9; deaths in battle 14% → 23%, from the sea fights the new events bring. |
| 2026-10-12 | **Standing in the ports** (§11.5), at the author's request. One number per port drives docking, food, guest-right, hiring, wintering, and being fought on landing. Raids hurt the place and its people; trade, kept faith and time mend it. Guest-right was added after the bot showed that a captain with no silver could only feed his men by taking cattle, which turned the Norse ports hostile within a season. A castaway with no silver can work his passage home. |
| 2026-10-12 | **The year 831 and four new places**, on the author's instruction (frame in `docs/FRAME-831.md`). **Kaupang:** market, gear (mail, a Frankish sword), captives at a market price, Ubbi the Dane's offer. **Lindisfarne:** a raid shaped by the tide, the jewelled book. **Skye:** Kolbeinn's steading, hired men, Þórunn's offer of land, the papar. **Conaille:** the historical capture of King Máel Brigte in 831, his cup and his ransom. Also: return visits to Birsay and Iona, four sea events, the jarl's council and commissions, Gyða's bride-price and wedding, the brother at the boundary stone, the Hrappssons' fire, Yule 831 with the boasts reckoned, and spring 832 where the written story pauses (the oarsman gets a second chance at a ship). Engine: `sell_captives`, `recruit`, gear flags, a `winter` path, `{captain}` and `{ship}` text tokens. Measured (`npm run measure:831`): every surviving life reaches spring 832; about half are captains by then; the king of Conaille is taken in about half of runs. |
| 2026-10-12 | First playtest of the year: the writing and the fighting landed, and the sea events were fun. Three fixes. (1) **At another man's oar the game no longer talks as if he commands:** the muster, homecoming, place, voyage and crew screens, the winter training, the plunder exit (the captain's horn ends it) and the shield-wall all changed. In the wall an oarsman's orders become his shout, which the men round him take up. The four sea scenes with Ásgeir at the helm now fire only on the outward voyage. (2) **The captain feeds the ship:** no rationing or hunger while in service. (3) **At most one sea scene per leg of a voyage** (`SEA_EVENTS_PER_LEG`), so crossings keep moving. |
| 2026-10-12 | The year 830 built to the approved frame. Economy pass: Bangor's wealth is 1,500 and Iona's 720; at another man's oar, a quarter of the plunder goes to the ship and three quarters to the oars; captives sell for 24. Calibration scenes retired into the real year; the title preview became chapter jumps for playtesting. |
| 2026-10-11 | Calibration verdict: loved the voice, look and animation; the duel had too many options. Duel cut to three moves (§11.1). Fights now run 6–8 exchanges. |
| 2026-10-11 | Phase 2 frame approved as recommended (oarsman start, command won at Bangor; 4 boyhood scenes; captives with consequences; Ásgeir falls in about half of runs; a nickname by Yule; Gyða in the prologue). Calibration round built: Runestone reskin (bundled Alegreya fonts, pixel tab icons, knotwork), the scene renderer animating the converted art (fire, glow, water, smoke, sparks, gulls, a crowd that laughs with the hall), `[break]` Continue pages, and three calibration scenes (Ormr's night; Iona, the approach and the landing; the Yule flyting, ending in a holmgang or a nickname). Scene band is 400 × 160. |
| 2026-10-11 | Next-phase direction from the author: the Adalia process (all prose drafted by Claude; frame, then calibration, then build, then playtest). Goals: a sleek UI, a unique Viking visual identity, fine pixel-art scenes, animated battles and feasts, a campaign with real variety. Decided: **Runestone** look (§19a); **hybrid art** (Josh supplies sources, `tools/art.ts` converts them to the master palette, animation in code; §19b); **Phase 2 slice is the western raid route only**, with variety from approaches and pools, and campaign variety recorded as goals (§21a). |
| 2026-10-11 | Phase 1 built. Duel cycle rebalanced so each move beats two and loses to two. Bangor's defenders cut from 32 to 28. Map grid 16°W–34°E, 45°–66.5°N; the far reaches come later. |
| 2026-10-11 | Start year 830 at age 16 confirmed. Slavery included as a player choice with consequences, confirmed. Tone set: brutal, realistic, gory, with humour, glory, brotherhood, love and comedy (*Vikings*, *The Last Kingdom*, the sagas). Content lines, nicknames, flyting and boasts added (§1a). |
| 2026-10-11 | HTML/PWA; a sea map you travel freely, with the story through scenes; one long life; deeper than two phases a year; combat central, in three layers; mythology present and ambiguous; real 9th-century history; 3 backgrounds; full single-combat layer. Stack and process from Knight of Adalia; combat code-path rule from Free Company. |
