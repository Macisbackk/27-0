"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { HeaderAuthControls } from "./HeaderAuthControls";
import { SidebarNav } from "./SidebarNav";
import { playMenuOpen } from "@/lib/sound";
import { BTN } from "@/lib/ui/design-system";

/** Matches HeaderAuthControls slot width — keeps logo centred on all auth states. */
const HEADER_SIDE_SLOT_CLASS = "w-[7.25rem] sm:w-[8.25rem]";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="app-header sticky top-0 z-50 border-b backdrop-blur-md">
        <div className="mx-auto grid h-14 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-3 sm:h-[3.75rem] sm:px-4">
          <div
            className={`flex min-h-[44px] items-center justify-start ${HEADER_SIDE_SLOT_CLASS}`}
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
            className="flex items-center justify-center px-2 sm:px-3"
            aria-label="27-0 home"
          >
            <span className="whitespace-nowrap text-2xl font-black tracking-tight sm:text-3xl">
              <span className="text-gradient">27</span>
              <span className="text-white">-0</span>
            </span>
          </Link>

          <div
            className={`flex min-h-[44px] items-center justify-end justify-self-end ${HEADER_SIDE_SLOT_CLASS}`}
          >
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
