"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function HomeAuthBar() {
  const { loading, isLoggedIn } = useAuth();

  if (loading || isLoggedIn) {
    return null;
  }

  return (
    <section className="flex flex-col items-center gap-3 rounded-[20px] bg-pitch-900 p-4 text-center">
      <div className="min-w-0">
        <p className="text-[15px] font-bold text-white">Playing as a guest</p>
        <p className="mt-0.5 text-[13px] text-[color:var(--fl-muted)]">Log in to save progress and join the leaderboards.</p>
      </div>
      <Link
        href="/login"
        className="flex h-11 w-full max-w-[240px] items-center justify-center rounded-[14px] bg-pitch-800 px-4 text-sm font-bold text-white hover:bg-pitch-700"
      >
        Log in
      </Link>
    </section>
  );
}
