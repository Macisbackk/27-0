"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

const HEADER_BTN =
  "header-control-btn flex h-9 min-w-[4.5rem] items-center justify-center gap-1.5 rounded-lg border border-pitch-600 px-3 text-xs font-medium text-gray-300 transition hover:border-accent-green hover:text-white";

export function HeaderAuthControls() {
  const { loading, isLoggedIn, coachName, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <span className="text-xs text-gray-600" aria-hidden>
        …
      </span>
    );
  }

  if (!isLoggedIn) {
    return (
      <Link href="/login" className={HEADER_BTN}>
        <span className="hidden sm:inline">Log In</span>
        <span className="sm:hidden">Log In</span>
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={HEADER_BTN}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="max-w-[8rem] truncate font-display text-[10px] font-bold uppercase tracking-wider text-accent-green sm:max-w-[10rem] sm:text-xs">
          {coachName}
        </span>
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 min-w-[10rem] rounded-lg border border-pitch-600 bg-pitch-950/95 py-1 shadow-xl"
          >
            <Link
              href="/"
              role="menuitem"
              className="block px-4 py-2 text-xs text-gray-300 transition hover:bg-pitch-800 hover:text-white"
              onClick={() => setOpen(false)}
            >
              Coach Profile
            </Link>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-4 py-2 text-left text-xs text-gray-400 transition hover:bg-pitch-800 hover:text-red-400"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
            >
              Log Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
