/**
 * Measure weekly transfer-market activity over ~50 simulated weeks.
 * Run: npx tsx scripts/measure-transfer-activity.ts
 */
import { createNewCareer } from "../src/lib/manager/managerState";
import { getLeagueSeasonIndex } from "../src/lib/manager/managerLeagueSeason";
import { maybeGenerateAiTransfers } from "../src/lib/manager/managerAiTransfers";
import {
  generateIncomingTransferOffers,
  generateUnsolicitedTransferOffers,
} from "../src/lib/manager/managerTransferLeague";
import { maybeAiSignChampionshipElite } from "../src/lib/manager/championship/championshipAiTransfers";
import { maybeChampionshipBidForSlReserves } from "../src/lib/manager/championshipBidForSlReserves";
import {
  DEFAULT_TRANSFER_ACTIVITY_CONFIG,
  type TransferActivityConfig,
} from "../src/lib/manager/transferActivityConfig";
import type { ManagerCareer } from "../src/lib/manager/types";

const WEEKS = 50;
const cfg = DEFAULT_TRANSFER_ACTIVITY_CONFIG;

function heatForWeek(week: number): number {
  return cfg.gameWeekActivityMultiplier(week);
}

function heatBand(week: number): "busy" | "normal" | "quiet" {
  const h = heatForWeek(week);
  if (h >= 1.2) return "busy";
  if (h <= 0.6) return "quiet";
  return "normal";
}

function countSeriousActivity(before: ManagerCareer, after: ManagerCareer): number {
  const beforeTx = new Set((before.leagueTransfers ?? []).map((t) => t.id));
  const newTransfers = (after.leagueTransfers ?? []).filter(
    (t) => !beforeTx.has(t.id)
  ).length;

  const beforeMsg = new Set(before.inboxMessages.map((m) => m.id));
  const newOffers = after.inboxMessages.filter(
    (m) =>
      !beforeMsg.has(m.id) &&
      !m.resolved &&
      (m.type === "transfer" || m.type === "transfer_offer_in")
  ).length;

  return newTransfers + newOffers;
}

function runWeeklyTransferHooks(career: ManagerCareer): ManagerCareer {
  let next = generateIncomingTransferOffers(career);
  next = generateUnsolicitedTransferOffers(next);
  next = maybeAiSignChampionshipElite(next);
  next = maybeChampionshipBidForSlReserves(next);
  next = maybeGenerateAiTransfers(next, 0);
  const seasonIndex = getLeagueSeasonIndex(next);
  if (seasonIndex >= 1) next = maybeGenerateAiTransfers(next, 1);
  if (seasonIndex >= 2) next = maybeGenerateAiTransfers(next, 2);
  if (seasonIndex >= 4) next = maybeGenerateAiTransfers(next, 3);
  return next;
}

function printConfigSummary(c: TransferActivityConfig): void {
  console.log("Transfer activity config (current defaults)\n");
  console.log("  aiInternalTransfers:");
  console.log(`    baseChancePerMatch: ${c.aiInternalTransfers.baseChancePerMatch}`);
  console.log(
    `    postFirstSeasonChance: ${c.aiInternalTransfers.postFirstSeasonChance}`
  );
  console.log(`  incomingOffers.baseChance: ${c.incomingOffers.baseChance}`);
  console.log(`  incomingOffers.seasonBoost: ${c.incomingOffers.seasonBoost}`);
  console.log(`  unsolicitedOffers.baseChance: ${c.unsolicitedOffers.baseChance}`);
  console.log(
    `  unsolicitedOffers.seasonRampStart: ${c.unsolicitedOffers.seasonRampStart}`
  );
  console.log(
    `  championshipEliteToSl.weeklyScanChance: ${c.championshipEliteToSl.weeklyScanChance}`
  );
  console.log(
    `  reserveToChampionship.baseWeeklyScanChance: ${c.reserveToChampionship.baseWeeklyScanChance}`
  );
  console.log(
    `  reserveToChampionship.maxWorldRequestsPerWeek: ${c.reserveToChampionship.maxWorldRequestsPerWeek}`
  );
  console.log(
    `  reserveToChampionship.maxRequestsPerClubPerWeek: ${c.reserveToChampionship.maxRequestsPerClubPerWeek}`
  );
  console.log(
    `  reserveToChampionship.aiSellerAcceptChance: ${c.reserveToChampionship.aiSellerAcceptChance}`
  );
  console.log("  gameWeekActivityMultiplier bands:");
  for (const w of [1, 10, 20, 28]) {
    console.log(`    week ${w}: ×${heatForWeek(w)} (${heatBand(w)})`);
  }
  console.log("");
}

console.log("Measuring transfer activity\n");
printConfigSummary(cfg);

let career = createNewCareer("Leeds Rhinos");
career = {
  ...career,
  reserves: career.reserves.map((r, i) => ({
    ...r,
    rating: 72 + (i % 10),
    potentialRating: Math.min(90, 78 + (i % 8)),
    age: 19 + (i % 7),
    markedForRelease: false,
  })),
  reserveToChampionshipCooldowns: {},
};

const byBand: Record<"busy" | "normal" | "quiet", number[]> = {
  busy: [],
  normal: [],
  quiet: [],
};

let totalReserveWire = 0;
let totalCrossTierWire = 0;

for (let week = 1; week <= WEEKS; week++) {
  const before = career;
  career = { ...career, gameWeek: week };
  career = runWeeklyTransferHooks(career);

  const activity = countSeriousActivity(before, career);
  byBand[heatBand(week)].push(activity);

  const newTx = (career.leagueTransfers ?? []).filter(
    (t) => t.week === week && !(before.leagueTransfers ?? []).some((b) => b.id === t.id)
  );
  totalReserveWire += newTx.filter((t) => t.sourceSquad === "reserve").length;
  totalCrossTierWire += newTx.filter(
    (t) =>
      (t.fromCompetitionId === "super-league" && t.toCompetitionId === "championship") ||
      (t.fromCompetitionId === "championship" && t.toCompetitionId === "super-league")
  ).length;
}

function stats(values: number[]): { min: number; max: number; avg: number } {
  if (values.length === 0) return { min: 0, max: 0, avg: 0 };
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: Math.round((sum / values.length) * 100) / 100,
  };
}

console.log(`${WEEKS}-week simulation (Leeds Rhinos, eligible reserves seeded)\n`);

for (const band of ["quiet", "normal", "busy"] as const) {
  const s = stats(byBand[band]);
  console.log(
    `  ${band.padEnd(6)} weeks (${byBand[band].length}): min ${s.min}, avg ${s.avg}, max ${s.max}`
  );
}

console.log(`\n  reserve-origin leagueTransfers recorded: ${totalReserveWire}`);
console.log(`  cross-tier leagueTransfers (explicit ids): ${totalCrossTierWire}`);
console.log(
  `  total leagueTransfers in history: ${(career.leagueTransfers ?? []).length}`
);
