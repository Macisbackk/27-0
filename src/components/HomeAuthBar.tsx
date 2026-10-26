"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export function HomeAuthBar() {
  const { loading, isLoggedIn } = useAuth();

  if (loading || isLoggedIn) {
    return null;
  }

  return (
    <section className="flex items-center gap-3 rounded-card bg-pitch-900 p-3.5 text-left">
      <p className="min-w-0 flex-1 text-[13px] text-[color:var(--fl-muted)]">
        Playing as a guest. Log in to save progress and bank a{" "}
        <span className="font-bold text-theme-primary">£100k welcome bonus</span>.
      </p>
      <Link
        href="/login"
        className="flex h-10 shrink-0 items-center justify-center rounded-control bg-pitch-800 px-4 text-sm font-bold text-white hover:bg-pitch-700"
      >
        Log in
      </Link>
    </section>
  );
}
