"use client";

import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer, ManagerView } from "@/lib/manager/types";
import { getSquadStrengthPreview } from "@/lib/manager/managerSimulation";
import { getUserLeaguePosition } from "@/lib/manager/managerFixtures";
import { getClubByName } from "@/lib/clubs";
import { formatInjuryLabel } from "@/lib/manager/managerTransfers";
import { getPlayerById } from "@/lib/players";
import { isPlayerUnavailable } from "@/lib/manager/managerSquad";
import {
  playSimulateRound,
  playUiClick,
} from "@/lib/sound";

interface ManagerHubProps {
  career: ManagerCareer;
  onNavigate: (view: ManagerView) => void;
  onSimulate: () => void;
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className={`${CARD.stat} ${SPACING.cardPaddingSm}`}>
      <p className={TYPO.bodySm}>{label}</p>
      <p className={`mt-0.5 text-lg font-semibold text-white`}>{value}</p>
      {sub && <p className={`${TYPO.bodySm} text-pitch-400`}>{sub}</p>}
    </div>
  );
}

export function ManagerHub({ career, onNavigate, onSimulate }: ManagerHubProps) {
  const club = getClubByName(career.club);
  const nextFixture = career.schedule[career.currentRound];
  const position = getUserLeaguePosition(career.leagueTable, career.club);
  const strength = getSquadStrengthPreview(career);
  const injured = career.squad.filter(
    (p) => p.injury && isPlayerUnavailable(p)
  );
  const recentForm = career.fixtures
    .slice(-5)
    .map((f) => f.result)
    .join(" ") || "—";

  const quickActions: { label: string; view: ManagerView }[] = [
    { label: "Squad", view: "squad" },
    { label: "Tactics", view: "tactics" },
    { label: "Transfers", view: "transfers" },
    { label: "Fixtures", view: "fixtures" },
    { label: "League Table", view: "table" },
  ];

  return (
    <div className={`mx-auto max-w-3xl ${SPACING.stackLg}`}>
      <div
        className={`${CARD.elevated} ${SPACING.cardPadding} border-l-4`}
        style={{ borderLeftColor: club?.primaryColor ?? "var(--theme-primary)" }}
      >
        <p className={TYPO.sectionLabel}>Manager Hub</p>
        <h1 className={`mt-1 ${TYPO.pageTitle}`}>{career.club}</h1>
        <p className={`${TYPO.bodySm} text-pitch-400`}>
          Season {career.seasonYear} · Round {career.currentRound}/
          {career.schedule.length}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <StatCard
          label="League Position"
          value={`${position}${position === 1 ? "st" : position === 2 ? "nd" : position === 3 ? "rd" : "th"}`}
        />
        <StatCard
          label="Record"
          value={`${career.wins}W-${career.losses}L`}
        />
        <StatCard label="Squad Rating" value={String(strength)} />
        <StatCard
          label="Club Funds"
          value={`£${(career.budget / 1000).toFixed(0)}k`}
        />
        <StatCard
          label="Board Confidence"
          value={`${career.boardConfidence}%`}
          sub={career.boardConfidence < 30 ? "Warning: board unhappy" : undefined}
        />
        <StatCard label="Team Morale" value="—" sub="See squad" />
      </div>

      {nextFixture && !career.isSeasonComplete && (
        <div className={`${CARD.base} ${SPACING.cardPadding}`}>
          <p className={TYPO.sectionLabel}>Next Fixture</p>
          <p className={`mt-1 ${TYPO.cardTitle}`}>
            {nextFixture.isHome ? "vs" : "@"} {nextFixture.opponent}
          </p>
          <p className={`${TYPO.bodySm} text-pitch-400`}>
            Round {nextFixture.round} · {nextFixture.isHome ? "Home" : "Away"}
          </p>
          <div className="mt-3">
            <GameButton
              variant="theme"
              onClick={() => {
                playSimulateRound();
                playUiClick();
                onSimulate();
              }}
            >
              Simulate Next Match
            </GameButton>
          </div>
        </div>
      )}

      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={TYPO.sectionLabel}>Recent Form</p>
        <p className={`mt-1 font-mono text-sm tracking-widest ${TYPO.body}`}>
          {recentForm}
        </p>
      </div>

      {injured.length > 0 && (
        <div className={`${CARD.base} ${SPACING.cardPadding}`}>
          <p className={TYPO.sectionLabel}>Injuries</p>
          <ul className={`mt-2 ${SPACING.stackSm}`}>
            {injured.map((p) => {
              const player = getPlayerById(p.playerId);
              return (
                <li key={p.playerId} className={`${TYPO.bodySm} text-red-300`}>
                  {player?.name} —{" "}
                  {p.injury ? formatInjuryLabel(p.injury) : ""}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className={`${CARD.base} ${SPACING.cardPadding}`}>
        <p className={`${TYPO.sectionLabel} mb-3`}>Quick Actions</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {quickActions.map((a) => (
            <GameButton
              key={a.view}
              variant="secondary"
              size="sm"
              fullWidth
              onClick={() => {
                playUiClick();
                onNavigate(a.view);
              }}
            >
              {a.label}
            </GameButton>
          ))}
        </div>
      </div>
    </div>
  );
}
