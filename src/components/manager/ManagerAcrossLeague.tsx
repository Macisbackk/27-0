"use client";

import { useMemo, useState } from "react";
import { managerDataRowClass } from "@/lib/manager/managerSurfaces";
import { ClubDualSwatch } from "@/components/ClubDualSwatch";
import {
  ManagerClubSquadBrowser,
  ManagerClubSquadSheet,
} from "@/components/manager/ManagerClubSquadSheet";
import { ManagerLeagueTable } from "@/components/manager/ManagerLeagueTable";
import { ManagerLeagueTransferCard } from "@/components/manager/ManagerTransferPlayerCard";
import {
  ManagerNewsItem,
  ManagerPage,
  ManagerSection,
  ManagerSectionCard,
} from "@/components/manager/manager-ui";
import { GameSectionHeader } from "@/components/ui/GameSectionHeader";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { formatWage } from "@/lib/manager/managerContracts";
import { getLeagueTopTryScorers } from "@/lib/manager/managerLeagueLeaders";
import { getLeagueNewsItems } from "@/lib/manager/managerNews";
import type { ManagerCareer, ManagerView } from "@/lib/manager/types";
import { getPlayerById } from "@/lib/players";
import { POSITION_SHORT } from "@/lib/positions";
import { getPlayerEligiblePositions } from "@/lib/players/player-positions";
import { ensureChampionshipSystems } from "@/lib/manager/championship/ensureChampionship";
import { playUiClick } from "@/lib/sound";

type TableCompetition = "super-league" | "championship";

interface ManagerAcrossLeagueProps {
  career: ManagerCareer;
  onNavigate?: (view: ManagerView) => void;
}

