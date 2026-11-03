/**
 * Manager Mode (v2) — data model.
 *
 * Deliberately small: a career is clubs + players + one season calendar. Everything is
 * plain JSON so a whole career saves to localStorage / Supabase as one document.
 */

/** The NRL (v1.65) runs as its own competition: 17 clubs, no promotion or relegation, no Challenge Cup. */
export type Division = "super-league" | "championship" | "nrl";

/** Short position codes used across the career engine and UI. */
export type Pos = "FB" | "WG" | "CE" | "SO" | "SH" | "PR" | "HK" | "SR" | "LF";

/** The old single game plan (saves before v1.66). Still kept in step with `tactics` for anything reading it. */
export type Tactic = "attack" | "balanced" | "defend";

/** Attacking style: throw it wide, the middle way, or carry it up the guts. */
export type AttackStyle = "expansive" | "balanced" | "direct";
/** Defensive line: rush up, hold the line, or slide and drift. */
export type DefenceLine = "rush" | "balanced" | "drift";
/** Kicking game: pin them back, mix it up, or kick to score. */
export type KickingGame = "territory" | "balanced" | "attacking";

/** The three game-plan settings (v1.66). */
export interface TacticSettings {
  attack: AttackStyle;
  defence: DefenceLine;
  kicking: KickingGame;
}

export interface CareerPlayer {
  id: string;
  name: string;
  pos: Pos;
  /** Other positions he plays as well as his own (utility men): no penalty there. */
  alt?: Pos[];
  rating: number;
  /** Ceiling for development; hidden-ish in UI (shown as stars for prospects). */
  potential: number;
  age: number;
  nationality: string;
  /** Real player from the 27-0 database (vs generated). */
  real: boolean;
  legend?: boolean;
  /** Came through this career's academy (counts for academy challenges). */
  academy?: boolean;
  /** Season stats (reset each season). */
  apps: number;
  tries: number;
  /** Career totals while at any club in this save. */
  careerApps: number;
  careerTries: number;
  /** Season goals (kicks: conversions, penalties), rated games and the sum of match ratings. Older saves: none yet. */
  goals?: number;
  rated?: number;
  ratingSum?: number;
  careerGoals?: number;
  /** Totals at each club he has played for in this save (club records, Hall of Fame). */
  clubTotals?: Record<string, ClubTotals>;
  /** Season (year) the user signed this player, and the fee paid — stops buy→sell arbitrage. */
  signedYear?: number;
  fee?: number;
  /** Seasons left on his deal, including this one (see contracts.ts; older saves derive it). */
  contract?: number;
  /** Club he last left as a free agent (released or sold with no buyer) and when: that club can't re-sign him for nothing the same year. */
  leftClubId?: string;
  leftYear?: number;
  /** Games left on a ban (red card): misses his club's next match(es). Older saves: none. */
  ban?: number;
  /** Legends: the last season he plays (he retires that summer). Older saves derive it from signedYear. */
  retireAfter?: number;
  /** Games left out injured: misses his club's next match(es), like a ban. Older saves: none. */
  injury?: number;
  /** Rating gained (or lost) last summer, shown as +N on the Team tab (user's squad only). */
  grew?: number;
}

/** A player's totals at one club in this save (every game here is rated, so avg = ratingSum / apps). Zeros are left out. */
export interface ClubTotals {
  apps: number;
  tries?: number;
  goals?: number;
  ratingSum: number;
}

export type RecordKind = "tries" | "goals" | "points" | "apps";

/** A club record holder: a real player (from data/club-records.json) or one from this career. */
export interface ClubRecord {
  name: string;
  value: number;
  years?: string;
  /** Set when a player in this career holds it. */
  playerId?: string;
  /** Season he took the record. */
  year?: number;
}

export type CareerEventKind =
  | "legend-signing"
  | "legend-retired"
  | "transfer-request"
  | "record-bid"
  | "sponsor"
  | "wonderkid"
  | "takeover"
  | "club-record"
  | "world-club-challenge"
  | "injury"
  | "board-warning"
  | "fans";

