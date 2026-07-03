"use client";

import Link from "next/link";
import { CARD, LINK, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { playUiClick } from "@/lib/sound";
import { acknowledgeSaveMigration } from "@/lib/manager/managerSaveMigration";

interface ManagerSaveMigrationNoticeProps {
  onDismiss: () => void;
}

export function ManagerSaveMigrationNotice({
  onDismiss,
}: ManagerSaveMigrationNoticeProps) {
  return (
    <div
      className={`${CARD.base} ${SPACING.cardPaddingSm} border border-theme-primary/40 bg-theme-primary/5`}
    >
      <p className={`${TYPO.bodySm} text-pitch-200`}>
        Your career save was updated for the latest Manager rules (reserves,
        trophies, attendance).{" "}
        <Link
          href="/updates"
          className={LINK.subtle}
          onClick={() => playUiClick()}
        >
          See what changed →
        </Link>
      </p>
      <button
        type="button"
        className={`mt-2 ${TYPO.bodySm} text-pitch-400 underline`}
        onClick={() => {
          playUiClick();
          acknowledgeSaveMigration();
          onDismiss();
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
