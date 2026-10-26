# Era card rating audit — October 2026

Scope: historic and legend **season cards from 1996–2025** (Era Classic). No current 2026 card is touched.
Generator: `bun scripts/build-era-ratings.ts --write` → `data/era-season-ratings.json` (rating + short reason,
applied in `src/lib/players/normalize.ts` after the manual overrides and the career-arc audit, before the 2026
re-rate, never for `category: "current"`). Full from/to/why per card: `data/era-season-ratings-report.json`.
Evidence: `data/era-rating-anchors.json`.

## Sources

- Man of Steel and Young Player of the Year, 1996–2025: https://en.wikipedia.org/wiki/Man_of_Steel_Awards
- Super League Dream Team, every year 1996–2025 (390 selections): https://en.wikipedia.org/wiki/Super_League_Dream_Team
- Lance Todd Trophy: https://en.wikipedia.org/wiki/Lance_Todd_Trophy
- Harry Sunderland Trophy: https://en.wikipedia.org/wiki/Harry_Sunderland_Trophy
- Champions: https://en.wikipedia.org/wiki/List_of_Super_League_seasons
- Final tables: `https://en.wikipedia.org/wiki/<year>_Super_League_season` for each year (1997: `1997_Super_League_(UK)_season`).
  Super 8s years (2015–18) use the Super 8s table for 1st–8th. Cross-checked with the club season lists for
  Wigan, St Helens, Leeds, Huddersfield, Catalans and Castleford.
- 2026 Dream Team and Golden Boots come from the repo's own data (`dream-team-years.json`, `golden-boot-years.json`).

## What was wrong

1. **Placeholder cards in a player's prime.** Many modern season cards sat at a flat 80–83 next to award seasons.
   Examples: Chris Hill 2015 at 82 between Dream Team years 2014 and 2016. Liam Farrell 2016 at 82, the year he won the
   Harry Sunderland. Ryan Hall 2009 at 83 in a Dream Team season (he made four). Zak Hardaker 2016 at 83, the year after
   his Man of Steel. Tommy Makinson 2015 at 82.
2. **Award seasons below ordinary ones.** Some Man of Steel seasons sat below the player's peak:
   - Bevan French 2023 at 92
   - Zak Hardaker 2015 at 91

   Dream Team seasons were often 5–10 points under the player's best card.
3. **Peaks out of line with the award winners.** Some players with few honours out-rated Man of Steel winners:
   - Joel Monaghan was 96 with one Dream Team.
   - Peter Fox was 95 with one.
   - Darren Albert was 96 with two.
   - Jamie Jones-Buchanan (94), Joel Moon (93) and Louie McCarthy-Scarsbrook (93) have no Dream Team or Man of Steel.

   Meanwhile Hardaker (MoS 2015) peaked at 91, Daryl Clark (MoS 2014) at 90 and Brodie Croft (MoS 2022) at 86.
4. **Club seasons out of order.** Some club seasons ranked well against where the side really finished:
   - Huddersfield 2016 (12th) was rated above Wigan 2016 (champions).
   - Bradford 2014 (relegated, 13th) was above Wigan 2016.
   - Salford 2015 (11th) was above St Helens 2015 (4th).
   - Warrington 2009 (10th) was among the top sides that year.
5. **Era sides fielded peak cards from other seasons.** When an era starting 17 has no card for that exact season,
   the name fallback picked the player's highest-rated card. For example, Leeds 2014 fielded Jamie Peacock's 2003
   card (99) and Kevin Sinfield's 2012 card (98). Only about 49% of era-side slots use a card from that season.

## Changes

639 era cards changed: 280 up, 359 down. Each reason below is counted once per card that it touched.

| Reason | Cards |
|---|---|
| Club season vs real finish (±1–3, ordinary cards only) | 462 |
| Age curve against the honours-anchored peak | 78 |
| Prime-age season next to a Dream Team year (no placeholder) | 57 |
| Peak capped by honours (no MoS; DT ×0/1/2/3 → 91/93/94/95) | 57 |
| Dream Team season raised to peak − 1 | 45 |
| Man of Steel season raised to peak | 8 |
| Lance Todd / Harry Sunderland season ≥ peak − 3 | 3 |
| Same player, same season, two cards → one rating | 3 |
| Young Player of the Year season | 1 |

### Biggest raises
| Card | From → to | Why |
|---|---|---|
| Liam Farrell 2016 (Wigan) | 82 → 92 | 2016 Harry Sunderland; Dream Team ×6 |
| Ryan Hall 2009 (Leeds, both cards) | 83 → 93 | 2009 Dream Team; four Dream Teams put his peak at 94 |
| Josh Charnley 2023 (Leigh) | 83 → 92 | 2023 Dream Team (3rd selection) |
| Alex Walmsley 2016 (St Helens) | 82 → 90 | prime, next to Dream Team 2015 (×4 overall) |
| Chris Hill 2015 (Warrington) | 82 → 90 | between Dream Teams 2014 and 2016 |
| Ryan Hall 2013 (Leeds) | 82 → 90 | between Dream Teams 2012 and 2014 |
| Tommy Makinson 2015 (St Helens) | 82 → 90 | after Dream Team 2014 |
| Zak Hardaker 2016 (Leeds) | 83 → 91 | year after his Man of Steel |
| Jake Connor 2024 (Huddersfield) | 85 → 92 | year before his 2025 Man of Steel |
| Kallum Watkins 2016 (Leeds) | 82 → 89 | after Dream Teams 2014–15 |
| Brodie Croft 2025 (Leeds) | 86 → 92 | Man of Steel 2022, Dream Team 2026 |
| Zak Hardaker 2015 / Bevan French 2023 | 91 → 95 / 92 → 95 | Man of Steel seasons |
| Danny Richardson 2018, Robbie McCormack 1998, Dale Laughton 1998 | +5–6 | their Dream Team seasons |

