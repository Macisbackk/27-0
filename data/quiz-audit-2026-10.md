# Quiz question bank audit — October 2026

Covers the Golden Point Quiz (15-rung ladder) and Team Challenge, which share one bank:
`data/quiz/curated.ts` (hand-written), `data/quiz/variety-2026-10.ts` (new, this audit) and
`data/quiz/generated/bank.json` (built by `scripts/generate-quiz-bank.ts` from `data/quiz/facts.ts`
and squad data).

## Headline numbers

| | Before | After |
|---|---:|---:|
| Questions in the loaded bank | 1,295 | 1,646 |
| New questions | – | 409 (316 hand-written + 93 generated) |
| Removed (wrong, unverifiable, duplicate) | – | 19 (8 curated, 11 generated) |
| Re-generated with new ids (same family, fixed distractors) | – | 39 (Dream Team, rosters, MoS 2023 now curated) |
| Questions carrying a `source` URL | 0 | 1,445 (every new and every generated question) |
| Correct answer stored in slot A | 100% | 24.5% (A 24.5 / B 25.5 / C 24.4 / D 25.6) |

The brief said "~709 questions"; the loaded bank was already 1,295 (223 hand-written + 1,072 generated).

## Factual fixes (wrong answer or two correct answers)

- **Wigan's Super League points record** (`cur-wigan-points-record`): was Pat Richards; correct is Andy Farrell
  (2,376 SL points, all for Wigan; Richards' 2,280 includes Catalans). Source: Wikipedia, *List of players with
  1,000 Super League points*.
- **Dream Team questions offered two correct answers**: 1996 (Keiron Cunningham offered as a distractor — he was in
  the 1996 team), 1997 and 1999 (Jason Robinson as a distractor — in both teams). All Dream Team questions now draw
  wrong answers only from nearby seasons' teams and never from that season's XIII.
- **Jamie Peacock "captained Leeds to titles"**: Sinfield was Leeds captain. Rewritten (joined Leeds 2006, six
  more Grand Finals). Source: Wikipedia, *Jamie Peacock*.
- **Ellery Hanley "Wigan great won MoS 1985, 1987, 1989"**: 1985 was with Bradford Northern. Stem reworded.
- **Andy Farrell "senior England union coach"**: outdated; now Lions head coach on the 2025 tour.
- **Lance Todd 2003**: "Garry Connolly" → "Gary Connolly". Name casing fixed across generated squads
  ("Mcgillvary", "Mcshane", "Mcilorum", "O'connor").
- **Club tags taken from a player's current/last club instead of the club at the time** (affects Team Challenge
  pools): e.g. Man of Steel 2020 Paul McShane was tagged York (Castleford), 2021 Sam Tomkins Wigan (Catalans), 2022
  Brodie Croft Leeds (Salford), 2019 Hastings Wigan (Salford), 2014 Daryl Clark St Helens (Castleford), 2009 Hodgson
  Warrington (Huddersfield), 2003 Peacock Leeds (Bradford), 1988 Offiah Wigan (Widnes); Lance Todd 1971 Murphy
  St Helens (Leigh), 1989 Hanley Leeds (Wigan), 2015 Briscoe Hull FC (Leeds), 2016/17 Sneyd Warrington (Hull FC),
  2020 Myler Warrington (Leeds), 2021 Evalds Salford (Castleford); Dream Team 2014 Chris Hill Wakefield (Warrington),
  2023 Asiata Hull FC (Leigh). Man of Steel, Lance Todd and Dream Team now carry the club **at the time** in
  `facts.ts` (`MAN_OF_STEEL_WINNERS`, `LANCE_TODD_WINNERS.club`, `DREAM_TEAMS`).
- **Giveaway distractors**: Lance Todd 2020s questions offered 1940s–50s names (e.g. 2024: Bevan French v Gerry
  Helme, Billy Stott, Peter Ramsden); Man of Steel 2025 offered Jamie Peacock, Sean Long, Adrian Vowles; Grand Final
  and Challenge Cup winner questions offered clubs not in Super League that year (Hull KR for 1999–2003). All now
  use the nearest seasons' winners/finalists.
- **Era labels**: every pre-2000 generated question was labelled "1990s" (Lance Todd 1946 etc.). Now the decade.
- **Difficulty**: club founding years were "easy" (now hard); Man of Steel/Lance Todd pre-1996 now very-hard/expert.

## Removed and why

