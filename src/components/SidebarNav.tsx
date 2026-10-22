"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useModalA11y } from "@/hooks/useModalA11y";
import { buildPlayHref, isPlayModeActive } from "@/lib/play-links";
import { getDailyChallengeHref } from "@/lib/daily-challenge";
import {
  getNormalEraVariant,
  setNormalEraVariant,
  NORMAL_ERA_VARIANT_CHANGED_EVENT,
} from "@/lib/storage/preferences";
import {
  isSoundMuted,
  playMenuClose,
  playUiClick,
  toggleSoundMuted,
} from "@/lib/sound";
import { ChallengeCupVariantToggle } from "./ChallengeCupVariantToggle";
import { SHOW_DAILY_CHALLENGE_UI } from "@/lib/feature-flags";
import {
  CoffeeIcon,
  SuggestionsIcon,
  XIcon,
} from "./SupportLinkIcons";
import { useClubFunds } from "@/hooks/useClubFunds";
import { CLUB_FUNDS_INFO_LINES, formatClubFunds } from "@/lib/club-funds";

interface SidebarNavProps {
  open: boolean;
  onClose: () => void;
}

const COFFEE_URL = "https://buymeacoffee.com/twentysevenzero";
const SUGGESTIONS_MAIL =
  "mailto:twentysevenzero@yahoo.com?subject=27-0%20Suggestion";
const X_URL = "https://x.com/27and0";

