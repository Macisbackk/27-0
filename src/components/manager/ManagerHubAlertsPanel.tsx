"use client";

import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { HubAlert } from "@/lib/manager/managerHubAlerts";
import type { ManagerView } from "@/lib/manager/types";
import { managerCalloutClass } from "@/lib/manager/managerSurfaces";
import { playUiClick } from "@/lib/sound";

interface ManagerHubAlertsPanelProps {
  alerts: HubAlert[];
  onNavigate?: (view: ManagerView) => void;
}

export function ManagerHubAlertsPanel({
  alerts,
  onNavigate,
}: ManagerHubAlertsPanelProps) {
  if (alerts.length === 0) return null;

  return (
    <div className={`${CARD.base} ${SPACING.cardPadding} space-y-2`}>
      <p className={TYPO.sectionLabel}>Club priorities</p>
      {alerts.map((alert) => (
        <div key={alert.id} className={managerCalloutClass(alert.tone)}>
          <p className="text-sm font-semibold text-white">{alert.title}</p>
          <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-300`}>{alert.body}</p>
          {alert.actionLabel && alert.actionView && onNavigate && (
            <GameButton
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() => {
                playUiClick();
                onNavigate(alert.actionView!);
              }}
            >
              {alert.actionLabel}
            </GameButton>
          )}
        </div>
      ))}
    </div>
  );
}
