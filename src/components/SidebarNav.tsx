"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GameDifficulty } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
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
  { href: "/showcase", label: "Player Showcase", icon: "⭐" },
  { href: "/stats", label: "Statistics", icon: "📊" },
  { href: "/leaderboard", label: "Leaderboard", icon: "🏆" },
  { href: "/updates", label: "Updates", icon: "📰" },
] as const;

const PLAY_MODE_GROUPS = [
  { mode: "classic" as const, modeKey: "normal" as const, label: "Normal Mode", icon: "🏉" },
  { mode: "draft" as const, modeKey: "draft" as const, label: "Draft Mode", icon: "📋" },
] as const;

const COFFEE_URL = "https://buymeacoffee.com/twentysevenzero";
const SUGGESTIONS_MAIL =
  "mailto:twentysevenzero@yahoo.com?subject=27-0%20Suggestion";
const X_URL = "https://x.com/27and0";

export function SidebarNav({ open, onClose }: SidebarNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { loading, isLoggedIn } = useAuth();
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
    fantasy: searchParams.get("fantasy"),
    era: searchParams.get("era"),
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
            <div className="sidebar-header flex items-center justify-between border-b px-4 py-3">
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

            <nav className="flex flex-1 flex-col px-3 py-3">
              <section>
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
                      href={buildPlayHref("fantasy")}
                      onClick={onClose}
                      className={navLinkClass(
                        isPlayModeActive(pathname, playSearch, "fantasy")
                      )}
                    >
                      <span aria-hidden className={NAV.icon}>
                        ✨
                      </span>
                      Fantasy Mode
                      {isPlayModeActive(pathname, playSearch, "fantasy") && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-green" />
                      )}
                    </Link>
                  </li>

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

              <section className={NAV.sectionGap}>
                <p className={NAV.sectionLabel}>Explore</p>
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

              <section className={`${NAV.sectionGap} mt-auto`}>
                <p className={NAV.sectionLabel}>Account</p>
                <ul className={NAV.list}>
                  <li>
                    {loading ? (
                      <div
                        className={`${NAV.item} text-gray-500`}
                        aria-busy="true"
                      >
                        <span className={TYPO.bodySm}>Loading…</span>
                      </div>
                    ) : isLoggedIn ? (
                      <Link
                        href="/profile"
                        onClick={onClose}
                        className={navLinkClass(pathname.startsWith("/profile"))}
                      >
                        <span aria-hidden className={NAV.icon}>
                          👤
                        </span>
                        Coach Profile
                        {pathname.startsWith("/profile") && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-green" />
                        )}
                      </Link>
                    ) : (
                      <Link
                        href="/login"
                        onClick={onClose}
                        className={navLinkClass(pathname.startsWith("/login"))}
                      >
                        <span aria-hidden className={NAV.icon}>
                          🔑
                        </span>
                        Log In
                        {pathname.startsWith("/login") && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent-green" />
                        )}
                      </Link>
                    )}
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={handleToggleSound}
                      aria-label={
                        muted
                          ? "Sound off — click to enable"
                          : "Sound on — click to mute"
                      }
                      className={NAV.soundToggle}
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                          muted
                            ? "border-pitch-600 bg-pitch-900/80 text-gray-500"
                            : "border-accent-green/30 bg-accent-green/10 text-accent-green"
                        }`}
                        aria-hidden
                      >
                        {muted ? <SoundOffIcon /> : <SoundOnIcon />}
                      </span>
                      <span className={`min-w-0 flex-1 truncate ${TYPO.nav}`}>
                        Sound
                      </span>
                      <span
                        className={`${NAV.soundStatus} ${
                          muted ? "text-gray-500" : "text-accent-green"
                        }`}
                      >
                        {muted ? "OFF" : "ON"}
                      </span>
                    </button>
                  </li>
                </ul>
              </section>
            </nav>

            <div className={NAV.supportRow}>
              <a
                href={COFFEE_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Buy Me A Coffee — support 27-0"
                className={NAV.supportLink}
              >
                <CoffeeIcon />
              </a>
              <a
                href={SUGGESTIONS_MAIL}
                aria-label="Send a suggestion"
                className={NAV.supportLink}
              >
                <SuggestionsIcon />
              </a>
              <a
                href={X_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Follow 27-0 on X"
                className={NAV.supportLink}
              >
                <XIcon />
              </a>
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
      width="14"
      height="14"
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
      width="14"
      height="14"
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

function CoffeeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
      <line x1="6" y1="2" x2="6" y2="4" />
      <line x1="10" y1="2" x2="10" y2="4" />
      <line x1="14" y1="2" x2="14" y2="4" />
    </svg>
  );
}

function SuggestionsIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
