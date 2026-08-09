import seedrandom from "seedrandom";
import type {
  LiveMatchEvent,
  ManagerCareer,
  ManagerCompetition,
  ManagerFixtureRecord,
  ManagerScheduledFixture,
  WorldClubChallengeFixture,
  WorldClubChallengeResult,
} from "./types";
import { generateSimulatedMatchEvents } from "./matchEventGenerator";
import { validateMatchEvents } from "../game/validateMatchEvents";
import type { MatchEventType } from "../game/match-events";
import { pickWinningMargin, snapToRLScore } from "../game/rl-scores";
import { CURRENT_PLAYABLE_CLUBS } from "../clubs/super-league-display";
import { SUPER_LEAGUE_CLUBS } from "../clubs";
import { getManagerClubStarRating } from "./club-config";
import {
  generateNrlSquadNames,
  getNrlClubByName,
  isNrlClubName,
  NRL_CLUBS,
  NRL_WORLD_CLUB_CHALLENGE_TEAMS,
} from "../nrl/nrlClubs";
import { buildNrlMatchdayLineup } from "../nrl/nrlMatchdayLineup";
import { getManagerPlayer } from "./managerPlayers";
import { addBoardWorldClubChallengeWinInbox } from "./managerBoardInbox";

export {
  generateNrlSquadNames,
  NRL_WORLD_CLUB_CHALLENGE_TEAMS,
} from "../nrl/nrlClubs";

/** Season-one WCC Super League invitees must be five-star clubs only. */
export const INITIAL_WCC_ELIGIBILITY_VERSION = 2;
export const SEASON_ONE_WCC_REQUIRED_STARS = 5 as const;

/**
 * Pick a five-star Super League club for the season-one World Club Challenge.
 * Excludes the user's club so the opener is always an AI showcase match.
 * Uses canonical club reputation stars — never in-season squad OVR or base strength.
 */
export function pickTopTierSuperLeagueChampion(
  seed: string,
  seasonYear: number,
  excludeClub?: string
): string {
  const pool = CURRENT_PLAYABLE_CLUBS.filter(
    (c) =>
      getManagerClubStarRating(c) === SEASON_ONE_WCC_REQUIRED_STARS &&
      c !== excludeClub
  );
  const rng = seedrandom(`${seed}-sl-wcc-invite-v2-${seasonYear}`);
  if (pool.length === 0) {
    // Should never happen while Leeds / Saints / Wigan remain five-star.
    const fiveStarFallback = ["Leeds Rhinos", "St Helens", "Wigan Warriors"].filter(
      (c) => c !== excludeClub
    );
    return (
      fiveStarFallback[Math.floor(rng() * fiveStarFallback.length)] ??
      "Wigan Warriors"
    );
  }
  return pool[Math.floor(rng() * pool.length)]!;
}

export function isSeasonOneWccEligibleClub(clubName: string): boolean {
  return getManagerClubStarRating(clubName) === SEASON_ONE_WCC_REQUIRED_STARS;
}

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

