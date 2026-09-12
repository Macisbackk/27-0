"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { SHOW_DAILY_CHALLENGE_UI } from "@/lib/feature-flags";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { playUiClick } from "@/lib/sound";

interface GuestNoticeProps {
  variant?: "home" | "play" | "inline";
  /** Override Daily detection (play surfaces may pass this explicitly). */
  dailyChallenge?: boolean;
}

const GUEST_NOTICE_TEXT = "Guest — saved on this device only.";

function loginHref(pathname: string, dailyChallenge: boolean): string {
  const redirect = encodeURIComponent(
    dailyChallenge
      ? "/leaderboard?tracker=daily_streak"
      : pathname || "/"
  );
  return `/login?redirect=${redirect}`;
}

export function GuestNotice({
  variant = "inline",
  dailyChallenge,
}: GuestNoticeProps) {
  const { isLoggedIn, loading } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isDaily =
    dailyChallenge ??
    (SHOW_DAILY_CHALLENGE_UI && searchParams.get("daily") === "1");

  if (loading || isLoggedIn) return null;

  if (variant === "home") {
    return (
      <div
        className={`mx-auto mt-4 flex max-w-md flex-col items-center text-center ${SPACING.stackSm}`}
      >
        <p className={`w-full text-center ${TYPO.meta}`}>{GUEST_NOTICE_TEXT}</p>
      </div>
    );
  }

  if (variant === "play") {
    return (
      <div className={`mb-3 text-center ${SPACING.stackSm}`}>
        <p className={TYPO.meta}>{GUEST_NOTICE_TEXT}</p>
        <Link
          href={loginHref(pathname, isDaily)}
          onClick={() => playUiClick()}
          className="inline-block text-sm font-semibold text-theme-primary hover:underline"
        >
          {isDaily
            ? "Sign in to sync your Daily streak →"
            : "Sign in to save your run →"}
        </Link>
      </div>
    );
  }

  return (
    <p className={TYPO.bodySm}>
      {GUEST_NOTICE_TEXT}{" "}
      <Link
        href={loginHref(pathname, isDaily)}
        className="font-semibold text-theme-primary hover:underline"
      >
        Sign in
      </Link>
    </p>
  );
}
