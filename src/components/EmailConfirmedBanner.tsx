"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  markEmailConfirmBannerShown,
  shouldShowEmailConfirmBanner,
} from "@/lib/auth-callback";

export function EmailConfirmedBanner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoggedIn, loading } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (searchParams.get("emailConfirmed") === "1" || shouldShowEmailConfirmBanner()) {
      setVisible(true);
      const timer = window.setTimeout(() => {
        setVisible(false);
        markEmailConfirmBannerShown();
        router.replace("/");
      }, 8000);
      return () => window.clearTimeout(timer);
    }
  }, [loading, isLoggedIn, searchParams, router]);

  if (!visible) return null;

  const message = isLoggedIn
    ? "Email confirmed successfully. You are now logged in."
    : "Email confirmed successfully. Please log in to continue.";

  const subtext = isLoggedIn
    ? "Your statistics will now save to your online account."
    : "You can now log in and save your statistics online.";

  const dismiss = () => {
    setVisible(false);
    markEmailConfirmBannerShown();
    router.replace("/");
  };

  return (
    <div
      className="matchday-panel mx-auto mb-6 max-w-md border border-accent-green/40 bg-accent-green/10 p-4"
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-sm font-bold uppercase tracking-wider text-accent-green">
            Email confirmed successfully
          </p>
          <p className="mt-1 text-sm text-gray-200">{message}</p>
          <p className="mt-1 text-xs text-gray-400">{subtext}</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 text-gray-500 transition hover:text-white"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
