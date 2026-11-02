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
  /**
   * "card" (Manager Mode): a compact dark card that sizes to its content (max ~85% of the screen,
   * body scrolls inside), with a small eyebrow over the title and the close button in the corner.
   * The default keeps the tall sheet used elsewhere on the site.
   */
  variant?: "default" | "card";
  /** Small line over the title (card variant). */
  eyebrow?: ReactNode;
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
  variant = "default",
  eyebrow,
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
  const openedAt = useRef(0);
  useEffect(() => {
    if (open && !wasOpen.current) {
      playPopupOpen();
      openedAt.current = Date.now();
    }
    wasOpen.current = open;
  }, [open]);
  // Card pop-ups are small, so the second tap of a double tap on the button that opened one lands
  // on the backdrop: ignore backdrop taps for a moment after it opens.
  const onBackdrop = useCallback(() => {
    if (variant === "card" && Date.now() - openedAt.current < 450) return;
    handleClose();
  }, [variant, handleClose]);

  if (!open) return null;

  const card = variant === "card";
  const onPitch = !card && (pitchHeader ?? (Boolean(title) && !headerExtra));
  const alignClass =
    backdropAlign === "end"
      ? "items-end sm:items-center"
      : "items-center";

  return (
    <BodyPortal>
      <div
        className={`fl-backdrop fixed inset-0 ${uiLayerClass("modalBackdrop")} flex justify-center bg-black/75 ${SPACING.modalBackdrop} ${alignClass}`}
        role="presentation"
        onClick={onBackdrop}
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          className={`${panelClass}${card ? " mobile-sheet--card" : ""} outline-none ${className}`.trim()}
          data-scroll-lock-allow="true"
          onClick={(e) => e.stopPropagation()}
        >
          {card ? (
            <div className={`${MOBILE.overlayHeader} mobile-sheet-card__header`}>
              {eyebrow ? <p className="mobile-sheet-card__eyebrow">{eyebrow}</p> : null}
              {title ? (
                <h2 id={titleId} className="mobile-sheet-card__title">
                  {title}
                </h2>
              ) : null}
              {headerExtra}
              <button type="button" className="mobile-sheet-card__close" onClick={handleClose} aria-label="Close">
                ×
              </button>
            </div>
          ) : (
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
          )}
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
  variant,
  eyebrow,
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
      variant={variant}
      eyebrow={eyebrow}
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
  variant,
  eyebrow,
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
      variant={variant}
      eyebrow={eyebrow}
      panelClass={MOBILE.modalPanel}
      backdropAlign="center"
    >
      {children}
    </MobileOverlayShell>
  );
}
