"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { usePathname } from "next/navigation";
import { ClubFundsDisplay } from "./ClubFundsDisplay";
import { HeaderAuthControls } from "./HeaderAuthControls";
import { LogoMark } from "./LogoMark";
import { SidebarNav } from "./SidebarNav";
import { playMenuOpen } from "@/lib/sound";
import { useMountDiagnostic } from "@/lib/ui/use-mount-diagnostic";

/**
 * Site header (Floodlights): logo left; Club Funds, account and the menu button right.
 * Manager Mode hides Quick Mode club funds (Manager has its own balance).
 */
export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const hidePlayFunds = pathname?.startsWith("/manager");
  useMountDiagnostic("app-header");

  return (
    <>
      <header className="app-header sticky top-0 z-50 overflow-x-clip border-b">
        <div className="app-chrome relative flex h-14 min-w-0 items-center justify-between gap-2 px-4">
          <Link href="/" className="flex shrink-0 items-center" aria-label="27-0 home">
            <LogoMark />
          </Link>

          <div className="flex min-w-0 items-center justify-end gap-2">
            {!hidePlayFunds && <ClubFundsDisplay />}
            <HeaderAuthControls />
            <button
              type="button"
              onClick={() => {
                playMenuOpen();
                setMenuOpen(true);
              }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-pitch-900 text-white transition hover:bg-pitch-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
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
