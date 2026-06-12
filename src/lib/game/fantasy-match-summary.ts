import seedrandom from "seedrandom";
import { DREAM_TEAM_NAME, type MatchFixture } from "./season-simulation";
import type { SquadSlot } from "../types";
import { selectClubMatchSquad } from "./opponent-scorers";
import { getEffectivePeakRating } from "../squad-analysis";

export interface ManOfTheMatch {
  playerId: string;
  playerName: string;
  teamName: string;
  performanceSummary?: string;
  tries?: number;
}

interface MotmCandidate {
  playerId: string;
  playerName: string;
  teamName: string;
  rating: number;
  tries: number;
  conversions: number;
  penalties: number;
  dropGoals: number;
  won: boolean;
}

const WIN_BIOS = [
  "A controlled performance with the squad taking their chances when it mattered.",
  "Professional from start to finish — the Dream Team did enough to get the job done.",
  "Solid all-round display and a result that keeps the season on track.",
];

const BIG_WIN_BIOS = [
  "A dominant display from start to finish, with the attack looking dangerous all afternoon.",
  "Ruthless from the opening set — this was a statement performance.",
  "The opposition never got a foothold in a one-sided afternoon.",
];

const CLOSE_WIN_BIOS = [
  "A tight one, but your side found a way to get over the line.",
  "Nail-biting at times, yet the Dream Team held their nerve when it counted.",
  "A gritty win secured by fine margins and real composure late on.",
];

const LOSS_BIOS = [
  "A frustrating result where missed chances proved costly.",
  "Not enough accuracy in the big moments — a defeat that stings.",
  "The Dream Team fell short despite patches of promising play.",
];

const HEAVY_LOSS_BIOS = [
  "A tough outing, with the opposition controlling the game for long spells.",
  "Outplayed for large periods and unable to stem the tide.",
  "A difficult afternoon where the better side took control early.",
];

const CLOSE_LOSS_BIOS = [
  "So close — a single moment separated the sides on the day.",
  "A narrow defeat that could easily have swung the other way.",
  "Heartbreakingly tight, with little to choose between the teams.",
];

function pickVariant(lines: string[], seed: string, round: number): string {
  const rng = seedrandom(`${seed}-bio-r${round}`);
  return lines[Math.floor(rng() * lines.length)];
}

function isCloseMargin(margin: number): boolean {
  return margin <= 6;
}

function isHeavyMargin(margin: number, isThrashing?: boolean): boolean {
  return isThrashing === true || margin >= 20;
}

export function generateFantasyMatchBio(
  fixture: MatchFixture,
  seed: string,
  motm?: ManOfTheMatch
): string {
  const margin = Math.abs(fixture.pointsFor - fixture.pointsAgainst);
  const won = fixture.result === "W";
  const close = isCloseMargin(margin);
  const heavy = isHeavyMargin(margin, fixture.isThrashing);

  let base: string;
  if (won) {
    if (heavy) base = pickVariant(BIG_WIN_BIOS, seed, fixture.round);
    else if (close) base = pickVariant(CLOSE_WIN_BIOS, seed, fixture.round);
    else base = pickVariant(WIN_BIOS, seed, fixture.round);
  } else if (heavy) {
    base = pickVariant(HEAVY_LOSS_BIOS, seed, fixture.round);
  } else if (close) {
    base = pickVariant(CLOSE_LOSS_BIOS, seed, fixture.round);
  } else {
    base = pickVariant(LOSS_BIOS, seed, fixture.round);
  }

  if (motm && (motm.tries ?? 0) >= 2) {
    return `${base} ${motm.playerName} led the way with a standout showing.`;
  }

  return base;
}

function formatPerformanceSummary(parts: string[]): string | undefined {
  if (parts.length === 0) return undefined;
  return parts.join(", ");
}

function scoreMotmCandidate(
  candidate: MotmCandidate,
  margin: number
): number {
  const close = isCloseMargin(margin);
  let score = 0;
  score += candidate.tries * 8;
  score += candidate.conversions * 2;
  score += candidate.penalties * 3;
  score += candidate.dropGoals * 4;
  if (candidate.won) score += 5;
  if (
    close &&
    (candidate.tries > 0 ||
      candidate.conversions > 0 ||
      candidate.penalties > 0 ||
      candidate.dropGoals > 0)
  ) {
    score += 3;
  }
  score += candidate.rating / 10;
  return score;
}

