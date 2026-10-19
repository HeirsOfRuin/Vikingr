# Frame: playtest 5 (the outlaw life, and what is missing from it)

Josh played an outlaw into 835 and a younger son into 833, and sent both saves.

## Part 1: what was broken, and is fixed
Each fix was reproduced on his saves or with bot lives, and each has a regression test in `tests/engine/playtest5.test.ts`.

| Report | Cause | Fix |
|---|---|---|
| The 830 Yule feast and "You are seventeen" for an outlaw in 833–835 | The outlaw's return fired at any phase start abroad, including the first day of winter. Exile then put him home in the spring muster phase on 1 November. The younger son's spring scenes checked only "home, in muster". | The return comes only in spring. Exile ends in the phase that fits the date. The other beginnings' home scenes are closed to an outlaw. Measured over 60 outlaw lives: 370 wrong-story scenes and 64 lost springs before, none after; every return now falls in March. |
| A year missing (no spring of 834 in his journal) | The same muster-in-November state: the turn of the year never ran. | As above. A test now checks that every year has its spring, for every beginning. |
| Ubbi's follow-up didn't work with his own ship | Ubbi's fleet scene ran from April to August. He came to Hedeby on 11 March, so the stranger's welcome fired instead, with the partnership locked behind a trust he couldn't have. That welcome is once only. | The fleet scene runs from March. The stranger's welcome stands aside while he is sworn to Ubbi, and the oath counts. |
| "Requires Captain ubbi rel 3" | A raw path as a label | "Ubbi must think well of you (3)". The two other raw labels in the game (arm-rings, room in the hall) are fixed too. |
| Courting several women; the others' scenes after marrying | A wedding only set the wife's name. A promise to Ingibjörg didn't count as courting. | A wedding ends every other courtship. A promise to Ingibjörg is a courtship, and marrying another while promised costs standing in Orkney. |
| Boasts about Dorestad before it can be reached | Sworn at Yule 831 and due within a year, but Dorestad's story is in 834, and nothing else kept it. Two more boasts could never be kept: the father's silver (only one spring morning) and "first over the wall" (nothing kept it). | Dorestad: three summers, and a raid there keeps it. The father's silver can be paid at any homecoming. "First over" is kept by a fight won in the front rank. |
| Wintering abroad only from November | | From 1 October. |
| Food inconsistent | Days at sea ate the stores. Days ashore abroad (listening, trading, plunder, scene days) ate nothing. | One rule: every day away from home eats, at sea or ashore. At home the farm feeds the men, in winter quarters the hall does, and at another man's oar the captain does. Hunger over 8 years, 120 lives: raider 13.8 → 18.0 days, coward 23.8 → 27.8. |
| Shares hard to trust | The arithmetic was right but silent. | Both share-outs show their working: the heap, the captain's quarter or his own part, the number of oars, and each share. |
| The jarl's levy fought by your crew alone | A single battle | A host: the jarl's hird in the centre, the district's ships on the left, his company on the right. Ubbi's Frisian raid had the same problem and is fixed the same way. The levy is won 94% on instinct. |
| "A draws back for a great overhand blow"; "Þórir has Þórir's knarr" | Name tokens | "He draws back…"; "Þórir has his knarr…" |

## Part 2: the larger requests

### What he asked for
1. "There is no way of gaining land in other places."
2. "Or making an oath to a different lord."
3. "It'd be good to be able to scout a force before you raid somewhere."
4. "More main campaign story would be cool, not that it forces you to do it, but if you don't, things carry on without you."
5. "You should hear more about the other famous vikings. They are invisible right now."

