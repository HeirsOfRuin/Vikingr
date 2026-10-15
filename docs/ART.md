# Art: Shot List for Phase 2

How the art works (DESIGN §19b):
1. You supply a source image.
2. `tools/art.ts` crops it to 2.5:1, reduces it to 400 × 160 pixels, and redraws it in the game's fixed Runestone palette.
3. Animation (fire, water, figures, weather) is drawn in code on top.

Every scene works without its image, because a code-drawn fallback shows until the source arrives. Anything you send can therefore be replaced later.

## What makes a good source
- **Wide:** 2.5:1 or wider, with at least 400 × 160 pixels per image. Bigger is better: shrinking a large image gives cleaner pixels. Keep the subject in the middle; `art/art.json` can shift the crop.
- **Strong, simple shapes and clear light.** Pixel art at this size keeps silhouettes and big areas of light and dark. Fine texture disappears.
- **Cold northern light** for outdoor scenes (grey, blue, a low sun). Firelight for indoor scenes. Avoid saturated sunsets and teal-and-orange film grading; the palette will flatten them anyway.
- **Historically right:**
  - **Helmets:** no horns, no wings. Simple iron caps; most men wear none.
  - **Shields:** round, wooden, painted plain or in halves or quarters.
  - **Ships:** clinker-built longships with one square sail (plain, striped or checked), dragon heads only on great ships, and the shields along the side only in harbour.
  - **Clothes:** wool and linen in earthy, dyed colours (madder red, woad blue, undyed). No leather armour costumes and no fur bikinis.
  - **Buildings:** turf and timber longhouses. Irish monasteries have round stone churches, a round tower only later (Bangor in 830: timber and earthwork), high crosses, and beehive huts on the islands.
- **Nothing modern:** no text, watermarks, logos, signatures, or extra fingers in prominent places.
- **Rights:** use images you have the right to use (your own generations, your own photos, or licensed images).

## Prompt template
> *[Subject], Viking Age Scandinavia / Hebrides, 9th century, historically accurate, [time of day and light], cinematic wide shot, 2:1 aspect, painterly realism, muted northern palette, strong silhouettes, no text*

Add "**no horned helmets**" to every prompt with people in it.

---

## Priority 1: for the calibration round
| Key | Scene | Composition | Light | Animated in code |
|---|---|---|---|---|
| `hearth_ormr` | Ormr One-Hand's night (boyhood) | Inside a longhouse. A long central hearth runs into the distance. An old man in the foreground right with one hand, the stump wrapped, an arm-ring on the other arm. A boy's shape on the left, listening. Smoke going up to the roof-hole. | Firelight only; deep shadow behind | Fire (palette cycle), smoke drift, ember sparks |
| `iona_dawn` | The approach to Iona | From the sea, low over the water: the island's low green hills, a small timber church and buildings, a high cross. A longship's prow and oars in the near foreground. | Dawn, grey-gold, mist on the water | Waves (palette cycle), oars dipping, gulls |
| `yule_hall` | The Yule feast and the flyting | A great hall: two long benches, the high seat at the far end, the hearth between, drinking horns raised, shields on the walls. Wide, busy and warm. | Firelight and torches | Fire, torch flicker, figures raising horns, a man standing to speak |

## Priority 2: the rest of the year
| Key | Scene | Composition | Light | Animated |
|---|---|---|---|---|
| `title` | Title screen | A longship under sail leaving a fjord mouth for the open sea, small in a big landscape | Pre-dawn, cold | Sail breathing, waves |
| `home_fjord` | The home farm | A steep fjord with a turf farm on a thin shelf of green, boats hauled up | Spring, overcast | Water, smoke from the roof |
| `ship_home` | The ship that came home (boyhood) | A longship rowing up the fjord low in the water. People running down to the shore. | Late summer evening | Oars, people |
| `muster` | The jarl's landing | Two or three ships at a timber landing, men carrying sea-chests, a big man directing | Morning | Figures |
| `open_sea` | Crossings | A longship from the side in grey swell, sail full, spray | Overcast, wind | Waves, spray, sail |
| `birsay` | Birsay, Orkney | A tidal island with a hall, the causeway half-covered by the sea | Evening | Water, smoke |
| `iona_burning` | The aftermath at Iona | The monastery buildings burning, figures on the shore, ships drawn up | Fire against a grey sky | Fire, smoke, ash |
| `bangor_field` | The shield-wall at Bangor | A field above a lough. An open stretch of ground in the middle, where the animated shield-walls go. Earthworks and timber buildings behind. | Overcast | The battle (see below) |
| `volva` | Heiðr the seeress | A woman on a raised seat, staff across her knees, hood, the hall dark around her | Low firelight | Fire flicker, her breath in the cold |
| `holmgang` | The holmgang | A cloak pegged out on trampled snow, a ring of people, two men with shields | Winter afternoon | Breath, figures shifting |
| `storm` | Storm at sea | A longship climbing a huge grey wave, sail torn | Dark, lightning optional | Waves, rain, lightning flash |

