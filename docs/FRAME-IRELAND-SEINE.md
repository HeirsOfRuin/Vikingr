# Frame: Ireland and the Seine, and the third batch of places

Josh, 2026-10-15: "Continue with your suggestions, as well as adding in several more English, Scottish, and Irish towns/ports/monasteries." The suggestions were the Dublin ship-fort (841) and the Seine (Rouen 841, Paris 845). Josh also sent a painting of a Gaelic monastery from the sea, now the art `celtic_monastery`.

## The history it stands on
- **841, Ireland.** Norse crews built ship-forts (longphuirt) at Duibhlinn and at Linn Duachaill and wintered in Ireland for the first time (Annals of Ulster). From them they raided Leinster and the midlands.
- **841, the Seine.** In May a fleet under one the Franks called Oscherus, that is Ásgeir, came up the river:
  - it sacked Rouen and burned Jumièges;
  - it took six pounds from Fontenelle to spare it;
  - it sold sixty-eight captives back to the monks of Saint-Denis for twenty-six pounds.
- **845, Paris.** At Easter Ragnar (Reginherus) came up the Seine with a hundred and twenty ships.
  - He beat half of King Charles's army while the other half watched from across the river.
  - He hanged a hundred and eleven prisoners on an island in their sight.
  - He sacked Paris, and was paid seven thousand pounds of silver to leave.
  - A flux went through his fleet on the way home.
- **845, Ireland.** Turgeis was drowned in Loch Uair by Máel Sechnaill. Forannán, abbot of Armagh, was taken at Cluain Comarda and carried to the ships of Luimnech.

## The chapters
- **Spring 841: two fleets (`sp_841`).** At the muster, the ship-forts in Ireland and Ásgeir's Seine fleet arrive as news together. Choose Ireland, the Seine, or neither.
  - The Seine's leader is your Ásgeir if he lived, the maimed Ásgeir from his steering-oar if he was maimed, or a Danish Ásgeir, no kin, if he fell at Bangor. The Franks write "Oscherus" either way.
- **Ireland:**
  - **`ir_fort`.** He joins the fort at Duibhlinn, or takes its high seat. The high seat needs a name or the foresight of having walked the ridge years before, then a command check.
  - **`ir_hosting`.** Leinster and the southern Uí Néill come against the fort. He holds the ditch, or sallies across the ford at night. If he is not the fort's lord, he can sail away, at a cost.
    - Won: a Leinster king's son as a hostage, or the king's camp.
    - Lost: the fort burns.
  - **`ir_winter`.** Winter in the fort: the slave market at the gate, the Irish brothers-in-law, the young men for hire.
  - **`ir_845`.** Turgeis drowned. Forannán of Armagh can be bought from the Luimnech men as a named hostage, ransom 25 pounds.
- **The Seine:**
  - **`sn_rouen`, May 841.** A host battle at the river gate. If he scouted Rouen before, he can take the quay gate instead.
    - Won: plunder, then the abbeys (`sn_abbeys`: burn Jumièges, or take Fontenelle's six pounds), then the monks of Saint-Denis buying back captives (`sn_captives`).
  - **`sn_845`.** Ragnar's war-arrow at the muster.
  - **`sn_paris`.** The battle on the bank. His role is one man in the line, or a wing's leader once his fame passes 120.
  - **`sn_paris_hanging`.** The island and the hundred and eleven. Haul on the ropes, watch, or argue for ransom.
  - **`sn_paris_sack`.** Easter in Paris: the city, or Saint-Germain.
  - **`sn_danegeld`.** Seven thousand pounds, shared by the ship: about 33 pounds a ship, at most three of his.
  - **`sn_flux`.** The flux on the way home.

## Engine
- **Norse-held places.** A place a Norse ship-fort holds (`PlaceState.norse`) has a market and men to hire, and is not a place to raid.
  - Set by `{ longphort: place }`, lost by `{ longphort_lost: place }`.
  - In 841 the forts at Duibhlinn and Linn Duachaill appear whether or not he goes: history goes on without him.
  - The condition path is `norse.<place>`.
- **Named hostages.** `take_hostage` can name the hostage (`name`, `who` with a `{name}` slot, `kin`, `price`, `place`), for Forannán and the Leinster king's son.
- **`geld`.** Tribute in weighed silver goes on the heap without filling the holds.
- **New peoples.** Picts and Britons, with landing foes and hostage names.

## The third batch of places
| Place | People | Kind | Raid (wealth / defenders) | One crew of 36 wins |
|---|---|---|---|---|
| Jarrow | English | monastery | 900 / 18 | 100% |
| Whitby | English | monastery | 700 / 16 | 100% |
| Gipeswic (Ipswich) | English | market | 1100 / 32 | 100% |
| Hamwic (Southampton) | English | market | 1600 / 60 | (raised from 45, at which it was 96%) |
| Applecross | Irish (Dál Riata) | monastery | 450 / 10 | 100% |
| Tarbat (Portmahomack) | Picts | monastery | 1000 / 26 | 94% |
| Whithorn | English (Northumbrian see) | monastery | 800 / 18 | 100% |
| Alt Clut (Dumbarton) | Britons | hall | 1800 / 70 | 12% |
| Linn Duachaill | Irish | town (Norse fort from 841) | 500 / 20 | 100% |
| Rechru (Rathlin) | Irish | island | 350 / 8 | 100% |
| Glendalough | Irish | monastery | 1400 / 30 | 99% |
| Cork | Irish | monastery | 1100 / 26 | 100% |
| Skellig Michael | Irish | monastery | 150 / 4 | 100% |
| Jumièges | Franks | monastery | 1500 / 22 | 100% |
| Fontenelle | Franks | monastery | 1300 / 20 | 100% |
| Saint-Denis | Franks | monastery | 3200 / 60 | 27% |
| Rouen | Franks | town | 2600 / 70 | 24% |
| Paris | Franks | town | 5000 / 200 | 0% (a host only) |

Each has an arrival scene (`content/scenes/world/places3.yaml`) with a piece of its history:
- the drowned raiders at Jarrow;
- Cædmon's hymn at Whitby;
- Wulfheard's victory at Hamwic in 840;
- the sanctuary crosses at Applecross;
- the Pictish king killed by the Danes in 839;
- the well on the rock at Alt Clut;
- the freedman's grandmother at Rechru;
- Saint Kevin's blackbird;
- Étgal taken off the Skellig;
- Philibert's two abbeys;
- the headless saint at Saint-Denis.

Six places can be scouted for the raiding surprise. Applecross, Whithorn, Rechru and the Skellig use the new monastery art.

## Measured
- **Chapter reach.** 75 bot lives (all three beginnings, raider policy, to 848):
  - every life alive in 841 (49) met the two-fleets choice;
  - 21 joined the Dublin fort; 7 went to Rouen;
  - 16 of 45 alive in 845 were at Paris;
  - no engine errors.
- **Battles** (150 runs each, a crew of 32):
  - Rouen falls every time, which is history: it was sacked with little resistance.
  - The fort at Duibhlinn holds 75% of the time (10% before rebalancing).
  - The bank below Paris is won 56% of the time.

## Not yet
- No story between 836 and 840; these chapters fire by year.
- Return visits use the general events.
- The forts at Linn Duachaill and Duibhlinn have no later history (the 902 expulsion is far off).
