"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  COACH_NAME_MAX_LENGTH,
  COACH_NAME_MIN_LENGTH,
} from "@/lib/storage/user";
import { RL_SECTION_TITLE_CLASS } from "./cards/rl-card";

type AuthMode = "signup" | "login";

export function AuthCoachCard() {
  const {
    loading,
    isLoggedIn,
    coachName,
    email,
    signUp,
    signIn,
    signOut,
    updateCoachName,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [coachInput, setCoachInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingCoach, setEditingCoach] = useState(false);

  const scrollToPlay = () => {
    document.getElementById("play-modes")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const handleSubmit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        const result = await signUp(
          emailInput,
          password,
          confirmPassword,
          coachInput
        );
        if (!result.ok) setError(result.error ?? "Sign up failed.");
      } else {
        const result = await signIn(emailInput, password);
        if (!result.ok) setError(result.error ?? "Log in failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateCoach = async () => {
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
  };

  if (loading) {
    return (
      <div className="matchday-panel mx-auto max-w-md p-6 text-center text-sm text-gray-500">
        Loading account…
      </div>
    );
  }

  if (isLoggedIn && !editingCoach) {
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

  if (isLoggedIn && editingCoach) {
    return (
      <section className="matchday-panel mx-auto max-w-md p-6">
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
            onClick={() => void handleUpdateCoach()}
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
    <section className="matchday-panel mx-auto max-w-md p-6 sm:p-8">
      <p className={RL_SECTION_TITLE_CLASS}>Account</p>

      <button
        type="button"
        onClick={scrollToPlay}
        className="mt-4 w-full rounded-lg border border-accent-green/40 bg-accent-green/10 px-6 py-3 font-display text-sm font-bold uppercase tracking-wider text-accent-green transition hover:bg-accent-green/20"
      >
        Continue as Guest
      </button>
      <p className="mt-2 text-center text-xs text-gray-500">
        Play without an account — stats stay on this device only.
      </p>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError(null);
          }}
          className={`flex-1 rounded-lg px-4 py-2 font-display text-xs font-bold uppercase tracking-wider ${
            mode === "login"
              ? "bg-accent-green text-pitch-950"
              : "bg-pitch-800 text-gray-400"
          }`}
        >
          Log In
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("signup");
            setError(null);
          }}
          className={`flex-1 rounded-lg px-4 py-2 font-display text-xs font-bold uppercase tracking-wider ${
            mode === "signup"
              ? "bg-accent-green text-pitch-950"
              : "bg-pitch-800 text-gray-400"
          }`}
        >
          Create Account
        </button>
      </div>

      <div className="mt-5 space-y-3">
        <input
          type="email"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="Email"
          className="w-full rounded-lg border border-pitch-600 bg-pitch-900/80 px-4 py-3 text-white outline-none focus:border-accent-green"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-lg border border-pitch-600 bg-pitch-900/80 px-4 py-3 text-white outline-none focus:border-accent-green"
        />
        {mode === "signup" && (
          <>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
              className="w-full rounded-lg border border-pitch-600 bg-pitch-900/80 px-4 py-3 text-white outline-none focus:border-accent-green"
            />
            <input
              type="text"
              value={coachInput}
              onChange={(e) => setCoachInput(e.target.value)}
              placeholder="Coach Name"
              maxLength={COACH_NAME_MAX_LENGTH}
              className="w-full rounded-lg border border-pitch-600 bg-pitch-900/80 px-4 py-3 text-white outline-none focus:border-accent-green"
            />
            <p className="text-xs text-gray-500">
              Coach name {COACH_NAME_MIN_LENGTH}–{COACH_NAME_MAX_LENGTH}{" "}
              characters · letters, numbers, underscores
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="mt-3 text-sm font-medium text-red-400" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={busy}
        onClick={() => void handleSubmit()}
        className="mt-5 w-full rounded-lg bg-accent-green px-6 py-3 font-display text-sm font-bold uppercase tracking-wider text-pitch-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {mode === "signup" ? "Create Account" : "Log In"}
      </button>
    </section>
  );
}
