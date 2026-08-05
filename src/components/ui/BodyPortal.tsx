"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const GAME_PORTAL_ROOT_ID = "game-portal-root";

function getPortalContainer(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return (
    document.getElementById(GAME_PORTAL_ROOT_ID) ??
    document.body
  );
}

/**
 * Render above app chrome — escapes sticky headers / backdrop-filter containing blocks.
 * Sync document check avoids Strict Mode mount→null→remount flash that made popups vanish.
 */
export function BodyPortal({ children }: { children: ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(() =>
    getPortalContainer()
  );

  useEffect(() => {
    setContainer(getPortalContainer());
  }, []);

  if (!container) return null;
  return createPortal(children, container);
}