/** A pop-up on the Manager hub: shown once, one at a time, then marked seen. */
export interface CareerEvent {
  id: string;
  kind: CareerEventKind;
  year: number;
  title: string;
  text: string;
  /** Club the event is about (badge on the card). */
  clubId?: string;
  playerId?: string;
  /** Player name and rating for the card (he may have gone by the time it shows). */
  name?: string;
  rating?: number;
  /** Fee or cash involved. */
  amount?: number;
  /** 1–2 buttons; the first is the default. */
  options: Array<{ id: string; label: string }>;
  seen?: boolean;
}

export interface CareerClub {
  id: string;
  name: string;
  short: string;
  primary: string;
  secondary: string;
  /** Third kit colour (trim). */
  accent?: string;
  division: Division;
  /** Player ids. */
  squad: string[];
}

/**
 * "wcc": the World Club Challenge (pre-season: Super League champions v NRL premiers).
 * "nrl-final": NRL finals weeks 1–3 (round = week); "nrl-gf": the NRL Grand Final.
 */
export type FixtureKind = "league" | "cup" | "eliminator" | "semi" | "grand-final" | "mpg" | "wcc" | "nrl-final" | "nrl-gf";

export interface FixtureResult {
  homeScore: number;
  awayScore: number;
  /** Player ids, one entry per try. */
  homeTries: string[];
  awayTries: string[];
  /** Won in golden-point extra time (knockouts only). */
  goldenPoint?: boolean;
  motm?: string;
  /** Players sent off (red card): banned for their club's next game. */
  homeSentOff?: string[];
  awaySentOff?: string[];
  /** Players injured in this game and the games each will miss. */
  injuries?: Record<string, number>;
  /** Live matches: the user's player who went off hurt (his lay-off is rolled when the result is banked). */
  knocks?: string[];
  /** Match ratings out of 10 for both 17s (kept on the user's latest game only, to keep saves small). */
  ratings?: Record<string, number>;
}

/** man-of-steel is the NRL's Dally M Medal when the division is "nrl"; clive-churchill: NRL Grand Final player of the match. */
export type AwardId = "man-of-steel" | "young-player" | "top-try-scorer" | "club-player" | "clive-churchill";

/** One end-of-season award. */
export interface SeasonAward {
  id: AwardId;
  /** Division the award is for (club-player: the user's division). */
  division: Division;
  playerId: string;
  name: string;
  clubId: string;
  clubName: string;
  /** Short line, e.g. "18 tries in 27 games". */
  detail: string;
}

export interface Fixture {
  id: string;
  kind: FixtureKind;
  /** League round number, or cup round index. */
  round: number;
  label: string;
  division?: Division;
  home: string;
  away: string;
  result?: FixtureResult;
}

export interface TableRow {
  clubId: string;
  p: number;
  w: number;
  d: number;
  l: number;
  pf: number;
  pa: number;
  pts: number;
  /** Last five results, newest last: "W" | "D" | "L". */
  form: string[];
  /** NRL byes so far (2 ladder points each; counted in pts, not in p). */
  b?: number;
}

/** One step of the season. Holds every fixture played that step (any competition). */
export interface Matchday {
  index: number;
  label: string;
  fixtures: Fixture[];
  /** Knockout rounds whose fixtures are drawn when the previous round completes. */
  pendingDraw?: "cup-r16" | "cup-qf" | "cup-sf" | "cup-final" | "playoff-elims" | "playoff-semis" | "grand-final";
  /** NRL finals drawn when the week before completes (the NRL shares the calendar with Super League). */
  nrlDraw?: "nrl-w1" | "nrl-w2" | "nrl-w3" | "nrl-gf";
  /** NRL clubs with a bye this round (2 ladder points each). */
  byes?: string[];
  played: boolean;
}

export type ChallengeKind =
  | "win-games"
  | "finish-top"
  | "cup-reach"
  | "beat-club"
  | "big-win"
  | "unbeaten-run"
  | "academy-debuts"
  | "points-scored";

