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
      "Bonus mode: kept off the public records.";
  } else if (weeklyChallenge && weeklyPractice) {
    message = `${weeklyScore !== null ? `Weekly score ${weeklyScore}. ` : ""}Practice run. This week's ranked run is used.`;
  } else if (weeklyChallenge) {
    const scoreText = weeklyScore !== null ? `Weekly score ${weeklyScore}. ` : "";
    message = `${scoreText}Your ranked run. Log in to post it. Top 10 earn Club Funds.`;
    positive = true;
  } else if (dailyChallenge && dailyPractice) {
    message = "Practice run. It doesn't count for your streak.";
  } else if (dailyChallenge) {
    message = "Today's Daily is done. Streak extended. Score posted to today's board.";
    positive = true;
  } else if (ballKnower) {
    message = "Ball Knower runs aren't ranked.";
  } else if (submittedOnline) {
    message = "Posted to the leaderboard.";
    positive = true;
  } else {
    message = "Saved on this device. Not on the leaderboard.";
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
