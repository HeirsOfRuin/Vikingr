# Roadmap: the next five steps (fleet, trade, allies, hosts, the Frisian road)

## Context
**Where things stand:**
- The 830–831 story is built.
- The foundation is built: discovery; kit and named weapons; the base and wives; repeatable sea, port and winter events; a yearly Yule.
- After the story a life can raid, trade a little, buy land and marry. It cannot yet grow into a sea-king.
- Josh asked for five next steps, while he playtests. He named:
  - more story, characters and events;
  - a trading mechanic;
  - what happens when you can afford a second ship;
  - alliances with shipmasters and jarls;
  - battles larger than one crew against a similar number.

**What already exists to build on:**
- `state.ships` is already an array:
  - `capacity()` adds up the crew of every ship (`src/engine/crew.ts`);
  - `fleetSpeed()` takes the slowest ship;
  - ships can be built in the winter hall (`season.ts` `BUILD_TYPES`).
- `ships.yaml` already has a `cargo` field, but nothing uses it.
- The battle engine works on numbers of men, so it scales arithmetically (`src/engine/battle.ts`, `fights.ts` `startBattle`). The prose and the UI assume one crew.
- `rivals.yaml` holds historical legends, but only as a fame table (`fame.ts`).
- Hooks are already seeded in content:
  - Ubbi the Dane (`se_ubbi`, `ubbi_sworn`, `k_ubbi`) and the Dorestad boast;
  - Harek of Orkney and Kolbeinn of Skye, now fathers-in-law;
  - Hedeby, Ribe, Birka, Dorestad and Dublin are on the map but inactive.

**Recommended order:** fleet → trade → allies → hosts → story. Each step needs the one before it:
- A second ship is the gate to everything bigger.
- Trade uses ship cargo.
- Large battles need allies to fill a line.
- The story chapter (Dorestad, 834) shows off all four.

Each step follows the usual process: a short frame doc for approval, then the build, then measurement, then Josh's playtest.

**Step 0, ongoing:** playtest fixes go first. Playtest 3 is done (DESIGN decisions log, 2026-10-13). It already brought Hedeby, Ribe and Birka onto the map, and Ubbi's Frisian raid, which gives Step 2 and Step 5 somewhere to start.

---

## Step 1: The fleet (a second ship and its shipmaster) — built 2026-10-13 (`docs/FRAME-FLEET.md`)
**Problem.** A second ship today only adds benches. A real second ship needs a man at its steering-oar. It changes the share-out and what you can attack. It can also be lost, or stolen by its own master.

**Build:**
- **Ship state.** `Ship.master?: string` (a sworn man id, or a hired captain) and `Ship.men` (men split across hulls).
  - `crew.men` stays the fleet total. A save migration splits it across hulls.
