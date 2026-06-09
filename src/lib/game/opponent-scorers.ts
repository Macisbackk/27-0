import seedrandom from "seedrandom";
import { getPlayersByClub } from "../players";
import type { Player, Position } from "../types";
import type {
  FixtureKicking,
  FixtureTryScorer,
  MatchFixture,
  TeamScoringDetail,
} from "./season-simulation";
import { allocateMatchTries } from "./try-allocation";
import { getPlayerTryWeight } from "./try-weights";

/** Opponent XIII positions for try allocation. */
const OPPONENT_LINEUP: Position[] = [
  "FULLBACK",
  "WING",
  "WING",
  "CENTRE",
  "CENTRE",
  "STAND_OFF",
  "SCRUM_HALF",
  "PROP",
  "HOOKER",
  "PROP",
  "SECOND_ROW",
  "SECOND_ROW",
  "LOOSE_FORWARD",
];

/**
 * Select a match-day XIII from the opponent club's database
 * (current, historic, and legends assigned to that club).
 */
export function selectClubMatchSquad(
  club: string,
  seed: string,
  round: number
): Player[] {
  const pool = getPlayersByClub(club);
  if (pool.length === 0) return [];

  const rng = seedrandom(`${seed}-opp-squad-${round}-${club}`);
  const used = new Set<string>();
  const squad: Player[] = [];

  for (const position of OPPONENT_LINEUP) {
    let candidates = pool.filter(
      (p) => p.position === position && !used.has(p.id)
    );
    if (candidates.length === 0) {
      candidates = pool.filter((p) => !used.has(p.id));
    }
    if (candidates.length === 0) break;

    const pick = candidates[Math.floor(rng() * candidates.length)];
    used.add(pick.id);
    squad.push(pick);
  }

  return squad;
}

function pickKicker(squad: Player[]): Player | null {
  const halves = squad.filter(
    (p) => p.position === "SCRUM_HALF" || p.position === "STAND_OFF"
  );
  if (halves.length === 0) return squad[0] ?? null;
  return halves.sort((a, b) => b.peakRating - a.peakRating)[0];
}

/** Build opponent scoring from club player pool + simulated match breakdown. */
export function buildOpponentScoringDetail(
  fixture: MatchFixture,
  seed: string
): TeamScoringDetail {
  const squad = selectClubMatchSquad(fixture.opponent, seed, fixture.round);

  if (squad.length === 0) {
    return { tryScorers: [], kicking: null };
  }

  const rng = seedrandom(`${seed}-opp-scorers-${fixture.round}`);
  const weights = squad.map((p) => getPlayerTryWeight(p));
  const alloc = allocateMatchTries(fixture.triesAgainst, weights, rng);

  const tryScorers: FixtureTryScorer[] = squad
    .map((p, i) => ({
      playerId: p.id,
      name: p.name,
      tries: alloc[i],
    }))
    .filter((s) => s.tries > 0);

  const kicker = pickKicker(squad);
  const scoring = fixture.scoringAgainst;

  const kicking: FixtureKicking | null = kicker
    ? {
        playerId: kicker.id,
        name: kicker.name,
        conversions: scoring.conversions,
        conversionAttempts: scoring.tries,
        penalties: scoring.penalties,
        dropGoals: scoring.dropGoals,
      }
    : null;

  return { tryScorers, kicking };
}
