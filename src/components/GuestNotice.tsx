"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { GameButton } from "@/components/ui/GameButton";
import { playUiClick } from "@/lib/sound";

interface GuestNoticeProps {
  variant?: "home" | "play" | "inline";
}

const GUEST_NOTICE_TEXT =
  "Playing as Guest — your records are saved on this device only.";

function loginHref(pathname: string): string {
  const redirect = encodeURIComponent(pathname || "/");
  return `/login?redirect=${redirect}`;
}

export function GuestNotice({ variant = "inline" }: GuestNoticeProps) {
  const { isLoggedIn, loading } = useAuth();
  const pathname = usePathname();

  if (loading || isLoggedIn) return null;

  if (variant === "home") {
    return (
      <div className={`mx-auto mt-4 max-w-md text-center ${SPACING.stackSm}`}>
        <p className={TYPO.bodySm}>{GUEST_NOTICE_TEXT}</p>
        <GameButton
          variant="secondary"
          size="sm"
          href={loginHref(pathname)}
          onClick={() => playUiClick()}
        >
          Sign in to sync stats & leaderboard
        </GameButton>
      </div>
    );
  }

  if (variant === "play") {
    return (
      <div
        className={`mb-4 ${CARD.base} ${SPACING.cardPaddingSm} text-center ${SPACING.stackSm}`}
      >
        <p className={TYPO.bodySm}>{GUEST_NOTICE_TEXT}</p>
        <Link
          href={loginHref(pathname)}
          onClick={() => playUiClick()}
          className="inline-block text-sm font-semibold text-theme-primary hover:underline"
        >
          Sign in to save your run →
        </Link>
      </div>
    );
  }

  return (
    <p className={TYPO.bodySm}>
      {GUEST_NOTICE_TEXT}{" "}
      <Link
        href={loginHref(pathname)}
        className="font-semibold text-theme-primary hover:underline"
      >
        Sign in
      </Link>
    </p>
  );
}
