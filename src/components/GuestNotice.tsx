"use client";

import { useAuth } from "@/lib/auth-context";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface GuestNoticeProps {
  variant?: "home" | "play" | "inline";
}

const GUEST_NOTICE_TEXT =
  "Playing as Guest — your records are saved on this device only.";

export function GuestNotice({ variant = "inline" }: GuestNoticeProps) {
  const { isLoggedIn, loading } = useAuth();

  if (loading || isLoggedIn) return null;

  if (variant === "home") {
    return (
      <p className={`mx-auto mt-4 max-w-md text-center ${TYPO.bodySm}`}>
        {GUEST_NOTICE_TEXT}
      </p>
    );
  }

  if (variant === "play") {
    return (
      <div className={`mb-4 ${CARD.base} ${SPACING.cardPaddingSm} text-center ${TYPO.bodySm}`}>
        {GUEST_NOTICE_TEXT}
      </div>
    );
  }

  return <p className={TYPO.bodySm}>{GUEST_NOTICE_TEXT}</p>;
}