## Animated events (drawn in code)
| Event | Base still | What moves |
|---|---|---|
| **The feast** | `yule_hall` | The fire and torches cycle. Horns rise and fall along the benches. The speaker stands during a flyting, and the hall's laughter shows as a ripple of moving heads that follows the flyting score. |
| **The shield-wall** | `bangor_field`, or a plain ground for other fights | Two walls of shield sprites whose length follows the men standing. Each round's order plays out: brace (hold), lean in (push), spears in an arc (missiles), a wedge pushing forward, a step back (give ground), a flank sweeping wide. Men fall from the line as they die. The hero's marker shows where he stands. |
| **The raid** | `iona_dawn`, then `iona_burning` | The landing, the assault (a small shield-wall), and fire spreading through the buildings as the alarm clock runs. |
| **Storm at sea** | `storm` | Waves, rain and spray, the ship pitching, a lightning flash. |

## Received (2026-10-11)
All 14 arrived as one contact sheet (`art/src/_sheet-v1.png`), cut into `art/src/<key>.png` and converted. Every one survives conversion.

## Received (2026-10-12): round 2
A second contact sheet (`art/src/_sheet-v2.png`), three bands of about 6:1, and two standalone versions of Ormr's hearth.
- **`iona_dawn`: replaced.** It now shows a timber church, beehive cells and a high cross, which is right for 830. The band is cropped to the island (`cx` 0.79 in `art/art.json`), so the ship in the foreground is left out.
- **`yule_hall`: replaced.** The standing man with his arm out reads as Thorgils in the flyting. Crop `cx` 0.42.
- **`hearth_ormr`: replaced** with the wider standalone version (2172 × 724, crop `cx` 0.55). The 2:1 version is kept as `art/src/_hearth_ormr-alt.png`. It is the darkest scene in the game; the boy is mostly silhouette at phone size.
- The animation regions for all three were re-mapped in `content/registry/art.yaml` and checked in the built app.
- **For future sheets:** bands of about 6:1 lose more than half their width when cropped to the game's 2.5:1. Standalone images at about 2.5:1 or 3:1, like the Ormr ones, keep the whole composition.

**Worth regenerating when credits allow** (historical accuracy, not quality):
- ~~`iona_dawn`~~ (done) and `iona_burning`: a stone abbey with a tower and spire. That is the later medieval abbey. In 830 Iona was timber churches, a small stone chapel at most, beehive huts and high crosses.
- `birsay`: a stone manor house. In 830 it would be turf and timber halls, with a Pictish settlement and later a Norse one.
- `bangor_field`: a stone town behind the field. In 830 Bangor was a timber monastery inside an earthwork enclosure.
- `muster`: several ships appear to have two masts. Viking ships had one.

Prompt add-on for these: *"9th century, timber and turf buildings only, no stone castles, no Gothic towers, single-masted ships."*

## Delivery
- Put files in `art/src/` named by key (for example `art/src/hearth_ormr.png`), or send them in the chat. I will run the converter and show a contact sheet before anything goes into the game.
- If an image does not survive conversion (too busy, too dark), I will say so with the contact sheet, and you can regenerate it.

## Shot list: the 831 places (wanted)
Standalone images at about 2.5:1 work best (see the round 2 notes). Prompt add-on as before: *"9th century, timber and turf buildings only, no stone castles, single-masted ships."*

| Key | Scene | Composition | Light |
|---|---|---|---|
| `kaupang` | The market at Kaupang | A curved shingle beach crowded with booths and smoke, ships drawn up, a wooded ridge with a timber hall above | Busy grey morning, smoke drifting |
| `lindisfarne` | Lindisfarne from the sea | A low tidal island with a small timber church and huts, wet sands shining between it and the mainland, a beacon on a hill | Dawn, silver light on the sands |
| `skye` | Kolbeinn's steading | A turf longhouse at the head of a black sea loch under dark mountains, sheep, a boat-shed, a round stone ruin | Overcast, low cloud on the peaks |
| `conaille` | Dún Delgan | A flat green plain behind a brown bay, a round earth ringfort with a palisade and a thatched hall on a rise | Still morning, smoke rising straight |

