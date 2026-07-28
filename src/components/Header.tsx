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
        <div className="relative mx-auto grid min-h-14 max-w-6xl min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-1 overflow-hidden px-2 py-1.5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:h-[3.75rem] sm:gap-2 sm:px-4 sm:py-0">
          <div className="flex min-h-[44px] min-w-0 items-center justify-start sm:col-start-1">
            <button
              type="button"
              onClick={() => {
                playMenuOpen();
                setMenuOpen(true);
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border-2 border-theme-tertiary/50 bg-[#0b1220] text-lg text-pitch-300 shadow-[3px_3px_0_rgba(0,0,0,0.4)] transition hover:border-theme-tertiary hover:bg-theme-primary/10 hover:text-theme-primary sm:min-h-[44px] sm:w-auto sm:gap-2 sm:px-4 sm:text-xs sm:font-black sm:uppercase sm:tracking-wider sm:text-gray-300"
              aria-label="Open menu"
            >
              <span aria-hidden className="leading-none sm:text-base">
                ☰
              </span>
              <span className="hidden sm:inline">Menu</span>
            </button>
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center justify-center gap-0.5 sm:pointer-events-auto sm:static sm:z-auto sm:col-start-2 sm:translate-y-0">
            <Link
              href="/"
              className="pointer-events-auto flex min-w-0 items-center justify-center px-1 sm:px-3"
              aria-label="27-0 home"
            >
              <LogoMark />
            </Link>
            <div className="pointer-events-auto sm:hidden">
              <ClubFundsDisplay placement="mobile-under-logo" />
            </div>
          </div>

          <div className="flex min-h-[44px] min-w-0 items-center justify-end gap-1 sm:col-start-3 sm:gap-2">
            <div className="max-sm:hidden">
              <ClubFundsDisplay />
            </div>
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