- **Getting ships:**
  - Buy secondhand from a shipwright at a market.
  - Build in winter (exists).
  - Take a prize after a sea fight (new choice in `g_sea_merchant_won` and the rival fights).
  - Inherit through marriage (Ingibjörg's father) as a story hook.
- **Shipmasters:**
  - Each extra ship needs a master: promote a sworn man (Ketill, Ulf and others gain a `master` role) or hire one at a muster.
  - A master has loyalty and ambition. Low loyalty plus high ambition starts events: he wants his own share, he quarrels with another master, he sails off with the ship.
- **Fleet rules:**
  - **Share-out:** each ship takes a ship's share (a cost).
  - **Cargo:** loot carried is capped by the fleet's cargo total, and the excess is left on the beach. This makes the knarr worth having.
  - **Upkeep:** refit cost per hull.
  - **Storms:** a storm can scatter the fleet. A ship is separated and arrives later, or founders with its men.
  - **Prestige:** muster pool and fame scale with ships; "three ships follow my steering-oar" now matters.
- **Content (~8 scenes):**
  - promoting a master (each sworn man gets his own short scene);
  - a master's grievance;
  - "the ship that didn't come back";
  - a prize crew mutiny;
  - a fleet storm.
- **UI.** The Crew tab gets a per-ship card (master, men, hull, fittings), and the fleet appears on the map.
- **Key files:**
  - `src/engine/state.ts`, `crew.ts`, `season.ts` (share-out, refit), `voyage.ts` (storm scatter), `fights.ts` (prizes), `save.ts`;
  - `content/scenes/world/fleet.yaml`;
  - `tools/bot-lib.ts` (buy a second ship when rich, promote the most loyal man).

## Step 2: Trade — built 2026-10-13 (`docs/FRAME-TRADE-ALLIES.md`)
**Problem.** Markets sell kit and buy captives, and that's all. A trader's life ("the knarr, prices that move", DESIGN §21a) is a promised career path.

**Build:**
- **Goods registry** (`content/registry/goods.yaml`), about 10 goods with weight in cargo units and a base price:
  - wool and cloth, furs, walrus ivory and rope, amber, soapstone and whetstones, salt, Frankish wine, Rhenish glass, swords (Ulfberht-type, a smuggling risk), eider down;
  - captives stay as they are.
- **Markets** get a `trade:` block saying what they make cheaply and what they want. For example:
  - Kaupang: furs and whetstones;
  - Hedeby: wants furs, sells glass and wine;
  - Orkney: wants grain and wine;
  - Faroes: wool and down.
- **Prices move:**
  - Per-place supply in state: selling lowers the price, and it recovers over the year.
  - A yearly "news" roll shocks one good (a fur famine, a glut of wine), which rumours can reveal (`discovery.ts` `listen`).
- **Trade screen.** A new `pending: 'trade'` in the style of the shop screen:
  - buy and sell against cargo space;
  - your trade skill narrows the spread;
  - standing sets the toll (wary ports take a cut, allied ports none).
- **Risk and reward:**
  - Laden ships draw more rival and pirate events.
  - A rich run gives a modest deed ("a rich voyage"), so trading builds fame slowly and silver fast.
- **Map:** activate **Hedeby** and **Ribe**, and route to **Birka** as an expedition, so trade has somewhere to go.
- **Content (~10 scenes):** tolls, a cheating merchant, a guild of traders, smuggled swords, a market fire, Hedeby's arrival scene, and first visits to Ribe and Birka. Ansgar the missionary is in Birka about 830–831 and could appear as a historical cameo.
- **Key files:**
  - `src/engine/trade.ts` (new, modelled on `items.ts` `forSale` and `buy`), `state.ts`, `index.ts` actions;
  - `NowView.tsx` trade panel;
  - `places.yaml`, `goods.yaml`;
  - `tools/measure-trade.ts` (is a knarr circuit worth a raid?).

## Step 3: Allies (shipmasters and jarls) — built 2026-10-13 (`docs/FRAME-TRADE-ALLIES.md`)
**Problem.** The world has no other captains with their own lives. The jarl is a voice, not a power.

**Build:**
- **Captains registry** (`content/registry/captains.yaml`). About 8 persistent shipmasters. Each has a home, ships, men, temperament, ambition, a fame curve that moves with what they do, and a relationship (−10..10) with the hero. Candidates:
  - Ásgeir (if alive);
  - Steinarr (sour, ambitious);
  - Ubbi the Dane (Horik's hersir);
  - Kolbeinn's son on Skye;
  - Hrapp's kin (feud);
  - an Irish-Norse adventurer in Turgeis's orbit;
  - a Swede from Birka;
  - a rival who raids the same places first and empties them.
- **Félag (sworn partnership).** A partnership is sworn at Yule or in a port, and the ally sails with you for a summer:
  - his ships join the fleet as an allied wing;
  - plunder is split by men;
  - in a fight he may hold or leave, depending on relationship and morale.
  - Partnerships end in friendship, a feud, or a marriage alliance (his sister, your sister).
- **The jarl:**
  - **Favour.** A jarl favour value is added alongside home standing.
  - **The levy (leiðangr).** Some summers he calls for ships. Answering earns land grants (veizla), a seat nearer the high seat, and protection in feuds. Refusing costs standing.
  - **Gifts.** You can give him gifts.
  - **Succession.** He can die, and his succession becomes a story beat.
  - **Other lords.** Harek of Orkney and the Skye family become other lords you can owe or be owed by.
- **Rivals become real.** Some legends from `rivals.yaml` (Turgeis, Ragnar) appear as captains in scenes during their historical years.
- **Content (~12 scenes):** meeting captains, proposing a partnership, a partner's betrayal at the share-out, the levy call, a land grant, the jarl's funeral and the choosing.
- **Key files:**
  - `src/engine/allies.ts` (new), `state.ts` (`captains: Record<id, CaptainState>`);
  - effects `ally`, `favour`, `levy`;
  - conditions `captain.X.rel` and `favour`;
  - `fame.ts` (legends read live captain fame);
  - a new Allies section in the Saga tab.

## Step 4: Hosts (battles larger than one crew)
**Problem.** Every fight is one crew against about the same number. Real 9th-century turning points were fleets of 10 to 100 ships: Dorestad 834, the Irish wars of the 830s, Dublin 841, Paris 845.

**Build:**
- **Host battle mode** in `battle.ts`:
  - each side is a line of **three wings** (left, centre, right);
  - each wing has its own men, quality, morale, commander and doctrine;
  - each round, the existing round resolution runs per wing pair (reuse, not rewrite);
  - a wing that breaks exposes its neighbour (flank penalty), and a reserve can be committed.
- **Your role depends on rank:**
  - an oarsman or shipmaster fights inside his wing, using today's controls;
  - a wing leader gives orders to his wing;
  - a host leader gives host orders as well: commit the reserve, feigned flight, shield-fort, hold the ships.
  - Allies (Step 3) and their reliability decide whether a wing holds.
- **Scale.** 100–600 men a side. Losses fall on your crew in proportion, and on allies' state.
- **Assaults on defended places.** A staged assault: approach, the rampart or palisade fight, then the plunder rounds against the alarm clock (reuse `plunder.ts`).
- **Animation.** The shield-wall renderer draws three wings and shows a breaking wing.
- **Content.** Host-battle frames for the levy, a joint raid, an Irish king's war and a Frankish count's muster.
- **Key files:**
  - `src/engine/battle.ts`, `fights.ts` (`startHost`), `state.ts` (`HostState`);
  - battle UI, scene renderer;
  - `tools/measure-battle.ts` (host cells: equal hosts, ambush, an ally deserting).

## Step 5: The story, 833–835 ("The Frisian Road")
**Problem.** The written story stops at spring 832. The repeatable content carries a life, but it doesn't give it a saga.

**Build (the Adalia method: frame, calibration, writing):**
- **The spine.** Historical anchors:
  - the emperor's sons rebel (833);
  - Horik's Danes sack **Dorestad in 834** and again in 835–836;
  - Turgeis's war in Ireland;
  - the jarl's age.

  The beats:
  - **833:** Ubbi's invitation comes due. The hero either answers it or doesn't, and the Dorestad boast (it already exists) presses either way.
  - **834, Dorestad:** the first host battle, with the hero as a shipmaster in a Danish fleet. Then the richest plunder of his life, and goods to trade (Steps 1, 2 and 4).
  - **The western alternative:** an Irish king hires swords against Turgeis's men (Steps 3 and 4).
  - **At home:** the jarl's failing health, the succession, and the brother feud's aftermath. Each wife gets her own thread: Ingibjörg's father calls on her husband, Þórunn's brother wants the valley back, and Ásta's beach has trouble.
- **New characters:**
  - Ubbi the Dane;
  - a Frisian merchant who sells Dorestad's weak points;
  - Turgeis, at a distance;
  - the jarl's two sons;
  - a Danish shipmaster rival;
  - Ansgar's mission, in passing.
- **New places:** Dorestad, Walcheren, Hedeby (if not already active from Step 2), and a Dublin rumour.
- **A second batch of repeatable events** (about 20), regional so the Irish Sea, the Frisian coast and Danish waters each feel different. This answers the repetition risk from the last step.
- **Size.** About 15–20k words. A calibration round on 3 scenes comes first.

---

## Assumptions and risks
- **Size.** Each step is about the size of the foundation (Steps 1–3) or bigger (Steps 4–5). Steps 1–4 need some writing each; Step 5 is mostly writing.
- **Balance.**
  - Fleets make small targets trivial. Bigger targets (Dorestad, Armagh, York) and place fortification must arrive with Step 4, or raiding stops being dangerous.
  - Trade must not beat raiding outright. `measure-trade` sets the target: a good knarr circuit pays about 60–80% of a good raid season, with far less risk to life.
- **Bots.** Every step needs a bot policy, or the 10-year measurements stop meaning anything. A "trader" bot policy is added in Step 2.
- **Scope cut.** If scope must be cut, the order to drop is: Ansgar cameo → marriage alliances in the partnership → the reserve order in hosts.

## Verification (each step)
- `npm run check`: typecheck, tests, validate, lint:style, bot.
- New unit tests for each mechanic: fleet share-out and cargo cap; trade price movement; partnership share split and desertion; host wing breaks and flank penalty.
- `npm run measure:sandbox`, plus a step-specific measure (`measure-trade`, host cells in `measure-battle`).
- `npm run smoke` at 390 px.
- `npm run build:artifact` and republish to https://claude.ai/artifact/AhxpNHzX9SRk39U2X3weaU.
- Commit and push to `ccr-9163005a-duhupv`.
- Josh's playtest closes the step.
