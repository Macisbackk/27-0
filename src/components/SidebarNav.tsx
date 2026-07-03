"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogoMark } from "@/components/LogoMark";
import { useAuth } from "@/lib/auth-context";
import { useModalA11y } from "@/hooks/useModalA11y";
import { buildPlayHref, isPlayModeActive } from "@/lib/play-links";
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
import {
  BTN,
  NAV,
} from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
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
  { href: "/store", label: "Store", icon: "🛒" },
  { href: "/showcase", label: "Player Showcase", icon: "⭐" },
  { href: "/stats", label: "Statistics", icon: "📊" },
  { href: "/leaderboard", label: "Leaderboard", icon: "🏆" },
  { href: "/updates", label: "Updates", icon: "📰" },
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
  };

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
    setNormalEraVariant(era);
    setNormalEraVariantState(era);
    if (
      pathname.startsWith("/play") &&
      playSearch.cup !== "1" &&
      playSearch.fantasy !== "1" &&
      playSearch.draft !== "1"
    ) {
      router.push(buildPlayHref("classic", era));
    }
  };

  const handleNormalNavigate = () => {
    playUiClick();
    setNormalEraVariant(normalEraVariant);
    router.push(buildPlayHref("classic", normalEraVariant));
    onClose();
  };

  const handleNavClick = () => {
    playUiClick();
    onClose();
  };

  const handleToggleSound = () => {
    setMuted(toggleSoundMuted());
  };

  const navLinkClass = (active: boolean, eraAccent = false) =>
    `${NAV.item} ${
      active
        ? eraAccent
          ? "border-accent-gold/40 bg-accent-gold/10 text-accent-gold"
          : NAV.itemActive
        : NAV.itemIdle
    }`;

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
            onClick={closeMenu}
          />
          <motion.aside
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className="sidebar-panel fixed inset-y-0 left-0 z-[70] flex w-[min(280px,88vw)] max-h-[100dvh] flex-col shadow-2xl outline-none"
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div className="sidebar-header flex shrink-0 items-center justify-between border-b px-3 py-2">
              <div>
                <LogoMark />
              </div>
              <button
                type="button"
                onClick={closeMenu}
                className={`${BTN.close} px-2 py-1 text-xs`}
              >
                Close
              </button>
            </div>

            <nav className="sidebar-nav-scroll flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden px-2.5 py-2">
              <section>
                <p className={NAV.sectionLabel}>Play</p>
                <ul className={NAV.playModeList}>
                  <li className={NAV.playModeGroup}>
                    <Link
                      href="/manager"
                      onClick={handleNavClick}
                      className={`${navLinkClass(pathname.startsWith("/manager"))} w-full`}
                    >
                      <span aria-hidden className={NAV.icon}>
                        📋
                      </span>
                      Manager Mode
                      {pathname.startsWith("/manager") && (
                        <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-theme-primary" />
                      )}
                    </Link>
                  </li>

                  <li className={NAV.playModeGroup}>
                    <button
                      type="button"
                      onClick={handleNormalNavigate}
                      className={`${navLinkClass(isNormalActive, isNormalEra)} w-full`}
                    >
                      <span aria-hidden className={NAV.icon}>
                        🏉
                      </span>
                      Normal Mode
                      {isNormalActive && (
                        <span
                          className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${
                            isNormalEra ? "bg-accent-gold" : "bg-theme-primary"
                          }`}
                        />
                      )}
                    </button>
                    <div className={NAV.nestedBlock}>
                      <ChallengeCupVariantToggle
                        compact
                        hideLabel
                        sectionLabel="Mode"
                        eraMode={normalEraVariant}
                        onEraModeChange={handleNormalVariantChange}
                      />
                    </div>
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
                            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-theme-primary" />
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
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-theme-primary" />
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
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-theme-primary" />
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
                      : "border-theme-primary/30 bg-theme-primary/10 text-theme-primary"
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
                    muted ? "text-gray-500" : "text-theme-primary"
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