/** Elite NRL sides (tier 4–5) for season-one World Club Challenge invitations. */
export function pickTopTierNrlChampion(seed: string, seasonYear: number): string {
  const top = NRL_CLUBS.filter((c) => c.strengthTier >= 4);
  const pool = top.length > 0 ? top : NRL_CLUBS;
  const rng = seedrandom(`${seed}-nrl-top-champ-${seasonYear}`);
  return pool[Math.floor(rng() * pool.length)]!.name;
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

  // First-season unplayed WCC assigned to a non-five-star SL club — repair once.
  const isFirstSeason = career.seasonHistory.length === 0;
  const eligibilityVersion =
    (career as ManagerCareer & { initialWCCEligibilityVersion?: number })
      .initialWCCEligibilityVersion ?? 0;
  if (
    isFirstSeason &&
    eligibilityVersion < INITIAL_WCC_ELIGIBILITY_VERSION &&
    currentFixture &&
    currentFixture.status === "scheduled" &&
    !currentFixture.userInvolved
  ) {
    const sl = currentFixture.superLeagueChampionName;
    if (!isSeasonOneWccEligibleClub(sl)) {
      const replacement = pickTopTierSuperLeagueChampion(
        career.seed,
        career.seasonYear,
        career.club
      );
      currentFixture = {
        ...currentFixture,
        superLeagueChampionTeamId: replacement,
        superLeagueChampionName: replacement,
      };
    }
  }

  const history = (state.history ?? []).map((r) => {
    if (isNrlWorldClubChallengeTeam(r.nrlChampionName)) return r;
    const nrlChampion = pickNrlChampion(career.seed, r.seasonYear);
    return {
      ...r,
      nrlChampionName: nrlChampion,
      storySummary: r.storySummary.replace(r.nrlChampionName, nrlChampion),
    };
  });

  return {
    ...career,
    initialWCCEligibilityVersion: INITIAL_WCC_ELIGIBILITY_VERSION,
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
      // Only the user's own trophy history is stored here.
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
  // Prefer a real AI Super League table when the user managed in Championship.
  const aiTable = career.aiSuperLeagueStandings;
  if (aiTable?.length) {
    const top = [...aiTable].sort((a, b) => a.position - b.position)[0];
    if (top?.team) return top.team;
  }
  const membership = career.superLeagueClubNames?.filter((c) => c !== career.club);
  if (membership?.length) {
    const rng = seedrandom(`${career.seed}-sl-champ-${seasonYear}`);
    return membership[Math.floor(rng() * membership.length)]!;
  }
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

  // Never reuse previousSeasonChampion here — that incorrectly forced the user
  // into World Club Challenge seasons after they were no longer champions.
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
    label: "WCC",
  };
}

/** True when the career should include a World Club Challenge this season. */
export function shouldScheduleWorldClubChallenge(
  _career: ManagerCareer
): boolean {
  return true;
}

