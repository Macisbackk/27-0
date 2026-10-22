"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TYPO } from "@/lib/ui/typography";

/** Career Stats now lives in Coach Profile (Stats tab). Client redirect so the static app build works too. */
export default function StatsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/profile");
  }, [router]);
  return <p className={`p-8 text-center ${TYPO.meta}`}>Opening Coach Profile…</p>;
}