Once these arrive, each place gets `art:` in `content/places/places.yaml` and its scenes get the key.

## Shot list: the twelve new places (wanted, 2026-10-14)
Same format and prompt add-on as the 831 places. Nantes and York had Roman walls patched in timber: stone is right there, and only there.

| Key | Scene | Composition | Light |
|---|---|---|---|
| `hladir` | The jarl of Hlaðir's hall | A long timber hall on a rise above a river mouth, a wide green fjord with farms along it, ships drawn up below | Long northern summer evening, low gold sun |
| `uppsala` | The mounds | Three huge grass burial mounds in a row, a long timber hall beyond with a shining roof-ridge, a dark grove behind with shapes hanging in the trees | Flat grey noon, very still |
| `gotland` | The silver island | Flat green farmland, tall carved picture-stones by a farm gate, a low coast with ships | Bright, wind in the grass |
| `truso` | The amber coast | Wooden jetties at a river mouth behind a long sand spit, low marsh, horsemen in the distance on a road lined with heaps of goods | Hazy, pale sky |
| `man` | Mön | A green hilly island rising to a mountain, a small stone chapel on a headland, a sheltered harbour | Clear day, long view to other coasts |
| `dublin` | The black pool | A dark pool where a small river meets a wide one, a timber church on a ridge, a ford of woven hurdles, farms | Dull afternoon, rain coming |
| `clonmacnoise` | Ciarán's city | A crowded monastic town on a ridge above a broad slow river: many small churches, timber houses, a crowd, armed men lining the ridge | Morning mist lifting off water-meadows |
| `york` | Eoforwic | A river below old Roman walls patched with timber, a wooden minster inside, a wic of jetties and Frisian ships outside | Overcast, smoke from many fires |
| `sheppey` | The minster on the hill | Flat marsh and sheep, the wide Thames mouth, a small stone church inside a wall on the only hill, a beached longship | Bright, big sky |
| `london` | Lundenwic | A long strand of jetties, warehouses and smoke along a broad river bend, the empty ruined Roman walls on a hill to one side | Busy morning, river traffic |
| `noirmoutier` | Saint Philibert's island | A low island of shining salt-pans, a monastery behind a new earth-and-timber wall, salt heaps on the shore | Hard white sunlight |
| `nantes` | Nantes | A walled city on a hill above a wide shallow river full of islands, a stone cathedral, river boats at a quay below, mounted men in mail | Warm, late afternoon |

## Received (2026-10-15)
- `celtic_monastery`: a Gaelic monastery from the sea at sunrise, under mountains, with a ringed high cross and a timber church. Used for Applecross, Whithorn, Rechru and the Skellig until they have their own. Ringed crosses like this stood at Iona by the 8th century, so it is right for the period.

## Shot list: the third batch (wanted)
Same format and prompt add-on. Picts and Britons built in timber and drystone; the Franks had stone churches and Roman walls.

| Key | Scene | Composition | Light |
|---|---|---|---|
| `dublin_fort` | The ship-fort at Duibhlinn | A dark pool beside a river, a fresh ditch and earth bank with an oak stockade, longships drawn up inside, turf halls, smoke | Wet grey morning |
| `rouen` | Rouen in May | A river bend, old Roman stone walls with a timber gate, a stone church tower, many longships in the river | Spring morning, smoke beginning |
| `paris` | Paris, 845 | An island city in a wide river, stone walls and churches, bridges either side, a river full of longships, an army on the far bank | Cold spring light |
| `seine_island` | The island | A small wooded island in a wide river, gallows and ships' masts, an army watching from the far bank | Overcast, very still |
| `alt_clut` | Alt Clut | A twin-peaked black rock rising from a wide river mouth, a timber hall and wall on the saddle | Stormy, shafts of light |
| `tarbat` | Tarbat | A low spit between two firths, a monastery of timber and drystone, tall carved Pictish stones | Clear northern evening |
| `glendalough` | Glendalough | A steep wooded valley with two dark lakes, a stone gatehouse and churches between them | Mist on the slopes |
| `jarrow` | Jarrow | A stone church and hall on a low rise above wide tidal mudflats, a river mouth | Grey, low tide |
