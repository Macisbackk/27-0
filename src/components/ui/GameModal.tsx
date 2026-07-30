"use client";

import type { ReactNode, RefObject } from "react";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { MODAL, SPACING } from "@/lib/ui/design-system";

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

const BACKDROP_BASE = `fixed inset-0 grid place-items-center overflow-y-auto bg-black/75 ${SPACING.modalBackdrop}`;

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
        className={`${BACKDROP_BASE} ${zClass} ${SPACING.safeBottom}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={onClose}
      >
        <div
          ref={panelRef}
          tabIndex={panelRef ? -1 : undefined}
          className={`${wide ? MODAL.panelWide : MODAL.panel} ${MODAL.panelPadding} my-4 max-h-[min(82vh,720px)] overflow-y-auto ${wide ? "w-[min(96vw,40rem)]" : "w-[min(92vw,520px)]"} ${className}`.trim()}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </BodyPortal>
  );
}
