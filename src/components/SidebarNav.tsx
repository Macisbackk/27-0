"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getDifficulty } from "@/lib/storage/preferences";
import { isSoundMuted, toggleSoundMuted } from "@/lib/sound";
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
            onClick={onClose}
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
                onClick={onClose}
                className="rounded-lg border border-pitch-600 px-2.5 py-1 text-xs text-gray-400 transition hover:text-white"
              >
                Close
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4">
              <p className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-accent-green">
                Navigation
              </p>
              <ul className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${TYPO.nav} transition ${
                          active
                            ? "border border-accent-green/30 bg-accent-green/10 text-accent-green"
                            : "text-gray-300 hover:bg-pitch-800/60 hover:text-white"
                        }`}
                      >
                        <span aria-hidden className="text-base">
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
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${TYPO.nav} transition ${
                      pathname.startsWith("/play")
                        ? "border border-accent-green/30 bg-accent-green/10 text-accent-green"
                        : "text-gray-300 hover:bg-pitch-800/60 hover:text-white"
                    }`}
                  >
                    <span aria-hidden className="text-base">
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
              <p className="mb-3 px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-accent-green">
                Settings
              </p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleToggleSound}
                  className="flex w-full items-center justify-between rounded-lg border border-pitch-600 px-3 py-2.5 text-sm text-gray-300 transition hover:border-accent-green/40 hover:text-white"
                >
                  <span>Sound Effects</span>
                  <span className="font-medium text-white">
                    {muted ? "Muted" : "On"}
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
