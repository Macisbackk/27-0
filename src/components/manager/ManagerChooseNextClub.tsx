"use client";

import { useMemo, useState } from "react";
import { ClubDualSwatch } from "@/components/ClubDualSwatch";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { formatSquadRatingStars } from "@/lib/manager/club-config";
import { listContinuationClubs } from "@/lib/manager/managerClubChange";
import type { ManagerCareer } from "@/lib/manager/types";
import { playUiClick } from "@/lib/sound";
import {
  ManagerInfoRow,
  ManagerSectionCard,
} from "@/components/manager/manager-ui";

interface ManagerChooseNextClubProps {
  career: ManagerCareer;
  onTakeOver: (club: string) => void;
  onBack: () => void;
  busy?: boolean;
}

export function ManagerChooseNextClub({
  career,
  onTakeOver,
  onBack,
  busy = false,
}: ManagerChooseNextClubProps) {
  const clubs = useMemo(() => listContinuationClubs(career), [career]);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedClub = clubs.find((c) => c.club === selected);

  return (
    <div className={`mx-auto max-w-lg ${SPACING.stackLg}`}>
      <GameButton variant="secondary" fullWidth={false} size="sm" onClick={onBack}>
        Back
      </GameButton>

      <ManagerSectionCard variant="featured">
        <p className={`${TYPO.sectionLabel} text-center`}>New Opportunity</p>
        <h1 className={`mt-2 text-center ${TYPO.pageTitle}`}>Choose Your Next Club</h1>
        <p className={`mt-2 text-center ${TYPO.bodySm} text-pitch-300`}>
          The {career.club} board have released you. Take over another Super League
          club and continue your career in season {career.seasonYear}.
        </p>
      </ManagerSectionCard>

      <ul className={`${SPACING.stackSm}`}>
        {clubs.map((club) => (
          <li key={club.club}>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                playUiClick();
                setSelected(club.club);
                setConfirmOpen(true);
              }}
              className={`${CARD.base} ${CARD.interactive} flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left sm:gap-3 sm:px-3 disabled:pointer-events-none disabled:opacity-50`}
            >
              <span
                className="w-1 shrink-0 self-stretch rounded-full"
                style={{ backgroundColor: club.primaryColor }}
                aria-hidden
              />
              <ClubDualSwatch
                club={club.club}
                size="md"
                primary={club.primaryColor}
                secondary={club.secondaryColor}
                className="hidden sm:flex"
              />
              <ClubDualSwatch
                club={club.club}
                size="sm"
                primary={club.primaryColor}
                secondary={club.secondaryColor}
                className="sm:hidden"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-white">
                    {club.club}
                  </p>
                  <span className="shrink-0 font-mono text-[11px] tracking-wide text-accent-gold">
                    {formatSquadRatingStars(club.difficulty)}
                  </span>
                </div>
                <p className="truncate text-xs text-pitch-400">
                  {club.boardExpectation}
                  <span className="text-pitch-600"> · </span>
                  Table {club.position}
                  <span className="text-pitch-600"> · </span>
                  £{(club.budget / 1000).toFixed(0)}k
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold leading-none text-theme-primary">
                  {club.squadRating}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-pitch-500">
                  OVR
                </p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {confirmOpen && selectedClub && (
        <ManagerSectionCard title="Confirm Take Over" accent="primary">
          <p className={`${TYPO.bodySm} text-pitch-300`}>
            Take over {selectedClub.club}? You will inherit their current squad and
            remaining season {career.seasonYear} fixtures.
          </p>
          <div className={`mt-3 ${SPACING.stackMd}`}>
            <ManagerInfoRow label="Board target" value={selectedClub.boardExpectation} />
            <ManagerInfoRow label="Squad OVR" value={`${selectedClub.squadRating}`} tone="primary" />
            <ManagerInfoRow
              label="Transfer pool"
              value={`£${selectedClub.budget.toLocaleString()}`}
              tone="gold"
            />
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <GameButton
              variant="theme"
              disabled={busy}
              onClick={() => {
                playUiClick();
                onTakeOver(selectedClub.club);
              }}
            >
              Confirm Take Over Club
            </GameButton>
            <GameButton
              variant="secondary"
              disabled={busy}
              onClick={() => {
                playUiClick();
                setConfirmOpen(false);
                setSelected(null);
              }}
            >
              Cancel
            </GameButton>
          </div>
        </ManagerSectionCard>
      )}
    </div>
  );
}
