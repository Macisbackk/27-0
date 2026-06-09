"use client";

import { useCallback, useEffect, useState } from "react";
import {
  getUsername,
  setUsername,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/storage/user";
import { RL_SECTION_TITLE_CLASS } from "./cards/rl-card";

export function CoachUsernameCard() {
  const [savedName, setSavedName] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setSavedName(getUsername());
  }, []);

  useEffect(() => {
    refresh();
    setMounted(true);
  }, [refresh]);

  const handleConfirm = () => {
    const result = setUsername(input);
    if (!result.valid) {
      setError(result.error ?? "Invalid username.");
      return;
    }
    setError(null);
    setInput("");
    setEditing(false);
    refresh();
    window.dispatchEvent(new Event("coach-username-changed"));
  };

  const handleChange = () => {
    setInput(savedName ?? "");
    setError(null);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setInput("");
    setError(null);
  };

  if (!mounted) {
    return (
      <div className="matchday-panel mx-auto max-w-md p-6 text-center text-sm text-gray-500">
        Loading coach profile…
      </div>
    );
  }

  const showSetup = !savedName || editing;

  if (showSetup) {
    return (
      <section className="matchday-panel mx-auto max-w-md p-6 sm:p-8">
        <p className={RL_SECTION_TITLE_CLASS}>Coach Profile</p>
        <h2 className="mt-2 font-display text-xl font-black uppercase tracking-tight text-white sm:text-2xl">
          Choose Your Coach Name
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          This name appears on the online leaderboard for every run you complete.
        </p>

        <div className="mt-5">
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            placeholder="Enter username"
            maxLength={USERNAME_MAX_LENGTH}
            autoFocus
            className="w-full rounded-lg border border-pitch-600 bg-pitch-900/80 px-4 py-3 font-medium text-white outline-none transition placeholder:text-gray-600 focus:border-accent-green"
          />
          <p className="mt-2 text-xs text-gray-500">
            {USERNAME_MIN_LENGTH}–{USERNAME_MAX_LENGTH} characters · letters,
            numbers and underscores
          </p>
          {error && (
            <p className="mt-2 text-sm font-medium text-red-400" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-lg bg-accent-green px-6 py-3 font-display text-sm font-bold uppercase tracking-wider text-pitch-950 transition hover:bg-emerald-400"
          >
            Confirm Coach Name
          </button>
          {savedName && editing && (
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-pitch-600 px-6 py-3 font-display text-sm font-bold uppercase tracking-wider text-gray-400 transition hover:text-white"
            >
              Cancel
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="matchday-panel mx-auto flex max-w-md flex-col items-center gap-4 p-5 sm:flex-row sm:justify-between sm:p-6">
      <div className="text-center sm:text-left">
        <p className="font-display text-[10px] font-bold uppercase tracking-[0.25em] text-accent-green">
          Coach
        </p>
        <p className="mt-1 font-display text-2xl font-black uppercase tracking-wide text-white">
          {savedName}
        </p>
      </div>
      <button
        type="button"
        onClick={handleChange}
        className="rounded-lg border border-pitch-600 bg-pitch-900/60 px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-gray-300 transition hover:border-accent-green/50 hover:text-white"
      >
        Change Coach Name
      </button>
    </section>
  );
}

export function notifyCoachUsernameChanged(): void {
  window.dispatchEvent(new Event("coach-username-changed"));
}
