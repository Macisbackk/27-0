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

function loginHref(pathname: string, dailyChallenge: boolean, weekly = false): string {
  const redirect = encodeURIComponent(
    weekly
      ? "/leaderboard?tracker=weekly"
      : dailyChallenge
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
  const isWeekly = SHOW_DAILY_CHALLENGE_UI && searchParams.get("weekly") === "1";

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

  if (variant === "play" && isWeekly) {
    // One clear rule for guests: the run counts now, posting needs an account before the week ends.
    return (
      <div className={`mb-3 text-center ${SPACING.stackSm}`}>
        <p className={TYPO.meta}>
          Your first finished run this week counts. Log in any time before Sunday midnight to post it on the board.
        </p>
        <Link
          href={loginHref(pathname, false, true)}
          onClick={() => playUiClick()}
          className="inline-block text-sm font-semibold text-theme-primary hover:underline"
        >
          Log in to post your Weekly score →
        </Link>
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
            ? "Log in to sync your Daily streak and bank a £100k welcome bonus →"
            : "Log in to put your run on the leaderboard and bank a £100k welcome bonus →"}
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
        Log in
      </Link>{" "}
      for a £100k welcome bonus.
    </p>
  );
}
