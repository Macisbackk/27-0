"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { TYPO } from "@/lib/ui/typography";

const AUTH_SLOT_CLASS = "flex h-11 items-center justify-center";

const AUTH_BUTTON_CLASS =
  "flex h-11 items-center justify-center whitespace-nowrap rounded-control bg-pitch-900 px-3.5 font-cond text-[15px] font-bold text-white shadow-[inset_0_0_0_1px_var(--fl-line-strong)] transition hover:bg-pitch-800";

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
          Log in
        </Link>
      </div>
    );
  }

  // Signed in: Profile lives in the bottom bar on phones, so only show it from tablet up.
  return (
    <div className={`${AUTH_SLOT_CLASS} hidden sm:flex`}>
      <Link href="/profile" className={AUTH_BUTTON_CLASS}>
        Coach Profile
      </Link>
    </div>
  );
}
