/**
 * Manager Mode Match Simulation Engine.
 * Pure function: takes fixture, clubs, players, tactics, and generates
 * realistic Rugby League outcomes with tries, conversions, match ratings,
 * fatigue, injuries, suspensions, and attendance.
 */

import type {
  ManagerClub,
  ManagerFixture,
  ManagerPlayer,
  MatchPlayerPerformance,
  MatchScoreEvent,
  PlayerInjury,
  PlayerSuspension,
  Position,
} from "./types";
import {
  decomposeRLScore,
  ensureScoreAhead,
  pickWinningMargin,
  snapToRLScore,
} from "../game/rl-scores";

export interface MatchSimulationResult {
  fixture: ManagerFixture;
  playerUpdates: Record<
    string,
    {
      statsDelta: {
        apps: number;
        tries: number;
        goals: number;
        dropGoals: number;
        points: number;
        motm: number;
        matchRating: number;
      };
      fatigueDelta: number;
      injury: PlayerInjury | null;
      suspension: PlayerSuspension | null;
      formNew: number;
      moraleDelta: number;
    }
  >;
}

const INJURY_TYPES = [
  { name: "Dead Leg", weeks: 1, severity: "minor" as const },
  { name: "Hamstring Strain", weeks: 2, severity: "minor" as const },
  { name: "Ankle Sprain", weeks: 3, severity: "moderate" as const },
  { name: "Shoulder Subluxation", weeks: 4, severity: "moderate" as const },
  { name: "Concussion Protocol", weeks: 2, severity: "minor" as const },
  { name: "MCL Knee Strain", weeks: 6, severity: "moderate" as const },
  { name: "Broken Jaw", weeks: 8, severity: "severe" as const },
  { name: "ACL Rupture", weeks: 14, severity: "severe" as const },
];

/** Position weights for scoring tries */
const TRY_WEIGHTS: Record<Position, number> = {
  WING: 35,
  CENTRE: 25,
  FULLBACK: 20,
  STAND_OFF: 12,
  SCRUM_HALF: 10,
  SECOND_ROW: 10,
  LOOSE_FORWARD: 8,
  HOOKER: 6,
  PROP: 4,
};

