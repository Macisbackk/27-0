"use client";

import Link from "next/link";
import { useState } from "react";
import { HeaderAuthControls } from "./HeaderAuthControls";
import { SidebarNav } from "./SidebarNav";
import { SoundToggle } from "./SoundToggle";
import { playMenuOpen } from "@/lib/sound";

const HEADER_BTN =
  "header-control-btn flex h-9 min-w-[5.5rem] items-center justify-center gap-1.5 rounded-lg border border-pitch-600 px-3 text-xs font-medium text-gray-300 transition hover:border-accent-green hover:text-white";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="app-header sticky top-0 z-50 border-b backdrop-blur-md">
        <div className="mx-auto grid max-w-6xl grid-cols-[auto_1fr_auto] items-center gap-2 px-4 py-3 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              playMenuOpen();
              setMenuOpen(true);
            }}
            className={`${HEADER_BTN} shrink-0 justify-self-start`}
            aria-label="Open menu"
          >
            <span aria-hidden className="text-sm leading-none">
              ☰
            </span>
            <span className="hidden sm:inline">Menu</span>
          </button>

          <Link
            href="/"
            className="flex min-w-0 items-center justify-center justify-self-center gap-2 px-1"
            aria-label="27-0 home"
          >
            <span className="truncate text-xl font-black tracking-tight sm:text-2xl">
              <span className="text-gradient">27</span>
              <span className="text-white">-0</span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center justify-end gap-2 justify-self-end">
            <SoundToggle />
            <HeaderAuthControls />
          </div>
        </div>
      </header>

      <SidebarNav open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
