"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  COACH_NAME_MAX_LENGTH,
  COACH_NAME_MIN_LENGTH,
} from "@/lib/storage/user";
import { BTN, CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { ManagerSubTabBar } from "@/components/manager/ManagerSubTabBar";

type AuthMode = "signup" | "login";

function safeRedirect(path: string | null): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/";
  return path;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get("redirect"));
  const passwordResetSuccess = searchParams.get("passwordReset") === "1";
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
  const errorId = "login-form-error";
  const successId = "login-form-success";
  const emailId = "login-email";
  const passwordId = "login-password";
  const confirmPasswordId = "login-confirm-password";
  const coachId = "login-coach-name";

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
      <div className={`${CARD.panel} ${SPACING.cardPadding} text-center ${TYPO.bodySm}`}>
        Loading…
      </div>
    );
  }

  return (
    <section className={`${CARD.panel} ${SPACING.cardPaddingLg}`}>
      <p className={TYPO.sectionTitle}>27-0 Account</p>

      {passwordResetSuccess && (
        <p className={`mt-3 ${TYPO.body} text-accent-green`}>
          Password updated. Log in with your new password.
        </p>
      )}

      <Link
        href="/#play-modes"
        className={`mt-4 block w-full text-center ${BTN.base} ${BTN.accentOutline}`}
      >
        Continue as Guest
      </Link>
      <p className={`mt-2 text-center ${TYPO.bodySm}`}>
        Play without an account — stats stay on this device only.
      </p>

      <div className="mt-6">
        <ManagerSubTabBar
          tabs={[
            { id: "login", label: "Log In" },
            { id: "signup", label: "Create Account" },
          ]}
          active={mode}
          onChange={(next) => {
            setMode(next);
            setError(null);
            setSuccess(null);
          }}
          ariaLabel="Account mode"
        />
      </div>

      <div className={`mt-5 ${SPACING.stackMd}`}>
        <label htmlFor={emailId} className="sr-only">
          Email
        </label>
        <input
          id={emailId}
          type="email"
          autoComplete="email"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="Email"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : success ? successId : undefined}
          className={FILTER.input}
        />
        <label htmlFor={passwordId} className="sr-only">
          Password
        </label>
        <input
          id={passwordId}
          type="password"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : success ? successId : undefined}
          className={FILTER.input}
        />
        {mode === "signup" && (
          <>
            <label htmlFor={confirmPasswordId} className="sr-only">
              Confirm password
            </label>
            <input
              id={confirmPasswordId}
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : success ? successId : undefined}
              className={FILTER.input}
            />
            <label htmlFor={coachId} className="sr-only">
              Coach name
            </label>
            <input
              id={coachId}
              type="text"
              autoComplete="nickname"
              value={coachInput}
              onChange={(e) => setCoachInput(e.target.value)}
              placeholder="Coach Name"
              maxLength={COACH_NAME_MAX_LENGTH}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : success ? successId : undefined}
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
        <p
          id={successId}
          className={`mt-3 ${TYPO.body} font-medium text-accent-green`}
          role="status"
        >
          {success}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          className={`mt-3 ${TYPO.body} font-medium text-red-400`}
          role="alert"
        >
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
        className={`mt-5 w-full ${BTN.theme}`}
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
