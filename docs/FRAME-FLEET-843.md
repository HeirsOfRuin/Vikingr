# Frame: the oarsman, the fleet, and the Loire years (playtest 7)

Josh's words: "There is not enough story built for the later start date, nor events for while you are in a fleet. It should feel different than sailing on your own. And there are too many events that don't handle being an oarsman well."

All three are true. The numbers follow.

## 1. Events that don't handle the oarsman
**Measured:** 56 world events can fire while he rows in another man's ship. 13 of them give him the captain's decisions:

| Event | What it asks an oarsman |
|---|---|
| A ship closing at sea (`g_sea_rivals`, `p1_sea_rivals`) | "Turn and meet them" / "Crowd on sail and run" |
| A man overboard (`g_sea_overboard`) | "Bring her round" / "Hold your course" |
| Becalmed (`g_sea_calm`) | "Out oars" / "Ship the oars and wait" |
| A stranded whale (`g_sea_whale`) | "Put in and butcher it" |
| Wreckage (`g_sea_wreck`, `p1_sea_wreckage`) | "Haul in the sea-chest" |
| Irish monks in a curragh (`rg_pilgrims`) | "Take them aboard. Monks sell." |
| A pilot (`rg_pilot`) | "Give him the steering-oar" |
| Turgeis's fleet (`rg_turgeis`) | "Close and hail them" |
| The Hedeby toll (`hd_market`) | pay the ship's toll |
| The Orkney hall (`p1_orkney_hall`) | "Offer the skald a place in your household" |
| Nantes (`cw_nantes`) | "Take your men up to the gate" |

Some add a line ("{captain} is already calling for the shields") but still offer the captain's choices.

**The rule, from now on:** at the oar, you choose what you do, not what the ship does.
- **The captain decides the ship's part,** by his temperament, and the scene says so.
- **Your choices are your own:**
  - go over the side after the man;
  - speak up to the captain (a speech check that can change his mind);
  - take your place at the rail;
  - help yourself to the chest when nobody is looking, and risk being caught.

**The validator enforces it.** A scene that can fire at the oar may not offer a choice with a ship-level effect (battle, loot, captives, crew, days at sea, provisions) unless that choice is marked for one side or the other.

**Size:** 13 events rewritten for the oar (about 4,000 words), plus the validator rule. It is a defect, so it is being fixed now.

**Built (2026-10-22):**
- **The rule is in the validator.** A choice that fights, loads or steers the ship (battle, host, captives, loot, provisions, crew, progress) must be marked for the captain (`visible_if: "!service"`), for the oar (`service`), or as open to both on purpose (`oar: true`).
- **The rule found 12 events that needed new choices at the oar,** more than the 10 in the table:
  - **Sea:** the closing longship, the wreck, the man overboard, the whale, the calm.
  - **Regional:** the Irish monks, the pilot, Turgeis's fleet.
  - **Ports and fleets:** the Hedeby toll; Nantes; Dorestad's jetties and its ruins (both reachable at the oar in 834).
- **What the oar can do now:**
  - choose where you stand when the captain fights;
  - count the other ship's oars and talk the captain into running;
  - shout him round for a drowning man;
  - hook the wreck's sea-chest while nobody's looking;
  - tell him it's bad luck to take a holy man off the sea;
  - keep the pilot's cup full and learn the channels;
  - take the ship-guard at Nantes and Dorestad.
- **Marked open at the oar on purpose:**
  - **Personal acts:** going over the side, whistling for wind, bailing.
  - **The 830–831 story,** where Ásgeir takes his prow man's advice and the text says so: Lindisfarne, Conaille, Kolbeinn, the curragh.
- **The Faroes landfall** needs a ship of his own; it was only ever reached by expedition.

## 2. Sailing in a fleet
**The problem:** there is no fleet at sea. Sixty-seven ships go to Nantes, and the voyage there is the same as one ship alone:
- the same single-ship events (a longship closes on you, as if one ship would attack sixty);
- the same pace;
- nobody else on the beach.

**Proposal:** while he sails with a fleet, the game knows it.
- **A fleet:** a name, a leader, and how many ships. It is set when he joins one, as an oarsman in a fleet ship or as a captain who took the arrow:
  - the Vestfold fleet, 843;
  - Dorestad, 834;
  - Rouen, 841;
  - the Seine, 845;
  - and later fleets.
- **It changes the sailing:**
  - the voyage goes at the fleet's pace;
  - single-ship dangers (a rival crew closing, pirates) don't come for a fleet;
  - storms scatter it instead of sinking it, and there is a meeting-place to make for.
