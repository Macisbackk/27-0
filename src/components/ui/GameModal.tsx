"use client";

import type { ReactNode } from "react";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { MODAL, SPACING } from "@/lib/ui/design-system";

interface GameModalProps {
  open: boolean;
  children: ReactNode;
  onClose?: () => void;
  labelledBy?: string;
  wide?: boolean;
  className?: string;
}

/** Shared stadium-board modal chrome. */
export function GameModal({
  open,
  children,
  onClose,
  labelledBy,
  wide = false,
  className = "",
}: GameModalProps) {
  if (!open) return null;

  return (
    <BodyPortal>
      <div
        className={`${MODAL.backdrop} ${SPACING.safeBottom}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={onClose}
      >
        <div
          className={`${wide ? MODAL.panelWide : MODAL.panel} ${MODAL.panelPadding} ${className}`.trim()}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </BodyPortal>
  );
}
