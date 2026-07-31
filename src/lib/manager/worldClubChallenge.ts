import seedrandom from "seedrandom";
import type {
  LiveMatchEvent,
  ManagerCareer,
  ManagerCompetition,
  ManagerScheduledFixture,
  WorldClubChallengeFixture,
  WorldClubChallengeResult,
} from "./types";
import { generateSimulatedMatchEvents } from "./matchEventGenerator";
import { validateMatchEvents } from "../game/validateMatchEvents";
import type { MatchEventType } from "../game/match-events";
import { pickWinningMargin, snapToRLScore } from "../game/rl-scores";
import { SUPER_LEAGUE_CLUBS } from "../clubs";
import {
  generateNrlSquadNames,
  getNrlClubByName,
  isNrlClubName,
  NRL_WORLD_CLUB_CHALLENGE_TEAMS,
} from "../nrl/nrlClubs";

export {
  generateNrlSquadNames,
  NRL_WORLD_CLUB_CHALLENGE_TEAMS,
} from "../nrl/nrlClubs";

export function rollNrlChampionRating(
  rng: () => number,
  clubName?: string
): number {
  if (clubName) {
    const club = getNrlClubByName(clubName);
    if (club) {
      const base =
        club.strengthTier === 1
          ? 84
          : club.strengthTier === 2
            ? 86
            : club.strengthTier === 3
              ? 89
              : club.strengthTier === 4
                ? 91
                : 93;
      const jitter = Math.floor(rng() * 4) - 1;
      return Math.max(84, Math.min(95, base + jitter));
    }
  }
  const roll = rng() * 100;
  if (roll < 30) return 86 + Math.floor(rng() * 3);
  if (roll < 85) return 89 + Math.floor(rng() * 4);
  return 93 + Math.floor(rng() * 3);
}

export function pickNrlChampion(seed: string, seasonYear: number): string {
  const rng = seedrandom(`${seed}-nrl-champ-${seasonYear}`);
  return NRL_WORLD_CLUB_CHALLENGE_TEAMS[
    Math.floor(rng() * NRL_WORLD_CLUB_CHALLENGE_TEAMS.length)
  ]!;
}

export function isNrlWorldClubChallengeTeam(name: string): boolean {
  return isNrlClubName(name);
}

export function isValidWorldClubChallengeFixture(
  fixture: Pick<WorldClubChallengeFixture, "nrlChampionName" | "superLeagueChampionName">
): boolean {
  if (!isNrlWorldClubChallengeTeam(fixture.nrlChampionName)) return false;
  if (fixture.nrlChampionName === fixture.superLeagueChampionName) return false;
  const isSuperLeague = SUPER_LEAGUE_CLUBS.some(
    (c) => c.name === fixture.nrlChampionName
  );
  return !isSuperLeague;
}

/** Repair invalid WCC fixtures (e.g. old saves with Super League as NRL opponent). */
export function sanitizeWorldClubChallengeState(
  career: ManagerCareer
): ManagerCareer {
  const state = career.worldClubChallenge;
  if (!state) return career;

  let currentFixture = state.currentFixture;
  if (currentFixture && !isValidWorldClubChallengeFixture(currentFixture)) {
    const nrlChampion = pickNrlChampion(career.seed, career.seasonYear);
    const rng = seedrandom(
      `${career.seed}-wcc-repair-${career.seasonYear}-${nrlChampion}`
    );
    currentFixture = {
      ...currentFixture,
      nrlChampionName: nrlChampion,
      nrlChampionId: getNrlClubByName(nrlChampion)?.id,
      nrlChampionRating: rollNrlChampionRating(rng, nrlChampion),
    };
  }

  const history = (state.history ?? []).map((r) => {
    if (isNrlWorldClubChallengeTeam(r.nrlChampionName)) return r;
    const nrlChampion = pickNrlChampion(
      career.seed,
      r.seasonYear
    );
    return {
      ...r,
      nrlChampionName: nrlChampion,
      storySummary: r.storySummary.replace(
        r.nrlChampionName,
        nrlChampion
      ),
    };
  });

  return {
    ...career,
    worldClubChallenge: {
      history,
      currentFixture,
    },
  };
}

