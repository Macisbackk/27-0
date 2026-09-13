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
  ManagerKeyMoment,
  KeyMomentType,
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
import { CHAMPIONSHIP_ECONOMY } from "./rules";
import { pickBestGoalKicker } from "./goal-kicking";

function isPlayerAvailableForClub(
  player: ManagerPlayer,
  clubId: string
): boolean {
  if (player.loan) {
    return player.loan.destinationClubId === clubId;
  }
  return player.clubId === clubId;
}

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

const TRY_DESCRIPTIONS: Record<string, string[]> = {
  WING: [
    "{player} dives acrobatically into the corner under pressure, planting the ball just inside the flag!",
    "{player} showcases blistering pace down the touchline, turning the cover inside out to score!",
    "{player} collects a floating cutout pass on the wing and finishes clinical in the corner!",
    "{player} intercepts an errant pass on halfway and sprints away untouched to score!",
  ],
  CENTRE: [
    "{player} hits a searing diagonal line, stepping the fullback to slice through under the crossbar!",
    "{player} uses a devastating fend to shrug off the cover tackle and crash over out wide!",
    "{player} cuts back against the grain, splitting the defensive line from 20 metres out!",
  ],
  FULLBACK: [
    "{player} chimes into the backline with exquisite timing and glides across untouched!",
    "{player} tracks a midfield line break, taking the inside offload at speed to score!",
    "{player} fields a loose kick, weaves past three defenders and races away for a solo try!",
  ],
  STAND_OFF: [
    "{player} sells a massive dummy to the second row and glides through the gap under the posts!",
    "{player} drops a deft grubber kick behind the line, wins the race and grounds the ball!",
    "{player} orchestrates a gorgeous set play, slicing through himself to score!",
  ],
  SCRUM_HALF: [
    "{player} dances through the ruck defence with electric footwork to touch down!",
    "{player} chips ahead over the defensive line, re-gathers on the bounce and scores under the sticks!",
    "{player} spots a gap on the short side and accelerates through to score!",
  ],
  HOOKER: [
    "{player} catches the markers napping, darting from dummy-half to burrow under the crossbar!",
    "{player} scoops from dummy-half, dummies left and plunges over from point-blank range!",
  ],
  FORWARD: [
    "{player} charges onto a short ball at thunderous pace, smashing through two defenders to muscle over!",
    "{player} carries three tacklers over the stripe with unstoppable leg drive to ground the ball!",
    "{player} crashes onto an inside pass from close range and slams the ball over the whitewash!",
  ],
};

