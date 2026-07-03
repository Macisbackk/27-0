"use client";

import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { playUiClick } from "@/lib/sound";

interface EconomyExplainerProps {
  compact?: boolean;
}

export function EconomyExplainer({ compact = false }: EconomyExplainerProps) {
  return (
    <div
      className={`${compact ? CARD.inset : CARD.base} ${SPACING.cardPaddingSm} text-left`}
    >
      <p className={TYPO.sectionLabel}>Two economies</p>
      <ul className={`mt-2 ${SPACING.stackSm} ${TYPO.bodySm} text-pitch-300`}>
        <li>
          <span className="font-semibold text-accent-gold">Club funds</span> — earned
          in Quick Mode, spent in the Store on UI themes. Syncs online when logged in.
        </li>
        <li>
          <span className="font-semibold text-theme-primary">Manager finances</span>{" "}
          — transfer budget, wages, and gate receipts inside your career save only.
        </li>
      </ul>
    </div>
  );
}

interface QuickToManagerBridgeProps {
  clubName?: string;
}

export function QuickToManagerBridge({ clubName }: QuickToManagerBridgeProps) {
  return (
    <div
      className={`${CARD.elevated} ${SPACING.cardPadding} border-l-4 border-theme-primary text-center`}
    >
      <p className={TYPO.sectionLabel}>Ready for the dugout?</p>
      <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>
        {clubName
          ? `Liked ${clubName}? Take charge in a full Manager career.`
          : "Build a squad in Quick Mode, then run a full season as gaffer in Manager Mode."}
      </p>
      <GameButton
        variant="theme"
        href="/manager"
        className="mt-4"
        onClick={() => playUiClick()}
      >
        Start Manager Mode
      </GameButton>
    </div>
  );
}

interface GuestSaveNudgeProps {
  context: "manager-season" | "quick-season";
}

export function GuestSaveNudge({ context }: GuestSaveNudgeProps) {
  return (
    <div
      className={`${CARD.base} ${SPACING.cardPaddingSm} border border-amber-400/30 bg-amber-500/5`}
    >
      <p className={`${TYPO.bodySm} text-amber-100`}>
        {context === "manager-season"
          ? "Careers are saved on this device only. Create an account to sync stats and leaderboards, and export your save from the Manager landing screen."
          : "Sign in to sync stats and leaderboard entries across devices."}
      </p>
      <GameButton variant="secondary" size="sm" href="/login" className="mt-2">
        Sign in
      </GameButton>
    </div>
  );
}
