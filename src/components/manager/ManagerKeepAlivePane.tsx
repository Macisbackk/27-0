"use client";

import {
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { recordShellMount } from "@/lib/ui/mount-diagnostics";

/**
 * Keeps a Manager section mounted after first activation.
 *
 * Important: never return `null` on first activation after paint — that blank
 * frame between hiding the previous tab and mounting the next is the main
 * Hub↔Squad flicker. Promote `seen` synchronously during render when active.
 *
 * Inactive panes use `hidden` (display: none), not `invisible absolute`.
 * Toggling relative ↔ absolute inset-0 on every tab change reflows the
 * document under sticky chrome and causes Windows Chrome compositing flicker.
 *
 * While inactive, freeze the last children tree so parent re-renders do not
 * recompute expensive Hub/Squad work.
 */
export function ManagerKeepAlivePane({
  active,
  label,
  children,
}: {
  active: boolean;
  /** Optional mount-diag label (e.g. "manager-tab-squad"). */
  label?: string;
  children: ReactNode;
}) {
  const seenRef = useRef(active);
  const frozenRef = useRef<ReactNode>(null);

  if (active) {
    seenRef.current = true;
    frozenRef.current = children;
  }

  const seen = seenRef.current;

  useEffect(() => {
    if (active && label) recordShellMount(label);
  }, [active, label]);

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
