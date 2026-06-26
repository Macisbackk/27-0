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

  useEffect(() => {
    if (!open || isMobileUnderLogo) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        playPanelClose();
        setOpen(false);
      }
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        playPanelClose();
        setOpen(false);
      }
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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, isMobileUnderLogo]);

  const visibilityClass = isMobileUnderLogo
    ? "sm:hidden"
    : "hidden sm:block";

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
        className={
          isMobileUnderLogo
            ? "mx-auto flex w-full min-w-0 items-center justify-center bg-transparent p-0 text-theme-primary transition hover:text-theme-primary/85 focus:outline-none focus-visible:ring-1 focus-visible:ring-theme-primary/50"
            : "header-control-btn flex h-11 min-h-[44px] w-[4.75rem] max-w-[4.75rem] shrink-0 items-center justify-center gap-0.5 overflow-hidden rounded-lg border border-pitch-600 px-1 text-theme-primary transition hover:border-theme-primary/50 hover:bg-theme-primary/10 sm:w-auto sm:max-w-none sm:gap-1.5 sm:px-3"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Club Funds: ${formatted}. Tap for earnings info.`}
        title={`Club Funds: ${formatted}`}
      >
        {!isMobileUnderLogo && (
          <span aria-hidden className="shrink-0 text-[11px] leading-none sm:text-xs">
            💷
          </span>
        )}
        <span
          className={`min-w-0 max-w-full truncate font-bold tabular-nums leading-none ${
            isMobileUnderLogo
              ? "text-[11px] tracking-tight"
              : "text-[10px] sm:text-sm"
          }`}
        >
          {formatted}
        </span>
      </button>

      {open && isMobileUnderLogo && (
        <BodyPortal>
          <AnimatePresence>
            <motion.div
              key="club-funds-mobile"
              className="fixed inset-0 z-[120]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <button
                type="button"
                aria-label="Close Club Funds panel"
                className="absolute inset-0 bg-black/50"
                onClick={() => {
                  playPanelClose();
                  setOpen(false);
                }}
              />
              <motion.div
                role="dialog"
                aria-label="Earn Club Funds"
                className={`absolute left-1/2 top-1/2 w-[min(18rem,calc(100vw-1.5rem))] max-h-[min(70dvh,24rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain ${CARD.panel} border border-theme-tertiary/35 p-3 shadow-xl`}
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                onClick={(event) => event.stopPropagation()}
              >
                <ClubFundsPanelContent
                  balance={balance}
                  totalEarned={totalEarned}
                />
              </motion.div>
            </motion.div>
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
}: {
  balance: number;
  totalEarned: number;
}) {
  return (
    <>
      <p className={TYPO.sectionLabel}>Earn Club Funds</p>
      <div className={`mt-2 space-y-1 ${TYPO.bodySm}`}>
        <p className="flex items-center justify-between gap-2 text-gray-300">
          <span>Current balance</span>
          <span className="shrink-0 font-semibold tabular-nums text-accent-green">
            {formatClubFundsExact(balance)}
          </span>
        </p>
        <p className="flex items-center justify-between gap-2 text-gray-400">
          <span>Lifetime earned</span>
          <span className="shrink-0 font-medium tabular-nums text-gray-300">
            {formatClubFundsExact(totalEarned)}
          </span>
        </p>
      </div>
      <ul className={`mt-3 space-y-1.5 border-t border-pitch-700/50 pt-3 ${TYPO.bodySm}`}>
        {CLUB_FUNDS_INFO_LINES.map((line) => (
          <li
            key={line.label}
            className="flex items-center justify-between gap-2 text-gray-300"
          >
            <span className="min-w-0">{line.label}</span>
            <span className="shrink-0 font-semibold text-accent-green">
              {formatClubFundsExact(line.amount)}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
