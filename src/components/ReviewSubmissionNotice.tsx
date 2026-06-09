"use client";

interface ReviewSubmissionNoticeProps {
  submittedOnline: boolean;
}

export function ReviewSubmissionNotice({
  submittedOnline,
}: ReviewSubmissionNoticeProps) {
  return (
    <p
      className={`mx-auto mt-3 max-w-md text-center text-xs font-medium ${
        submittedOnline ? "text-accent-green/90" : "text-gray-500"
      }`}
    >
      {submittedOnline
        ? "Submitted to online leaderboard."
        : "Guest run — not submitted to online leaderboard."}
    </p>
  );
}
