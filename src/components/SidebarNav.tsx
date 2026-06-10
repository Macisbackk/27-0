"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GameDifficulty } from "@/lib/types";
import { buildPlayHref, isPlayModeActive } from "@/lib/play-links";
import {
  getModeDifficulty,
  MODE_DIFFICULTY_CHANGED_EVENT,
  setModeDifficulty,
  type PlayModeKey,
} from "@/lib/storage/preferences";
import {
  isSoundMuted,
  playHardModeOff,
  playHardModeOn,
  playMenuClose,
  toggleSoundMuted,
} from "@/lib/sound";
import {
  BTN,
  HARD,
  NAV,
  nestedTabGroupButtonClass,
  nestedTabGroupClass,
} from "@/lib/ui/design-system";
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

const PLAY_MODE_GROUPS = [
  { mode: "classic" as const, modeKey: "normal" as const, label: "Normal Mode", icon: "🏉" },
  { mode: "draft" as const, modeKey: "draft" as const, label: "Draft Mode", icon: "📋" },
] as const;

export function SidebarNav({ open, onClose }: SidebarNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [normalDifficulty, setNormalDifficulty] =
    useState<GameDifficulty>("NORMAL");
  const [draftDifficulty, setDraftDifficulty] =
    useState<GameDifficulty>("NORMAL");
  const [muted, setMuted] = useState(false);

  const syncDifficulties = useCallback(() => {
    setNormalDifficulty(getModeDifficulty("normal"));
    setDraftDifficulty(getModeDifficulty("draft"));
  }, []);

  useEffect(() => {
    if (!open) return;
    syncDifficulties();
    setMuted(isSoundMuted());
  }, [open, syncDifficulties]);

  useEffect(() => {
    const onDifficultyChanged = () => syncDifficulties();
    window.addEventListener(MODE_DIFFICULTY_CHANGED_EVENT, onDifficultyChanged);
    return () =>
      window.removeEventListener(
        MODE_DIFFICULTY_CHANGED_EVENT,
        onDifficultyChanged
      );
  }, [syncDifficulties]);

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

  const toggleModeDifficulty = (modeKey: PlayModeKey, enabled: boolean) => {
    const next: GameDifficulty = enabled ? "HARD" : "NORMAL";
    const current =
      modeKey === "normal" ? normalDifficulty : draftDifficulty;
    if (enabled && current !== "HARD") playHardModeOn();
    if (!enabled && current === "HARD") playHardModeOff();
    if (modeKey === "normal") setNormalDifficulty(next);
    else setDraftDifficulty(next);
    setModeDifficulty(modeKey, next);
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
    difficulty: searchParams.get("difficulty"),
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
                <ul className={NAV.playModeList}>
                  {PLAY_MODE_GROUPS.map((group) => {
                    const difficulty =
                      group.modeKey === "normal"
                        ? normalDifficulty
                        : draftDifficulty;
                    const isHard = difficulty === "HARD";
                    const active = isPlayModeActive(
                      pathname,
                      playSearch,
                      group.mode,
                      difficulty
                    );
                    const href = buildPlayHref(group.mode, difficulty);

                    return (
                      <li key={group.mode} className={NAV.playModeGroup}>
                        <Link
                          href={href}
                          onClick={onClose}
                          className={navLinkClass(active, isHard)}
                        >
                          <span aria-hidden className={NAV.icon}>
                            {group.icon}
                          </span>
                          {group.label}
                          {active && (
                            <span
                              className={`ml-auto h-1.5 w-1.5 rounded-full ${
                                isHard ? HARD.dot : "bg-accent-green"
                              }`}
                            />
                          )}
                        </Link>
                        <div className={NAV.nestedBlock}>
                          <p className={NAV.nestedLabel}>Hard Mode</p>
                          <div className={nestedTabGroupClass(isHard, !isHard)}>
                            <button
                              type="button"
                              onClick={() =>
                                toggleModeDifficulty(group.modeKey, false)
                              }
                              className={nestedTabGroupButtonClass(!isHard, "normal")}
                            >
                              Off
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                toggleModeDifficulty(group.modeKey, true)
                              }
                              className={nestedTabGroupButtonClass(isHard, "hard")}
                            >
                              On
                            </button>
                          </div>
                        </div>
                      </li>
                    );
                  })}

                  <li>
                    <Link
                      href={buildPlayHref("cup")}
                      onClick={onClose}
                      className={navLinkClass(
                        isPlayModeActive(pathname, playSearch, "cup")
                      )}
                    >
                      <span aria-hidden className={NAV.icon}>
                        🏆
                      </span>
                      Challenge Cup
                      {isPlayModeActive(pathname, playSearch, "cup") && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-gold" />
                      )}
                    </Link>
                  </li>
                </ul>
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
