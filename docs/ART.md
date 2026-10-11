# Art: Shot List for Phase 2

How the art works (DESIGN §19b):
1. You supply a source image.
2. `tools/art.ts` crops it to 2:1, reduces it to about 384 × 192 pixels, and redraws it in the game's fixed Runestone palette.
3. Animation (fire, water, figures, weather) is drawn in code on top.

Every scene works without its image, because a code-drawn fallback shows until the source arrives. Anything you send can therefore be replaced later.

## What makes a good source
- **Wide:** 2:1 or wider, at least 1536 × 768. The game shows a 2:1 band, slightly cropped top and bottom, so keep the subject in the middle 80%.
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

## Delivery
- Put files in `art/src/` named by key (for example `art/src/hearth_ormr.png`), or send them in the chat. I will run the converter and show a contact sheet before anything goes into the game.
- If an image does not survive conversion (too busy, too dark), I will say so with the contact sheet, and you can regenerate it.
