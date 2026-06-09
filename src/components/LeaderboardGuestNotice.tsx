"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function LeaderboardGuestNotice() {
  const { isLoggedIn, loading } = useAuth();

  if (loading || isLoggedIn) return null;

  return (
    <p className="mb-4 text-sm text-gray-400">
      Log in to submit your own scores. You can still view online leaderboards as
      a guest.{" "}
      <Link href="/" className="text-accent-green hover:underline">
        Go to Home →
      </Link>
    </p>
  );
}