| Question | Reason |
|---|---|
| cur-cas-greggs | Gossip about a social-media incident; unverifiable and not a rugby fact |
| cur-york-vaughan-drop | Garbled wording, unverifiable |
| cur-westwood (2012 MoS shortlist) | Could not verify the shortlist |
| cur-quinlan (Hull KR signing) | Could not verify the club he joined from |
| cur-giants-points-record | Club-only SL points total not verifiable from a reliable source |
| cur-cas-lls-year | Same fact as lls-winner-2017 |
| cur-leigh-leopards-year | Contradicted hist-mile-leigh (2022 vs 2023); kept "first season as Leopards: 2023" |
| cur-york-sl-year | Same fact as cur-york-current |
| 11 generated club-history questions | Same fact as a curated question (The Jungle, Knowsley Road, Wire, Belle Vue, York Community Stadium, Salford City Reds, Centurions, Salford's first GF, Stade Ernest-Wallon, Catalans' first French cup, Fulham) — listed with reasons in `SAME_FACT_AS_CURATED` in the generator |

Rewritten for a single unambiguous answer: Danny McGuire "winning try in 2011" (unverifiable → first player to
200 SL tries), Bevan French "played in 2023 and 2024 GF wins" (four options did → 2023 MoS + first Rob Burrow Award),
Jack Welsby "played in 2020–22 GF wins" (→ last-play winning try in 2020), Martin Offiah "Hall of Fame winger"
(Robinson also fits → ten tries v Leeds, 1992), Kirk Yeaman/Richard Horne/Eorl Crabtree vague "long-serving"
stems (→ specific Dream Team selections), St Helens appearance record (duplicate of the SL record → Paul Wellens 442).

Time-sensitive wording pinned to a season or date ("in 2026", "as of July 2026", "up to and including 2026").

## Mix before and after

Topic buckets are assigned by `scripts/quiz-mix-report.ts` (run `npm run report:quiz-mix -- --before <bank.json>`).

### Topic

| | Before | After |
|---|---:|---:|
| Super League 2026 season | 22 (1.7%) | 70 (4.3%) |
| Women's / wheelchair RL | 0 (0.0%) | 38 (2.3%) |
| NRL links / Origin / World Club | 41 (3.2%) | 67 (4.1%) |
| Internationals / World Cup | 136 (10.5%) | 147 (8.9%) |
| Rules / laws | 11 (0.8%) | 36 (2.2%) |
| Man of Steel / awards | 182 (14.1%) | 239 (14.5%) |
| Grand Finals | 91 (7.0%) | 96 (5.8%) |
| Challenge Cup | 194 (15.0%) | 213 (12.9%) |
| Records / stats | 48 (3.7%) | 97 (5.9%) |
| Coaches | 15 (1.2%) | 28 (1.7%) |
| Stadiums | 23 (1.8%) | 41 (2.5%) |
| Nicknames / colours | 16 (1.2%) | 28 (1.7%) |
| Transfers / career moves | 118 (9.1%) | 122 (7.4%) |
| History pre-1996 | 5 (0.4%) | 28 (1.7%) |
| Clubs / club history | 65 (5.0%) | 72 (4.4%) |
| Players / squads | 328 (25.3%) | 324 (19.7%) |

### Era (earliest year the question is about)

| | Before | After |
|---|---:|---:|
| 1895–1945 | 3 (0.2%) | 40 (2.4%) |
| 1946–1979 | 105 (8.1%) | 123 (7.5%) |
| 1980–1995 | 144 (11.1%) | 173 (10.5%) |
| 1996–2009 | 307 (23.7%) | 374 (22.7%) |
| 2010–2019 | 344 (26.6%) | 400 (24.3%) |
| 2020–2025 | 189 (14.6%) | 236 (14.3%) |
| 2026 | 74 (5.7%) | 120 (7.3%) |
| Timeless / undated | 129 (10.0%) | 180 (10.9%) |

### Difficulty

| | Before | After |
|---|---:|---:|
| easy | 160 (12.4%) | 159 (9.7%) |
| medium | 290 (22.4%) | 343 (20.8%) |
| hard | 484 (37.4%) | 550 (33.4%) |
| very-hard | 220 (17.0%) | 368 (22.4%) |
| expert | 141 (10.9%) | 226 (13.7%) |

### Question style

| | Before | After |
|---|---:|---:|
| Odd one out (NOT / never) | 0 (0.0%) | 20 (1.2%) |
| Which of these… | 186 (14.4%) | 187 (11.4%) |
| Which year / season | 58 (4.5%) | 76 (4.6%) |
| How many / number | 16 (1.2%) | 40 (2.4%) |
| Score | 60 (4.6%) | 66 (4.0%) |
| Where / venue | 25 (1.9%) | 35 (2.1%) |
| Who (person) | 500 (38.6%) | 587 (35.7%) |
| Which club / nation | 265 (20.5%) | 387 (23.5%) |
| What (other) | 185 (14.3%) | 248 (15.1%) |

### Stored answer slot

