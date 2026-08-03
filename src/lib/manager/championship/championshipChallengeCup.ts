import { CURRENT_PLAYABLE_CLUBS } from "../../clubs/super-league-display";
import {
  CHAMPIONSHIP_CLUBS,
  CHAMPIONSHIP_CLUB_NAMES,
} from "../../clubs/championship-clubs";
import { getClubBaseStrength } from "../../game/club-strength";
import type {
  BracketMatch,
  ChallengeCupBracketState,
} from "../../game/challenge-cup-bracket";

/** Expanded cup draw schema — bump when bracket topology / seeding changes. */
export const CHALLENGE_CUP_SCHEMA_VERSION = 4;

/**
 * Expanded Challenge Cup (schema v4):
 * Round 1 — all 20 Championship clubs (10 ties), seeded by prior Champ table.
 * Round 2 — 10 Championship winners + 6 lowest Super League clubs (by prior table).
 *            Top 8 Super League clubs (prior finish) receive a bye to the Last 16.
 * Round 3 — Last 16 (8 R2 winners + 8 seeded SL byes)
 * Round 4–6 — QF / SF / Final
 */
export const EXPANDED_CUP_ROUND_LABELS: Record<number, string> = {
  1: "Round One",
  2: "Round Two",
  3: "Last 16",
  4: "Quarter-Final",
  5: "Semi-Final",
  6: "Final",
};

/** Compact league finish used for year-on-year cup seeding. */
export interface CupSeedingStanding {
  team: string;
  position: number;
}

export interface CupSeedingContext {
  /** Super League clubs best → worst (league position 1 first). */
  superLeagueOrder: string[];
  /** Championship clubs best → worst. */
  championshipOrder: string[];
}

function createMatch(
  id: string,
  round: number,
  slot: number,
  homeTeam: string | null,
  awayTeam: string | null,
  feederIds: string[] | null,
  userClub: string
): BracketMatch {
  const ready = homeTeam !== null && awayTeam !== null;
  return {
    id,
    round,
    slot,
    homeTeam,
    awayTeam,
    homeScore: null,
    awayScore: null,
    winner: null,
    loser: null,
    status: ready ? "ready" : "pending",
    isUserMatch: homeTeam === userClub || awayTeam === userClub,
    feederIds,
    userFixture: null,
    scoringDetail: null,
    matchEvents: null,
  };
}

/**
 * Standard 8-seed Last 16 home slots so top seeds are protected and meet late.
 * Index = bracket slot; value = seed rank (0 = best).
 */
const LAST_16_SEED_SLOT_ORDER = [0, 7, 3, 4, 1, 6, 2, 5] as const;

function orderFromStandings(
  standings: CupSeedingStanding[] | undefined,
  fallback: string[]
): string[] {
  if (!standings?.length) return [...fallback];
  const byPos = [...standings].sort((a, b) => a.position - b.position);
  const ordered = byPos.map((s) => s.team);
  const seen = new Set(ordered);
  for (const club of fallback) {
    if (!seen.has(club)) ordered.push(club);
  }
  return ordered.filter((club, i, all) => all.indexOf(club) === i);
}

/** Default Super League order when no prior season table exists (best first). */
export function defaultSuperLeagueSeedingOrder(): string[] {
  return [...CURRENT_PLAYABLE_CLUBS].sort(
    (a, b) => getClubBaseStrength(b) - getClubBaseStrength(a)
  );
}

/** Default Championship order when no prior season table exists (best first). */
export function defaultChampionshipSeedingOrder(): string[] {
  return [...CHAMPIONSHIP_CLUBS]
    .sort((a, b) => b.baseStrength - a.baseStrength)
    .map((c) => c.name);
}

export function resolveCupSeedingContext(input: {
  previousSeasonLeagueTable?: CupSeedingStanding[] | null;
  previousSeasonChampionshipTable?: CupSeedingStanding[] | null;
}): CupSeedingContext & { seedingSource: "previous_season" | "default_strength" } {
  const hasSl = Boolean(input.previousSeasonLeagueTable?.length);
  const hasChamp = Boolean(input.previousSeasonChampionshipTable?.length);
  return {
    superLeagueOrder: orderFromStandings(
      input.previousSeasonLeagueTable ?? undefined,
      defaultSuperLeagueSeedingOrder()
    ),
    championshipOrder: orderFromStandings(
      input.previousSeasonChampionshipTable ?? undefined,
      defaultChampionshipSeedingOrder()
    ),
    seedingSource:
      hasSl || hasChamp ? "previous_season" : "default_strength",
  };
}

export interface ExpandedCupMeta {
  schemaVersion: 2 | 3 | 4;
  /**
   * Championship clubs with a bye into Round Two.
   * Empty when all Championship clubs play Round One.
   */
  roundOneByes: string[];
  /** Championship clubs drawn into Round One ties (seeded pairing). */
  roundOneParticipants: string[];
  /** Super League clubs with a bye into the Last 16 (top prior finishers). */
  roundTwoByes?: string[];
  /** Seeding basis note for UI / debugging. */
  seedingSource?: "previous_season" | "default_strength";
}

export type ExpandedChallengeCupState = ChallengeCupBracketState & {
  expandedMeta: ExpandedCupMeta;
};

/**
 * Create the expanded Challenge Cup bracket.
 * Top Super League finishers (year-on-year) are seeded into Last 16 byes;
 * lower finishers enter Round Two. Championship Round One is seeded 1v20, 2v19, …
 */
