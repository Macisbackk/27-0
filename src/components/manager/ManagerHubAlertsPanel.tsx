"use client";

import { ManagerSectionCard } from "@/components/manager/manager-ui";
import { TYPO } from "@/lib/ui/typography";
import type { HubAlert, HubAlertTone } from "@/lib/manager/managerHubAlerts";
import type { ManagerView } from "@/lib/manager/types";
import { playUiClick } from "@/lib/sound";

interface ManagerHubAlertsPanelProps {
  alerts: HubAlert[];
  onNavigate?: (view: ManagerView) => void;
}

const TONE_ACCENT: Record<HubAlertTone, string> = {
  primary: "bg-theme-primary",
  gold: "bg-accent-gold",
  amber: "bg-amber-400",
  red: "bg-red-400",
};

const TONE_ACTION: Record<HubAlertTone, string> = {
  primary: "text-theme-primary",
  gold: "text-accent-gold",
  amber: "text-amber-300",
  red: "text-red-300",
};

function HubAlertRow({
  alert,
  onNavigate,
}: {
  alert: HubAlert;
  onNavigate?: (view: ManagerView) => void;
}) {
  const canAct =
    Boolean(alert.actionLabel && alert.actionView && onNavigate);

  const content = (
    <>
      <span
        className={`mt-0.5 h-9 w-1 shrink-0 rounded-full ${TONE_ACCENT[alert.tone]}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-white">
          {alert.title}
        </p>
        <p className={`mt-0.5 line-clamp-2 ${TYPO.bodySm} text-pitch-400`}>
          {alert.body}
        </p>
        {canAct && (
          <p
            className={`mt-1.5 text-xs font-semibold uppercase tracking-wide ${TONE_ACTION[alert.tone]}`}
          >
            {alert.actionLabel} →
          </p>
        )}
      </div>
    </>
  );

  if (!canAct) {
    return (
      <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
        {content}
      </li>
    );
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          playUiClick();
          onNavigate!(alert.actionView!);
        }}
        className="btn-press flex w-full items-start gap-3 rounded-lg py-3 text-left transition hover:bg-pitch-900/40"
      >
        {content}
      </button>
    </li>
  );
}

export function ManagerHubAlertsPanel({
  alerts,
  onNavigate,
}: ManagerHubAlertsPanelProps) {
  if (alerts.length === 0) return null;

  return (
    <ManagerSectionCard title="Club priorities" variant="inset">
      <ul className="-mx-1 mt-2 divide-y divide-pitch-800/70" role="list">
        {alerts.map((alert) => (
          <HubAlertRow key={alert.id} alert={alert} onNavigate={onNavigate} />
        ))}
      </ul>
    </ManagerSectionCard>
  );
}
