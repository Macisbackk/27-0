/**
 * One-Club XI tests: every eligible club's spin pool fills all 13 slots from that club only,
 * the draft ladders exist, the season maps onto the 27-0 formula deterministically and
 * calibration stays "achievable but rare", and the per-club best record bookkeeping.
 * Run: bun scripts/test-one-club.ts   (or: npx tsx scripts/test-one-club.ts)
 */
import { createEmptySquad, RECRUIT_SLOT_ORDER } from "../src/lib/positions";
import {
  generateSlotTeamYearTargetForSlot,
  placeSlotRecruitPlayerAtSlot,
  prepareSlotTeamYearPlayers,
} from "../src/lib/game/slot-team-year-pick";
import {
  getOneClubBySlug,
  getOneClubDraftQuality,
  getOneClubFormulaOverride,
  getOneClubOptions,
  getOneClubRuleFilter,
  getOneClubScale,
  ONE_CLUB_MIN_TEAM_YEARS,
} from "../src/lib/game/one-club";
import { ONE_CLUB_SCALE } from "../src/lib/game/one-club-scale";
import { getSpinTeamYearPoolsCached } from "../src/lib/game/player-pool-eligibility";
import { getSeasonFixtureChances, simulateSeason, simulateSeasonRecord } from "../src/lib/game/season-simulation";
import { getTeamStrength, SIM_FORMULA_MODE_SCALE, TEAM_STRENGTH_TYPICAL } from "../src/lib/game/sim-formula";
import { getAverageSquadRating } from "../src/lib/squad-analysis";
import {
  applyOneClubSeason,
  applyOneClubTitle,
  emptyModeRecords,
  formatOneClubRecord,
  parseModeRecords,
} from "../src/lib/storage/mode-records";
import { draftSquad } from "./lib/sim-draft";
import type { SquadSlot } from "../src/lib/types";

let passed = 0;
let failed = 0;
function check(condition: unknown, message: string): void {
  if (condition) passed++;
  else {
    failed++;
    console.error(`FAIL: ${message}`);
  }
}

/** Strict one-club draft: every spin must land on the club (no fallback to other pools). */
function strictDraft(club: string, seed: string): { squad: SquadSlot[]; pure: boolean } {
  const filter = getOneClubRuleFilter(club);
  let squad = createEmptySquad();
  const used = new Set<string>();
  let pure = true;
  let spin = 0;
  for (const slotIndex of RECRUIT_SLOT_ORDER) {
    const usedIds = new Set(squad.filter((s) => s.player).map((s) => s.player!.id));
    const target = generateSlotTeamYearTargetForSlot(seed, spin++, usedIds, squad, slotIndex, used, {
      spinVariant: "all",
      ruleFilter: filter,
    });
    if (!target || target.team !== club) {
      pure = false;
      break;
    }
    used.add(target.teamYearKey);
    const offered = prepareSlotTeamYearPlayers(target, usedIds, squad, slotIndex, { seed, ruleFilter: filter });
    if (offered.length === 0) {
      pure = false;
      break;
    }
    squad = placeSlotRecruitPlayerAtSlot(squad, offered[0]!.player, target, slotIndex) ?? squad;
  }
  return { squad, pure: pure && squad.every((s) => s.player) };
}

// ---------------------------------------------------------------------------
// Eligible clubs and their pools
// ---------------------------------------------------------------------------
const options = getOneClubOptions();
check(options.length >= 10, `at least 10 One-Club clubs (got ${options.length})`);
const poolCount = new Map<string, number>();
for (const pool of getSpinTeamYearPoolsCached("all")) poolCount.set(pool.team, (poolCount.get(pool.team) ?? 0) + 1);
for (const [club, n] of poolCount) {
  const listed = options.some((o) => o.club === club);
  check(listed === n >= ONE_CLUB_MIN_TEAM_YEARS, `${club}: listed iff it has ≥${ONE_CLUB_MIN_TEAM_YEARS} seasons (${n})`);
}
for (const option of options) {
  check(getOneClubBySlug(option.slug)?.club === option.club, `${option.club}: slug round-trips`);
  check(option.firstYear < option.lastYear, `${option.club}: spans more than one year`);
  const pools = getSpinTeamYearPoolsCached("all").filter((p) => getOneClubRuleFilter(option.club).poolFilter!(p));
  check(pools.length === option.teamYears && pools.length > 0, `${option.club}: pool non-empty (${pools.length})`);
  check(pools.every((p) => p.team === option.club), `${option.club}: filter only keeps its own seasons`);
  for (let i = 0; i < 5; i++) {
    const { squad, pure } = strictDraft(option.club, `oc-test-${option.slug}-${i}`);
    check(pure, `${option.club} seed ${i}: all 13 slots filled from ${option.club} seasons only`);
    check(new Set(squad.map((s) => s.player?.name)).size === 13, `${option.club} seed ${i}: 13 different people`);
  }
  // Draft ladder.
  const scale = ONE_CLUB_SCALE[option.club];
  check(scale !== undefined, `${option.club}: has a draft ladder in one-club-scale.ts (run sim-one-club-gauntlet --write)`);
  if (scale) check(scale.eliteRating > scale.typicalRating, `${option.club}: elite above typical`);
}
check(getOneClubBySlug("not-a-club") === null, "unknown slug → null");
check(getOneClubBySlug(null) === null, "missing slug → null");

