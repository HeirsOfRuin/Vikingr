# Frame: the fleet (Roadmap step 1)

**Status:** built on the author's "Continue" (2026-10-13), following `docs/ROADMAP.md` step 1.

## Why
A second ship today adds benches and nothing else. A real second ship needs a man at her steering-oar. She changes:
- the share-out;
- what you can carry home;
- what a storm can do to you.

She can also be lost, or sailed off by her own master. Without that, "three ships follow my steering-oar" is a number, not a story.

## Rules
- **The flagship is yours.** Every other ship needs a **shipmaster**:
  - **A sworn man** (Ketill, Ulf, Hallvard, Bersi, if alive and sworn). Giving him the steering-oar raises his loyalty, and he takes 2 extra shares at the share-out. Some sworn men will one day want a ship of their own.
  - **A hired steersman** (named, from the district or the port). He takes 3 extra shares, and his loyalty is to the silver.
  - A ship that joins the fleet with no master gets a hired one at once, and a scene follows to let you choose.
- **Cargo.** Each ship carries `cargo × 500` ørtugar of plunder:
  - karvi and snekkja: 1,500 (about 62 marks);
  - skeið: 2,000;
  - knarr: 5,000.

  A raid stops taking silver when the holds are full ("the ships are full: leave the rest"). Scenes that add plunder are capped the same way. This is what makes a knarr in the fleet worth her keep.
- **Storms scatter fleets.** With two or more ships, a storm can separate one:
  - she comes in a day or two late (the fleet waits);
  - or, rarely, she founders with her men, and her master if he was a sworn man.
- **Getting ships** (a secondhand hull is for sale wherever there is a shipwright: home, or a market):
  - build one in winter (exists);
  - buy secondhand from a market shipwright (a karvi or a knarr, at about 0.7 of the price);
  - take a prize after a won sea fight (the fat knarr, a rival's longship).
- **Muster.** Each ship beyond the first adds 3 men to the muster pool. Men come to a man with ships.
- **Fleet cap:** 5 ships, until the hosts step.

## Content (fleet.yaml)
- **A ship needs a master** (queued when a second or later ship joins): choose a sworn man, each with his own short answer, or keep the hired man.
- **The hired man's price:** the steersman wants more, or he'll take her to someone who'll pay.
- **A sworn master's ambition:** he wants her for his own. Give her to him (you lose a ship, gain a friend and fame as a ring-giver), promise him, or refuse.
- **Masters' quarrel** (three ships or more): two masters, one beach, one insult.
- **The ship that didn't come back:** after a scattered ship founders.
- **A prize crew:** a prize's crew asks to row for you.

## Measures
- Unit tests:
  - the cargo cap in a raid and on scene plunder;
  - masters' shares at the share-out;
  - prize and secondhand ship acquisition;
  - the storm scatter.
- Bot: buys a second ship when rich, and appoints the most loyal sworn man.
- `measure:sandbox`: how many lives reach two ships, and the cargo cap hit rate.
