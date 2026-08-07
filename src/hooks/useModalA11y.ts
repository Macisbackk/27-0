import { useEffect, useRef, type RefObject } from "react";
import { focusWithoutScroll } from "@/lib/ui/focus";
import {
  acquireScrollLock,
  releaseScrollLock,
  type ScrollLockId,
} from "@/lib/ui/scroll-lock";

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/** Focus trap, scroll lock, and Escape for modal overlays. */
export function useModalA11y(
  open: boolean,
  onClose: () => void
): RefObject<HTMLDivElement | null> {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const scrollLockIdRef = useRef<ScrollLockId | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;
    scrollLockIdRef.current = acquireScrollLock("modal");

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        FOCUSABLE_SELECTOR
      );
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        focusWithoutScroll(last);
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        focusWithoutScroll(first);
      }
    };

    window.addEventListener("keydown", onKey);

    requestAnimationFrame(() => {
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        FOCUSABLE_SELECTOR
      );
      if (focusable && focusable.length > 0) {
        focusWithoutScroll(focusable[0]);
      } else {
        focusWithoutScroll(panelRef.current);
      }
    });

    return () => {
      const previous = previousFocusRef.current;
      window.removeEventListener("keydown", onKey);
      // Restore focus before unlock so preventScroll wins over browser scroll-into-view.
      focusWithoutScroll(previous);
      releaseScrollLock(scrollLockIdRef.current);
      scrollLockIdRef.current = null;
    };
  }, [open, onClose]);

  return panelRef;
}
