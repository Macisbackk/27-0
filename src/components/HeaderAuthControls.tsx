"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { COACH_NAME_MAX_LENGTH } from "@/lib/storage/user";
import { BTN, CARD, FILTER, NAV, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

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
      <span className={TYPO.bodySm} aria-hidden>
        …
      </span>
    );
  }

  const authButtonClass = `${BTN.header} min-w-[6.75rem] justify-center sm:min-w-[8.25rem]`;

  if (!isLoggedIn) {
    return (
      <Link href="/login" className={authButtonClass}>
        Log In
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
        className={authButtonClass}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Coach Profile"
      >
        <span className="truncate">Coach Profile</span>
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
            className={`absolute right-0 z-50 mt-2 w-[min(16rem,85vw)] ${CARD.base} py-2 shadow-xl`}
          >
            <div className="border-b border-pitch-700/50 px-4 py-4">
              <p className={TYPO.sectionTitle}>Coach Profile</p>
              {!editingCoach ? (
                <>
                  <p className={`mt-2 ${TYPO.cardTitle}`}>{coachName}</p>
                  <p className={`mt-1 truncate ${TYPO.bodySm}`}>{email}</p>
                </>
              ) : (
                <>
                  <input
                    type="text"
                    value={coachInput}
                    onChange={(e) => setCoachInput(e.target.value)}
                    maxLength={COACH_NAME_MAX_LENGTH}
                    className={`mt-2 ${FILTER.input}`}
                  />
                  {error && (
                    <p className={`mt-2 ${TYPO.bodySm} text-red-400`}>{error}</p>
                  )}
                  <div className={`mt-2 flex ${SPACING.buttonGap}`}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleUpdateCoach()}
                      className={`${BTN.base} ${BTN.primary} !min-h-[36px] px-3 py-1.5 text-[10px]`}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCoach(false);
                        setError(null);
                      }}
                      className={`${BTN.base} ${BTN.secondary} !min-h-[36px] px-3 py-1.5 text-[10px]`}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
            {!editingCoach && (
              <div className={NAV.menuActions}>
                <button
                  type="button"
                  role="menuitem"
                  className={NAV.menuItem}
                  onClick={() => {
                    setCoachInput(coachName ?? "");
                    setEditingCoach(true);
                    setError(null);
                  }}
                >
                  Change Coach Name
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={NAV.menuItemDanger}
                  onClick={() => {
                    closeMenu();
                    void signOut();
                  }}
                >
                  Log Out
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
