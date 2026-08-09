"use client";

import { useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import {
  ManagerLeagueTransferCard,
  ManagerTransferPlayerCard,
} from "@/components/manager/ManagerTransferPlayerCard";
import {
  ManagerTransferResultModal,
  type TransferResultDetails,
} from "@/components/manager/ManagerTransferResultModal";
import { ManagerPage, ManagerSection, ManagerSectionCard, ManagerStat } from "@/components/manager/manager-ui";
import {
  canAffordAdditionalWage,
  evaluateClubSigningAppeal,
  getComfortableSigningRating,
  getTransferBudget,
  getWageBillPercent,
  isWageOverBudget,
} from "@/lib/manager/managerFinance";
import { getCareerClubStars } from "@/lib/manager/managerDifficulty";
import { isSameManagerClub } from "@/lib/clubs/super-league-display";
import { FILTER, SPACING } from "@/lib/ui/design-system";
import { ClipboardPanel } from "@/components/ui/ClipboardPanel";
import { GameSectionHeader } from "@/components/ui/GameSectionHeader";
import { ManagerSubTabBar } from "@/components/manager/ManagerSubTabBar";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import { formatWage } from "@/lib/manager/managerContracts";
import { getManagerPlayer, getManagerPlayerAge } from "@/lib/manager/managerPlayers";
import { applyManagerModeRatingToPlayer } from "@/lib/manager/managerSquadRatings";
import {
  completePlayerPurchase,
  evaluateBuyOffer,
  getAllLeaguePlayers,
  getBuyerMinimumTransferFee,
  getSellerAskingPrice,
  listingAllowsLoan,
  listingAllowsPermanent,
} from "@/lib/manager/managerTransferLeague";
import {
  completeIncomingLoan,
  recallLoan,
  suggestedLoanFee,
} from "@/lib/manager/managerLoans";
import {
  completeFreeAgentSigning,
  evaluateFreeAgentOffer,
  formatFreeAgentSource,
} from "@/lib/manager/managerFreeAgents";
import { getPlayerSigningDemand } from "@/lib/manager/managerTransfers";
import {
  toggleTransferWatchlist,
} from "@/lib/manager/managerWatchlist";
import { getPlayerById } from "@/lib/players";
import { POSITION_SHORT } from "@/lib/positions";
import type { Player, Position } from "@/lib/types";
import { getPlayerEligiblePositions } from "@/lib/players/player-positions";
import { playUiClick, playTransferOffer, playTransferComplete } from "@/lib/sound";

interface ManagerTransfersProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
}

type TransferTab = "listed" | "loans" | "freeAgents" | "unlisted" | "watch";
type DealType = "permanent" | "loan";

const TRANSFER_TAB_LABELS: Record<TransferTab, string> = {
  listed: "Listed",
  loans: "Loans",
  freeAgents: "Free agents",
  unlisted: "Unlisted",
  watch: "Watch",
};

const TRANSFER_TAB_SHORT_LABELS: Record<TransferTab, string> = {
  listed: "Listed",
  loans: "Loan",
  freeAgents: "Free",
  unlisted: "Bid",
  watch: "Watch",
};

function withManagerRating(player: Player): Player {
  return applyManagerModeRatingToPlayer(player);
}

