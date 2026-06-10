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
          href="#play-modes"
          className="rounded-lg bg-accent-green px-6 py-3 font-display text-sm font-bold uppercase tracking-wider text-pitch-950 transition hover:bg-emerald-400"
        >
          Play as Guest
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-accent-green/40 bg-accent-green/10 px-6 py-3 font-display text-sm font-bold uppercase tracking-wider text-accent-green transition hover:bg-accent-green/20"
        >
          Log In
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-pitch-600/60 bg-pitch-900/60 px-6 py-3 font-display text-sm font-bold uppercase tracking-wider text-gray-300 transition hover:border-pitch-500 hover:text-white"
        >
          Create Account
        </Link>
      </div>
      <p className="mt-3 text-xs text-gray-500">
        Guest play saves stats on this device only. Log in to submit online
        leaderboard scores.
      </p>
    </section>
  );
}