export function SidebarNav({ open, onClose }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading, isLoggedIn } = useAuth();
  const { balance, totalEarned, ready: fundsReady } = useClubFunds();
  const [normalEraVariant, setNormalEraVariantState] = useState(false);
  const [muted, setMuted] = useState(false);
  const closeMenu = useCallback(() => {
    playMenuClose();
    onClose();
  }, [onClose]);
  const panelRef = useModalA11y(open, closeMenu);

  useEffect(() => {
    setNormalEraVariantState(getNormalEraVariant());
  }, []);

  useEffect(() => {
    if (!open) return;
    setMuted(isSoundMuted());
    setNormalEraVariantState(getNormalEraVariant());
  }, [open]);

  const playSearch = {
    cup: searchParams.get("cup"),
    draft: searchParams.get("draft"),
    fantasy: searchParams.get("fantasy"),
    era: searchParams.get("era"),
    difficulty: searchParams.get("difficulty"),
    daily: searchParams.get("daily"),
  };

  const isDailyActive =
    SHOW_DAILY_CHALLENGE_UI &&
    pathname.startsWith("/play") &&
    playSearch.daily === "1";

  const isNormalEra = isPlayModeActive(pathname, playSearch, "classic", true);
  const isNormalCurrent = isPlayModeActive(pathname, playSearch, "classic", false);
  const isNormalActive = isNormalEra || isNormalCurrent;

  useEffect(() => {
    if (isNormalActive) {
      setNormalEraVariantState(isNormalEra);
    }
  }, [isNormalActive, isNormalEra]);

  useEffect(() => {
    const onNormalVariant = (event: Event) => {
      const detail = (event as CustomEvent<{ eraMode: boolean }>).detail;
      if (detail) setNormalEraVariantState(detail.eraMode);
    };
    window.addEventListener(NORMAL_ERA_VARIANT_CHANGED_EVENT, onNormalVariant);
    return () => {
      window.removeEventListener(
        NORMAL_ERA_VARIANT_CHANGED_EVENT,
        onNormalVariant
      );
    };
  }, []);

  const handleNormalVariantChange = (era: boolean) => {
    // Don't yank Current/Era preference or leave Daily mid-run via this toggle.
    if (isDailyActive) return;
    setNormalEraVariant(era);
    setNormalEraVariantState(era);
    if (
      pathname.startsWith("/play") &&
      playSearch.cup !== "1" &&
      playSearch.fantasy !== "1" &&
      playSearch.draft !== "1"
    ) {
      router.push(buildPlayHref("classic", era), { scroll: false });
    }
  };

  const handleNormalNavigate = () => {
    playUiClick();
    setNormalEraVariant(normalEraVariant);
    router.push(buildPlayHref("classic", normalEraVariant), { scroll: false });
    onClose();
  };

  const handleNavClick = () => {
    playUiClick();
    onClose();
  };

  const handleToggleSound = () => {
    setMuted(toggleSoundMuted());
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const puzzles = [
    {
      href: "/mini-games/quiz",
      label: "Super League Millionaire",
      active: pathname.startsWith("/mini-games/quiz") || pathname.startsWith("/quiz"),
    },
    { href: "/mini-games/wordle", label: "Rugby League Wordle", active: pathname.startsWith("/mini-games/wordle") },
    { href: "/mini-games/grid", label: "Rugby League Grid", active: pathname.startsWith("/mini-games/grid") },
  ];

  const club = [
    { href: "/store", label: "Store", icon: <BagIcon /> },
    { href: "/leaderboard", label: "Leaderboard", icon: <TableIcon /> },
    { href: "/profile", label: "Coach Profile", icon: <PersonIcon /> },
    { href: "/settings", label: "Settings", icon: <CogIcon /> },
    ...(!loading && !isLoggedIn ? [{ href: "/login", label: "Log in", icon: <KeyIcon /> }] : []),
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            key="menu-backdrop"
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-[60] bg-black/60"
            style={{ willChange: "opacity" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={closeMenu}
          />
          <motion.aside
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            key="menu-panel"
            className="sidebar-panel fixed inset-y-0 right-0 z-[70] flex h-[100dvh] w-[min(320px,90vw)] flex-col shadow-2xl outline-none"
            style={{ willChange: "transform", backfaceVisibility: "hidden" }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            // A tween, not a spring: a spring overshoots and flashes the page behind the right edge.
            transition={{ type: "tween", duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="flex h-14 shrink-0 items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)]">
              <p className="text-[17px] font-bold text-white">Menu</p>
              <button
                type="button"
                onClick={closeMenu}
                aria-label="Close"
                className="btn-press flex h-11 w-11 items-center justify-center rounded-full bg-pitch-900 text-white transition hover:bg-pitch-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <nav
              className="sidebar-nav-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pb-4"
              data-scroll-lock-allow="true"
            >
              <section aria-label="Club Funds" className="rounded-[20px] bg-pitch-900 p-4">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[color:var(--fl-muted)]">Club Funds</p>
                    <p className="fl-number mt-1 text-[30px] leading-none text-theme-primary tabular-nums">
                      {fundsReady ? formatClubFunds(balance) : "—"}
                    </p>
                  </div>
                  <Link
                    href="/store"
                    onClick={handleNavClick}
                    className="btn-press flex h-11 shrink-0 items-center rounded-[14px] bg-pitch-800 px-3.5 text-sm font-bold text-white transition hover:bg-pitch-700"
                  >
                    Spend
                  </Link>
                </div>
                <p className="mt-2 text-xs text-[color:var(--fl-muted)]">
                  Lifetime earned {fundsReady ? formatClubFunds(totalEarned) : "—"}
                </p>
                <details className="group mt-3">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between rounded-[14px] bg-pitch-950 px-3 text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">
                    How to earn
                    <span aria-hidden className="text-[color:var(--fl-muted)] transition group-open:rotate-90">›</span>
                  </summary>
                  <ul className="mt-2 space-y-1.5 px-1">
                    {CLUB_FUNDS_INFO_LINES.map((line) => (
                      <li key={line.label} className="flex items-start justify-between gap-3 text-[13px] text-[color:var(--fl-muted)]">
                        <span className="min-w-0">{line.label}</span>
                        <span className="shrink-0 font-semibold tabular-nums text-white">
                          {line.valueText ?? formatClubFunds(line.amount)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </section>

              <section aria-labelledby="menu-play">
                <p id="menu-play" className="mb-1.5 px-1 text-[13px] font-semibold text-[color:var(--fl-muted)]">Play</p>
                <ul className="space-y-1">
                  {SHOW_DAILY_CHALLENGE_UI ? (
                    <li>
                      <MenuLink href={getDailyChallengeHref()} active={isDailyActive} icon={<CalendarIcon />} onClick={handleNavClick} dot="bg-amber-400">
                        Daily Challenge
                      </MenuLink>
                    </li>
                  ) : null}
                  <li className="rounded-[16px] bg-pitch-900/60">
                    <button
                      type="button"
                      onClick={handleNormalNavigate}
                      className={`${MENU_ROW} ${isNormalActive ? MENU_ROW_ACTIVE : MENU_ROW_IDLE}`}
                      aria-current={isNormalActive ? "page" : undefined}
                    >
                      <span className={MENU_ICON}><ShirtIcon /></span>
                      <span className="min-w-0 flex-1 text-left">Classic</span>
                      {isNormalActive ? <span className={`h-2 w-2 rounded-full ${isNormalEra ? "bg-accent-gold" : "bg-theme-primary"}`} /> : null}
                    </button>
                    {!isDailyActive ? (
                      <div className="px-2 pb-2">
                        <ChallengeCupVariantToggle
                          compact
                          hideLabel
                          sectionLabel="Mode"
                          eraMode={normalEraVariant}
                          onEraModeChange={handleNormalVariantChange}
                        />
                      </div>
                    ) : null}
                  </li>
                  <li>
                    <MenuLink href="/manager" active={pathname.startsWith("/manager")} icon={<TrophyIcon />} onClick={handleNavClick}>
                      Manager Mode
                    </MenuLink>
                  </li>
                </ul>
              </section>

              <section aria-labelledby="menu-puzzles">
                <p id="menu-puzzles" className="mb-1.5 px-1 text-[13px] font-semibold text-[color:var(--fl-muted)]">
                  <Link href="/mini-games" onClick={handleNavClick} className="hover:text-white">
                    Puzzles
                  </Link>
                </p>
                <ul className="space-y-1">
                  {puzzles.map((item) => (
                    <li key={item.href}>
                      <MenuLink href={item.href} active={item.active} icon={<PuzzleIcon />} onClick={handleNavClick}>
                        {item.label}
                      </MenuLink>
                    </li>
                  ))}
                </ul>
              </section>

              <section aria-labelledby="menu-club">
                <p id="menu-club" className="mb-1.5 px-1 text-[13px] font-semibold text-[color:var(--fl-muted)]">Club</p>
                <ul className="space-y-1">
                  {club.map((item) => (
                    <li key={item.href}>
                      <MenuLink href={item.href} active={isActive(item.href)} icon={item.icon} onClick={handleNavClick}>
                        {item.label}
                      </MenuLink>
                    </li>
                  ))}
                </ul>
              </section>
            </nav>

            <div className="shrink-0 border-t border-[color:var(--fl-line)] px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleSound}
                  aria-label={muted ? "Sound off — tap to enable" : "Sound on — tap to mute"}
                  className="btn-press flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-[14px] bg-pitch-900 px-3 text-sm font-semibold text-white transition hover:bg-pitch-800"
                >
                  <span className={muted ? "text-[color:var(--fl-muted)]" : "text-theme-primary"} aria-hidden>
                    {muted ? <SoundOffIcon /> : <SoundOnIcon />}
                  </span>
                  <span className="flex-1 text-left">Sound</span>
                  <span className={`text-xs font-bold ${muted ? "text-[color:var(--fl-muted)]" : "text-theme-primary"}`}>{muted ? "Off" : "On"}</span>
                </button>
                <a href={SUGGESTIONS_MAIL} aria-label="Send a suggestion" title="Suggestions" className={FOOT_LINK}>
                  <SuggestionsIcon />
                </a>
                <a href={COFFEE_URL} target="_blank" rel="noopener noreferrer" aria-label="Buy Me a Coffee — support 27-0" title="Buy Me a Coffee" className={FOOT_LINK}>
                  <CoffeeIcon />
                </a>
                <a href={X_URL} target="_blank" rel="noopener noreferrer" aria-label="Follow 27-0 on X" title="Follow on X" className={FOOT_LINK}>
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

const MENU_ROW =
  "btn-press flex min-h-[48px] w-full items-center gap-3 rounded-[16px] px-3 text-[15px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/50";
const MENU_ROW_IDLE = "text-white hover:bg-pitch-900";
const MENU_ROW_ACTIVE = "bg-pitch-900 text-white";
const MENU_ICON = "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-pitch-950 text-theme-primary";
const FOOT_LINK =
  "btn-press flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-pitch-900 text-[color:var(--fl-muted)] transition hover:bg-pitch-800 hover:text-white";

function MenuLink({
  href,
  active,
  icon,
  onClick,
  dot = "bg-theme-primary",
  children,
}: {
  href: string;
  active: boolean;
  icon: ReactNode;
  onClick: () => void;
  dot?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`${MENU_ROW} ${active ? MENU_ROW_ACTIVE : MENU_ROW_IDLE}`}
    >
      <span className={MENU_ICON}>{icon}</span>
      <span className="min-w-0 flex-1">{children}</span>
      {active ? <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} /> : null}
    </Link>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}
const CalendarIcon = () => (
  <Icon>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Icon>
);
const ShirtIcon = () => (
  <Icon>
    <path d="M8 3 4 5 2 10l3 2 1-1v10h12V11l1 1 3-2-2-5-4-2c-1 2-7 2-8 0z" />
  </Icon>
);
const TrophyIcon = () => (
  <Icon>
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
    <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
  </Icon>
);
const PuzzleIcon = () => (
  <Icon>
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </Icon>
);
const BagIcon = () => (
  <Icon>
    <path d="M5 8h14l-1 13H6z" />
    <path d="M9 8V6a3 3 0 0 1 6 0v2" />
  </Icon>
);
const TableIcon = () => (
  <Icon>
    <path d="M4 6h16M4 12h16M4 18h16" />
  </Icon>
);
const PersonIcon = () => (
  <Icon>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </Icon>
);
const CogIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </Icon>
);
const KeyIcon = () => (
  <Icon>
    <circle cx="8" cy="15" r="4" />
    <path d="m10.8 12.2 9.2-9.2M17 6l3 3" />
  </Icon>
);

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
