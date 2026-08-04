/**
 * Simulation audit for the floor-80 rating scale.
 * Run: npx tsx scripts/audit-rating-scale-simulation.ts
 *
 * Defaults are reduced for CI speed; set FULL=1 for the full volumes
 * requested in the rebalance brief (10k matches / 1k seasons / cups).
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { getPlayableClubNames } from "../src/lib/clubs/super-league-display";
import { clearSeasonSquadStrengthCache } from "../src/lib/game/opponent-squad-strength";
import { simulateSeason } from "../src/lib/game/season-simulation";
import { createEmptySquad, signPlayerToSlot } from "../src/lib/positions";
import { getGlobalRecruitmentPool } from "../src/lib/game/player-pool-eligibility";
import { getAverageSquadRating } from "../src/lib/squad-analysis";
import {
  generateChampionshipSquads,
  validateChampionshipSquadGeneration,
} from "../src/lib/manager/championship/championshipSquads";
import {
  advanceChampionshipToGameWeek,
  createChampionshipCompetition,
} from "../src/lib/manager/championship/championshipLeague";
import { createExpandedChallengeCupBracket } from "../src/lib/manager/championship/championshipChallengeCup";
import { finalizeBracketDisplay } from "../src/lib/game/challenge-cup-bracket";
import type { SquadSlot } from "../src/lib/types";
import currentSquads from "../data/current-squads.json";

const FULL = process.env.FULL === "1";
const MATCH_SAMPLES = Number(process.env.MATCHES ?? (FULL ? 10_000 : 2_000));
const SL_SEASONS = Number(process.env.SL_SEASONS ?? (FULL ? 1_000 : 100));
const CHAMP_SEASONS = Number(process.env.CHAMP_SEASONS ?? (FULL ? 1_000 : 100));
const CUPS = Number(process.env.CUPS ?? (FULL ? 1_000 : 100));

function buildSquadNear(target: number): SquadSlot[] {
  const pool = getGlobalRecruitmentPool();
  const ranked = [...pool].sort(
    (a, b) =>
      Math.abs(a.peakRating - target) - Math.abs(b.peakRating - target) ||
      a.peakRating - b.peakRating
  );
  let squad = createEmptySquad();
  const picked = new Set<string>();
  for (const slot of squad) {
    const player = ranked.find((p) => !picked.has(p.id));
    if (!player) break;
    picked.add(player.id);
    squad = signPlayerToSlot(squad, player, slot.slotIndex) ?? squad;
  }
  return squad;
}

function band(r: number): string {
  if (r <= 82) return "80-82";
  if (r <= 85) return "83-85";
  if (r <= 88) return "86-88";
  if (r <= 91) return "89-91";
  if (r <= 94) return "92-94";
  return "95+";
}

const t0 = Date.now();
const pool = getGlobalRecruitmentPool();
const invalidRatings = pool.filter(
  (p) => !Number.isFinite(p.peakRating) || p.peakRating < 80 || p.peakRating > 99
);

type DiffBucket = {
  n: number;
  favWins: number;
  margins: number[];
  tries: number[];
};
const byDiff: Record<string, DiffBucket> = {};
const triesByBand: Record<string, number> = {};
const triesByPos: Record<string, number> = {};
let monopolyMatches = 0;
let matchCount = 0;
let fakeScorers = 0;
let unresolvedIds = 0;
let upsetCount = 0;

const targets = [82, 85, 88, 91];
let seasonsRun = 0;
const seasonTryLeaders: number[] = [];

while (matchCount < MATCH_SAMPLES && seasonsRun < SL_SEASONS) {
  const target = targets[seasonsRun % targets.length]!;
  clearSeasonSquadStrengthCache();
  const squad = buildSquadNear(target);
  const seed = `rating-scale-sl-${seasonsRun}`;
  const result = simulateSeason(squad, seed, { draftMode: false });
  seasonsRun++;
  const userRating = result.squadStrength || getAverageSquadRating(squad);

  if (result.tryScorers?.length) {
    seasonTryLeaders.push(result.tryScorers[0]?.tries ?? 0);
    for (const scorer of result.tryScorers) {
      const p = pool.find((x) => x.id === scorer.playerId);
      const rating = p?.peakRating ?? 80;
      const b = band(rating);
      triesByBand[b] = (triesByBand[b] ?? 0) + (scorer.tries ?? 0);
      const pos = p?.position ?? "UNK";
      triesByPos[pos] = (triesByPos[pos] ?? 0) + (scorer.tries ?? 0);
      if (!scorer.playerId) unresolvedIds++;
      if (
        scorer.playerId?.startsWith("fake-") ||
        scorer.playerId === "unknown"
      ) {
        fakeScorers++;
      }
    }
  }

  for (const f of result.fixtures) {
    matchCount++;
    const margin = Math.abs(f.pointsFor - f.pointsAgainst);
    const totalTries = f.triesFor + f.triesAgainst;
    // Opponent strength approximated via season squad strength ± result signal
    const oppProxy =
      f.result === "W"
        ? userRating - Math.min(8, margin / 4)
        : userRating + Math.min(8, margin / 4);
    const diff = Math.round(userRating - oppProxy);
    const key =
      diff >= 6
        ? "+6+"
        : diff >= 3
          ? "+3-5"
          : diff >= 1
            ? "+1-2"
            : diff >= -2
              ? "0±2"
              : diff >= -5
                ? "-3-5"
                : "-6+";
    const bucket = (byDiff[key] ??= {
      n: 0,
      favWins: 0,
      margins: [],
      tries: [],
    });
    bucket.n++;
    const favWon =
      (diff >= 0 && f.result === "W") || (diff < 0 && f.result === "L");
    if (favWon) bucket.favWins++;
    if (f.isUpset) upsetCount++;
    bucket.margins.push(margin);
    bucket.tries.push(totalTries);

    const detail = f.scoringDetail?.dreamTeam?.tryScorers ?? [];
    if (detail.length > 0) {
      const ids = detail.map((s) => s.playerId).filter(Boolean);
      const unique = new Set(ids);
      const totalUserTries = detail.reduce((s, t) => s + t.tries, 0);
      if (unique.size === 1 && totalUserTries >= 3) monopolyMatches++;
    }
  }
}

let champInvalid = 0;
let champFixtures = 0;
const champRatings: number[] = [];
for (let i = 0; i < CHAMP_SEASONS; i++) {
  const seed = `rating-scale-champ-${i}`;
  const squads = generateChampionshipSquads(seed, 2026);
  try {
    validateChampionshipSquadGeneration(squads.players, squads.rosterByClub);
  } catch {
    champInvalid++;
  }
  for (const p of Object.values(squads.players)) {
    champRatings.push(p.peakRating);
    if (p.peakRating < 80 || p.peakRating > 89) champInvalid++;
  }
  let competition = createChampionshipCompetition(seed, 2026);
  competition = advanceChampionshipToGameWeek(competition, 19, seed, squads);
  champFixtures += competition.fixtures.filter((f) => f.played).length;
}

let cupOk = 0;
for (let i = 0; i < CUPS; i++) {
  const seed = `rating-scale-cup-${i}`;
  const bracket = createExpandedChallengeCupBracket(seed, "Wigan Warriors", {
    previousSeasonLeagueTable: getPlayableClubNames().map((team, idx) => ({
      team,
      position: idx + 1,
    })),
  });
  if (finalizeBracketDisplay(bracket)) cupOk++;
}

const slRatings = (currentSquads as { peakRating: number }[]).map(
  (p) => p.peakRating
);
const slAvg = slRatings.reduce((a, b) => a + b, 0) / slRatings.length;
const champAvg =
  champRatings.reduce((a, b) => a + b, 0) / Math.max(1, champRatings.length);

const allMargins = Object.values(byDiff).flatMap((v) => v.margins);
const allTries = Object.values(byDiff).flatMap((v) => v.tries);

const winRates = Object.fromEntries(
  Object.entries(byDiff).map(([k, v]) => [
    k,
    {
      n: v.n,
      favWinPct: v.n ? (100 * v.favWins) / v.n : 0,
      avgMargin: v.margins.length
        ? v.margins.reduce((a, b) => a + b, 0) / v.margins.length
        : 0,
      avgTries: v.tries.length
        ? v.tries.reduce((a, b) => a + b, 0) / v.tries.length
        : 0,
    },
  ])
);

const report = {
  schemaVersion: 3,
  elapsedMs: Date.now() - t0,
  volumes: {
    matchesSampled: matchCount,
    slSeasons: seasonsRun,
    champSeasons: CHAMP_SEASONS,
    cups: CUPS,
    fullMode: FULL,
  },
  invalidOrNanRatings: invalidRatings.length,
  unresolvedPlayerIds: unresolvedIds,
  fakeScorerPlaceholders: fakeScorers,
  monopolyTryMatches: monopolyMatches,
  upsetMatches: upsetCount,
  upsetFrequencyPct: matchCount ? (100 * upsetCount) / matchCount : 0,
  averageScoreMargin: allMargins.length
    ? allMargins.reduce((a, b) => a + b, 0) / allMargins.length
    : 0,
  averageTriesPerMatch: allTries.length
    ? allTries.reduce((a, b) => a + b, 0) / allTries.length
    : 0,
  topScorerSeasonTriesAvg: seasonTryLeaders.length
    ? seasonTryLeaders.reduce((a, b) => a + b, 0) / seasonTryLeaders.length
    : 0,
  winRatesByRatingDiff: winRates,
  triesByRatingBand: triesByBand,
  triesByPosition: triesByPos,
  teamRatingAverages: {
    superLeagueCurrent: slAvg,
    championshipGenerated: champAvg,
  },
  championship: {
    invalidSheetsOrRatings: champInvalid,
    fixturesPlayed: champFixtures,
  },
  cupsProcessed: cupOk,
  lowEndScoringNote:
    "Try shares by band should rise with rating; 80–82 must not dominate.",
  oldScaleThresholdsRemaining:
    "Scorer ability uses rating/83^2.35; Champ/opponent baselines use 80.",
};

writeFileSync(
  join(__dirname, "..", "data", "player-rating-simulation-audit.json"),
  JSON.stringify(report, null, 2) + "\n"
);
console.log(JSON.stringify(report, null, 2));
if (invalidRatings.length > 0 || champInvalid > 0 || matchCount === 0) {
  process.exit(1);
}
