"use client";

import Link from "next/link";
import { AlbumGlyph, CupGlyph, LadderGlyph, ShopGlyph } from "@/components/icons/rugby-icons";
import { useSquadBook } from "@/lib/squad-book";

const LINKS = [
  { href: "/leaderboard", label: "Leaderboard", icon: <LadderGlyph /> },
  { href: "/squad-book", label: "Squad Book", icon: <AlbumGlyph /> },
  { href: "/records", label: "Records", icon: <CupGlyph /> },
  { href: "/store", label: "Store", icon: <ShopGlyph /> },
];

/** The home page's small link row; the Squad Book carries its card count (collection hook). */
export function HomeMoreLinks() {
  const cards = Object.keys(useSquadBook().cards).length;
  return (
    <nav className="grid grid-cols-4 gap-1 border-t border-white/[0.07] pt-3" aria-label="More">
      {LINKS.map(({ href, label, icon }) => (
        <Link
          key={href}
          href={href}
          aria-label={href === "/squad-book" && cards > 0 ? `${label}, ${cards} cards` : undefined}
          className="relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-control text-[12px] font-semibold text-[color:var(--fl-muted)] hover:bg-pitch-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/70"
        >
          <span className="relative">
            <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {icon}
            </svg>
            {href === "/squad-book" && cards > 0 ? (
              <span
                aria-hidden
                className="absolute -right-4 -top-1.5 rounded-full bg-theme-primary px-1.5 font-cond text-[11px] font-bold leading-[16px] tabular-nums text-[color:var(--theme-text-on-primary)]"
              >
                {cards}
              </span>
            ) : null}
          </span>
          {label}
        </Link>
      ))}
    </nav>
  );
}
