"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { useModalA11y } from "@/hooks/useModalA11y";
import { BTN, MOBILE, SPACING, uiLayerClass } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { playPanelClose, playPopupOpen } from "@/lib/sound";

interface MobileOverlayBaseProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Optional header content below the title row (e.g. meta line). */
  headerExtra?: ReactNode;
  /**
   * Title strip on the pitch surface (src/styles/pitch.css). On by default for plain titled sheets;
   * sheets with a busy header (the player card) keep the dark header unless they opt in.
   */
  pitchHeader?: boolean;
}

function MobileOverlayShell({
  open,
  onClose,
  title,
  children,
  footer,
  headerExtra,
  pitchHeader,
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

  // Sheet-open cue (the close cue plays from handleClose, so only the open edge is tracked here).
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) playPopupOpen();
    wasOpen.current = open;
  }, [open]);

  if (!open) return null;

  const onPitch = pitchHeader ?? (Boolean(title) && !headerExtra);
  const alignClass =
    backdropAlign === "end"
      ? "items-end sm:items-center"
      : "items-center";

  return (
    <BodyPortal>
      <div
        className={`fl-backdrop fixed inset-0 ${uiLayerClass("modalBackdrop")} flex justify-center bg-black/75 ${SPACING.modalBackdrop} ${alignClass}`}
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
          <div className={`${MOBILE.overlayHeader}${onPitch ? " pitch-surface pitch-sheet-header" : ""}`}>
            <div className={`flex justify-between gap-2 ${onPitch ? "items-center" : "items-start"}`}>
              {title ? (
                <h2
                  id={titleId}
                  className={onPitch ? "pitch-title min-w-0 flex-1 !text-[20px] !leading-tight sm:!text-[24px]" : `player-detail-modal__title min-w-0 flex-1 ${TYPO.cardTitle}`}
                >
                  {title}
                </h2>
              ) : (
                <span className="flex-1" />
              )}
              <button
                type="button"
                className={onPitch ? "pitch-chip !w-11 !px-0 text-[20px]" : `${BTN.close} shrink-0`}
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
  pitchHeader,
  className = "",
}: MobileOverlayBaseProps) {
  return (
    <MobileOverlayShell
      open={open}
      onClose={onClose}
      title={title}
      footer={footer}
      headerExtra={headerExtra}
      pitchHeader={pitchHeader}
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
  pitchHeader,
  className = "",
}: MobileOverlayBaseProps) {
  return (
    <MobileOverlayShell
      open={open}
      onClose={onClose}
      title={title}
      footer={footer}
      headerExtra={headerExtra}
      pitchHeader={pitchHeader}
      className={className}
      panelClass={MOBILE.modalPanel}
      backdropAlign="center"
    >
      {children}
    </MobileOverlayShell>
  );
}
