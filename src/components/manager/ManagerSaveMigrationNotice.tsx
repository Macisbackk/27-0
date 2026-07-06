"use client";

import Link from "next/link";
import { managerAlertPanelClass } from "@/lib/manager/managerSurfaces";
import { LINK, SPACING } from "@/lib/ui/design-system";
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
    <div className={managerAlertPanelClass("primary")}>
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
