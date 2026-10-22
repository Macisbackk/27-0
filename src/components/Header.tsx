"use client";

import Link from "next/link";
import { NavProgress } from "@/components/NavProgress";
import { Suspense, useState } from "react";
import { HeaderAuthControls } from "./HeaderAuthControls";
import { LogoMark } from "./LogoMark";
import { SidebarNav } from "./SidebarNav";
import { playMenuOpen } from "@/lib/sound";
import { useMountDiagnostic } from "@/lib/ui/use-mount-diagnostic";

/**
 * Site header: 27-0 logo in the centre, account on the left, menu button on the right
 * (the menu slides in from the right). Club Funds live in the menu and the Store.
 */
export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  useMountDiagnostic("app-header");

  return (
    <>
      <header className="app-header sticky top-0 z-50 overflow-x-clip border-b">
        <NavProgress />
        <div className="app-chrome relative grid h-14 min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4">
          <div className="flex min-w-0 items-center justify-start">
            <HeaderAuthControls />
          </div>

          <Link href="/" className="flex shrink-0 items-center justify-center" aria-label="27-0 home">
            <LogoMark />
          </Link>

          <div className="flex min-w-0 items-center justify-end">
            <button
              type="button"
              onClick={() => {
                playMenuOpen();
                setMenuOpen(true);
              }}
              className="fl-pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-pitch-900 shadow-[inset_0_0_0_1px_var(--fl-line-strong)] text-white transition hover:bg-pitch-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              aria-label="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M5 8h14M5 12h14M5 16h14" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <Suspense fallback={null}>
        <SidebarNav open={menuOpen} onClose={() => setMenuOpen(false)} />
      </Suspense>
    </>
  );
}