### What exists to build on
- **Lords:** only the jarl. His favour feeds the levy, land grants (veizla) and the muster. Harek of Orkney and Kolbeinn of Skye are fathers-in-law and hosts in the stories, not lords you can swear to.
- **Land:** your home base only (father's farm, own farm, hall). Kolbeinn's "third valley" on Skye is offered in a story scene, but it gives standing, not land you hold.
- **Scouting:** some arrival scenes set "scouted", which makes a raid a quarter likelier to catch them asleep. You can't scout on demand, and it doesn't show you the defence.
- **History without you:** only the ship-forts at Dublin in 841, plus the written chapters (830–835, Dublin 841–845, the Seine 841–845). 836–840 is empty.
- **Famous Vikings:** 13 legends with historical fame curves. They appear only as rows in the Saga tab's fame table.

### Recommendations

**A. Scouting a force: small, build first.**
At any place you can raid, add "Send men up to look": a day, and a check on cunning and wits (a sworn man's skill counts if you send him).
- **Success:** shows their numbers, who they are (resolve and leader), roughly what the place holds, and how alert it is. The raid that follows is a quarter likelier to catch them asleep.
- **Failure:** they see you. The place is warned and its defenders gather.
- **Measure:** win rate and losses on scouted vs unscouted raids. Scouting must pay, but not always.

**B. The chronicle: the world goes on without you, and the famous Vikings in it. The biggest value.**
Requests 4 and 5 are the same machinery, so I'd build them together.
- **A dated registry of real events, 830–850.** For example:
  - Dorestad sacked (834, 835, 836, 837);
  - Turgeis at Armagh (832, 839–840) and on Lough Ree (844);
  - Nantes (843), Hamburg burned by Horik's fleet (845), Paris (845).
- **Each event changes the world, whether or not you are there:** a place's wealth and defences, who holds it, prices, a legend's fame.
- **News reaches you:** at Yule, in the ports, and when you listen to the old sailors.
- **Each event has a window you can join,** as a host chapter: sail with Ragnar to Paris, Horik's fleet to Hamburg, Turgeis in Ireland.
- **Legends appear in person in their years and places:** Horik at Hedeby, Turgeis in Ireland, Ragnar and Hastein on the Frankish rivers, Rorik at Dorestad. You can meet them, sail with them, cross them, or find they raided a place a week before you and emptied it.
- **The written chapters fold into this.** Dorestad 834 and the Seine 845 become events. The 836–840 gap fills with events, not more spine.
- **Size:** about 15 events and 10 short cameo scenes, about 6,000 words, plus a registry and engine hooks.
- **Measure:** how many events a bot life meets, joins and misses, and how much a sacked place's wealth recovers.

**C. Lords: an oath to another lord.**
- **Generalise the jarl into lords**, each with favour toward you:
  - your home jarl;
  - Harek of Orkney;
  - Kolbeinn of Skye;
  - King Horik;
  - an Irish king (with the risks that brings);
  - Rorik in Frisia, holding land from the Franks;
  - the Dublin ship-fort's chief after 841.
- **You swear to one lord at a time.** Changing costs favour with the one you leave.
- **A lord gives:** land (see D), protection in feuds, a seat at his feasts, and men at the muster.
- **A lord asks for:** his levy when he calls, a share of plunder, and no raids on his friends.
- **For an outlaw,** swearing to Harek becomes the natural choice, not only working his bench.
- **Measure:** how many lives change lords, and what it costs and pays.

**D. Land abroad: built on C.**
- **Held land:** a holding is a place where you can winter as at home, muster men, and draw a winter yield.
- **Three ways to get one:**
  - a lord grants it in return for your oath (Harek's Orkney land, Kolbeinn's third valley, Rorik's Frisian land);
  - buy it in a Norse-held place (Orkney, Shetland, the Faroes, Man), with silver and standing;
  - take it by the sword: a ship-fort on a raided coast, as at Dublin, which its people will try to retake.
- **Choosing your home** decides where you winter and muster.
- **Measure:** the yield and risk of each kind of holding over 10-year lives.

### Recommended order
1. **A (scouting):** small, and it plays into every raid.
2. **B (the chronicle with the famous Vikings):** answers two requests and fills 836–840.
3. **C (lords),** then **D (land abroad):** land is mostly granted by lords, so C first.

Each step goes through the usual loop: frame, approval, build, measure, your playtest. A and B can be built while you play the fixes in this round.

### What I need from you
- Approve the order (or change it).
- For B: is about 15 real events, 830–850, with joinable windows and legends in person, the right scale?
- For C: one lord at a time? Or may a man hold land from two lords, as some did, at the risk of being called by both in the same summer?