function addDreamTeamCandidates(
  candidates: MotmCandidate[],
  fixture: MatchFixture,
  squad: SquadSlot[]
): void {
  const detail = fixture.scoringDetail?.dreamTeam;
  if (!detail) return;

  const won = fixture.result === "W";
  const ratingById = new Map<string, number>();
  for (const slot of squad) {
    if (slot.player) {
      ratingById.set(slot.player.id, getEffectivePeakRating(slot));
    }
  }

  for (const scorer of detail.tryScorers) {
    candidates.push({
      playerId: scorer.playerId,
      playerName: scorer.name,
      teamName: DREAM_TEAM_NAME,
      rating: ratingById.get(scorer.playerId) ?? 80,
      tries: scorer.tries,
      conversions: 0,
      penalties: 0,
      dropGoals: 0,
      won,
    });
  }

  const kicking = detail.kicking;
  if (kicking) {
    const existing = candidates.find((c) => c.playerId === kicking.playerId);
    if (existing) {
      existing.conversions += kicking.conversions;
      existing.penalties += kicking.penalties;
      existing.dropGoals += kicking.dropGoals;
    } else {
      candidates.push({
        playerId: kicking.playerId,
        playerName: kicking.name,
        teamName: DREAM_TEAM_NAME,
        rating: ratingById.get(kicking.playerId) ?? 80,
        tries: 0,
        conversions: kicking.conversions,
        penalties: kicking.penalties,
        dropGoals: kicking.dropGoals,
        won,
      });
    }
  }
}

function addOpponentCandidates(
  candidates: MotmCandidate[],
  fixture: MatchFixture,
  seed: string
): void {
  const detail = fixture.scoringDetail?.opponent;
  if (!detail) return;

  const won = fixture.result === "L";
  const squad = selectClubMatchSquad(fixture.opponent, seed, fixture.round);
  const ratingById = new Map(squad.map((p) => [p.id, p.peakRating]));

  for (const scorer of detail.tryScorers) {
    candidates.push({
      playerId: scorer.playerId,
      playerName: scorer.name,
      teamName: fixture.opponent,
      rating: ratingById.get(scorer.playerId) ?? 80,
      tries: scorer.tries,
      conversions: 0,
      penalties: 0,
      dropGoals: 0,
      won,
    });
  }

  const kicking = detail.kicking;
  if (kicking) {
    const existing = candidates.find((c) => c.playerId === kicking.playerId);
    if (existing) {
      existing.conversions += kicking.conversions;
      existing.penalties += kicking.penalties;
      existing.dropGoals += kicking.dropGoals;
    } else {
      candidates.push({
        playerId: kicking.playerId,
        playerName: kicking.name,
        teamName: fixture.opponent,
        rating: ratingById.get(kicking.playerId) ?? 80,
        tries: 0,
        conversions: kicking.conversions,
        penalties: kicking.penalties,
        dropGoals: kicking.dropGoals,
        won,
      });
    }
  }
}

function buildPerformanceSummary(candidate: MotmCandidate): string | undefined {
  const parts: string[] = [];
  if (candidate.tries > 0) {
    parts.push(`${candidate.tries} try${candidate.tries !== 1 ? "s" : ""}`);
  }
  const goals =
    candidate.conversions + candidate.penalties + candidate.dropGoals;
  if (goals > 0) {
    parts.push(`${goals} goal${goals !== 1 ? "s" : ""}`);
  }
  return formatPerformanceSummary(parts);
}

export function selectManOfTheMatch(
  fixture: MatchFixture,
  squad: SquadSlot[],
  seed: string
): ManOfTheMatch | undefined {
  const candidates: MotmCandidate[] = [];
  addDreamTeamCandidates(candidates, fixture, squad);
  addOpponentCandidates(candidates, fixture, seed);

  if (candidates.length === 0) return undefined;

  const margin = Math.abs(fixture.pointsFor - fixture.pointsAgainst);
  const scored = candidates.map((candidate) => ({
    candidate,
    score: scoreMotmCandidate(candidate, margin),
  }));
  scored.sort((a, b) => b.score - a.score);
  const topScore = scored[0].score;
  const tied = scored.filter((entry) => entry.score === topScore);
  const rng = seedrandom(`${seed}-motm-r${fixture.round}`);
  const picked = tied[Math.floor(rng() * tied.length)].candidate;

  return {
    playerId: picked.playerId,
    playerName: picked.playerName,
    teamName: picked.teamName,
    performanceSummary: buildPerformanceSummary(picked),
    tries: picked.tries > 0 ? picked.tries : undefined,
  };
}

export function enrichFantasyFixtureSummary(
  fixture: MatchFixture,
  squad: SquadSlot[],
  seed: string
): void {
  const motm = selectManOfTheMatch(fixture, squad, seed);
  if (motm) {
    fixture.manOfTheMatch = motm;
  }
  fixture.matchBio = generateFantasyMatchBio(fixture, seed, motm);
}
