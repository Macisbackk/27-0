import { getPlayerById } from "../players";
import { getCurrentSquadPlayerIds } from "../players/era-teams";
import type { ManagerCareer, ManagerSeasonSummary } from "./types";
import { DEFAULT_TACTICS } from "./types";
import {
  getManagerClubConfig,
  buildDefaultLineup,
} from "./club-config";
import { createInitialPlayerState } from "./managerSquad";
import { buildManagerSchedule, buildLeagueTableFromMatches } from "./managerFixtures";
import { generateTransferMarket } from "./managerTransfers";
import { getUserLeaguePosition } from "./managerFixtures";

const CAREER_KEY = "27-0-manager-career";

export function loadManagerCareer(): ManagerCareer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CAREER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ManagerCareer;
  } catch {
    return null;
  }
}

export function saveManagerCareer(career: ManagerCareer): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    CAREER_KEY,
    JSON.stringify({ ...career, updatedAt: new Date().toISOString() })
  );
}

export function deleteManagerCareer(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(CAREER_KEY);
}

export function hasManagerCareer(): boolean {
  return !!loadManagerCareer();
}

export function createNewCareer(club: string): ManagerCareer {
  const config = getManagerClubConfig(club);
  const seed = `mgr-${club}-${Date.now()}`;
  const rosterIds = getCurrentSquadPlayerIds(club);
  const lineup = buildDefaultLineup(rosterIds);
  const squad = rosterIds.map((id) => createInitialPlayerState(id));

  const xiiiIds = lineup?.xiiiIds ?? rosterIds.slice(0, 13);
  const slotPositions =
    lineup?.slotPositions ??
    Array(13).fill("CENTRE" as const);
  const interchange =
    lineup?.benchIds ?? rosterIds.slice(13, 17);

  const schedule = buildManagerSchedule(club, seed);
  const squadIdSet = new Set(squad.map((p) => p.playerId));

  const career: ManagerCareer = {
    id: seed,
    club,
    seasonYear: new Date().getFullYear(),
    seed,
    budget: config.budget,
    clubFundsEarned: 0,
    boardConfidence: 65,
    boardExpectation: config.expectation,
    difficulty: config.difficulty,
    tactics: { ...DEFAULT_TACTICS },
    squad,
    matchdayXiii: xiiiIds,
    matchdayInterchange: interchange,
    xiiiSlotPositions: slotPositions,
    schedule,
    fixtures: [],
    roundMatches: [],
    currentRound: 0,
    leagueTable: buildLeagueTableFromMatches([], club),
    transferMarket: generateTransferMarket(club, squadIdSet, seed, 0),
    wins: 0,
    losses: 0,
    isSeasonComplete: false,
    seasonHistory: [],
    matchSimState: { form: 0, seasonDropGoals: 0 },
    lastMatchFixture: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveManagerCareer(career);
  return career;
}

export function buildSeasonSummary(career: ManagerCareer): ManagerSeasonSummary {
  const position = getUserLeaguePosition(career.leagueTable, career.club);
  let bestPlayerId: string | null = null;
  let bestRating = 0;
  let topTryScorerId: string | null = null;
  let topTries = 0;

  for (const ps of career.squad) {
    const player = getPlayerById(ps.playerId);
    if (!player) continue;
    if (player.peakRating > bestRating) {
      bestRating = player.peakRating;
      bestPlayerId = ps.playerId;
    }
    if (ps.seasonTries > topTries) {
      topTries = ps.seasonTries;
      topTryScorerId = ps.playerId;
    }
  }

  const trophies: string[] = [];
  if (position === 1) trophies.push("Super League Champions");

  let budgetChange = 0;
  if (position === 1) budgetChange = 400_000;
  else if (position <= 4) budgetChange = 200_000;
  else if (position <= 8) budgetChange = 75_000;
  else budgetChange = 25_000;

  let boardVerdict = "A steady season — the board want more next year.";
  if (position === 1) boardVerdict = "Outstanding — you delivered the title.";
  else if (position <= 4) boardVerdict = "Playoff football achieved. Well done.";
  else if (position >= 12) boardVerdict = "Disappointing — improvements required.";

  return {
    seasonYear: career.seasonYear,
    position,
    wins: career.wins,
    losses: career.losses,
    pointsFor: career.fixtures.reduce((s, f) => s + f.pointsFor, 0),
    pointsAgainst: career.fixtures.reduce((s, f) => s + f.pointsAgainst, 0),
    boardVerdict,
    budgetChange,
    trophies,
    bestPlayerId,
    topTryScorerId,
  };
}

export function advanceToNextSeason(career: ManagerCareer): ManagerCareer {
  const summary = buildSeasonSummary(career);
  const newSeed = `${career.seed}-s${career.seasonYear + 1}`;
  const squadIdSet = new Set(career.squad.map((p) => p.playerId));

  const next: ManagerCareer = {
    ...career,
    seasonYear: career.seasonYear + 1,
    seed: newSeed,
    budget: career.budget + summary.budgetChange,
    clubFundsEarned: career.clubFundsEarned + summary.budgetChange,
    boardConfidence: Math.min(85, career.boardConfidence + 10),
    schedule: buildManagerSchedule(career.club, newSeed),
    fixtures: [],
    roundMatches: [],
    currentRound: 0,
    wins: 0,
    losses: 0,
    isSeasonComplete: false,
    seasonHistory: [...career.seasonHistory, summary],
    matchSimState: { form: 0, seasonDropGoals: 0 },
    lastMatchFixture: null,
    transferMarket: generateTransferMarket(
      career.club,
      squadIdSet,
      newSeed,
      0
    ),
    squad: career.squad.map((p) => ({
      ...p,
      seasonAppearances: 0,
      seasonTries: 0,
      fitness: Math.min(100, p.fitness + 20),
    })),
    leagueTable: buildLeagueTableFromMatches([], career.club),
    updatedAt: new Date().toISOString(),
  };

  saveManagerCareer(next);
  return next;
}

export function refreshTransferMarket(career: ManagerCareer): ManagerCareer {
  const squadIdSet = new Set(career.squad.map((p) => p.playerId));
  return {
    ...career,
    transferMarket: generateTransferMarket(
      career.club,
      squadIdSet,
      career.seed,
      career.currentRound
    ),
  };
}

export { CAREER_KEY };
