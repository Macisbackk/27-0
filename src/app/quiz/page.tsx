"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TYPO } from "@/lib/ui/typography";

/** Bookmark / Capacitor-safe client redirect — Quiz now lives under Mini Games. */
export default function QuizRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/mini-games/quiz");
  }, [router]);

  return (
    <p className={`p-8 text-center ${TYPO.meta}`}>Opening Quiz…</p>
  );
}
