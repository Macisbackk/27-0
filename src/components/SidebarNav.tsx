"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { buildPlayHref, isPlayModeActive } from "@/lib/play-links";
import {
  getHardModeEnabled,
  HARD_MODE_CHANGED_EVENT,
  setHardModeEnabled,
} from "@/lib/storage/preferences";
import { isSoundMuted, playHardModeOff, playHardModeOn, playMenuClose, toggleSoundMuted } from "@/lib/sound";
import { BTN, HARD, NAV, tabGroupButtonClass, tabGroupClass } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface SidebarNavProps {
  open: boolean;
  onClose: () => void;
}

const MAIN_NAV_ITEMS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/stats", label: "Statistics", icon: "📊" },
  { href: "/showcase", label: "Player Showcase", icon: "⭐" },
  { href: "/leaderboard", label: "Leaderboard", icon: "🏆" },
] as const;

const PLAY_MODE_ITEMS = [
  { mode: "classic" as const, label: "Normal Mode", icon: "🏉" },
  { mode: "draft" as const, label: "Draft Mode", icon: "📋" },
  { mode: "cup" as const, label: "Challenge Cup", icon: "🏆" },
] as const;

export function SidebarNav({ open, onClose }: SidebarNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [hardMode, setHardMode] = useState(false);
  const [muted, setMuted] = useState(false);

  const syncHardMode = useCallback(() => {
    setHardMode(getHardModeEnabled());
  }, []);

  useEffect(() => {
    if (!open) return;
    syncHardMode();
    setMuted(isSoundMuted());
  }, [open, syncHardMode]);

  useEffect(() => {
    const onHardModeChanged = () => syncHardMode();
    window.addEventListener(HARD_MODE_CHANGED_EVENT, onHardModeChanged);
    return () =>
      window.removeEventListener(HARD_MODE_CHANGED_EVENT, onHardModeChanged);
  }, [syncHardMode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const handleToggleSound = () => {
    setMuted(toggleSoundMuted());
  };

  const toggleHardMode = (enabled: boolean) => {
    if (enabled && !hardMode) playHardModeOn();
    if (!enabled && hardMode) playHardModeOff();
    setHardMode(enabled);
    setHardModeEnabled(enabled);
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const navLinkClass = (active: boolean, hardAccent = false) =>
    `${NAV.item} ${
      active
        ? hardAccent
          ? HARD.itemActive
          : NAV.itemActive
        : NAV.itemIdle
    }`;

  const playSearch = {
    cup: searchParams.get("cup"),
    draft: searchParams.get("draft"),
  };

  const difficulty = hardMode ? "HARD" : "NORMAL";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              playMenuClose();
              onClose();
            }}
          />
          <motion.aside
            className="sidebar-panel fixed inset-y-0 left-0 z-[70] flex w-[min(300px,85vw)] flex-col shadow-2xl"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="sidebar-header flex items-center justify-between border-b px-5 py-4">
              <div>
                <p className="font-display text-lg font-black tracking-tight">
                  <span className="text-gradient">27</span>
                  <span className="text-white">-0</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  playMenuClose();
                  onClose();
                }}
                className={BTN.close}
              >
                Close
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-5">
              <section>
                <p className={NAV.sectionLabel}>Navigation</p>
                <ul className={NAV.list}>
                  {MAIN_NAV_ITEMS.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={onClose}
                          className={navLinkClass(active)}
                        >
                          <span aria-hidden className={NAV.icon}>
                            {item.icon}
                          </span>
                          {item.label}
                          {active && (
                            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-green" />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className={NAV.sectionGap}>
                <p className={NAV.sectionLabel}>Play</p>
                <ul className={NAV.list}>
                  {PLAY_MODE_ITEMS.map((item) => {
                    const active = isPlayModeActive(
                      pathname,
                      playSearch,
                      item.mode
                    );
                    const href = buildPlayHref(item.mode, difficulty);
                    const hardAccent =
                      hardMode && (item.mode === "classic" || item.mode === "draft");
                    return (
                      <li key={item.mode}>
                        <Link
                          href={href}
                          onClick={onClose}
                          className={navLinkClass(active, hardAccent)}
                        >
                          <span aria-hidden className={NAV.icon}>
                            {item.icon}
                          </span>
                          {item.label}
                          {active && (
                            <span
                              className={`ml-auto h-1.5 w-1.5 rounded-full ${
                                hardAccent ? HARD.dot : "bg-accent-green"
                              }`}
                            />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-4 px-2">
                  <p className={`mb-2 ${TYPO.sectionLabel}`}>Hard Mode</p>
                  <div className={tabGroupClass(hardMode, !hardMode)}>
                    <button
                      type="button"
                      onClick={() => toggleHardMode(false)}
                      className={tabGroupButtonClass(!hardMode, "normal")}
                    >
                      Off
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleHardMode(true)}
                      className={tabGroupButtonClass(hardMode, "hard")}
                    >
                      On
                    </button>
                  </div>
                  <p className={`mt-2 ${TYPO.bodySm} text-gray-500`}>
                    Affects Normal Mode and Draft Mode only.
                  </p>
                </div>
              </section>
            </nav>

            <div className="sidebar-settings border-t px-4 py-5">
              <p className={NAV.sectionLabel}>Settings</p>
              <ul className={NAV.list}>
                <li>
                  <button
                    type="button"
                    onClick={handleToggleSound}
                    aria-label={
                      muted
                        ? "Sound off — click to enable"
                        : "Sound on — click to mute"
                    }
                    className={`${NAV.item} w-full border border-pitch-600 text-base hover:border-accent-green/40`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                        muted
                          ? "border-pitch-600 bg-pitch-900/80 text-gray-500"
                          : "border-accent-green/30 bg-accent-green/10 text-accent-green"
                      }`}
                      aria-hidden
                    >
                      {muted ? <SoundOffIcon /> : <SoundOnIcon />}
                    </span>
                    <span className="flex-1 text-left">Sound Effects</span>
                    <span
                      className={`${TYPO.button} ${
                        muted ? "text-gray-500" : "text-accent-green"
                      }`}
                    >
                      {muted ? "Sound: OFF" : "Sound: ON"}
                    </span>
                  </button>
                </li>
              </ul>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function SoundOnIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function SoundOffIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}
