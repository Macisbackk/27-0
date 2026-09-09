"use client";

import { GameButton } from "@/components/ui/GameButton";
import { GameModal } from "@/components/ui/GameModal";
import { formatClubFundsExact } from "@/lib/club-funds";
import { playUiClick } from "@/lib/sound";
import { TYPO } from "@/lib/ui/typography";

export type MiniGameRewardPopupProps = {
  open: boolean;
  amount: number;
  title?: string;
  detail?: string;
  onClose: () => void;
};

/** Win payout toast for Mini Games — keep reward chrome off the play surface. */
export function MiniGameRewardPopup({
  open,
  amount,
  title = "Club Funds",
  detail,
  onClose,
}: MiniGameRewardPopupProps) {
  return (
    <GameModal open={open} onClose={onClose} labelledBy="mini-reward-title">
      <div className="space-y-4 text-center">
        <p className={TYPO.sectionLabel}>{title}</p>
        <h2 id="mini-reward-title" className={TYPO.pageTitle}>
          +{formatClubFundsExact(amount)}
        </h2>
        {detail ? <p className={TYPO.bodySm}>{detail}</p> : null}
        <div className="mx-auto max-w-xs">
          <GameButton
            variant="theme"
            onClick={() => {
              playUiClick();
              onClose();
            }}
          >
            Nice
          </GameButton>
        </div>
      </div>
    </GameModal>
  );
}
