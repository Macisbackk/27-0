"use client";

import { contactMailto } from "@/lib/contact";
import { BallGlyph, BoardGlyph, FixtureGlyph, LadderGlyph, ProgrammeGlyph, ShopGlyph, TilesGlyph, WhistleGlyph } from "@/components/icons/rugby-icons";
import Link from "next/link";
import { CountUp } from "@/components/ui/CountUp";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useModalA11y } from "@/hooks/useModalA11y";
import { buildPlayHref, isPlayModeActive } from "@/lib/play-links";
import { getDailyChallengeHref } from "@/lib/daily-challenge";
import { setNormalEraVariant } from "@/lib/storage/preferences";
import {
  isSoundMuted,
  playMenuClose,
  playUiClick,
  toggleSoundMuted,
} from "@/lib/sound";
import { SHOW_DAILY_CHALLENGE_UI } from "@/lib/feature-flags";
import { SHOW_TIP_LINKS } from "@/lib/native/platform";
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
const SUGGESTIONS_MAIL = contactMailto("27-0 Suggestion");
const X_URL = "https://x.com/27and0";

export function SidebarNav({ open, onClose }: SidebarNavProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { loading, isLoggedIn } = useAuth();
  const { balance, totalEarned, ready: fundsReady } = useClubFunds();
  const [muted, setMuted] = useState(false);
  const closeMenu = useCallback(() => {
    playMenuClose();
    onClose();
  }, [onClose]);
  const panelRef = useModalA11y(open, closeMenu, { lockScroll: false });

  useEffect(() => {
    if (!open) return;
    setMuted(isSoundMuted());
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

  // The Weekly is its own play surface too: don't light up Classic for it.
  const isWeekly = searchParams.get("weekly") === "1";
  // Side modes (One-Club XI, Gauntlet, past Dailies) light up "More modes", not Classic.
  const isSideMode =
    pathname.startsWith("/play") &&
    (searchParams.get("oneclub") !== null || searchParams.get("gauntlet") === "1" || searchParams.get("archive") !== null);
  const isNormalEra = !isWeekly && !isSideMode && isPlayModeActive(pathname, playSearch, "classic", true);
  const isNormalCurrent = !isWeekly && !isSideMode && isPlayModeActive(pathname, playSearch, "classic", false);

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
      label: "Golden Point Quiz",
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

  // Always mounted: the menu slides with a CSS transform and never locks/unlocks the page, because
  // toggling scroll lock (and mounting the panel) is what made iPhone Safari flash on open and close.
  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={-1}
        aria-hidden={!open}
        onClick={closeMenu}
        className={`fixed inset-0 z-[60] bg-black/60 [touch-action:none] transition-opacity duration-200 ease-out ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal={open ? "true" : undefined}
        aria-label="Site menu"
        aria-hidden={!open}
        inert={!open}
        className={`sidebar-panel fixed inset-y-0 right-0 z-[70] flex w-[min(320px,90vw)] flex-col shadow-2xl outline-none ${
          open ? "sidebar-panel--open" : ""
        }`}
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
              className={`sidebar-nav-scroll flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pb-4 ${open ? "fl-stagger" : ""}`}
              data-scroll-lock-allow="true"
            >
              <section aria-label="Club Funds" className="rounded-card bg-pitch-900 p-4">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[color:var(--fl-muted)]">Club Funds</p>
                    <p className="fl-number mt-1 text-[30px] leading-none text-theme-primary tabular-nums">
                      {fundsReady ? <CountUp value={balance} format={formatClubFunds} durationMs={700} /> : "—"}
                    </p>
                  </div>
                  <Link
                    href="/store"
                    onClick={handleNavClick}
                    className="btn-press flex h-11 shrink-0 items-center rounded-control bg-pitch-800 px-3.5 text-sm font-bold text-white transition hover:bg-pitch-700"
                  >
                    Spend
                  </Link>
                </div>
                <p className="mt-2 text-xs text-[color:var(--fl-muted)]">
                  Lifetime earned {fundsReady ? formatClubFunds(totalEarned) : "—"}
                </p>
                <details className="group mt-3">
                  <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between rounded-control bg-pitch-950 px-3 text-sm font-semibold text-white [&::-webkit-details-marker]:hidden">
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
                  <li>
                    <MenuLink
                      href={buildPlayHref("classic", false)}
                      active={isNormalCurrent}
                      icon={<ShirtIcon />}
                      onClick={() => {
                        setNormalEraVariant(false);
                        handleNavClick();
                      }}
                    >
                      Classic
                    </MenuLink>
                  </li>
                  <li>
                    <MenuLink
                      href={buildPlayHref("classic", true)}
                      active={isNormalEra}
                      icon={<EraIcon />}
                      onClick={() => {
                        setNormalEraVariant(true);
                        handleNavClick();
                      }}
                      dot="bg-accent-gold"
                    >
                      Era Classic
                    </MenuLink>
                  </li>
                  <li>
                    <MenuLink href="/manager" active={pathname.startsWith("/manager")} icon={<TrophyIcon />} onClick={handleNavClick}>
                      Manager Mode
                    </MenuLink>
                  </li>
                  <li>
                    <MenuLink href="/modes" active={pathname.startsWith("/modes") || isSideMode} icon={<EraIcon />} onClick={handleNavClick}>
                      More modes
                    </MenuLink>
                  </li>
                </ul>
              </section>

              <Link
                href="/squad-book"
                onClick={handleNavClick}
                aria-current={isActive("/squad-book") ? "page" : undefined}
                className="btn-press fl-pressable flex min-h-[56px] items-center gap-3 rounded-card bg-pitch-900 px-3 py-2.5 text-white transition hover:bg-pitch-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/50"
              >
                <span className={MENU_ICON}>
                  <BookIcon />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">Squad Book</span>
                  <span className="block text-[13px] text-[color:var(--fl-muted)]">Collect every player you sign</span>
                </span>
                <span aria-hidden className="text-[color:var(--fl-muted)]">›</span>
              </Link>

              <Link
                href="/records"
                onClick={handleNavClick}
                aria-current={isActive("/records") ? "page" : undefined}
                className="btn-press fl-pressable flex min-h-[56px] items-center gap-3 rounded-card bg-pitch-900 px-3 py-2.5 text-white transition hover:bg-pitch-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/50"
              >
                <span className={MENU_ICON}>
                  <TableIcon />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">Records</span>
                  <span className="block text-[13px] text-[color:var(--fl-muted)]">Best squad, all-time record, 27-0s</span>
                </span>
                <span aria-hidden className="text-[color:var(--fl-muted)]">›</span>
              </Link>

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
                  className="btn-press flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-control bg-pitch-900 px-3 text-sm font-semibold text-white transition hover:bg-pitch-800"
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
                {SHOW_TIP_LINKS ? (
                  <a href={COFFEE_URL} target="_blank" rel="noopener noreferrer" aria-label="Buy Me a Coffee — support 27-0" title="Buy Me a Coffee" className={FOOT_LINK}>
                    <CoffeeIcon />
                  </a>
                ) : null}
                <a href={X_URL} target="_blank" rel="noopener noreferrer" aria-label="Follow 27-0 on X" title="Follow on X" className={FOOT_LINK}>
                  <XIcon />
                </a>
              </div>
            </div>
      </aside>
    </>
  );
}

const MENU_ROW =
  "btn-press fl-pressable flex min-h-[48px] w-full items-center gap-3 rounded-tile px-3 text-[15px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/50";
const MENU_ROW_IDLE = "text-white hover:bg-pitch-900";
const MENU_ROW_ACTIVE = "bg-pitch-900 text-white";
const MENU_ICON = "flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-pitch-950 text-theme-primary";
const FOOT_LINK =
  "btn-press flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-pitch-900 text-[color:var(--fl-muted)] transition hover:bg-pitch-800 hover:text-white";

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
    <FixtureGlyph />
  </Icon>
);
const ShirtIcon = () => (
  <Icon>
    <BallGlyph />
  </Icon>
);
const EraIcon = () => (
  <Icon>
    <ProgrammeGlyph />
  </Icon>
);
const TrophyIcon = () => (
  <Icon>
    <BoardGlyph />
  </Icon>
);
const PuzzleIcon = () => (
  <Icon>
    <TilesGlyph />
  </Icon>
);
const BagIcon = () => (
  <Icon>
    <ShopGlyph />
  </Icon>
);
const BookIcon = () => (
  <Icon>
    <path d="M4 19.5V5a2 2 0 0 1 2-2h14v16H6.5A2.5 2.5 0 0 0 4 21.5" />
    <path d="M20 19v2.5H6.5" />
  </Icon>
);
const TableIcon = () => (
  <Icon>
    <LadderGlyph />
  </Icon>
);
const PersonIcon = () => (
  <Icon>
    <WhistleGlyph />
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
