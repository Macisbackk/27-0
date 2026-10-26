"use client";

import Link from "next/link";

/** Under a leaderboard: how many coaches you hid from it, with a link to undo in Settings. */
export function HiddenCoachesNote({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <p className="mt-3 text-center text-xs text-gray-500">
      {count === 1 ? "1 coach you hid isn't shown." : `${count} coaches you hid aren't shown.`}{" "}
      <Link href="/settings#hidden-coaches" className="font-semibold text-theme-primary underline-offset-2 hover:underline">
        Manage
      </Link>
    </p>
  );
}
