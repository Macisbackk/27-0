"use client";

interface ReviewSubmissionNoticeProps {
  submittedOnline: boolean;
  specialRun?: boolean;
  /** Kept for callers; boosted runs are eligible for competitive leaderboards. */
  boostedRun?: boolean;
  /** Daily Challenge — streak board, not Classic rankings. */
  dailyChallenge?: boolean;
}

export function ReviewSubmissionNotice({
  submittedOnline,
  specialRun = false,
  dailyChallenge = false,
}: ReviewSubmissionNoticeProps) {
  let message: string;
  let positive = false;

  if (specialRun) {
    message =
      "Bonus mode result — this run is kept separate from public records.";
  } else if (dailyChallenge) {
    message =
      "Counts toward your Daily Challenge streak — not Classic rankings.";
    positive = true;
  } else if (submittedOnline) {
    message = "Submitted to online leaderboard.";
    positive = true;
  } else {
    message = "Run stored locally — not submitted to online leaderboard.";
  }

  return (
    <p
      className={`mx-auto mt-3 max-w-md text-center text-xs font-medium ${
        positive ? "text-theme-primary/90" : "text-gray-500"
      }`}
    >
      {message}
    </p>
  );
}
