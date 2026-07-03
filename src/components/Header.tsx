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
      <header className="app-header sticky top-0 z-50 border-b">
        <div className="mx-auto grid min-h-14 max-w-6xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-1 px-2 py-1.5 sm:h-[3.75rem] sm:gap-2 sm:px-4 sm:py-0">
          <div className="flex min-h-[44px] min-w-0 items-center justify-start">
            <button
              type="button"
              onClick={() => {
                playMenuOpen();
                setMenuOpen(true);
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg text-pitch-300 transition hover:bg-pitch-800/45 hover:text-white sm:min-h-[44px] sm:w-auto sm:gap-2 sm:rounded-lg sm:border sm:border-pitch-600 sm:px-4 sm:text-sm sm:font-medium sm:text-gray-300 sm:hover:border-theme-primary sm:hover:bg-transparent sm:hover:text-white"
              aria-label="Open menu"
            >
              <span aria-hidden className="leading-none sm:text-base">
                ☰
              </span>
              <span className="hidden sm:inline">Menu</span>
            </button>
          </div>

          <div className="flex min-w-0 flex-col items-center justify-center gap-0.5">
            <Link
              href="/"
              className="flex min-w-0 items-center justify-center px-1 sm:px-3"
              aria-label="27-0 home"
            >
              <LogoMark />
            </Link>
            <div className="flex w-full justify-center sm:hidden">
              <ClubFundsDisplay placement="mobile-under-logo" />
            </div>
          </div>

          <div className="flex min-h-[44px] min-w-0 items-center justify-end gap-1 sm:gap-2">
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
