"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  markEmailConfirmBannerShown,
  shouldShowEmailConfirmBanner,
} from "@/lib/auth-callback";
import { BTN, CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

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
    ? "Email confirmed. You're in."
    : "Email confirmed. Please log in.";

  const subtext = isLoggedIn
    ? "Stats now sync online."
    : "Log in to save stats online.";

  const dismiss = () => {
    setVisible(false);
    markEmailConfirmBannerShown();
    router.replace("/");
  };

  return (
    <div
      className={`${CARD.panel} mx-auto mb-6 max-w-md border border-theme-primary/40 bg-theme-primary/10 ${SPACING.cardPadding}`}
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={TYPO.sectionTitle}>Email confirmed</p>
          <p className={`mt-1 ${TYPO.body} text-gray-200`}>{message}</p>
          <p className={`mt-1 ${TYPO.bodySm}`}>{subtext}</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className={BTN.closeSm}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