function getTryCommentary(player: ManagerPlayer): string {
  const pos = player.position;
  let pool = TRY_DESCRIPTIONS[pos];
  if (!pool) {
    if (["PROP", "SECOND_ROW", "LOOSE_FORWARD"].includes(pos)) {
      pool = TRY_DESCRIPTIONS.FORWARD;
    } else {
      pool = TRY_DESCRIPTIONS.CENTRE;
    }
  }
  const template = pool[Math.floor(Math.random() * pool.length)] || "{player} crosses the try line to score!";
  return template.replace("{player}", player.name);
}

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
      if (p && !p.injury && !p.suspension && isPlayerAvailableForClub(p, club.id)) {
        result.push(p);
      }
    }
    // If club doesn't have 17 available, fill from First/Reserves or loaned-in players
    if (result.length < 17) {
      const existingIds = new Set(result.map(p => p.id));
      const backup = Object.values(allPlayers)
        .filter(
          p =>
            isPlayerAvailableForClub(p, club.id) &&
            !p.injury &&
            !p.suspension &&
            !existingIds.has(p.id)
        )
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

    // Attacking style
    const style = club.tactics.style || "balanced";
    if (style === "expansive") effective += 0.55;
    if (style === "attritional") effective += isHome ? 0.25 : 0.45;
    if (style === "direct") effective += 0.35;

    // Kicking philosophy
    const kick = club.tactics.kickingFocus || "territory";
    if (kick === "territory") effective += 0.35;
    if (kick === "attacking") effective += 0.25;
    if (kick === "retention") effective += 0.2;

    // Home advantage (+1.5 rating points ~ 58-60% win rate between identical teams)
    if (isHome) effective += 1.5;

    return Math.max(45, Math.min(99, effective));
  }

  const homeEffective = calculateTeamRating(homeSquad, homeClub, true);
  const awayEffective = calculateTeamRating(awaySquad, awayClub, false);

  // 3. Generate match score based on rating differential with authentic RL variance
  const diff = homeEffective - awayEffective;

  // Expected margin scales with rating difference (~1.25 scoreboard points per rating diff)
  let expectedMargin = diff * 1.25;
  if (homeClub.tactics.style === "direct" && diff > 0) expectedMargin *= 1.08;
  if (awayClub.tactics.style === "direct" && diff < 0) expectedMargin *= 1.08;
  if (homeClub.tactics.style === "attritional" || awayClub.tactics.style === "attritional") {
    expectedMargin *= 0.92;
  }

  // Bell-curve match variance (Irwin-Hall n=3, range [-1.5, +1.5] * 10.5)
  // Ensures most matches (~70%) stay close to expected talent levels,
  // while upsets remain authentic, dramatic tail events.
  const bellRoll = Math.random() + Math.random() + Math.random() - 1.5;
  const noise = bellRoll * 10.5;
  const rawMargin = expectedMargin + noise;

  // Match tempo & total points variance — styles push tempo distribution
  const homeStyle = homeClub.tactics.style || "balanced";
  const awayStyle = awayClub.tactics.style || "balanced";
  const expansiveBias =
    (homeStyle === "expansive" ? 0.08 : 0) + (awayStyle === "expansive" ? 0.08 : 0);
  const attritionalBias =
    (homeStyle === "attritional" ? 0.08 : 0) + (awayStyle === "attritional" ? 0.08 : 0);
  let tempoRoll = Math.random() - attritionalBias + expansiveBias;
  tempoRoll = Math.max(0, Math.min(1, tempoRoll));
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

  // Attacking kick focus slightly opens the scoring
  if (
    homeClub.tactics.kickingFocus === "attacking" ||
    awayClub.tactics.kickingFocus === "attacking"
  ) {
    baseTotal += 2 + Math.random() * 3;
  }
  if (
    homeClub.tactics.kickingFocus === "territory" &&
    awayClub.tactics.kickingFocus === "territory"
  ) {
    baseTotal -= 2;
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

  // Snap / decompose regulation scores BEFORE golden-point +1 so the GP drop goal
  // is not also emitted as a regulation DG (odd finals always decompose with dropGoals: 1).
  const regulationHomeScore =
    goldenPointWinner === "home" ? Math.max(0, homeScore - 1) : homeScore;
  const regulationAwayScore =
    goldenPointWinner === "away" ? Math.max(0, awayScore - 1) : awayScore;
  const homeBreakdown = decomposeRLScore(regulationHomeScore);
  const awayBreakdown = decomposeRLScore(regulationAwayScore);

  const homeWon = homeScore > awayScore;
  const awayWon = awayScore > homeScore;

  // 4. Calculate attendance
  const capacity = homeClub.facilities.stadiumCapacity || 10000;
  const repPct = (homeClub.reputation / 5) * 0.5 + (awayClub.reputation / 5) * 0.3 + 0.2;
  let fillRate = repPct * 0.8 + Math.random() * 0.2;
  if (homeClub.competitionId === "championship") {
    fillRate *= CHAMPIONSHIP_ECONOMY.ATTENDANCE_FILL_MULTIPLIER;
  }
  const attendance = Math.min(capacity, Math.round(capacity * fillRate));

  // 5. Generate score events (tries, goals)
  const scoreEvents: MatchScoreEvent[] = [];
  const playerUpdates: MatchSimulationResult["playerUpdates"] = {};

  // Initialize tracking for all 34 players
  [...homeSquad, ...awaySquad].forEach((p) => {
    const isHome = homeSquad.some((hp) => hp.id === p.id);
    const club = isHome ? homeClub : awayClub;
    const perfQuality = club.facilities?.performance || 3;
    const fatigueRelief = perfQuality >= 5 ? 3 : perfQuality >= 4 ? 2 : 0;

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
      fatigueDelta: Math.max(8, Math.round(12 + Math.random() * 6 - fatigueRelief)),
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

  // Pick goal kickers — named primary, else best hidden goal-kicking ability
  const homeKicker =
    homeSquad.find((p) => p.id === homeClub.tactics.primaryGoalKickerId) ||
    pickBestGoalKicker(homeSquad) ||
    homeSquad[0];
  const awayKicker =
    awaySquad.find((p) => p.id === awayClub.tactics.primaryGoalKickerId) ||
    pickBestGoalKicker(awaySquad) ||
    awaySquad[0];

  interface RawMatchMoment {
    id: string;
    minute: number;
    type: KeyMomentType;
    clubId: string;
    clubName: string;
    playerId?: string;
    playerName?: string;
    playerPosition?: Position;
    title: string;
    headline?: string;
    description: string;
    pointsAdded: number;
    isHome: boolean;
    priorityOrder: number;
  }

  const rawMoments: RawMatchMoment[] = [];

  // 5a. Distribute home tries & paired conversions
  const homeTryMinutes: number[] = [];
  for (let t = 0; t < homeBreakdown.tries; t++) {
    homeTryMinutes.push(Math.min(76, Math.max(3, Math.floor(Math.random() * 73) + 3)));
  }
  homeTryMinutes.sort((a, b) => a - b);

  for (let t = 0; t < homeBreakdown.tries; t++) {
    const scorer = pickScorer(homeSquad);
    const minute = homeTryMinutes[t];
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
    rawMoments.push({
      id: `km_try_h_${t}_${fixture.id}`,
      minute,
      type: "TRY",
      clubId: homeClub.id,
      clubName: homeClub.name,
      playerId: scorer.id,
      playerName: scorer.name,
      playerPosition: scorer.position,
      title: `TRY! (${scorer.name})`,
      headline: `${homeClub.shortName} Crosses The Line!`,
      description: getTryCommentary(scorer),
      pointsAdded: 4,
      isHome: true,
      priorityOrder: 0,
    });

    // Pair conversion attempt at minute + 1
    const convMin = Math.min(78, minute + 1);
    const isConverted = t < homeBreakdown.conversions;
    if (isConverted && homeKicker) {
      scoreEvents.push({
        minute: convMin,
        type: "CONVERSION",
        playerId: homeKicker.id,
        playerName: homeKicker.name,
        clubId: homeClub.id,
      });
      const kickerUpd = playerUpdates[homeKicker.id];
      if (kickerUpd) {
        kickerUpd.statsDelta.goals += 1;
        kickerUpd.statsDelta.points += 2;
        kickerUpd.statsDelta.matchRating = Math.min(10, kickerUpd.statsDelta.matchRating + 0.3);
      }
      rawMoments.push({
        id: `km_conv_h_${t}_${fixture.id}`,
        minute: convMin,
        type: "CONVERSION",
        clubId: homeClub.id,
        clubName: homeClub.name,
        playerId: homeKicker.id,
        playerName: homeKicker.name,
        playerPosition: homeKicker.position,
        title: `Conversion Goal (${homeKicker.name})`,
        headline: "+2 Added From The Tee",
        description: `${homeKicker.name} strokes the conversion kick cleanly between the uprights.`,
        pointsAdded: 2,
        isHome: true,
        priorityOrder: 1,
      });
    } else if (!isConverted && homeKicker) {
      rawMoments.push({
        id: `km_miss_h_${t}_${fixture.id}`,
        minute: convMin,
        type: "MISSED_CONVERSION",
        clubId: homeClub.id,
        clubName: homeClub.name,
        playerId: homeKicker.id,
        playerName: homeKicker.name,
        playerPosition: homeKicker.position,
        title: "Conversion Missed",
        headline: "Extras Go Begging",
        description: `${homeKicker.name}'s conversion kick drifts across the face of the posts. Two points missed.`,
        pointsAdded: 0,
        isHome: true,
        priorityOrder: 1,
      });
    }
  }

  // Home penalty goals
  for (let p = 0; p < homeBreakdown.penalties; p++) {
    if (homeKicker) {
      const minute = Math.min(76, Math.max(8, Math.floor(Math.random() * 68) + 8));
      scoreEvents.push({
        minute,
        type: "PENALTY_GOAL",
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
      rawMoments.push({
        id: `km_pen_h_${p}_${fixture.id}`,
        minute,
        type: "PENALTY_GOAL",
        clubId: homeClub.id,
        clubName: homeClub.name,
        playerId: homeKicker.id,
        playerName: homeKicker.name,
        playerPosition: homeKicker.position,
        title: `Penalty Goal (${homeKicker.name})`,
        headline: "Points Off The Tee",
        description: `${homeKicker.name} calmly slots a 35-metre penalty goal to punish opposition indiscipline.`,
        pointsAdded: 2,
        isHome: true,
        priorityOrder: 2,
      });
    }
  }

  // 5b. Distribute away tries & paired conversions
  const awayTryMinutes: number[] = [];
  for (let t = 0; t < awayBreakdown.tries; t++) {
    awayTryMinutes.push(Math.min(76, Math.max(3, Math.floor(Math.random() * 73) + 3)));
  }
  awayTryMinutes.sort((a, b) => a - b);

  for (let t = 0; t < awayBreakdown.tries; t++) {
    const scorer = pickScorer(awaySquad);
    const minute = awayTryMinutes[t];
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
    rawMoments.push({
      id: `km_try_a_${t}_${fixture.id}`,
      minute,
      type: "TRY",
      clubId: awayClub.id,
      clubName: awayClub.name,
      playerId: scorer.id,
      playerName: scorer.name,
      playerPosition: scorer.position,
      title: `TRY! (${scorer.name})`,
      headline: `${awayClub.shortName} Crosses The Line!`,
      description: getTryCommentary(scorer),
      pointsAdded: 4,
      isHome: false,
      priorityOrder: 0,
    });

    // Pair conversion attempt at minute + 1
    const convMin = Math.min(78, minute + 1);
    const isConverted = t < awayBreakdown.conversions;
    if (isConverted && awayKicker) {
      scoreEvents.push({
        minute: convMin,
        type: "CONVERSION",
        playerId: awayKicker.id,
        playerName: awayKicker.name,
        clubId: awayClub.id,
      });
      const kickerUpd = playerUpdates[awayKicker.id];
      if (kickerUpd) {
        kickerUpd.statsDelta.goals += 1;
        kickerUpd.statsDelta.points += 2;
        kickerUpd.statsDelta.matchRating = Math.min(10, kickerUpd.statsDelta.matchRating + 0.3);
      }
      rawMoments.push({
        id: `km_conv_a_${t}_${fixture.id}`,
        minute: convMin,
        type: "CONVERSION",
        clubId: awayClub.id,
        clubName: awayClub.name,
        playerId: awayKicker.id,
        playerName: awayKicker.name,
        playerPosition: awayKicker.position,
        title: `Conversion Goal (${awayKicker.name})`,
        headline: "+2 Added From The Tee",
        description: `${awayKicker.name} safely adds the extras from the kicking tee.`,
        pointsAdded: 2,
        isHome: false,
        priorityOrder: 1,
      });
    } else if (!isConverted && awayKicker) {
      rawMoments.push({
        id: `km_miss_a_${t}_${fixture.id}`,
        minute: convMin,
        type: "MISSED_CONVERSION",
        clubId: awayClub.id,
        clubName: awayClub.name,
        playerId: awayKicker.id,
        playerName: awayKicker.name,
        playerPosition: awayKicker.position,
        title: "Conversion Missed",
        headline: "Extras Go Begging",
        description: `${awayKicker.name}'s conversion attempt drifts wide of the uprights.`,
        pointsAdded: 0,
        isHome: false,
        priorityOrder: 1,
      });
    }
  }

  // Away penalty goals
  for (let p = 0; p < awayBreakdown.penalties; p++) {
    if (awayKicker) {
      const minute = Math.min(76, Math.max(8, Math.floor(Math.random() * 68) + 8));
      scoreEvents.push({
        minute,
        type: "PENALTY_GOAL",
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
      rawMoments.push({
        id: `km_pen_a_${p}_${fixture.id}`,
        minute,
        type: "PENALTY_GOAL",
        clubId: awayClub.id,
        clubName: awayClub.name,
        playerId: awayKicker.id,
        playerName: awayKicker.name,
        playerPosition: awayKicker.position,
        title: `Penalty Goal (${awayKicker.name})`,
        headline: "Points Off The Tee",
        description: `${awayKicker.name} points to the sticks and strokes the two points with authority.`,
        pointsAdded: 2,
        isHome: false,
        priorityOrder: 2,
      });
    }
  }

  // Regulation drop goals (home)
  for (let d = 0; d < homeBreakdown.dropGoals; d++) {
    if (homeKicker) {
      const minute = Math.floor(Math.random() * 8) + 72;
      scoreEvents.push({
        minute,
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
      rawMoments.push({
        id: `km_dg_h_${d}_${fixture.id}`,
        minute,
        type: "DROP_GOAL",
        clubId: homeClub.id,
        clubName: homeClub.name,
        playerId: homeKicker.id,
        playerName: homeKicker.name,
        playerPosition: homeKicker.position,
        title: `DROP GOAL! (${homeKicker.name})`,
        headline: "Clutch One-Pointer!",
        description: `Ice in his veins! ${homeKicker.name} steps into the pocket and snaps a field goal between the uprights!`,
        pointsAdded: 1,
        isHome: true,
        priorityOrder: 3,
      });
    }
  }

  // Regulation drop goals (away)
  for (let d = 0; d < awayBreakdown.dropGoals; d++) {
    if (awayKicker) {
      const minute = Math.floor(Math.random() * 8) + 72;
      scoreEvents.push({
        minute,
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
      rawMoments.push({
        id: `km_dg_a_${d}_${fixture.id}`,
        minute,
        type: "DROP_GOAL",
        clubId: awayClub.id,
        clubName: awayClub.name,
        playerId: awayKicker.id,
        playerName: awayKicker.name,
        playerPosition: awayKicker.position,
        title: `DROP GOAL! (${awayKicker.name})`,
        headline: "Clutch One-Pointer!",
        description: `Ice in his veins! ${awayKicker.name} steps into the pocket and snaps a field goal between the uprights!`,
        pointsAdded: 1,
        isHome: false,
        priorityOrder: 3,
      });
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
    rawMoments.push({
      id: `km_dg_gp_${fixture.id}`,
      minute: 83,
      type: "DROP_GOAL",
      clubId: homeClub.id,
      clubName: homeClub.name,
      playerId: homeKicker.id,
      playerName: homeKicker.name,
      playerPosition: homeKicker.position,
      title: `GOLDEN POINT WINNER! (${homeKicker.name})`,
      headline: "Sudden-Death Match Winner!",
      description: `HEROIC MOMENT! ${homeKicker.name} lands the golden point drop goal in extra time to seal an unforgettable win!`,
      pointsAdded: 1,
      isHome: true,
      priorityOrder: 3,
    });
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
    rawMoments.push({
      id: `km_dg_gp_${fixture.id}`,
      minute: 83,
      type: "DROP_GOAL",
      clubId: awayClub.id,
      clubName: awayClub.name,
      playerId: awayKicker.id,
      playerName: awayKicker.name,
      playerPosition: awayKicker.position,
      title: `GOLDEN POINT WINNER! (${awayKicker.name})`,
      headline: "Sudden-Death Match Winner!",
      description: `HEROIC MOMENT! ${awayKicker.name} lands the golden point drop goal in extra time to seal an unforgettable win!`,
      pointsAdded: 1,
      isHome: false,
      priorityOrder: 3,
    });
  }

  // Sort score events chronologically
  scoreEvents.sort((a, b) => a.minute - b.minute);

  // 6. Injuries & Discipline (yellow cards / red cards)
  const allMatchPlayers = [...homeSquad, ...awaySquad];
  const hasRedCards: Record<string, boolean> = {};

  for (const p of allMatchPlayers) {
    const upd = playerUpdates[p.id];
    if (!upd) continue;

    const isPlayerHome = homeSquad.some(hp => hp.id === p.id);
    const club = isPlayerHome ? homeClub : awayClub;
    const medQuality = club.facilities?.medical || 3;
    const analyticsQuality = club.facilities?.analytics || 2;
    const hasPhysicalBuff = p.careerBuffs?.some(b => b.type === "physical_transformation");

    // Injury chance: ~3% per match, elevated by high fatigue, mitigated by medical facilities & conditioning
    let injuryProb = 0.03 + (p.fatigue / 100) * 0.04;
    if (medQuality > 3) {
      injuryProb *= (1 - (medQuality - 3) * 0.20); // 4 stars: -20%, 5 stars: -40% injury risk
    }
    if (hasPhysicalBuff) {
      injuryProb *= 0.65; // Biomechanics transformation reduces injury vulnerability
    }

    if (Math.random() < injuryProb) {
      const template = INJURY_TYPES[Math.floor(Math.random() * INJURY_TYPES.length)];
      upd.injury = {
        type: template.name,
        weeksRemaining: template.weeks,
        severity: template.severity,
      };
      upd.statsDelta.matchRating = Math.max(4.0, upd.statsDelta.matchRating - 1.0);

      const injuryMin = Math.floor(Math.random() * 65) + 10;
      rawMoments.push({
        id: `km_inj_${p.id}_${fixture.id}`,
        minute: injuryMin,
        type: "INJURY",
        clubId: isPlayerHome ? homeClub.id : awayClub.id,
        clubName: isPlayerHome ? homeClub.name : awayClub.name,
        playerId: p.id,
        playerName: p.name,
        playerPosition: p.position,
        title: "Injury Concern",
        headline: `${p.name} Forced Off`,
        description: `Stoppage in play as ${p.name} goes down clutching his ${template.name.toLowerCase()} and is helped off by medical staff.`,
        pointsAdded: 0,
        isHome: isPlayerHome,
        priorityOrder: 5,
      });
    }

    // Suspension chance: ~1.5% chance of serious foul play / ban; tactical video review reduces reckless tackles
    let redCardProb = 0.015;
    if (analyticsQuality >= 5) redCardProb = 0.007;
    else if (analyticsQuality >= 4) redCardProb = 0.010;

    if (Math.random() < redCardProb) {
      const weeks = Math.floor(Math.random() * 2) + 1;
      upd.suspension = {
        weeksRemaining: weeks,
        reason: "Dangerous contact / high tackle charge",
      };
      upd.statsDelta.matchRating = Math.max(3.0, upd.statsDelta.matchRating - 2.0);

      hasRedCards[p.id] = true;
      const cardMin = Math.floor(Math.random() * 55) + 15;
      rawMoments.push({
        id: `km_red_${p.id}_${fixture.id}`,
        minute: cardMin,
        type: "RED_CARD",
        clubId: isPlayerHome ? homeClub.id : awayClub.id,
        clubName: isPlayerHome ? homeClub.name : awayClub.name,
        playerId: p.id,
        playerName: p.name,
        playerPosition: p.position,
        title: "RED CARD!",
        headline: `${p.name} Sent Off!`,
        description: `RED CARD! The referee dismisses ${p.name} for dangerous foul play. Team reduced to 12 men!`,
        pointsAdded: 0,
        isHome: isPlayerHome,
        priorityOrder: 4,
      });
    }

    // Dynamic Form update: rolling blend of current form and match rating
    const currentForm = p.form;
    const matchRating = upd.statsDelta.matchRating;
    upd.formNew = Number((currentForm * 0.7 + matchRating * 0.3).toFixed(1));

    // Morale impact
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

  // Sin bins: ~25% chance of a 10-minute yellow card if no red card occurred
  const sinBins: Record<string, boolean> = {};
  if (Object.keys(hasRedCards).length === 0 && Math.random() < 0.25) {
    const candidate = Math.random() < 0.5
      ? homeSquad[Math.floor(Math.random() * Math.min(13, homeSquad.length))]
      : awaySquad[Math.floor(Math.random() * Math.min(13, awaySquad.length))];
    if (candidate) {
      const isCandidateHome = homeSquad.some(hp => hp.id === candidate.id);
      const binMin = Math.floor(Math.random() * 50) + 15;
      sinBins[candidate.id] = true;
      rawMoments.push({
        id: `km_bin_${candidate.id}_${fixture.id}`,
        minute: binMin,
        type: "SIN_BIN",
        clubId: isCandidateHome ? homeClub.id : awayClub.id,
        clubName: isCandidateHome ? homeClub.name : awayClub.name,
        playerId: candidate.id,
        playerName: candidate.name,
        playerPosition: candidate.position,
        title: "Sin Bin (10 min)",
        headline: `Yellow Card for ${candidate.name}`,
        description: `10 minutes in the sin bin! The referee sends ${candidate.name} for a cool-off after repeated ruck infringements.`,
        pointsAdded: 0,
        isHome: isCandidateHome,
        priorityOrder: 4,
      });
    }
  }

  // Tactical highlights (~35% chance): 40/20 kick or try-saving tackle
  if (Math.random() < 0.35) {
    const isHighlightHome = Math.random() < 0.5;
    const highlightSquad = isHighlightHome ? homeSquad : awaySquad;
    const highlightClub = isHighlightHome ? homeClub : awayClub;
    const candidate = highlightSquad.find(p => ["FULLBACK", "STAND_OFF", "SCRUM_HALF", "WING"].includes(p.position)) || highlightSquad[0];
    if (candidate) {
      const isFortyTwenty = Math.random() < 0.5;
      const min = Math.floor(Math.random() * 50) + 20;
      if (isFortyTwenty) {
        rawMoments.push({
          id: `km_4020_${candidate.id}_${fixture.id}`,
          minute: min,
          type: "FORTY_TWENTY",
          clubId: highlightClub.id,
          clubName: highlightClub.name,
          playerId: candidate.id,
          playerName: candidate.name,
          playerPosition: candidate.position,
          title: "40/20 Kick!",
          headline: "Masterclass Touch!",
          description: `Superb execution! ${candidate.name} drills a spiraling 40/20 kick that bounces inside the 20 to earn an attacking scrum!`,
          pointsAdded: 0,
          isHome: isHighlightHome,
          priorityOrder: 5,
        });
      } else {
        rawMoments.push({
          id: `km_ts_${candidate.id}_${fixture.id}`,
          minute: min,
          type: "TRY_SAVER",
          clubId: highlightClub.id,
          clubName: highlightClub.name,
          playerId: candidate.id,
          playerName: candidate.name,
          playerPosition: candidate.position,
          title: "Try-Saving Tackle",
          headline: "Heroic Goal-Line Defense",
          description: `UNBELIEVABLE DEFENSE! ${candidate.name} pulls off a heroic last-ditch ankle tap to deny a certain try right on the line!`,
          pointsAdded: 0,
          isHome: isHighlightHome,
          priorityOrder: 5,
        });
      }
    }
  }

  // Sort raw moments chronologically
  rawMoments.sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute;
    return a.priorityOrder - b.priorityOrder;
  });

  // Assemble full key moments sequence with Half-Time, Golden Point, and Full-Time
  const assembledMoments: RawMatchMoment[] = [];
  let halfTimeAdded = false;

  for (const m of rawMoments) {
    if (!halfTimeAdded && m.minute > 40) {
      assembledMoments.push({
        id: `km_ht_${fixture.id}`,
        minute: 40,
        type: "HALF_TIME",
        clubId: homeClub.id,
        clubName: homeClub.name,
        title: "Half-Time Interval",
        headline: "Teams Head To The Sheds",
        description: "The half-time hooter sounds. Teams head into the sheds with the contest finely balanced.",
        pointsAdded: 0,
        isHome: true,
        priorityOrder: 8,
      });
      halfTimeAdded = true;
    }
    assembledMoments.push(m);
  }

  if (!halfTimeAdded) {
    assembledMoments.push({
      id: `km_ht_${fixture.id}`,
      minute: 40,
      type: "HALF_TIME",
      clubId: homeClub.id,
      clubName: homeClub.name,
      title: "Half-Time Interval",
      headline: "Teams Head To The Sheds",
      description: "The half-time hooter sounds. Teams head into the sheds with the contest finely balanced.",
      pointsAdded: 0,
      isHome: true,
      priorityOrder: 8,
    });
  }

  if (goldenPointWinner) {
    const gpBanner = {
      id: `km_gp_${fixture.id}`,
      minute: 80,
      type: "GOLDEN_POINT" as const,
      clubId: homeClub.id,
      clubName: homeClub.name,
      title: "Golden Point Extra Time",
      headline: "Deadlock After 80 Minutes!",
      description: "Regulation 80 minutes finishes level! Sudden-death Golden Point extra time begins — next score wins it!",
      pointsAdded: 0,
      isHome: true,
      priorityOrder: 9,
    };
    // Insert before any post-80 scoring moment (winning drop goal), not after it
    const extraTimeIdx = assembledMoments.findIndex((m) => m.minute > 80);
    if (extraTimeIdx >= 0) {
      assembledMoments.splice(extraTimeIdx, 0, gpBanner);
    } else {
      assembledMoments.push(gpBanner);
    }
  }

  // Full-time moment
  assembledMoments.push({
    id: `km_ft_${fixture.id}`,
    minute: goldenPointWinner ? 83 : 80,
    type: "FULL_TIME",
    clubId: homeClub.id,
    clubName: homeClub.name,
    title: "Full-Time Hooter",
    headline: homeWon ? `${homeClub.shortName} Win!` : awayWon ? `${awayClub.shortName} Win!` : "Match Drawn!",
    description: homeWon
      ? `The full-time hooter rings out! ${homeClub.name} secure a spirited victory ${homeScore} - ${awayScore}!`
      : awayWon
      ? `Full-time! ${awayClub.name} clinch a famous away triumph ${awayScore} - ${homeScore}!`
      : `The hooter blows! A ferocious 80-minute contest ends in a dramatic draw at ${homeScore} - ${awayScore}!`,
    pointsAdded: 0,
    isHome: true,
    priorityOrder: 10,
  });

  // Calculate running scores for all moments
  let runningHome = 0;
  let runningAway = 0;
  const keyMoments: ManagerKeyMoment[] = assembledMoments.map((m) => {
    if (m.pointsAdded > 0) {
      if (m.isHome) runningHome += m.pointsAdded;
      else runningAway += m.pointsAdded;
    }

    let desc = m.description;
    if (m.type === "HALF_TIME") {
      desc = `The half-time hooter sounds. Teams head to the sheds with the scoreboard reading ${homeClub.shortName} ${runningHome} - ${runningAway} ${awayClub.shortName}.`;
    }

    let importance: "standard" | "high" | "critical" = "standard";
    if (m.type === "GOLDEN_POINT" || m.type === "RED_CARD") {
      importance = "critical";
    } else if (m.type === "FULL_TIME") {
      importance = Math.abs(homeScore - awayScore) <= 4 ? "critical" : "high";
    } else if (m.type === "TRY" || m.type === "DROP_GOAL") {
      importance = m.minute >= 70 && Math.abs(runningHome - runningAway) <= 6 ? "critical" : "high";
    } else if (m.type === "SIN_BIN" || m.type === "TRY_SAVER" || m.type === "FORTY_TWENTY" || m.type === "HALF_TIME") {
      importance = "high";
    }

    // FULL_TIME must mirror the fixture scoreline (never inflated running totals)
    const scoreHome = m.type === "FULL_TIME" ? homeScore : runningHome;
    const scoreAway = m.type === "FULL_TIME" ? awayScore : runningAway;

    return {
      id: m.id,
      minute: m.minute,
      type: m.type,
      clubId: m.clubId,
      clubName: m.clubName,
      playerId: m.playerId,
      playerName: m.playerName,
      playerPosition: m.playerPosition,
      title: m.title,
      headline: m.headline,
      description: desc,
      homeScoreAfter: scoreHome,
      awayScoreAfter: scoreAway,
      isHome: m.isHome,
      importance,
      pointsAdded: m.pointsAdded > 0 ? m.pointsAdded : undefined,
    };
  });

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
    const isPlayerHome = homeSquad.some(hp => hp.id === p.id);
    const playingClubId = isPlayerHome ? homeClub.id : awayClub.id;
    return {
      playerId: p.id,
      playerName: p.name,
      clubId: playingClubId,
      position: p.position,
      rating: Number((upd?.statsDelta.matchRating || 6.5).toFixed(1)),
      tries: upd?.statsDelta.tries || 0,
      goals: upd?.statsDelta.goals || 0,
      dropGoals: upd?.statsDelta.dropGoals || 0,
      points: upd?.statsDelta.points || 0,
      injured: upd?.injury != null,
      sinBin: Boolean(sinBins[p.id]),
      sentOff: Boolean(hasRedCards[p.id]),
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
    keyMoments,
  };

  return {
    fixture: updatedFixture,
    playerUpdates,
  };
}

/**
 * Event points for score timeline reconciliation.
 */
function scoreEventPoints(type: MatchScoreEvent["type"]): number {
  if (type === "TRY") return 4;
  if (type === "DROP_GOAL") return 1;
  return 2;
}

/**
 * Strip scoring events that overshoot the official fixture result
 * (legacy golden-point double-count left an extra DROP_GOAL in the timeline).
 */
export function reconcileFixtureScoreEvents(fixture: ManagerFixture): MatchScoreEvent[] {
  const events = [...(fixture.scoreEvents || [])].sort((a, b) => a.minute - b.minute);
  const targetHome = fixture.homeScore || 0;
  const targetAway = fixture.awayScore || 0;
  if (events.length === 0) return events;

  const sumEvents = (list: MatchScoreEvent[]) => {
    let h = 0;
    let a = 0;
    for (const e of list) {
      const pts = scoreEventPoints(e.type);
      if (e.clubId === fixture.homeClubId) h += pts;
      else a += pts;
    }
    return { h, a };
  };

  let { h, a } = sumEvents(events);
  if (h === targetHome && a === targetAway) return events;

  const next = [...events];
  while (next.length > 0 && (h > targetHome || a > targetAway)) {
    let removeIdx = -1;
    for (let i = next.length - 1; i >= 0; i--) {
      const e = next[i];
      if (e.type !== "DROP_GOAL") continue;
      const isHome = e.clubId === fixture.homeClubId;
      if ((isHome && h > targetHome) || (!isHome && a > targetAway)) {
        removeIdx = i;
        break;
      }
    }
    if (removeIdx < 0) break;
    next.splice(removeIdx, 1);
    ({ h, a } = sumEvents(next));
  }

  return next;
}

/**
 * Align stored key-moment scoreboards with the official fixture result.
 * Drops surplus scoring moments that overshoot (legacy GP double-count).
 */
export function reconcileFixtureKeyMoments(
  moments: ManagerKeyMoment[],
  fixture: ManagerFixture
): ManagerKeyMoment[] {
  const targetHome = fixture.homeScore || 0;
  const targetAway = fixture.awayScore || 0;
  if (!moments.length) return moments;

  const sorted = [...moments].sort((a, b) => {
    if (a.minute !== b.minute) return a.minute - b.minute;
    const order = (t: KeyMomentType) =>
      t === "HALF_TIME" ? 0 : t === "GOLDEN_POINT" ? 8 : t === "FULL_TIME" ? 9 : 1;
    return order(a.type) - order(b.type);
  });

  let runningHome = 0;
  let runningAway = 0;
  const out: ManagerKeyMoment[] = [];

  for (const m of sorted) {
    const pts = m.pointsAdded || 0;
    if (pts > 0) {
      const nextH = m.isHome ? runningHome + pts : runningHome;
      const nextA = m.isHome ? runningAway : runningAway + pts;
      if (nextH > targetHome || nextA > targetAway) {
        continue;
      }
      runningHome = nextH;
      runningAway = nextA;
    }

    if (m.type === "FULL_TIME") {
      out.push({
        ...m,
        homeScoreAfter: targetHome,
        awayScoreAfter: targetAway,
        description: m.description
          .replace(/\d+\s*-\s*\d+/g, `${targetHome} - ${targetAway}`)
          .replace(/\d+\s*–\s*\d+/g, `${targetHome} – ${targetAway}`),
      });
    } else {
      out.push({
        ...m,
        homeScoreAfter: runningHome,
        awayScoreAfter: runningAway,
      });
    }
  }

  if (!out.some((m) => m.type === "FULL_TIME")) {
    out.push({
      id: `heal_ft_${fixture.id}`,
      minute: 80,
      type: "FULL_TIME",
      clubId: fixture.homeClubId,
      clubName: sorted[0]?.clubName || fixture.homeClubId,
      title: "Full-Time Hooter",
      headline: "Full Time",
      description: `Full-time: ${targetHome} - ${targetAway}`,
      homeScoreAfter: targetHome,
      awayScoreAfter: targetAway,
      isHome: true,
      importance: "high",
    });
  }

  return out;
}

/**
 * Ensures a fixture has key moments.
 * If fixture.keyMoments is populated, returns it (reconciled to official scores).
 * Otherwise, synthesizes realistic chronological key moments from score events,
 * player performances, and full-time scorelines so managers can always view key moments.
 */
export function ensureFixtureKeyMoments(
  fixture: ManagerFixture,
  clubs?: Record<string, ManagerClub>
): ManagerKeyMoment[] {
  if (fixture.keyMoments && fixture.keyMoments.length > 0) {
    return reconcileFixtureKeyMoments(fixture.keyMoments, fixture);
  }

  const homeClub = clubs?.[fixture.homeClubId] || {
    id: fixture.homeClubId,
    name: fixture.homeClubId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    shortName: fixture.homeClubId.slice(0, 3).toUpperCase(),
  };
  const awayClub = clubs?.[fixture.awayClubId] || {
    id: fixture.awayClubId,
    name: fixture.awayClubId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    shortName: fixture.awayClubId.slice(0, 3).toUpperCase(),
  };

  const homeScore = fixture.homeScore || 0;
  const awayScore = fixture.awayScore || 0;
  const rawEvents = reconcileFixtureScoreEvents(fixture);

  let runningHome = 0;
  let runningAway = 0;
  const moments: ManagerKeyMoment[] = [];
  let halfTimeInserted = false;

  rawEvents.forEach((evt, idx) => {
    if (!halfTimeInserted && evt.minute > 40) {
      moments.push({
        id: `synth_ht_${fixture.id}`,
        minute: 40,
        type: "HALF_TIME",
        clubId: homeClub.id,
        clubName: homeClub.name,
        title: "Half-Time Interval",
        headline: "Teams Head To The Sheds",
        description: `Half-time hooter sounds with the score at ${homeClub.shortName} ${runningHome} - ${runningAway} ${awayClub.shortName}.`,
        homeScoreAfter: runningHome,
        awayScoreAfter: runningAway,
        isHome: true,
        importance: "high",
      });
      halfTimeInserted = true;
    }

    const isHome = evt.clubId === fixture.homeClubId;
    const pts = evt.type === "TRY" ? 4 : evt.type === "DROP_GOAL" ? 1 : 2;
    if (isHome) runningHome += pts;
    else runningAway += pts;

    const clubName = isHome ? homeClub.name : awayClub.name;
    const clubShort = isHome ? homeClub.shortName : awayClub.shortName;

    moments.push({
      id: `synth_evt_${idx}_${fixture.id}`,
      minute: evt.minute,
      type: evt.type,
      clubId: evt.clubId,
      clubName,
      playerId: evt.playerId,
      playerName: evt.playerName,
      title: `${evt.type === "TRY" ? "TRY!" : evt.type === "CONVERSION" ? "Conversion Goal" : evt.type === "PENALTY_GOAL" ? "Penalty Goal" : "DROP GOAL!"} (${evt.playerName})`,
      headline: `${clubShort} ${evt.type === "TRY" ? "Crosses The Line!" : "Scores Off The Tee"}`,
      description: `${evt.playerName} registers a ${evt.type.toLowerCase().replace(/_/g, " ")} for ${clubName}.`,
      homeScoreAfter: runningHome,
      awayScoreAfter: runningAway,
      isHome,
      importance: evt.type === "TRY" ? "high" : "standard",
      pointsAdded: pts,
    });
  });

  if (!halfTimeInserted) {
    moments.push({
      id: `synth_ht_${fixture.id}`,
      minute: 40,
      type: "HALF_TIME",
      clubId: homeClub.id,
      clubName: homeClub.name,
      title: "Half-Time Interval",
      headline: "Teams Head To The Sheds",
      description: `Half-time hooter sounds with the score at ${homeClub.shortName} ${runningHome} - ${runningAway} ${awayClub.shortName}.`,
      homeScoreAfter: runningHome,
      awayScoreAfter: runningAway,
      isHome: true,
      importance: "high",
    });
  }

  // Injuries from performances
  if (fixture.playerPerformances) {
    fixture.playerPerformances
      .filter((p) => p.injured)
      .forEach((p, idx) => {
        const isHome = p.clubId === fixture.homeClubId;
        moments.push({
          id: `synth_inj_${idx}_${fixture.id}`,
          minute: Math.min(75, 25 + idx * 18),
          type: "INJURY",
          clubId: p.clubId,
          clubName: isHome ? homeClub.name : awayClub.name,
          playerId: p.playerId,
          playerName: p.playerName,
          playerPosition: p.position,
          title: "Injury Concern",
          headline: `${p.playerName} Forced Off`,
          description: `${p.playerName} is forced from the pitch following a heavy collision.`,
          homeScoreAfter: runningHome,
          awayScoreAfter: runningAway,
          isHome,
          importance: "standard",
        });
      });
  }

  moments.sort((a, b) => a.minute - b.minute);

  // Full-Time
  const homeWon = homeScore > awayScore;
  const awayWon = awayScore > homeScore;
  moments.push({
    id: `synth_ft_${fixture.id}`,
    minute: 80,
    type: "FULL_TIME",
    clubId: homeClub.id,
    clubName: homeClub.name,
    title: "Full-Time Hooter",
    headline: homeWon ? `${homeClub.shortName} Win!` : awayWon ? `${awayClub.shortName} Win!` : "Honours Even!",
    description: homeWon
      ? `Full-time hooter sounds! ${homeClub.name} claim victory ${homeScore} - ${awayScore}!`
      : awayWon
      ? `Full-time hooter sounds! ${awayClub.name} take the spoils ${awayScore} - ${homeScore}!`
      : `Full-time hooter sounds! A ferocious battle ends in a draw ${homeScore} - ${awayScore}!`,
    homeScoreAfter: homeScore,
    awayScoreAfter: awayScore,
    isHome: true,
    importance: Math.abs(homeScore - awayScore) <= 4 ? "critical" : "high",
  });

  return moments;
}
