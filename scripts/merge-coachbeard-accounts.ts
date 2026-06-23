/**
 * One-time idempotent merge: coachbeard + coachbeard2 → coachbeard (macauley060897@live.co.uk)
 * Run: npm run merge:coachbeard-accounts
 *
 * Storage architecture:
 * - Supabase: user_stats (stats bundles + club_funds), leaderboard, profiles, auth
 * - localStorage: browser cache synced on login (see src/lib/storage/coachbeard-account-merge.ts)
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.
 */
// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { mergeUserStatsData } from "../src/lib/storage/merge-user-stats";
import { migrateUserStats, EMPTY_STATS } from "../src/lib/storage/stats";
import { combineLeaderboardTrackerStats } from "../src/lib/leaderboard-trackers";
import type { UserStatsData } from "../src/lib/types";

const PRIMARY_COACH = "coachbeard";
const SECONDARY_COACH = "coachbeard2";
const TARGET_EMAIL = "macauley060897@live.co.uk";
const MERGE_FLAG_PATH = join(__dirname, "..", "data", "coachbeard-merge-complete.json");

const BUNDLE_KEY = "stats_bundle";
const CLUB_FUNDS_MODE = "GLOBAL";
const CLUB_FUNDS_KEY = "club_funds";
const STAT_MODES = [
  "NORMAL",
  "HARD",
  "DRAFT_NORMAL",
  "DRAFT_HARD",
  "FANTASY",
  "ERA_CUP",
] as const;

interface MergeFlag {
  completedAt: string;
  primaryUserId: string;
  targetEmail: string;
  statsBefore?: Record<string, number>;
  statsAfter?: Record<string, number>;
}

function loadMergeFlag(): MergeFlag | null {
  if (!existsSync(MERGE_FLAG_PATH)) return null;
  try {
    return JSON.parse(readFileSync(MERGE_FLAG_PATH, "utf8")) as MergeFlag;
  } catch {
    return null;
  }
}

function saveMergeFlag(
  primaryUserId: string,
  statsBefore?: Record<string, number>,
  statsAfter?: Record<string, number>
): void {
  writeFileSync(
    MERGE_FLAG_PATH,
    `${JSON.stringify(
      {
        completedAt: new Date().toISOString(),
        primaryUserId,
        targetEmail: TARGET_EMAIL,
        statsBefore,
        statsAfter,
      },
      null,
      2
    )}\n`
  );
}

function sumStatsModes(
  bundles: Record<string, UserStatsData>
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const mode of STAT_MODES) {
    const s = bundles[mode] ?? EMPTY_STATS;
    totals[mode] = s.totalRuns ?? 0;
  }
  totals.totalRuns = Object.values(totals).reduce((a, b) => a + b, 0);
  return totals;
}

async function findUserIdByCoachName(
  admin: ReturnType<typeof createClient>,
  coachName: string
): Promise<string | null> {
  const { data } = await admin
    .from("profiles")
    .select("id, coach_name")
    .ilike("coach_name", coachName)
    .maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

async function findUserIdByEmail(
  admin: ReturnType<typeof createClient>,
  email: string
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const user = data.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );
  return user?.id ?? null;
}

async function loadStatsBundle(
  admin: ReturnType<typeof createClient>,
  userId: string
): Promise<Record<string, UserStatsData>> {
  const { data, error } = await admin
    .from("user_stats")
    .select("mode, stat_json")
    .eq("user_id", userId)
    .eq("stat_key", BUNDLE_KEY);
  if (error) throw error;

  const result: Record<string, UserStatsData> = {};
  for (const row of data ?? []) {
    result[row.mode as string] = migrateUserStats(
      (row.stat_json as Partial<UserStatsData>) ?? {}
    );
  }
  return result;
}