- **About 14 fleet events,** in three places:
  - **At sea:**
    - keeping station at night by the leader's lantern;
    - a straggler (tow her, or leave her);
    - the horn that calls the captains to the leader's ship;
    - the fleet scattered and looking for itself.
  - **On the beach, in camp:**
    - crews quarrelling over water and firewood;
    - a dice debt to a man from another ship;
    - flux in the camp;
    - a foraging party inland;
    - the fleet's traders buying captives;
    - a crew from another district picking a fight with yours;
    - the leader's share rules, and the men who don't like them;
    - a captain who wants to break away with his ships.
  - **Before the fight:**
    - the sacrifice;
    - the leader's plan;
    - who goes first up the beach.
- **The fleet council:**
  - an oarsman hears its decisions;
  - a captain sits in it, and his voice counts by his ships and his name.

  Each event reads differently from the oar and from the steering-oar.
- **Later:** this is the first half of the "great fleets on campaign" item in `docs/FRAME-NEXT.md` (sieges, winter camps, a host moving on orders). This step is sailing in company, not the campaign engine.

**Size:** the fleet state, voyage and event rules, about 14 events (about 7,000 words), tests and a measure.

## 3. Not enough story after the 843 start
**Measured:** new story scenes met per life, the first eight years (12 bot lives each):

| Year of the life | 830 start | 843 start |
|---|---|---|
| 1st | 24.8 | 3.0 |
| 2nd | 17.3 | 1.7 |
| 3rd | 5.7 | 1.4 |
| 4th to 8th | 11.4 in all | 1.0 in all |

An 830 life meets about 42 written scenes in its first two years; an 843 life meets about 5. The rest of an 843 life is the generic world events.

**Proposal: the Loire years, 843–848**, a chapter as dense as 830–831.
- **843, at Ölvir's oar, in the Vestfold fleet:**
  - the gathering off Vestfold;
  - the voyage south (with the fleet events);
  - Count Lambert, the Breton who shows them the way in (historical: he guided the fleet to Nantes);
  - the night in the reeds;
  - Nantes (existing);
  - the share-out of a city among 67 crews;
  - the captives on the island;
  - the winter on Noirmoutier (one existing scene, plus 3 more: the monks' wine, a killing in the camp, Hastein's dice).
- **844, the Hart (existing), then a choice of summers:**
  - **The southern fleet** (5–6 scenes):
    - up the Garonne as far as Toulouse;
    - beaten off the Asturian coast;
    - Lisbon;
    - Seville taken and held for six weeks;
    - Tablada, where the emir's army catches them and hangs the captives from the palm trees.

    Deadly, as it was. The men who came home were rich, and there weren't many of them.
  - **Or the Loire and the coast** on his own account, with the fleet's camp as a base.
- **845:**
  - Ragnarr's arrow for Paris reaches the Loire (a new opening into the existing Paris chapter, for a man abroad);
  - Ölvir's debt (existing);
  - the Hamburg and Turgeis news.
- **846–848:**
  - the Loire Northmen and the Bretons;
  - Bordeaux with Hastein (847–848: the siege, the city taken at night), 3–4 scenes;
  - land on Noirmoutier, which can become home, tying into settlement.