// ---------------------------------------------------------------------------
// Formula mapping (sim-formula unchanged; the squad is placed on the Era ladder)
// ---------------------------------------------------------------------------
const era = SIM_FORMULA_MODE_SCALE.era;
for (const option of options.slice(0, 4)) {
  const scale = getOneClubScale(option.club);
  check(Math.abs(getOneClubDraftQuality(scale.typicalRating, option.club)) < 1e-9, `${option.club}: typical rating is q=0`);
  check(Math.abs(getOneClubDraftQuality(scale.eliteRating, option.club) - 1) < 1e-9, `${option.club}: elite rating is q=1`);
  const squad = draftSquad(`oc-map-${option.slug}`, "era", "random", {
    spinVariant: "all",
    ruleFilter: getOneClubRuleFilter(option.club),
  });
  const override = getOneClubFormulaOverride(squad, option.club);
  const q = getOneClubDraftQuality(getAverageSquadRating(squad), option.club);
  const strength = getTeamStrength({ avgRating: override.avgRating, mode: "era", chemistry: override.chemistry });
  const expected = TEAM_STRENGTH_TYPICAL + 8 * q + (override.chemistry - era.typicalChemistry) - (era.opponentEdge ?? 0);
  check(Math.abs(strength - expected) < 1e-9, `${option.club}: strength = 80 + 8q + chemistry above the club's typical`);
  // Deterministic season: same seed + squad → same result, and the formula override is used.
  const a = simulateSeason(squad, "oc-season-seed", { formulaOverride: override });
  const b = simulateSeason(squad, "oc-season-seed", { formulaOverride: override });
  check(a.gameResults.join("") === b.gameResults.join(""), `${option.club}: season is deterministic`);
  const fast = simulateSeasonRecord(squad, "oc-season-seed", { mode: "era", formulaOverride: override });
  check(fast.join("") === a.gameResults.join(""), `${option.club}: fast record matches the full season`);
  const chances = getSeasonFixtureChances(squad, "oc-season-seed", { mode: "era", formulaOverride: override });
  check(Math.abs(chances[0]!.teamStrength - strength) < 1e-9, `${option.club}: fixture chances use the override`);
}

// ---------------------------------------------------------------------------
// Calibration sanity: 27-0 achievable with a near-perfect draft, rare with a typical one
// ---------------------------------------------------------------------------
for (const club of ["Wigan Warriors", "Castleford Tigers"]) {
  if (!options.some((o) => o.club === club)) continue;
  const filter = getOneClubRuleFilter(club);
  const perfectRate = (tier: "best" | "random") => {
    let total = 0;
    const N = 25;
    for (let i = 0; i < N; i++) {
      const squad = draftSquad(`oc-cal-${club}-${tier}-${i}`, "era", tier, { spinVariant: "all", ruleFilter: filter });
      const override = getOneClubFormulaOverride(squad, club);
      total += getSeasonFixtureChances(squad, `oc-cal-season-${i}`, { mode: "era", formulaOverride: override })
        .reduce((p, f) => p * f.winProbability, 1);
    }
    return total / N;
  };
  const best = perfectRate("best");
  const typical = perfectRate("random");
  check(best > 0.1 && best < 0.6, `${club}: near-perfect draft 27-0 chance ${(best * 100).toFixed(1)}% is achievable`);
  check(typical < 0.12, `${club}: typical draft 27-0 chance ${(typical * 100).toFixed(1)}% is rare`);
  check(best > typical * 3, `${club}: drafting well matters`);
}

// ---------------------------------------------------------------------------
// Best record per club
// ---------------------------------------------------------------------------
let state = emptyModeRecords();
let r = applyOneClubSeason(state, { runId: "r1", club: "Wigan Warriors", wins: 20, losses: 7, at: "t1" });
state = r.state;
check(r.newBest && formatOneClubRecord(r.record) === "20-7", "first season is the best");
r = applyOneClubSeason(state, { runId: "r2", club: "Wigan Warriors", wins: 18, losses: 9, at: "t2" });
state = r.state;
check(!r.newBest && formatOneClubRecord(r.record) === "20-7" && r.record.seasons === 2, "worse season keeps the best, counts the season");
r = applyOneClubSeason(state, { runId: "r3", club: "Wigan Warriors", wins: 25, losses: 2, at: "t3" });
state = r.state;
check(r.newBest && formatOneClubRecord(r.record) === "25-2" && r.record.bestAt === "t3", "better season is the new best");
r = applyOneClubSeason(state, { runId: "r3", club: "Wigan Warriors", wins: 27, losses: 0 });
check(r.state === state && r.record.seasons === 3, "the same run never counts twice");
r = applyOneClubSeason(state, { runId: "r4", club: "Wigan Warriors", wins: 27, losses: 0 });
state = r.state;
check(r.record.perfectSeasons === 1 && formatOneClubRecord(r.record) === "27-0", "27-0 counted");
check(state.oneClub["St Helens"] === undefined, "other clubs untouched");
state = applyOneClubTitle(state, { runId: "r4", club: "Wigan Warriors" });
state = applyOneClubTitle(state, { runId: "r4", club: "Wigan Warriors" });
check(state.oneClub["Wigan Warriors"]!.titles === 1, "a title counts once per run");
const round = parseModeRecords(JSON.stringify(state));
check(JSON.stringify(round) === JSON.stringify(state), "records survive a storage round trip");
check(parseModeRecords("{bad").oneClub && Object.keys(parseModeRecords("{bad").oneClub).length === 0, "bad JSON → empty");
check(parseModeRecords(JSON.stringify({ oneClub: { X: { wins: 99, losses: -3 } } })).oneClub.X!.wins === 27, "values clamped");

console.log(`\nOne-Club XI: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
