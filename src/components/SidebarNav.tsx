"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getDifficulty } from "@/lib/storage/preferences";
import { isSoundMuted, playMenuClose, toggleSoundMuted } from "@/lib/sound";
import { BTN, NAV, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

interface SidebarNavProps {
  open: boolean;
  onClose: () => void;
}

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/stats", label: "Statistics", icon: "📊" },
  { href: "/showcase", label: "Player Showcase", icon: "⭐" },
  { href: "/leaderboard", label: "Leaderboard", icon: "🏆" },
] as const;

function difficultyQuery(): string {
  return getDifficulty() === "HARD" ? "?difficulty=hard" : "";
}

export function SidebarNav({ open, onClose }: SidebarNavProps) {
  const pathname = usePathname();
  const [playHref, setPlayHref] = useState("/play");
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    setPlayHref(`/play${difficultyQuery()}`);
    setMuted(isSoundMuted());
  }, [open]);

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

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const navLinkClass = (active: boolean) =>
    `${NAV.item} ${active ? NAV.itemActive : NAV.itemIdle}`;

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

            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <p className={`mb-2 px-2 ${NAV.sectionLabel}`}>Navigation</p>
              <ul className={SPACING.stackSm}>
                {NAV_ITEMS.map((item) => {
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
                <li>
                  <Link
                    href={playHref}
                    onClick={onClose}
                    className={navLinkClass(pathname.startsWith("/play"))}
                  >
                    <span aria-hidden className={NAV.icon}>
                      🏉
                    </span>
                    Play
                    {pathname.startsWith("/play") && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-green" />
                    )}
                  </Link>
                </li>
              </ul>
            </nav>

            <div className="sidebar-settings border-t px-4 py-4">
              <p className={`mb-3 px-1 ${NAV.sectionLabel}`}>Settings</p>
              <div className={SPACING.stackSm}>
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
              </div>
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
