"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  COACH_NAME_MAX_LENGTH,
  COACH_NAME_MIN_LENGTH,
} from "@/lib/storage/user";
import {
  BTN,
  CARD,
  FILTER,
  SPACING,
  tabGroupButtonClass,
} from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

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
  } = useAuth();

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

  const scrollToPlay = () => {
    document.getElementById("play-modes")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

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
        }
      } else {
        const result = await signIn(emailInput, password);
        if (!result.ok) setError(result.error ?? "Log in failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className={`${CARD.panel} mx-auto max-w-md ${SPACING.cardPadding} text-center ${TYPO.bodySm}`}>
        Loading account…
      </div>
    );
  }

  if (isLoggedIn) {
    return (
      <section className={`${CARD.panel} mx-auto max-w-md ${SPACING.cardPadding}`}>
        <p className={TYPO.sectionTitle}>Coach Profile</p>
        <div className={`mt-3 ${SPACING.stackSm} text-center sm:text-left`}>
          <p className={TYPO.sectionLabel}>Coach</p>
          <p className={TYPO.pageTitle}>{coachName}</p>
          <p className={TYPO.bodySm}>
            Logged in as <span className="text-gray-300">{email}</span>
          </p>
        </div>
        <div className={`mt-5 flex flex-col ${SPACING.buttonGap} sm:flex-row sm:justify-center`}>
          <Link href="/profile" className={`${BTN.base} ${BTN.primary} text-center`}>
            View Profile
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className={`${BTN.base} ${BTN.danger}`}
          >
            Log Out
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className={`${CARD.panel} mx-auto max-w-md ${SPACING.cardPaddingLg}`}>
      <p className={TYPO.sectionTitle}>Account</p>

      <button
        type="button"
        onClick={scrollToPlay}
        className={`mt-4 w-full ${BTN.base} ${BTN.accentOutline}`}
      >
        Continue as Guest
      </button>
      <p className={`mt-2 text-center ${TYPO.bodySm}`}>
        Play without an account — stats stay on this device only.
      </p>

      <div className={`mt-6 flex ${SPACING.buttonGap}`}>
        <button
          type="button"
          onClick={() => {
            setMode("login");
            setError(null);
            setSuccess(null);
          }}
          className={`flex-1 ${tabGroupButtonClass(mode === "login")}`}
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
          className={`flex-1 ${tabGroupButtonClass(mode === "signup")}`}
        >
          Create Account
        </button>
      </div>

      <div className={`mt-5 ${SPACING.stackMd}`}>
        <input
          type="email"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="Email"
          className={FILTER.input}
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className={FILTER.input}
        />
        {mode === "signup" && (
          <>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
              className={FILTER.input}
            />
            <input
              type="text"
              value={coachInput}
              onChange={(e) => setCoachInput(e.target.value)}
              placeholder="Coach Name"
              maxLength={COACH_NAME_MAX_LENGTH}
              className={FILTER.input}
            />
            <p className={TYPO.bodySm}>
              Coach name {COACH_NAME_MIN_LENGTH}–{COACH_NAME_MAX_LENGTH}{" "}
              characters · letters, numbers, underscores
            </p>
          </>
        )}
      </div>

      {success && (
        <p className={`mt-3 ${TYPO.body} font-medium text-accent-green`} role="status">
          {success}
        </p>
      )}

      {error && (
        <p className={`mt-3 ${TYPO.body} font-medium text-red-400`} role="alert">
          {error}
        </p>
      )}

      {signupBlocked && (
        <p className={`mt-2 text-center ${TYPO.bodySm}`}>
          Please wait {cooldownSeconds}s before signing up again.
        </p>
      )}

      <button
        type="button"
        disabled={busy || signupBlocked}
        onClick={() => void handleSubmit()}
        className={`mt-5 w-full ${BTN.base} ${BTN.primary}`}
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