### Biggest cuts
| Card | From → to | Why |
|---|---|---|
| Martin Gleeson 1999 | 94 → 84 | 19-year-old season against a 94 peak |
| Gareth Hock 2003 | 92 → 84 | age 20 |
| Willie Peters 2000, Michael Smith 1998 | −5 | age 21–22 |
| Grant Millington 2012 (Castleford, 13th of 14) | 91 → 86 | 3 yrs from his best, and a side rated above its finish |
| Sam Burgess 2009 (Bradford) | 95 → 91 | age 21; not a Dream Team (the repo's 2008–09 DT tag for him is wrong) |
| Joel Monaghan 2011 / 2015 / 2016 | 96 → 93 / 92 → 89 / 91 → 88 | one Dream Team: peak capped at 93 |
| Barrie McDermott 1996 | 94 → 90 | one Dream Team (1999), 3 years before it |
| Jamie Jones-Buchanan 2009–16 | −2 to −3 | no Dream Team or MoS: peak 94 → 91 |
| Joel Moon, Louie McCarthy-Scarsbrook, Kylie Leuluai, Shontayne Hape | −1 to −2 | same cap (91) |
| Lesley Vainikolo, Darren Albert, Ali Lauitiiti | −1 to −2 | two Dream Teams: peak capped at 94 |
| Peter Fox 2009 | 95 → 93 | one Dream Team |

### Club seasons moved (44)
These are top-half finishers rated well below the trend, and bottom-half finishers rated above it. Dominant title sides are not
pulled down, and strugglers are not propped up.

- Up: Wigan 2020/21/22/23/24/25, Warrington 2015/20/21/23/24, Leeds 1998/2020/21/22/25, Leigh 2025,
  Huddersfield 2022, London 1996, Catalans 2008, St Helens 1996, Salford 1997, Hull FC 2012, Wakefield 2009/2025,
  Warrington 1999.
- Down: Huddersfield 2016 (12th), Warrington 2009 (10th), Salford 2015 (11th), Catalans 2010 (14th),
  Castleford 2012 (13th), Wigan 2006 (8th), Bradford 2011/13/14, Salford 2009/14/16, Widnes 2012, Catalans 2006/07,
  London 2019, Hull FC 2009, Wakefield 2010.

## Code fixes alongside the data

- `src/lib/players/era-starting-17s.ts` + `player-name-resolve.ts`: if an era squad has no card for that exact season,
  it now uses the **nearest season** of the same player (his club that year preferred) instead of his best card.
  A Current card is still never used for a historic season. This also lets 47 more era sides build that used
  to fail, because their only "best" card was a 2026 card: 238 → 285 era teams.
  It also cuts `validate:era-teams` errors from 215 to 121.
- `scripts/validate-rating-overrides.ts`: manual overrides replaced on purpose by a later documented layer (the
  career-arc audit, this era audit, the 2026 re-rate) are reported as superseded, not errors. It failed with 375 errors
  on `main` and now passes.

## Results

| Check | Before | After |
|---|---|---|
| Era spin pools (68 club-seasons): corr(finish, average rating) | −0.67 | −0.85 |
| Era spin pools: pairs where the higher finisher is rated lower | 22.2% | 12.0% |
| Native club-seasons (122): corr(finish, best-13 rating) | −0.64 | −0.78 |
| Era starting-17 sides: corr / inversions | −0.68 / 12.2% | −0.75 / 11.5% (and 47 more sides) |
| Era pool cards: mean / ≥90 / ≥95 | 87.24 / 29.4% / 4.8% | 87.05 / 28.6% / 4.4% |

Era Classic Monte Carlo (`scripts/sim-era-classic-perfect-season.ts`, 300 seasons per draft style, opponents as in
the game):

| Draft style | 27-0 before | 27-0 after | Win % after |
|---|---|---|---|
| random pick from each spun side | 7.7% | 6.7% | 88.6 |
| one of the two best (strong, not perfect) | 13.0% | 10.3% | 89.8 |
| always the best | 19.3% | 17.7% | 93.0 |

## Limits / follow-ups

- **Era Classic is still generous.** A strong-but-not-perfect era squad goes 27-0 about one season in ten. That comes
  from the season engine: opponents are 65% club tier and 35% a random club squad, and the user's strength gets a
  value bonus. Ratings are not the cause, so I left the engine alone. Lowering the user's effective rating or raising
  the era opponents' tier is the lever if 27-0 should be rarer.
- **51% of era-side slots still use a card from another season.** Nearest-year is much better than best-card, but
  real fixes need season cards: for example, there are no 2011 Rangi Chase, 2019 Jackson Hastings, 2014 Daryl Clark
  or 2022 Brodie Croft cards, so those Man of Steel seasons can't be shown.
- Some stale cards carry impossible years and were left alone because they aren't in Era Classic. Examples:
  `jamie-lyon` (2000), `wakefield-hist-chris-hill` (2005) and `huddersfield-hist-chris-mcqueen` (2005).
  `salford-hist-martin-gleeson` 1999 is labelled Wigan.
- The repo's `dream-team-years.json` tags Sam Burgess for 2008–09. Neither Dream Team includes him.
- Pre-1996 cards (no award data) and the 2026 cards are out of scope.
- `validate:players`, `validate:player-ratings` and `validate:team-years` fail the same way on `main` (unrelated).
