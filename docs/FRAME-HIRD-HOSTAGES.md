# Frame: the hird grows, and hostages

Josh's playtest asked two things: how a lord gets more sworn men, and whether he can take hostages beyond the Conaille king (wives, children, political prisoners). Both approved 2026-10-14, with two side decisions: one prize ship a year, and the holmgang stays lethal (stepping off the cloak and paying is the way out).

## Part 1: the hird grows

### Problem
The game has exactly four sworn men, Ketill, Ulf, Hallvard and Bersi. When one dies, an oarsman takes his bench in the text, but nobody new ever swears. A ship-lord of the 840s should have 10 to 20 sworn men, and the fleet needs them: only sworn men steer a second ship loyally.

### Build
- **New men are generated** from `content/registry/recruits.yaml`: a name, a temper, a skill at arms, a starting loyalty and a one-line description, by origin.
  - **bench:** one of your own oarsmen, who did something worth noticing.
  - **norse, dane, gall** (Irish-Norse), **swede:** fighting men for hire in the ports.
  - **beaten:** the best survivor of a rival crew you beat.
  - **kin:** a wife's brother, a sister's son.
  - **freed:** a thrall you free.
- **The candidate.** A recruiting scene names its origin (`candidate:`). When it opens, the engine makes the man and holds him in `state.cand` until the scene ends. The text names him with `{cand}` and describes him with `{cand_desc}`.
- **Every oath needs an arm-ring.** The effect `{ swear_cand: silver }` takes a silver ring from the chest and makes him a sworn man. No ring, no oath. `{ cand_crew: true }` signs him on as an oarsman instead.
- **How many he can keep.** The cap is set by the base: 4 at his father's, 8 on his own farm, 15 with a hall (`HIRD.cap`). Paths: `hird` (sworn men alive), `hird.room` (places left).
- **Costs and limits.**
  - Each sworn man costs 8 ørtugar a winter (exists).
  - Loyalty drifts toward the middle each year without gifts (exists).
  - A new sworn man whose loyalty falls to 1 or below leaves at the turn of the year.
  - New men die in fights like the four. The four keep their own mourning scenes; a new man gets a line in the journal.

### Events (`content/scenes/world/hird.yaml`)
| Scene | When | Who |
|---|---|---|
| `hi_bench` | Winter in his own hall or farm, after a good season | An oarsman asks to swear |
| `hi_port_norse` | Kaupang, Birsay, Hlaðir, Birka, the Faroes | A Norse sword for hire |
| `hi_port_dane` | Hedeby, Ribe, Dorestad | A Dane with a past |
| `hi_port_gall` | Dublin, Man, Skye | An Irish-Norse half-blood |
| `hi_beaten` | After a sea fight, when the beaten crew are offered the oath | The best of them |
| `hi_kin` | The muster, married, once | His wife's brother |
| `hi_nephew` | The muster, from 838, once | His sister's son, fifteen |
| `hi_freed` | Winter, with thralls | A thrall who asks for freedom and an oath |
| `hi_leaves` | Code, at year's end | A new man of low loyalty walks |

### Targets
- A raiding lord with a hall has 8 to 12 sworn men by 840.
- Nobody reaches the cap of 15 before 842.

### Built and measured (`npm run measure:hird`, 90 bot lives, raider policy, 16 years)
- **Added in the build:** `hi_heir`, the man who took a fallen sworn man's bench asks for his oath at the next muster, under the name the scenes already gave him. It is the steadiest source.
- **Losses were the real limit.** A raider's bot fights four or five battles a year, and a sworn man hit in the wall died 40% of the time: about one sworn man a year was dying. Now 30%.
- **The bot's lives** (most never own more than a farm): median 1 to 2 sworn men, the top tenth 4. With a farm or hall: median 2 to 3.
- **Given a hall, 3 pounds and four rings in 834** (`--lord`): median 3 to 4 sworn men by 840, the top tenth 6. Below the target of 8 to 12. The binding limit is rings: the bot gives its four, then is too poor to have the smith make more. A player who keeps a ring in the chest gets two or three offers a year.
- Nobody reaches the cap.

