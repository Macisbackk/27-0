"use client";

import { useCallback } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { GameModal } from "@/components/ui/GameModal";
import { useModalA11y } from "@/hooks/useModalA11y";
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

  const handleConfirm = () => {
    playUiClick();
    onConfirm();
  };

  return (
    <GameModal
      open={open}
      onClose={handleCancel}
      labelledBy="manager-dialog-title"
      zClass="z-[95]"
      panelRef={panelRef}
      className="max-w-md outline-none sm:max-w-md"
    >
      <h2 id="manager-dialog-title" className={TYPO.cardTitle}>
        {title}
      </h2>
      <p className={`mt-2 ${TYPO.bodySm} text-pitch-300 whitespace-pre-line`}>
        {message}
      </p>
      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
    </GameModal>
  );
}
