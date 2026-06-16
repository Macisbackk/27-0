"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { ClubFundsDisplay } from "./ClubFundsDisplay";
import { HeaderAuthControls } from "./HeaderAuthControls";
import { SidebarNav } from "./SidebarNav";
import { playMenuOpen } from "@/lib/sound";
import { BTN } from "@/lib/ui/design-system";

const HEADER_SIDE_SLOT_CLASS = "w-[7.25rem] sm:w-[8.25rem]";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="app-header sticky top-0 z-50 border-b backdrop-blur-md">
        <div className="relative mx-auto flex h-14 max-w-6xl items-center justify-between px-3 sm:h-[3.75rem] sm:px-4">
          <div
            className={`z-10 flex min-h-[44px] items-center justify-start ${HEADER_SIDE_SLOT_CLASS}`}
          >
            <button
              type="button"
              onClick={() => {
                playMenuOpen();
                setMenuOpen(true);
              }}
              className={`${BTN.header} h-11 min-h-[44px] w-full justify-center px-2 sm:px-4`}
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
            className="pointer-events-auto absolute left-1/2 top-1/2 z-0 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center px-2 sm:px-3"
            aria-label="27-0 home"
          >
            <span className="whitespace-nowrap text-2xl font-black tracking-tight sm:text-3xl">
              <span className="text-gradient">27</span>
              <span className="text-white">-0</span>
            </span>
          </Link>

          <div className="z-10 flex min-h-[44px] min-w-0 items-center justify-end gap-1 sm:gap-2">
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
