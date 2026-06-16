"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CLUB_FUNDS_INFO_LINES,
  formatClubFunds,
} from "@/lib/club-funds";
import {
  CLUB_FUNDS_CHANGED_EVENT,
  getClubFundsBalance,
} from "@/lib/storage/club-funds";
import { playPanelClose, playPanelExpand, playUiClick } from "@/lib/sound";
import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export function ClubFundsDisplay() {
  const [balance, setBalance] = useState(0);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    setBalance(getClubFundsBalance());

    const sync = () => setBalance(getClubFundsBalance());
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

  if (!mounted) {
    return (
      <div
        className="flex h-11 min-h-[44px] min-w-[4.5rem] items-center justify-center sm:min-w-[5.25rem]"
        aria-hidden
      />
    );
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          playUiClick();
          if (open) playPanelClose();
          else playPanelExpand();
          setOpen((value) => !value);
        }}
        className="header-control-btn flex h-11 min-h-[44px] items-center justify-center rounded-lg border border-pitch-600 px-2 text-xs font-bold tabular-nums text-accent-green transition hover:border-accent-green/50 hover:bg-accent-green/10 sm:px-3 sm:text-sm"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Club Funds"
      >
        {formatClubFunds(balance)}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Earn Club Funds"
            className={`absolute right-0 top-[calc(100%+0.5rem)] z-[80] w-[min(17rem,calc(100vw-1.5rem))] ${CARD.panel} border border-accent-green/25 p-3 shadow-xl`}
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.18 }}
          >
            <p className={TYPO.sectionLabel}>Earn Club Funds</p>
            <ul className={`mt-2 space-y-1.5 ${TYPO.bodySm}`}>
              {CLUB_FUNDS_INFO_LINES.map((line) => (
                <li
                  key={line.label}
                  className="flex items-center justify-between gap-2 text-gray-300"
                >
                  <span className="min-w-0 truncate">{line.label}</span>
                  <span className="shrink-0 font-semibold text-accent-green">
                    {formatClubFunds(line.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
