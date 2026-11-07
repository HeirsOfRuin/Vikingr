# Fleets that move, a realm of your own, a fleet of your own (November 2026)

Josh, 2026-11-07:
> "I want to fix every fleet! Or maybe each fleet has periods where it allows you to leave and come back, then times where you must follow it. This would likely require more story for each fleet."

Then: "write the framework and then begin working on the Mediterranean voyage, then these next steps."

**Order:**
1. The Mediterranean voyage (`docs/FRAME-MED.md`). It is built to Part A's fleet rules from the start.
2. Part A: every fleet.
3. Part B: a realm of your own.
4. Part C: a fleet of your own.

Each part is built, measured and played before the next.

---

## Part A: every fleet has a course

### The problem
- **Only the great army has a place** (its camp), and only since 2026-11-07. Being sworn to any of the other five fleets counts as being with it wherever you sail: its storms, pace, hiring and events follow you to Iceland.
- **The fleets' stories are gated on "be at place X in year N".** Miss the year and the beat never comes. In the great army it is worse: the scene that moves the camp is the one you missed, so the army never moves again in your game.

Every camp move is gated this way:

| Scene | Requires | Moves the camp to |
|---|---|---|
| `e66_north` | 866, at Gipeswic | Jórvík |
| `e67_kolr` | 867, at Jórvík | Snotingaham |
| `e68_back` | 868, at Snotingaham | Jórvík |
| `e69_east` | 869, at Jórvík | Þjóðford |
| `e70_reading` | 870, at Þjóðford | Readingas |
| `e71_alfred` | 871, at Readingas | Lundenwic |
| `e73_repton` | 873, at Lundenwic | Hreopandun |
| `e74_parting` | 874, at Hreopandun | Jórvík (Hálfdan) or Þjóðford (Guthrum) |
| `e77_swanage` | 876–877, at Þjóðford | Cippanhamm |

### The rule: two postures
Your idea, made into the rule:

| Posture | What the fleet is doing | A captain may | Fleet events, pace, storms |
|---|---|---|---|
| **Lying** | In camp, wintering, in siege lines, at anchor while kings send envoys | Sail off on his own account and come back (as built for the army on 2026-11-07) | Only while he is with it |
| **Bound** | On passage or on campaign: sailing or marching for a place | Follow it, or leave it | Yes |

- **Following a bound fleet.** A captain's sea actions are replaced by "Sail with the fleet for X", which works like the oarsman's "Row on with your captain", plus "Leave the fleet". Other sea actions show the reason they are shut: "The fleet is bound for Nantes. You sail with it, or you leave it."
- **Leaving a bound fleet is desertion.** It costs honour, the leader's favour, and your share of whatever the fleet takes next, and you are out of the fleet for good.
- **Leave windows.** Some fleets have named points where going home is ordinary and costs little: after the Rhône and after the second winter in the Middle Sea, or once the Garonne is done.
- **An oarsman** is unchanged: his captain decides.

### The course: a timetable for each fleet
- **The data.** `fleets.yaml` gets a `course`: dated stages, each `{ from: [year, day], at: place, posture: lying | bound, note }`, drawn from the annals.
- **Scenes first.** When he is there, the written scenes move the fleet, as they do now (`camp`, and a new `fleet_to`).
- **The timetable catches up.** When he is away and a stage's date passes, the fleet goes on without him. Back at the old place, he hears that it left for X so many days ago, and the map banner shows where it went.
- **Missed beats.** A beat he missed is told as news. The year gates on the beats that follow are widened where history allows, so a late captain catches the fleet's next beat, not its last.

### The fleets, one by one

| Fleet | Bound | Lying | New story |
|---|---|---|---|
| **The Danes, 834** | From Ribe or Hedeby to Dorestad (June 834, Annals of St-Bertin) | At Walcheren after the sack, all summer (the Danes stayed in Frisian waters and came back in 835 and 836) | The muster at Ribe (1). At Walcheren (2): the Frisians come to buy back their own goods; a quarrel over the shares |
| **Vestfold, 843** | From Kaupang to Noirmoutier (the voyage south, exists); to Nantes (exists) | On Noirmoutier, from after Nantes to the year's end (winter scenes exist) | The summer camp after Nantes (1): the annals say they harried the Aquitanian coast from the island |
| **The southern fleet, 844** | Throughout. It is a chain of scenes off the map | None | A leave window after the Garonne (1 choice): turn back from the Gironde with what you have |
| **Ragnarr's, 845** | Walcheren or the Loire to the Seine to Paris (exists); home, with the flux (exists) | At Saint-Denis while King Charles gathers the 7,000 pounds (Easter to early summer) | Lying at Paris (2): the abbeys downstream are open to you; the king's envoys and Ragnarr's council |
| **Hastein's, 847–848** | From Noirmoutier to Bordeaux (exists: the Dordogne) | In the siege lines at Bordeaux, winter 847–848; free to forage up the Garonne and Dordogne | The winter in the lines (2–3); a leave window; the night the town falls (exists) |
| **The great army, 865–878** | Each move: the ride north, Nottingham, Thetford, Reading, London, Repton, the parting, Wareham and Exeter | At each camp (exists) | A timetable from the Anglo-Saxon Chronicle; each camp move becomes a bound stage; the year gates widened; one lying-time scene per camp that has none |
| **Hastein and Björn, 859–862** (the Middle Sea, built first) | From Noirmoutier, then the whole chain off the map | Noirmoutier while the fleet gathers (spring 859). The Camargue (winter 859–860, off the map: only the leave window) | Written to these rules from the start |

