# Style Guide

Applies to all scene, choice, outcome, banter and journal text. `npm run lint:style` enforces the lists at the bottom.

## The target
Brutal and funny in the same breath. The energy of *Vikings* and *The Last Kingdom*; the voice of the sagas.

The sagas are the model for the mix. Men die with a joke in their mouth:
- **Atli**, in *Grettis saga*, is run through with a broad-bladed spear at his own door. He says broad spears are in fashion these days, and falls dead.
- **Thormod**, in *Fóstbræðra saga*, pulls an arrow from his chest after the battle. It brings up fibres of his heart. He says the king has fed them well, he is still fat about the heart-roots, and dies.

That is the register: the worst thing in the world, met with understatement.

## Voice
- **Second person, present tense.** "You put your shoulder to the shield."
- **Concrete and physical.** Salt on the lips, cold that gets into the teeth, the weight of a wet wool cloak, the stink of the bilge, hands that will not open after a day at the oar.
- **Fear and pain are bodily, not named.** A wound is noticed late, by the warmth running down the leg. Knees that will not stop shaking. Being sick over the side.
- **Let people talk.** Most scenes have at least two spoken lines. Men needle each other constantly. Insults are an art form. A quiet man is noticed for it.
- **No speeches about meaning.** Nobody explains the theme. Nobody says what a moment means. The sagas never tell you what to feel, and neither do we.
- **Outcomes are rarely clean.** Something is usually lost even in victory.
- **Choice text** is an action, in the imperative, under about 15 words. It does not hint which choice is best.

## Violence and gore
- **Specific and anatomical.** Name the part of the body and what the blade did to it. A seax under the ribs, a jaw taken off by an axe, fingers lost on a shield rim.
- **Fast.** Fights are short, confused and decided by small things: a slip on the shingle, a shield-strap that breaks, a man looking the wrong way.
- **The aftermath counts.** Flies, the smell, gulls, the dead stripped of their shoes. Wounds that go bad a week later. The man who survives but cannot hold a cup.
- **Not lingering for its own sake.** One or two exact details hit harder than a paragraph.

## Humour
- **From people, never from the narrator.** Banter at the oars, a drunk boast, a sheep that will not be stolen, a man who cannot swim saying so too late.
- **Self-deprecation is allowed** for the hero and expected from his men.
- **Gallows humour after the worst moments** is in period. Use it.
- **Never anachronistic.** No modern phrasing, no winks at the audience, no references.

## Glory, brotherhood, love
- **Glory is earned by cost.** A scene earns it by first showing what could be lost.
- **Brotherhood is in acts:** the last water shared, a man carried to the ship, a share given to a dead man's widow without being asked.
- **Love is physical and unsentimental:** a wife who runs the farm better than he would and says so, a child asleep against him at the fire, a lover he should not have. The stakes are real: any of them can be lost.

## The gods (enforces DESIGN §12)
- The text never confirms divine action. "The blood ran clean, and the godi seemed satisfied" is allowed. "Odin accepted your sacrifice" is not.
- Every supernatural event leaves a plain reading in the text itself: ravens are birds, the berserkr may be mad, the thing in the barrow may be a man.
- The only exception is the judgment scene after death.

## Content lines (enforces DESIGN §1a)
- **Sexual violence:** acknowledged through implication and aftermath only. Never depicted. Never a player action.
- **Children:** never shown being killed, never a target the player can choose.
- **Thralls:** named when the story meets them. Their lives are shown honestly, not as scenery.
- **Torture:** shown with its weight, not as spectacle.

## Period texture
- **Time:** days and nights, seasons, the sailing season, Yule, the winter nights (*vetrnætr*), midsummer. Ages in winters: "you were twelve winters old". No hours or minutes.
- **Distance:** days' sail, days' rowing, a bowshot, a spear's throw.
- **Money:** silver by weight, as pounds of hacksilver and coins for the change (240 to the pound); arm-rings of silver or gold, which are things a man holds, not prices. Coins are weighed and nicked to test them like any hacksilver. Never marks or aurar in the prose (the author, 2026-10-14).
- **Address:** names and nicknames, "kinsman", "friend", by patronymic, "jarl" or "lord" (*dróttinn*) for those above. Never "sir" or "my lord".
- **What they call themselves:** Northmen, by region (Hordar, Rogalanders, Danes), or by what they do. *Víking* is something you go on ("to go a-viking", *fara í víking*), not an ethnicity. Their enemies say Northmen, Danes, heathens, foreigners (*Gaill* in Irish).
- **Old Norse terms** only where they carry meaning, glossed on first use and in the codex.

## Naming
Old Norse names with patronymics (*Hallsson*, *Ketilsdóttir*). Nicknames are earned in play and can be glorious or humiliating. Irish, English and Frankish names in their period forms. Full lists in `content/canon.md` (Phase 2).

## Narrator tics to cut (carried over from Knight of Adalia)
These read as machine prose when they repeat. The lint counts them as warnings.
- "...which is worse."
- "It is not X. It is Y."
- "He says nothing." or "Nobody says anything." used as the beat that ends a paragraph.
- "for a long time".
- Foreshadowing the player's feelings: "You will remember this."
- "That is all." and "That is its own kind of X."
- Chains of "and, and, and" clauses.

## Lint lists
Each line is one pattern. Plain lines match as case-insensitive whole words or phrases. Lines wrapped in `/.../` are regular expressions (case-insensitive). Lines starting with `#` are comments.

### Banned (lint error)
```banned
# modern idiom
okay
ok
awesome
guys
teenager
weekend
# no clock time: they told time by light, tide, meals and watches
/\bhours?\b/
/\b(a|half a|\d+) minutes?\b/
/\bo'clock\b/
# the shows, not the history
horned helmet
/\bthe vikings\b/
# confirmed divine action (allowed only in the judgment scene, which is exempted by file)
/\b(odin|thor|freyja|frey|the gods?) (heard|answered|accepted|smiled|granted|blessed you)\b/
/\byour (sacrifice|prayer|blót) (was|has been) (accepted|answered|heard)\b/
# address
/\bsir\b/
/\bmy lord\b/
```

### Warning (lint warning)
```warning
# narrator tics
which is worse
for a long time
that is all
/\bit is not \w+\. it is\b/
/\byou will (remember|never forget|think about) this\b/
# contested in the sources; allowed in rumour or a skald's mouth, flagged so it is deliberate
shieldmaiden
shield-maiden
blood eagle
```
