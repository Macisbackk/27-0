"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GameDifficulty } from "@/lib/types";
import { useAuth } from "@/lib/auth-context";
import { buildPlayHref, isCupEraMode, isPlayModeActive } from "@/lib/play-links";
import {
  getModeDifficulty,
  getCupEraVariant,
  setCupEraVariant,
  CUP_ERA_VARIANT_CHANGED_EVENT,
  MODE_DIFFICULTY_CHANGED_EVENT,
  setModeDifficulty,
  type PlayModeKey,
} from "@/lib/storage/preferences";
import {
  isSoundMuted,
  playHardModeOff,
  playHardModeOn,
  playMenuClose,
  playUiClick,
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
import { SHOW_DRAFT_MODE } from "@/lib/feature-flags";
import { ChallengeCupVariantToggle } from "./ChallengeCupVariantToggle";
import {
  CoffeeIcon,
  SuggestionsIcon,
  XIcon,
} from "./SupportLinkIcons";

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
  ...(SHOW_DRAFT_MODE
    ? [{ mode: "draft" as const, modeKey: "draft" as const, label: "Draft Mode", icon: "📋" }]
    : []),
] as const;

const COFFEE_URL = "https://buymeacoffee.com/twentysevenzero";
const SUGGESTIONS_MAIL =
  "mailto:twentysevenzero@yahoo.com?subject=27-0%20Suggestion";
const X_URL = "https://x.com/27and0";

