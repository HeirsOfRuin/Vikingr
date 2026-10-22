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