- Before: A 100.0%, B 0.0%, C 0.0%, D 0.0%
- After: A 24.5%, B 25.5%, C 24.4%, D 25.6%

## What the new questions cover

- **Pre-1996 history** (40 from 1895–1945 alone, up from 3): Northern Union champions from Manningham (1895–96)
  to Wigan's seven-in-a-row, All Four Cups (Hunslet, Huddersfield, Swinton), Challenge Cup finals 1897–1945,
  all-time records (Rosenfeld's 80 tries, Jim Sullivan, George West, David Watkins, Max Jowitt's 500 points).
- **Rules and laws** (11 → 36): tackle-count history, scoring values, 40/20 and 20/40, zero tackle, markers,
  drop-outs, eight-point try, shot clock, pitch dimensions.
- **Women's and wheelchair rugby league** (0 → 38): every Women's Super League Grand Final, Women's Challenge Cup
  history (first Wembley final 2023, Wigan 2025/26), Women's World Cups, women's and wheelchair Golden Boots,
  wheelchair rules, World Cups 2008–2021, Wheelchair Super League.
- **Internationals, Origin and NRL links**: Four Nations, World Cup finals and venues, State of Origin, NRL Grand
  Finals and Clive Churchill Medals (incl. Sam Burgess 2014).
- **Second tier**: Championship Grand Finals, Million Pound Games, Featherstone's 2026 exclusion.
- **Club identity**: nicknames, colours and grounds for Championship and League One clubs as well as Super League.
- **Records/stats**: season top try-scorers 1996–2024, Super League match/season records, each club's appearance
  record holder, Grand Final records.
- **Coaches**: every Super League title-winning coach 1996–2026.
- **2026 season** (22 → 70): new clubs, Las Vegas, York's first win, the Grand Final (half-time, drop goal, captain,
  coach, crowd), Challenge Cup final records, Charnley's try record, awards.
- **New formats inside the 4-option engine**: odd-one-out ("Which of these … NOT / never"), stat-based
  ("Which club had the most players in the 2018 Dream Team, with 7?"), how-many, score, venue.

Every new question has a `source` URL (not shown to players). Main sources: Wikipedia season, final, award and
records pages; rugby-league.com; Sky Sports; Yorkshire Evening Post / Yorkshire Post; Love Rugby League;
International Rugby League; NRL.com; rugbyleaguerecords.online; Total RL.

## Selection changes (variety in play)

- **Order no longer defeats the variety rules**: questions were picked with back-to-back checks and then shuffled,
  which threw the checks away. The 14 leading questions are now arranged after picking so neighbours differ in
  category, topic family and (Golden Point Quiz) club, including the slot before the fixed win question.
- **Difficulty quota per run**: the ladder stays deliberately unordered (commit e64471e), but the 14 leading
  questions now follow a fixed mix (3 easy, 4 medium, 4 hard, 2 very-hard, 1 expert) instead of mirroring the
  bank's skew; Q15 stays hard-tier. Thin tiers borrow from the neighbouring tier first.
- **No repeats for ten runs**: recently asked questions/topics are now excluded (not just penalised) while the pool
  allows, and the memory grew from 80 to 150 ids (ten full runs).
- **Balance caps**: at most 4 questions per category and 2 per club in a Golden Point run; related facts share a
  topic family (e.g. all Charnley try-record questions, all Man of Steel questions) so a run asks only one.

## Checks added

`scripts/validate-quiz-bank.ts` (CI step "Validate quiz bank") now also fails on: correct-answer slot share outside
25% ± 5; any difficulty tier with fewer than ten runs' worth of questions for the quota (and fewer than 150
win-question candidates); any new (`var-`) or generated question without a source; duplicate or shadowed ids in
the hand-written files. Existing checks kept: duplicate normalised question text, exactly one correct option,
unique options, unique topics, valid categories/teams, Team Challenge coverage per club.

`scripts/test-quiz-engine.ts` adds: no back-to-back category, topic family or club across 40 Golden Point runs;
difficulty quota respected; club cap; no repeated question across ten consecutive runs fed through recent-id memory;
at least 8 categories per run; Team Challenge avoids back-to-back categories.

## Not changed / follow-ups

- 201 older curated questions still have no `source` field (their sources are in code comments where they exist);
  the validator only requires sources for new and generated questions.
- The 2026 Women's Super League Grand Final result and the 2026 NRL Grand Final opponent could not be confirmed, so
  no questions ask them. The 2026 men's World Cup is still being played and is not asked about.
- Squad-number and current-roster questions (259) come from the game's squad data, not a web source; their
  `source` names the data file.

## Update (26 Oct 2026, owner request)

All 42 women's and wheelchair rugby league questions were removed as too niche, and those two categories dropped. Bank now 1,604 questions.