export function SidebarNav({ open, onClose }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading, isLoggedIn } = useAuth();
  const [normalDifficulty, setNormalDifficulty] =
    useState<GameDifficulty>("NORMAL");
  const [draftDifficulty, setDraftDifficulty] =
    useState<GameDifficulty>("NORMAL");
  const [muted, setMuted] = useState(false);
  const [cupEraVariant, setCupEraVariantState] = useState(false);

  useEffect(() => {
    setCupEraVariantState(getCupEraVariant());
  }, []);

  const syncDifficulties = useCallback(() => {
    setNormalDifficulty(getModeDifficulty("normal"));
    setDraftDifficulty(getModeDifficulty("draft"));
  }, []);

  useEffect(() => {
    if (!open) return;
    syncDifficulties();
    setMuted(isSoundMuted());
    setCupEraVariantState(getCupEraVariant());
  }, [open, syncDifficulties]);

  const playSearch = {
    cup: searchParams.get("cup"),
    draft: searchParams.get("draft"),
    fantasy: searchParams.get("fantasy"),
    era: searchParams.get("era"),
    difficulty: searchParams.get("difficulty"),
  };

  const isEraCup = isCupEraMode(playSearch);
  const isCupActive = isPlayModeActive(pathname, playSearch, "cup");

  useEffect(() => {
    if (isCupActive) {
      setCupEraVariantState(isEraCup);
    }
  }, [isCupActive, isEraCup]);

  useEffect(() => {
    const onVariantChanged = (event: Event) => {
      const detail = (event as CustomEvent<{ eraMode: boolean }>).detail;
      if (detail) setCupEraVariantState(detail.eraMode);
    };
    window.addEventListener(CUP_ERA_VARIANT_CHANGED_EVENT, onVariantChanged);
    return () =>
      window.removeEventListener(CUP_ERA_VARIANT_CHANGED_EVENT, onVariantChanged);
  }, []);

  const handleCupVariantChange = (era: boolean) => {
    setCupEraVariant(era);
    setCupEraVariantState(era);
    if (pathname.startsWith("/play") && playSearch.cup === "1") {
      router.push(buildPlayHref("cup", "NORMAL", era));
    }
  };

  const handleChallengeCupNavigate = () => {
    playUiClick();
    setCupEraVariant(cupEraVariant);
    router.push(buildPlayHref("cup", "NORMAL", cupEraVariant));
    onClose();
  };

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

  const handleNavClick = () => {
    playUiClick();
    onClose();
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
            className="sidebar-panel fixed inset-y-0 left-0 z-[70] flex w-[min(280px,88vw)] max-h-[100dvh] flex-col shadow-2xl"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="sidebar-header flex shrink-0 items-center justify-between border-b px-3 py-2">
              <div>
                <p className="font-display text-base font-black tracking-tight">
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
                className={`${BTN.close} px-2 py-1 text-xs`}
              >
                Close
              </button>
            </div>

            <nav className="sidebar-nav-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden px-2.5 py-2">
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
                      <li key={group.mode}>
                        <div className={NAV.playModeRow}>
                          <Link
                            href={href}
                            onClick={handleNavClick}
                            className={`${navLinkClass(active, isHard)} min-w-0 flex-1`}
                          >
                            <span aria-hidden className={NAV.icon}>
                              {group.icon}
                            </span>
                            <span className="truncate">{group.label}</span>
                            {active && (
                              <span
                                className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${
                                  isHard ? HARD.dot : "bg-accent-green"
                                }`}
                              />
                            )}
                          </Link>
                          <div
                            className={NAV.hardToggle}
                            aria-label={`${group.label} hard mode`}
                          >
                            <div className={nestedTabGroupClass(isHard, !isHard)}>
                              <button
                                type="button"
                                aria-label={`${group.label} standard difficulty`}
                                aria-pressed={!isHard}
                                onClick={() =>
                                  toggleModeDifficulty(group.modeKey, false)
                                }
                                className={nestedTabGroupButtonClass(
                                  !isHard,
                                  group.modeKey === "normal" ? "normal" : "normal"
                                )}
                              >
                                {group.modeKey === "normal" ? "Std" : "Off"}
                              </button>
                              <button
                                type="button"
                                aria-label={`${group.label} hard difficulty`}
                                aria-pressed={isHard}
                                onClick={() =>
                                  toggleModeDifficulty(group.modeKey, true)
                                }
                                className={nestedTabGroupButtonClass(
                                  isHard,
                                  "hard"
                                )}
                              >
                                Hard
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}

                  <li className={NAV.playModeGroup}>
                    <button
                      type="button"
                      onClick={handleChallengeCupNavigate}
                      className={`${navLinkClass(isCupActive, false)} w-full ${
                        isCupActive && isEraCup
                          ? "border-accent-gold/40 bg-accent-gold text-pitch-950 hover:bg-accent-gold/90"
                          : isCupActive
                            ? "border-accent-gold/30 bg-accent-gold/10 text-accent-gold"
                            : ""
                      }`}
                    >
                      <span aria-hidden className={NAV.icon}>
                        🏆
                      </span>
                      Challenge Cup
                      {isCupActive && (
                        <span
                          className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${
                            isEraCup ? "bg-pitch-950" : "bg-accent-gold"
                          }`}
                        />
                      )}
                    </button>
                    <div className="px-0.5">
                      <ChallengeCupVariantToggle
                        compact
                        hideLabel
                        eraMode={cupEraVariant}
                        onEraModeChange={handleCupVariantChange}
                      />
                    </div>
                  </li>

                  <li>
                    <Link
                      href={buildPlayHref("fantasy")}
                      onClick={handleNavClick}
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
                </ul>
              </section>

              <section className={NAV.sectionGap}>
                <p className={NAV.sectionLabel}>Game</p>
                <ul className={NAV.list}>
                  {MAIN_NAV_ITEMS.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={handleNavClick}
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
                        onClick={handleNavClick}
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
                        onClick={handleNavClick}
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
                </ul>
              </section>
            </nav>

            <div className={NAV.footer}>
              <p className={NAV.sectionLabel}>Settings</p>
              <button
                type="button"
                onClick={handleToggleSound}
                aria-label={
                  muted
                    ? "Sound off — click to enable"
                    : "Sound on — click to mute"
                }
                className={`${NAV.soundToggle} btn-press`}
              >
                <span
                  className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border ${
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
              <p className={`${NAV.sectionLabel} mt-2`}>Links</p>
              <div className={NAV.footerLinks}>
                <a
                  href={SUGGESTIONS_MAIL}
                  aria-label="Send a suggestion"
                  title="Suggestions"
                  className={NAV.supportLink}
                >
                  <SuggestionsIcon />
                </a>
                <a
                  href={COFFEE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Buy Me A Coffee — support 27-0"
                  title="Buy Me A Coffee"
                  className={NAV.supportLink}
                >
                  <CoffeeIcon />
                </a>
                <a
                  href={X_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Follow 27-0 on X"
                  title="Follow on X"
                  className={NAV.supportLink}
                >
                  <XIcon />
                </a>
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
