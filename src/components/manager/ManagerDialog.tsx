"use client";

import { useCallback } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { useModalA11y } from "@/hooks/useModalA11y";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { playPanelClose, playUiClick } from "@/lib/sound";

export interface ManagerDialogProps {
  open: boolean;
  title: string;
  message: string;
  variant?: "alert" | "confirm";
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ManagerDialog({
  open,
  title,
  message,
  variant = "alert",
  confirmLabel = "OK",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ManagerDialogProps) {
  const handleCancel = useCallback(() => {
    playPanelClose();
    onCancel();
  }, [onCancel]);

  const panelRef = useModalA11y(open, handleCancel);

  if (!open) return null;

  const handleConfirm = () => {
    playUiClick();
    onConfirm();
  };

  return (
    <BodyPortal>
      <div
        className={`fixed inset-0 z-[95] flex items-end justify-center bg-black/75 ${SPACING.modalBackdrop} ${SPACING.safeBottom} backdrop-blur-sm sm:items-center`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manager-dialog-title"
        onClick={handleCancel}
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          className={`card-glass w-full max-w-md outline-none ${SPACING.cardPadding}`}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="manager-dialog-title" className={TYPO.cardTitle}>
            {title}
          </h2>
          <p className={`mt-2 ${TYPO.bodySm} text-pitch-300 whitespace-pre-line`}>
            {message}
          </p>
          <div
            className={`mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end ${
              variant === "confirm" ? "" : ""
            }`}
          >
            {variant === "confirm" && (
              <GameButton variant="secondary" onClick={handleCancel}>
                {cancelLabel}
              </GameButton>
            )}
            <GameButton
              variant={destructive ? "danger" : "theme"}
              onClick={handleConfirm}
            >
              {confirmLabel}
            </GameButton>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
