"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updatePassword } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { cleanAuthRedirectFromUrl } from "@/lib/auth-callback";
import { BTN, CARD, FILTER, LINK, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

type ResetState = "loading" | "ready" | "success" | "error";

export function ResetPasswordForm() {
  const router = useRouter();
  const [state, setState] = useState<ResetState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!mounted) return;
      if (event === "PASSWORD_RECOVERY") {
        setState("ready");
        setError(null);
      }
    });

    void (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!mounted) return;

        if (data.session) {
          setState("ready");
          cleanAuthRedirectFromUrl();
        } else {
          setState("error");
          setError(
            "This reset link is invalid or has expired. Request a new password reset email from your profile."
          );
        }
      } catch (err) {
        if (!mounted) return;
        setState("error");
        setError(
          err instanceof Error
            ? err.message
            : "Could not verify your reset link."
        );
      }
    })();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async () => {
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    setError(null);
    const result = await updatePassword(password);
    if (!result.ok) {
      setError(result.error ?? "Could not update password.");
      setBusy(false);
      return;
    }

    setState("success");
    setBusy(false);
    window.setTimeout(() => {
      router.replace("/login?passwordReset=1");
    }, 2000);
  };

  if (state === "loading") {
    return (
      <div className={`${CARD.panel} ${SPACING.cardPadding} text-center ${TYPO.bodySm}`}>
        Verifying your reset link…
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className={`${CARD.panel} ${SPACING.cardPadding}`}>
        <p className={`${TYPO.cardTitle} text-red-400`}>Password reset failed</p>
        <p className={`mt-2 ${TYPO.body}`}>{error}</p>
        <Link href="/profile" className={`mt-4 inline-block ${LINK.accent}`}>
          Back to Coach Profile →
        </Link>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className={`${CARD.panel} ${SPACING.cardPadding} text-center`}>
        <p className={`${TYPO.cardTitle} text-accent-green`}>Password updated</p>
        <p className={`mt-2 ${TYPO.body}`}>
          Your new password is saved. Redirecting to log in…
        </p>
      </div>
    );
  }

  return (
    <section className={`${CARD.panel} ${SPACING.cardPaddingLg}`}>
      <p className={TYPO.sectionTitle}>Choose a new password</p>
      <p className={`mt-2 ${TYPO.bodySm}`}>
        Enter a new password for your 27-0 coach account.
      </p>

      <div className={`mt-4 ${SPACING.stackSm}`}>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          autoComplete="new-password"
          className={FILTER.input}
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          autoComplete="new-password"
          className={FILTER.input}
        />
      </div>

      {error && <p className={`mt-3 ${TYPO.body} text-red-400`}>{error}</p>}

      <button
        type="button"
        disabled={busy || !password || !confirmPassword}
        onClick={() => void handleSubmit()}
        className={`mt-4 w-full ${BTN.theme}`}
      >
        Save New Password
      </button>
    </section>
  );
}
