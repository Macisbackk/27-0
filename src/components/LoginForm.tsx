"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  COACH_NAME_MAX_LENGTH,
  COACH_NAME_MIN_LENGTH,
} from "@/lib/storage/user";
import { MIN_PASSWORD_LENGTH, sendPasswordResetEmail } from "@/lib/auth";
import { BTN, CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { SubTabBar } from "@/components/ui/SubTabBar";

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
          // Email already has an account: flip to Log in with the email kept.
          if (result.error?.startsWith("There's already an account")) {
            setMode("login");
            setPassword("");
            setConfirmPassword("");
          }
          if (result.cooldownSeconds) {
            setCooldownUntil(Date.now() + result.cooldownSeconds * 1000);
          }
        } else if (result.emailSent) {
          setSuccess("Check your inbox to confirm your email.");
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

  const handleForgotPassword = async () => {
    setError(null);
    setSuccess(null);
    if (!emailInput.trim()) {
      setError("Enter your email first.");
      return;
    }
    setBusy(true);
    try {
      const result = await sendPasswordResetEmail(emailInput);
      if (!result.ok) setError(result.error ?? "Could not send reset email.");
      else setSuccess("Reset link sent if the account exists. Check your inbox and spam.");
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
        <p className={`mt-3 ${TYPO.body} text-theme-primary`}>
          Password updated. Log in with your new password.
        </p>
      )}

      <div className="mt-4">
        <SubTabBar
          tabs={[
            { id: "login", label: "Log in" },
            { id: "signup", label: "Create account" },
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

      <p className={`mt-3 text-center ${TYPO.bodySm}`}>
        Played as a guest? Your progress on this device moves into your account.
      </p>

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
          placeholder={mode === "signup" ? `Password (${MIN_PASSWORD_LENGTH}+ characters)` : "Password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : success ? successId : undefined}
          className={FILTER.input}
        />
        {mode === "login" && (
          <div className="flex justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleForgotPassword()}
              className="fl-pressable text-sm font-semibold text-theme-primary hover:underline disabled:opacity-50"
            >
              Forgot password?
            </button>
          </div>
        )}
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
              placeholder="Confirm password"
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
              placeholder="Coach name"
              maxLength={COACH_NAME_MAX_LENGTH}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : success ? successId : undefined}
              className={FILTER.input}
            />
            <p className={TYPO.bodySm}>
              {COACH_NAME_MIN_LENGTH}–{COACH_NAME_MAX_LENGTH} letters, numbers or underscores
            </p>
          </>
        )}
      </div>

      {success && (
        <p
          id={successId}
          className={`mt-3 ${TYPO.body} font-medium text-theme-primary`}
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
          Wait {cooldownSeconds}s to try again.
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
            : "Create account"
          : "Log in"}
      </button>

      <p className={`mt-5 text-center ${TYPO.bodySm}`}>
        Not now?{" "}
        <Link href="/" className="font-semibold text-theme-primary hover:underline">
          Keep playing as a guest
        </Link>
        <span className="block">Progress stays on this device.</span>
===
      </p>
    </section>
  );
}
