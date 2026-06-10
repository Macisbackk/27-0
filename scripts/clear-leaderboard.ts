/**
 * Clears all rows from the Supabase leaderboard table.
 *
 * Requires service-role access (anon key cannot delete due to RLS):
 *   SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npx tsx scripts/clear-leaderboard.ts
 *   npx tsx scripts/clear-leaderboard.ts --include-draft-stats
 */

import { createClient } from "@supabase/supabase-js";

const includeDraftStats = process.argv.includes("--include-draft-stats");

const supabaseUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
  );
  console.error(
    "Alternatively run supabase/clear-leaderboard.sql in the Supabase SQL Editor."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const { count: beforeCount, error: countError } = await supabase
    .from("leaderboard")
    .select("*", { count: "exact", head: true });

  if (countError) {
    console.error("[clear-leaderboard] count failed:", countError.message);
    process.exit(1);
  }

  const { error: deleteError } = await supabase
    .from("leaderboard")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (deleteError) {
    console.error("[clear-leaderboard] delete failed:", deleteError.message);
    process.exit(1);
  }

  console.log(`Cleared ${beforeCount ?? 0} leaderboard row(s).`);

  if (includeDraftStats) {
    const { error: statsError } = await supabase
      .from("user_stats")
      .delete()
      .in("mode", ["DRAFT_NORMAL", "DRAFT_HARD"]);

    if (statsError) {
      console.error(
        "[clear-leaderboard] draft stats delete failed:",
        statsError.message
      );
      process.exit(1);
    }
    console.log("Cleared DRAFT_NORMAL and DRAFT_HARD user_stats bundles.");
  }
}

main().catch((err) => {
  console.error("[clear-leaderboard] unexpected error:", err);
  process.exit(1);
});