export interface SeasonChallenge {
  id: string;
  kind: ChallengeKind;
  title: string;
  target: number;
  /** For beat-club. */
  clubId?: string;
  rewardCash: number;
  rewardLegacy: number;
  progress: number;
  done: boolean;
}

export interface SeasonOutcome {
  year: number;
  division: Division;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  trophies: TrophyId[];
  promoted: boolean;
  relegated: boolean;
  prizeMoney: number;
  legacyEarned: number;
  challengesDone: number;
  topTryScorer?: { name: string; tries: number };
  /** League awards (Super League, plus the Championship when the user played there) and the club's Player of the Season. */
  awards?: SeasonAward[];
  /** Derby record this season. */
  derbies?: { w: number; d: number; l: number };
  /** The board's league target for the season (finish this place or better), when one was set. */
  boardTarget?: number;
  /** Club objectives beyond the league target, and whether each was met (v1.66; older seasons: none). */
  objectives?: Array<{ title: string; done: boolean }>;
  /** Board confidence and supporter mood at the end of the season (0–100). */
  confidence?: number;
  fans?: number;
  /** The user's signings and sales this season (kept here so they survive the deals list cap). */
  ins?: SeasonDeal[];
  outs?: SeasonDeal[];
  /** Set once this season has been banked into the cross-career legacy. */
  banked?: boolean;
  /** Who won what, the play-offs, the cup and every result of yours (seasons before this was kept: none). See story.ts. */
  story?: SeasonStory;
}

/** A signing or sale, kept on the season's history. `club`: the other club (null = free agent / released). */
export interface SeasonDeal {
  name: string;
  pos: Pos;
  rating: number;
  club: string | null;
  fee: number;
}

export type ObjectiveKind = "cup-run" | "play-youth" | "budget" | "derbies" | "finals";

/** A board objective on top of the league target. */
export interface ClubObjective {
  id: string;
  kind: ObjectiveKind;
  title: string;
  target: number;
  progress: number;
  done: boolean;
}

/** One game kept for the season story: club ids and the score only (small saves). */
export interface MiniResult {
  /** Competition / stage. */
  k: FixtureKind;
  /** League round, or Challenge Cup round 1–5. */
  r: number;
  h: string;
  a: string;
  /** Scores (missing while the game is still to be played). */
  hs?: number;
  as?: number;
  /** Won in golden point. */
  gp?: 1;
}

/** What a season needs to be told again later: honours, the play-offs, the cup and the user's results. */
export interface SeasonStory {
  /** Every game of the user's, in calendar order. */
  mine: MiniResult[];
  /** Play-off eliminators, semi-finals and the Grand Final. */
  playoffs: MiniResult[];
  /** The Million Pound Game (13th in Super League v Championship runners-up). */
  mpg?: MiniResult;
  /** Challenge Cup semi-finals and final. */
  cup: MiniResult[];
  /** Final league order: Super League top six, Championship top two. */
  slTop: string[];
  chTop: string[];
  /** Clubs going up to Super League / down to the Championship. */
  promoted: string[];
  relegated: string[];
  /** NRL (v1.65; older seasons: none): the top eight, the finals and the World Club Challenge. */
  nrlTop?: string[];
  nrlFinals?: MiniResult[];
  wcc?: MiniResult;
}

export type TrophyId =
  | "grand-final"
  | "league-leaders"
  | "challenge-cup"
  | "championship-title"
  | "promotion"
  | "million-pound-game"
  | "perfect-season"
  | "nrl-premiership"
  | "minor-premiership"
  | "world-club-challenge";

