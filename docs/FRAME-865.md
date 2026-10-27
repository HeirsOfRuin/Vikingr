# The third era: the Great Army, 865–878 (review §4, step 7)

Josh approved the build directly ("Go ahead, build them"). This note records what was built and why.

## The opening
- **Start.** Spring 865, born 849, so the hero is 16. The chronicle runs from 830 to 864 on the same engine first. The boy's report lists only years from age 5, and at most 11 lines.
- **Past chapters.** 830, 831, 833 and 843 count as past, so none of their scenes open.
- **Flags.** `era843` is set too, meaning "a late start", so the 830 exile scenes stay shut. `era865` marks this era.
- **First years.** The hero starts at Kolr's oar in the Elk, with the army (`fleet: greatarmy`). In 867 Kolr dies at York and the Elk's men offer him the steering-oar, as Ölvir's Hart did in 843.

## The army keeps a winter camp
The Great Army lived on land, not on its ships. So the `camp` effect:
- moves the army's winter quarters (`state.fleet.camp`);
- moves the captain's home for a hero still in service;
- adds the place to the known places.

A captain in the army may winter in its camp even where the English hate him: he winters inside the army's ditch. Bots follow the camp in autumn.

## The story (31 scenes, five files in `content/scenes/865/`)

| Year | Place | Beat |
|---|---|---|
| 865 | East Anglia (Gipeswic) | The horses; Ívarr at Yule |
| 866 | York | North over the Humber; All Saints' Day |
| 867 | York, Nottingham | The two kings break in (host battle); Ælla; Kolr's steering-oar; the siege that wasn't |
| 868 | York | Back to York |
| 869 | Thetford | King Edmund |
| 870–871 | Reading | Wessex; Ashdown (host battle); nine battles, Alfred buys peace. A captain may go home here |
| 871–872 | London | Harald of Vestfold is taking Norway |
| 873–874 | Repton | The sickness and the charnel house; Ívarr dead in Dublin; the army splits |

After 874 the hero chooses one of three paths:
- **North with Hálfdan:**
  - land in the Vale of York (`claim_land`);
  - a marriage hook, Eadgyth, the thegn's widow;
  - Strangford Lough, 877.
- **South with Guthrum:**
  - Swanage, 877;
  - Chippenham at Twelfth Night;
  - Edington (host battle);
  - Aller, where he is baptized or refuses.
- **Home.**

## New places and foes
- **Five inland places,** each up its river:
  - Thetford;
  - Nottingham;
  - Repton;
  - Reading;
  - Chippenham.
- **Two foes:**
  - the West Saxon host, quality 2, which fights as a king's household;
  - the Mercian host.
- **Chronicle news.** The army's chronicle entries are skipped (`unless`) once the hero was there.

## History
Every scene file opens with the sources it follows:
- the Anglo-Saxon Chronicle;
- the Annals of Ulster;
- Abbo's *Passio* for Edmund;
- the Repton excavation.

The sagas' material (Ragnarr's snake-pit, the blood-eagle) is told as the men told it, never confirmed.

## Measured (12 bot lives, 14 years)
- **No errors, no dead ends.**
- **Every life reaches York and Kolr's oar.**
- **8 in 12 reach Nottingham, and about a quarter reach the parting at Repton.** The rest die, desert the army through a fleet event, or go home.
- **Branch scenes fire on both paths.**

## Open
- No art yet for York or Repton; the scenes reuse the existing pictures.
- A player who leaves the army has no way back into it except being at the right place in the right year.
