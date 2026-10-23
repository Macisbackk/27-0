"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { uiLayerClass } from "@/lib/ui/layers";
import { playPopupClose, playPopupOpen } from "@/lib/sound";
import { useModalA11y } from "@/hooks/useModalA11y";

interface GameModalProps {
  open: boolean;
  children: ReactNode;
  onClose?: () => void;
  labelledBy?: string;
  wide?: boolean;
  className?: string;
  /** Override default backdrop layer class. */
  zClass?: string;
  /** Optional ref for focus trap / a11y (useModalA11y). */
  panelRef?: RefObject<HTMLDivElement | null>;
}

/** Shared stadium-board modal chrome — portaled above footer/nav. */
export function GameModal({
  open,
  children,
  onClose,
  labelledBy,
  wide = false,
  className = "",
  zClass = uiLayerClass("modalBackdrop"),
  panelRef,
}: GameModalProps) {
  const wasOpen = useRef(false);
  // Escape closes, focus moves in (and back out), Tab stays inside, page behind doesn't scroll.
  // Callers that run their own useModalA11y pass panelRef and keep that one instead.
  const ownRef = useModalA11y(open && !panelRef, () => onClose?.());

  useEffect(() => {
    if (open && !wasOpen.current) {
      playPopupOpen();
    } else if (!open && wasOpen.current) {
      playPopupClose();
    }
    wasOpen.current = open;
  }, [open]);

  if (!open) return null;

  return (
    <BodyPortal>
      <div
        className={`game-modal-overlay fl-backdrop ${zClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={onClose}
      >
        <div
          ref={panelRef ?? ownRef}
          tabIndex={-1}
          data-scroll-lock-allow="true"
          className={`game-modal-panel game-modal-card contract-modal-card fl-pop outline-none p-3 sm:p-6 my-4 w-[min(92vw,520px)] max-w-[520px] max-h-[min(78dvh,720px)] overflow-y-auto overflow-x-hidden ${wide ? "w-[min(96vw,40rem)] max-w-4xl" : ""} ${className}`.trim()}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </BodyPortal>
  );
}
