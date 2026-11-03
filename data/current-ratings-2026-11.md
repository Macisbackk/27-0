# Current card ratings — November 2026 rescale (70–99)

Owner brief: "Every current player in the game should be rated from 70–99 (era players 80 min)."

Before this change every 2026 card shared the era cards' 80–99 scale, so academy teenagers,
development forwards and genuine rotation men were all tied at the 80 floor (p10 = p25 = 80).
Now every **current** card (category `current`, 488 cards incl. 36 hidden Championship /
duplicate cards) runs **70–99**. **Era (historic) cards keep 80–99 and legends 84–99 — not touched.**

Files: `scripts/build-current-ratings.ts` → `data/current-ratings-2026.json` (id → `to`, `from`,
`band`, one-line `why`), applied by `normalizePlayer` as the last word for current cards.
Test: `scripts/test-current-ratings.ts` (`npm run test:current-ratings`, also in CI): every current card
70–99, every era/legend card 80–99, ≥ 20% of playable current cards under 80 (actual 31.6%), ≥ 5% at 90+
(7.8%), ≥ 2% at 92+, the 70–72 end used, no single rating over 12% of cards, research order kept
(an 82+ card two old points higher never ends lower), no old-floor card above 80, plus value /
Showcase-band / out-of-position checks. The thresholds sit under what the evidence gives so a
re-run with new data still passes.

## Method

Evidence already in the repo, joined by name (+club) with first-name aliases (Olly/Oliver, Matty/Matthew…):

