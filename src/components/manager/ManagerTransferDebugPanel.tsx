/**
 * Dev-only transfer registration diagnostics (not shown in player chrome).
 * Enable with ?transferDebug=playerId on a manager URL while NODE_ENV=development.
 */
"use client";

import { useMemo } from "react";
import type { ManagerCareer } from "@/lib/manager/types";
import { getPlayerRegistration } from "@/lib/manager/playerRegistration";
import { assertSingleTransferState } from "@/lib/manager/transferInvariants";
import { getTransferEligibility } from "@/lib/manager/transferEligibility";
import { TYPO } from "@/lib/ui/typography";

interface ManagerTransferDebugPanelProps {
  career: ManagerCareer;
  playerId: string;
}

export function ManagerTransferDebugPanel({
  career,
  playerId,
}: ManagerTransferDebugPanelProps) {
  const registration = useMemo(
    () => getPlayerRegistration(career, playerId),
    [career, playerId]
  );
  const invariant = useMemo(
    () => assertSingleTransferState(career, playerId),
    [career, playerId]
  );
  const offers = career.inboxMessages.filter(
    (m) => !m.resolved && m.playerId === playerId
  );

  if (process.env.NODE_ENV === "production") return null;

  return (
    <aside className="mt-4 rounded-lg border border-dashed border-amber-500/40 bg-pitch-950/80 p-3 text-left">
      <p className={`${TYPO.keyLabel} text-amber-300`}>Transfer debug</p>
      <p className={`mt-1 ${TYPO.bodySm} text-pitch-300`}>
        Player {playerId}
      </p>
      <pre className={`mt-2 overflow-x-auto ${TYPO.meta} text-pitch-400`}>
        {JSON.stringify(registration, null, 2)}
      </pre>
      <p className={`mt-2 ${TYPO.bodySm}`}>
        {invariant.valid ? (
          <span className="text-theme-primary">VALID STATE: ✓</span>
        ) : (
          <span className="text-red-400">
            INVALID STATE: ✕ {invariant.violations.join("; ")}
          </span>
        )}
      </p>
      <p className={`mt-2 ${TYPO.meta} text-pitch-500`}>
        Buy eligible:{" "}
        {getTransferEligibility(career, playerId, "permanent_buy").allowed
          ? "yes"
          : getTransferEligibility(career, playerId, "permanent_buy").reason}
      </p>
      <p className={`${TYPO.meta} text-pitch-500`}>
        Open offers: {offers.length}
      </p>
    </aside>
  );
}
