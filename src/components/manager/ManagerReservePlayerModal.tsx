"use client";

import { useCallback } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { GameModal } from "@/components/ui/GameModal";
import { SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import { ManagerStat } from "@/components/manager/manager-ui";
import { managerModalHeaderClass } from "@/lib/manager/managerSurfaces";
import type { ReserveCardModel } from "@/lib/manager/managerReserveCard";
import { playPanelClose, playUiClick } from "@/lib/sound";

interface ManagerReservePlayerModalProps {
  model: ReserveCardModel;
  /** Pre-formatted renewal cost, only when a renewal is due. */
  renewalLabel: string | null;
  onClose: () => void;
  onCallUp: (id: string) => void;
  onRenew: (id: string) => void;
  onRelease: (id: string) => void;
}

/**
 * Secondary reserve information lives here so the card itself keeps a fixed
 * set of rows. Release is deliberately only reachable from this popup.
 */
export function ManagerReservePlayerModal({
  model,
  renewalLabel,
  onClose,
  onCallUp,
  onRenew,
  onRelease,
}: ManagerReservePlayerModalProps) {
  const handleClose = useCallback(() => {
    playPanelClose();
    onClose();
  }, [onClose]);

  const panelRef = useModalA11y(true, handleClose);
  const { development, contract } = model;

  return (
    <GameModal
      open
      onClose={handleClose}
      labelledBy="reserve-player-title"
      panelRef={panelRef}
    >
      <div className={managerModalHeaderClass("primary")}>
        <h2 id="reserve-player-title" className={TYPO.cardTitle}>
          {model.name}
        </h2>
        <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-400`}>
          {model.metaLine}
        </p>
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-300`}>
          {model.squadStatusLabel} · {model.lineupStatusLabel}
        </p>
      </div>

      <div className={SPACING.stackSm}>
        <div className="grid grid-cols-2 gap-3">
          <ManagerStat
            label="Current Rating"
            value={String(model.currentRating)}
            tone="primary"
          />
          <ManagerStat
            label="Potential"
            value={String(model.potential)}
            tone="gold"
          />
          <ManagerStat
            label="Rating when signed"
            value={String(model.signedRating)}
            tone="muted"
          />
          <ManagerStat
            label="Growth since signing"
            value={development.growthLabel}
            tone={development.growthDelta > 0 ? "primary" : "default"}
          />
          <ManagerStat
            label="Reserve apps"
            value={String(model.reserveAppearances)}
            tone="default"
          />
          <ManagerStat
            label="Reserve tries"
            value={String(model.reserveTries)}
            tone="default"
          />
          <ManagerStat
            label="Form"
            value={String(Math.round(model.form))}
            tone="default"
          />
          <ManagerStat
            label="Fitness"
            value={`${Math.round(model.fitness)}%`}
            tone="default"
          />
        </div>

        <div>
          <p className={TYPO.sectionLabel}>Development</p>
          <p className={`mt-1 ${TYPO.bodySm} text-pitch-300`}>
            {development.trainingLabel
              ? `Position programme ${development.trainingLabel} — ${development.trainingProgressPercent}% complete.`
              : development.potentialReached
                ? "This player has reached their potential ceiling."
                : "No active position programme."}
          </p>
        </div>

        <div>
          <p className={TYPO.sectionLabel}>Contract</p>
          <p className={`mt-1 ${TYPO.bodySm} text-pitch-300`}>
            {contract.expiryLabel}
            {contract.wageLabel ? ` · ${contract.wageLabel}` : ""}
            {` · Estimated value ${contract.valueLabel}`}
          </p>
          {contract.renewalStatusLabel && (
            <p className={`mt-1 ${TYPO.bodySm} text-accent-gold`}>
              {contract.renewalStatusLabel}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <GameButton
            variant="theme"
            disabled={!model.canCallUp}
            onClick={() => {
              playUiClick();
              onCallUp(model.id);
            }}
          >
            {model.canCallUp ? "Add to Matchday Squad" : "Already called up"}
          </GameButton>

          {renewalLabel && (
            <GameButton
              variant="secondary"
              onClick={() => {
                playUiClick();
                onRenew(model.id);
              }}
            >
              Renew Contract ({renewalLabel})
            </GameButton>
          )}

          <GameButton variant="secondary" onClick={handleClose}>
            Close
          </GameButton>

          <GameButton
            variant="danger"
            onClick={() => {
              playUiClick();
              onRelease(model.id);
            }}
          >
            Release Player
          </GameButton>
        </div>
      </div>
    </GameModal>
  );
}
