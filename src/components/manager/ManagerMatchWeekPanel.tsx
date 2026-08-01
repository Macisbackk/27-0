"use client";

import type { ManagerCareer, ManagerScheduledFixture } from "@/lib/manager/types";
import {
  getMatchWeekPanelInfo,
  type MatchWeekPhase,
} from "@/lib/manager/managerMatchWeek";
import {
  getManagerCompetitionLabel,
  getManagerScheduledFixtureVenueLabel,
} from "@/lib/manager/managerFixtureDisplay";
import {
  ManagerSectionCard,
  ManagerStat,
  ManagerStatGrid,
} from "@/components/manager/manager-ui";
import { GameButton } from "@/components/ui/GameButton";
import { TYPO } from "@/lib/ui/typography";

interface ManagerMatchWeekPanelProps {
  career: ManagerCareer;
  nextFixture: ManagerScheduledFixture | null;
  processing?: boolean;
  compact?: boolean;
  onAdvance: () => void;
  onPlay?: () => void;
  onSeasonComplete?: () => void;
}

function resultTone(result: "W" | "L" | "D"): "primary" | "gold" | "muted" | "default" {
  if (result === "W") return "primary";
  if (result === "L") return "gold";
  return "muted";
}

export function ManagerMatchWeekPanel({
  career,
  nextFixture,
  processing = false,
  compact = false,
  onAdvance,
  onPlay,
  onSeasonComplete,
}: ManagerMatchWeekPanelProps) {
  const info = getMatchWeekPanelInfo(career, {
    processing,
    nextFixture,
  });
  const phase: MatchWeekPhase = info.phase;

  const handlePrimary = () => {
    if (processing) return;
    if (phase === "awaiting_advance") onAdvance();
    else if (phase === "season_complete") onSeasonComplete?.();
    else onPlay?.();
  };

  const primaryDisabled =
    processing ||
    (phase === "awaiting_advance" && !info.canAdvance) ||
    (phase === "ready_to_play" && !onPlay);

  return (
    <ManagerSectionCard
      title="Match Week"
      variant="elevated"
      accent="primary"
      className={compact ? "space-y-3" : "space-y-4"}
    >
      <ManagerStatGrid cols={compact ? 2 : 4} className="text-sm">
        <ManagerStat
          label="Current week"
          value={`${info.currentWeek}/${info.seasonGames || "—"}`}
          tone="primary"
        />
        {info.lastResult ? (
          <ManagerStat
            label="Last result"
            value={`${info.lastResult.result} ${info.lastResult.pointsFor}–${info.lastResult.pointsAgainst}`}
            tone={resultTone(info.lastResult.result)}
          />
        ) : (
          <ManagerStat label="Last result" value="—" tone="muted" />
        )}
        {!compact && info.lastResult?.opponent ? (
          <ManagerStat
            label="Last opponent"
            value={info.lastResult.opponent}
            tone="default"
          />
        ) : null}
        {!compact ? (
          <ManagerStat
            label="Inbox"
            value={String(info.unreadInboxCount)}
            tone={info.unreadInboxCount > 0 ? "gold" : "muted"}
          />
        ) : null}
      </ManagerStatGrid>

      {info.lastResult && !compact ? (
        <p className={`${TYPO.bodySm} text-pitch-400`}>
          Recent: {info.lastResult.opponent}
          {info.lastResult.competition
            ? ` · ${getManagerCompetitionLabel(
                info.lastResult.competition as ManagerCareer["fixtures"][number]["competition"] &
                  string
              )}`
            : ""}
        </p>
      ) : null}

      {nextFixture ? (
        <div className="rounded-xl border border-pitch-700/50 bg-pitch-900/40 px-3 py-3 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-pitch-500">
            {phase === "awaiting_advance"
              ? "Up next after Continue"
              : "Next fixture"}
          </p>
          <p className={`${TYPO.bodySm} font-semibold text-white`}>
            {career.club}{" "}
            <span className="text-pitch-500">
              {nextFixture.isNeutral || nextFixture.isHome ? "vs" : "@"}
            </span>{" "}
            {nextFixture.opponent}
          </p>
          <p className={`${TYPO.bodySm} text-pitch-400`}>
            {getManagerCompetitionLabel(nextFixture.competition)} ·{" "}
            {getManagerScheduledFixtureVenueLabel(nextFixture)}
            {nextFixture.isNeutral
              ? " · Neutral"
              : nextFixture.isHome
                ? " · Home"
                : " · Away"}
          </p>
        </div>
      ) : phase !== "season_complete" ? (
        <p className={`${TYPO.bodySm} text-pitch-500`}>
          Next fixture will be prepared when you continue.
        </p>
      ) : null}

      {(info.availabilityWarnings.length > 0 ||
        info.contractAlerts.length > 0 ||
        info.transferAlerts.length > 0) && (
        <ul className={`${TYPO.bodySm} space-y-1 text-pitch-300`}>
          {info.availabilityWarnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
          {info.contractAlerts.map((w) => (
            <li key={w}>{w}</li>
          ))}
          {info.transferAlerts.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <GameButton
        className="w-full sm:w-auto"
        disabled={primaryDisabled}
        onClick={handlePrimary}
      >
        {info.actionLabel}
      </GameButton>
    </ManagerSectionCard>
  );
}