export function createExpandedChallengeCupBracket(
  seed: string,
  userClub: string,
  seedingInput?: {
    previousSeasonLeagueTable?: CupSeedingStanding[] | null;
    previousSeasonChampionshipTable?: CupSeedingStanding[] | null;
  }
): ExpandedChallengeCupState {
  const resolved = resolveCupSeedingContext(seedingInput ?? {});

  const championshipOrder = resolved.championshipOrder.filter((name) =>
    CHAMPIONSHIP_CLUB_NAMES.includes(name)
  );
  for (const name of CHAMPIONSHIP_CLUB_NAMES) {
    if (!championshipOrder.includes(name)) championshipOrder.push(name);
  }
  if (championshipOrder.length !== 20) {
    throw new Error(
      `Challenge Cup needs 20 Championship clubs, got ${championshipOrder.length}`
    );
  }

  const superLeagueOrder = resolved.superLeagueOrder.filter((name) =>
    (CURRENT_PLAYABLE_CLUBS as readonly string[]).includes(name)
  );
  for (const name of CURRENT_PLAYABLE_CLUBS) {
    if (!superLeagueOrder.includes(name)) superLeagueOrder.push(name);
  }
  if (superLeagueOrder.length !== 14) {
    throw new Error(
      `Challenge Cup needs 14 Super League clubs, got ${superLeagueOrder.length}`
    );
  }

  for (const name of [...championshipOrder, ...superLeagueOrder]) {
    if (/\bNRL\b/i.test(name) || name.includes("(NRL)")) {
      throw new Error(`NRL club cannot enter Challenge Cup: ${name}`);
    }
  }

  // Top 8 SL (best prior finish) bye to Last 16 — seeded last into protected slots.
  const roundTwoByes = superLeagueOrder.slice(0, 8);
  // Bottom 6 SL enter Round Two.
  const roundTwoSuperLeague = superLeagueOrder.slice(8);

  // Championship Round One: seed 1 vs 20, 2 vs 19, … (best plays lowest).
  const roundOneParticipants = [...championshipOrder];
  const roundOneByes: string[] = [];

  const matches: BracketMatch[] = [];

  for (let i = 0; i < 10; i++) {
    const home = championshipOrder[i]!;
    const away = championshipOrder[19 - i]!;
    matches.push(
      createMatch(`1-${i}`, 1, i, home, away, null, userClub)
    );
  }

  // Round Two: 6× (SL entrant vs R1 feeder) + 2× (R1 vs R1).
  const r1Feeders = Array.from({ length: 10 }, (_, i) => `1-${i}`);
  const slEnteringR2 = [...roundTwoSuperLeague];

  for (let i = 0; i < 6; i++) {
    matches.push(
      createMatch(
        `2-${i}`,
        2,
        i,
        slEnteringR2[i]!,
        null,
        [r1Feeders[i]!],
        userClub
      )
    );
  }
  matches.push(
    createMatch("2-6", 2, 6, null, null, [r1Feeders[6]!, r1Feeders[7]!], userClub),
    createMatch("2-7", 2, 7, null, null, [r1Feeders[8]!, r1Feeders[9]!], userClub)
  );

  // Last 16: place top seeds into protected bracket slots (seeded last).
  const seededByes: (string | null)[] = Array.from({ length: 8 }, () => null);
  for (let seedRank = 0; seedRank < 8; seedRank++) {
    const slot = LAST_16_SEED_SLOT_ORDER[seedRank]!;
    seededByes[slot] = roundTwoByes[seedRank]!;
  }

  for (let i = 0; i < 8; i++) {
    matches.push(
      createMatch(
        `3-${i}`,
        3,
        i,
        seededByes[i]!,
        null,
        [`2-${i}`],
        userClub
      )
    );
  }

  for (let i = 0; i < 4; i++) {
    matches.push(
      createMatch(
        `4-${i}`,
        4,
        i,
        null,
        null,
        [`3-${i * 2}`, `3-${i * 2 + 1}`],
        userClub
      )
    );
  }

  for (let i = 0; i < 2; i++) {
    matches.push(
      createMatch(
        `5-${i}`,
        5,
        i,
        null,
        null,
        [`4-${i * 2}`, `4-${i * 2 + 1}`],
        userClub
      )
    );
  }

  matches.push(
    createMatch("6-0", 6, 0, null, null, ["5-0", "5-1"], userClub)
  );

  const expandedMeta: ExpandedCupMeta = {
    schemaVersion: 4,
    roundOneByes,
    roundOneParticipants,
    roundTwoByes,
    seedingSource: resolved.seedingSource,
  };

  return {
    seed,
    userClub,
    byeTeams: [roundTwoByes[0]!, roundTwoByes[1]!],
    matches,
    simState: { form: 0, seasonDropGoals: 0 },
    userEliminated: false,
    tournamentComplete: false,
    userWon: false,
    expandedMeta,
  };
}

export function isExpandedChallengeCup(
  cup: ChallengeCupBracketState
): cup is ExpandedChallengeCupState {
  const meta = (cup as Partial<ExpandedChallengeCupState>).expandedMeta;
  const v = meta?.schemaVersion;
  return v === 2 || v === 3 || v === 4;
}

export function getExpandedCupRoundLabel(round: number): string {
  return EXPANDED_CUP_ROUND_LABELS[round] ?? `Round ${round}`;
}

/** Snapshot standings for cup seeding (position 1 = top). */
export function standingsToCupSeeding(
  rows: { team: string; position: number }[] | undefined | null
): CupSeedingStanding[] {
  if (!rows?.length) return [];
  return rows.map((r) => ({ team: r.team, position: r.position }));
}
