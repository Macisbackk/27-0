"use client";

/**
 * Report a coach from a leaderboard row (App Review 1.2). Writes one row to content_reports
 * (insert-own only; players can't read reports back). The database limits each reporter to one
 * report per coach per day and 20 a day, and hides a name reported by 3 different players until
 * the owner reviews it (supabase/migrations/20261026120000_moderation.sql, docs/MODERATION.md).
 */
import { isSupabaseConfigured, supabase } from "../supabase";
import { getAuthUserId } from "../auth-session";

export type ReportReason = "offensive_name" | "cheating" | "other";

export const REPORT_REASONS: { id: ReportReason; label: string; hint: string }[] = [
  { id: "offensive_name", label: "Offensive name", hint: "Swearing, slurs, sexual or hateful" },
  { id: "cheating", label: "Cheating", hint: "A score that can't be real" },
  { id: "other", label: "Something else", hint: "Anything else we should look at" },
];

/** Boards a report can come from (content_reports.board). */
export type ReportBoard = "classic" | "trophies" | "daily" | "weekly" | "manager" | "puzzles";

export type ReportResult =
  | { ok: true; status: "sent" | "duplicate" }
  | { ok: false; status: "login" | "self" | "limit" | "unknown-coach" | "offline" | "error" };

async function resolveUserId(coachName: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("coach_name", coachName)
    .limit(1)
    .maybeSingle();
  if (error || !data?.id) return null;
  return data.id as string;
}

export async function submitCoachReport(input: {
  reportedUserId?: string;
  coachName: string;
  board: ReportBoard;
  reason: ReportReason;
}): Promise<ReportResult> {
  const reporterId = getAuthUserId();
  if (!reporterId) return { ok: false, status: "login" };
  if (!isSupabaseConfigured) return { ok: false, status: "offline" };
  try {
    const reportedUserId = input.reportedUserId ?? (await resolveUserId(input.coachName));
    if (!reportedUserId) return { ok: false, status: "unknown-coach" };
    if (reportedUserId === reporterId) return { ok: false, status: "self" };
    const { error } = await supabase.from("content_reports").insert({
      reporter_id: reporterId,
      reported_user_id: reportedUserId,
      coach_name: input.coachName.slice(0, 64),
      board: input.board,
      reason: input.reason,
    });
    if (!error) return { ok: true, status: "sent" };
    // Already reported this coach today: nothing more to do.
    if (error.code === "23505") return { ok: true, status: "duplicate" };
    if (error.code === "23514" && /limit/i.test(error.message)) return { ok: false, status: "limit" };
    console.error("[reports] insert failed:", error);
    return { ok: false, status: "error" };
  } catch (err) {
    console.error("[reports] insert failed:", err);
    return { ok: false, status: "offline" };
  }
}
