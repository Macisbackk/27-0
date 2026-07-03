import { getPlayerById } from "../players";
import type { Position } from "../types";
import type { ManagerCareer } from "./types";
import { reconcileRoundMatches } from "./managerFixtures";
import { getManagerPlayer } from "./managerPlayers";
import { buildOpponentTryScoringDetail } from "./managerOpponentScoring";

export interface LeagueTryScorerLeader {
  playerId: string;
  playerName: string;
  club: string;
  tries: number;
  position: Position | null;
  isUserClub: boolean;
}

function addTryScorers(
  tally: Map<string, { tries: number; club: string; name: string }>,
  club: string,
  scorers: { playerId: string; name: string; tries: number }[]
): void {
  for (const scorer of scorers) {
    if (scorer.tries <= 0) continue;
    const existing = tally.get(scorer.playerId);
    if (existing) {
      existing.tries += scorer.tries;
    } else {
      tally.set(scorer.playerId, {
        tries: scorer.tries,
        club,
        name: scorer.name,
      });
    }
  }
}

/** League-wide try chart — user scorers from real fixtures, AI from simulated round results. */
export function getLeagueTopTryScorers(
  career: ManagerCareer,
  limit = 10
): LeagueTryScorerLeader[] {
  const synced = reconcileRoundMatches(career);
  const tally = new Map<string, { tries: number; club: string; name: string }>();

  for (const match of synced.roundMatches ?? []) {
    const fixtureKey = `league-r${match.round}-${match.homeTeam}-vs-${match.awayTeam}`;

    if (match.homeTeam !== synced.club && match.homeTries > 0) {
      addTryScorers(
        tally,
        match.homeTeam,
        buildOpponentTryScoringDetail(
          match.homeTeam,
          match.homeTries,
          synced.seed,
          match.round,
          undefined,
          fixtureKey,
          synced
        )
      );
    }

    if (match.awayTeam !== synced.club && match.awayTries > 0) {
      addTryScorers(
        tally,
        match.awayTeam,
        buildOpponentTryScoringDetail(
          match.awayTeam,
          match.awayTries,
          synced.seed,
          match.round,
          undefined,
          fixtureKey,
          synced
        )
      );
    }
  }

  for (const fixture of synced.fixtures) {
    if ((fixture.competition ?? "league") !== "league") continue;
    addTryScorers(
      tally,
      synced.club,
      fixture.scoringDetail?.dreamTeam.tryScorers ?? []
    );
  }

  return [...tally.entries()]
    .filter(([, entry]) => entry.tries > 0)
    .sort(
      (a, b) =>
        b[1].tries - a[1].tries ||
        a[1].name.localeCompare(b[1].name, undefined, { sensitivity: "base" })
    )
    .slice(0, limit)
    .map(([playerId, entry]) => {
      const player =
        getManagerPlayer(synced, playerId) ?? getPlayerById(playerId);
      return {
        playerId,
        playerName: entry.name || player?.name || "Unknown",
        club: entry.club,
        tries: entry.tries,
        position: player?.position ?? null,
        isUserClub: entry.club === synced.club,
      };
    });
}
