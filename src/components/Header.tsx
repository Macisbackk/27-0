"use client";

import Link from "next/link";
import { useState } from "react";
import { HeaderAuthControls } from "./HeaderAuthControls";
import { SidebarNav } from "./SidebarNav";

const HEADER_BTN =
  "header-control-btn flex h-9 min-w-[5.5rem] items-center justify-center gap-1.5 rounded-lg border border-pitch-600 px-3 text-xs font-medium text-gray-300 transition hover:border-accent-green hover:text-white";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header className="app-header sticky top-0 z-50 border-b backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className={`${HEADER_BTN} shrink-0`}
            aria-label="Open menu"
          >
            <span aria-hidden className="text-sm leading-none">
              ☰
            </span>
            <span className="hidden sm:inline">Menu</span>
          </button>

          <Link
            href="/"
            className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:justify-start sm:flex-none"
          >
            <span className="text-xl font-black tracking-tight sm:text-2xl">
              <span className="text-gradient">27</span>
              <span className="text-white">-0</span>
            </span>
          </Link>

          <div className="ml-auto shrink-0">
            <HeaderAuthControls />
          </div>
        </div>
      </header>

      <SidebarNav open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
