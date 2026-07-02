"use client";

import { ClubDualSwatch } from "@/components/ClubDualSwatch";
import { GameButton } from "@/components/ui/GameButton";
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
}: ManagerLandingProps) {
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
          club. Up to four careers can be saved on this device.
        </p>
      </div>

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
                  </>
                ) : (
                  <GameButton
                    variant="theme"
                    className="col-span-2"
                    onClick={() => {
                      playSeasonStart();
                      playUiClick();
                      onStartNew(slot.slot);
                    }}
                  >
                    New Career
                  </GameButton>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
