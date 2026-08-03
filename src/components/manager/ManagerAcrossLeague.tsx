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
import { CollapsibleDetails } from "@/components/ui/MobileLayout";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { formatWage } from "@/lib/manager/managerContracts";
import {
  getChampionshipTopTryScorers,
  getLeagueTopTryScorers,
} from "@/lib/manager/managerLeagueLeaders";
import { getLeagueNewsItems } from "@/lib/manager/managerNews";
import type {
  LatestNewsItem,
  LeagueTransferActivity,
  ManagerCareer,
  ManagerView,
} from "@/lib/manager/types";
import { getPlayerById } from "@/lib/players";
import { POSITION_SHORT } from "@/lib/positions";
import { getPlayerEligiblePositions } from "@/lib/players/player-positions";
import { ensureChampionshipSystems } from "@/lib/manager/championship/ensureChampionship";
import { getChampionshipPlayer } from "@/lib/manager/championship/championshipSquads";
import { isChampionshipClubName } from "@/lib/clubs/championship-clubs";
import { isCurrentPlayableClub } from "@/lib/clubs/super-league-display";
import { getManagerPlayer } from "@/lib/manager/managerPlayers";
import { playUiClick } from "@/lib/sound";

export type AcrossTheLeagueCompetitionId = "super-league" | "championship";

interface ManagerAcrossLeagueProps {
  career: ManagerCareer;
  onNavigate?: (view: ManagerView) => void;
}

/** Cross-tier Transfer Wire: one club Championship, the other Super League. */
export function isChampionshipSuperLeagueTransfer(
  tx: LeagueTransferActivity
): boolean {
  const fromChamp = isChampionshipClubName(tx.fromClub);
  const toChamp = isChampionshipClubName(tx.toClub);
  const fromSl = isCurrentPlayableClub(tx.fromClub);
  const toSl = isCurrentPlayableClub(tx.toClub);
  return (fromChamp && toSl) || (fromSl && toChamp);
}

function resolveLeagueTransferPlayerName(
  career: ManagerCareer,
  tx: LeagueTransferActivity
): string {
  const stored = tx.playerName?.trim();
  if (stored) return stored;
  return (
    getManagerPlayer(career, tx.playerId)?.name ??
    getChampionshipPlayer(career.championshipSquads, tx.playerId)?.name ??
    getPlayerById(tx.playerId)?.name ??
    "Unknown player"
  );
}

function filterNewsForCompetition(
  items: LatestNewsItem[],
  competition: AcrossTheLeagueCompetitionId
): LatestNewsItem[] {
  if (competition === "super-league") {
    return items.filter(
      (item) =>
        !item.id.includes("champ") &&
        !/championship/i.test(item.text)
    );
  }
  return items.filter(
    (item) =>
      item.id.includes("champ") ||
      /championship/i.test(item.text) ||
      item.type === "cup"
  );
}

