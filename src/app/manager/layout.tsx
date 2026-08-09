"use client";

import type { ReactNode } from "react";
import ManagerSectionClient from "./[[...section]]/ManagerSectionClient";

/**
 * Persistent Manager shell.
 *
 * Next.js remounts `[[...section]]/page` whenever the catch-all params change
 * (`/manager/hub` → `/manager/squad`). KeepAlive and career state must live
 * *above* that dynamic segment or every tab tap throws away the tree (main
 * Manager flicker root cause).
 */
export default function ManagerLayout({
  children: _children,
}: {
  children: ReactNode;
}) {
  return <ManagerSectionClient />;
}
