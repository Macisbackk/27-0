"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Lazily mounts a Manager section on first visit, then keeps it in the DOM.
 * While inactive, reuses the last rendered tree so parent re-renders do not
 * recompute expensive Hub/Squad/etc. work (main cause of tab flicker).
 */
export function ManagerKeepAlivePane({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}) {
  const [seen, setSeen] = useState(active);
  const frozenRef = useRef<ReactNode>(null);

  if (active) {
    frozenRef.current = children;
  }

  useLayoutEffect(() => {
    if (active) setSeen(true);
  }, [active]);

  if (!seen) return null;

  return (
    <div
      className={active ? undefined : "hidden"}
      aria-hidden={!active}
      {...(!active ? ({ inert: "" } as Record<string, string>) : {})}
    >
      {active ? children : frozenRef.current}
    </div>
  );
}
