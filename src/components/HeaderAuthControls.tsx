"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { BTN } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export function HeaderAuthControls() {
  const { loading, isLoggedIn } = useAuth();

  if (loading) {
    return (
      <span className={TYPO.bodySm} aria-hidden>
        …
      </span>
    );
  }

  const authButtonClass = `${BTN.header} min-w-[6.75rem] justify-center sm:min-w-[8.25rem]`;

  if (!isLoggedIn) {
    return (
      <Link href="/login" className={authButtonClass}>
        Log In
      </Link>
    );
  }

  return (
    <Link href="/profile" className={authButtonClass}>
      <span className="truncate">Coach Profile</span>
    </Link>
  );
}
