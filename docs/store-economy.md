# Store economy

Regenerate the numbers with `bun scripts/store-economy-report.ts`. Reward amounts come from the game code. The player behaviour (win odds, quiz depth) is assumed and set out in `PROFILES` in the script.

## What players earn per day (rewards unchanged)

| Player | Quiz | Wordle | Grid | Missions | Daily Challenge + runs | Welcome bonus (day 7+) | Per day |
|---|---|---|---|---|---|---|---|
| Casual: dailies only | £20k | £16k | £16k | £11k | — | £50k | **~£115k** |
| Regular: dailies, Daily Challenge, 2 Classic/Era runs | £30k | £17k | £19k | £68k | £916k | £50k | **~£1.1m** |
| Heavy: dailies, Daily Challenge, 6 runs, Weekly top 10 half the time | £45k | £19k | £21k | £91k | £2.76m | £50k | **~£3m** |

- A Classic run is worth about £300k on average: £50k for finishing, £1k a win, £40k for a top-six finish, £30k for League Leaders, £50k for 20+ wins, plus play-offs (£60k semi-final, £200k title, £80k runner-up). A strong run is worth about £390k. The Daily Challenge adds a rule bonus on top: £72k for League Leaders and £143k for the Grand Final, on average across the rules.
- The mini-games are small next to that. The quiz pays up to £100k, but a typical first run pays £20k–£45k (later runs pay 10%). Wordle pays £20k and Grid up to £22.5k.
- Every new player starts with £350k: the £250k starter grant plus the £100k login welcome.
- One-off sources are left out of the per-day figures: achievements (£10k–£500k), Squad Book milestones and the Weekly Challenge top-10 prize (£150k).

## Days to afford one item, by price tier

Each cell counts days from a new account (starting balance included). A range runs from the tier's cheapest item to its dearest.

| Tier | Before (v1.65) | Casual | Regular | Heavy | After (v1.66) | Casual | Regular | Heavy |
|---|---|---|---|---|---|---|---|---|
| Starter | 3 items, £150k | 0d | 0d | 0d | 14 items, £50k–£150k | 0d | 0d | 0d |
| Cheap | 8 items, £225k–£750k | 0–5d | 0–1d | 0–1d | 15 items, £200k–£800k | 0–6d | 0–1d | 0–1d |
| Mid | 20 items, £1.2m–£2.7m | 9–23d | 1–3d | 1d | 34 items, £1m–£2.5m | 8–21d | 1–3d | 1d |
| Premium | 30 items, £3m–£9m | 25–78d | 3–9d | 1–3d | 14 items, £3m–£6m | 25–52d | 3–6d | 1–2d |
| Top | 5 items, £12m–£30m | 104–263d | 11–28d | 4–10d | 5 items, £12m–£30m (unchanged) | 104–263d | 11–28d | 4–10d |
| Everything | £289m | 2543d | 263d | 97d | £217m | 1909d | 198d | 73d |

**Themes:** before, every theme cost £6m, which is 6 days for a regular player and about 50 days for a casual one. They now run from £750k to £4m: 1–4 days for a regular player and 1–5 weeks for a casual one.

## The ladder after v1.66

- **Day one (£50k–£300k):** 14 starter items across kits, pitches, titles and frames. A new player can buy two or three from the starting balance.
- **Every day or two for a regular player (£500k–£2.5m):** most pitches, titles, frames and themes.
- **Every few days for a regular player (£3m–£6m):** the kit designer, Neon, Grand Final, Cup King, League Leader, Floodlight, Bar scarf.
- **Two to four weeks for a regular player (£12m–£30m):** Man of Steel, The Invincible, Diamond frame, Dynasty Builder and 27-0 Legend. These prices did not change.

Prices under £10m came down by about a third, which undoes most of the v1.46 ×3 for the middle of the ladder. No reward amount changed. Ownership is stored by item id, so anything already bought stays owned and nobody is charged or refunded. The refund for the retired club themes stays at the old £6m (`UI_THEME_PURCHASE_PRICE`).

## Earned kits (never sold)

Earned kits are granted from the achievement and Daily streak data the game already stores. They are back-filled on the home screen and in the Store (`lib/achievement-kits.ts`).

| Kit | Earn |
|---|---|
| Invincibles kit | Go 27-0 in Classic (the Perfect Season achievement, or Ball Knower already unlocked) |
| 29-0 kit | Go 27-0, then win both play-off games (the 29-0 achievement) |
| Month of Dailies | Reach a 30-day Daily streak |
| Centurion kit | Reach a 100-day Daily streak |
| Old Trafford kit | Win the Super League Grand Final in Manager Mode (the Old Trafford achievement) |