async function saveStatsBundle(
  admin: ReturnType<typeof createClient>,
  userId: string,
  mode: string,
  stats: UserStatsData
): Promise<void> {
  const { error } = await admin.from("user_stats").upsert(
    {
      user_id: userId,
      mode,
      stat_key: BUNDLE_KEY,
      stat_value: 0,
      stat_json: stats,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,mode,stat_key" }
  );
  if (error) throw error;
}

interface ClubFundsState {
  balance: number;
  totalEarned: number;
  paidRunIds: string[];
}

async function loadClubFunds(
  admin: ReturnType<typeof createClient>,
  userId: string
): Promise<ClubFundsState> {
  const { data, error } = await admin
    .from("user_stats")
    .select("stat_json")
    .eq("user_id", userId)
    .eq("mode", CLUB_FUNDS_MODE)
    .eq("stat_key", CLUB_FUNDS_KEY)
    .maybeSingle();
  if (error) throw error;
  if (!data?.stat_json) {
    return { balance: 0, totalEarned: 0, paidRunIds: [] };
  }
  const json = data.stat_json as Partial<ClubFundsState>;
  return {
    balance: typeof json.balance === "number" ? json.balance : 0,
    totalEarned:
      typeof json.totalEarned === "number"
        ? json.totalEarned
        : typeof json.balance === "number"
          ? json.balance
          : 0,
    paidRunIds: Array.isArray(json.paidRunIds)
      ? json.paidRunIds.filter((id) => typeof id === "string")
      : [],
  };
}

async function saveClubFunds(
  admin: ReturnType<typeof createClient>,
  userId: string,
  state: ClubFundsState
): Promise<void> {
  const { error } = await admin.from("user_stats").upsert(
    {
      user_id: userId,
      mode: CLUB_FUNDS_MODE,
      stat_key: CLUB_FUNDS_KEY,
      stat_value: state.totalEarned,
      stat_json: state,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,mode,stat_key" }
  );
  if (error) throw error;
}

function mergeClubFunds(
  primary: ClubFundsState,
  secondary: ClubFundsState
): ClubFundsState {
  const paidSet = new Set([...primary.paidRunIds, ...secondary.paidRunIds]);
  return {
    balance: Math.max(primary.balance, secondary.balance),
    totalEarned: Math.max(primary.totalEarned, secondary.totalEarned),
    paidRunIds: [...paidSet],
  };
}

function rowToTrackerStats(row: Record<string, unknown>) {
  return {
    squadValue: (row.score as number) ?? 0,
    totalWins: (row.wins as number) ?? 0,
    totalLosses: (row.losses as number) ?? 0,
    perfectRuns: (row.perfect_runs as number) ?? 0,
    bestRecordWins: (row.best_record_wins as number) ?? 0,
    bestRecordLosses: (row.best_record_losses as number) ?? 0,
    bestWinPercentage: (row.best_win_percentage as number) ?? 0,
    challengeCupWins: (row.challenge_cup_wins as number) ?? 0,
    cupFinals: (row.cup_finals as number) ?? 0,
    bestCupFinishRank: (row.best_cup_finish_rank as number) ?? 0,
    bestCupFinishLabel: (row.best_cup_finish as string) ?? "",
    cupWinPercentage: (row.cup_win_percentage as number) ?? 0,
  };
}

function trackerStatsToRowPayload(
  stats: ReturnType<typeof combineLeaderboardTrackerStats>
) {
  return {
    score: stats.squadValue,
    wins: stats.totalWins,
    losses: stats.totalLosses,
    perfect_runs: stats.perfectRuns,
    best_record_wins: stats.bestRecordWins,
    best_record_losses: stats.bestRecordLosses,
    best_win_percentage: stats.bestWinPercentage,
    challenge_cup_wins: stats.challengeCupWins,
    cup_finals: stats.cupFinals,
    best_cup_finish: stats.bestCupFinishLabel || null,
    best_cup_finish_rank: stats.bestCupFinishRank,
    cup_win_percentage: stats.cupWinPercentage,
  };
}

async function mergeLeaderboardRows(
  admin: ReturnType<typeof createClient>,
  primaryUserId: string,
  secondaryUserId: string
): Promise<number> {
  const [{ data: secondaryRows, error: secErr }, { data: primaryRows, error: priErr }] =
    await Promise.all([
      admin.from("leaderboard").select("*").eq("user_id", secondaryUserId),
      admin.from("leaderboard").select("*").eq("user_id", primaryUserId),
    ]);
  if (secErr) throw secErr;
  if (priErr) throw priErr;
  if (!secondaryRows?.length) return 0;

  let merged = 0;
  const primaryByKey = new Map<string, Record<string, unknown>>();
  for (const row of primaryRows ?? []) {
    const key = `${row.mode}:${row.difficulty}`;
    primaryByKey.set(key, row as Record<string, unknown>);
  }

  for (const secRow of secondaryRows) {
    const key = `${secRow.mode}:${secRow.difficulty}`;
    const priRow = primaryByKey.get(key);
    const combined = combineLeaderboardTrackerStats(
      priRow ? rowToTrackerStats(priRow) : {},
      rowToTrackerStats(secRow as Record<string, unknown>)
    );
    const payload = {
      ...trackerStatsToRowPayload(combined),
      user_id: primaryUserId,
      coach_name: PRIMARY_COACH,
      player_name: PRIMARY_COACH,
      mode: secRow.mode,
      difficulty: secRow.difficulty,
      updated_at: new Date().toISOString(),
    };

    if (priRow?.id) {
      const { error } = await admin
        .from("leaderboard")
        .update(payload)
        .eq("id", priRow.id as string);
      if (!error) merged++;
    } else {
      const { error } = await admin.from("leaderboard").insert(payload);
      if (!error) merged++;
    }
  }

  await admin.from("leaderboard").delete().eq("user_id", secondaryUserId);

  const { data: coachNameRows } = await admin
    .from("leaderboard")
    .select("id")
    .ilike("coach_name", SECONDARY_COACH);
  if (coachNameRows?.length) {
    await admin
      .from("leaderboard")
      .update({
        coach_name: PRIMARY_COACH,
        player_name: PRIMARY_COACH,
        updated_at: new Date().toISOString(),
      })
      .ilike("coach_name", SECONDARY_COACH);
  }

  return merged;
}

async function validateMerge(
  admin: ReturnType<typeof createClient>,
  primaryUserId: string,
  flag: MergeFlag | null
): Promise<void> {
  console.log("\n--- Validation report ---");
  console.log("Storage: Supabase (user_stats, leaderboard, profiles) + localStorage (browser cache)");

  const { data: secondaryProfiles } = await admin
    .from("profiles")
    .select("id, coach_name")
    .ilike("coach_name", SECONDARY_COACH);
  const secondaryVisible = (secondaryProfiles?.length ?? 0) > 0;
  console.log(
    secondaryVisible
      ? `✗ ${SECONDARY_COACH} still has a profile`
      : `✓ ${SECONDARY_COACH} not shown separately`
  );

  const { data: authUser } = await admin.auth.admin.getUserById(primaryUserId);
  const emailOk =
    authUser?.user?.email?.toLowerCase() === TARGET_EMAIL.toLowerCase();
  console.log(
    emailOk
      ? `✓ Merged email is ${TARGET_EMAIL}`
      : `✗ Email is ${authUser?.user?.email ?? "unknown"} (expected ${TARGET_EMAIL})`
  );

  const { data: primaryProfile } = await admin
    .from("profiles")
    .select("coach_name")
    .eq("id", primaryUserId)
    .maybeSingle();
  console.log(
    primaryProfile?.coach_name?.toLowerCase() === PRIMARY_COACH
      ? `✓ Primary coach name is ${PRIMARY_COACH}`
      : `✗ Primary coach name is ${primaryProfile?.coach_name ?? "unknown"}`
  );

  const stats = await loadStatsBundle(admin, primaryUserId);
  const totals = sumStatsModes(stats);
  console.log(`✓ Combined stats totalRuns (all modes): ${totals.totalRuns}`);
  for (const mode of STAT_MODES) {
    console.log(`    ${mode}: ${totals[mode]} runs`);
  }

  if (flag?.statsAfter) {
    const after = totals.totalRuns;
    const expected = flag.statsAfter.totalRuns ?? 0;
    const idempotent = Math.abs(after - expected) < 0.01;
    console.log(
      idempotent
        ? `✓ Re-run did not duplicate totals (still ${after} runs)`
        : `✗ Totals changed on re-run: expected=${expected} got=${after}`
    );
  }

  const funds = await loadClubFunds(admin, primaryUserId);
  console.log(
    `✓ Club funds totalEarned: ${funds.totalEarned} (balance ${funds.balance}, ${funds.paidRunIds.length} paid run ids)`
  );

  const { count: secLbCount } = await admin
    .from("leaderboard")
    .select("id", { count: "exact", head: true })
    .eq("user_id", primaryUserId);
  console.log(`✓ Leaderboard rows for primary user: ${secLbCount ?? 0}`);
  console.log("--- End validation ---\n");
}

async function main(): Promise<void> {
  console.log("Coachbeard account merge");
  console.log("Live stats storage: BOTH");
  console.log("  - Supabase: user_stats, leaderboard, profiles (authoritative when logged in)");
  console.log("  - localStorage: 27-0-stats, leaderboards, club funds (browser cache)");
  console.log("  - Client migration: src/lib/storage/coachbeard-account-merge.ts\n");

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      "Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY — cannot merge remote accounts."
    );
    console.log(
      "Set credentials in environment, then re-run: npm run merge:coachbeard-accounts"
    );
    console.log(
      "Local browser migration runs automatically on next app load (CoachbeardMergeRunner)."
    );
    process.exit(1);
  }

  const existing = loadMergeFlag();
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const emailUserId = await findUserIdByEmail(admin, TARGET_EMAIL);
  const primaryProfileId = await findUserIdByCoachName(admin, PRIMARY_COACH);
  const secondaryProfileId = await findUserIdByCoachName(admin, SECONDARY_COACH);

  const primaryUserId = emailUserId ?? primaryProfileId;
  if (!primaryUserId) {
    console.error(`Primary account not found for ${TARGET_EMAIL} / ${PRIMARY_COACH}`);
    process.exit(1);
  }

  if (existing?.primaryUserId === primaryUserId) {
    console.log("Merge already completed (idempotent skip).");
    await validateMerge(admin, primaryUserId, existing);
    process.exit(0);
  }

  if (!secondaryProfileId) {
    console.log(`No ${SECONDARY_COACH} profile found — nothing to merge.`);
    const stats = await loadStatsBundle(admin, primaryUserId);
    saveMergeFlag(primaryUserId, sumStatsModes(stats), sumStatsModes(stats));
    await validateMerge(admin, primaryUserId, loadMergeFlag());
    process.exit(0);
  }

  if (secondaryProfileId === primaryUserId) {
    console.log("Accounts already share the same user id.");
    const stats = await loadStatsBundle(admin, primaryUserId);
    saveMergeFlag(primaryUserId, sumStatsModes(stats), sumStatsModes(stats));
    process.exit(0);
  }

  const [primaryStats, secondaryStats] = await Promise.all([
    loadStatsBundle(admin, primaryUserId),
    loadStatsBundle(admin, secondaryProfileId),
  ]);
  const statsBeforePrimary = sumStatsModes(primaryStats);
  const statsBeforeSecondary = sumStatsModes(secondaryStats);

  for (const mode of STAT_MODES) {
    const merged = mergeUserStatsData(
      primaryStats[mode] ?? { ...EMPTY_STATS },
      secondaryStats[mode] ?? { ...EMPTY_STATS }
    );
    await saveStatsBundle(admin, primaryUserId, mode, merged);
  }

  const [primaryFunds, secondaryFunds] = await Promise.all([
    loadClubFunds(admin, primaryUserId),
    loadClubFunds(admin, secondaryProfileId),
  ]);
  const mergedFunds = mergeClubFunds(primaryFunds, secondaryFunds);
  await saveClubFunds(admin, primaryUserId, mergedFunds);
  await admin
    .from("user_stats")
    .delete()
    .eq("user_id", secondaryProfileId)
    .eq("mode", CLUB_FUNDS_MODE)
    .eq("stat_key", CLUB_FUNDS_KEY);

  const leaderboardMerged = await mergeLeaderboardRows(
    admin,
    primaryUserId,
    secondaryProfileId
  );

  await admin
    .from("profiles")
    .update({ coach_name: PRIMARY_COACH, updated_at: new Date().toISOString() })
    .eq("id", primaryUserId);

  await admin.from("profiles").delete().eq("id", secondaryProfileId);

  await admin.auth.admin.updateUserById(primaryUserId, {
    email: TARGET_EMAIL,
    user_metadata: { coach_name: PRIMARY_COACH },
  });

  await admin
    .from("user_stats")
    .delete()
    .eq("user_id", secondaryProfileId)
    .eq("stat_key", BUNDLE_KEY);

  const statsAfterBundle = await loadStatsBundle(admin, primaryUserId);
  const statsAfter = sumStatsModes(statsAfterBundle);
  saveMergeFlag(primaryUserId, {
    primaryTotalRuns: statsBeforePrimary.totalRuns,
    secondaryTotalRuns: statsBeforeSecondary.totalRuns,
    mergedTotalRuns: statsAfter.totalRuns,
  }, statsAfter);

  console.log("Coachbeard account merge complete");
  console.log(`  Primary user: ${primaryUserId}`);
  console.log(`  Email: ${TARGET_EMAIL}`);
  console.log(`  Leaderboard rows merged: ${leaderboardMerged}`);
  console.log(`  Club funds totalEarned: ${mergedFunds.totalEarned}`);
  console.log(`  ${SECONDARY_COACH} profile removed`);
  console.log("✓ Idempotent flag saved at data/coachbeard-merge-complete.json");

  await validateMerge(admin, primaryUserId, loadMergeFlag());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