## Part 2: hostages and political prisoners

### History it stands on
- **Irish hostage custom.** A king's submission was secured by hostages. A hostage was put in fetters when his side broke faith. Holding a king's son is a yearly income and a peace.
- **Ransom of churchmen.** Forannán, abbot of Armagh, was carried off in 845. Louis, abbot of Saint-Denis, was ransomed in 858 for 686 pounds of gold and 3,250 pounds of silver.
- **Women and children.** The annals record many women taken at Howth in 821. Most were sold. High-born ones were ransomed, held to bring their kin to terms, or married into alliances.

### Build
- **The record.** A hostage is a party in `state.hostages`:
  - who: the notable, and how many are with them (a wife and her children are one party);
  - kind and people;
  - the place taken from;
  - the kin who pay;
  - the price;
  - the day taken;
  - state: held, or surety.
- **Kinds,** from `content/registry/hostages.yaml`:

| Kind | Where | Price (ø) | Surety? |
|---|---|---|---|
| king_son | hall | 300–600 | yes |
| queen | hall | 400–800 | yes |
| noble_family (a lord's wife and children) | hall, town, island | 150–300 | yes |
| abbot | monastery | 300–700 | no |
| fosterling (a noble boy at the monks' school) | monastery | 150–300 | yes |
| merchant_heir | market, town | 150–400 | no |
| captain_kin (a rival captain's son) | at sea | 120–250 | no; political |

- **Taking one.** A new plunder action, "Look for someone worth a ransom", once per raid, not at another man's oar. It costs a round and raises the alarm. If it succeeds, the scene `hs_taken` follows the raid:
  - take them for ransom;
  - keep only the boy, and sell the rest;
  - sell them all with the other captives;
  - let the women and children go.
- **Holding them.**
  - Each party eats (4 ø a winter each).
  - Children and the old can sicken in winter (`hs_sick`).
  - A party can try to escape (`hs_escape`), more easily if there is no hall to lock them in.
- **Ending it.**
  1. **Ransom.** A go-between, a priest or a merchant, comes with an offer (`hs_envoy`). Accept it; haggle (a presence and trade check: more silver, or they walk away for a year); hold them as surety instead; or send the go-between home.
  2. **Surety.** A king's son, queen, noble family or fosterling held as surety pays a tribute every year (an eighth of the price), and his people's standing rises. Raiding his people's land breaks the peace (`hs_broken`): fetters, sending them home, or killing them, which starts a feud.
  3. **Sell them.** A hall action: thrall's money, and their kin hate you for good.
  4. **Free them.** A hall action: no silver; honour and standing.
  5. **Foster.** A fosterling held three winters or more can go home raised in your hall (`hs_foster`): lasting standing and a deed.
  6. **Marriage.** An unmarried hero holding a noble family can be offered the widow or eldest daughter by her kin, on their terms (`hs_marriage`): a wife, peace with her people, and the price forgiven. It is written as kin politics, not romance.
- **Political prisoners.** A rival captain's son taken after a sea fight costs that captain's goodwill while held. The jarl may demand you hand him over (`hs_jarl`): yes for favour, no against it.

### Targets
- In about one raid in three on a rich place, he can find someone worth a ransom.
- Ransom pays much more than selling the same people, for the wait, the keep and the risk.
- A surety held five years pays about its ransom over again, at the risk of a broken peace.

### Measured (same runs)
- 3.4 to 3.9 parties taken a life.
- A ransom averaged 370 to 440 ø (8 to 9 pounds); selling a party averaged about 30 ø. About one ransom every two lives, so ransom does not outrun plunder.
- What became of them (the bot chooses scenes at random): freed about 100, sold about 95, ransomed about 50, fostered about 15, held as surety about 15, died about 12, escaped about 10, handed to the jarl 2 to 3, married into 2 to 4.

## Assumptions and risks
- The Conaille king's ransom (`c_ransom`) stays as written: it is the story's version, and the template for `hs_envoy`.
- Ransom must not beat plunder. If measures show it does, the price ranges come down.
- Bot policies take the first affordable choice, so the hird and hostages get exercised in the 10-year runs.
