/**
 * Lightweight Academy / Reserves grade match simulation.
 * Runs once per week alongside first-team fixtures — not a full competition engine.
 */

import { snapToRLScore } from "../game/rl-scores";
import type { DevelopmentMatchResult, ManagerPlayer, ManagerState, SquadTier } from "./types";

const RESULTS_CAP = 24;

function tierStrength(players: ManagerPlayer[]): number {
  const available = players.filter((p) => !p.injury && !p.suspension);
  if (available.length === 0) return 50;
  const sorted = [...available].sort((a, b) => b.rating - a.rating).slice(0, 17);
  const avg = sorted.reduce((sum, p) => sum + p.rating, 0) / sorted.length;
  // Short squads play weaker
  const depthPenalty = Math.max(0, (13 - sorted.length) * 1.2);
  return avg - depthPenalty;
}

function sampleScorePair(ourRating: number, theirRating: number): { us: number; them: number } {
  const diff = ourRating - theirRating;
  const base = 18 + Math.random() * 14;
  const swing = diff * 0.55 + (Math.random() - 0.5) * 10;
  let us = Math.round(base + swing);
  let them = Math.round(base - swing * 0.85);
  us = Math.max(0, Math.min(56, us));
  them = Math.max(0, Math.min(56, them));
  // Avoid draws most of the time for youth grades
  if (us === them) {
    if (Math.random() < 0.7) us += Math.random() < 0.5 ? 2 : 4;
    else them += Math.random() < 0.5 ? 2 : 4;
  }
  return {
    us: snapToRLScore(us, false),
    them: snapToRLScore(them, false),
  };
}

function pickOpponentClubIds(state: ManagerState, clubId: string): string[] {
  const club = state.clubs[clubId];
  if (!club) return [];
  const peers = Object.values(state.clubs)
    .filter((c) => c.id !== clubId && c.competitionId === club.competitionId)
    .map((c) => c.id);
  if (peers.length > 0) return peers;
  return Object.keys(state.clubs).filter((id) => id !== clubId);
}

function simulateTierMatch(
  state: ManagerState,
  clubId: string,
  tier: "reserves" | "academy",
  season: number,
  week: number
): DevelopmentMatchResult | null {
  const club = state.clubs[clubId];
  if (!club) return null;

  const ourPlayers = Object.values(state.players).filter(
    (p) => p.clubId === clubId && p.squadTier === tier && !p.loan && !p.isRetired
  );
  if (ourPlayers.length < 8) return null;

  const peers = pickOpponentClubIds(state, clubId);
  if (peers.length === 0) return null;
  const opponentId = peers[Math.floor(Math.random() * peers.length)];
  const opponent = state.clubs[opponentId];
  if (!opponent) return null;

  const theirPlayers = Object.values(state.players).filter(
    (p) => p.clubId === opponentId && p.squadTier === tier && !p.loan && !p.isRetired
  );

  const ourStr = tierStrength(ourPlayers);
  const theirStr = tierStrength(theirPlayers.length >= 8 ? theirPlayers : ourPlayers.map((p) => ({
    ...p,
    rating: Math.max(48, p.rating - 3 + Math.floor(Math.random() * 5)),
  })));

  const isHome = Math.random() < 0.5;
  const homeBoost = isHome ? 1.5 : -1.5;
  const scores = sampleScorePair(ourStr + homeBoost, theirStr - homeBoost);

  return {
    id: `dev_${tier}_${clubId}_${season}_w${week}_${opponentId}`,
    season,
    week,
    tier,
    opponentClubId: opponentId,
    opponentName: opponent.name,
    isHome,
    ourScore: scores.us,
    theirScore: scores.them,
  };
}

/**
 * Simulate one Academy and one Reserves fixture for every club this week.
 */
export function simulateWeeklyDevelopmentResults(state: ManagerState): ManagerState {
  const season = state.calendar.currentSeason;
  const week = state.calendar.currentWeek;
  const phase = state.calendar.phase;
  if (phase === "season_end") return state;

  const updatedClubs = { ...state.clubs };
  let anyClubChanged = false;

  for (const clubId of Object.keys(updatedClubs)) {
    const club = updatedClubs[clubId];
    const existing = [...(club.developmentResults || [])];
    const nextResults = [...existing];
    let clubChanged = false;

    for (const tier of ["reserves", "academy"] as const) {
      const already = existing.some(
        (r) => r.season === season && r.week === week && r.tier === tier
      );
      if (already) continue;

      const result = simulateTierMatch(state, clubId, tier, season, week);
      if (result) {
        nextResults.unshift(result);
        clubChanged = true;
      }
    }

    if (clubChanged) {
      updatedClubs[clubId] = {
        ...club,
        developmentResults: nextResults.slice(0, RESULTS_CAP),
      };
      anyClubChanged = true;
    }
  }

  if (!anyClubChanged) return state;
  return { ...state, clubs: updatedClubs };
}

export function getDevelopmentResultsForTier(
  state: ManagerState,
  clubId: string,
  tier: Extract<SquadTier, "reserves" | "academy">
): DevelopmentMatchResult[] {
  const club = state.clubs[clubId];
  if (!club?.developmentResults) return [];
  return club.developmentResults.filter((r) => r.tier === tier);
}
