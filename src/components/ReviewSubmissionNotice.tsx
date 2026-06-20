"use client";

interface ReviewSubmissionNoticeProps {
  submittedOnline: boolean;
  specialRun?: boolean;
}

export function ReviewSubmissionNotice({
  submittedOnline,
  specialRun = false,
}: ReviewSubmissionNoticeProps) {
  const offlineMessage = specialRun
    ? "Bonus mode result — this run is kept separate from public records."
    : "Run stored locally — not submitted to online leaderboard.";

  return (
    <p
      className={`mx-auto mt-3 max-w-md text-center text-xs font-medium ${
        submittedOnline ? "text-accent-green/90" : "text-gray-500"
      }`}
    >
      {submittedOnline
        ? "Submitted to online leaderboard."
        : offlineMessage}
    </p>
  );
}
