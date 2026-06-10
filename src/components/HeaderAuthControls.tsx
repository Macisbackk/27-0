"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { COACH_NAME_MAX_LENGTH } from "@/lib/storage/user";

const HEADER_BTN =
  "header-control-btn flex h-9 min-w-[4.5rem] items-center justify-center gap-1.5 rounded-lg border border-pitch-600 px-3 text-xs font-medium text-gray-300 transition hover:border-accent-green hover:text-white";

export function HeaderAuthControls() {
  const { loading, isLoggedIn, coachName, email, signOut, updateCoachName } =
    useAuth();
  const [open, setOpen] = useState(false);
  const [editingCoach, setEditingCoach] = useState(false);
  const [coachInput, setCoachInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const closeMenu = () => {
    setOpen(false);
    setEditingCoach(false);
    setError(null);
  };

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

  const handleUpdateCoach = async () => {
    setBusy(true);
    setError(null);
    const result = await updateCoachName(coachInput);
    if (!result.ok) {
      setError(result.error ?? "Could not update coach name.");
    } else {
      setEditingCoach(false);
      setCoachInput("");
    }
    setBusy(false);
  };

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
            onClick={closeMenu}
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-[min(16rem,85vw)] rounded-lg border border-pitch-600 bg-pitch-950/95 py-2 shadow-xl"
          >
            <div className="border-b border-pitch-700/50 px-4 py-3">
              <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-accent-green">
                Coach Profile
              </p>
              {!editingCoach ? (
                <>
                  <p className="mt-2 font-display text-sm font-black uppercase text-white">
                    {coachName}
                  </p>
                  <p className="mt-1 truncate text-xs text-gray-500">{email}</p>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={coachInput}
                    onChange={(e) => setCoachInput(e.target.value)}
                    maxLength={COACH_NAME_MAX_LENGTH}
                    className="mt-2 w-full rounded-lg border border-pitch-600 bg-pitch-900/80 px-3 py-2 text-sm text-white outline-none focus:border-accent-green"
                  />
                  {error && (
                    <p className="mt-2 text-xs text-red-400">{error}</p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleUpdateCoach()}
                      className="rounded-lg bg-accent-green px-3 py-1.5 font-display text-[10px] font-bold uppercase text-pitch-950 disabled:opacity-50"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCoach(false);
                        setError(null);
                      }}
                      className="rounded-lg border border-pitch-600 px-3 py-1.5 text-[10px] text-gray-400"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
            {!editingCoach && (
              <button
                type="button"
                role="menuitem"
                className="block w-full px-4 py-2 text-left text-xs text-gray-300 transition hover:bg-pitch-800 hover:text-white"
                onClick={() => {
                  setCoachInput(coachName ?? "");
                  setEditingCoach(true);
                  setError(null);
                }}
              >
                Change Coach Name
              </button>
            )}
            <button
              type="button"
              role="menuitem"
              className="block w-full px-4 py-2 text-left text-xs text-gray-400 transition hover:bg-pitch-800 hover:text-red-400"
              onClick={() => {
                closeMenu();
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
