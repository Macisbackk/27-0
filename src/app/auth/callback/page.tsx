"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  detectPasswordRecoveryRedirect,
  markEmailConfirmPending,
} from "@/lib/auth-callback";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (detectPasswordRecoveryRedirect()) {
      const search = window.location.search;
      const hash = window.location.hash;
      router.replace(`/auth/reset-password${search}${hash}`);
      return;
    }

    void (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else {
          const { error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
        }

        markEmailConfirmPending();
        router.replace("/?emailConfirmed=1");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not confirm email.";
        setError(message);
      }
    })();
  }, [router]);

  if (error) {
    return (
      <div className="matchday-arena flex min-h-[50vh] items-center justify-center px-4">
        <div className="matchday-panel max-w-md p-6 text-center">
          <p className="font-display text-sm font-bold text-red-400">
            Email confirmation failed
          </p>
          <p className="mt-2 text-sm text-gray-400">{error}</p>
          <button
            type="button"
            onClick={() => router.replace("/")}
            className="mt-4 text-sm text-accent-green hover:underline"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="matchday-arena flex min-h-[50vh] items-center justify-center px-4">
      <p className="text-sm text-gray-400">Confirming your email…</p>
    </div>
  );
}