export interface CareerState {
  version: 1;
  seed: string;
  createdAt: number;
  updatedAt: number;
  managerName: string;
  userClubId: string;
  /** Division the user started in (for "fastest climb" records). */
  startDivision: Division;
  year: number;
  seasonNumber: number;
  budget: number;
  /** This season's board income and wage bill (shown on the hub). */
  lastIncome?: number;
  lastWages?: number;
  /** 1–5, in half steps. Drives income and which players will sign. */
  prestige: number;
  tactic: Tactic;
  /** Attacking style, defensive line and kicking game (v1.66). Older saves: derived from `tactic` on load. */
  tactics?: TacticSettings;
  /** Supporter mood and board confidence, 0–100 (v1.66; older saves start at 60 on load). */
  fans?: number;
  boardConfidence?: number;
  /** This season's board objectives on top of the league target. */
  objectives?: { year: number; list: ClubObjective[] };
  /** The user's deals this season (copied onto the season's history at the end). */
  seasonDeals?: { year: number; ins: SeasonDeal[]; outs: SeasonDeal[] };
  /** 13 player ids in shirt order 1–13 (see LINEUP_SLOTS). */
  lineup: string[];
  /** Interchange bench: 4 squad players not in the XIII (shirts 14–17). Older saves get one on load. */
  bench: string[];
  clubs: Record<string, CareerClub>;
  players: Record<string, CareerPlayer>;
  /** Unsigned players (released / free agents) still in the world. */
  freeAgents: string[];
  calendar: Matchday[];
  /** Index of the next unplayed matchday; === calendar.length when the season is over. */
  matchdayIndex: number;
  tables: Record<Division, TableRow[]>;
  challenges: SeasonChallenge[];
  /** Season-long tracking for challenges / records. */
  seasonTrack: {
    unbeatenRun: number;
    bestUnbeatenRun: number;
    biggestWinMargin: number;
    academyDebutIds: string[];
    pointsScored: number;
    cupRoundReached: number;
    /** Derby record (older saves: none yet). */
    derbies?: { w: number; d: number; l: number };
    /** Legacy from Magic Weekend and derby wins, added at season end. */
    bonusLegacy?: number;
    /** A derby win lifts the next game: matchday index it applies to. */
    moraleAt?: number;
  };
  /** season → review (end of season) → departures (retirements, contracts) → transfers → season. */
  phase: "season" | "review" | "departures" | "transfers";
  /** Filled at season end; shown on the review screen. */
  lastOutcome?: SeasonOutcome;
  history: SeasonOutcome[];
  /** Short news lines for the hub, newest first. */
  news: string[];
  /** Divisions a league-wide news line is about (lines about the user's club have none). See news.ts. */
  newsTags?: Record<string, Division[]>;
  /** Club records broken or set in this career (on top of data/club-records.json). */
  clubRecords?: Record<string, Partial<Record<RecordKind, ClubRecord>>>;
  /** Season ids of the first Super League Grand Final win (for the fastest-climb record). */
  firstGrandFinalSeason?: number;
  /** Every deal in the world this save (newest first, capped), incl. AI-to-AI and Deadline Day. */
  transfers?: TransferDeal[];
  /** A rival's offer for one of your players, open until the next round is played. */
  incomingBid?: IncomingBid;
  /** Each club's most recent team sheet (for tapping a club name). */
  lastLineups?: Record<string, LastLineup>;
  /** This season's pre-season friendlies (picked before Round 1). */
  preseason?: Preseason;
  /** Year in which the user shut the mid-season window on Deadline Day. */
  deadlineClosedYear?: number;
  /** Deadline Day's 12-hour clock: offers and deals land as it counts down. */
  deadline?: DeadlineClock;
  /** The first-save walkthrough has been seen. */
  tutorialDone?: boolean;
  /** Season stages the user has moved past, as `${year}:${stage}` (pre-season, league over, promotion). */
  stagesSeen?: string[];
  /** The summer's comings and goings, shown before the transfer window opens. */
  departures?: Departures;
  /** Academy prospects (in `players`, not in any squad): promote, release or leave them. Older saves: none. */
  academy?: string[];
  /** Pop-ups for the hub (newest last); seen ones are kept briefly so they never show twice. */
  events?: CareerEvent[];
  /** Legends who have retired in this career: gone from every market. */
  retiredLegends?: string[];
  /** The user's chosen captain (older saves: the best senior starter). */
  captainId?: string;
  /** The board's league target for `year` (finish `target`th or better). Older saves derive it. */
  board?: { year: number; target: number };
  /**
   * Each season's champions (Super League Grand Final, NRL Grand Final), for the next World Club
   * Challenge. Kept for the last few seasons only.
   */
  champions?: Array<{ year: number; sl?: string; nrl?: string }>;
}

