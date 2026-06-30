import seedrandom from "seedrandom";
import type { SquadSlot } from "../types";
import type { MatchFixture } from "../game/season-simulation";
import { enrichFantasyFixtureSummary } from "../game/fantasy-match-summary";
import { getOpponentMatchRating } from "../game/opponent-scorers";
import { selectClubMatchSquad } from "../game/opponent-scorers";
import type { ManagerTactics } from "./types";
import {
  getAttackFocusTryMultiplier,
  getDefenceConcedeMultiplier,
  getPlayingStyleTryMultiplier,
} from "./managerTacticsScoring";
import { getPlayerEligiblePositions } from "../players/player-positions";
import type { Position } from "../types";

interface SquadEntry {
  player: NonNullable<SquadSlot["player"]>;
  playedPosition: Position;
  slot: SquadSlot;
}

function pickKicker(entries: SquadEntry[]): SquadEntry | null {
  const halves = entries.filter(
    (e) =>
      e.playedPosition === "SCRUM_HALF" || e.playedPosition === "STAND_OFF"
  );
  if (halves.length === 0) return entries[0] ?? null;
  return halves.sort((a, b) => b.player.peakRating - a.player.peakRating)[0]!;
}

function allocateTries(
  totalTries: number,
  weights: number[],
  rng: () => number
): number[] {
  const alloc = new Array(weights.length).fill(0);
  for (let t = 0; t < totalTries; t++) {
    const sum = weights.reduce((a, b) => a + b, 0);
    if (sum <= 0) break;
    let roll = rng() * sum;
    for (let i = 0; i < weights.length; i++) {
      roll -= weights[i]!;
      if (roll <= 0) {
        alloc[i]++;
        break;
      }
    }
  }
  return alloc;
}

function buildUserWeights(
  entries: SquadEntry[],
  tactics: ManagerTactics,
  rng: () => number
): number[] {
  return entries.map((e) => {
    const style = getPlayingStyleTryMultiplier(
      tactics.playingStyle,
      e.playedPosition
    );
    const attack = getAttackFocusTryMultiplier(
      tactics.attackFocus,
      e.playedPosition
    );
    const rating = e.player.rating ?? e.player.peakRating;
    const variance = 0.85 + rng() * 0.3;
    return Math.max(0.1, rating * style * attack * variance);
  });
}

function buildOpponentWeights(
  opponentPlayers: { id: string; name: string; position: Position; rating: number }[],
  tactics: ManagerTactics,
  rng: () => number
): number[] {
  return opponentPlayers.map((p) => {
    const def = getDefenceConcedeMultiplier(tactics.defenceFocus, p.position);
    const variance = 0.85 + rng() * 0.3;
    return Math.max(0.1, p.rating * def * variance);
  });
}

/** Manager-specific scoring with tactic-weighted try scorers. */
export function enrichManagerFixtureScoring(
  squad: SquadSlot[],
  fixture: MatchFixture,
  seed: string,
  tactics: ManagerTactics,
  opponentOptions?: { currentSeasonOnly?: boolean }
): void {
  const entries: SquadEntry[] = squad
    .filter((s) => s.player)
    .map((s) => ({
      player: s.player!,
      playedPosition: s.position,
      slot: s,
    }));

  if (entries.length === 0) return;

  const rng = seedrandom(`${seed}-mgr-tries-r${fixture.round}`);
  const userWeights = buildUserWeights(entries, tactics, rng);
  const userAlloc = allocateTries(fixture.triesFor, userWeights, rng);

  const oppSquad = selectClubMatchSquad(
    fixture.opponent,
    seed,
    fixture.round,
    opponentOptions
  );
  const oppEntries = oppSquad.map((p) => ({
    id: p.id,
    name: p.name,
    position: getPlayerEligiblePositions(p)[0] ?? p.position,
    rating: p.rating ?? p.peakRating,
  }));
  const oppWeights = buildOpponentWeights(oppEntries, tactics, rng);
  const oppAlloc = allocateTries(fixture.triesAgainst, oppWeights, rng);

  const userKicker = pickKicker(entries);
  const scoringFor = fixture.scoringFor;
  const scoringAgainst = fixture.scoringAgainst;

  fixture.scoringDetail = {
    dreamTeam: {
      tryScorers: entries
        .map((e, i) => ({
          playerId: e.player.id,
          name: e.player.name,
          tries: userAlloc[i] ?? 0,
        }))
        .filter((s) => s.tries > 0),
      kicking: userKicker
        ? {
            playerId: userKicker.player.id,
            name: userKicker.player.name,
            conversions: scoringFor.conversions,
            conversionAttempts: scoringFor.tries,
            penalties: scoringFor.penalties,
            dropGoals: scoringFor.dropGoals,
          }
        : null,
    },
    opponent: {
      tryScorers: oppEntries
        .map((p, i) => ({
          playerId: p.id,
          name: p.name,
          tries: oppAlloc[i] ?? 0,
        }))
        .filter((s) => s.tries > 0),
      kicking:
        oppEntries.length > 0
          ? {
              playerId: oppEntries[0]!.id,
              name: oppEntries[0]!.name,
              conversions: scoringAgainst.conversions,
              conversionAttempts: scoringAgainst.tries,
              penalties: scoringAgainst.penalties,
              dropGoals: scoringAgainst.dropGoals,
            }
          : null,
    },
  };

  enrichFantasyFixtureSummary(fixture, squad, seed);
}

export function getMatchPrediction(
  userRating: number,
  opponentRating: number,
  isHome: boolean
): string {
  const homeBonus = isHome ? 2 : 0;
  const gap = userRating + homeBonus - opponentRating;
  if (gap >= 8) return "You should win comfortably";
  if (gap >= 4) return "Favourites on paper";
  if (gap >= -3) return "Tight contest";
  if (gap >= -7) return "Underdogs — upset possible";
  return "Heavy underdogs";
}

export function pickMotmPlayerId(
  fixture: MatchFixture,
  xiiiIds: string[]
): string | null {
  const scorers = fixture.scoringDetail?.dreamTeam.tryScorers ?? [];
  const multi = scorers.find((s) => s.tries >= 2);
  if (multi) return multi.playerId;
  if (scorers[0]) return scorers[0].playerId;
  return xiiiIds[0] ?? null;
}