| source | what it gives | matched |
|---|---|---|
| card rating before this change (`from`: season-2026 re-rate, audit, overrides) | researched 2026 order: Man of Steel (O'Neill 95), finalists, Dream Team, club awards | 488 |
| `data/imports/fantasy-super-league-players-2026.md` | 2026 Fantasy points (scale with minutes, starts, tries, metres, tackles) and price (market's quality call) | 426 |
| `data/imports/super_league_2026_ratings_cursor_import.json` (from `super_league_2026_ratings.xlsx`) | unfloored two-season OVR (75+) and squad status (First Team … Academy) | 438 |
| card | career appearances, age | 488 |

1. **Researched cards (old 81+).** The research order is the backbone. An evidence model
   (least squares on the 243 uncensored 82+ cards: `from ≈ 55.0 + 0.152·√pts + 0.145·price/10 + 0.291·sheet OVR`,
   R² ≈ 0.58) nudges each card by at most ±0.6 old points, measured against other cards with the
   **same** old rating (so the model's pull to the mean never drags the top down). Then a
   piecewise stretch (old → new): 80.4→79, 81→80, 82→82, 83→83.4, 84→84.8, 85→86, 86→87.2,
   87→88.4, 88→89.6, 89→90.8, 90→92, 91→93, 92→94, 93→95, 95→97, 99→99.
2. **Old-floor cards (old ≤ 80, 141 cards).** No research order to keep, so 2026 evidence decides
   (new scale directly, capped at 80 so none passes a researched 81+):
   - 2026 Fantasy ≥ 300 pts (regular minutes) → 79 · 120–299 → 77.5 · 30–119 → 75.5 · 1–29 → 74
   - no 2026 minutes: ≥ 80 career apps → 74.5 · 20–79 → 73 · fewer → 71.5
   - +0.5 sheet first-team status, + up to 1 for sheet OVR 77+, −0.5 academy/development aged ≤ 20,
     −1 teenager (≤ 19) with ≤ 2 senior apps, ±0.5 by Fantasy price within a minutes tier.
3. **No 2026 evidence at all.** 13 `-hist-` ids are tagged current (`yearsActive "2026–Present"`)
   but the players are in no 2026 registered squad and have no 2026 Fantasy row (Tom Lineham,
   Mat Ashurst, Jordan Turner, James Donaldson, Ricky Leutele, Joe Arundel, Harvey Livett,
   Sitaleki Akauola, Masi Matongo, Éloi Pélissier (Catalans), plus three hidden London cards).
   They carried career-peak ratings (up to 93) on a 2026 card. They now sit on the "no 2026
   minutes" tier with a pedigree bump (73–76). **Owner check:** these look like career records
   mis-tagged as 2026 cards; their real era cards are untouched. Re-tag or remove them if wanted.

Bands written to the JSON: elite (92+) 17, first-team (82–91) 231, rotation (79–81 researched,
77.5–80 floor tiers) 125, fringe 64, academy 51.

### Re-running

`bun scripts/build-current-ratings.ts && npm run build:runtime-player-data`. `from` is kept from
the previous file so re-runs are stable. To fold in a new season re-rate, set the JSON to `{}`
first (so `from` is read from the re-rated cards), then rebuild.

## Distribution (playable current cards, `getShowcasePlayers`)

| | cards | min | max | p10 | p25 | median | p75 | p90 | under 80 | 90+ | 92+ |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Before | 449 | 75 | 95 | 80 | 80 | 82 | 84 | 87 | 0.2% | 4.9% | 1.6% |
| After | 449 | 70 | 97 | 73 | 78 | 82 | 85 | 88 | 31.6% | 7.8% | 3.8% |

| rating | before | after |
|---|---|---|
| 70–72 | 0 | 44 |
| 73–75 | 1 | 37 |
| 76–78 | 0 | 42 |
| 79–81 | 195 | 101 |
| 82–84 | 152 | 102 |
| 85–87 | 60 | 72 |
| 88–90 | 28 | 22 |
| 91–93 | 12 | 23 |
| 94–96 | 1 | 5 |
| 97–99 | 0 | 1 |

Bands over all 488 current cards: first-team 231, rotation 125, fringe 64, academy 51, elite 17

## Notable cards

### Top 25

| # | player | club | before | after | why |
|---|---|---|---|---|---|
| 1 | Brad O'Neill | Wigan Warriors | 95 | 97 | researched 95 · 2026 fantasy 965 pts, £120k · sheet 84 (First Team / Rotation) · 78 career apps, age 24 |
| 2 | Brodie Croft | Leeds Rhinos | 93 | 95 | researched 93 · 2026 fantasy 1386 pts, £150k · sheet 90 (First Team / Rotation) · 110 career apps, age 29 |
| 3 | Jake Connor | Leeds Rhinos | 93 | 95 | researched 93 · 2026 fantasy 1222 pts, £170k · sheet 91 (First Team / Rotation) · 249 career apps, age 32 |
| 4 | Ben Currie | Warrington Wolves | 92 | 95 | researched 92 (2026 evidence +0.6) · 2026 fantasy 1429 pts, £140k · sheet 88 (First Team / Rotation) · 278 career apps, age 32 |
| 5 | Lachie Miller | Leeds Rhinos | 92 | 94 | researched 92 · 50 career apps, age 32 |
| 6 | Tristan Sailor | St Helens | 91 | 94 | researched 91 (2026 evidence +0.5) · 2026 fantasy 1361 pts, £160k · sheet 90 (First Team / Rotation) · 43 career apps, age 28 |
| 7 | Adam Keighran | Wigan Warriors | 92 | 93 | researched 92 (2026 evidence -0.6) · 2026 fantasy 1001 pts, £120k · sheet 82 (First Team / Rotation) · 110 career apps, age 29 |
| 8 | Caleb Hamlin-Uele | Wakefield Trinity | 91 | 93 | researched 91 · sheet 88 (First Team / Rotation) · 52 career apps, age 27 |
| 9 | Maika Sivo | Leeds Rhinos | 91 | 93 | researched 91 (2026 evidence +0.1) · 2026 fantasy 922 pts, £140k · sheet 91 (First Team / Rotation) · 20 career apps, age 33 |
| 10 | Mathieu Jussaume | Toulouse Olympique | 91 | 93 | researched 91 (2026 evidence -0.2) · 2026 fantasy 1315 pts, £90k · sheet 88 (First Team) · 24 career apps, age 27 |
| 11 | Zach Eckersley | Wigan Warriors | 91 | 93 | researched 91 (2026 evidence -0.4) · 2026 fantasy 1055 pts, £90k · sheet 88 (First Team / Rotation) · 47 career apps, age 23 |
| 12 | Mikey Lewis | Hull KR | 90 | 93 | researched 90 (2026 evidence +0.6) · 2026 fantasy 1081 pts, £170k · sheet 92 (First Team / Rotation) · 120 career apps, age 25 |
| 13 | Bevan French | Wigan Warriors | 90 | 92 | researched 90 (2026 evidence +0.4) · 2026 fantasy 746 pts, £170k · sheet 93 (First Team / Rotation) · 114 career apps, age 30 |
| 14 | Jackson Hastings | St Helens | 90 | 92 | researched 90 (2026 evidence +0.2) · 2026 fantasy 1036 pts, £160k · sheet 89 (First Team / Rotation) · 88 career apps, age 30 |
| 15 | James McDonnell | Leeds Rhinos | 90 | 92 | researched 90 (2026 evidence +0.1) · 2026 fantasy 1185 pts, £130k · sheet 89 (First Team / Rotation) · 93 career apps, age 26 |
| 16 | Matty Ashton | Warrington Wolves | 90 | 92 | researched 90 · 2026 fantasy 1111 pts, £160k · sheet 87 (First Team / Rotation) · 143 career apps, age 28 |
| 17 | Mike McMeeken | Wakefield Trinity | 90 | 92 | researched 90 (2026 evidence +0.1) · 2026 fantasy 1137 pts, £150k · sheet 88 (First Team / Rotation) · 301 career apps, age 32 |
| 18 | Joe Ofahengaue | Leigh Leopards | 90 | 91 | researched 90 (2026 evidence -0.6) · 2026 fantasy 1027 pts, £130k · sheet 83 (First Team / Rotation) · 26 career apps, age 31 |
| 19 | Tyson Smoothy | Wakefield Trinity | 90 | 91 | researched 90 (2026 evidence -0.6) · 2026 fantasy 1207 pts, £120k · sheet 81 (First Team / Rotation) · 11 career apps, age 27 |
| 20 | Ash Handley | Leeds Rhinos | 89 | 91 | researched 89 (2026 evidence -0.1) · 2026 fantasy 964 pts, £130k · sheet 86 (First Team / Rotation) · 212 career apps, age 30 |
| 21 | Danny Walker | Warrington Wolves | 89 | 91 | researched 89 (2026 evidence +0.3) · 2026 fantasy 1290 pts, £130k · sheet 87 (First Team / Rotation) · 182 career apps, age 27 |
| 22 | Harry Smith | Wigan Warriors | 89 | 91 | researched 89 (2026 evidence +0.1) · 2026 fantasy 1007 pts, £150k · sheet 86 (First Team / Rotation) · 144 career apps, age 26 |
| 23 | Jake Trueman | Wakefield Trinity | 89 | 91 | researched 89 (2026 evidence +0.2) · 2026 fantasy 1193 pts, £110k · sheet 88 (First Team / Rotation) · 156 career apps, age 27 |
| 24 | Jez Litten | Hull KR | 89 | 91 | researched 89 · 2026 fantasy 1257 pts, £160k · sheet 83 (First Team / Rotation) · 18 career apps, age 28 |
| 25 | Joe Mellor | Bradford Bulls | 89 | 91 | researched 89 (2026 evidence +0.4) · 2026 fantasy 1459 pts, £110k · sheet 87 (First Team / Rotation) · 204 career apps, age 36 |

### Bottom 25 (playable cards)

| # | player | club | before | after | why |
|---|---|---|---|---|---|
| 1 | Logan Blacker | Huddersfield Giants | 80 | 70 | old floor 80: no 2026 Super League minutes, 0 career apps · 2026 fantasy 0 pts, £50k · sheet 75 (Development) · 0 career apps, age 19 |
| 2 | Marshall Land | Huddersfield Giants | 80 | 70 | old floor 80: no 2026 Super League minutes, 2 career apps · 2026 fantasy 0 pts, £50k · sheet 75 (Development) · 2 career apps, age 19 |
| 3 | Tommy Rhodes | Warrington Wolves | 80 | 70 | old floor 80: no 2026 Super League minutes, 0 career apps · 2026 fantasy 0 pts, £50k · sheet 75 (Academy / Extended) · 0 career apps, age 17 |
| 4 | Alfie Lindsey | Castleford Tigers | 80 | 71 | old floor 80: no 2026 Super League minutes, 0 career apps · 2026 fantasy 0 pts, £80k · sheet 75 (Development) · 0 career apps, age 20 |
| 5 | Cobie Wainhouse | Hull KR | 80 | 71 | old floor 80: no 2026 Super League minutes, 1 career apps · 2026 fantasy 0 pts, £50k · sheet 75 (Development) · 1 career apps, age 20 |
| 6 | Ellis Lingard | Wakefield Trinity | 80 | 71 | old floor 80: no 2026 Super League minutes, 0 career apps · 2026 fantasy 0 pts, £70k · sheet 75 (Development) · 0 career apps, age 20 |
| 7 | Jacob Algar | Huddersfield Giants | 80 | 71 | old floor 80: no 2026 Super League minutes, 1 career apps · 2026 fantasy 0 pts, £50k · sheet 75 (Development) · 1 career apps, age 20 |
| 8 | Oliver Polec | Leigh Leopards | 80 | 71 | old floor 80: no 2026 Super League minutes, 0 career apps · 2026 fantasy 0 pts, £50k · sheet 75 (Development) · 0 career apps, age 20 |
| 9 | Roman Dawson | Hull FC | 80 | 71 | old floor 80: no 2026 Super League minutes, 0 career apps · 2026 fantasy 0 pts, £50k · sheet 75 (Academy / Extended) · 0 career apps, age 20 |
| 10 | Ryan Westerman | Hull KR | 80 | 71 | old floor 80: no 2026 Super League minutes, 0 career apps · 2026 fantasy 0 pts, £50k · sheet 75 (Academy / Extended) · 0 career apps, age 20 |
| 11 | Tom McKinney | Warrington Wolves | 80 | 71 | old floor 80: no 2026 Super League minutes, 0 career apps · 2026 fantasy 0 pts, £50k · sheet 75 (Development) · 0 career apps, age 20 |
| 12 | Zack Gardner | Warrington Wolves | 80 | 71 | old floor 80: no 2026 Super League minutes, 5 career apps · 2026 fantasy 0 pts, £50k · sheet 75 (Development) · 5 career apps, age 20 |
| 13 | Jonny Vaughan | Wigan Warriors | 75 | 72 | old floor 75: no 2026 Super League minutes, 0 career apps · 2026 fantasy 0 pts, £90k · sheet 75 (Academy / Extended) · 0 career apps, age 21 |
| 14 | Adrian Delarose | Catalans Dragons | 80 | 72 | old floor 80: no 2026 Super League minutes, 0 career apps · sheet 75 (Academy / Extended) · 0 career apps, age 22 |
| 15 | Cameron Bate | Bradford Bulls | 80 | 72 | old floor 80: no 2026 Super League minutes, 0 career apps · 2026 fantasy 0 pts, £50k · sheet 75 (Academy / Extended) · 0 career apps, age 22 |
| 16 | Cole Geyer | Huddersfield Giants | 80 | 72 | old floor 80: no 2026 Super League minutes, 0 career apps · sheet 75 (Academy / Extended) · 0 career apps, age 22 |
| 17 | Declan Murphy | Hull KR | 80 | 72 | old floor 80: no 2026 Super League minutes, 0 career apps · 2026 fantasy -1 pts, £80k · sheet 75 (Academy / Extended) · 0 career apps, age 22 |
| 18 | Edenn Rogers-Smith | Catalans Dragons | 80 | 72 | old floor 80: no 2026 Super League minutes, 0 career apps · sheet 75 (Academy / Extended) · 0 career apps, age 22 |
| 19 | Emre Guler | Wakefield Trinity | 80 | 72 | old floor 80: no 2026 Super League minutes, 0 career apps · 0 career apps, age 28 |
| 20 | Flynn Holden | Hull KR | 80 | 72 | old floor 80: no 2026 Super League minutes, 0 career apps · 0 career apps, age 22 |
| 21 | Harvey Makin | Wigan Warriors | 80 | 72 | old floor 80: no 2026 Super League minutes, 0 career apps · 2026 fantasy 0 pts, £80k · 0 career apps, age 23 |
| 22 | Jack Ormondroyd | Bradford Bulls | 80 | 72 | old floor 80: no 2026 Super League minutes, 0 career apps · sheet 77 (Rotation) · 0 career apps, age 35 |
| 23 | Jack Smith | York Knights | 80 | 72 | old floor 80: no 2026 Super League minutes, 0 career apps · 2026 fantasy 0 pts, £70k · sheet 75 (Development) · 0 career apps, age 21 |
| 24 | Joe Phillips | Hull FC | 80 | 72 | old floor 80: no 2026 Super League minutes, 0 career apps · 2026 fantasy 0 pts, £50k · sheet 75 (Development) · 0 career apps, age 22 |
| 25 | Joe Ward | Hull FC | 80 | 72 | old floor 80: no 2026 Super League minutes, 0 career apps · 2026 fantasy 0 pts, £50k · sheet 75 (Academy / Extended) · 0 career apps, age 21 |

### Biggest fallers

The big falls are the 13 career cards with no 2026 squad (see Method 3) and academy teenagers who were sitting on the 80 floor.

| player | club | before | after | why |
|---|---|---|---|---|
| Tom Lineham | Wakefield Trinity | 93 | 76 | career card (was 93), not in a 2026 registered squad: no 2026 Super League minutes, 196 career apps · 196 career apps, age 35 |
| Mat Ashurst | Wakefield Trinity | 91 | 76 | career card (was 91), not in a 2026 registered squad: no 2026 Super League minutes, 304 career apps · 304 career apps, age 37 |
| Jordan Turner | St Helens | 90 | 76 | career card (was 90), not in a 2026 registered squad: no 2026 Super League minutes, 320 career apps · 320 career apps, age 37 |
| James Donaldson | Leeds Rhinos | 88 | 76 | career card (was 88), not in a 2026 registered squad: no 2026 Super League minutes, 225 career apps · 225 career apps, age 35 |
| Ricky Leutele | Leigh Leopards | 88 | 76 | career card (was 88), not in a 2026 registered squad: no 2026 Super League minutes, 85 career apps · 85 career apps, age 36 |
| Sitaleki Akauola | Wakefield Trinity | 86 | 74 | career card (was 86), not in a 2026 registered squad: no 2026 Super League minutes, 79 career apps · 79 career apps, age 34 |
| Harvey Livett | Wakefield Trinity | 87 | 76 | career card (was 87), not in a 2026 registered squad: no 2026 Super League minutes, 94 career apps · 94 career apps, age 29 |
| Joe Arundel | Wakefield Trinity | 87 | 76 | career card (was 87), not in a 2026 registered squad: no 2026 Super League minutes, 166 career apps · 166 career apps, age 35 |
| Logan Blacker | Huddersfield Giants | 80 | 70 | old floor 80: no 2026 Super League minutes, 0 career apps · 2026 fantasy 0 pts, £50k · sheet 75 (Development) · 0 career apps, age 19 |
| Marshall Land | Huddersfield Giants | 80 | 70 | old floor 80: no 2026 Super League minutes, 2 career apps · 2026 fantasy 0 pts, £50k · sheet 75 (Development) · 2 career apps, age 19 |
| Alex Walker | London Broncos | 84 | 74 | career card (was 84), not in a 2026 registered squad: no 2026 Super League minutes, 48 career apps · 48 career apps, age 31 |
| Will Lovell | London Broncos | 84 | 74 | career card (was 84), not in a 2026 registered squad: no 2026 Super League minutes, 76 career apps · 76 career apps, age 33 |
| Tommy Rhodes | Warrington Wolves | 80 | 70 | old floor 80: no 2026 Super League minutes, 0 career apps · 2026 fantasy 0 pts, £50k · sheet 75 (Academy / Extended) · 0 career apps, age 17 |
| Alfie Lindsey | Castleford Tigers | 80 | 71 | old floor 80: no 2026 Super League minutes, 0 career apps · 2026 fantasy 0 pts, £80k · sheet 75 (Development) · 0 career apps, age 20 |
| Éloi Pélissier | Catalans Dragons | 85 | 76 | career card (was 85), not in a 2026 registered squad: no 2026 Super League minutes, 194 career apps · 194 career apps, age 35 |

### Biggest risers

| player | club | before | after | why |
|---|---|---|---|---|
| Ben Currie | Warrington Wolves | 92 | 95 | researched 92 (2026 evidence +0.6) · 2026 fantasy 1429 pts, £140k · sheet 88 (First Team / Rotation) · 278 career apps, age 32 |
| Tristan Sailor | St Helens | 91 | 94 | researched 91 (2026 evidence +0.5) · 2026 fantasy 1361 pts, £160k · sheet 90 (First Team / Rotation) · 43 career apps, age 28 |
| Mikey Lewis | Hull KR | 90 | 93 | researched 90 (2026 evidence +0.6) · 2026 fantasy 1081 pts, £170k · sheet 92 (First Team / Rotation) · 120 career apps, age 25 |
| Paul Vaughan | York Knights | 89 | 91 | researched 89 (2026 evidence +0.2) · 2026 fantasy 1158 pts, £130k · sheet 87 (First Team / Rotation) · 79 career apps, age 35 |
| Zach Eckersley | Wigan Warriors | 91 | 93 | researched 91 (2026 evidence -0.4) · 2026 fantasy 1055 pts, £90k · sheet 88 (First Team / Rotation) · 47 career apps, age 23 |
| Oliver Partington | Wigan Warriors | 86 | 88 | researched 86 (2026 evidence +0.3) · 2026 fantasy 1094 pts, £130k · sheet 85 (First Team) · 162 career apps, age 28 |
| Luke Thompson | Wigan Warriors | 85 | 87 | researched 85 (2026 evidence +0.5) · 2026 fantasy 913 pts, £130k · sheet 85 (First Team / Rotation) · 199 career apps, age 31 |
| Kaide Ellis | Wigan Warriors | 89 | 91 | researched 89 (2026 evidence +0.4) · 2026 fantasy 1202 pts, £120k · sheet 89 (First Team / Rotation) · 104 career apps, age 30 |
| Jai Field | Wigan Warriors | 88 | 90 | researched 88 · 2026 fantasy 979 pts, £170k · sheet 89 (First Team / Rotation) · 110 career apps, age 29 |
| Harry Smith | Wigan Warriors | 89 | 91 | researched 89 (2026 evidence +0.1) · 2026 fantasy 1007 pts, £150k · sheet 86 (First Team / Rotation) · 144 career apps, age 26 |
| Brad O'Neill | Wigan Warriors | 95 | 97 | researched 95 · 2026 fantasy 965 pts, £120k · sheet 84 (First Team / Rotation) · 78 career apps, age 24 |
| Bevan French | Wigan Warriors | 90 | 92 | researched 90 (2026 evidence +0.4) · 2026 fantasy 746 pts, £170k · sheet 93 (First Team / Rotation) · 114 career apps, age 30 |

Old-floor (≤ 80) cards: 141 → 70: 3, 71: 9, 72: 36, 73: 10, 74: 5, 75: 22, 76: 14, 77: 6, 78: 16, 79: 8, 80: 12

## Downstream changes

| area | change |
|---|---|
| `compressPeakRating` / `rating-floors.ts` | category-aware: current 70–99, era/legend 80–99 (`CURRENT_MIN_RATING = 70`) |
| `normalizePlayer` | applies `data/current-ratings-2026.json` last, current cards only |
| value (`ratingToValue`) | 70–79 band now 12k → 84k so a 79 sits under an 80 (was 90k = tie). Bands 80+ unchanged (the pre-existing overlaps at 84/85 and 89/90 are untouched, they affect era cards too) |
| Showcase rating filter | new 70–74 and 75–79 bands; the select is built from `RATING_FILTER_LABELS` |
| out-of-position | a current card takes the full −5 down to 70 (it used to stop at 80); era cards keep the 80 floor |
| pair-offer recruitment bands | current cards banded by old-scale equivalent (70–85 → 80–84 band, 86+ → 85–89, 92+ → 90–94, 96+ → 95–99), so offers stay as before |
| Underdogs daily rule | current cap 85 → 86 (keeps ~85% of current cards eligible, as before) |
| opponent club squads (play-offs, cups, scorelines) | `currentEase` −0.8 → −0.3: random current club squads average ~1.4 lower, strength back to 77.96 (was 77.99) |
| play-off / cup outcome path | `toLegacyCurrentRating` maps a Classic squad average back to the old scale (typical 82.05 → 83.1, top card 86.74 → 85.86) since that path compares raw ratings with fixed club strengths |
| Classic sim anchors | refitted (below) |
| One-Club scale | regenerated (`sim-one-club-gauntlet.ts --write`) |
| Gauntlet | `GAUNTLET_FIELD_OFFSET` stays 21 (opponents are era champions; Classic side reads the refitted ladder) |
| unchanged | tier badges / colours (90+, 95+), quick-mode 90+ guarantee (more current 90+ cards now: 22 → 35), Wordle/Grid/Ball Knower (no thresholds), chemistry, era and legend cards |

**Manager Mode** reads raw `peakRating` from `data/current-squads.json` (via `career-squads.runtime.json`), not the card rating,
and runs its own evolving scale (real Super League players 79–93 raw, generated SL depth around 79–82,
Championship sides 68–72, ratings 60–95 with age/potential). Those are not the cards shown in Classic,
so they were left unchanged; `career-squads.runtime.json` is byte-identical.

## Calibration (27-0 formula, before → after)

Drafted squad means (club choice, 400 drafts per tier): weak 80.91 → 77.48, typical 83.10 → 82.05,
good 84.17 → 84.28, top card 85.86 → 86.74 (chemistry 1.01 → 1.09 typical, 1.86 → 1.57 top card).
Club spin: typical 83.02 → 81.84, top card 85.47 → 86.26.

| ladder | anchors before | anchors after |
|---|---|---|
| classic | typical 83.1, elite 86.0, chemistry 1 | typical 82.18, elite 86.62, chemistry 1.09 |
| classic-spin | typical 83.1, elite 85.5 | typical 81.82, elite 86.14 |

| 27-0 chance (formula) | before | old anchors on new ratings | after |
|---|---|---|---|
| Classic best (400 / test-sim 100) | 14.8% / 18.1% | 31.5% | 14.9% / 16.6% |
| Classic good | 0.80% / 0.88% | 2.6% | 1.07% / 1.15% |
| Classic typical | 0.11% / 0.08% | 0.23% | 0.09% / 0.06% |
| Classic spin best | 14.2% / 16.2% | 35.2% | 14.1% / 15.7% |
| Classic spin good | 1.15% / 0.51% | 3.3% | 1.35% / 0.62% |
| Classic spin typical | 0.15% / 0.09% | 0.25% | 0.11% / 0.08% |
| Gauntlet (Classic) best sweep | 12.3% | — | 11.9% |
| One-Club, all clubs best / typical | 28.6% / 1.8% | — | 28.5% / 1.8% |
| Era | unchanged | | best 27.1% (test-sim) |

Without the refit the spread would have doubled the best-draft odds (top cards got better, the
floor got worse). The anchors were fitted to both seed sets at once; the best tier on the
100-squad test sample sits ~1.5 points under its old 18.1% while the 400-draft sample is level.
