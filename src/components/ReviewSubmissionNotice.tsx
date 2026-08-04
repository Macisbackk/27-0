"use client";

interface ReviewSubmissionNoticeProps {
  submittedOnline: boolean;
  specialRun?: boolean;
  boostedRun?: boolean;
}

export function ReviewSubmissionNotice({
  submittedOnline,
  specialRun = false,
  boostedRun = false,
}: ReviewSubmissionNoticeProps) {
  const offlineMessage = specialRun
    ? "Bonus mode result — this run is kept separate from public records."
    : boostedRun
      ? "Boosted run — excluded from competitive leaderboards."
      : "Run stored locally — not submitted to online leaderboard.";

  return (
    <p
      className={`mx-auto mt-3 max-w-md text-center text-xs font-medium ${
        submittedOnline ? "text-theme-primary/90" : "text-gray-500"
      }`}
    >
      {submittedOnline
        ? "Submitted to online leaderboard."
        : offlineMessage}
    </p>
  );
}