**One I'd leave out:** the Annals of St-Bertin say Bordeaux fell in 848 "by the treachery of the Jews". That is a Frankish annalist's charge, of a kind made often and without evidence. I'd tell the fall as a postern opened by someone, and leave the charge out of the game.

### Engine
- **The fleet's state:** `{ id, since, at, posture, away?, bound_for? }`. `camp` migrates to `at` with posture lying, so old saves keep working.
- **Effects:**
  - `camp: X`: the fleet lies at X;
  - `fleet_to: X`: the fleet is bound for X.
- **Actions:**
  - "Sail with the fleet for X", using the same road-finder as following a captain (by sea, or by road for the army);
  - "Leave the fleet".
- **The timetable check** runs once a day with the chronicle.
- **The map:** a banner for the fleet he is sworn to (built for the army). "Bound for X" shows on the label.
- **The bot** follows bound fleets, raids near the camp while a fleet is lying, and goes back to it before the season ends.

### Targets
- **No fleet's story stalls.** A gauntlet check: a sworn captain's fleet is never left more than one stage behind its timetable.
- **Lying periods get used.** In 60 bot lives, captains spend 20–50% of lying time away from the fleet.
- **Desertion is rare.** Under 10% of sworn summers end in desertion.

### Built (2026-11-07)
- **The engine:**
  - The fleet now has a posture, lying or bound, and a `moved` day.
  - `fleets.yaml` gives five fleets a `course` timetable. The 844 voyage south and the Middle Sea are chains off the map and need none.
  - The new `fleet_to` effect sets a fleet bound for a place. The `camp` effect now means lying.
  - While a fleet is bound, a captain has "Sail with X for Y" (it marches where there's no sea road) and "Leave X", which is desertion: 2 honour. Every other sea action shows why it is shut.
  - The timetable catches up once a day. A fleet that moves while he is away sends "Word of the fleet".
  - A fleet that goes on to lie somewhere he isn't marks him as away.
  - The map banner shows "bound here".
  - A gauntlet rule fails any life whose fleet falls behind its own timetable.
- **The story:**
  - The Danes at Walcheren: the Frisians buy back their cloth; a quarrel over the shares.
  - The Vestfold summer on Noirmoutier.
  - A turn-back window at the Gironde for the southern fleet.
  - Ragnarr's fleet waiting at Paris, and its council. The fleet breaks up with the silver, and the payment now waits until he is with the fleet.
  - The siege of Bordeaux, split up. It was one scene that skipped 200 days. Now: the arrival and digging in (the fleet lies there), a winter in the lines, and the postern in spring 848.
  - Two scenes of great-army camp life: the army's market, and an English nobleman come to buy a kingship.
- **Measured** (36 sworn lives over the 843 and 865 eras, raider and reckless bots):
  - The fleet never fell behind its timetable (the gauntlet rule).
  - Lying time spent away: 73%, against a 20–50% target. The bots raid out from the camp and come back between raids. This measures the bots' habits more than the design, and the mechanic itself works.
  - No desertions, so under the 10% target.

---

## Part B: a realm of your own

### What exists
- **Holdings** (`src/engine/land.ts`):
  - a ship-fort dug at a hostile place (its people try to take it back every winter);
  - land granted by a lord;
  - land bought in a Norse place;
  - land claimed in an empty country.
- **Places change hands:**
  - the chronicle turns places Norse at their historical dates (Dublin 841, Noirmoutier 843);
  - a fort makes a place Norse while it stands.
- **Four seats you can claim** (`src/engine/rule.ts`): jarl in Orkney, king in Dublin, jarl in Hordaland, count of Walcheren. The claim is weighed on fame, men, a lord's favour, standing, kin and land; a rival claimant contests it.

### What is missing
- **Seats are hard-coded, and there are only four.** There is no seat where the Northmen did rule in this period: York, East Anglia, the Five Boroughs, the Loire, the Isles.
- **No way to raise your own holding into a seat.** A ship-fort held for ten winters is still a ship-fort.

### Build
- **Seats move to data:** `content/registry/seats.yaml`. Each gives the place, the title, the years it can be claimed in, who holds it before you (a legend or a native lord), what the claim needs, and what the seat gives.
- **New seats, each on a historical anchor:**

| Seat | Title | Claimable | Anchor |
|---|---|---|---|
| Jórvík | king in Jórvík | from 867 (the kings fall); from 876 in earnest | Hálfdan shares out Northumbria in 876 (Anglo-Saxon Chronicle); Guðrøðr king in York c. 883 |
| The East Angles (Þjóðford, Gipeswic) | king of the East Angles | from 870 | Edmund killed in 869; Guthrum settles East Anglia in 880 (Anglo-Saxon Chronicle) |
| Snotingaham (the Mercian boroughs) | jarl in Snotingaham | from 877 | The army shares out Mercia in 877 (Anglo-Saxon Chronicle) |
| Noirmoutier and the Loire | lord of the Loire Northmen | from 843 | The island camp, used for decades. Later, Northmen ruled Nantes from 919 to 937: a plausible step forward in time |
| Man and the Isles | king of Man and the Isles | from 850 | The Gall-Gáedil and their lords of the Isles (the Irish annals, 850s); the kingdom of the Isles is later |
| Dorestad and Frisia (alongside Walcheren) | lord of Frisia | 850–873 | Rorik, given Dorestad by the emperor Lothar in 850 (Annals of St-Bertin) |

- **Raising your own holding.** A holding held three winters or more, with enough fame and men and standing, can be raised into a lordship ("lord of X"). That is smaller than a historical seat, but yours.
- **A Christian kingdom** needs its king beaten, or a treaty. The model is Guthrum: baptised, with Alfred as his godfather, and a treaty after Edington (878). Choices: take baptism and the treaty, or keep fighting for it.
- **Ruling:**
  - a yearly yield;
  - a levy of men in spring;
  - threats: the old kings come back, other Northmen want it, your own men quarrel;
  - being seen at your seat (exists);
  - your heir inherits (the heir system exists).
- **Story:** each new seat gets a claiming scene and 2–3 seat events, about 20 scenes in all.

### Targets
- **Reachable.** In 60 bot lives in the 865 era, 3–8 claim a seat.
- **Fragile.** A seat is lost within five years about a third of the time.

### Built (2026-11-07)
- **Change from this frame:** seats stay in `src/engine/rule.ts` rather than moving to `seats.yaml`. Each has logic of its own (who the rival is, when it opens, what ties a man to it), and that logic reads better as code than as data.
- **Six new seats, each with a rival from history and a claim scene at its place** (`content/scenes/world/realms.yaml`):
  - king in Jórvík (from 867; rival Hálfdan, later Guðrøðr);
  - king of the East Angles (from 870; Æthelred the army's English king, later Guthrum). Its claim scene offers baptism and a treaty with the West Saxon king, worth 40 on the claim;
  - jarl in Snotingaham (from 877);
  - lord of the Loire Northmen (from 845, against Hastein);
  - king of Man and the Isles (from 850; Gofraid son of Fergus, later Ketill Flatnose);
  - lord of Frisia (850–873, against Rorik).
- **A lordship of your own.** Any holding kept three winters, with fame of 80 or more, can be raised into "lord of X": half a seat's tribute and men, no rival claimant, lost if he isn't seen there.
- **Each seat's troubles** (one a year at most, in order):
  - Jórvík: the archbishop's lands; the Northumbrians' rising; a coin of his own;
  - the East Angles: the dead king's church; the border stones;
  - Snotingaham: Ceolwulf; the five boroughs' thing;
  - the Loire: the Breton king's war; the monks' lamp;
  - the Isles: the poet; the kings in Dublin;
  - Frisia: the emperor's summons; the sea over the dikes;
  - a lordship: a hall of your own; the neighbours.
- **Measured** (60 bot lives from the 865 start, 20 years each): 3 took a seat (king in Jórvík, count of Walcheren, jarl in Hordaland), and 2 of them lost it again. Target 3–8: met, at the low end. Only 4 lives reached fame 150.

---

## Part C: a fleet of your own

### What exists
Several ships with shipmasters, sworn partners whose ships sail beside you, host battles with three wings, and a council voice in other men's fleets. There is no way to raise a great fleet yourself.

### Build
- **The war-arrow.** In winter at your hall or seat, with fame past a threshold, you name a target for the summer: a place (York, Paris, Dorestad) or a country (England, the Seine).
  - Captains answer the arrow according to your fame, your seat, your gifts, how last summer went, and your partners. The captains in `captains.yaml` answer by name; the rest are numbers.
  - The result is N ships and M men beside your own.
- **You lead it.** It uses the fleet engine with you as leader:
  - lying and bound are yours to call;
  - council events read from the leader's seat: you decide, and the captains' voices push back;
  - host battles have you as host leader.
- **Cohesion holds it together.**
  - It falls with idle weeks, losses, a bad share-out, a lost fight.
  - It rises with plunder and gifts.
  - Below set levels, captains go home, the named ones with their own reasons.
- **The share-out.**
  - You take a leader's share and owe gifts.
  - When you have beaten a host or sit outside a town, you can bargain with its king for tribute, on the Paris model.
- **The end.** The fleet breaks up at the year's end, or when you dismiss it. It can winter together in a camp, as the English "here" did, if you can feed it.
- **Story:** about 15 scenes.
  - the arrow answered;
  - the first council;
  - a captain's quarrel;
  - the leader's share;
  - a king's envoys and tribute;
  - the fleet that won't go home;
  - a rival captain who wants your place.

### Targets
- **Rare.** 2–6 lives in 60 raise a fleet; this is late-game.
- **Rewarding, but not a sure thing.** A fleet summer pays 3–5 good raiding summers if it holds together, and breaks up early about a third of the time.

### Built (2026-11-07)
- **The war-arrow** goes out from the winter hall (`src/engine/ownfleet.ts`, `content/scenes/world/ownfleet.yaml`). It needs:
  - a name of 350 or more;
  - a hall of your own or a high seat (as framed);
  - two ships of your own;
  - no other fleet.
- **The arrow can name a place** (Jórvík, Lundenwic, Paris, Dorestad, Hamwic) or none.
- **Ships answer in the spring:** one for every 45 fame, plus 3 for a seat and 2 for a sworn partner, up to 12, with 30 men each.
- **In the fleet:**
  - Its crews stand in his line in every fight, as cohesion lets them. Their losses are their own.
  - They take their own plunder, and his leader's share of it (40%) goes into his purse.
  - A town can be sent to for tribute once a year (about 30% of its wealth, scaled by how far the fleet outnumbers its men). His share is 40%.
  - Cohesion (0–10) rises with fights won, plunder and tribute, and falls with fights lost and weeks idle at anchor. Below 2.5 a captain may take his ship home each week.
  - The fleet breaks up when he hauls up at the season's end, unless he asked it to winter with him.
- **Scenes:**
  - the arrow, and the arrow answered;
  - the captains' council;
  - two crews' quarrel;
  - the leader's share;
  - the man who wants your place;
  - envoys from a town;
  - the fleet that won't go home.
- **Measured** (60 bot lives, raider and reckless, the three eras, 20 years each):
  - 9 lives raised 22 fleets of 11 ships on average, against the 2–6 target. These are long-lived, famous bots; the threshold went from 120 to 350, with a hall or seat and two ships.
  - A fleet summer kept him 23.4 pounds against 6.5 for an ordinary summer: 3.6 times, inside the 3–5 target.
  - Fleets sent home early by his own choice: about 1 in 6, under the third targeted.
  - Towns made to pay: 61.

---

## Size and order

| Step | Engine | Scenes | Notes |
|---|---|---|---|
| 1. The Middle Sea, 859–862 | Small: the fleet, a leave window, the bot | ~14 | `docs/FRAME-MED.md` |
| 2. Part A: every fleet | Medium: posture, timetable, follow and leave, map, bot | ~15 | Fixes a stall that exists today |
| 3. Part B: realms | Medium: seats to data, raising a holding, seat events | ~20 | |
| 4. Part C: your own fleet | Medium to large: the arrow, cohesion, leading a council, tribute | ~15 | Needs B for the seat as its base |

## Assumptions and risks
- **Following can feel like a railroad.** Bound periods are kept short; leaving is always open on the map, with its price stated on the button.
- **The timetable against the written scenes.** The scenes win when he is there; the timetable moves the fleet only when he is away.
- **Late-game ease.** A realm and a fleet could make the late game easy. Threats and cohesion are the brake, and both are measured before they ship.
- **Volume.** About 64 scenes over the four steps, roughly 30,000 words.

## Recommendations on the open points
- **Leaving a bound fleet:** always possible on the map, at a cost. Off the map (the Middle Sea, the voyage south), only at the named windows, because there is no map to sail away on.
- **Realms:** both kinds. Historical seats with their own stories, and a generic lordship for any holding you have kept long enough.
