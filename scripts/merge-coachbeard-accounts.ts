/**
 * One-time idempotent merge: coachbeard + coachbeard2 → coachbeard (macauley060897@live.co.uk)
 * Run: npm run merge:coachbeard-accounts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.
 */
// @ts-nocheck
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { mergeUserStatsData } from "../src/lib/storage/merge-user-stats";
import { migrateUserStats, EMPTY_STATS } from "../src/lib/storage/stats";
import type { UserStatsData } from "../src/lib/types";

const PRIMARY_COACH = "coachbeard";
const SECONDARY_COACH = "coachbeard2";
const TARGET_EMAIL = "macauley060897@live.co.uk";
const MERGE_FLAG_PATH = join(__dirname, "..", "data", "coachbeard-merge-complete.json");

const BUNDLE_KEY = "stats_bundle";
const STAT_MODES = [
  "NORMAL",
  "HARD",
  "DRAFT_NORMAL",
  "DRAFT_HARD",
  "FANTASY",
  "ERA_CUP",
] as const;

function loadMergeFlag(): { completedAt: string; primaryUserId: string } | null {
  if (!existsSync(MERGE_FLAG_PATH)) return null;
  try {
    return JSON.parse(readFileSync(MERGE_FLAG_PATH, "utf8")) as {
      completedAt: string;
      primaryUserId: string;
    };
  } catch {
    return null;
  }
}

function saveMergeFlag(primaryUserId: string): void {
  writeFileSync(
    MERGE_FLAG_PATH,
    `${JSON.stringify(
      { completedAt: new Date().toISOString(), primaryUserId, targetEmail: TARGET_EMAIL },
      null,
      2
    )}\n`
  );
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

async function mergeLeaderboardRows(
  admin: ReturnType<typeof createClient>,
  primaryUserId: string,
  secondaryUserId: string
): Promise<number> {
  const { data: secondaryRows, error } = await admin
    .from("leaderboard")
    .select("*")
    .eq("user_id", secondaryUserId);
  if (error) throw error;
  if (!secondaryRows?.length) return 0;

  let merged = 0;
  for (const row of secondaryRows) {
    const { id: _id, ...rest } = row as Record<string, unknown>;
    const { error: upsertError } = await admin.from("leaderboard").upsert({
      ...rest,
      user_id: primaryUserId,
      coach_name: PRIMARY_COACH,
      updated_at: new Date().toISOString(),
    });
    if (!upsertError) merged++;
  }

  await admin.from("leaderboard").delete().eq("user_id", secondaryUserId);
  return merged;
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error(
      "Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY — cannot merge remote accounts."
    );
    console.log("Merge script requires Supabase service role credentials.");
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
    const { data: profiles } = await admin
      .from("profiles")
      .select("coach_name")
      .ilike("coach_name", SECONDARY_COACH);
    if (profiles?.length) {
      console.warn(`Warning: ${SECONDARY_COACH} profile still exists — re-run cleanup manually.`);
    } else {
      console.log(`✓ ${SECONDARY_COACH} not shown separately`);
    }
    process.exit(0);
  }

  if (!secondaryProfileId) {
    console.log(`No ${SECONDARY_COACH} profile found — nothing to merge.`);
    saveMergeFlag(primaryUserId);
    process.exit(0);
  }

  if (secondaryProfileId === primaryUserId) {
    console.log("Accounts already share the same user id.");
    saveMergeFlag(primaryUserId);
    process.exit(0);
  }

  const [primaryStats, secondaryStats] = await Promise.all([
    loadStatsBundle(admin, primaryUserId),
    loadStatsBundle(admin, secondaryProfileId),
  ]);

  for (const mode of STAT_MODES) {
    const merged = mergeUserStatsData(
      primaryStats[mode] ?? { ...EMPTY_STATS },
      secondaryStats[mode] ?? { ...EMPTY_STATS }
    );
    await saveStatsBundle(admin, primaryUserId, mode, merged);
  }

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

  saveMergeFlag(primaryUserId);

  console.log("Coachbeard account merge complete");
  console.log(`  Primary user: ${primaryUserId}`);
  console.log(`  Email: ${TARGET_EMAIL}`);
  console.log(`  Leaderboard rows merged: ${leaderboardMerged}`);
  console.log(`  ${SECONDARY_COACH} profile removed`);
  console.log("✓ Idempotent flag saved");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
