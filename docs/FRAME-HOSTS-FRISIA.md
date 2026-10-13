# Frame: hosts, and the Frisian Road 833–835 (Roadmap steps 4 and 5)

**Status:** built on the author's instruction (2026-10-13): "Continue with both of those."

## Step 4: Hosts

### Why
Every fight was one crew against about the same number. The turning points of the 830s were fleets:
- the Danes at Dorestad, 834;
- Armagh, plundered again and again;
- the levies of jarls and kings.

### Rules (`src/engine/host.ts`)
- **The line.** A host is a line of wings.
  - **His own wing** is the ordinary battle he already knows: his men, his place in it, his orders and his wounds.
  - **The other one or two wings** fight beside it, round by round, using the same round function (`battle.ts resolveRound`). They aren't a new combat system.
- **When a wing breaks:**
  - half the men who broke it turn on the next part of the line still fighting;
  - every wing still fighting loses a little morale for each of its own wings broken, and the enemy loses some for each of his.
- **Reserves:**
  - The enemy throws in his reserve when any of his wings falls to morale 4.
  - The host's leader can throw in his own, once. It goes to whichever wing is closest to breaking.
- **His place:**
  - **In another man's ship:** he stands where he's put, and can only shout orders to the men around him.
  - **As a captain:** he holds his wing.
  - **At the head of the host:** he also commands the reserve and can signal the wings to push or hold.
- **The field.** When his wing is done, the rest of the line fights to its end. The field goes to the side that holds more wings. A wing nobody came to fight in doesn't count as broken; the enemy who turned on the gap is punishment enough.
- **Losses.** His crew dies in his wing. Allies, the jarl's men and the Danes bury their own. Reserve men and turned men who join his wing are counted the same way, so they don't come out of his crew.
- **Big raids become hosts.** A raid on a place with 50 or more defenders, with a félag partner beside him, is fought as a host: his men in the centre, the partner's on the flank.
- **A `host` effect** lets scenes stage set pieces. A wing marked `ally` is the summer's partner, who may hang back.

### Measured (`npm run measure:host`, 500 battles a cell, everyone fighting on instinct)

| Battle | Won | Lost | Drawn |
|---|---|---|---|
| Equal hosts, 30 a wing | 94% | 6% | 0% |
| Their reserve of 30 held back | 73% | 25% | 3% |
| Both reserves, his committed at round 2 | 97% | 3% | 0% |
| An ally hangs back, so one wing is empty | 2% | 39% | 60% |
| Dorestad 834: him + Ubbi 100 + Danes 60, against 150 with a reserve of 40 | 80% | 20% | 0% |
| Dorestad with only a partner beside him | 68% | 15% | 18% |

**Tuning history.** The first version used morale alone for the flanks. An empty wing then meant certain defeat (0% won), and strong flanks didn't help. Turning men who come round onto the next wing fixed both.

## Step 5: The Frisian Road, 833–835

### The history it's anchored to
- **833:** the emperor Louis is deposed by his sons at the Field of Lies, so the Frankish coasts are unwatched.
- **834:** the Annals of St-Bertin record that a Danish fleet came to Frisia, went by Utrecht to Dorestad, and destroyed everything.
- **835–836:** Dorestad again, and Antwerp.
- **Armagh:** plundered three times in one month in 832, by the Irish annals.
- **The jarl:** grows old, as jarls do.

### New places
- **Dorestad.** A market, and a raid worth 4,200 against 110 defenders. Too big for one crew; with allies it's a host. Reached by the Frisian coast from Ribe.
- **Walcheren.** A Frisian island raid, 700.
- **Armagh.** The chief church of Ireland, 2,200 against 70 of the king of Airgialla's men. Up the river road from Conaille.

### New characters
- **Eiríkr Eysteinsson:** the jarl's elder son. Hard, proud, and he never forgave a boy for bringing his father's ship home.
- **Hákon Eysteinsson:** the younger son. Quick, smiling, and ambitious.
- **Hessel the Frisian:** a trader who sells the ways into Dorestad to anyone who'll pay.
- **The comarb of Patrick at Armagh.**
- **Turgeis:** at a distance, in rumour.

### Beats
**833**
- **The council** (spring): news of the Field of Lies, and the jarl's sons. His choice for the year:
  - west to Armagh;
  - scout the Frisian coast;
  - stay close to the jarl.
- **Hessel** (Ribe, Walcheren or Hedeby): buy Dorestad's ways (fewer defenders awake, a smaller enemy reserve), threaten him, or send him off.
- **Armagh:** assault it as a host, with the summer's partner on the flank; or raid it by night; or take tribute for the comarb's peace. Afterwards, the bell-shrine.
- **The sons at Yule:** Eiríkr's insult and Hákon's ask. Back one, or neither.

**834**
- **The war-arrow from Denmark.** Ubbi (or Eyvindr, or simply the rumour of thirty Danish ships) calls for Dorestad.
- **Dorestad:**
  - the fleet in the Rhine, and his place in the line;
  - the host battle on the jetties, with Ubbi's Danes on one flank and more Danes on the other;
  - the sack against the alarm, where the holds matter;
  - the burning, and keeping the Dorestad boast.
  - Arriving later in the year, or without the fleet: the ruins.
- **Winter:** the jarl dies. A ship burial, then the thing chooses a new jarl. Whom he backed, and what he can say for him, decides who the new jarl is and where that leaves his favour.

**835**
- **The road from here** (spring): the chapter's close. Frankia's rivers, Ireland and Turgeis, or the east. It sets a direction for later chapters.

### Regional events
New sea events key off where the ship is bound (`bound.people`), so the Frisian coast, the Irish Sea and Danish waters each feel different:
- **Frisian coast:** the tide on the flats.
- **Danish waters:** a Frisian pilot who offers his services; Horik's guard ship.
- **Irish Sea:** Turgeis's sails; pilgrims in a curragh.
