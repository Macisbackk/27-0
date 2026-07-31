"use client";

import type { ReactNode, RefObject } from "react";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { MODAL } from "@/lib/ui/design-system";

interface GameModalProps {
  open: boolean;
  children: ReactNode;
  onClose?: () => void;
  labelledBy?: string;
  wide?: boolean;
  className?: string;
  /** Override default backdrop z-index (e.g. "z-[95]"). */
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
  zClass = "z-[9999]",
  panelRef,
}: GameModalProps) {
  if (!open) return null;

  return (
    <BodyPortal>
      <div
        className={`game-modal-overlay ${zClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={onClose}
      >
        <div
          ref={panelRef}
          tabIndex={panelRef ? -1 : undefined}
          className={`game-modal-panel game-modal-card contract-modal-card ${MODAL.panelPadding} my-4 w-[min(92vw,520px)] max-w-[520px] max-h-[min(82vh,720px)] overflow-y-auto overflow-x-hidden ${wide ? "w-[min(96vw,40rem)] max-w-4xl" : ""} ${className}`.trim()}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </BodyPortal>
  );
}
