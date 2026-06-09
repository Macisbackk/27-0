"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  COACH_NAME_MAX_LENGTH,
  COACH_NAME_MIN_LENGTH,
} from "@/lib/storage/user";
import { RL_SECTION_TITLE_CLASS } from "./cards/rl-card";

type AuthMode = "signup" | "login";

function safeRedirect(path: string | null): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get("redirect"));
  const { loading, isLoggedIn, signUp, signIn } = useAuth();

  const [mode, setMode] = useState<AuthMode>("login");
  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [coachInput, setCoachInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  useEffect(() => {
    if (!loading && isLoggedIn) {
      router.replace(redirectTo);
    }
  }, [loading, isLoggedIn, router, redirectTo]);

  useEffect(() => {
    if (!cooldownUntil) {
      setCooldownSeconds(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownSeconds(remaining);
      if (remaining <= 0) setCooldownUntil(null);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const signupBlocked = mode === "signup" && cooldownSeconds > 0;

  const handleSubmit = async () => {
    if (signupBlocked) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      if (mode === "signup") {
        const result = await signUp(
          emailInput,
          password,
          confirmPassword,
          coachInput
        );
        if (!result.ok) {
          setError(result.error ?? "Sign up failed.");
          if (result.cooldownSeconds) {
            setCooldownUntil(Date.now() + result.cooldownSeconds * 1000);
          }
        } else if (result.emailSent) {
          setSuccess("Confirmation email sent. Please check your inbox.");
          if (result.cooldownSeconds) {
            setCooldownUntil(Date.now() + result.cooldownSeconds * 1000);
          }
        } else {
          router.replace(redirectTo);
        }
      } else {
        const result = await signIn(emailInput, password);
        if (!result.ok) {
          setError(result.error ?? "Log in failed.");
        } else {
          router.replace(redirectTo);
        }
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="matchday-panel p-6 text-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  return (
    <section className="matchday-panel p-6 sm:p-8">
      <p className={RL_SECTION_TITLE_CLASS}>27-0 Account</p>

      <Link
        href="/#play-modes"
        className="mt-4 block w-full rounded-lg border border-accent-green/40 bg-accent-green/10 px-6 py-3 text-center font-display text-sm font-bold uppercase tracking-wider text-accent-green transition hover:bg-accent-green/20"
      >
        Continue as Guest
      </Link>
      <p className="mt-2 text-center text-xs text-gray-500">
        Play without an account — stats stay on this device only.
      </p>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError(null);
            setSuccess(null);
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
            setSuccess(null);
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

      {success && (
        <p className="mt-3 text-sm font-medium text-accent-green" role="status">
          {success}
        </p>
      )}

      {error && (
        <p className="mt-3 text-sm font-medium text-red-400" role="alert">
          {error}
        </p>
      )}

      {signupBlocked && (
        <p className="mt-2 text-center text-xs text-gray-500">
          Please wait {cooldownSeconds}s before signing up again.
        </p>
      )}

      <button
        type="button"
        disabled={busy || signupBlocked}
        onClick={() => void handleSubmit()}
        className="mt-5 w-full rounded-lg bg-accent-green px-6 py-3 font-display text-sm font-bold uppercase tracking-wider text-pitch-950 transition hover:bg-emerald-400 disabled:opacity-50"
      >
        {mode === "signup"
          ? signupBlocked
            ? `Wait ${cooldownSeconds}s`
            : "Create Account"
          : "Log In"}
      </button>
    </section>
  );
}