function DealTypeToggle({
  value,
  onChange,
}: {
  value: DealType;
  onChange: (v: DealType) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(
        [
          ["permanent", "Permanent"],
          ["loan", "Loan"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => {
            playUiClick();
            onChange(id);
          }}
          className={`${FILTER.chipTouch} rounded-sm ${
            value === id ? FILTER.chipActive : "border-pitch-600 text-pitch-300"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function ManagerTransfers({
  career,
  onUpdate,
}: ManagerTransfersProps) {
  const [tab, setTab] = useState<TransferTab>("listed");
  const [positionFilter, setPositionFilter] = useState<Position | "all">("all");
  const [leagueSort, setLeagueSort] = useState<"rating" | "team" | "name">(
    "rating"
  );
  const [search, setSearch] = useState("");
  const [transferResult, setTransferResult] =
    useState<TransferResultDetails | null>(null);
  const [offerPlayerId, setOfferPlayerId] = useState<string | null>(null);
  const [offerFee, setOfferFee] = useState(0);
  const [dealType, setDealType] = useState<DealType>("permanent");
  const [listedNegotiateId, setListedNegotiateId] = useState<string | null>(null);
  const [listedOfferWage, setListedOfferWage] = useState(0);
  const [listedOfferYears, setListedOfferYears] = useState(1);
  const [freeAgentNegotiateId, setFreeAgentNegotiateId] = useState<string | null>(
    null
  );
  const [freeAgentOfferWage, setFreeAgentOfferWage] = useState(0);
  const [freeAgentOfferYears, setFreeAgentOfferYears] = useState(1);

  const wageOverBudget = isWageOverBudget(career);
  const wagePct = getWageBillPercent(career);
  const transferFund = getTransferBudget(career);

  const listedPlayerIds = useMemo(
    () => new Set(career.leagueListedPlayers.map((l) => l.playerId)),
    [career.leagueListedPlayers]
  );

  const freeAgentIds = useMemo(
    () => new Set((career.freeAgents ?? []).map((f) => f.playerId)),
    [career.freeAgents]
  );

  const watchlistIds = career.transferWatchlistIds ?? [];
  const watchlistSet = useMemo(() => new Set(watchlistIds), [watchlistIds]);

  const toggleWatchlist = (playerId: string) => {
    playUiClick();
    onUpdate(toggleTransferWatchlist(career, playerId));
  };

  /** Full unlisted pool — not transfer-listed, not a free agent, not at your club. */
  const allUnlistedPlayers = useMemo(() => {
    return getAllLeaguePlayers(career)
      .map(({ playerId, club }) => {
        const raw =
          getManagerPlayer(career, playerId) ?? getPlayerById(playerId);
        if (!raw) return null;
        return { player: withManagerRating(raw), club, playerId };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .filter((r) => !listedPlayerIds.has(r.playerId))
      .filter((r) => !freeAgentIds.has(r.playerId));
  }, [career, listedPlayerIds, freeAgentIds]);

  const loanListedCount = useMemo(
    () =>
      career.leagueListedPlayers.filter(
        (entry) =>
          !isSameManagerClub(entry.club, career.club) &&
          listingAllowsLoan(entry.listingType) &&
          Boolean(getPlayerById(entry.playerId))
      ).length,
    [career]
  );

  const tabCounts = useMemo(
    () => ({
      listed: career.leagueListedPlayers.filter(
        (entry) =>
          !isSameManagerClub(entry.club, career.club) &&
          listingAllowsPermanent(entry.listingType) &&
          Boolean(getPlayerById(entry.playerId))
      ).length,
      loans: loanListedCount,
      freeAgents: (career.freeAgents ?? []).filter(
        (entry) =>
          Boolean(
            getManagerPlayer(career, entry.playerId) ??
              getPlayerById(entry.playerId)
          )
      ).length,
      watch: (career.transferWatchlistIds ?? []).length,
    }),
    [career, loanListedCount]
  );

  const careerStars = getCareerClubStars(career);
  const comfortableTarget = getComfortableSigningRating(
    career.club,
    careerStars
  );

  const listedPlayers = useMemo(() => {
    return career.leagueListedPlayers
      .filter((entry) => !isSameManagerClub(entry.club, career.club))
      .filter((entry) =>
        tab === "loans"
          ? listingAllowsLoan(entry.listingType)
          : listingAllowsPermanent(entry.listingType)
      )
      .map((entry) => {
        const raw = getPlayerById(entry.playerId);
        if (!raw) return null;
        return { ...entry, player: withManagerRating(raw) };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .filter((r) => {
        if (positionFilter === "all") return true;
        return getPlayerEligiblePositions(r.player).includes(positionFilter);
      })
      .sort((a, b) => b.player.peakRating - a.player.peakRating);
  }, [career.leagueListedPlayers, career.club, positionFilter, tab]);

  const freeAgents = useMemo(() => {
    return (career.freeAgents ?? [])
      .map((entry) => {
        const raw =
          getManagerPlayer(career, entry.playerId) ??
          getPlayerById(entry.playerId);
        if (!raw) return null;
        return { ...entry, player: withManagerRating(raw) };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .filter((r) => {
        if (positionFilter === "all") return true;
        return getPlayerEligiblePositions(r.player).includes(positionFilter);
      })
      .sort((a, b) => b.player.peakRating - a.player.peakRating);
  }, [career, positionFilter]);

  const unlistedPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allUnlistedPlayers
      .filter((r) => {
        if (!q) return true;
        return (
          r.player.name.toLowerCase().includes(q) ||
          r.club.toLowerCase().includes(q)
        );
      })
      .filter((r) => {
        if (positionFilter === "all") return true;
        return getPlayerEligiblePositions(r.player).includes(positionFilter);
      })
      .sort((a, b) => {
        if (leagueSort === "team") {
          return (
            a.club.localeCompare(b.club) ||
            b.player.peakRating - a.player.peakRating
          );
        }
        if (leagueSort === "name") {
          return a.player.name.localeCompare(b.player.name);
        }
        return b.player.peakRating - a.player.peakRating;
      });
  }, [allUnlistedPlayers, search, positionFilter, leagueSort]);

  const watchedPlayers = useMemo(() => {
    return watchlistIds
      .map((playerId) => {
        const listed = career.leagueListedPlayers.find(
          (entry) => entry.playerId === playerId
        );
        const free = (career.freeAgents ?? []).find(
          (entry) => entry.playerId === playerId
        );
        const raw =
          getManagerPlayer(career, playerId) ?? getPlayerById(playerId);
        if (!raw) return null;
        const fromLeague = getAllLeaguePlayers(career).find(
          (row) => row.playerId === playerId
        );
        return {
          playerId,
          player: withManagerRating(raw),
          club: listed?.club ?? free?.formerClub ?? fromLeague?.club ?? "Unknown",
          listed: Boolean(listed),
          freeAgent: Boolean(free),
          listingType: listed?.listingType,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }, [watchlistIds, career]);

  const submitTransferOffer = (
    playerId: string,
    club: string,
    listed: boolean,
    offerOverride?: {
      transferFee: number;
      wagePerYear: number;
      yearsRequested: number;
    },
    dealOverride?: DealType
  ) => {
    const player = getPlayerById(playerId);
    const demand = getPlayerSigningDemand(career, playerId);
    const type = dealOverride ?? dealType;

    if (type === "loan") {
      const loanFee =
        offerOverride?.transferFee ??
        suggestedLoanFee(career, playerId, club, listed);
      const wagePerYear = offerOverride?.wagePerYear ?? demand.wagePerYear;
      const parentWageShare = 0.5;
      const loaneeWage = Math.round(wagePerYear * (1 - parentWageShare));
      const canAfford =
        getTransferBudget(career) >= loanFee &&
        canAffordAdditionalWage(career, loaneeWage);
      const accepted = canAfford && career.squad.length < 35;
      setTransferResult({
        playerName: player?.name ?? "Player",
        club,
        fee: loanFee,
        wagePerYear: loaneeWage,
        years: 1,
        accepted,
        reason: accepted
          ? "Loan agreed until end of season (50% wage share)."
          : !canAfford
            ? "Cannot afford loan fee or wage share."
            : "Squad is full.",
      });
      if (accepted) {
        playTransferComplete();
        onUpdate(
          completeIncomingLoan(career, playerId, club, {
            loanFee,
            parentWageShare,
            wagePerYear,
            yearsRequested: 1,
            squadRole: demand.squadRole,
          })
        );
        setOfferPlayerId(null);
        setListedNegotiateId(null);
        setDealType("permanent");
      } else {
        playTransferOffer();
      }
      return;
    }

    const fee =
      offerOverride?.transferFee ??
      (listed
        ? getBuyerMinimumTransferFee(career, playerId, club, true)
        : offerPlayerId === playerId && offerFee > 0
          ? offerFee
          : getBuyerMinimumTransferFee(career, playerId, club, false));

    const offer = offerOverride
      ? { ...offerOverride, squadRole: demand.squadRole }
      : {
      transferFee: fee,
      wagePerYear: demand.wagePerYear,
      yearsRequested: demand.yearsRequested,
      squadRole: demand.squadRole,
    };

    const result = evaluateBuyOffer(career, playerId, club, offer, listed);
    setTransferResult({
      playerName: player?.name ?? "Player",
      club,
      fee: offer.transferFee,
      wagePerYear: offer.wagePerYear,
      years: offer.yearsRequested,
      accepted: result.accepted,
      reason: result.reason,
    });

    if (result.accepted) {
      playTransferComplete();
      onUpdate(completePlayerPurchase(career, playerId, club, offer, listed));
      setOfferPlayerId(null);
      setListedNegotiateId(null);
    } else {
      playTransferOffer();
    }
  };

  const openListedNegotiation = (playerId: string) => {
    const demand = getPlayerSigningDemand(career, playerId);
    playUiClick();
    setListedNegotiateId(playerId);
    setListedOfferWage(demand.wagePerYear);
    setListedOfferYears(demand.yearsRequested);
    setOfferPlayerId(null);
  };

  const submitListedAssistantDeal = (
    playerId: string,
    club: string,
    type: DealType = dealType
  ) => {
    const demand = getPlayerSigningDemand(career, playerId);
    const fee =
      type === "loan"
        ? suggestedLoanFee(career, playerId, club, true)
        : getBuyerMinimumTransferFee(career, playerId, club, true);
    playUiClick();
    submitTransferOffer(
      playerId,
      club,
      true,
      {
        transferFee: fee,
        wagePerYear: demand.wagePerYear,
        yearsRequested: demand.yearsRequested,
      },
      type
    );
  };

  const submitListedNegotiatedDeal = (
    playerId: string,
    club: string,
    type: DealType = dealType
  ) => {
    const fee =
      type === "loan"
        ? suggestedLoanFee(career, playerId, club, true)
        : getBuyerMinimumTransferFee(career, playerId, club, true);
    playUiClick();
    submitTransferOffer(
      playerId,
      club,
      true,
      {
        transferFee: fee,
        wagePerYear: listedOfferWage,
        yearsRequested: listedOfferYears,
      },
      type
    );
  };

  const submitFreeAgentOffer = (
    playerId: string,
    formerClub: string,
    offerOverride?: {
      wagePerYear: number;
      yearsRequested: number;
    }
  ) => {
    const player = getPlayerById(playerId);
    const demand = getPlayerSigningDemand(career, playerId);
    const offer = {
      transferFee: 0,
      wagePerYear: offerOverride?.wagePerYear ?? demand.wagePerYear,
      yearsRequested: offerOverride?.yearsRequested ?? demand.yearsRequested,
      squadRole: demand.squadRole,
    };

    const result = evaluateFreeAgentOffer(career, playerId, offer);
    setTransferResult({
      playerName: player?.name ?? "Player",
      club: formerClub,
      fee: 0,
      wagePerYear: offer.wagePerYear,
      years: offer.yearsRequested,
      accepted: result.accepted,
      reason: result.reason,
      freeTransfer: true,
    });

    if (result.accepted) {
      playTransferComplete();
      onUpdate(completeFreeAgentSigning(career, playerId, offer));
      setFreeAgentNegotiateId(null);
      setListedNegotiateId(null);
      setOfferPlayerId(null);
    } else {
      playTransferOffer();
    }
  };

  const openFreeAgentNegotiation = (playerId: string) => {
    const demand = getPlayerSigningDemand(career, playerId);
    playUiClick();
    setFreeAgentNegotiateId(playerId);
    setFreeAgentOfferWage(demand.wagePerYear);
    setFreeAgentOfferYears(demand.yearsRequested);
    setListedNegotiateId(null);
    setOfferPlayerId(null);
  };

  const submitFreeAgentAssistantDeal = (playerId: string, formerClub: string) => {
    const demand = getPlayerSigningDemand(career, playerId);
    playUiClick();
    submitFreeAgentOffer(playerId, formerClub, {
      wagePerYear: demand.wagePerYear,
      yearsRequested: demand.yearsRequested,
    });
  };

  const submitFreeAgentNegotiatedDeal = (
    playerId: string,
    formerClub: string
  ) => {
    playUiClick();
    submitFreeAgentOffer(playerId, formerClub, {
      wagePerYear: freeAgentOfferWage,
      yearsRequested: freeAgentOfferYears,
    });
  };

  const switchTab = (next: TransferTab) => {
    if (tab === next) return;
    setTab(next);
    setListedNegotiateId(null);
    setFreeAgentNegotiateId(null);
    setOfferPlayerId(null);
    setDealType(next === "loans" ? "loan" : "permanent");
  };

  const transferSubTabs = (
    [
      ["listed", tabCounts.listed],
      ["loans", tabCounts.loans],
      ["freeAgents", tabCounts.freeAgents],
      ["unlisted", null],
      ["watch", tabCounts.watch],
    ] as const
  ).map(([id, count]) => ({
    id,
    label: `${TRANSFER_TAB_LABELS[id]}${count != null && count > 0 ? ` (${count})` : ""}`,
    shortLabel: `${TRANSFER_TAB_SHORT_LABELS[id]}${count != null && count > 0 ? ` (${count})` : ""}`,
  }));

  const tabSubtitle =
    tab === "listed"
      ? "Players openly on the market — negotiate terms or leave the deal to your assistant"
      : tab === "loans"
        ? "Players available on loan until season end — fee plus a wage share"
        : tab === "freeAgents"
          ? "Out-of-contract players — no transfer fee, negotiate wages only"
          : tab === "watch"
            ? "Your scouting board — offer from here or jump to the market"
            : "Bid for any Super League player not on the transfer list — deals cost more";

  return (
    <ManagerPage>
      <ManagerSection>
      <GameSectionHeader
        size="page"
        label="Transfers"
        title="Transfers"
        subtitle={tabSubtitle}
      />
      <div className="flex w-full min-w-0 justify-center">
        <ManagerSubTabBar
          tabs={transferSubTabs}
          active={tab}
          onChange={switchTab}
        />
      </div>

      <ManagerSectionCard title="Funds & wages" variant="elevated" accent="primary">
        <div className="mt-2 grid grid-cols-2 gap-3">
          <ManagerStat
            label="Transfer fund"
            value={formatWage(transferFund)}
            tone="gold"
            large
          />
          <ManagerStat
            label="Wage bill"
            value={formatWage(career.wageBill)}
            tone={wageOverBudget ? "amber" : "default"}
            large
          />
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-pitch-500">
            <span>
              Wage budget {formatWage(career.wageBudget)} ·{" "}
              {wagePct}% used
            </span>
            <span className={wageOverBudget ? "text-amber-300" : "text-theme-primary"}>
              {wageOverBudget ? "Over budget" : "Within budget"}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-pitch-800">
            <div
              className={`h-full transition-all ${
                wageOverBudget ? "bg-amber-400" : "bg-theme-primary"
              }`}
              style={{ width: `${Math.min(100, wagePct)}%` }}
            />
          </div>
        </div>
        <p className={`mt-3 ${TYPO.bodySm} text-pitch-500`}>
          Realistic targets sit around {comfortableTarget} rating — higher-rated
          players cost premium fees and may refuse lower clubs.
        </p>
      </ManagerSectionCard>

      {(career.activeLoans ?? []).length > 0 && (
        <ManagerSectionCard title="Active loans" variant="inset">
          <ul className="mt-2 space-y-2">
            {(career.activeLoans ?? []).map((loan) => {
              const name =
                getManagerPlayer(career, loan.playerId)?.name ??
                getPlayerById(loan.playerId)?.name ??
                "Player";
              const outgoing = isSameManagerClub(loan.parentClub, career.club);
              return (
                <li
                  key={loan.playerId}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-pitch-700/50 px-2.5 py-2"
                >
                  <div>
                    <p className={`${TYPO.bodySm} text-pitch-200`}>
                      {name}{" "}
                      <span className="text-pitch-500">
                        {outgoing
                          ? `→ ${loan.loaneeClub}`
                          : `← ${loan.parentClub}`}
                      </span>
                    </p>
                    <p className={`${TYPO.meta} text-pitch-500`}>
                      Fee {formatWage(loan.loanFee)} · ends season{" "}
                      {loan.endsAtSeasonYear} · wage share{" "}
                      {Math.round(loan.parentWageShare * 100)}% parent
                    </p>
                  </div>
                  {outgoing && loan.canRecall && (
                    <GameButton
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        playUiClick();
                        onUpdate(recallLoan(career, loan.playerId));
                      }}
                    >
                      Recall
                    </GameButton>
                  )}
                </li>
              );
            })}
          </ul>
        </ManagerSectionCard>
      )}

      <ClipboardPanel padded>
        <p className={`${TYPO.sectionLabel} mb-3`}>Filter by position</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPositionFilter("all")}
            className={`${FILTER.chipTouch} rounded-sm ${
              positionFilter === "all" ? FILTER.chipActive : "border-pitch-600 text-pitch-300"
            }`}
          >
            All
          </button>
          {(Object.keys(POSITION_SHORT) as Position[]).map((pos) => (
            <button
              key={pos}
              type="button"
              onClick={() => setPositionFilter(pos)}
              className={`${FILTER.chipTouch} rounded-sm ${
                positionFilter === pos ? FILTER.chipActive : "border-pitch-600 text-pitch-300"
              }`}
            >
              {POSITION_SHORT[pos]}
            </button>
          ))}
        </div>
      </ClipboardPanel>

      {(tab === "listed" || tab === "loans") && (
      <section className="space-y-3">
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${SPACING.cardGridGap}`}>
          {listedPlayers.map(({ player, club, listingType, askingPrice }) => {
            const demand = getPlayerSigningDemand(career, player.id);
            const listedPrice = getSellerAskingPrice(
              career,
              player.id,
              club,
              true
            );
            const buyerFee = getBuyerMinimumTransferFee(
              career,
              player.id,
              club,
              true
            );
            const loanFee = Math.max(
              suggestedLoanFee(career, player.id, club, true),
              listingType === "loan" ? askingPrice : 0
            );
            const effectiveDeal: DealType =
              tab === "loans"
                ? "loan"
                : dealType === "loan" && listingAllowsLoan(listingType)
                  ? "loan"
                  : "permanent";
            const dealFee = effectiveDeal === "loan" ? loanFee : buyerFee;
            const appeal = evaluateClubSigningAppeal(
              career.club,
              player.peakRating,
              careerStars
            );
            const isNegotiating = listedNegotiateId === player.id;
            const canAffordFee = getTransferBudget(career) >= dealFee;
            const wageCheck =
              effectiveDeal === "loan"
                ? Math.round(
                    (isNegotiating ? listedOfferWage : demand.wagePerYear) * 0.5
                  )
                : isNegotiating
                  ? listedOfferWage
                  : demand.wagePerYear;
            const canAffordAssistant =
              appeal.allowed &&
              canAffordFee &&
              canAffordAdditionalWage(career, wageCheck);
            const canAffordNegotiated =
              appeal.allowed &&
              canAffordFee &&
              canAffordAdditionalWage(career, wageCheck);
            return (
              <ManagerTransferPlayerCard
                key={`${tab}-${player.id}`}
                player={player}
                club={club}
                listed
                fee={dealFee}
                sellerListedFee={
                  effectiveDeal === "permanent" && listedPrice < buyerFee
                    ? listedPrice
                    : undefined
                }
                wagePerYear={isNegotiating ? listedOfferWage : demand.wagePerYear}
                yearsRequested={
                  isNegotiating ? listedOfferYears : demand.yearsRequested
                }
                watched={watchlistSet.has(player.id)}
                onToggleWatch={() => toggleWatchlist(player.id)}
              >
                {isNegotiating ? (
                  <div className="space-y-3">
                    {tab === "listed" &&
                      listingAllowsLoan(listingType) &&
                      listingAllowsPermanent(listingType) && (
                        <DealTypeToggle value={dealType} onChange={setDealType} />
                      )}
                    {effectiveDeal === "loan" ? (
                      <p className={`${TYPO.bodySm} text-pitch-400`}>
                        Loan until season end · fee {formatWage(loanFee)} · you
                        pay 50% of wages
                      </p>
                    ) : (
                      <p className={`${TYPO.bodySm} text-pitch-400`}>
                        Player demands: {formatWage(demand.wagePerYear)}/yr ·{" "}
                        {demand.yearsRequested}yr
                      </p>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className={TYPO.bodySm}>
                        <span className="text-pitch-500">Wage (£/yr)</span>
                        <input
                          type="number"
                          step={1000}
                          value={listedOfferWage}
                          onChange={(e) =>
                            setListedOfferWage(Number(e.target.value))
                          }
                          className={`${FILTER.input} mt-1`}
                        />
                      </label>
                      {effectiveDeal === "permanent" && (
                        <label className={TYPO.bodySm}>
                          <span className="text-pitch-500">Contract length</span>
                          <input
                            type="number"
                            min={1}
                            max={4}
                            value={listedOfferYears}
                            onChange={(e) =>
                              setListedOfferYears(Number(e.target.value))
                            }
                            className={`${FILTER.input} mt-1`}
                          />
                        </label>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <GameButton
                        variant="theme"
                        size="sm"
                        fullWidth
                        disabled={!canAffordNegotiated}
                        onClick={() =>
                          submitListedNegotiatedDeal(
                            player.id,
                            club,
                            effectiveDeal
                          )
                        }
                      >
                        Submit {effectiveDeal === "loan" ? "loan" : "offer"} —{" "}
                        {formatWage(dealFee)}
                      </GameButton>
                      <GameButton
                        variant="secondary"
                        size="sm"
                        fullWidth
                        onClick={() => {
                          playUiClick();
                          setListedNegotiateId(null);
                          setDealType(tab === "loans" ? "loan" : "permanent");
                        }}
                      >
                        Cancel
                      </GameButton>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tab === "loans" && (
                      <p className={`${TYPO.meta} text-sky-300`}>
                        Available on loan
                      </p>
                    )}
                    {tab === "listed" &&
                      listingAllowsLoan(listingType) &&
                      listingAllowsPermanent(listingType) && (
                        <DealTypeToggle value={dealType} onChange={setDealType} />
                      )}
                    <div className="grid gap-2 sm:grid-cols-2">
                    <GameButton
                      variant="theme"
                      size="sm"
                      fullWidth
                      disabled={!canAffordFee || !appeal.allowed}
                      onClick={() => {
                        setDealType(effectiveDeal);
                        openListedNegotiation(player.id);
                      }}
                    >
                      Negotiate {effectiveDeal === "loan" ? "loan" : "deal"}
                    </GameButton>
                    <GameButton
                      variant="secondary"
                      size="sm"
                      fullWidth
                      disabled={!canAffordAssistant}
                      onClick={() =>
                        submitListedAssistantDeal(
                          player.id,
                          club,
                          effectiveDeal
                        )
                      }
                    >
                      Leave to assistant
                    </GameButton>
                    </div>
                  </div>
                )}
              </ManagerTransferPlayerCard>
            );
          })}
          {listedPlayers.length === 0 && (
            <p className={`col-span-full ${TYPO.bodySm} text-pitch-400`}>
              {tab === "loans"
                ? "No players are currently listed for loan."
                : "No transfer-listed players available right now."}
            </p>
          )}
        </div>
      </section>
      )}

      {tab === "freeAgents" && (
      <section className="space-y-3">
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${SPACING.cardGridGap}`}>
          {freeAgents.map(({ player, formerClub, playerId, source }) => {
            const demand = getPlayerSigningDemand(career, player.id);
            const appeal = evaluateClubSigningAppeal(
              career.club,
              player.peakRating,
              careerStars
            );
            const isNegotiating = freeAgentNegotiateId === player.id;
            const canAffordAssistant =
              appeal.allowed &&
              canAffordAdditionalWage(career, demand.wagePerYear);
            const canAffordNegotiated =
              appeal.allowed &&
              canAffordAdditionalWage(career, freeAgentOfferWage);
            const age =
              getManagerPlayerAge(career, playerId) ??
              getManagerPlayerAge(career, player.id);
            return (
              <ManagerTransferPlayerCard
                key={playerId}
                player={player}
                club={formerClub}
                listed={false}
                freeAgent
                freeAgentSourceLabel={formatFreeAgentSource(source)}
                ageDisplay={age ?? "—"}
                fee={0}
                wagePerYear={isNegotiating ? freeAgentOfferWage : demand.wagePerYear}
                yearsRequested={
                  isNegotiating ? freeAgentOfferYears : demand.yearsRequested
                }
                watched={watchlistSet.has(playerId)}
                onToggleWatch={() => toggleWatchlist(playerId)}
              >
                {isNegotiating ? (
                  <div className="space-y-3">
                    <p className={`${TYPO.bodySm} text-pitch-400`}>
                      Player demands: {formatWage(demand.wagePerYear)}/yr ·{" "}
                      {demand.yearsRequested}yr
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <label className={TYPO.bodySm}>
                        <span className="text-pitch-500">Wage (£/yr)</span>
                        <input
                          type="number"
                          step={1000}
                          value={freeAgentOfferWage}
                          onChange={(e) =>
                            setFreeAgentOfferWage(Number(e.target.value))
                          }
                          className={`${FILTER.input} mt-1`}
                        />
                      </label>
                      <label className={TYPO.bodySm}>
                        <span className="text-pitch-500">Contract length</span>
                        <input
                          type="number"
                          min={1}
                          max={4}
                          value={freeAgentOfferYears}
                          onChange={(e) =>
                            setFreeAgentOfferYears(Number(e.target.value))
                          }
                          className={`${FILTER.input} mt-1`}
                        />
                      </label>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <GameButton
                        variant="theme"
                        size="sm"
                        fullWidth
                        disabled={!canAffordNegotiated}
                        onClick={() =>
                          submitFreeAgentNegotiatedDeal(playerId, formerClub)
                        }
                      >
                        Submit offer — Free
                      </GameButton>
                      <GameButton
                        variant="secondary"
                        size="sm"
                        fullWidth
                        onClick={() => {
                          playUiClick();
                          setFreeAgentNegotiateId(null);
                        }}
                      >
                        Cancel
                      </GameButton>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                    <GameButton
                      variant="theme"
                      size="sm"
                      fullWidth
                      disabled={!appeal.allowed}
                      onClick={() => openFreeAgentNegotiation(player.id)}
                    >
                      Negotiate deal
                    </GameButton>
                    <GameButton
                      variant="secondary"
                      size="sm"
                      fullWidth
                      disabled={!canAffordAssistant}
                      onClick={() =>
                        submitFreeAgentAssistantDeal(playerId, formerClub)
                      }
                    >
                      Leave to assistant
                    </GameButton>
                    </div>
                  </div>
                )}
              </ManagerTransferPlayerCard>
            );
          })}
          {freeAgents.length === 0 && (
            <p className={`col-span-full ${TYPO.bodySm} text-pitch-400`}>
              No free agents available right now. Players appear here when contracts
              expire at season end.
            </p>
          )}
        </div>
      </section>
      )}

      {tab === "unlisted" && (
      <section className="space-y-3">
        {(career.leagueTransfers ?? []).length > 0 ? (
          <ManagerSectionCard
            title="Completed transfer market"
            variant="inset"
            className="!p-2.5 sm:!p-4"
          >
            <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
              Permanent and free moves recorded this season — including Super League
              reserve signings by Championship clubs.
            </p>
            <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
              {(career.leagueTransfers ?? []).slice(0, 16).map((tx) => (
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
        ) : null}
        <input
          type="search"
          placeholder="Search by name or club…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={FILTER.input}
        />
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["rating", "Highest rating"],
              ["team", "Sort by team"],
              ["name", "Sort by name"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setLeagueSort(id)}
              className={`${FILTER.chipTouch} ${
                leagueSort === id ? FILTER.chipActive : "border-pitch-600 text-pitch-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${SPACING.cardGridGap}`}>
          {unlistedPlayers.map(({ player, club }) => {
            const listedPrice = getSellerAskingPrice(
              career,
              player.id,
              club,
              false
            );
            const buyerFee = getBuyerMinimumTransferFee(
              career,
              player.id,
              club,
              false
            );
            const loanFee = suggestedLoanFee(career, player.id, club, false);
            const appeal = evaluateClubSigningAppeal(
              career.club,
              player.peakRating,
              careerStars
            );
            const demand = getPlayerSigningDemand(career, player.id);
            const isOffering = offerPlayerId === player.id;
            const offerDealFee =
              dealType === "loan"
                ? loanFee
                : isOffering && offerFee > 0
                  ? offerFee
                  : buyerFee;
            const canAffordBid =
              appeal.allowed &&
              getTransferBudget(career) >=
                (dealType === "loan" ? loanFee : buyerFee);
            return (
              <ManagerTransferPlayerCard
                key={player.id}
                player={player}
                club={club}
                listed={false}
                fee={offerDealFee}
                sellerListedFee={
                  dealType === "permanent" && listedPrice < buyerFee
                    ? listedPrice
                    : undefined
                }
                wagePerYear={demand.wagePerYear}
                yearsRequested={demand.yearsRequested}
                watched={watchlistSet.has(player.id)}
                onToggleWatch={() => toggleWatchlist(player.id)}
              >
                {isOffering ? (
                  <div className="space-y-2">
                    <DealTypeToggle value={dealType} onChange={setDealType} />
                    {dealType === "loan" ? (
                      <p className={`${TYPO.bodySm} text-pitch-400`}>
                        Loan fee {formatWage(loanFee)} · rest of season · 50%
                        wages
                      </p>
                    ) : (
                      <label className={TYPO.bodySm}>
                        <span className="text-pitch-500">Your bid</span>
                        <input
                          type="number"
                          step={5000}
                          value={offerFee}
                          onChange={(e) => setOfferFee(Number(e.target.value))}
                          className={`${FILTER.input} mt-1`}
                        />
                      </label>
                    )}
                    <GameButton
                      variant="theme"
                      size="sm"
                      fullWidth
                      disabled={!appeal.allowed}
                      onClick={() =>
                        submitTransferOffer(
                          player.id,
                          club,
                          false,
                          dealType === "loan"
                            ? {
                                transferFee: loanFee,
                                wagePerYear: demand.wagePerYear,
                                yearsRequested: 1,
                              }
                            : undefined,
                          dealType
                        )
                      }
                    >
                      Submit{" "}
                      {dealType === "loan"
                        ? `loan — ${formatWage(loanFee)}`
                        : `${formatWage(offerFee)} offer`}
                    </GameButton>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <DealTypeToggle value={dealType} onChange={setDealType} />
                    <GameButton
                      variant="secondary"
                      size="sm"
                      fullWidth
                      disabled={!canAffordBid}
                      onClick={() => {
                        playUiClick();
                        setOfferPlayerId(player.id);
                        setOfferFee(buyerFee);
                      }}
                    >
                      {dealType === "loan"
                        ? `Loan — ${formatWage(loanFee)}`
                        : `Make offer — from ${formatWage(buyerFee)}`}
                    </GameButton>
                  </div>
                )}
              </ManagerTransferPlayerCard>
            );
          })}
          {unlistedPlayers.length === 0 && (
            <p className={`col-span-full ${TYPO.bodySm} text-pitch-400`}>
              {allUnlistedPlayers.length === 0
                ? "No unlisted players available to bid on right now."
                : "No unlisted players match your filters."}
            </p>
          )}
        </div>
      </section>
      )}

      {tab === "watch" && (
        <section aria-label="Watchlist">
          <div className={`grid gap-3 sm:grid-cols-2 ${SPACING.stackMd}`}>
            {watchedPlayers.map(
              ({ player, club, listed, freeAgent, playerId, listingType }) => {
              const demand = getPlayerSigningDemand(career, playerId);
              const canLoan = listed && listingAllowsLoan(listingType);
              const canBuy =
                freeAgent || (listed && listingAllowsPermanent(listingType)) || !listed;
              const fee = freeAgent
                ? 0
                : canLoan && !canBuy
                  ? suggestedLoanFee(career, playerId, club, listed)
                  : getBuyerMinimumTransferFee(career, playerId, club, listed);
              const loanFee = suggestedLoanFee(career, playerId, club, listed);
              return (
                <ManagerTransferPlayerCard
                  key={playerId}
                  player={player}
                  club={club}
                  listed={listed}
                  freeAgent={freeAgent}
                  fee={fee}
                  wagePerYear={demand.wagePerYear}
                  yearsRequested={demand.yearsRequested}
                  watched
                  onToggleWatch={() => toggleWatchlist(playerId)}
                >
                  <div className="space-y-2">
                    <p className={`${TYPO.bodySm} text-pitch-400`}>
                      {freeAgent
                        ? "Free agent on your watchlist."
                        : listed
                          ? canLoan && canBuy
                            ? "Listed — available permanently or on loan."
                            : canLoan
                              ? "Listed for loan."
                              : "Listed for transfer."
                          : "Unlisted — a bid will cost a premium."}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {canBuy && (
                        <GameButton
                          variant="theme"
                          size="sm"
                          fullWidth
                          onClick={() => {
                            if (freeAgent) {
                              switchTab("freeAgents");
                              setFreeAgentNegotiateId(playerId);
                              setFreeAgentOfferWage(demand.wagePerYear);
                              setFreeAgentOfferYears(demand.yearsRequested);
                            } else if (listed) {
                              switchTab("listed");
                              setDealType("permanent");
                              openListedNegotiation(playerId);
                            } else {
                              switchTab("unlisted");
                              setOfferPlayerId(playerId);
                            }
                          }}
                        >
                          {freeAgent ? "Negotiate" : "Make offer"}
                        </GameButton>
                      )}
                      {canLoan && (
                        <GameButton
                          variant="secondary"
                          size="sm"
                          fullWidth
                          onClick={() => {
                            switchTab("loans");
                            setDealType("loan");
                            openListedNegotiation(playerId);
                          }}
                        >
                          Loan — {formatWage(loanFee)}
                        </GameButton>
                      )}
                      <GameButton
                        variant="secondary"
                        size="sm"
                        fullWidth
                        onClick={() => toggleWatchlist(playerId)}
                      >
                        Remove watch
                      </GameButton>
                    </div>
                  </div>
                </ManagerTransferPlayerCard>
              );
            })}
            {watchedPlayers.length === 0 && (
              <p className={`col-span-full ${TYPO.bodySm} text-pitch-400`}>
                No players on your watchlist yet. Tap Watch on any transfer card
                or league squad player to track them here.
              </p>
            )}
          </div>
        </section>
      )}

      </ManagerSection>

      {transferResult && (
        <ManagerTransferResultModal
          result={transferResult}
          onClose={() => setTransferResult(null)}
        />
      )}
    </ManagerPage>
  );
}
