"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CLUB_FUNDS_INFO_LINES,
  formatClubFunds,
  formatClubFundsExact,
} from "@/lib/club-funds";
import {
  CLUB_FUNDS_CHANGED_EVENT,
  getClubFundsBalance,
  getClubFundsTotalEarned,
  syncClubFundsLeaderboardOnLoad,
} from "@/lib/storage/club-funds";
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
  const [balance, setBalance] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const isMobileUnderLogo = placement === "mobile-under-logo";

  useEffect(() => {
    setMounted(true);
    setBalance(getClubFundsBalance());
    setTotalEarned(getClubFundsTotalEarned());
    syncClubFundsLeaderboardOnLoad();

    const sync = () => {
      setBalance(getClubFundsBalance());
      setTotalEarned(getClubFundsTotalEarned());
    };
    window.addEventListener(CLUB_FUNDS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(CLUB_FUNDS_CHANGED_EVENT, sync);
  }, []);

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

  const visibilityClass = "block";

  if (!mounted) {
    return (
      <div
        className={`${visibilityClass} ${
          isMobileUnderLogo
            ? "mt-0.5 h-3.5 w-full"
            : "flex h-11 min-h-[44px] min-w-[4.5rem] items-center justify-center sm:min-w-[5.25rem]"
        }`}
        aria-hidden
      />
    );
  }

  const formatted = formatClubFunds(balance);

  return (
    <div
      ref={rootRef}
      className={`relative shrink-0 ${visibilityClass} ${
        isMobileUnderLogo ? "mt-0.5 w-full max-w-[5.5rem]" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => {
          playUiClick();
          if (open) playPanelClose();
          else playPanelExpand();
          setOpen((value) => !value);
        }}
        className="header-control-btn flex h-11 min-h-[44px] w-[4.25rem] max-w-[4.25rem] shrink-0 items-center justify-center gap-0.5 overflow-hidden rounded-lg border border-pitch-600 px-1 text-theme-primary transition hover:border-theme-primary/50 hover:bg-theme-primary/10 sm:w-auto sm:max-w-none sm:gap-1.5 sm:px-3"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Club Funds: ${formatted}. Tap for earnings info.`}
        title={`Club Funds: ${formatted}`}
      >
        {!isMobileUnderLogo && (
          <span aria-hidden className="shrink-0 text-xs leading-none">
            💷
          </span>
        )}
        <span className="min-w-0 max-w-full truncate text-[10px] font-bold tabular-nums leading-none sm:text-sm">
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
