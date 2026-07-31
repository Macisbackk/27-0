import { getPlayerById } from "../players";
import type { Position } from "../types";
import type { ManagerCareer } from "./types";
import { reconcileRoundMatches } from "./managerFixtures";
import { getManagerPlayer } from "./managerPlayers";
import { buildOpponentTryScoringDetail } from "./managerOpponentScoring";
import { isInvalidPlayerName } from "./managerPlayerNameGuards";

export interface LeagueTryScorerLeader {
  playerId: string;
  playerName: string;
  club: string;
  tries: number;
  position: Position | null;
  isUserClub: boolean;
}

function isValidScorerEntry(
  playerId: string,
  name: string,
  club: string,
  teamNames: string[]
): boolean {
  if (isInvalidPlayerName(name, teamNames)) return false;
  if (isInvalidPlayerName(playerId, teamNames)) return false;
  if (playerId === club || name === club) return false;
  return true;
}

function addTryScorers(
  tally: Map<string, { tries: number; club: string; name: string }>,
  club: string,
  scorers: { playerId: string; name: string; tries: number }[],
  teamNames: string[]
): void {
  for (const scorer of scorers) {
    if (scorer.tries <= 0) continue;
    if (!isValidScorerEntry(scorer.playerId, scorer.name, club, teamNames)) {
      continue;
    }
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
  const teamNames = Array.from(
    new Set([
      synced.club,
      ...(synced.roundMatches ?? []).flatMap((m) => [m.homeTeam, m.awayTeam]),
      ...synced.fixtures.map((f) => f.opponent),
    ])
  );

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
        ),
        teamNames
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
        ),
        teamNames
      );
    }
  }

  for (const fixture of synced.fixtures) {
    if ((fixture.competition ?? "league") !== "league") continue;
    addTryScorers(
      tally,
      synced.club,
      fixture.scoringDetail?.dreamTeam.tryScorers ?? [],
      teamNames
    );
  }

  return [...tally.entries()]
    .filter(([playerId, entry]) => {
      if (entry.tries <= 0) return false;
      return isValidScorerEntry(playerId, entry.name, entry.club, teamNames);
    })
    .sort(
      (a, b) =>
        b[1].tries - a[1].tries ||
        a[1].name.localeCompare(b[1].name, undefined, { sensitivity: "base" })
    )
    .slice(0, limit)
    .map(([playerId, entry]) => {
      const player =
        getManagerPlayer(synced, playerId) ?? getPlayerById(playerId);
      const resolvedName = player?.name ?? entry.name;
      if (isInvalidPlayerName(resolvedName, teamNames)) return null;
      return {
        playerId,
        playerName: resolvedName,
        club: entry.club,
        tries: entry.tries,
        position: player?.position ?? null,
        isUserClub: entry.club === synced.club,
      };
    })
    .filter((row): row is LeagueTryScorerLeader => row != null);
}
