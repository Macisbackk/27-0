"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ensurePlayersLoaded } from "@/lib/players";

/**
 * Ensures chunked player JSON is loaded before rendering children on the client.
 * Server renders children immediately with the sync bootstrap registry.
 */
export function PlayerRegistryGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(() => typeof window === "undefined");

  useEffect(() => {
    void ensurePlayersLoaded().then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div
        className="flex min-h-[12rem] items-center justify-center px-6"
        aria-busy="true"
        aria-label="Loading player database"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-pitch-600 border-t-emerald-400 motion-reduce:animate-none" />
      </div>
    );
  }

  return <>{children}</>;
}
