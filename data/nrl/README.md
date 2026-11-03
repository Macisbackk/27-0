# NRL player database (standalone)

A separate database of NRL players (1998–2026). **Nothing in the game uses it yet.** No file under `src/` imports `data/nrl/`, and the runtime player bundle (`scripts/build-runtime-player-data.ts`) does not read it. The existing `data/nrl-clubs.json` (the game's World Club Challenge scaffold) is read only for club colours and is never changed.

## Files

| File | Contents |
|------|----------|
| `nrl-clubs.json` | 27 clubs: the 17 clubs of 2026, the Perth Bears and PNG Chiefs (announced, not in 2026), and the clubs that left or merged after 1998 (Adelaide, Gold Coast Chargers, Balmain, Western Suburbs, North Sydney, Northern Eagles, St. George, Illawarra). Each entry has an id (the same ids as `data/nrl-clubs.json` where one exists), name, short name, status, the club it merged into, colours, the seasons it appears in this database, and its AFL Tables team codes. |
| `nrl-players.json` | One row per person (2,458 people), with one row per season they played (12,635 rows): club, appearances, tries, goals, field goals and points. Where a Wikipedia match is found, the row also has date of birth, birthplace, positions, height, weight and representative teams (State of Origin side, international teams). |
| `nrl-current-squads-2026.json` | 2026 squads for all 17 clubs (513 players). Every player who played a 2026 premiership game, with their 2026 stats, plus Top-30 / development-list members who have not played a 2026 game (`basis: "squad-list …"`) where a list was found — 11 clubs (see `squadSources`). Brisbane also includes the full Wikipedia squad table: cap number, nationality code, position, club debut, previous club. |
| `nrl-honours.json` | Dally M Medal winners 1998–2026 (as fetched) and the main 2026 season results (premiers, minor premiers, number of teams). The fuller honours files below supersede it. |
| `nrl-card-info.json` | One record per player with what a card needs: date of birth / birth year (or a `birthYearRange` when only a dated age is known), birthplace, nationality (the nation he has played Tests for), primary + secondary positions in the game's codes (FB WG CE SO SH PR HK SR LF), NRL debut year, height, weight, State of Origin side, international teams and honours. Every non-null field names its source in `fieldSources`; nothing is guessed. `nameFixes` lists corrected spellings (e.g. "Julian ONeill" → "Julian O'Neill"). |
| `nrl-grand-finals.json` | Premiers, runners-up, score and Clive Churchill Medal 1998–2026 (Melbourne 2007/2009 marked stripped). |
| `nrl-ladders.json` | Final regular-season ladder per season 1998–2026 (club ids), for the club-finish rating step. |
| `nrl-dally-m.json` | Dally M Medal 1998–2026 (2003 not awarded: industrial action) and the Dally M positional winners / Team of the Year 1998–2025. |
| `nrl-origin.json` | State of Origin series 1998–2026 with the Wally Lewis Medal, and every Origin player who debuted 1995+. |
| `nrl-golden-boot.json` | IRL Golden Boot winners 1999–2025 (not awarded 1998, 2020, 2021). |
| `nrl-hall-of-fame.json` | NRL Hall of Fame player inductees whose careers reached 1998+, and the Immortals. |
| `nrl-test-players.json` | Australia and New Zealand Test debutants 1995+, plus NRL players in the 2017 and 2021 World Cup and 2025 Pacific Championships squads (all nations). |
| `nrl-ratings.json` | A card rating (80–99) for every player-season 1998–2025, with the reason, plus each player's peak. |
| `nrl-ratings-2026.json` | A current rating (70–99) for every 2026 squad player. |
| `RATINGS.md` | The ratings audit: formula, calibration against Super League, distributions, top 50 all-time, top 30 current, sanity checks, spot checks and known limits (generated). |

The JSON files are written with one record per line, so diffs stay readable.

## Sources

* **AFL Tables, rugby league section**: the season point-scorer pages `https://afltables.com/rl/scorers/YYYY_sc.html` for 1998–2026. Each lists every player who scored, and most who played without scoring, with team code, games, tries, goals and field goals. The URL for each season is in `nrl-players.json → seasonSources`. Each person is keyed by their AFL Tables player-page slug (for example `Sione_KatoaCS` vs `Sione_KatoaPN`), so namesakes stay separate. `sources.afltables` gives the player page.
* **Wikipedia**:
  * Player infoboxes come from the repo's existing `scripts/wikipedia-cache/*.json`. A match needs the same normalised name **and** at least one of the player's NRL clubs in the infobox's club list. If more than one page matches, no data is taken.
  * `2026 Brisbane Broncos season` (squad table).
  * `2026 NRL season` (17 teams; no Perth or PNG side; season results).
  * `Dally M Medal`.
* nrl.com and Rugby League Project could not be used. The shell has no web access, and the web fetcher only opens URLs that already appeared in search or fetch results. Rugby League Project pages also come through without links, so there was no way to reach further pages from them.

## How it is built (re-runnable, in this order)

```
node scripts/nrl/build-nrl-db.mjs          # players, clubs, squads (played-2026), Dally M Medal from the caches
bun scripts/nrl/build-nrl-honours.ts       # grand finals, ladders, Dally M teams, Origin, Golden Boot, Hall of Fame, Tests
bun scripts/nrl/build-nrl-card-info.ts     # nrl-card-info.json, name fixes, 2026 squad lists merged into the squads file
bun scripts/nrl/build-nrl-ratings.ts       # nrl-ratings.json, nrl-ratings-2026.json, RATINGS.md
bun scripts/nrl/validate-nrl.ts            # structural checks (ids, ranges, sources) + coverage report
```

`build-nrl-db.mjs` rewrites the squads and players files, so the later steps must be re-run after it.

The caches are committed and small:

* `scripts/nrl/cache/afltables-seasons/YYYY.txt`: pipe-separated rows. The header records the source URL and where the page was cut off.
* `scripts/nrl/cache/wikipedia/`: the squad and honours extracts.
* `scripts/nrl/cache/honours/`: grand finals, ladders, Dally M teams, Origin series and players, Golden Boot, Hall of Fame, Test player lists and tournament squads. Each file names its source page.
* `scripts/nrl/cache/squads-2026/`: 2026 Top-30 / development lists (rugbyleaguezone club pages, Zero Tackle, penrithpanthers.com.au).
* `scripts/nrl/cache/rlp/`: Rugby League Project 2026 club pages (Cronulla, Warriors, Canterbury): squad, age, birthplace, representative teams.
* `scripts/nrl/cache/bios/`: player-article infoboxes from Wikipedia, and the 2023 Pacific Championships squad table (age and positions).

To refresh a season, fetch `https://afltables.com/rl/scorers/YYYY_sc.html` with WebFetch, ask for `slug|TM|P|T|G|FG` rows, save them to the cache file, then rebuild.

**Namesake handling.** AFL Tables adds a suffix to a slug to tell players with the same name apart (`Billy_SmithES`, `Junior_PauloP1`). A row without a suffix is assigned to a suffixed player when the suffix's club matches the row's club, or when the seasons are close together. Otherwise it would be kept as a separate person and listed under `ambiguousSlugsLeftSeparate`. That list is currently empty.

## Coverage and known gaps

* **Truncated season pages.** The fetcher cuts each page off after about 430–450 rows. The rows are sorted by points, so the missing ones are players with few games and no points. 2019–2023 and 2003–2018 reach down to 1–2 game players. For 1998, 2009 (about 320 rows) and 2020–2026, some zero-point squad players are missing. As a result:
  * Players who never scored and appeared in only a few games can be missing entirely.
  * Career totals in `nrl-players.json` are the sum of the listed seasons only. They do not include pre-1998 games.
* **Mid-season transfers.** When a player played for two clubs in one season, AFL Tables reports one combined row, so the season row has `clubIds: [a, b]` and `multiClubSeason: true`.
* **Points.** Seasons up to 2018 calculate points as 4×tries + 2×goals + field goals, because there were no 2-point field goals then. From 2019 the points come from AFL Tables.
* **Bio fields** in `nrl-players.json` are only the repo's Wikipedia cache matches (about 23%). `nrl-card-info.json` adds the honours lists, Origin and Test lists, tournament squads, Rugby League Project pages and 24 fetched player articles. Coverage of the 1,402 priority players (2026 squads, 50+ games, honours winners) after this pass: date of birth 27%, birth year or range 36%, birthplace 32%, nationality 42%, position 37%, height 26%, State of Origin side 25%, NRL debut year 83%. Most journeymen still have no date of birth or position: the web fetcher can only open a page whose link appeared in a search result, so each player costs one search and one fetch.
* **2026 squads.**
  * Top-30 / development lists were found for 11 clubs (Brisbane, Canberra, Canterbury, Cronulla, Gold Coast, Manly, Penrith, St George Illawarra, Roosters, Warriors, Wests Tigers). The lists date from November–December 2025, so a few players listed then may have left before the season. For the Dolphins, Melbourne, Newcastle, North Queensland, Parramatta and South Sydney the squad is the players who played a 2026 game.
  * Wikipedia's `List of current NRL team squads` and the `2026 <club> season` squad tables are built from templates that the fetcher could not render.
* **Names.** Names taken from 2018–2026 pages are the displayed names, with apostrophes (To'o, Papali'i). Names for 1998–2017 rows that never appeared in later fetches come from the slug, so apostrophes can be missing ("Julian ONeill"). `nameSource` flags this.
* **Honours:** captured in the files above. The Dally M positional winners for 1998–2002, 2005, 2008, 2010 and 2012–2014 come from the `List of Dally M Awards winners` page, which prints no year labels; the order was checked against the per-year award pages (2004, 2006, 2007, 2009, 2011, 2015), which all matched with 2003 skipped. The Australia Test list gives surnames only, so 20 debutants whose surname matched two players that season are left without a player id. Origin and Test selections are known by debut year, not season by season.

## Wiring it in later

The ids are stable (`nrl-<kebab of AFL Tables slug>`), and the club ids match the existing `data/nrl-clubs.json`. A future importer could:

1. map `seasons[]` to year cards in the same way as `historic-players.json` (`teamYearId = <club>-<season>`);
2. take `positions` from the bio or from a separate positions pass;
3. use the ratings in `nrl-ratings.json` (era cards, 80–99) and `nrl-ratings-2026.json` (current cards, 70–99) — see `RATINGS.md`.

Keep that in a separate change, behind the NRL `playable` flag.
