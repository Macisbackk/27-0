"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { playUiClick } from "@/lib/sound";

const ITEMS = [
  { href: "/", label: "Home", match: (p: string) => p === "/", icon: <path d="M3 11l9-7 9 7v9H3z" /> },
  {
    href: "/play",
    label: "Classic",
    match: (p: string) => p.startsWith("/play"),
    icon: (
      <>
        <circle cx="12" cy="12" r="8" />
        <path d="M10 9l5 3-5 3z" />
      </>
    ),
  },
  { href: "/leaderboard", label: "Tables", match: (p: string) => p.startsWith("/leaderboard"), icon: <path d="M6 20V10M12 20V4M18 20v-7" /> },
  {
    href: "/profile",
    label: "Profile",
    match: (p: string) => p.startsWith("/profile") || p.startsWith("/settings"),
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
      </>
    ),
  },
];

/** Screens that run their own sticky action bar keep the bottom of the screen to themselves. */
const HIDE_ON = ["/play", "/manager", "/mini-games/quiz", "/mini-games/wordle", "/mini-games/grid", "/login", "/auth"];

/** Phone-only tab bar for the hub pages. */
export function BottomNav() {
  const pathname = usePathname() ?? "/";
  if (HIDE_ON.some((p) => pathname.startsWith(p))) return null;
  return (
    <>
      <div aria-hidden className="h-[88px] sm:hidden" />
      <nav className="fl-bottom-nav" aria-label="Main">
        {ITEMS.map((item) => {
          const active = item.match(pathname);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} onClick={() => playUiClick()}>
              {active ? (
                <motion.span
                  layoutId="bottom-nav-pill"
                  className="fl-bottom-nav__pill"
                  transition={{ type: "spring", stiffness: 520, damping: 42, mass: 0.8 }}
                  aria-hidden
                />
              ) : null}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {item.icon}
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
