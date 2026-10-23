"use client";

interface ReviewSubmissionNoticeProps {
  submittedOnline: boolean;
  specialRun?: boolean;
  /** Kept for callers; boosted runs are eligible for competitive leaderboards. */
  boostedRun?: boolean;
  /** Daily Challenge — streak board, not Classic rankings. */
  dailyChallenge?: boolean;
  /** Daily practice run (today's counted attempt is already used). */
  dailyPractice?: boolean;
  /** Ball Knower runs aren't on any leaderboard. */
  ballKnower?: boolean;
}

export function ReviewSubmissionNotice({
  submittedOnline,
  specialRun = false,
  dailyChallenge = false,
  dailyPractice = false,
  ballKnower = false,
}: ReviewSubmissionNoticeProps) {
  let message: string;
  let positive = false;

  if (specialRun) {
    message =
      "Bonus mode result — this run is kept separate from public records.";
  } else if (dailyChallenge && dailyPractice) {
    message = "Practice run: it doesn't count toward your Daily streak.";
  } else if (dailyChallenge) {
    message =
      "Today's counted Daily run. Top the table and win the Grand Final to extend your streak. Daily runs aren't on the Classic leaderboard.";
    positive = true;
  } else if (ballKnower) {
    message = "Ball Knower runs aren't ranked on the leaderboard.";
  } else if (submittedOnline) {
    message = "Submitted to online leaderboard.";
    positive = true;
  } else {
    message = "Run stored locally — not submitted to online leaderboard.";
  }

  return (
    <p
      className={`mx-auto mt-3 max-w-md text-center text-xs font-semibold ${
        positive ? "text-theme-primary" : "text-[color:var(--fl-muted)]"
      }`}
    >
      {message}
    </p>
  );
}
