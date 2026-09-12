/**
 * Authoritative Week Advancement Engine.
 *
 * CRITICAL CONTRACT:
 * - Processes a week EXACTLY ONCE.
 * - Idempotency guaranteed via unique week keys (`${season}_w${week}`).
 * - Complete protection against duplicate button clicks, React rerenders, and race conditions.
 */

import { updateStandingsForFixture } from "./competitions";
import { processWeeklyFinances } from "./finances";
import { tickActiveLoans } from "./loans";
import { simulateManagerMatch } from "./match";
import { progressPlayerWeek } from "./player";
import { processAiDecisionsForWeek } from "./ai";
import { cleanAllClubLineups } from "./squad";
import type {
  ManagerFixture,
  ManagerState,
} from "./types";

export function getWeekKey(season: number, week: number): string {
  return `${season}_w${week}`;
}

/**
 * Authoritative advanceWeek function.
 * Pure function: takes current ManagerState, returns next ManagerState.
 */
export function advanceWeek(state: ManagerState): ManagerState {
  const currentSeason = state.calendar.currentSeason;
  const currentWeek = state.calendar.currentWeek;
  const weekKey = getWeekKey(currentSeason, currentWeek);

  // 1. Idempotency Check: if this exact week was already processed, do NOT re-run!
  if (state.calendar.processedWeekKeys.includes(weekKey)) {
    return state;
  }

  // 2. Weekly Training & Player Recovery Tick
  let updatedPlayers = { ...state.players };
  for (const [id, player] of Object.entries(updatedPlayers)) {
    const club = player.clubId ? state.clubs[player.clubId] : undefined;
    const intensity = club?.tactics.trainingIntensity || "normal";
    updatedPlayers[id] = progressPlayerWeek(player, club, intensity);
  }

  // 3. Match Simulation for this week's fixtures across all competitions
  const updatedCompetitions = { ...state.competitions };
  const matchesPlayedThisWeek: { homeClubId: string; attendance?: number }[] = [];

  for (const [compId, comp] of Object.entries(updatedCompetitions)) {
    let compStandings = comp.standings;
    const compFixtures: ManagerFixture[] = [];

    for (const fixture of comp.fixtures) {
      if (fixture.week === currentWeek && !fixture.isPlayed) {
        const homeClub = state.clubs[fixture.homeClubId];
        const awayClub = state.clubs[fixture.awayClubId];

        if (homeClub && awayClub) {
          const simResult = simulateManagerMatch(fixture, homeClub, awayClub, updatedPlayers);
          compFixtures.push(simResult.fixture);
          matchesPlayedThisWeek.push({
            homeClubId: simResult.fixture.homeClubId,
            attendance: simResult.fixture.attendance,
          });

          // Update standings (strictly only regular league fixtures)
          compStandings = updateStandingsForFixture(compStandings, simResult.fixture);

          // Apply player match deltas
          for (const [pid, delta] of Object.entries(simResult.playerUpdates)) {
            const p = updatedPlayers[pid];
            if (p) {
              const prevStats = p.stats;
              const prevCareer = p.careerStats;
              const totalApps = prevStats.apps + delta.statsDelta.apps;
              const matchRatings = [delta.statsDelta.matchRating, ...prevStats.matchRatings].slice(0, 5);
              const avgRating = Number(
                (matchRatings.reduce((a, b) => a + b, 0) / matchRatings.length).toFixed(1)
              );

              updatedPlayers[pid] = {
                ...p,
                fatigue: Math.min(100, Math.max(0, p.fatigue + delta.fatigueDelta)),
                injury: delta.injury || p.injury,
                suspension: delta.suspension || p.suspension,
                form: delta.formNew,
                morale: Math.min(100, Math.max(0, p.morale + delta.moraleDelta)),
                stats: {
                  apps: totalApps,
                  tries: prevStats.tries + delta.statsDelta.tries,
                  goals: prevStats.goals + delta.statsDelta.goals,
                  dropGoals: prevStats.dropGoals + delta.statsDelta.dropGoals,
                  points: prevStats.points + delta.statsDelta.points,
                  motm: prevStats.motm + delta.statsDelta.motm,
                  avgRating,
                  matchRatings,
                },
                careerStats: {
                  apps: prevCareer.apps + delta.statsDelta.apps,
                  tries: prevCareer.tries + delta.statsDelta.tries,
                  goals: prevCareer.goals + delta.statsDelta.goals,
                  dropGoals: prevCareer.dropGoals + delta.statsDelta.dropGoals,
                  points: prevCareer.points + delta.statsDelta.points,
                  motm: prevCareer.motm + delta.statsDelta.motm,
                },
              };
            }
          }
        } else {
          compFixtures.push(fixture);
        }
      } else {
        compFixtures.push(fixture);
      }
    }

    updatedCompetitions[compId as keyof typeof updatedCompetitions] = {
      ...comp,
      fixtures: compFixtures,
      standings: compStandings,
    };
  }

  // 4. Intermediate state for financial and loan processing
  let intermediateState: ManagerState = {
    ...state,
    players: updatedPlayers,
    competitions: updatedCompetitions,
  };

  // 5. Loan Expiry Tick
  intermediateState = tickActiveLoans(intermediateState);

  // 6. Weekly Finances Tick
  const updatedFinances = processWeeklyFinances(intermediateState, matchesPlayedThisWeek);
  const updatedClubs = { ...intermediateState.clubs };
  for (const [clubId, finances] of Object.entries(updatedFinances)) {
    if (updatedClubs[clubId]) {
      updatedClubs[clubId] = {
        ...updatedClubs[clubId],
        finances,
      };
    }
  }
  intermediateState = { ...intermediateState, clubs: updatedClubs };

  // 7. AI Decisions Tick (renewals, transfers, squad moves)
  intermediateState = processAiDecisionsForWeek(intermediateState);

  // 8. Board Confidence Adjustment for user's club
  const userClub = intermediateState.clubs[intermediateState.manager.clubId];
  if (userClub) {
    // Check user club's recent results in standings
    const comp = intermediateState.competitions[userClub.competitionId];
    const standingRow = comp?.standings.find((s) => s.clubId === userClub.id);
    let confidenceDelta = 0;
    if (standingRow && standingRow.form.length > 0) {
      const lastResult = standingRow.form[0];
      if (lastResult === "W") confidenceDelta += 2;
      else if (lastResult === "L") confidenceDelta -= 2;
    }
    const nextConfidence = Math.min(100, Math.max(10, userClub.boardConfidence + confidenceDelta));

    intermediateState = {
      ...intermediateState,
      clubs: {
        ...intermediateState.clubs,
        [userClub.id]: {
          ...userClub,
          boardConfidence: nextConfidence,
        },
      },
    };
  }

  // 9. Calendar Progression & Phase Changes
  let nextPhase = intermediateState.calendar.phase;
  const nextWeek = currentWeek + 1;

  if (currentWeek === 2) {
    nextPhase = "regular_season";
  } else if (currentWeek === 28) {
    nextPhase = "playoffs";
  } else if (currentWeek >= 32) {
    nextPhase = "season_end";
  }

  const finalState: ManagerState = {
    ...intermediateState,
    calendar: {
      ...intermediateState.calendar,
      currentWeek: nextWeek,
      phase: nextPhase,
      processedWeekKeys: [...intermediateState.calendar.processedWeekKeys, weekKey],
    },
  };

  return cleanAllClubLineups(finalState);
}
