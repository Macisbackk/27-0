"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

/** Guests only: a small chip pointing at the login welcome bonus. */
export function HomeAuthBar() {
  const { loading, isLoggedIn } = useAuth();

  if (loading || isLoggedIn) {
    return null;
  }

  return (
    <Link
      href="/login"
      aria-label="Log in to save your progress and get a £100k welcome bonus"
      className="mx-auto inline-flex h-11 items-center gap-2 rounded-full bg-pitch-900 pl-3 pr-4 text-[13px] font-semibold text-white hover:bg-pitch-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/70"
    >
      <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[color:var(--fl-muted)]">
        <circle cx="8" cy="15" r="4" />
        <path d="m10.8 12.2 9.2-9.2M17 6l3 3" />
      </svg>
      Log in to save
      <span className="rounded-full bg-theme-primary/15 px-2 py-0.5 font-cond text-[13px] font-bold text-theme-primary">+£100k</span>
    </Link>
  );
}
