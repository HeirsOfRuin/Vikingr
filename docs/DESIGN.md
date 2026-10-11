# DESIGN — Vikingr

Status: **Phase 0 (proposal).** Nothing gets built until this is approved. Decisions log at the bottom.

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

---

## 1. Design pillars

1. **Fame is given, not hoarded.** A lord was praised as a ring-giver. Silver in a chest earns nothing. Silver given away becomes loyalty, followers and verses. This is the core loop.
2. **You win by dying well.** Valhalla takes the battle-slain. The stronger he gets, the harder a good death becomes. The late game is about choosing when and how the story ends.
3. **Fame exists only when it is told.** Deeds become fame when a skald composes them, a feast hears them, or traders carry them. Deeds no one tells fade.
4. **Every fight puts him at risk.** He chooses where to stand: front rank, in the wall, or behind it. Fame and danger come together. Wounds stay with him.
5. **The men have names.** The sworn men are people with temperaments, oaths, grudges and ambitions. Most stories come from them.
6. **The gods are in the weather.** Every omen has an explanation without the gods. The game never says which reading is true until the very end.
7. **The century moves without him.** Dublin is founded, Paris burns and the Great Army lands whether he is there or not. Historical figures compete with him for fame.

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

  | Action | Beats | Loses to |
  |---|---|---|
  | **Strike** (high or low) | Feint | Guard |
  | **Guard** | Strike | Bind, Bash |
  | **Bind** (hook the shield or blade) | Guard | Strike |
  | **Feint** | Guard, Bind | Strike |
  | **Shield-bash** | Guard | Feint, Strike |

  The cycle is provisional; `measure-duel` balances it.
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

| Background | Start | Edge | Burden |
|---|---|---|---|
| **The younger son** | A bóndi's second son; the farm goes to his brother | Balanced stats, a family, a father's name that means something locally | A brother who resents him, no inheritance |
| **The outlaw** | Killed a man at 16; outlawed from the district | Weapons +, a deed already | A blood feud from day one, honour negative, no home harbour |
| **The freedman's son** | Son of a *leysingi*, a freed thrall | Craft and Seamanship +, a hunger others lack | The leysingi stain: the same prejudice idea as Adalia's new man, and a former master's family with claims |

---

## 16. Assumptions and open decisions

| # | Topic | Recommendation | Status |
|---|---|---|---|
| 1 | Start year | **830 at age 16.** It puts the peak of the century (841–866) in his prime. The cost is that the earliest raids (793–820s) are backstory, not playable. | Recommended, needs your confirmation |
| 2 | Thralls and slaving | Present, because slave-taking was a central source of raid profit and leaving it out would be dishonest to the period. **A player choice, never required, never glorified.** Taking captives has consequences: unrest, escapes, the freedman's-son background seeing it differently. | Recommended, needs your confirmation |
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
| `lint-style.ts` | Banned phrases, modern idioms, confirmed-divine-cause wording (§12) | — |
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

## Decisions log
| Date | Decision |
|---|---|
| 2026-10-11 | HTML/PWA; a sea map you travel freely, with the story through scenes; one long life; deeper than two phases a year; combat central, in three layers; mythology present and ambiguous; real 9th-century history; 3 backgrounds; full single-combat layer. Stack and process from Knight of Adalia; combat code-path rule from Free Company. |