export function simulateManagerMatch(
  fixture: ManagerFixture,
  homeClub: ManagerClub,
  awayClub: ManagerClub,
  allPlayers: Record<string, ManagerPlayer>
): MatchSimulationResult {
  // 1. Gather 17 players for home and away
  function getMatchdayPlayers(club: ManagerClub): ManagerPlayer[] {
    const ids = [...club.lineup.starting13, ...club.lineup.bench].filter(Boolean) as string[];
    const result: ManagerPlayer[] = [];
    for (const id of ids) {
      const p = allPlayers[id];
      if (p && !p.injury && !p.suspension) {
        result.push(p);
      }
    }
    // If club doesn't have 17 available, fill from First/Reserves
    if (result.length < 17) {
      const existingIds = new Set(result.map(p => p.id));
      const backup = Object.values(allPlayers)
        .filter(p => p.clubId === club.id && !p.injury && !p.suspension && !existingIds.has(p.id))
        .sort((a, b) => b.rating - a.rating);
      for (const bp of backup) {
        if (result.length >= 17) break;
        result.push(bp);
      }
    }
    return result;
  }

  const homeSquad = getMatchdayPlayers(homeClub);
  const awaySquad = getMatchdayPlayers(awayClub);

  // 2. Compute effective team ratings
  function calculateTeamRating(squad: ManagerPlayer[], club: ManagerClub, isHome: boolean): number {
    if (squad.length === 0) return 60;

    // Weight starting 13 heavily (80%) vs interchange bench (20%)
    const starters = squad.slice(0, 13);
    const bench = squad.slice(13, 17);
    const starterAvg =
      starters.length > 0
        ? starters.reduce((sum, p) => sum + p.rating, 0) / starters.length
        : 60;
    const benchAvg =
      bench.length > 0
        ? bench.reduce((sum, p) => sum + p.rating, 0) / bench.length
        : starterAvg;
    const baseWeightedRating = starterAvg * 0.8 + benchAvg * 0.2;

    // Key Spine impact (Fullback, Stand-Off, Scrum-Half, Hooker: indices 0, 5, 6, 8)
    const spineIndices = [0, 5, 6, 8];
    const spinePlayers = spineIndices
      .map((i) => starters[i])
      .filter((p): p is ManagerPlayer => Boolean(p));
    let spineBonus = 0;
    if (spinePlayers.length > 0) {
      const spineAvg =
        spinePlayers.reduce((sum, p) => sum + p.rating, 0) / spinePlayers.length;
      spineBonus = Math.max(-1.5, Math.min(1.5, (spineAvg - 80) * 0.15));
    }

    const avgForm = squad.reduce((sum, p) => sum + p.form, 0) / squad.length;
    const avgMorale = squad.reduce((sum, p) => sum + p.morale, 0) / squad.length;
    const avgFatigue = squad.reduce((sum, p) => sum + p.fatigue, 0) / squad.length;

    let effective = baseWeightedRating + spineBonus;

    // Form bonus (-1.2 to +1.2)
    effective += Math.max(-1.2, Math.min(1.2, (avgForm - 7.0) * 0.8));
    // Morale bonus (-1.0 to +1.0)
    effective += Math.max(-1.0, Math.min(1.0, ((avgMorale - 75) / 25) * 0.8));
    // Fatigue penalty (up to -3.0)
    effective -= (avgFatigue / 100) * 3.0;

    // Coaching quality impact (-0.8 to +0.8)
    if (club.coachingQuality) {
      effective += (club.coachingQuality - 3) * 0.4;
    }

    // Tactics intensity bonus (-1.0 to +1.0)
    if (club.tactics.trainingIntensity === "high") effective += 1.0;
    if (club.tactics.trainingIntensity === "low") effective -= 1.0;

    // Home advantage (+1.5 rating points ~ 58-60% win rate between identical teams)
    if (isHome) effective += 1.5;

    return Math.max(45, Math.min(99, effective));
  }

  const homeEffective = calculateTeamRating(homeSquad, homeClub, true);
  const awayEffective = calculateTeamRating(awaySquad, awayClub, false);

  // 3. Generate match score based on rating differential with authentic RL variance
  const diff = homeEffective - awayEffective;

  // Expected margin scales with rating difference (~1.25 scoreboard points per rating diff)
  const expectedMargin = diff * 1.25;

  // Bell-curve match variance (Irwin-Hall n=3, range [-1.5, +1.5] * 10.5)
  // Ensures most matches (~70%) stay close to expected talent levels,
  // while upsets remain authentic, dramatic tail events.
  const bellRoll = Math.random() + Math.random() + Math.random() - 1.5;
  const noise = bellRoll * 10.5;
  const rawMargin = expectedMargin + noise;

  // Match tempo & total points variance:
  // - 15% Defensive slog / Armwrestle (14 - 28 points)
  // - 55% Standard competitive rugby league match (30 - 48 points)
  // - 20% Open attacking shootout (48 - 64 points)
  // - 10% High-scoring blowout / runaway (60 - 76 points)
  const tempoRoll = Math.random();
  let baseTotal: number;
  if (tempoRoll < 0.15) {
    baseTotal = 14 + Math.random() * 14;
  } else if (tempoRoll < 0.70) {
    baseTotal = 30 + Math.random() * 18;
  } else if (tempoRoll < 0.90) {
    baseTotal = 48 + Math.random() * 16;
  } else {
    baseTotal = 60 + Math.random() * 16;
  }

  // Large talent disparity naturally inflates points for the superior attacking side
  const gapBonus = Math.max(0, (Math.abs(diff) - 4) * 0.6);
  const totalPoints = baseTotal + gapBonus;

  // Derive raw team scores
  const homeRaw = Math.max(0, (totalPoints + rawMargin) / 2);
  const awayRaw = Math.max(0, (totalPoints - rawMargin) / 2);

  // Drop goal allowed: rare (~4%), mostly in tight games (|margin| <= 3)
  const allowDropGoal = Math.abs(rawMargin) <= 3 && Math.random() < 0.05;

  let homeScore = snapToRLScore(Math.round(homeRaw), allowDropGoal);
  let awayScore = snapToRLScore(Math.round(awayRaw), allowDropGoal);

  // Knockout golden point rule (Challenge Cup, Playoffs, Eliminators, Finals, Million Pound Game)
  const isKnockout =
    fixture.competitionId === "challenge-cup" ||
    fixture.roundName.includes("Playoff") ||
    fixture.roundName.includes("Eliminator") ||
    fixture.roundName.includes("Semi-Final") ||
    fixture.roundName.includes("Grand Final") ||
    fixture.roundName.includes("Million Pound Game");

  // Draw resolution: only ~2-3% of regular league matches finish as regulation draws
  const absMargin = Math.abs(rawMargin);
  const isNaturalDraw = absMargin < 0.6 && !isKnockout && Math.random() < 0.35;

  let goldenPointWinner: "home" | "away" | null = null;
  if (homeScore === awayScore) {
    if (isKnockout) {
      // Golden point drop goal in extra time
      const homeProb = (homeEffective + 2) / (homeEffective + awayEffective + 4);
      if (Math.random() < homeProb) {
        homeScore += 1;
        goldenPointWinner = "home";
      } else {
        awayScore += 1;
        goldenPointWinner = "away";
      }
    } else if (!isNaturalDraw) {
      // Decisively separate by realistic margin (2, 4, or 6 points)
      const margin = pickWinningMargin(Math.random);
      if (rawMargin >= 0) {
        homeScore = snapToRLScore(awayScore + Math.min(6, margin), allowDropGoal);
      } else {
        awayScore = snapToRLScore(homeScore + Math.min(6, margin), allowDropGoal);
      }
    }
  } else if (rawMargin > 2.5 && homeScore < awayScore) {
    homeScore = ensureScoreAhead(homeScore, awayScore, Math.random, allowDropGoal);
  } else if (rawMargin < -2.5 && awayScore < homeScore) {
    awayScore = ensureScoreAhead(awayScore, homeScore, Math.random, allowDropGoal);
  }

  // Snap to realistic rugby league scores and decompose
  const homeBreakdown = decomposeRLScore(homeScore);
  const awayBreakdown = decomposeRLScore(awayScore);

  const homeWon = homeScore > awayScore;
  const awayWon = awayScore > homeScore;

  // 4. Calculate attendance
  const capacity = homeClub.facilities.stadiumCapacity || 10000;
  const repPct = (homeClub.reputation / 5) * 0.5 + (awayClub.reputation / 5) * 0.3 + 0.2;
  const attendance = Math.min(capacity, Math.round(capacity * (repPct * 0.8 + Math.random() * 0.2)));

  // 5. Generate score events (tries, goals)
  const scoreEvents: MatchScoreEvent[] = [];
  const playerUpdates: MatchSimulationResult["playerUpdates"] = {};

  // Initialize tracking for all 34 players
  [...homeSquad, ...awaySquad].forEach((p) => {
    playerUpdates[p.id] = {
      statsDelta: {
        apps: 1,
        tries: 0,
        goals: 0,
        dropGoals: 0,
        points: 0,
        motm: 0,
        matchRating: 6.5 + (Math.random() * 1.0),
      },
      fatigueDelta: Math.round(12 + Math.random() * 6),
      injury: null,
      suspension: null,
      formNew: p.form,
      moraleDelta: 0,
    };
  });

  // Assign home tries
  function pickScorer(squad: ManagerPlayer[]): ManagerPlayer {
    const weighted = squad.map(p => ({
      player: p,
      weight: (TRY_WEIGHTS[p.position] || 10) * (p.rating / 70),
    }));
    const totalW = weighted.reduce((s, w) => s + w.weight, 0);
    let r = Math.random() * totalW;
    for (const item of weighted) {
      r -= item.weight;
      if (r <= 0) return item.player;
    }
    return squad[0] || squad[0];
  }

  // Pick goal kickers
  const homeKicker = homeSquad.find(p => p.id === homeClub.tactics.primaryGoalKickerId) ||
    homeSquad.filter(p => ["SCRUM_HALF", "STAND_OFF", "FULLBACK"].includes(p.position)).sort((a, b) => b.rating - a.rating)[0] || homeSquad[0];
  const awayKicker = awaySquad.find(p => p.id === awayClub.tactics.primaryGoalKickerId) ||
    awaySquad.filter(p => ["SCRUM_HALF", "STAND_OFF", "FULLBACK"].includes(p.position)).sort((a, b) => b.rating - a.rating)[0] || awaySquad[0];

  for (let t = 0; t < homeBreakdown.tries; t++) {
    const scorer = pickScorer(homeSquad);
    const minute = Math.floor(Math.random() * 78) + 2;
    scoreEvents.push({
      minute,
      type: "TRY",
      playerId: scorer.id,
      playerName: scorer.name,
      clubId: homeClub.id,
    });
    const upd = playerUpdates[scorer.id];
    if (upd) {
      upd.statsDelta.tries += 1;
      upd.statsDelta.points += 4;
      upd.statsDelta.matchRating = Math.min(10, upd.statsDelta.matchRating + 0.8);
    }
  }

  const homeGoals = homeBreakdown.conversions + homeBreakdown.penalties;
  for (let c = 0; c < homeGoals; c++) {
    if (homeKicker) {
      scoreEvents.push({
        minute: Math.floor(Math.random() * 78) + 2,
        type: c < homeBreakdown.conversions ? "CONVERSION" : "PENALTY_GOAL",
        playerId: homeKicker.id,
        playerName: homeKicker.name,
        clubId: homeClub.id,
      });
      const upd = playerUpdates[homeKicker.id];
      if (upd) {
        upd.statsDelta.goals += 1;
        upd.statsDelta.points += 2;
        upd.statsDelta.matchRating = Math.min(10, upd.statsDelta.matchRating + 0.3);
      }
    }
  }

  // Assign away tries & goals
  for (let t = 0; t < awayBreakdown.tries; t++) {
    const scorer = pickScorer(awaySquad);
    const minute = Math.floor(Math.random() * 78) + 2;
    scoreEvents.push({
      minute,
      type: "TRY",
      playerId: scorer.id,
      playerName: scorer.name,
      clubId: awayClub.id,
    });
    const upd = playerUpdates[scorer.id];
    if (upd) {
      upd.statsDelta.tries += 1;
      upd.statsDelta.points += 4;
      upd.statsDelta.matchRating = Math.min(10, upd.statsDelta.matchRating + 0.8);
    }
  }

  const awayGoals = awayBreakdown.conversions + awayBreakdown.penalties;
  for (let c = 0; c < awayGoals; c++) {
    if (awayKicker) {
      scoreEvents.push({
        minute: Math.floor(Math.random() * 78) + 2,
        type: c < awayBreakdown.conversions ? "CONVERSION" : "PENALTY_GOAL",
        playerId: awayKicker.id,
        playerName: awayKicker.name,
        clubId: awayClub.id,
      });
      const upd = playerUpdates[awayKicker.id];
      if (upd) {
        upd.statsDelta.goals += 1;
        upd.statsDelta.points += 2;
        upd.statsDelta.matchRating = Math.min(10, upd.statsDelta.matchRating + 0.3);
      }
    }
  }

  // Regulation drop goals (home)
  for (let d = 0; d < homeBreakdown.dropGoals; d++) {
    if (homeKicker) {
      scoreEvents.push({
        minute: Math.floor(Math.random() * 10) + 70,
        type: "DROP_GOAL",
        playerId: homeKicker.id,
        playerName: homeKicker.name,
        clubId: homeClub.id,
      });
      const upd = playerUpdates[homeKicker.id];
      if (upd) {
        upd.statsDelta.dropGoals += 1;
        upd.statsDelta.points += 1;
        upd.statsDelta.matchRating = Math.min(10, upd.statsDelta.matchRating + 0.6);
      }
    }
  }

  // Regulation drop goals (away)
  for (let d = 0; d < awayBreakdown.dropGoals; d++) {
    if (awayKicker) {
      scoreEvents.push({
        minute: Math.floor(Math.random() * 10) + 70,
        type: "DROP_GOAL",
        playerId: awayKicker.id,
        playerName: awayKicker.name,
        clubId: awayClub.id,
      });
      const upd = playerUpdates[awayKicker.id];
      if (upd) {
        upd.statsDelta.dropGoals += 1;
        upd.statsDelta.points += 1;
        upd.statsDelta.matchRating = Math.min(10, upd.statsDelta.matchRating + 0.6);
      }
    }
  }

  // Golden point winning drop goal event
  if (goldenPointWinner === "home" && homeKicker) {
    scoreEvents.push({
      minute: 83,
      type: "DROP_GOAL",
      playerId: homeKicker.id,
      playerName: homeKicker.name,
      clubId: homeClub.id,
    });
    const upd = playerUpdates[homeKicker.id];
    if (upd) {
      upd.statsDelta.dropGoals += 1;
      upd.statsDelta.points += 1;
      upd.statsDelta.matchRating = Math.min(10, upd.statsDelta.matchRating + 1.2);
    }
  } else if (goldenPointWinner === "away" && awayKicker) {
    scoreEvents.push({
      minute: 83,
      type: "DROP_GOAL",
      playerId: awayKicker.id,
      playerName: awayKicker.name,
      clubId: awayClub.id,
    });
    const upd = playerUpdates[awayKicker.id];
    if (upd) {
      upd.statsDelta.dropGoals += 1;
      upd.statsDelta.points += 1;
      upd.statsDelta.matchRating = Math.min(10, upd.statsDelta.matchRating + 1.2);
    }
  }

  // Sort score events chronologically
  scoreEvents.sort((a, b) => a.minute - b.minute);

  // 6. Injuries & Discipline (yellow cards / red cards)
  const allMatchPlayers = [...homeSquad, ...awaySquad];
  for (const p of allMatchPlayers) {
    const upd = playerUpdates[p.id];
    if (!upd) continue;

    // Injury chance: ~3% per match, elevated by high fatigue
    const injuryProb = 0.03 + (p.fatigue / 100) * 0.04;
    if (Math.random() < injuryProb) {
      const template = INJURY_TYPES[Math.floor(Math.random() * INJURY_TYPES.length)];
      upd.injury = {
        type: template.name,
        weeksRemaining: template.weeks,
        severity: template.severity,
      };
      upd.statsDelta.matchRating = Math.max(4.0, upd.statsDelta.matchRating - 1.0);
    }

    // Suspension chance: ~1.5% chance of serious foul play / ban
    if (Math.random() < 0.015) {
      const weeks = Math.floor(Math.random() * 2) + 1;
      upd.suspension = {
        weeksRemaining: weeks,
        reason: "Dangerous contact / high tackle charge",
      };
      upd.statsDelta.matchRating = Math.max(3.0, upd.statsDelta.matchRating - 2.0);
    }

    // Dynamic Form update: rolling blend of current form and match rating
    const currentForm = p.form;
    const matchRating = upd.statsDelta.matchRating;
    upd.formNew = Number((currentForm * 0.7 + matchRating * 0.3).toFixed(1));

    // Morale impact
    const isPlayerHome = homeSquad.some(hp => hp.id === p.id);
    const playerWon = isPlayerHome ? homeWon : awayWon;
    const playerDrawn = homeScore === awayScore;

    if (playerWon) {
      upd.moraleDelta = Math.round(4 + Math.random() * 4);
    } else if (playerDrawn) {
      upd.moraleDelta = 0;
    } else {
      upd.moraleDelta = -Math.round(3 + Math.random() * 3);
    }
  }

  // 7. Determine Man of the Match (highest match rating from winning team)
  const winningSquad = homeWon ? homeSquad : (awayWon ? awaySquad : allMatchPlayers);
  const motmCandidate = winningSquad
    .map(p => ({ player: p, rating: playerUpdates[p.id]?.statsDelta.matchRating || 6.0 }))
    .sort((a, b) => b.rating - a.rating)[0];

  const manOfTheMatchPlayerId = motmCandidate?.player.id;
  if (manOfTheMatchPlayerId && playerUpdates[manOfTheMatchPlayerId]) {
    playerUpdates[manOfTheMatchPlayerId].statsDelta.motm = 1;
    playerUpdates[manOfTheMatchPlayerId].statsDelta.matchRating = Math.max(8.5, playerUpdates[manOfTheMatchPlayerId].statsDelta.matchRating);
  }

  // 8. Build player performances
  const playerPerformances: MatchPlayerPerformance[] = allMatchPlayers.map((p) => {
    const upd = playerUpdates[p.id];
    return {
      playerId: p.id,
      playerName: p.name,
      clubId: p.clubId || "",
      position: p.position,
      rating: Number((upd?.statsDelta.matchRating || 6.5).toFixed(1)),
      tries: upd?.statsDelta.tries || 0,
      goals: upd?.statsDelta.goals || 0,
      dropGoals: upd?.statsDelta.dropGoals || 0,
      points: upd?.statsDelta.points || 0,
      injured: upd?.injury != null,
    };
  });

  const updatedFixture: ManagerFixture = {
    ...fixture,
    isPlayed: true,
    homeScore,
    awayScore,
    scoreEvents,
    playerPerformances,
    manOfTheMatchPlayerId,
    attendance,
  };

  return {
    fixture: updatedFixture,
    playerUpdates,
  };
}