export function createWorldClubChallengeFixture(
  career: ManagerCareer
): WorldClubChallengeFixture | null {
  if (!shouldScheduleWorldClubChallenge(career)) return null;

  const isFirstSeason = career.seasonHistory.length === 0;
  const prev = getPreviousSeasonChampion(career);

  // Season one: top-tier Super League invitee vs top-tier NRL — always AI so
  // weaker starter careers watch the result instead of playing it.
  // Later seasons: previous Super League champion vs a random NRL champion.
  const slName = isFirstSeason
    ? pickTopTierSuperLeagueChampion(
        career.seed,
        career.seasonYear,
        career.club
      )
    : prev?.name ??
      pickTopTierSuperLeagueChampion(
        career.seed,
        career.seasonYear,
        career.club
      );
  const userInvolved = !isFirstSeason && slName === career.club;
  const nrlChampion = isFirstSeason
    ? pickTopTierNrlChampion(career.seed, career.seasonYear)
    : pickNrlChampion(career.seed, career.seasonYear);
  const rng = seedrandom(
    `${career.seed}-wcc-rating-${career.seasonYear}-${nrlChampion}`
  );

  const rolled = rollNrlChampionRating(rng, nrlChampion);
  const lineup = buildNrlMatchdayLineup({
    seed: career.seed,
    teamName: nrlChampion,
    teamRating: rolled,
    seasonYear: career.seasonYear,
  });

  const fixture: WorldClubChallengeFixture = {
    id: `wcc-${career.seasonYear}`,
    seasonYear: career.seasonYear,
    gameWeek: 3,
    superLeagueChampionTeamId: slName,
    superLeagueChampionName: slName,
    nrlChampionName: nrlChampion,
    nrlChampionId: getNrlClubByName(nrlChampion)?.id,
    // Persist the lineup-derived rating used by Hub / Play / sim.
    nrlChampionRating: lineup.teamRating,
    status: "scheduled",
    userInvolved,
  };

  if (!isValidWorldClubChallengeFixture(fixture)) {
    console.warn("[WCC] Invalid NRL opponent generated — regenerating", fixture);
    const repairPick = isFirstSeason
      ? pickTopTierNrlChampion(`${career.seed}-retry`, career.seasonYear)
      : pickNrlChampion(`${career.seed}-retry`, career.seasonYear);
    fixture.nrlChampionName = repairPick;
    fixture.nrlChampionId = getNrlClubByName(fixture.nrlChampionName)?.id;
    const repairRng = seedrandom(
      `${career.seed}-wcc-rating-retry-${career.seasonYear}-${fixture.nrlChampionName}`
    );
    const repairRolled = rollNrlChampionRating(
      repairRng,
      fixture.nrlChampionName
    );
    fixture.nrlChampionRating = buildNrlMatchdayLineup({
      seed: career.seed,
      teamName: fixture.nrlChampionName,
      teamRating: repairRolled,
      seasonYear: career.seasonYear,
    }).teamRating;
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
              name: player?.name ?? getManagerPlayer(career, ps!.playerId)?.name ?? "Forward",
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

/**
 * AI (non-user) WCC stays scheduled until Game Week 3 has been reached —
 * i.e. the calendar Friday before round 3 has passed on the career clock.
 */
export function isAiWorldClubChallengeDue(
  career: ManagerCareer,
  fixture: WorldClubChallengeFixture
): boolean {
  if (fixture.userInvolved || fixture.status !== "scheduled") return false;
  if (fixture.seasonYear !== career.seasonYear) return false;
  return career.gameWeek >= fixture.gameWeek || Boolean(career.isSeasonComplete);
}

/** Complete a scheduled AI WCC once its gameday has passed; no-op otherwise. */
export function resolveAiWorldClubChallengeIfDue(
  career: ManagerCareer
): ManagerCareer {
  const fixture = career.worldClubChallenge?.currentFixture;
  if (!fixture || !isAiWorldClubChallengeDue(career, fixture)) return career;

  const result = simulateWorldClubChallenge(career, {
    ...fixture,
    status: "complete",
  });
  const history = (career.worldClubChallenge?.history ?? []).filter(
    (r) => r.seasonYear !== fixture.seasonYear
  );
  return {
    ...career,
    worldClubChallenge: {
      history: [...history, result],
      currentFixture: undefined,
    },
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

  // Keep AI showcase fixtures scheduled until Game Week 3 — do not auto-sim
  // on schedule so the result is not visible at career start.
  return resolveAiWorldClubChallengeIfDue({
    ...career,
    worldClubChallenge: {
      history: career.worldClubChallenge?.history ?? [],
      currentFixture: fixture,
    },
  });
}

/** Schedule this season's WCC when missing (covers season-one careers and older saves). */
export function ensureWorldClubChallengeScheduled(
  career: ManagerCareer
): ManagerCareer {
  if (career.isSeasonComplete) {
    return resolveAiWorldClubChallengeIfDue(career);
  }
  const history = career.worldClubChallenge?.history ?? [];
  const current = career.worldClubChallenge?.currentFixture;
  const isFirstSeason = career.seasonHistory.length === 0;

  // Older saves auto-simmed AI WCC at career start. Hide the result again until
  // Game Week 3 so the showcase does not appear before gameday.
  if (
    !current &&
    career.gameWeek < 3 &&
    !career.isSeasonComplete
  ) {
    const earlyAi = history.find(
      (r) =>
        r.seasonYear === career.seasonYear &&
        r.userResult === "not_involved"
    );
    if (earlyAi) {
      const ratingRng = seedrandom(
        `${career.seed}-wcc-rating-${career.seasonYear}-${earlyAi.nrlChampionName}`
      );
      const rolled = rollNrlChampionRating(ratingRng, earlyAi.nrlChampionName);
      const lineup = buildNrlMatchdayLineup({
        seed: career.seed,
        teamName: earlyAi.nrlChampionName,
        teamRating: rolled,
        seasonYear: career.seasonYear,
      });
      const fixture: WorldClubChallengeFixture = {
        id: earlyAi.id,
        seasonYear: earlyAi.seasonYear,
        gameWeek: 3,
        superLeagueChampionTeamId: earlyAi.superLeagueChampionName,
        superLeagueChampionName: earlyAi.superLeagueChampionName,
        nrlChampionName: earlyAi.nrlChampionName,
        nrlChampionId: getNrlClubByName(earlyAi.nrlChampionName)?.id,
        nrlChampionRating: lineup.teamRating,
        status: "scheduled",
        userInvolved: false,
      };
      return {
        ...career,
        worldClubChallenge: {
          history: history.filter((r) => r.seasonYear !== career.seasonYear),
          currentFixture: fixture,
        },
      };
    }
  }

  // Season one must never force the user into a playable WCC — convert any
  // leftover invitation into the AI showcase match.
  if (
    isFirstSeason &&
    current &&
    current.seasonYear === career.seasonYear &&
    current.status === "scheduled" &&
    current.userInvolved
  ) {
    return scheduleWorldClubChallengeForSeason({
      ...career,
      worldClubChallenge: { history, currentFixture: undefined },
    });
  }

  // Repair saves where the user was wrongly forced into WCC despite not being
  // the Super League champion — keep as scheduled AI until gameday passes.
  if (
    current &&
    current.seasonYear === career.seasonYear &&
    current.status === "scheduled"
  ) {
    const trueChampion = isFirstSeason
      ? current.superLeagueChampionName
      : (career.previousSeasonChampion ?? current.superLeagueChampionName);
    const shouldInvolveUser =
      !isFirstSeason && trueChampion === career.club;
    if (
      (!isFirstSeason && current.superLeagueChampionName !== trueChampion) ||
      current.userInvolved !== shouldInvolveUser
    ) {
      if (!shouldInvolveUser) {
        const fixture: WorldClubChallengeFixture = {
          ...current,
          superLeagueChampionName: trueChampion,
          superLeagueChampionTeamId: trueChampion,
          userInvolved: false,
          status: "scheduled",
        };
        return resolveAiWorldClubChallengeIfDue({
          ...career,
          worldClubChallenge: {
            history: history.filter((r) => r.seasonYear !== career.seasonYear),
            currentFixture: fixture,
          },
        });
      }
      return scheduleWorldClubChallengeForSeason({
        ...career,
        worldClubChallenge: { history, currentFixture: undefined },
      });
    }
  }

  const hasThisSeason =
    current?.seasonYear === career.seasonYear ||
    history.some((r) => r.seasonYear === career.seasonYear);
  if (hasThisSeason) return resolveAiWorldClubChallengeIfDue(career);
  return scheduleWorldClubChallengeForSeason(career);
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

  const next: ManagerCareer = {
    ...career,
    worldClubChallenge: {
      history: [...(career.worldClubChallenge?.history ?? []), result],
      currentFixture: undefined,
    },
  };

  if (userResult === "won") {
    void import("../achievements/achievementTriggers").then(
      ({ triggerManagerWorldClubChallengeAchievements }) => {
        triggerManagerWorldClubChallengeAchievements(next);
      }
    );
    return addBoardWorldClubChallengeWinInbox(next);
  }

  return next;
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

/** Convert a WCC history result into a fixture record for Results / list UI. */
export function worldClubChallengeResultToFixtureRecord(
  result: WorldClubChallengeResult,
  careerClub: string
): ManagerFixtureRecord {
  const userInvolved = result.userResult === "won" || result.userResult === "lost";
  const slWon = result.winnerName === result.superLeagueChampionName;
  const userClub = userInvolved ? careerClub : result.superLeagueChampionName;
  const pointsFor = result.homeScore;
  const pointsAgainst = result.awayScore;
  const triesFor = Math.max(0, Math.round(pointsFor / 6));
  const triesAgainst = Math.max(0, Math.round(pointsAgainst / 6));
  const resultLetter: "W" | "L" = userInvolved
    ? result.userResult === "won"
      ? "W"
      : "L"
    : slWon
      ? "W"
      : "L";

  return {
    round: 3,
    opponent: result.nrlChampionName,
    isHome: true,
    pointsFor,
    pointsAgainst,
    triesFor,
    triesAgainst,
    scoringFor: {
      tries: triesFor,
      conversions: 0,
      penalties: 0,
      dropGoals: 0,
      points: pointsFor,
    },
    scoringAgainst: {
      tries: triesAgainst,
      conversions: 0,
      penalties: 0,
      dropGoals: 0,
      points: pointsAgainst,
    },
    result: resultLetter,
    matchBio: result.storySummary,
    userClub,
    fixtureId: result.id,
    competition: "world_club_challenge",
    meta: {
      injuries: [],
      competition: "world_club_challenge",
      liveEvents: result.events,
    },
  };
}

/** Current-season WCC history entry, if the fixture has already been completed. */
export function getCurrentSeasonWccResult(
  career: ManagerCareer
): WorldClubChallengeResult | null {
  const history = career.worldClubChallenge?.history ?? [];
  for (let i = history.length - 1; i >= 0; i--) {
    const result = history[i];
    if (result && result.seasonYear === career.seasonYear) return result;
  }
  return null;
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
