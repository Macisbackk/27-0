import { useEffect } from "react";
import {
  acquireScrollLock,
  releaseScrollLock,
  type ScrollLockId,
} from "@/lib/ui/scroll-lock";

/**
 * Reference-counted document scroll lock for overlays and animations.
 * Releases automatically on unmount or when `active` becomes false.
 */
export function useScrollLock(active: boolean, owner: string): void {
  useEffect(() => {
    if (!active) return;

    const id: ScrollLockId = acquireScrollLock(owner);
    return () => {
      releaseScrollLock(id);
    };
  }, [active, owner]);
}
