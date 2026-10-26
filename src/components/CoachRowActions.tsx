"use client";

import { useState } from "react";
import { GameModal } from "@/components/ui/GameModal";
import { GameButton } from "@/components/ui/GameButton";
import { useAuth } from "@/lib/auth-context";
import { CONTACT_EMAIL, contactMailto } from "@/lib/contact";
import {
  REPORT_REASONS,
  submitCoachReport,
  type ReportBoard,
  type ReportReason,
  type ReportResult,
} from "@/lib/moderation/reports";
import { hideCoach } from "@/lib/storage/hidden-coaches";
import { playUiClick } from "@/lib/sound";
import { TYPO } from "@/lib/ui/typography";

const RESULT_TEXT: Record<ReportResult["status"], string> = {
  sent: "Thanks, report sent. We review reports within 24 hours, and a name reported by several players is hidden straight away until we've checked it.",
  duplicate: "You've already reported this coach today. We'll look at it.",
  login: "Log in to report a coach.",
  self: "That's you.",
  limit: "You've sent a lot of reports today. Try again tomorrow, or email us.",
  "unknown-coach": "We couldn't find that coach online. Email us and we'll look into it.",
  offline: "Couldn't send the report. Check your connection and try again.",
  error: "Couldn't send the report. Try again, or email us.",
};

/**
 * The ⋯ button on another coach's leaderboard row: report the coach, or hide them from your own
 * boards (App Review 1.2). Not shown on your own row or on rows with no account behind them.
 */
export function CoachRowActions({
  userId,
  coachName,
  displayName,
  board,
}: {
  userId?: string;
  /** Name as stored on the board (sent with the report). */
  coachName: string;
  /** Name as shown (may be "Coach #1234"). */
  displayName: string;
  board: ReportBoard;
}) {
  const { isLoggedIn } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("offensive_name");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);

  const close = () => {
    setOpen(false);
    setResult(null);
    setBusy(false);
  };

  const onReport = async () => {
    setBusy(true);
    const r = await submitCoachReport({ reportedUserId: userId, coachName, board, reason });
    setResult(r);
    setBusy(false);
  };

  const onHide = () => {
    if (!userId) return;
    playUiClick();
    hideCoach(userId, displayName);
    close();
  };

  const titleId = `coach-actions-${board}-${userId ?? coachName}`;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          playUiClick();
          setOpen(true);
        }}
        aria-label={`Report or hide ${displayName}`}
        aria-haspopup="dialog"
        className="-my-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-white/5 hover:text-gray-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/60"
      >
        <span aria-hidden className="text-base leading-none">⋯</span>
      </button>
      <GameModal open={open} onClose={close} labelledBy={titleId}>
        <div className="space-y-4 text-left">
          <div>
            <p className={TYPO.sectionLabel}>Coach</p>
            <p id={titleId} className={`mt-0.5 ${TYPO.cardHeading} [overflow-wrap:anywhere]`}>
              {displayName}
            </p>
          </div>

          {!isLoggedIn ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-300">
                Log in to report a coach or hide them from your leaderboards.
              </p>
              <GameButton size="sm" href="/login?redirect=/leaderboard">
                Log in
              </GameButton>
              <p className="text-xs text-gray-500">
                Or email{" "}
                <a className="font-semibold text-theme-primary" href={contactMailto("27-0 leaderboard report")}>
                  {CONTACT_EMAIL}
                </a>
                .
              </p>
            </div>
          ) : result ? (
            <div className="space-y-3" role="status">
              <p className="text-sm text-gray-200">{RESULT_TEXT[result.status]}</p>
              <p className="text-xs text-gray-500">
                Anything urgent:{" "}
                <a className="font-semibold text-theme-primary" href={contactMailto("27-0 leaderboard report")}>
                  {CONTACT_EMAIL}
                </a>
              </p>
              {userId ? (
                <GameButton variant="secondary" size="sm" onClick={onHide}>
                  Also hide this coach
                </GameButton>
              ) : null}
              <GameButton size="sm" onClick={close}>
                Done
              </GameButton>
            </div>
          ) : (
            <>
              <fieldset className="space-y-2">
                <legend className={`mb-1 ${TYPO.sectionLabel}`}>Report</legend>
                {REPORT_REASONS.map((r) => (
                  <label
                    key={r.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-control border px-3 py-2.5 transition ${
                      reason === r.id ? "border-theme-primary/60 bg-theme-primary/10" : "border-white/10 bg-pitch-800"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${titleId}-reason`}
                      value={r.id}
                      checked={reason === r.id}
                      onChange={() => setReason(r.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-sm font-semibold text-white">{r.label}</span>
                      <span className="block text-xs text-gray-400">{r.hint}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <GameButton size="sm" disabled={busy} onClick={() => void onReport()}>
                {busy ? "Sending…" : "Send report"}
              </GameButton>
              {userId ? (
                <div className="border-t border-white/10 pt-4">
                  <GameButton variant="secondary" size="sm" onClick={onHide}>
                    Hide this coach
                  </GameButton>
                  <p className="mt-2 text-xs text-gray-500">
                    You won&apos;t see them on any leaderboard. Undo in Settings → Hidden coaches.
                  </p>
                </div>
              ) : null}
              <button type="button" onClick={close} className="w-full text-center text-xs font-semibold text-gray-400 hover:text-white">
                Cancel
              </button>
            </>
          )}
        </div>
      </GameModal>
    </>
  );
}
