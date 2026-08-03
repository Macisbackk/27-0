import seedrandom from "seedrandom";
import { CURRENT_PLAYABLE_CLUBS } from "../../clubs/super-league-display";
import { CHAMPIONSHIP_CLUB_NAMES } from "../../clubs/championship-clubs";
import type {
  BracketMatch,
  ChallengeCupBracketState,
} from "../../game/challenge-cup-bracket";

export const CHALLENGE_CUP_SCHEMA_VERSION = 2;

/**
 * Expanded Challenge Cup (schema v2):
 * Round 1 preliminary — 2 Championship ties + 16 byes
 * Round 2 — 32 clubs (18 Champ + 14 Super League)
 * Round 3 — Last 16
 * Round 4 — Quarter-finals
 * Round 5 — Semi-finals
 * Round 6 — Final
 */
export const EXPANDED_CUP_ROUND_LABELS: Record<number, string> = {
  1: "Round One",
  2: "Round Two",
  3: "Last 16",
  4: "Quarter-Final",
  5: "Semi-Final",
  6: "Final",
};

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
  return arr;
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

export interface ExpandedCupMeta {
  schemaVersion: 2;
  /** 16 Championship clubs with a bye to Round Two. */
  roundOneByes: string[];
  /** Four Championship clubs drawn into two Round One ties. */
  roundOneParticipants: [string, string, string, string];
}

export type ExpandedChallengeCupState = ChallengeCupBracketState & {
  expandedMeta: ExpandedCupMeta;
};

/**
 * Create the expanded 2026 Challenge Cup bracket.
 * Super League clubs enter at Round Two only. No NRL clubs.
 */
export function createExpandedChallengeCupBracket(
  seed: string,
  userClub: string
): ExpandedChallengeCupState {
  const rng = seedrandom(`${seed}-expanded-cup-v2`);
  const championship = shuffle(CHAMPIONSHIP_CLUB_NAMES, rng);
  if (championship.length !== 20) {
    throw new Error(
      `Challenge Cup needs 20 Championship clubs, got ${championship.length}`
    );
  }

  const roundOneParticipants = championship.slice(0, 4) as [
    string,
    string,
    string,
    string,
  ];
  const roundOneByes = championship.slice(4);

  const superLeague = shuffle([...CURRENT_PLAYABLE_CLUBS], rng);
  if (superLeague.length !== 14) {
    throw new Error(
      `Challenge Cup needs 14 Super League clubs, got ${superLeague.length}`
    );
  }

  for (const name of [...championship, ...superLeague]) {
    if (/\bNRL\b/i.test(name) || name.includes("(NRL)")) {
      throw new Error(`NRL club cannot enter Challenge Cup: ${name}`);
    }
  }

  const matches: BracketMatch[] = [];

  matches.push(
    createMatch(
      "1-0",
      1,
      0,
      roundOneParticipants[0],
      roundOneParticipants[1],
      null,
      userClub
    ),
    createMatch(
      "1-1",
      1,
      1,
      roundOneParticipants[2],
      roundOneParticipants[3],
      null,
      userClub
    )
  );

  const roundTwoChampFixed = shuffle(
    roundOneByes,
    seedrandom(`${seed}-r2-champ`)
  );
  const r2PoolFixed = shuffle(
    [...roundTwoChampFixed, ...superLeague],
    seedrandom(`${seed}-r2-pool`)
  );
  const pool = [...r2PoolFixed];

  matches.push(
    createMatch("2-0", 2, 0, pool.shift() ?? null, null, ["1-0"], userClub),
    createMatch("2-1", 2, 1, pool.shift() ?? null, null, ["1-1"], userClub)
  );

  for (let i = 0; i < 14; i++) {
    const t1 = pool.shift() ?? null;
    const t2 = pool.shift() ?? null;
    matches.push(createMatch(`2-${i + 2}`, 2, i + 2, t1, t2, null, userClub));
  }

  for (let i = 0; i < 8; i++) {
    matches.push(
      createMatch(
        `3-${i}`,
        3,
        i,
        null,
        null,
        [`2-${i * 2}`, `2-${i * 2 + 1}`],
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
    schemaVersion: 2,
    roundOneByes,
    roundOneParticipants,
  };

  return {
    seed,
    userClub,
    byeTeams: [roundOneByes[0]!, roundOneByes[1]!],
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
  return meta?.schemaVersion === 2;
}

export function getExpandedCupRoundLabel(round: number): string {
  return EXPANDED_CUP_ROUND_LABELS[round] ?? `Round ${round}`;
}
