"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { COACH_NAME_MAX_LENGTH } from "@/lib/storage/user";
import { RL_SECTION_TITLE_CLASS } from "./cards/rl-card";

export function HomeAuthBar() {
  const {
    loading,
    isLoggedIn,
    coachName,
    email,
    signOut,
    updateCoachName,
  } = useAuth();
  const [editingCoach, setEditingCoach] = useState(false);
  const [coachInput, setCoachInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <div className="matchday-panel mx-auto max-w-md p-4 text-center text-sm text-gray-500">
        Loading account…
      </div>
    );
  }

  if (!isLoggedIn) {
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
          Guest play keeps stats on this device only. Log in to submit
          leaderboard scores.
        </p>
      </section>
    );
  }

  if (editingCoach) {
    return (
      <section className="matchday-panel mx-auto max-w-md p-5 sm:p-6">
        <h2 className="font-display text-lg font-black uppercase text-white">
          Change Coach Name
        </h2>
        <input
          type="text"
          value={coachInput}
          onChange={(e) => setCoachInput(e.target.value)}
          maxLength={COACH_NAME_MAX_LENGTH}
          className="mt-4 w-full rounded-lg border border-pitch-600 bg-pitch-900/80 px-4 py-3 text-white outline-none focus:border-accent-green"
        />
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const result = await updateCoachName(coachInput);
              if (!result.ok) {
                setError(result.error ?? "Could not update coach name.");
              } else {
                setEditingCoach(false);
                setCoachInput("");
              }
              setBusy(false);
            }}
            className="rounded-lg bg-accent-green px-5 py-2.5 font-display text-xs font-bold uppercase text-pitch-950"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditingCoach(false)}
            className="rounded-lg border border-pitch-600 px-5 py-2.5 text-xs text-gray-400"
          >
            Cancel
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="matchday-panel mx-auto max-w-md p-5 sm:p-6">
      <p className={RL_SECTION_TITLE_CLASS}>Coach Profile</p>
      <div className="mt-3 space-y-1 text-center sm:text-left">
        <p className="font-display text-[10px] font-bold uppercase tracking-[0.25em] text-accent-green">
          Coach
        </p>
        <p className="font-display text-2xl font-black uppercase tracking-wide text-white">
          {coachName}
        </p>
        <p className="text-sm text-gray-500">
          Logged in as <span className="text-gray-300">{email}</span>
        </p>
      </div>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <button
          type="button"
          onClick={() => {
            setCoachInput(coachName ?? "");
            setEditingCoach(true);
            setError(null);
          }}
          className="rounded-lg border border-pitch-600 bg-pitch-900/60 px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-gray-300 transition hover:border-accent-green/50 hover:text-white"
        >
          Change Coach Name
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="rounded-lg border border-pitch-600 px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-gray-400 transition hover:border-red-500/50 hover:text-red-400"
        >
          Log Out
        </button>
      </div>
    </section>
  );
}