export function getPreviousSeasonChampion(
  career: ManagerCareer
): { name: string; seasonYear: number } | null {
  if (career.previousSeasonChampion) {
    return {
      name: career.previousSeasonChampion,
      seasonYear: career.seasonYear - 1,
    };
  }

  for (let i = career.seasonHistory.length - 1; i >= 0; i--) {
    const season = career.seasonHistory[i]!;
    if (
      season.playoffFinish === "Super League Champions" ||
      season.trophies.includes("Super League Champions")
    ) {
      return { name: career.club, seasonYear: season.seasonYear };
    }
  }

  const last = career.seasonHistory[career.seasonHistory.length - 1];
  if (!last) return null;
  return {
    name: pickAiSuperLeagueChampion(career, last.seasonYear),
    seasonYear: last.seasonYear,
  };
}

function pickAiSuperLeagueChampion(
  career: ManagerCareer,
  seasonYear: number
): string {
  const rng = seedrandom(`${career.seed}-sl-champ-${seasonYear}`);
  const clubs = Object.keys(career.clubFunds ?? {}).filter((c) => c !== career.club);
  if (clubs.length === 0) return "Wigan Warriors";
  return clubs[Math.floor(rng() * clubs.length)]!;
}

/** Grand Final winner from the completed play-off bracket, if available. */
export function getPlayoffGrandFinalWinner(
  career: ManagerCareer
): string | null {
  const gf = career.playoffs?.matches.find(
    (m) => m.round === 3 && m.status === "complete" && m.winner
  );
  return gf?.winner ?? null;
}

/** Resolve the Super League champion recorded when advancing to a new season. */
export function resolveSeasonChampionForAdvance(career: ManagerCareer): string {
  const gfWinner = getPlayoffGrandFinalWinner(career);
  if (gfWinner) return gfWinner;

  if (career.playoffs?.finish === "Super League Champions") {
    return career.club;
  }

  if (career.previousSeasonChampion) {
    return career.previousSeasonChampion;
  }

  return pickAiSuperLeagueChampion(career, career.seasonYear);
}

export function buildWorldClubChallengeScheduledFixture(
  wcc: WorldClubChallengeFixture
): ManagerScheduledFixture {
  return {
    id: wcc.id,
    round: 3,
    opponent: wcc.nrlChampionName,
    isHome: true,
    competition: "world_club_challenge",
    label: "World Club Challenge",
  };
}

/** True when career has completed at least one season (second season onwards). */
export function shouldScheduleWorldClubChallenge(
  career: ManagerCareer
): boolean {
  return career.seasonHistory.length >= 1;
}

export function createWorldClubChallengeFixture(
  career: ManagerCareer
): WorldClubChallengeFixture | null {
  if (!shouldScheduleWorldClubChallenge(career)) return null;

  const prev = getPreviousSeasonChampion(career);
  if (!prev) return null;

  const nrlChampion = pickNrlChampion(career.seed, career.seasonYear);
  const rng = seedrandom(
    `${career.seed}-wcc-rating-${career.seasonYear}-${nrlChampion}`
  );
  const userInvolved = prev.name === career.club;

  const fixture: WorldClubChallengeFixture = {
    id: `wcc-${career.seasonYear}`,
    seasonYear: career.seasonYear,
    gameWeek: 3,
    superLeagueChampionTeamId: prev.name,
    superLeagueChampionName: prev.name,
    nrlChampionName: nrlChampion,
    nrlChampionId: getNrlClubByName(nrlChampion)?.id,
    nrlChampionRating: rollNrlChampionRating(rng, nrlChampion),
    status: "scheduled",
    userInvolved,
  };

  if (!isValidWorldClubChallengeFixture(fixture)) {
    console.warn("[WCC] Invalid NRL opponent generated — regenerating", fixture);
    fixture.nrlChampionName = pickNrlChampion(
      `${career.seed}-retry`,
      career.seasonYear
    );
    fixture.nrlChampionId = getNrlClubByName(fixture.nrlChampionName)?.id;
    const repairRng = seedrandom(
      `${career.seed}-wcc-rating-retry-${career.seasonYear}-${fixture.nrlChampionName}`
    );
    fixture.nrlChampionRating = rollNrlChampionRating(
      repairRng,
      fixture.nrlChampionName
    );
  }

  return fixture;
}

