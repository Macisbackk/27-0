"use client";

import type { ReactNode } from "react";

/** @deprecated Players bootstrap synchronously — gate is a no-op passthrough. */
export function PlayerRegistryGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
