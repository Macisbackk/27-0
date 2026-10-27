"use client";

import { useEffect } from "react";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { GameButton } from "@/components/ui/GameButton";

/** Route-level error boundary — keeps the header/nav alive instead of a blank screen. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] Unhandled route error:", error);
  }, [error]);

  return (
    <StandardPageShell>
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <h1 className="text-3xl font-black text-white">Something went wrong</h1>
        <p className="text-pitch-300">
          Your saves are safe. Try again or go home.
===
        </p>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
          <GameButton onClick={reset} fullWidth={false}>
            Try again
          </GameButton>
          <GameButton href="/" fullWidth={false}>
            Home
          </GameButton>
        </div>
      </div>
    </StandardPageShell>
  );
}