export interface Departures {
  /** The season just finished. */
  year: number;
  retired: Array<{ name: string; pos: Pos; age: number; rating: number }>;
  /** User players whose deals have run out and still need a decision. */
  expiring: string[];
  renewed?: string[];
  /** Names of players let go at the end of their contract. */
  released?: string[];
  /** Academy graduates who joined this summer. */
  academy: string[];
  /** How the user's young players developed this summer (biggest movers first). */
  growth?: Array<{ name: string; pos: Pos; age: number; from: number; to: number; apps: number }>;
}

export interface FriendlyResult {
  opponentId: string;
  home: boolean;
  us: number;
  them: number;
  /** Gate money (home) or appearance fee (away) banked. */
  money: number;
}

export interface Preseason {
  year: number;
  done: boolean;
  results: FriendlyResult[];
}

export interface TransferDeal {
  year: number;
  /** Matchday index the deal happened before. */
  at: number;
  playerId: string;
  playerName: string;
  pos: Pos;
  rating: number;
  /** null = free agent / released. */
  from: string | null;
  to: string | null;
  fee: number;
  deadlineDay?: boolean;
  /** Done in the summer window (summer or pre-season). */
  summer?: boolean;
  /** Involves the user's club. */
  user?: boolean;
  /** Divisions of the clubs involved when the deal was done (older saves: inferred on load). */
  divisions?: Division[];
}

export interface IncomingBid {
  clubId: string;
  playerId: string;
  fee: number;
  /** Matchday index the bid was made at; it lapses once that matchday is played. */
  at: number;
}

/** An offer for one of your players on Deadline Day. */
export interface DeadlineOffer {
  id: string;
  clubId: string;
  playerId: string;
  fee: number;
  /** Minutes left on the clock when the offer was made / when it lapses. */
  madeAt: number;
  expiresAt: number;
  /** Plain-English reason they want him ("short of props"). */
  reason?: string;
  /** Beats an earlier offer for the same player. */
  raised?: boolean;
}

export interface DeadlineEvent {
  /** Minutes left on the clock when it happened. */
  at: number;
  kind: "deal" | "offer" | "you" | "market" | "info";
  text: string;
}

export interface DeadlineClock {
  year: number;
  /** 720 = 12 hours to go; the window shuts at 0. */
  minutesLeft: number;
  /** Half-hour slots whose events have already happened (0..24). */
  slotsDone: number;
  offers: DeadlineOffer[];
  /** What's happened today, newest first. */
  feed: DeadlineEvent[];
  paused?: boolean;
}

export interface LastLineup {
  fixtureId: string;
  label: string;
  opponentId: string;
  home: boolean;
  us: number;
  them: number;
  lineup: string[];
  /** Interchange (saves from before the bench have none). */
  bench?: string[];
  at: number;
}

/** Persists across every career on this device / account. */
export interface CareerLegacy {
  version: 1;
  legacyPoints: number;
  lifetimeLegacyPoints: number;
  unlockedLegends: string[];
  careersStarted: number;
  trophies: Record<TrophyId, number>;
  /** Fewest seasons from a Championship start to a Super League Grand Final win. */
  fastestGlorySeasons?: number;
  bestSeason?: { wins: number; losses: number; drawn: number; year: number; clubName: string };
  perfectSeasons: number;
  biggestWin?: { margin: number; score: string; opponent: string; year: number };
  /** `${career seed}:${year}` of seasons already banked (stops double-banking from two tabs/devices). */
  bankedSeasons?: string[];
  updatedAt: number;
}
