"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { BTN } from "@/lib/ui/design-system";

export function HomeAuthBar() {
  const { loading, isLoggedIn } = useAuth();

  if (loading || isLoggedIn) {
    return null;
  }

  return (
    <section className="mx-auto max-w-md text-center">
      <Link href="/login" className={`${BTN.base} ${BTN.accentOutline} inline-flex`}>
        Log in / Create account
      </Link>
    </section>
  );
}