**Size:** about 30 scenes, about 15,000 words, and a measurement pass (the same density table, target: within a third of 830's).

## Recommended order
1. **The oarsman pass:** now, a defect.
2. **Sailing in a fleet.** The Loire chapter is fleet sailing most of the way, so it needs this first.
3. **The Loire years.**

## Decisions needed
- **Approve 2 and 3, in that order?**
- **The southern fleet (Seville, 844):** build it as a playable choice? Recommended yes. It is the most famous voyage of the decade, and a hard lesson.
- **A captain in a fleet:** a voice at the fleet council, weighted by his ships and his name? Recommended yes. That is how a man rose from captain to leader.

---

## Josh's answer
"Yes to all." Fleet sailing first, then the Loire years; Seville as a playable choice; a captain's voice at the fleet council.

## Built
### 2. Sailing in a fleet
- **Fleets** (`content/registry/fleets.yaml`):
  - the Vestfold fleet (843);
  - the Danes at Dorestad (834);
  - the southern fleet (844);
  - Ragnarr's Seine fleet (845);
  - Hastein's Loire fleet (847–848).

  He joins one by a scene. Each breaks up at the turn of the year after its own, or when a scene says so.
- **In a fleet:**
  - the voyage goes at 85% of his own pace;
  - the lone longship, the merchant, the pirates and the pilot don't come;
  - a storm scatters the fleet: no ship founders, and seven in ten of the men washed over are picked up by other ships.
- **15 fleet events, each written for the oar and for the steering-oar:**
  - **at sea:** the leader's lantern, a straggler, the horn and the council, the fleet scattered;
  - **in camp:** the stream, dice, the flux, foraging, the fleet's traders, another district's crew, the leader's tenth, three captains breaking away, the fleet's skald;
  - **before the fight:** the sacrifice, and who goes first up the beach.
- **The council:** a captain's voice there is his ships plus his fame ÷ 40 (`fleet.voice`). It decides whether the council follows his plan, and whether he may ask for the first place up the beach.

### 3. The Loire years, 843–848 (33 scenes)
- **The map grows south** to 42.5°N, taking in Bordeaux, the Garonne country, the Pyrenees and the Asturian coast. **Bordeaux** is a new place: a market and a raid, three days' coasting from Noirmoutier.
- **843** (`content/scenes/843/02-loire.yaml`):
  - the gathering off Skiringssal (Hrói the Vestfolder, a friend for the chapter);
  - Count Lambert and his Breton (the road to the gate, or hostages);
  - the night in the reeds;
  - Nantes (existing; it now knows the road if the Breton gave it);
  - the share-out of a city among 67 crews;
  - three winter scenes on the island: the captives, a killing judged at the fleet's thing, the monks' cellar and the fire.
- **844** (`03-south.yaml`):
  - **The southern fleet:** the Garonne to Toulouse; the lighthouse and King Ramiro; Lisbon; Seville held six weeks; Tablada; the long way home.
    - Told as a chain of scenes beyond the map's edge. The fleet lives off the land, so no stores are eaten.
    - Tablada is a host battle against the emir's army, easier if he saw them coming.
  - **Or stay** (`04-loire-later.yaml`):
    - his first council with his own crew;
    - the monks come back for their books;
    - the salt fair;
    - the southern fleet's survivors, with Hrói one-eyed or not at all.
- **845–848:**
  - Ragnarr's arrow reaches the Loire (into the existing Paris chapter);
  - Hrói's father comes asking;
  - Lambert's war (a host battle beside his Bretons, for the bridge at Nantes);
  - a house on the monks' island (land, then settlement);
  - Hastein's fleet for Bordeaux: the Dordogne (King Charles takes nine ships), the siege, the postern at night, and the duke of Gascony alive or dead.
  - The chronicle's Bordeaux news now strikes the city unless he was there.

## Measured
**Reach** (18 raider bot lives from 843, 6 years):
- **Every 843 scene fires in every life.**
- **Fleet events:** the four sea events fire in 14–18 lives of 18, the camp events in 6–9.
- **The southern fleet:** about 1 life in 4 goes south (the bots choose at random); the voyage is deadly, as written:
  - Asturias: lost in 2 of 4 lives that went;
  - Tablada: the wall broke in both lives that stood to fight.
- **844 on the Loire:** the first-crew scene fired in every life, the monks in 16 of 18, the salt fair in 13. The survivors' scene fired in none: it needed a winter on the island, so it was moved to the next landfall in the Loire, 845–846.
- **845–848:** Lambert's war 11–12 of 18; the island house 14–17; Bordeaux 4.

**New story scenes met per life** (12 lives each):

| Year of the life | 830 start | 843, before | 843, now |
|---|---|---|---|
| 1st | 24.8 | 3.0 | 9.0 |
| 2nd | 17.3 | 1.7 | 7.3 |
| 3rd | 5.7 | 1.4 | 2.8 |

- **Plus the fleet events,** which count as world scenes in this table: about 6–8 more in the first year.
- **Short of the target.** The first two years now carry about 24 written scenes against 830's 42, under the target of 28.
- **Why:** 830's first year counts its whole written boyhood and its own sea events. An 843 life starts at sixteen at the arrow.
- **To close the gap:** a short written 843 voyage south (the coast of the Franks seen for the first time), and more of 846–848 that every life meets, not only those who go to Bordeaux.

## Playtest 8: the voyage south, 845–848, the skald, payments
Josh's words: "add the voyage south and more 846–848 scenes. Also add more use for the skald, like bringing them onto your boat or your hall ... Recheck all payments and ransoms ... it would make more sense if events like that gave you actual resource cargo, not just a couple pounds or less of silver."

### Payments: goods, not coins
- **New effect `goods: { id, lots }`.** Lots go into the hold, as many as fit. At another man's oar they go into the sea-chest (60). The result text says what went in and what was left on the beach.
- **New goods:** whale oil, Moorish silk and cattle hides, with markets that want them.
- **What changed:**
  - **Into the hold:**
    - **Salt:** the salt fair, Noirmoutier, the monks' island.
    - **Whale oil:** the beached whale (12 casks).
    - **Smaller lots:** amber at Truso; down and wool at the Faroes; wine and glass from merchants and Nantes; hides at Dublin.
    - **The south:** silk from Seville and Lisbon, and wine from the Garonne.
  - **Silver:** where the text named a sum, the silver now pays it: the Fontenelle and Lindisfarne tributes, the horse race, the harvest, the Irish winter market, and the Hart at four pounds.
  - **The share-out of Nantes** paid an oarsman 40 ørtugar, under a pound, for a city. It now pays:
    - an oarsman: 64 ørtugar and a crate of glass;
    - the prow-man: 96 ørtugar, a ring and two crates;
    - a captain: his ship's share of the city's wine, glass and salt.
- **Ransoms checked and left as they were:** an abbot 300–700, a king's son 300–600, Gunhard 900, Forannán 1200, Duke William 1400, captives 20–32 a head.

### The skald (`src/engine/skald.ts`, `content/scenes/world/skald.yaml`)
- **Each skald has a name.** Kálfr if he came from Birsay; Hallbjörn, Þjóðólfr or Óttarr if hired later.
- **Aboard or at home.** A home action switches him between the two, for the summer.
  - **Aboard, away from home:** every deed he sees weighs a quarter more. If a fight is lost, he dies 3 times in 10. Once a summer, after a won fight, he makes the verse while the blood is wet: lasting fame, or the men's names instead of yours.
  - **At home:** he sings at the jarl's benches, worth 1 favour at the turn of the year.
  - **Hired in a foreign port,** he is already aboard.
- **Any feast** he tells goes 15% better.
- **His Yule gifts:** 24 ørtugar a year, or he goes to a lord who gives them.
- **When the hero dies,** the skald makes the death-song: a lasting verse of weight 10, which counts toward the afterlife.
- **Six scenes:**
  - hiring one in the eastern or the western ports;
  - the verse after a fight;
  - seasick;
  - the fleet's skalds at the leader's fire;
  - a drápa for the hall (four pounds; two verses and the jarl's favour);
  - a king's offer to lure him away.

### The voyage south, 843 (`content/scenes/843/05-voyage.yaml`)
One scene on each leg the Vestfold fleet sails, and one at each landfall:
- King Horik's ships off the Danish point;
- the market at Ribe (the Hamburg priest);
- the low Frisian coast and the memory of Dorestad;
- Harald Klak, the baptized Danish king, holding Walcheren for Lothar;
- the Frankish beacons and the Breton tide-race.

### 845–848, wherever he is (`content/scenes/843/06-years.yaml`)
Scenes tied to the year, not the place, so every 843 life meets them:
- a man from the Paris fleet with the flux and his share;
- the hard winter of 846;
- the kings' warning from Meersen (847);
- a sixteen-year-old who wants a bench (847), five years after the hero's own;
- Norse survivors of Forach and Sciath Nechtáin (848).

## Playtest 9: the Loire life, from a save
- **The calendar.** Season-start scenes could fire on any quiet moment, winter included. The Loire spring (the Hart, the southern fleet) fired on 12 January 844, so the voyage south ran January to April, the island's winter scenes came in June, and spring began on 8 July. Season-start scenes now wait for the spring unless written for the winter (`director.ts`).
- **Fleet fights.** A fight in a fleet takes a `ratio`: the men in front of your ship are counted from your crew (never fewer than 6). The Asturian beach, the night attack on Noirmoutier and the Poitou raid are host battles beside allied crews. Tablada, the Dordogne and the Bordeaux postern scale the same way.
- **Pay.** The Garonne pays 260 and 4 casks of wine (Toulouse 480); Lisbon 200 and 4 captives; Seville 900, 4 bolts of silk and 8 captives (the richest take of a life).
- **Goods.** A card on the Hero tab shows the hold or sea-chest: lots, value at an ordinary market, and where they are wanted. The sea-chest holds 120.
- **Spending and men.** A great fleet's camp has 10 men for hire; Noirmoutier is a Norse camp from 843.
- **Loot.** Two plunder choices, once a raid each: search the dead and the hall for war-gear (helmet 30%, mail 15%, a Frankish sword 15%, more among Franks, Frisians and English), or break open the stores (2–4 lots of goods by people).
- **Aude of Nantes.** The captive girl on the monks' island can be bought out of the captives (24). In spring 844 her father brings the ransom: send her home (72), give her back without it (honour 2), or keep her. Kept, she is a bondwoman and runs the household; from the winter of 847, grown, she can be freed and married, or freed with a dowry. Sent home, her father helps at Lambert's war.
- **Fights.** The dead Vestfolder's brother (a duel in the winter camp), the Franks on the island at night (845–847), a Poitou monastery with Hastein's men (846–847).
- **Abroad.** The captive trader, the winter fires and the weather read for where the life winters. A save can be loaded from the title screen.
