"use client";

import { useCallback, useId, type ReactNode } from "react";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { useModalA11y } from "@/hooks/useModalA11y";
import { BTN, MOBILE, SPACING, uiLayerClass } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { playPanelClose } from "@/lib/sound";

interface MobileOverlayBaseProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Optional header content below the title row (e.g. meta line). */
  headerExtra?: ReactNode;
}

function MobileOverlayShell({
  open,
  onClose,
  title,
  children,
  footer,
  headerExtra,
  className = "",
  panelClass,
  backdropAlign,
}: MobileOverlayBaseProps & {
  panelClass: string;
  backdropAlign: "end" | "center";
}) {
  const titleId = useId();
  const handleClose = useCallback(() => {
    playPanelClose();
    onClose();
  }, [onClose]);
  const panelRef = useModalA11y(open, handleClose);

  if (!open) return null;

  const alignClass =
    backdropAlign === "end"
      ? "items-end sm:items-center"
      : "items-center";

  return (
    <BodyPortal>
      <div
        className={`fixed inset-0 ${uiLayerClass("modalBackdrop")} flex justify-center bg-black/75 ${SPACING.modalBackdrop} ${alignClass}`}
        role="presentation"
        onClick={handleClose}
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          className={`${panelClass} outline-none ${className}`.trim()}
          data-scroll-lock-allow="true"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={MOBILE.overlayHeader}>
            <div className="flex items-start justify-between gap-2">
              {title ? (
                <h2
                  id={titleId}
                  className={`player-detail-modal__title min-w-0 flex-1 ${TYPO.cardTitle}`}
                >
                  {title}
                </h2>
              ) : (
                <span className="flex-1" />
              )}
              <button
                type="button"
                className={`${BTN.close} shrink-0`}
                onClick={handleClose}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            {headerExtra}
          </div>
          <div className={MOBILE.overlayBody}>{children}</div>
          {footer ? (
            <div className={MOBILE.overlayFooter}>{footer}</div>
          ) : null}
        </div>
      </div>
    </BodyPortal>
  );
}

/** Bottom sheet — docks to the bottom on phones, centres on larger screens. */
export function MobileBottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  headerExtra,
  className = "",
}: MobileOverlayBaseProps) {
  return (
    <MobileOverlayShell
      open={open}
      onClose={onClose}
      title={title}
      footer={footer}
      headerExtra={headerExtra}
      className={className}
      panelClass={MOBILE.bottomSheet}
      backdropAlign="end"
    >
      {children}
    </MobileOverlayShell>
  );
}

/** Centred modal sheet using the mobile modal panel surface. */
export function MobileModal({
  open,
  onClose,
  title,
  children,
  footer,
  headerExtra,
  className = "",
}: MobileOverlayBaseProps) {
  return (
    <MobileOverlayShell
      open={open}
      onClose={onClose}
      title={title}
      footer={footer}
      headerExtra={headerExtra}
      className={className}
      panelClass={MOBILE.modalPanel}
      backdropAlign="center"
    >
      {children}
    </MobileOverlayShell>
  );
}
