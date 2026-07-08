"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ClubDualSwatch } from "@/components/ClubDualSwatch";
import { GameButton } from "@/components/ui/GameButton";
import { ManagerDialog } from "@/components/manager/ManagerDialog";
import { useAuth } from "@/lib/auth-context";
import { getClubColors } from "@/lib/clubs";
import type { ManagerSaveSlotSummary } from "@/lib/manager/managerState";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { playSeasonStart, playUiClick } from "@/lib/sound";

interface ManagerLandingProps {
  saveSlots: ManagerSaveSlotSummary[];
  onStartNew: (slot: number) => void;
  onContinue: (slot: number) => void;
  onDelete: (slot: number) => void;
  onExport?: (slot: number) => void;
  onImport?: (slot: number, file: File) => void;
  importMessage?: string | null;
}

function formatSlotMeta(slot: ManagerSaveSlotSummary): string {
  if (!slot.occupied || slot.seasonYear == null) return "Empty slot";
  const week = slot.gameWeek ?? 0;
  return `Season ${slot.seasonYear} · Week ${week}`;
}

export function ManagerLanding({
  saveSlots,
  onStartNew,
  onContinue,
  onDelete,
  onExport,
  onImport,
  importMessage,
}: ManagerLandingProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const [importSlot, setImportSlot] = useState<number | null>(null);
  const [signInPromptSlot, setSignInPromptSlot] = useState<number | null>(null);
  const { isLoggedIn, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const loginHref = `/login?redirect=${encodeURIComponent(pathname || "/manager")}`;

  const requestNewCareer = (slot: number) => {
    playSeasonStart();
    playUiClick();
    if (!loading && !isLoggedIn) {
      setSignInPromptSlot(slot);
      return;
    }
    onStartNew(slot);
  };

  return (
    <div className={`mx-auto max-w-lg ${SPACING.stackLg}`}>
      <div
        className={`${CARD.hero} ${CARD.featured} ${SPACING.cardPaddingLg} text-center`}
      >
        <p className={TYPO.sectionLabel}>Career Mode</p>
        <h1 className={`mt-2 ${TYPO.pageTitle}`}>Manager Mode</h1>
        <p className={`mt-3 ${TYPO.body} text-pitch-300`}>
          Take charge of a{" "}
          <span className="font-semibold text-theme-primary">Super League</span>{" "}
          club. Up to three careers —{" "}
          {isLoggedIn
            ? "synced to your account across devices."
            : "sign in to sync saves across devices."}
        </p>
      </div>

      {importMessage && (
        <p className={`${TYPO.bodySm} text-theme-primary`}>{importMessage}</p>
      )}

      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && importSlot != null && onImport) {
            onImport(importSlot, file);
          }
          e.target.value = "";
          setImportSlot(null);
        }}
      />

      <div className={SPACING.stackMd}>
        {saveSlots.map((slot) => {
          const colors = slot.club ? getClubColors(slot.club) : null;

          return (
            <div
              key={slot.slot}
              className={`${CARD.base} ${SPACING.cardPaddingSm} ${SPACING.stackSm}`}
            >
              <div className="flex items-start gap-3">
                {slot.occupied && slot.club && colors ? (
                  <ClubDualSwatch
                    club={slot.club}
                    size="md"
                    primary={colors.primary}
                    secondary={colors.secondary}
                    className="mt-0.5 shrink-0"
                  />
                ) : (
                  <div
                    className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-dashed border-pitch-600/70 bg-pitch-950/60 text-xs font-semibold text-pitch-500"
                    aria-hidden
                  >
                    {slot.slot + 1}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className={TYPO.sectionLabel}>Save {slot.slot + 1}</p>
                  <p className="truncate text-sm font-semibold text-white">
                    {slot.occupied && slot.club ? slot.club : "Empty slot"}
                  </p>
                  <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-400`}>
                    {formatSlotMeta(slot)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {slot.occupied ? (
                  <>
                    <GameButton
                      variant="theme"
                      size="sm"
                      onClick={() => {
                        playUiClick();
                        onContinue(slot.slot);
                      }}
                    >
                      Continue
                    </GameButton>
                    <GameButton
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        playUiClick();
                        onDelete(slot.slot);
                      }}
                    >
                      Delete
                    </GameButton>
                    {onExport && (
                      <GameButton
                        variant="secondary"
                        size="sm"
                        className="col-span-2"
                        onClick={() => {
                          playUiClick();
                          onExport(slot.slot);
                        }}
                      >
                        Export save
                      </GameButton>
                    )}
                  </>
                ) : (
                  <>
                    <GameButton
                      variant="theme"
                      className="col-span-2"
                      onClick={() => requestNewCareer(slot.slot)}
                    >
                      New Career
                    </GameButton>
                    {onImport && (
                      <GameButton
                        variant="secondary"
                        size="sm"
                        className="col-span-2"
                        onClick={() => {
                          playUiClick();
                          setImportSlot(slot.slot);
                          importRef.current?.click();
                        }}
                      >
                        Import save
                      </GameButton>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className={`text-center ${TYPO.bodySm} text-pitch-500`}>
        {!loading &&
          (isLoggedIn
            ? "Careers auto-save to your account when you play. Export for an extra backup."
            : "Sign in to keep careers on your account — otherwise they only live in this browser.")}{" "}
        <a href="/updates" className="text-theme-primary underline">
          See updates
        </a>
      </p>

      <ManagerDialog
        open={signInPromptSlot != null}
        title="Sign in to save"
        message={
          "Manager careers sync to your account when you're signed in — " +
          "so your save follows you across devices and won't be lost if the browser clears storage.\n\n" +
          "You can still play as a guest, but the career will only live on this device."
        }
        variant="confirm"
        confirmLabel="Sign in"
        cancelLabel="Continue as guest"
        onConfirm={() => {
          setSignInPromptSlot(null);
          router.push(loginHref);
        }}
        onCancel={() => {
          const slot = signInPromptSlot;
          setSignInPromptSlot(null);
          if (slot != null) onStartNew(slot);
        }}
      />
    </div>
  );
}
