# The crew as people (review §3, step 4)

The review found the crew faceless after the first years.

**What exists**
- Four bench-mates are written as characters: Ketill, Ulf, Hallvard, Bersi.
- All 30 banter lines and every crew scene are about those four, by name.
- The hird that grows after them is a name, a temperament and a loyalty:
  - the temperament is one of steady, hot, greedy, pious, ambitious, dour;
  - origins: a bench-mate, a sword for hire, a beaten enemy, kin, a freed thrall.
- When the four die (most lives lose two or three by year 5), the ship goes quiet. The new men never speak.

## Proposal: every sworn man speaks, by his temperament

**1. Banter by temperament.**
- A line can name a temperament instead of a man: `who: { temperament: hot }`.
- The engine picks a living sworn man of that temperament and fills `{man}` with his name.
- About 48 lines: 6 temperaments × the four moments (at sea, after a fight, making land, the winter benches) × 2.
- The four originals keep their own lines, and those come first while they live.
- What it reads like:
  - **hot:** "{man} has been sharpening his axe since dawn. Nobody has asked him why."
  - **greedy:** "{man} weighs the silver twice, and then a third time when he thinks you aren't looking."

**2. A man the scene is about.**
- A scene can ask for a sworn man by temperament (`crewman: ambitious`).
- The engine picks one, the way hostage scenes pick a hostage. His name fills `{man}`, and his loyalty and life are what the choices touch.
- Eight scenes, one or two per temperament:
  - **ambitious:** wants a ship of his own (give him one, and lose a man to gain a shipmaster), or starts talking at the fire about who should lead.
  - **greedy:** caught skimming the share (forgive, flog, or send him off); or he has a buyer for something you shouldn't sell.
  - **hot:** picks a quarrel in a foreign port that ends in a holmgang. It is his life on the cloak, and his reckoning is shown.
  - **pious:** a priest's book and a raven's flight. He won't sail on a day of bad omen; overrule him or wait.
  - **dour:** predicts the storm, the ambush, the bad winter. When he is right, men listen to him over you.
  - **steady:** asks leave to marry and settle on your land. You lose a fighter and gain a tenant who will fight for you at home.

**3. Their deaths are remembered.**
- A generated sworn man who falls gets a short memorial report, which the four originals already have.
- It names his origin and his best deed, and his bench passes to an heir, as theirs does.

**4. Names that stick.** A sworn man with three deeds earns a byname from the crew, the way the hero does: Ulf Nosebleed, Thorbjorn the Patient. The byname shows in banter and scenes.

## Size
- About 48 banter lines and 8 scenes, roughly 6,000 words.
- Engine: a temperament speaker in banter, a scene's chosen crewman with the `{man}` token, a memorial for generated men, and men's bynames.
- Tests, `npm run continuity` (the dead stay dead), and a measure of how many distinct crew voices a life hears in years 3–8.

## Target
- In years 3–8 of a life, the crew speaks through at least 4 different men.
- A life meets at least 3 of the 8 crew scenes.
- Today, after the four originals die, both are zero.

## Out of scope
- New named characters beyond the four.
- Crew relationships (feuds between two men): a later step if this lands.
