"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { RL_SECTION_TITLE_CLASS } from "./cards/rl-card";

export function HomeAuthBar() {
  const { loading, isLoggedIn } = useAuth();

  if (loading || isLoggedIn) {
    return null;
  }

  return (
    <section className="matchday-panel mx-auto max-w-md p-5 text-center sm:p-6">
      <p className={RL_SECTION_TITLE_CLASS}>Get Started</p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Link
          href="/login"
          className="rounded-lg bg-accent-green px-6 py-3 font-display text-sm font-bold uppercase tracking-wider text-pitch-950 transition hover:bg-emerald-400"
        >
          Log In
        </Link>
        <Link
          href="#play-modes"
          className="rounded-lg border border-accent-green/40 bg-accent-green/10 px-6 py-3 font-display text-sm font-bold uppercase tracking-wider text-accent-green transition hover:bg-accent-green/20"
        >
          Play as Guest
        </Link>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Guest play keeps stats on this device only. Log in to submit leaderboard
        scores.
      </p>
    </section>
  );
}
