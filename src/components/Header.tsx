"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { ClubFundsDisplay } from "./ClubFundsDisplay";
import { HeaderAuthControls } from "./HeaderAuthControls";
import { SidebarNav } from "./SidebarNav";
import { playMenuOpen } from "@/lib/sound";
import { BTN } from "@/lib/ui/design-system";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="app-header sticky top-0 z-50 border-b backdrop-blur-md">
        <div className="mx-auto grid min-h-14 max-w-6xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 px-2 py-1 sm:h-[3.75rem] sm:gap-2 sm:px-4 sm:py-0">
          <div className="flex min-h-[44px] min-w-0 items-center justify-start">
            <button
              type="button"
              onClick={() => {
                playMenuOpen();
                setMenuOpen(true);
              }}
              className={`${BTN.header} h-11 min-h-[44px] max-w-[5.5rem] justify-center px-2 sm:max-w-none sm:px-4`}
              aria-label="Open menu"
            >
              <span aria-hidden className="text-base leading-none">
                ☰
              </span>
              <span className="hidden sm:inline">Menu</span>
            </button>
          </div>

          <Link
            href="/"
            className="flex min-w-0 items-center justify-center px-1 sm:px-3"
            aria-label="27-0 home"
          >
            <span className="whitespace-nowrap text-xl font-black tracking-tight sm:text-3xl">
              <span className="text-gradient">27</span>
              <span className="text-white">-0</span>
            </span>
          </Link>

          <div className="flex min-h-[44px] min-w-0 items-center justify-end gap-0.5 sm:gap-2">
            <ClubFundsDisplay placement="desktop" />
            <div className="flex min-w-0 flex-col items-end gap-0.5">
              <HeaderAuthControls />
              <ClubFundsDisplay placement="mobile" />
            </div>
          </div>
        </div>
      </header>

      <Suspense fallback={null}>
        <SidebarNav open={menuOpen} onClose={() => setMenuOpen(false)} />
      </Suspense>
    </>
  );
}
