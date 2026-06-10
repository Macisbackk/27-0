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
      className={`${CARD.panel} mx-auto mb-6 max-w-md border border-accent-green/40 bg-accent-green/10 ${SPACING.cardPadding} shadow-[0_0_24px_rgba(34,197,94,0.12)]`}
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={TYPO.sectionTitle}>Email confirmed successfully</p>
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
