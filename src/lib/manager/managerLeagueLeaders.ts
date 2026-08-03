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

/**
 * Championship try chart — aggregate from saved championshipCompetition match details.
 * Deterministic: only reads persisted scorers (no re-simulation).
 */
export function getChampionshipTopTryScorers(
  career: ManagerCareer,
  limit = 10
): LeagueTryScorerLeader[] {
  const fixtures = career.championshipCompetition?.fixtures ?? [];
  const tally = new Map<string, { tries: number; club: string; name: string }>();
  const appearanceGames = new Map<string, number>();
  const teamNames = Array.from(
    new Set(fixtures.flatMap((f) => [f.homeTeam, f.awayTeam]))
  );

  for (const fixture of fixtures) {
    if (!fixture.played || !fixture.matchDetail) continue;

    addTryScorers(
      tally,
      fixture.homeTeam,
      fixture.matchDetail.home.tryScorers,
      teamNames
    );
    addTryScorers(
      tally,
      fixture.awayTeam,
      fixture.matchDetail.away.tryScorers,
      teamNames
    );

    for (const scorer of fixture.matchDetail.home.tryScorers) {
      if (scorer.tries > 0) {
        appearanceGames.set(
          scorer.playerId,
          (appearanceGames.get(scorer.playerId) ?? 0) + 1
        );
      }
    }
    for (const scorer of fixture.matchDetail.away.tryScorers) {
      if (scorer.tries > 0) {
        appearanceGames.set(
          scorer.playerId,
          (appearanceGames.get(scorer.playerId) ?? 0) + 1
        );
      }
    }
  }

  return [...tally.entries()]
    .filter(([playerId, entry]) => {
      if (entry.tries <= 0) return false;
      return isValidScorerEntry(playerId, entry.name, entry.club, teamNames);
    })
    .sort((a, b) => {
      const triesDiff = b[1].tries - a[1].tries;
      if (triesDiff !== 0) return triesDiff;
      const appDiff =
        (appearanceGames.get(a[0]) ?? 99) - (appearanceGames.get(b[0]) ?? 99);
      if (appDiff !== 0) return appDiff;
      const playerA = getPlayerById(a[0]);
      const playerB = getPlayerById(b[0]);
      const ratingDiff =
        (playerB?.peakRating ?? 0) - (playerA?.peakRating ?? 0);
      if (ratingDiff !== 0) return ratingDiff;
      return a[1].name.localeCompare(b[1].name, undefined, {
        sensitivity: "base",
      });
    })
    .slice(0, limit)
    .map(([playerId, entry]) => {
      const player =
        getManagerPlayer(career, playerId) ?? getPlayerById(playerId);
      const resolvedName = player?.name ?? entry.name;
      if (isInvalidPlayerName(resolvedName, teamNames)) return null;
      return {
        playerId,
        playerName: resolvedName,
        club: entry.club,
        tries: entry.tries,
        position: player?.position ?? null,
        isUserClub: entry.club === career.club,
      };
    })
    .filter((row): row is LeagueTryScorerLeader => row != null);
}
