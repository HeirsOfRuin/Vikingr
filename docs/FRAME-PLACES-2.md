# Frame: twelve new places

Josh, 2026-10-14: "Let's start adding another dozen locations." Fifteen places were already on the map, drawn faint, "for later phases". Twelve of them are now reachable; Rouen, Paris and Aldeigjuborg stay faint (the Seine wants its own chapter, with a host; Ladoga is a river expedition).

## The twelve

| Place | People | Kind | What it's for | Raid (wealth / defenders / foe) | Market |
|---|---|---|---|---|---|
| Hlaðir | Norse | hall | The rival jarl in the north; the Hálogaland man and the walrus coast; rounding Stad | none | furs, ivory, stockfish, down |
| Uppsala | Swedes | hall | The mounds, the temple and the grove; a horse for the grove; the river road east | none | none |
| Gotland | Swedes | island | Rich farmers who fight; scout it or trade with it (raiding it angers every Swede) | 1300 / 55 / Gotland farmers | wool, furs |
| Truso | Balts | market | The amber coast; the horse-race for a dead man's goods (Wulfstan's account) | none | amber, furs |
| Man | Irish | island | A harbour in the middle of the Irish Sea; the king's word, or his sheep | 550 / 18 / islanders | none |
| Dublin | Irish | town | The black pool before the Norse ship-fort (841); where it would stand | 900 / 30 / men of Leinster | none |
| Clonmacnoise | Irish | monastery | Five days inland; a city of churches with tenants who fight; tribute or count them | 2000 / 48 / the monastery's tenants | none |
| York | English | town | King Eanred's (then Æthelred's) city; the Frisian quarter; the walls; the minster's books | 3000 / 120 / Northumbrian levy | wool, grain |
| Sheppey | English | island | The minster of nuns; the abbess's bread (raided historically in 835) | 850 / 20 / men of Kent | none |
| London | English | market | The Mercian king's wic; the reeve's toll; a Frisian pilot to the Loire | 2400 / 70 / the king's reeve | wool, grain, glass |
| Noirmoutier | Franks | monastery | Saint Philibert's island and its salt; empty from 836, when the monks left with the saint | 800 / 22 / monks and tenants | none |
| Nantes | Franks | town | Walls, a count's mailed men, wine; the feast of Saint John (sacked on it in 843) | 2400 / 64 / the count's men | wine, salt, glass |

## Built
- Place data, 17 sea legs, who tells of whom and where the rumours are heard (`content/places/places.yaml`).
- Six new foes: Gotland farmers, men of Leinster, Clonmacnoise's tenants, men of Kent, the king's reeve at London, a Frankish count's men (quality 2).
- An arrival scene for each place (`content/scenes/world/places2.yaml`), and four sea events: rounding Stad, Kurish small boats in the Baltic, a Frankish guard-ship in the Narrow Sea, the Loire salt-boats.
- **Scouting pays.** A place scouted in its arrival scene (York's walls, Nantes's feast-day, Gotland's roads, Clonmacnoise's gates, London's reeve, Dublin's ground) is a quarter likelier to be caught asleep when he comes back to raid it.
- The bot now listens for rumours in port, so discovery is measured.

## Measured
- **A single crew of 36** against each target (300 raids each): York 22% won (17 men lost on average), London 35%, Nantes 29%, Clonmacnoise 71%, Gotland 74%, Sheppey and Dublin about 99%. For comparison: Armagh 32%, Dorestad 14%.
- **Power curve** (40 raider lives, 16 years): wealth and ships unchanged; fame median about 67 by 840 (59 before); deaths before the end 15 of 40 (12 before), within noise but worth watching.
- **Discovery** (60 bot lives): Hlaðir in 58 (Kaupang tells of it); York in 51, Sheppey and London in about 35; Man and Dublin heard of in about half, though the bot never sails to a place it has only heard of; Uppsala, Truso and Gotland in 8 to 19; the Loire in 8 to 12; Clonmacnoise in none. These are the long roads, and a player who listens in port will find them sooner. Over 16 years the bot took York at least once in 46 of its 47 visiting lives: one crew wins about one raid in five, but it keeps trying.

## Not yet
- No art: the shot list is in `docs/ART.md`.
- Places have one arrival scene each. Return visits use the general port and raid events.
- Dublin's ship-fort (841) and the Seine (841, 845) want story chapters.
