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
    if (!open) return;

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
  }, [open]);

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
            ? "mx-auto flex w-full min-w-0 items-center justify-center bg-transparent p-0 text-accent-green transition hover:text-accent-green/85 focus:outline-none focus-visible:ring-1 focus-visible:ring-accent-green/50"
            : "header-control-btn flex h-11 min-h-[44px] w-[4.75rem] max-w-[4.75rem] shrink-0 items-center justify-center gap-0.5 overflow-hidden rounded-lg border border-pitch-600 px-1 text-accent-green transition hover:border-accent-green/50 hover:bg-accent-green/10 sm:w-auto sm:max-w-none sm:gap-1.5 sm:px-3"
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

      <AnimatePresence>
        {open && (
          <>
            {isMobileUnderLogo && (
              <motion.button
                type="button"
                aria-label="Close Club Funds panel"
                className="fixed inset-0 z-[79] bg-black/50 sm:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => {
                  playPanelClose();
                  setOpen(false);
                }}
              />
            )}
            <motion.div
              role="dialog"
              aria-label="Earn Club Funds"
              className={`z-[80] w-[min(17rem,calc(100vw-1.5rem))] max-w-[calc(100vw-env(safe-area-inset-left,0px)-env(safe-area-inset-right,0px)-1.5rem)] ${CARD.panel} border border-accent-green/25 p-3 shadow-xl ${
                isMobileUnderLogo
                  ? "fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-[calc(100%+0.35rem)] sm:-translate-x-1/2"
                  : "absolute right-0 top-[calc(100%+0.5rem)]"
              }`}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
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
                  <span className="min-w-0 truncate">{line.label}</span>
                  <span className="shrink-0 font-semibold text-accent-green">
                    {formatClubFundsExact(line.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
