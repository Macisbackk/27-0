"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CLUB_FUNDS_INFO_LINES,
  formatClubFunds,
  formatClubFundsExact,
} from "@/lib/club-funds";
import { useClubFunds } from "@/hooks/useClubFunds";
import { playPanelClose, playPanelExpand, playUiClick } from "@/lib/sound";
import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { BodyPortal } from "./ui/BodyPortal";

interface ClubFundsDisplayProps {
  /** desktop = beside auth on sm+; mobile-under-logo = centred plain text under logo */
  placement?: "desktop" | "mobile-under-logo";
}

export function ClubFundsDisplay({
  placement = "desktop",
}: ClubFundsDisplayProps) {
  const { balance, totalEarned, ready } = useClubFunds();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isMobileUnderLogo = placement === "mobile-under-logo";

  const closePanel = () => {
    playPanelClose();
    setOpen(false);
  };

  useEffect(() => {
    if (!open || isMobileUnderLogo) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        closePanel();
      }
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, isMobileUnderLogo]);

  useEffect(() => {
    if (!open || !isMobileUnderLogo) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, isMobileUnderLogo]);

  const formatted = ready ? formatClubFunds(balance) : "—";

  const triggerClass = isMobileUnderLogo
    ? "flex min-h-[1.125rem] items-center justify-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums leading-none text-accent-green transition hover:bg-pitch-800/35 hover:text-theme-primary active:bg-pitch-800/50"
    : "header-control-btn flex h-11 min-h-[44px] items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-pitch-600/80 bg-pitch-900/25 px-2.5 font-semibold tabular-nums text-accent-green transition hover:border-theme-primary/45 hover:bg-theme-primary/5 sm:px-3";

  return (
    <div
      ref={rootRef}
      className={`relative shrink-0 ${isMobileUnderLogo ? "flex justify-center" : ""}`}
    >
      <button
        type="button"
        onClick={() => {
          playUiClick();
          if (open) playPanelClose();
          else playPanelExpand();
          setOpen((value) => !value);
        }}
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={
          ready
            ? `Club Funds: ${formatted}. Tap for earnings info.`
            : "Club Funds loading"
        }
        title={ready ? `Club Funds: ${formatted}` : undefined}
        disabled={!ready}
      >
        {!isMobileUnderLogo && (
          <span
            aria-hidden
            className="shrink-0 text-[11px] leading-none sm:text-xs"
          >
            💷
          </span>
        )}
        <span className={isMobileUnderLogo ? "text-[11px]" : "text-sm leading-none"}>
          {formatted}
        </span>
      </button>

      {isMobileUnderLogo && (
        <BodyPortal>
          <AnimatePresence>
            {open && (
              <motion.div
                key="club-funds-mobile"
                className="fixed inset-0 z-[200] flex items-end justify-center bg-black/65 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(3.5rem,env(safe-area-inset-top))]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closePanel}
              >
                <motion.div
                  role="dialog"
                  aria-modal="true"
                  aria-label="Earn Club Funds"
                  className="club-funds-mobile-sheet w-full max-w-md max-h-[min(85dvh,28rem)] overflow-y-auto overscroll-contain rounded-2xl border border-theme-tertiary/35 p-4 shadow-2xl"
                  initial={{ opacity: 0, y: 28, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <ClubFundsPanelContent
                    balance={balance}
                    totalEarned={totalEarned}
                    onClose={closePanel}
                    mobile
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </BodyPortal>
      )}

      <AnimatePresence>
        {open && !isMobileUnderLogo && (
          <motion.div
            key="club-funds-desktop"
            role="dialog"
            aria-label="Earn Club Funds"
            className={`absolute right-0 top-[calc(100%+0.5rem)] z-[80] w-[min(18rem,calc(100vw-2rem))] max-h-[min(70vh,24rem)] overflow-y-auto ${CARD.panel} border border-theme-tertiary/35 p-3 shadow-xl`}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <ClubFundsPanelContent
              balance={balance}
              totalEarned={totalEarned}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ClubFundsPanelContent({
  balance,
  totalEarned,
  onClose,
  mobile = false,
}: {
  balance: number;
  totalEarned: number;
  onClose?: () => void;
  mobile?: boolean;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className={TYPO.sectionLabel}>Earn Club Funds</p>
        {mobile && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-pitch-600/80 px-2.5 py-1 text-xs font-medium text-gray-300 transition hover:border-pitch-500 hover:text-white"
          >
            Close
          </button>
        )}
      </div>
      <div className={`mt-2 space-y-1 ${mobile ? "text-xs" : TYPO.bodySm}`}>
        <p className="flex items-start justify-between gap-3 text-gray-300">
          <span className="shrink-0">Current balance</span>
          <span className="min-w-0 text-right font-semibold tabular-nums text-accent-green">
            {formatClubFundsExact(balance)}
          </span>
        </p>
        <p className="flex items-start justify-between gap-3 text-gray-400">
          <span className="shrink-0">Lifetime earned</span>
          <span className="min-w-0 text-right font-medium tabular-nums text-gray-300">
            {formatClubFundsExact(totalEarned)}
          </span>
        </p>
      </div>
      <ul className={`mt-3 space-y-1.5 border-t border-pitch-700/50 pt-3 ${TYPO.bodySm}`}>
        {CLUB_FUNDS_INFO_LINES.map((line) => (
          <li
            key={line.label}
            className={`flex items-start justify-between gap-3 text-gray-300 ${
              mobile ? "text-xs leading-snug" : ""
            }`}
          >
            <span className="min-w-0 flex-1">{line.label}</span>
            <span className="shrink-0 font-semibold tabular-nums text-accent-green">
              {formatClubFundsExact(line.amount)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