export function ManagerAcrossLeague({
  career,
  onNavigate,
}: ManagerAcrossLeagueProps) {
  const [viewClubSheet, setViewClubSheet] = useState<string | null>(null);
  const [selectedCompetitionId, setSelectedCompetitionId] =
    useState<AcrossTheLeagueCompetitionId>("super-league");
  const [tableMenuOpen, setTableMenuOpen] = useState(false);

  const withChamp = useMemo(() => ensureChampionshipSystems(career), [career]);

  const competitionLabel =
    selectedCompetitionId === "super-league" ? "Super League" : "Championship";

  const tableRows = useMemo(
    () =>
      selectedCompetitionId === "super-league"
        ? withChamp.leagueTable
        : withChamp.championshipCompetition?.standings ?? [],
    [selectedCompetitionId, withChamp]
  );

  const topTryScorers = useMemo(
    () =>
      selectedCompetitionId === "super-league"
        ? getLeagueTopTryScorers(withChamp, 10)
        : getChampionshipTopTryScorers(withChamp, 10),
    [selectedCompetitionId, withChamp]
  );

  const newsItems = useMemo(
    () =>
      filterNewsForCompetition(
        getLeagueNewsItems(withChamp),
        selectedCompetitionId
      ),
    [withChamp, selectedCompetitionId]
  );

  const leagueTransfers = useMemo(() => {
    const all = withChamp.leagueTransfers ?? [];
    if (selectedCompetitionId === "super-league") {
      return all.filter((tx) => !isChampionshipSuperLeagueTransfer(tx));
    }
    return all.filter(isChampionshipSuperLeagueTransfer);
  }, [withChamp.leagueTransfers, selectedCompetitionId]);

  const champFixtures = withChamp.championshipCompetition?.fixtures ?? [];

  const recentResults = useMemo(() => {
    if (selectedCompetitionId !== "championship") return [];
    return champFixtures
      .filter((f) => f.played && f.homeScore != null && f.awayScore != null)
      .slice()
      .sort((a, b) => b.round - a.round)
      .slice(0, 8);
  }, [selectedCompetitionId, champFixtures]);

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
          size="page"
          label="League"
          title="Across the League"
          subtitle={
            <>
              <span className="sm:hidden">
                Season {career.seasonYear} · Week {career.gameWeek}
                {selectedCompetitionId === "super-league"
                  ? " · Super League"
                  : " · Championship"}
              </span>
              <span className="hidden sm:inline">
                {selectedCompetitionId === "super-league"
                  ? `Season ${career.seasonYear} · Week ${career.gameWeek} — Super League news, squads and transfer activity`
                  : `Season ${career.seasonYear} · Week ${career.gameWeek} — Championship standings, scorers and Super League–linked transfer wire`}
              </span>
            </>
          }
        />

        <div className="stat-section-stack">
        {selectedCompetitionId === "super-league" ? (
          <ManagerClubSquadBrowser
            career={career}
            onViewUserSquad={onNavigate ? () => onNavigate("squad") : undefined}
          />
        ) : null}

        <div className="relative z-20">
          <button
            type="button"
            className={`${TYPO.sectionLabel} btn-press mb-2 inline-flex max-w-full items-center gap-2 text-left text-white`}
            aria-haspopup="menu"
            aria-expanded={tableMenuOpen}
            onClick={() => {
              playUiClick();
              setTableMenuOpen((o) => !o);
            }}
          >
            <span className="truncate">{competitionLabel}</span>
            <span className="text-xs font-normal text-pitch-400" aria-hidden>
              ▾
            </span>
          </button>
          {tableMenuOpen ? (
            <div
              role="menu"
              className="absolute left-0 right-auto z-30 mt-0.5 min-w-[12rem] max-w-[min(100%,18rem)] rounded-lg border border-pitch-600/70 bg-pitch-950 p-1 shadow-xl"
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
                    selectedCompetitionId === id
                      ? "bg-theme-primary/15 text-theme-primary"
                      : "text-white hover:bg-pitch-800"
                  }`}
                  onClick={() => {
                    playUiClick();
                    setSelectedCompetitionId(id);
                    setTableMenuOpen(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <ManagerSectionCard
          title={
            selectedCompetitionId === "super-league"
              ? "League News"
              : "Championship News"
          }
          variant="inset"
          className="!p-2.5 sm:!p-4"
        >
          {newsItems.length > 0 ? (
            <ul className={`mt-1.5 space-y-1.5`}>
              {newsItems.map((item) => (
                <ManagerNewsItem key={item.id} item={item} />
              ))}
            </ul>
          ) : (
            <p className={`mt-1.5 ${TYPO.bodySm} text-pitch-500`}>
              {selectedCompetitionId === "super-league"
                ? "No league headlines yet — play a match or advance the week for updates."
                : "No Championship headlines yet — advance the Match Week for updates."}
            </p>
          )}
        </ManagerSectionCard>

        <ManagerLeagueTable
          career={withChamp}
          title={competitionLabel}
          subtitle={
            selectedCompetitionId === "super-league"
              ? `Season ${career.seasonYear} Super League`
              : `Season ${career.seasonYear} Championship`
          }
          rows={tableRows}
          showDraws={selectedCompetitionId === "championship"}
          onViewClub={
            selectedCompetitionId === "super-league"
              ? setViewClubSheet
              : undefined
          }
          defaultExpanded
        />

        {selectedCompetitionId === "championship" && recentResults.length > 0 ? (
          <ManagerSectionCard title="Recent Results" variant="inset">
            <ul className="mt-2 space-y-2">
              {recentResults.map((f) => (
                <li
                  key={f.id}
                  className={`${managerDataRowClass()} flex flex-wrap items-center justify-between gap-2 px-3 py-2`}
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-white">
                    {f.homeTeam}{" "}
                    <span className="font-bold tabular-nums text-theme-primary">
                      {f.homeScore}–{f.awayScore}
                    </span>{" "}
                    {f.awayTeam}
                  </span>
                  <span className={`${TYPO.bodySm} shrink-0 text-pitch-500`}>
                    R{f.round}
                  </span>
                </li>
              ))}
            </ul>
          </ManagerSectionCard>
        ) : null}

        <ManagerSectionCard title="Top Try Scorers" variant="elevated">
          <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
            {selectedCompetitionId === "super-league"
              ? "Super League leading try scorers this season."
              : "Championship leading try scorers this season."}
          </p>
          {topTryScorers.length > 0 ? (
            <ol className="mt-3 space-y-2">
              {topTryScorers.map((entry, index) => {
                const posLabel = entry.position
                  ? POSITION_SHORT[entry.position]
                  : null;
                return (
                  <li
                    key={`${selectedCompetitionId}-${entry.playerId}`}
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
              {selectedCompetitionId === "super-league"
                ? "No league tries recorded yet — play a league match to open the chart."
                : "No Championship tries recorded yet — advance the Match Week for results."}
            </p>
          )}
        </ManagerSectionCard>

        {leagueTransfers.length > 0 && (
          <ManagerSectionCard
            title={
              selectedCompetitionId === "super-league"
                ? "Transfer Wire"
                : "Championship Transfer Wire"
            }
            variant="elevated"
          >
            <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
              {selectedCompetitionId === "super-league"
                ? "Completed moves between Super League clubs this season."
                : "Moves linking Championship and Super League clubs."}
            </p>
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {leagueTransfers.map((tx) => (
                <ManagerLeagueTransferCard
                  key={tx.id}
                  playerName={resolveLeagueTransferPlayerName(withChamp, tx)}
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

        {selectedCompetitionId === "super-league" &&
          otherClubListings.length > 0 && (
          <CollapsibleDetails summary="Players Listed by Other Clubs">
            <p className={`${TYPO.bodySm} text-pitch-400`}>
              Talent available on the market — head to Transfers to make an offer.
            </p>
            <ul className="mt-2 space-y-2">
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
          </CollapsibleDetails>
        )}

        {selectedCompetitionId === "super-league" &&
          freeAgentsElsewhere.length > 0 && (
          <CollapsibleDetails summary="Free Agents">
            <p className={`${TYPO.bodySm} text-pitch-400`}>
              Recently released players still looking for a club.
            </p>
            <ul className="mt-2 space-y-2">
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
          </CollapsibleDetails>
        )}

        </div>
      </ManagerSection>
    </ManagerPage>
      {clubSheetModal}
    </>
  );
}
