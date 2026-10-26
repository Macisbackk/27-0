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
  /** Weekly Challenge — the ranked attempt goes on the Weekly board, not Classic rankings. */
  weeklyChallenge?: boolean;
  /** Weekly Challenge: this run's score once it has been worked out. */
  weeklyScore?: number | null;
  /** Weekly Challenge: practice run after this week's ranked attempt. */
  weeklyPractice?: boolean;
}

export function ReviewSubmissionNotice({
  submittedOnline,
  specialRun = false,
  dailyChallenge = false,
  dailyPractice = false,
  ballKnower = false,
  weeklyChallenge = false,
  weeklyScore = null,
  weeklyPractice = false,
}: ReviewSubmissionNoticeProps) {
  let message: string;
  let positive = false;

  if (specialRun) {
    message =
      "Bonus mode result — this run is kept separate from public records.";
  } else if (weeklyChallenge && weeklyPractice) {
    message = `${weeklyScore !== null ? `Weekly score ${weeklyScore}. ` : ""}Practice run: this week's ranked attempt is already used.`;
  } else if (weeklyChallenge) {
    const scoreText = weeklyScore !== null ? `Weekly score ${weeklyScore}. ` : "";
    message = `${scoreText}This week's ranked attempt: it goes on the Weekly board when you're logged in. Top 10 when the week ends earn Club Funds.`;
    positive = true;
  } else if (dailyChallenge && dailyPractice) {
    message = "Practice run: it doesn't count toward your Daily streak.";
  } else if (dailyChallenge) {
    message =
      "Today's counted Daily run: finishing it extends your streak, and it scores on today's Daily board (top the table and win the Grand Final for a perfect day). Daily runs aren't on the Classic leaderboard.";
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
