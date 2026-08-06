"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { ClubFundsDisplay } from "./ClubFundsDisplay";
import { HeaderAuthControls } from "./HeaderAuthControls";
import { LogoMark } from "./LogoMark";
import { SidebarNav } from "./SidebarNav";
import { playMenuOpen } from "@/lib/sound";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="app-header sticky top-0 z-50 overflow-x-clip border-b">
        <div className="app-chrome relative grid h-12 min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 overflow-hidden sm:h-[3.25rem] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-2">
          <div className="flex min-h-[44px] min-w-0 items-center justify-start sm:col-start-1">
            <button
              type="button"
              onClick={() => {
                playMenuOpen();
                setMenuOpen(true);
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--mobile-radius-medium)] border border-white/10 bg-[rgba(7,12,11,0.95)] text-base text-pitch-300 transition hover:border-white/20 hover:text-white sm:h-11 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm sm:font-medium"
              aria-label="Open menu"
            >
              <span aria-hidden className="leading-none">
                ☰
              </span>
              <span className="hidden sm:inline">Menu</span>
            </button>
          </div>

          <div className="flex min-w-0 items-center justify-center sm:col-start-2">
            <Link
              href="/"
              className="flex min-w-0 items-center justify-center px-1"
              aria-label="27-0 home"
            >
              <LogoMark />
            </Link>
          </div>

          <div className="flex min-h-[44px] min-w-0 items-center justify-end gap-1 sm:col-start-3 sm:gap-2">
            <ClubFundsDisplay />
            <HeaderAuthControls />
          </div>
        </div>
      </header>

      <Suspense fallback={null}>
        <SidebarNav open={menuOpen} onClose={() => setMenuOpen(false)} />
      </Suspense>
    </>
  );
}
