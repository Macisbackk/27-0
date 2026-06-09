"use client";

import Link from "next/link";

interface ReviewPlayAgainProps {
  onPlayAgain: () => void;
  leaderboardHref?: string;
  compact?: boolean;
}

export function ReviewPlayAgain({
  onPlayAgain,
  leaderboardHref = "/leaderboard",
  compact = false,
}: ReviewPlayAgainProps) {
  return (
    <div
      className={`w-full max-w-xl space-y-3 ${compact ? "" : "mt-2"}`}
    >
      <button
        type="button"
        onClick={onPlayAgain}
        className="btn-play-again w-full py-4 text-lg"
      >
        Play Again
      </button>
      <div className="grid grid-cols-2 gap-3">
        <Link href="/" className="btn-secondary text-center">
          Return Home
        </Link>
        <Link href={leaderboardHref} className="btn-secondary text-center">
          Leaderboard
        </Link>
      </div>
    </div>
  );
}