function simulateScoreline(
  slRating: number,
  nrlRating: number,
  seed: string,
  fixtureId: string
): { home: number; away: number; homeTries: number; awayTries: number } {
  const rng = seedrandom(`${seed}-wcc-score-${fixtureId}`);
  const diff = slRating - nrlRating;
  let home = 12 + Math.floor(rng() * 18) + Math.round(diff * 0.4);
  let away = 14 + Math.floor(rng() * 20) - Math.round(diff * 0.3);
  home = snapToRLScore(Math.max(4, home), false);
  away = snapToRLScore(Math.max(6, away), false);
  if (home === away) {
    if (rng() < 0.5) home = snapToRLScore(home + pickWinningMargin(rng), false);
    else away = snapToRLScore(away + pickWinningMargin(rng), false);
  }
  const homeTries = Math.max(1, Math.round(home / 6));
  const awayTries = Math.max(1, Math.round(away / 6));
  return { home, away, homeTries, awayTries };
}

export function simulateWorldClubChallenge(
  career: ManagerCareer,
  fixture: WorldClubChallengeFixture,
  slTeamRating = 84
): WorldClubChallengeResult {
  const nrlSquad = generateNrlSquadNames(
    career.seed,
    fixture.nrlChampionName,
    13
  );
  const slScorers =
    fixture.userInvolved
      ? career.matchdayXiii
          .map((id) => career.squad.find((p) => p.playerId === id))
          .filter(Boolean)
          .slice(0, 5)
          .map((ps) => {
            const player = career.playerRegistry?.[ps!.playerId];
            return {
              name: player?.name ?? "Try scorer",
              playerId: ps!.playerId,
            };
          })
      : generateNrlSquadNames(
          career.seed,
          fixture.superLeagueChampionName,
          8
        );

  const scores = simulateScoreline(
    fixture.userInvolved ? slTeamRating : 86,
    fixture.nrlChampionRating,
    career.seed,
    fixture.id
  );

  const events = generateSimulatedMatchEvents({
    seed: career.seed,
    fixtureKey: fixture.id,
    userClub: fixture.superLeagueChampionName,
    opponent: fixture.nrlChampionName,
    userScore: scores.home,
    oppScore: scores.away,
    userTries: scores.homeTries,
    oppTries: scores.awayTries,
    userScorers: slScorers,
    opponentScorers: nrlSquad.map((p) => ({ name: p.name, playerId: p.id })),
    userKicker: slScorers[0]?.name,
    opponentKicker: nrlSquad[6]?.name ?? nrlSquad[0]?.name,
  });

  const validated = validateMatchEvents(
    events.map((e) => ({
      id: e.id ?? "",
      minute: e.minute,
      teamId: e.teamId ?? e.team,
      teamName:
        e.teamName ??
        (e.team === "user"
          ? fixture.superLeagueChampionName
          : fixture.nrlChampionName),
      playerName: e.playerName,
      kickerName: e.kickerName,
      type: e.type as MatchEventType,
      points: e.points,
      description: e.description,
      importance: e.importance ?? "medium",
    })),
    { id: "sl", name: fixture.superLeagueChampionName },
    { id: "nrl", name: fixture.nrlChampionName },
    {
      pickFallbackPlayer: (teamId) => {
        if (teamId === "user" || teamId === "sl") return slScorers[0]?.name;
        return nrlSquad[0]?.name;
      },
    }
  );

  const homeScore = validated.scoreFromEvents.home || scores.home;
  const awayScore = validated.scoreFromEvents.away || scores.away;
  const winnerName =
    homeScore > awayScore
      ? fixture.superLeagueChampionName
      : fixture.nrlChampionName;

  let userResult: WorldClubChallengeResult["userResult"] = "not_involved";
  if (fixture.userInvolved) {
    userResult = winnerName === career.club ? "won" : "lost";
  }

  const storySummary =
    homeScore > awayScore
      ? `${fixture.superLeagueChampionName} edged ${fixture.nrlChampionName} ${homeScore}–${awayScore} to lift the World Club Challenge.`
      : `${fixture.nrlChampionName} beat ${fixture.superLeagueChampionName} ${awayScore}–${homeScore} in the World Club Challenge.`;

  return {
    id: fixture.id,
    seasonYear: fixture.seasonYear,
    superLeagueChampionName: fixture.superLeagueChampionName,
    nrlChampionName: fixture.nrlChampionName,
    homeScore,
    awayScore,
    winnerName,
    userResult,
    events: validated.events.map((e) => ({
      id: e.id,
      minute: e.minute,
      type: e.type as LiveMatchEvent["type"],
      team: e.teamId === "user" || e.teamName === fixture.superLeagueChampionName
        ? "user"
        : "opponent",
      teamId: e.teamId,
      teamName: e.teamName,
      playerName: e.playerName,
      kickerName: e.kickerName,
      description: e.description,
      points: e.points ?? 0,
      importance: e.importance,
    })),
    storySummary,
  };
}

