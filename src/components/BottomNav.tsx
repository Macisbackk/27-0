"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { playUiClick } from "@/lib/sound";
import { BallGlyph, BoardGlyph, LadderGlyph, PostsGlyph, ShirtGlyph, TilesGlyph, WhistleGlyph } from "@/components/icons/rugby-icons";
import { useManagerNav, type ManagerTab } from "@/lib/ui/manager-nav";

const ITEMS = [
  { href: "/", label: "Home", match: (p: string) => p === "/", icon: <PostsGlyph /> },
  {
    href: "/play",
    label: "Classic",
    match: (p: string) => p.startsWith("/play"),
    icon: <BallGlyph />,
  },
  { href: "/manager", label: "Manager", match: (p: string) => p.startsWith("/manager"), icon: <BoardGlyph /> },
  {
    href: "/mini-games",
    label: "Puzzles",
    match: (p: string) => p.startsWith("/mini-games") || p.startsWith("/quiz"),
    icon: <TilesGlyph />,
  },
  {
    href: "/profile",
    label: "Profile",
    // The leaderboard, Squad Book and Settings are reached from Profile, so it stays lit there.
    match: (p: string) =>
      p.startsWith("/profile") || p.startsWith("/settings") || p.startsWith("/leaderboard") || p.startsWith("/squad-book") || p.startsWith("/records"),
    icon: <WhistleGlyph />,
  },
];

/** Manager Mode hub sections, shown in place of the site's modes while the hub is on screen. */
const MANAGER_ITEMS: { id: ManagerTab; label: string; icon: ReactNode }[] = [
  { id: "match", label: "Match", icon: <BallGlyph /> },
  { id: "team", label: "Team", icon: <ShirtGlyph /> },
  { id: "table", label: "Table", icon: <LadderGlyph /> },
  { id: "club", label: "Club", icon: <BoardGlyph /> },
];

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

function ActivePill() {
  return (
    <motion.span
      layoutId="bottom-nav-pill"
      className="fl-bottom-nav__pill"
      transition={{ type: "spring", stiffness: 520, damping: 42, mass: 0.8 }}
      aria-hidden
    />
  );
}

/**
 * Hidden only while a Classic run owns the screen (draft, sim, review: its own sticky bar) and on
 * the sign-in screens. Manager and the puzzles keep it; their sticky action bars lift above it
 * (see `html[data-bottom-nav]` in globals.css).
 */
const HIDE_ON = ["/play", "/login", "/auth"];

/** Phone-only tab bar. */
export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const hidden = HIDE_ON.some((p) => pathname.startsWith(p));
  const managerNav = useManagerNav();
  const showManager = !!managerNav && pathname.startsWith("/manager");

  // Lets page-level sticky bars (.mobile-action-bar) sit above the nav instead of under it.
  useEffect(() => {
    const root = document.documentElement;
    if (hidden) {
      delete root.dataset.bottomNav;
      return;
    }
    root.dataset.bottomNav = "1";
    return () => {
      delete root.dataset.bottomNav;
    };
  }, [hidden]);

  if (hidden) return null;
  return (
    <>
      {/* Reserves the nav's height (plus the home-indicator inset) so it never covers the page end. */}
      <div aria-hidden className="fl-bottom-nav-spacer sm:hidden" />
      {showManager ? (
        <nav className="fl-bottom-nav" aria-label="Manager sections">
          <Link href="/" onClick={() => playUiClick()} aria-label="Home: leave Manager Mode">
            <NavIcon>
              <PostsGlyph />
            </NavIcon>
            Home
          </Link>
          <div role="tablist" aria-label="Manager sections" className="contents">
            {MANAGER_ITEMS.map((item) => {
              const active = managerNav.tab === item.id;
              return (
                <a
                  key={item.id}
                  href={`/manager#${item.id}`}
                  role="tab"
                  aria-selected={active}
                  aria-current={active ? "page" : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    playUiClick();
                    managerNav.setTab(item.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  {active ? <ActivePill /> : null}
                  <NavIcon>{item.icon}</NavIcon>
                  {item.label}
                </a>
              );
            })}
          </div>
        </nav>
      ) : (
      <nav className="fl-bottom-nav" aria-label="Main">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} onClick={() => playUiClick()}>
              {active ? <ActivePill /> : null}
              <NavIcon>{item.icon}</NavIcon>
              {item.label}
            </Link>
          );
        })}
      </nav>
      )}
    </>
  );
}
