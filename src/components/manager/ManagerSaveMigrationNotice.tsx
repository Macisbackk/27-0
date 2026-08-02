"use client";

import { managerAlertPanelClass } from "@/lib/manager/managerSurfaces";
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
        trophies, attendance).
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
