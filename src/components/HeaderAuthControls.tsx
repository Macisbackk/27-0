"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { BTN } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

const AUTH_SLOT_CLASS =
  "flex h-11 min-h-[44px] w-[7.25rem] items-center justify-center sm:w-[8.25rem]";

const AUTH_BUTTON_CLASS = `${BTN.header} h-11 min-h-[44px] w-full justify-center px-2 sm:px-4`;

export function HeaderAuthControls() {
  const { loading, isLoggedIn } = useAuth();

  if (loading) {
    return (
      <div className={AUTH_SLOT_CLASS} aria-busy="true" aria-label="Loading account">
        <span className={TYPO.bodySm} aria-hidden>
          …
        </span>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className={AUTH_SLOT_CLASS}>
        <Link href="/login" className={AUTH_BUTTON_CLASS}>
          Log In
        </Link>
      </div>
    );
  }

  return (
    <div className={AUTH_SLOT_CLASS}>
      <Link href="/profile" className={AUTH_BUTTON_CLASS}>
        <span className="truncate sm:hidden">Profile</span>
        <span className="hidden truncate sm:inline">Coach Profile</span>
      </Link>
    </div>
  );
}