export function scheduleWorldClubChallengeForSeason(
  career: ManagerCareer
): ManagerCareer {
  const fixture = createWorldClubChallengeFixture(career);
  if (!fixture) {
    return {
      ...career,
      worldClubChallenge: {
        history: career.worldClubChallenge?.history ?? [],
        currentFixture: undefined,
      },
    };
  }

  // AI auto-sim if user not involved
  if (!fixture.userInvolved) {
    const result = simulateWorldClubChallenge(career, {
      ...fixture,
      status: "complete",
    });
    return {
      ...career,
      worldClubChallenge: {
        history: [...(career.worldClubChallenge?.history ?? []), result],
        currentFixture: undefined,
      },
    };
  }

  return {
    ...career,
    worldClubChallenge: {
      history: career.worldClubChallenge?.history ?? [],
      currentFixture: fixture,
    },
  };
}

export function completeUserWorldClubChallenge(
  career: ManagerCareer,
  homeScore: number,
  awayScore: number,
  events: LiveMatchEvent[],
  storySummary: string
): ManagerCareer {
  const fixture = career.worldClubChallenge?.currentFixture;
  if (!fixture) return career;

  const winnerName =
    homeScore > awayScore
      ? fixture.superLeagueChampionName
      : fixture.nrlChampionName;

  const userResult: WorldClubChallengeResult["userResult"] =
    winnerName === career.club ? "won" : "lost";

  const result: WorldClubChallengeResult = {
    id: fixture.id,
    seasonYear: fixture.seasonYear,
    superLeagueChampionName: fixture.superLeagueChampionName,
    nrlChampionName: fixture.nrlChampionName,
    homeScore,
    awayScore,
    winnerName,
    userResult,
    events,
    storySummary,
  };

  // Update lifetime WCC stats (lazy import to avoid circular deps at module load)
  void import("./managerStats").then(({ loadManagerStats, saveManagerStats }) => {
    const stats = loadManagerStats();
    stats.worldClubChallengeAppearances =
      (stats.worldClubChallengeAppearances ?? 0) + 1;
    if (userResult === "won") {
      stats.worldClubChallengeWins = (stats.worldClubChallengeWins ?? 0) + 1;
      stats.trophies = (stats.trophies ?? 0) + 1;
    }
    saveManagerStats(stats);
  });

  return {
    ...career,
    worldClubChallenge: {
      history: [...(career.worldClubChallenge?.history ?? []), result],
      currentFixture: undefined,
    },
  };
}

export function isWorldClubChallengeCompetition(
  competition?: ManagerCompetition
): boolean {
  return competition === "world_club_challenge";
}

export function getWccStats(career: ManagerCareer): {
  wins: number;
  appearances: number;
  results: WorldClubChallengeResult[];
} {
  const history = career.worldClubChallenge?.history ?? [];
  const userResults = history.filter((r) => r.userResult !== "not_involved");
  return {
    wins: userResults.filter((r) => r.userResult === "won").length,
    appearances: userResults.length,
    results: history,
  };
}

/** Latest WCC win this season that has not yet been celebrated. */
export function shouldShowWorldClubChallengeCelebration(
  career: ManagerCareer
): boolean {
  if (career.worldClubChallengeCelebrationShown) return false;
  const history = career.worldClubChallenge?.history ?? [];
  const latest = history[history.length - 1];
  if (!latest) return false;
  if (latest.seasonYear !== career.seasonYear) return false;
  return latest.userResult === "won";
}

/** Most recent WCC result for the user's club this season (win or loss). */
export function getLatestUserWorldClubChallengeResult(
  career: ManagerCareer
): WorldClubChallengeResult | null {
  const history = career.worldClubChallenge?.history ?? [];
  for (let i = history.length - 1; i >= 0; i--) {
    const result = history[i];
    if (
      result &&
      result.seasonYear === career.seasonYear &&
      result.userResult !== "not_involved"
    ) {
      return result;
    }
  }
  return null;
}