export function ManagerAcrossLeague({
  career,
  onNavigate,
}: ManagerAcrossLeagueProps) {
  const [viewClubSheet, setViewClubSheet] = useState<string | null>(null);
  const [competition, setCompetition] =
    useState<TableCompetition>("super-league");
  const [tableMenuOpen, setTableMenuOpen] = useState(false);

  const withChamp = useMemo(() => ensureChampionshipSystems(career), [career]);
  const newsItems = getLeagueNewsItems(withChamp);
  const leagueTransfers = withChamp.leagueTransfers ?? [];
  const tableTitle =
    competition === "super-league" ? "Super League" : "Championship";
  const tableRows =
    competition === "super-league"
      ? withChamp.leagueTable
      : withChamp.championshipCompetition?.standings ?? [];

  const topTryScorers = useMemo(
    () => getLeagueTopTryScorers(career, 10),
    [career]
  );

  const otherClubListings = useMemo(() => {
    return career.leagueListedPlayers
      .filter((entry) => entry.club !== career.club)
      .map((entry) => {
        const player = getPlayerById(entry.playerId);
        if (!player) return null;
        return { ...entry, player };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => b.player.peakRating - a.player.peakRating);
  }, [career.leagueListedPlayers, career.club]);

  const freeAgentsElsewhere = useMemo(() => {
    return (career.freeAgents ?? [])
      .filter((entry) => entry.formerClub !== career.club)
      .map((entry) => {
        const player = getPlayerById(entry.playerId);
        if (!player) return null;
        return { ...entry, player };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .sort((a, b) => b.player.peakRating - a.player.peakRating)
      .slice(0, 8);
  }, [career.freeAgents, career.club]);

  const clubSheetModal =
    viewClubSheet != null ? (
      <ManagerClubSquadSheet
        career={career}
        club={viewClubSheet}
        onClose={() => setViewClubSheet(null)}
        onViewUserSquad={
          onNavigate ? () => onNavigate("squad") : undefined
        }
      />
    ) : null;

  return (
    <>
    <ManagerPage>
      <ManagerSection>
        <GameSectionHeader
          label="League"
          title="Across the League"
          subtitle={`Season ${career.seasonYear} · Week ${career.gameWeek} — news, squads and transfer activity from around Super League and the Championship`}
        />

        <div className="stat-section-stack">
        <ManagerClubSquadBrowser
          career={career}
          onViewUserSquad={onNavigate ? () => onNavigate("squad") : undefined}
        />

        <ManagerSectionCard title="League News" variant="inset">
          {newsItems.length > 0 ? (
            <ul className={`mt-2 ${SPACING.stackSm}`}>
              {newsItems.map((item) => (
                <ManagerNewsItem key={item.id} item={item} />
              ))}
            </ul>
          ) : (
            <p className={`mt-2 ${TYPO.bodySm} text-pitch-500`}>
              No league headlines yet — play a match or advance the week for
              updates.
            </p>
          )}
        </ManagerSectionCard>

        <div className="relative">
          <button
            type="button"
            className={`${TYPO.sectionLabel} btn-press mb-2 inline-flex items-center gap-2 text-left text-white`}
            aria-haspopup="menu"
            aria-expanded={tableMenuOpen}
            onClick={() => {
              playUiClick();
              setTableMenuOpen((o) => !o);
            }}
          >
            {tableTitle} standings
            <span className="text-xs font-normal text-pitch-400" aria-hidden>
              ▾
            </span>
          </button>
          {tableMenuOpen ? (
            <div
              role="menu"
              className="absolute z-20 mt-0.5 min-w-[12rem] rounded-lg border border-pitch-600/70 bg-pitch-950 p-1 shadow-xl"
            >
              {(
                [
                  ["super-league", "Super League"],
                  ["championship", "Championship"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="menuitem"
                  className={`btn-press block w-full rounded-md px-3 py-2 text-left text-sm ${
                    competition === id
                      ? "bg-theme-primary/15 text-theme-primary"
                      : "text-white hover:bg-pitch-800"
                  }`}
                  onClick={() => {
                    playUiClick();
                    setCompetition(id);
                    setTableMenuOpen(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
          <ManagerLeagueTable
            career={withChamp}
            title={tableTitle}
            subtitle={
              competition === "super-league"
                ? `Season ${career.seasonYear} Super League`
                : `Season ${career.seasonYear} Championship`
            }
            rows={tableRows}
            showDraws={competition === "championship"}
            onViewClub={
              competition === "super-league" ? setViewClubSheet : undefined
            }
            defaultExpanded
          />
        </div>

        <ManagerSectionCard title="Top Try Scorers" variant="elevated">
          <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
            Super League leading try scorers this season.
          </p>
          {topTryScorers.length > 0 ? (
            <ol className="mt-3 space-y-2">
              {topTryScorers.map((entry, index) => {
                const posLabel = entry.position
                  ? POSITION_SHORT[entry.position]
                  : null;
                return (
                  <li
                    key={entry.playerId}
                    className={`${CARD.inset} flex items-center gap-3 ${SPACING.cardPaddingSm} ${
                      entry.isUserClub
                        ? "border-theme-primary/35 bg-theme-primary/5"
                        : ""
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-display text-sm font-black ${
                        index === 0
                          ? "bg-accent-gold/15 text-accent-gold ring-1 ring-accent-gold/35"
                          : index < 3
                            ? "bg-theme-primary/15 text-theme-primary ring-1 ring-theme-primary/30"
                            : "bg-pitch-800/80 text-pitch-300 ring-1 ring-pitch-600/50"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <ClubDualSwatch club={entry.club} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">
                        {entry.playerName}
                      </p>
                      <p className={`${TYPO.bodySm} text-pitch-400`}>
                        {entry.club}
                        {posLabel ? ` · ${posLabel}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-lg font-black text-theme-primary">
                        {entry.tries}
                      </p>
                      <p className={`${TYPO.bodySm} text-pitch-500`}>
                        {entry.tries === 1 ? "try" : "tries"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className={`mt-2 ${TYPO.bodySm} text-pitch-500`}>
              No league tries recorded yet — play a league match to open the
              chart.
            </p>
          )}
        </ManagerSectionCard>

        {leagueTransfers.length > 0 && (
          <ManagerSectionCard title="Transfer Wire" variant="elevated">
            <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
              Completed moves between clubs this season.
            </p>
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {leagueTransfers.map((tx) => (
                <ManagerLeagueTransferCard
                  key={tx.id}
                  playerName={tx.playerName}
                  fromClub={tx.fromClub}
                  toClub={tx.toClub}
                  fee={tx.fee}
                  week={tx.week}
                  compact
                />
              ))}
            </ul>
          </ManagerSectionCard>
        )}

        {otherClubListings.length > 0 && (
          <ManagerSectionCard title="Players Listed by Other Clubs">
            <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
              Talent available on the market — head to Transfers to make an offer.
            </p>
            <ul className="mt-3 space-y-2">
              {otherClubListings.map((entry) => {
                const positions = getPlayerEligiblePositions(entry.player);
                const posLabel = positions.map((p) => POSITION_SHORT[p]).join("/");
                return (
                  <li
                    key={`${entry.club}-${entry.playerId}`}
                    className={`${CARD.inset} flex items-center gap-3 ${SPACING.cardPaddingSm}`}
                  >
                    <ClubDualSwatch club={entry.club} size="xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-white">
                        {entry.player.name}
                      </p>
                      <p className={`${TYPO.bodySm} text-pitch-400`}>
                        {entry.club} · {posLabel} · {entry.player.peakRating} OVR
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold text-accent-gold">
                        {formatWage(entry.askingPrice)}
                      </p>
                      <p className={`${TYPO.bodySm} text-pitch-500`}>
                        W{entry.listedAtWeek}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </ManagerSectionCard>
        )}

        {freeAgentsElsewhere.length > 0 && (
          <ManagerSectionCard title="Free Agents" variant="inset">
            <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
              Recently released players still looking for a club.
            </p>
            <ul className="mt-3 space-y-2">
              {freeAgentsElsewhere.map((entry) => {
                const positions = getPlayerEligiblePositions(entry.player);
                const posLabel = positions.map((p) => POSITION_SHORT[p]).join("/");
                return (
                  <li
                    key={entry.playerId}
                    className={`${managerDataRowClass()} flex items-center justify-between gap-3 px-3 py-2`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white">
                        {entry.player.name}
                      </p>
                      <p className={`${TYPO.bodySm} text-theme-primary`}>
                        Free agent · {posLabel} · {entry.player.peakRating} OVR
                      </p>
                    </div>
                    <span className={`${TYPO.bodySm} shrink-0 text-pitch-500`}>
                      W{entry.sinceWeek}
                    </span>
                  </li>
                );
              })}
            </ul>
          </ManagerSectionCard>
        )}

        </div>
      </ManagerSection>
    </ManagerPage>
      {clubSheetModal}
    </>
  );
}
