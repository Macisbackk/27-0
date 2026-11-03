# NRL player database (standalone)

A separate database of NRL players (1998–2026). **Nothing in the game uses it yet.** No file under `src/` imports `data/nrl/`, and the runtime player bundle (`scripts/build-runtime-player-data.ts`) does not read it. The existing `data/nrl-clubs.json` (the game's World Club Challenge scaffold) is read only for club colours and is never changed.

## Files

| File | Contents |
|------|----------|
| `nrl-clubs.json` | 27 clubs: the 17 clubs of 2026, the Perth Bears and PNG Chiefs (announced, not in 2026), and the clubs that left or merged after 1998 (Adelaide, Gold Coast Chargers, Balmain, Western Suburbs, North Sydney, Northern Eagles, St. George, Illawarra). Each entry has an id (the same ids as `data/nrl-clubs.json` where one exists), name, short name, status, the club it merged into, colours, the seasons it appears in this database, and its AFL Tables team codes. |
| `nrl-players.json` | One row per person (2,458 people), with one row per season they played (12,635 rows): club, appearances, tries, goals, field goals and points. Where a Wikipedia match is found, the row also has date of birth, birthplace, positions, height, weight and representative teams (State of Origin side, international teams). |
| `nrl-current-squads-2026.json` | 2026 squads for all 17 clubs. Every player who played a 2026 premiership game, with their 2026 stats. Brisbane also includes the full Wikipedia squad table: cap number, nationality code, position, club debut, previous club, and players who have not yet debuted. |
| `nrl-honours.json` | Dally M Medal winners 1998–2026 and the main 2026 season results (premiers, minor premiers, number of teams). Other honours are listed under `todo`. |

The JSON files are written with one record per line, so diffs stay readable.

## Sources

* **AFL Tables, rugby league section**: the season point-scorer pages `https://afltables.com/rl/scorers/YYYY_sc.html` for 1998–2026. Each lists every player who scored, and most who played without scoring, with team code, games, tries, goals and field goals. The URL for each season is in `nrl-players.json → seasonSources`. Each person is keyed by their AFL Tables player-page slug (for example `Sione_KatoaCS` vs `Sione_KatoaPN`), so namesakes stay separate. `sources.afltables` gives the player page.
* **Wikipedia**:
  * Player infoboxes come from the repo's existing `scripts/wikipedia-cache/*.json`. A match needs the same normalised name **and** at least one of the player's NRL clubs in the infobox's club list. If more than one page matches, no data is taken.
  * `2026 Brisbane Broncos season` (squad table).
  * `2026 NRL season` (17 teams; no Perth or PNG side; season results).
  * `Dally M Medal`.
* nrl.com and Rugby League Project could not be used. The shell has no web access, and the web fetcher only opens URLs that already appeared in search or fetch results. Rugby League Project pages also come through without links, so there was no way to reach further pages from them.

## How it is built (re-runnable)

```
node scripts/nrl/build-nrl-db.mjs        # rebuilds data/nrl/* from the committed caches
npx tsx scripts/nrl/validate-nrl.ts      # structural checks + coverage report
```

The caches are committed and small:

* `scripts/nrl/cache/afltables-seasons/YYYY.txt`: pipe-separated rows. The header records the source URL and where the page was cut off.
* `scripts/nrl/cache/wikipedia/`: the squad and honours extracts.

To refresh a season, fetch `https://afltables.com/rl/scorers/YYYY_sc.html` with WebFetch, ask for `slug|TM|P|T|G|FG` rows, save them to the cache file, then rebuild.

**Namesake handling.** AFL Tables adds a suffix to a slug to tell players with the same name apart (`Billy_SmithES`, `Junior_PauloP1`). A row without a suffix is assigned to a suffixed player when the suffix's club matches the row's club, or when the seasons are close together. Otherwise it would be kept as a separate person and listed under `ambiguousSlugsLeftSeparate`. That list is currently empty.

## Coverage and known gaps

* **Truncated season pages.** The fetcher cuts each page off after about 430–450 rows. The rows are sorted by points, so the missing ones are players with few games and no points. 2019–2023 and 2003–2018 reach down to 1–2 game players. For 1998, 2009 (about 320 rows) and 2020–2026, some zero-point squad players are missing. As a result:
  * Players who never scored and appeared in only a few games can be missing entirely.
  * Career totals in `nrl-players.json` are the sum of the listed seasons only. They do not include pre-1998 games.
* **Mid-season transfers.** When a player played for two clubs in one season, AFL Tables reports one combined row, so the season row has `clubIds: [a, b]` and `multiClubSeason: true`.
* **Points.** Seasons up to 2018 calculate points as 4×tries + 2×goals + field goals, because there were no 2-point field goals then. From 2019 the points come from AFL Tables.
* **Bio fields** (date of birth, positions, height, weight, representative teams) cover only about 23% of players. These are the players who also have a page in the repo's Wikipedia cache, which is mostly people with a Super League link. `nationality` is left null rather than guessed. `representative` lists the State of Origin and international teams from the infobox.
* **2026 squads.**
  * For 16 clubs, the squad list is the players who appeared in 2026. The Top 30 and development list players who did not play are only captured for Brisbane.
  * Wikipedia's `List of current NRL team squads` is built from templates that the fetcher could not render. Some `2026 <club> season` articles do not exist (Raiders, Sharks, Titans, Rabbitohs, Dragons, Roosters, Wests Tigers).
* **Names.** Names taken from 2018–2026 pages are the displayed names, with apostrophes (To'o, Papali'i). Names for 1998–2017 rows that never appeared in later fetches come from the slug, so apostrophes can be missing ("Julian ONeill"). `nameSource` flags this.
* **Honours not yet captured:** premiers 1998–2025, the Clive Churchill Medal, the Dally M Team of the Year, the Immortals and the NRL Hall of Fame.

## Wiring it in later

The ids are stable (`nrl-<kebab of AFL Tables slug>`), and the club ids match the existing `data/nrl-clubs.json`. A future importer could:

1. map `seasons[]` to year cards in the same way as `historic-players.json` (`teamYearId = <club>-<season>`);
2. take `positions` from the bio or from a separate positions pass;
3. run its own rating pass.

Keep that in a separate change, behind the NRL `playable` flag.
