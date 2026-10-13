# Frame: trade and allies (Roadmap steps 2 and 3)

**Status:** built on the author's instruction (2026-10-13): "Continue with the next 2 steps."

## Step 2: Trade

### Why
Markets sold kit and bought captives, and nothing else. A trader's life is one of the career paths promised in DESIGN §21a, and the knarr is pointless without it.

### Rules
- **Goods** (`registry/goods.yaml`). Twelve goods, each with a base price per lot and a bulk per lot. Bulk is in ørtugar of hold space, the same units as plunder, so goods and plunder share the holds:

  | Good | Base price | Bulk |
  |---|---|---|
  | Furs | 30 | 20 |
  | Walrus ivory | 40 | 10 |
  | Amber | 30 | 8 |
  | Eider down | 26 | 10 |
  | Soapstone | 10 | 40 |
  | Whetstones | 12 | 30 |
  | Wool | 12 | 30 |
  | Stockfish | 8 | 30 |
  | Salt | 10 | 40 |
  | Frankish wine | 24 | 40 |
  | Rhenish glass | 24 | 12 |
  | Grain | 8 | 50 |
- **Markets.** A port with `trade:` says what it makes (`cheap`, price × 0.75) and what it wants (`dear`, price × 1.35). Everything else trades at base price. Ten ports trade:
  - home, Avaldsnes, Kaupang, Hedeby, Ribe, Birka;
  - Orkney, Shetland, the Faroes, Skye.
- **Prices move.**
  - Every lot bought raises the price there by 2%, and every lot sold lowers it by 2%.
  - The effect halves every 120 days.
  - Each year one good is in the news, dear or cheap everywhere (×1.5 or ×0.65). The old sailors can tell you which.
- **The spread.**
  - Buying costs the price × (1.05 − 1% per point of trade skill).
  - Selling pays the price × (0.95 + 1% per point).
  - The port's toll comes off sales: wary 10%, friendly 5%, allied or home nothing.
  - Unfriendly or hostile ports won't trade with you.
- **Your own venture.** Goods are bought with your own silver and sold for your own silver. The men don't share in it.
- **Rewards.**
  - Every lot is bought and sold one at a time on the trade screen, which shows what you paid.
  - Ten marks of profit in a year earns the deed "a rich trading voyage", once a year.
- **Risk.** Ships carrying goods draw a pirate event ("cargo.lots >= 4").
- **Target, and what was measured** (`tools/measure-trade.ts`):
  - A first pass (cheap ×0.55, dear ×1.7, 3% a lot, half-life 60 days) paid about 13 marks a round trip, or about 50 a season, three times a raiding season's whole heap. That was cut.
  - **As built:** the best circuit (home furs, soapstone and ivory to Hedeby; wine, glass and salt back) pays about 4–5 marks a round trip, and other circuits pay about 3. That's 15–20 marks for a season spent at nothing else, which is about a raider's whole heap.
  - **What the trader gives up:**
    - fame (only the one deed a year);
    - the men's shares, because the men aren't paid out of his trade and their mood shows it at the share-out.
  - **What depth does:** markets are shallow, so prices move as you trade and a bigger hold or purse barely raises the profit on one circuit. The knarr's worth is carrying goods alongside plunder, and working several circuits.

## Step 3: Allies

### Why
The north had no other captains with lives of their own, and the jarl was a voice, not a power.

### Rules
- **Captains** (`registry/captains.yaml`). Six shipmasters, each with:
  - a home, ships, men, a temperament and a description;
  - a relationship with you (−10..10) that moves with what you do;
  - a met/unmet state.

  | Captain | Home | Who he is |
  |---|---|---|
  | Steinarr | Hordaland | Ásgeir's old second; sour, ambitious |
  | Ubbi | Hedeby | Horik's hersir |
  | Þorsteinn Kolbeinsson | Skye | Kolbeinn's son |
  | Grímr Hrappsson | Avaldsnes | Thorgils's kin; a feud |
  | Sigtrygg | Birka | A Swedish trader |
  | Eyvindr Skreyja | Kaupang | A Danish-Norwegian freebooter, raids anyone |

  Each has a meeting scene at his home. Earlier choices set his starting relationship: Bangor, the holmgang, Ubbi's oath.
- **Félag (sworn partnership for a summer):**
  - **Who:** a captain you have met, alive, with a relationship of 3 or more.
  - **When:** sworn in a spring scene, or at his meeting.
  - **What it does:**
    - his men fight with yours in every battle that summer;
    - plunder is split by men at the share-out;
    - his holds add to yours.
  - **Risks:**
    - he may hang back at the start of a fight if the relationship is under 4 (a 25% chance), which costs relationship;
    - a greedy partner may take more than his share at the share-out.
  - **End of the summer:** the partnership ends with the summer. The relationship rises by 1 if the summer was good, and falls if it wasn't.
- **The jarl's favour** (−10..10, starting at 0, or 2 if he trusted you after Bangor):
  - **Raised by:** answering his levy, gifts (a winter action at home: 2 marks for +2), and his reckoning scene.
  - **Lowered by:** refusing the levy, and breaking his trust.
  - **What it does:**
    - favour 5 or more: his cut for a borrowed ship falls from a quarter to a sixth, and more men come to your muster (+favour/2);
    - favour 6 or more while you still live at your father's: a grant of land (veizla), once;
    - favour −5 or less: the muster dries up (−3 men).
- **The levy** (a spring scene, 833 on, about one spring in three): the jarl calls ships against Danish raiders on the coast. It's a set-piece battle until the hosts step makes it a real host. You can answer, send silver instead, or refuse.

## Measures
- **Unit tests:**
  - prices move and recover;
  - the spread and the toll;
  - hold space shared between goods and plunder;
  - the yearly trade deed;
  - a partner's men in a battle;
  - the share-out split;
  - hanging back;
  - favour effects on the jarl's cut and the muster.
- **`measure-trade`:** profit of greedy round trips between the trading ports, per hold.
- **Bot:** trades greedily at markets when it has silver; accepts partnerships at random through scenes.
