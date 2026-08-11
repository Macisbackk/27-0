"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { GameButton } from "@/components/ui/GameButton";
import {
  ManagerLeagueTransferCard,
  ManagerTransferPlayerCard,
} from "@/components/manager/ManagerTransferPlayerCard";
import {
  ManagerTransferResultModal,
  type TransferResultDetails,
} from "@/components/manager/ManagerTransferResultModal";
import { ManagerTransferDebugPanel } from "@/components/manager/ManagerTransferDebugPanel";
import { ManagerPage, ManagerSection, ManagerSectionCard, ManagerStat } from "@/components/manager/manager-ui";
import {
  canAffordAdditionalWage,
  evaluateClubSigningAppeal,
  getComfortableSigningRating,
  getTransferBudget,
  getWageBillPercent,
  isPlayerReachableOnTransferMarket,
  isWageOverBudget,
} from "@/lib/manager/managerFinance";
import { getCareerClubStars } from "@/lib/manager/managerDifficulty";
import { getUserCompetitionId } from "@/lib/manager/leagueMembership";
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
  getBuyerMinimumTransferFee,
  getProtectedTransferPlayerIds,
  getSellerAskingPrice,
  listingAllowsLoan,
  listingAllowsPermanent,
} from "@/lib/manager/managerTransferLeague";
import {
  buildLeaguePlayerClubMap,
  findPlayerLeagueClub,
} from "@/lib/manager/managerLeagueRosters";
import {
  completeIncomingLoan,
  canUserLoanInPlayers,
  evaluateLoanWageShareOffer,
  isValidLoanDirection,
  normalizeLoanWageSharePct,
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

/** Cap cards per tab so Championship-sized markets stay interactive. */
const TRANSFER_CARD_PAGE = 24;

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
  const [listedOfferLoanSharePct, setListedOfferLoanSharePct] = useState(50);
  const [offerLoanSharePct, setOfferLoanSharePct] = useState(50);
  const [freeAgentNegotiateId, setFreeAgentNegotiateId] = useState<string | null>(
    null
  );
  const [freeAgentOfferWage, setFreeAgentOfferWage] = useState(0);
  const [freeAgentOfferYears, setFreeAgentOfferYears] = useState(1);
  const [visibleLimit, setVisibleLimit] = useState(TRANSFER_CARD_PAGE);
  const [transferDebugId, setTransferDebugId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setTransferDebugId(
      new URLSearchParams(window.location.search).get("transferDebug")
    );
  }, []);

  const wageOverBudget = isWageOverBudget(career);
  const wagePct = getWageBillPercent(career);
  const transferFund = getTransferBudget(career);
  const deferredSearch = useDeferredValue(search);

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

  useEffect(() => {
    setVisibleLimit(TRANSFER_CARD_PAGE);
  }, [tab, positionFilter, deferredSearch, leagueSort]);

  const toggleWatchlist = (playerId: string) => {
    playUiClick();
    onUpdate(toggleTransferWatchlist(career, playerId));
  };

  /** Full club→player index — only for the Bid tab (hundreds of players). */
  const leagueClubByPlayerId = useMemo(() => {
    if (tab !== "unlisted") return null;
    return buildLeaguePlayerClubMap(career);
  }, [career, tab]);

  const careerStars = getCareerClubStars(career);
  const competition = getUserCompetitionId(career);
  const canLoanIn = canUserLoanInPlayers(career);
  const comfortableTarget = getComfortableSigningRating(
    career.club,
    careerStars,
    competition
  );

  /** Lightweight Bid-tab index (no fee math / card props until visible). */
  const unlistedIndex = useMemo(() => {
    if (tab !== "unlisted" || !leagueClubByPlayerId) return [];
    const activeLoanIds = new Set(
      (career.activeLoans ?? []).map((loan) => loan.playerId)
    );
    const rows: {
      playerId: string;
      club: string;
      nameKey: string;
      clubKey: string;
      peakRating: number;
      positions: Position[];
    }[] = [];
    for (const [playerId, club] of leagueClubByPlayerId) {
      if (listedPlayerIds.has(playerId) || freeAgentIds.has(playerId)) continue;
      if (activeLoanIds.has(playerId)) continue;
      const raw =
        getManagerPlayer(career, playerId) ?? getPlayerById(playerId);
      if (!raw) continue;
      if (
        !isPlayerReachableOnTransferMarket(career.club, raw.peakRating, careerStars, competition)
      ) {
        continue;
      }
      rows.push({
        playerId,
        club,
        nameKey: raw.name.toLowerCase(),
        clubKey: club.toLowerCase(),
        peakRating: raw.peakRating,
        positions: getPlayerEligiblePositions(raw),
      });
    }
    return rows;
  }, [
    tab,
    leagueClubByPlayerId,
    career,
    career.club,
    career.activeLoans,
    careerStars,
    listedPlayerIds,
    freeAgentIds,
  ]);

  const tabCounts = useMemo(
    () => ({
      listed: career.leagueListedPlayers.filter((entry) => {
        if (isSameManagerClub(entry.club, career.club)) return false;
        if (!listingAllowsPermanent(entry.listingType)) return false;
        const player =
          getManagerPlayer(career, entry.playerId) ??
          getPlayerById(entry.playerId);
        if (!player) return false;
        return isPlayerReachableOnTransferMarket(career.club, player.peakRating, careerStars, competition);
      }).length,
      loans: canUserLoanInPlayers(career)
        ? career.leagueListedPlayers.filter((entry) => {
            if (isSameManagerClub(entry.club, career.club)) return false;
            if (!listingAllowsLoan(entry.listingType)) return false;
            if (!isValidLoanDirection(career, entry.club, career.club)) {
              return false;
            }
            const player =
              getManagerPlayer(career, entry.playerId) ??
              getPlayerById(entry.playerId);
            return Boolean(player);
          }).length
        : 0,
      freeAgents: (career.freeAgents ?? []).filter((entry) => {
        const player =
          getManagerPlayer(career, entry.playerId) ??
          getPlayerById(entry.playerId);
        if (!player) return false;
        return isPlayerReachableOnTransferMarket(career.club, player.peakRating, careerStars, competition);
      }).length,
      watch: watchlistIds.filter((playerId) => {
        const player =
          getManagerPlayer(career, playerId) ?? getPlayerById(playerId);
        if (!player) return false;
        return isPlayerReachableOnTransferMarket(career.club, player.peakRating, careerStars, competition);
      }).length,
    }),
    [
      career,
      career.leagueListedPlayers,
      career.club,
      career.freeAgents,
      careerStars,
      competition,
      watchlistIds,
    ]
  );

  const listedPlayers = useMemo(() => {
    if (tab !== "listed" && tab !== "loans") return [];
    if (tab === "loans" && !canLoanIn) return [];
    return career.leagueListedPlayers
      .filter((entry) => !isSameManagerClub(entry.club, career.club))
      .filter((entry) =>
        tab === "loans"
          ? listingAllowsLoan(entry.listingType) &&
            isValidLoanDirection(career, entry.club, career.club)
          : listingAllowsPermanent(entry.listingType)
      )
      .map((entry) => {
        const raw =
          getManagerPlayer(career, entry.playerId) ??
          getPlayerById(entry.playerId);
        if (!raw) return null;
        return { ...entry, player: withManagerRating(raw) };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .filter((r) => {
        // Permanent market uses reach; loan market is SL→Champ development only.
        if (tab === "loans") return true;
        return isPlayerReachableOnTransferMarket(
          career.club,
          r.player.peakRating,
          careerStars,
          competition
        );
      })
      .filter((r) => {
        if (positionFilter === "all") return true;
        return getPlayerEligiblePositions(r.player).includes(positionFilter);
      })
      .sort((a, b) => b.player.peakRating - a.player.peakRating);
  }, [
    career,
    career.leagueListedPlayers,
    career.club,
    career.playerRegistry,
    career.championshipSquads,
    career.playerDevelopment,
    career.seasonYear,
    careerStars,
    canLoanIn,
    positionFilter,
    tab,
  ]);

  useEffect(() => {
    if (tab === "loans" && !canLoanIn) {
      setTab("listed");
      setDealType("permanent");
    } else if (!canLoanIn && dealType === "loan") {
      setDealType("permanent");
    }
  }, [tab, canLoanIn, dealType]);

  const freeAgents = useMemo(() => {
    if (tab !== "freeAgents") return [];
    return (career.freeAgents ?? [])
      .map((entry) => {
        const raw =
          getManagerPlayer(career, entry.playerId) ??
          getPlayerById(entry.playerId);
        if (!raw) return null;
        return { ...entry, player: withManagerRating(raw) };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .filter((r) =>
        isPlayerReachableOnTransferMarket(career.club, r.player.peakRating, careerStars, competition)
      )
      .filter((r) => {
        if (positionFilter === "all") return true;
        return getPlayerEligiblePositions(r.player).includes(positionFilter);
      })
      .sort((a, b) => b.player.peakRating - a.player.peakRating);
  }, [
    tab,
    career.freeAgents,
    career.club,
    career.playerRegistry,
    career.championshipSquads,
    career.playerDevelopment,
    career.seasonYear,
    careerStars,
    positionFilter,
  ]);

  const filteredUnlistedIndex = useMemo(() => {
    if (tab !== "unlisted") return [];
    const q = deferredSearch.trim().toLowerCase();
    return unlistedIndex
      .filter((r) => {
        if (!q) return true;
        return r.nameKey.includes(q) || r.clubKey.includes(q);
      })
      .filter((r) => {
        if (positionFilter === "all") return true;
        return r.positions.includes(positionFilter);
      })
      .sort((a, b) => {
        if (leagueSort === "team") {
          return (
            a.club.localeCompare(b.club) || b.peakRating - a.peakRating
          );
        }
        if (leagueSort === "name") {
          return a.nameKey.localeCompare(b.nameKey);
        }
        return b.peakRating - a.peakRating;
      });
  }, [tab, unlistedIndex, deferredSearch, positionFilter, leagueSort]);

  const unlistedPlayers = useMemo(() => {
    if (tab !== "unlisted") return [];
    return filteredUnlistedIndex.slice(0, visibleLimit).flatMap((row) => {
      const managed = getManagerPlayer(career, row.playerId);
      const raw = managed ?? getPlayerById(row.playerId);
      if (!raw) return [];
      return [
        {
          playerId: row.playerId,
          club: row.club,
          player: managed ? raw : withManagerRating(raw),
        },
      ];
    });
  }, [tab, filteredUnlistedIndex, visibleLimit, career]);

  const watchedPlayers = useMemo(() => {
    if (tab !== "watch") return [];
    const listedById = new Map(
      career.leagueListedPlayers.map((entry) => [entry.playerId, entry])
    );
    const freeById = new Map(
      (career.freeAgents ?? []).map((entry) => [entry.playerId, entry])
    );
    return watchlistIds
      .map((playerId) => {
        const listed = listedById.get(playerId);
        const free = freeById.get(playerId);
        const raw =
          getManagerPlayer(career, playerId) ?? getPlayerById(playerId);
        if (!raw) return null;
        const player = withManagerRating(raw);
        if (
          !isPlayerReachableOnTransferMarket(career.club, player.peakRating, careerStars, competition)
        ) {
          return null;
        }
        return {
          playerId,
          player,
          club:
            listed?.club ??
            free?.formerClub ??
            findPlayerLeagueClub(career, playerId) ??
            "Unknown",
          listed: Boolean(listed),
          freeAgent: Boolean(free),
          listingType: listed?.listingType,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }, [
    tab,
    watchlistIds,
    career,
    career.club,
    careerStars,
  ]);

  const visibleListedPlayers = listedPlayers.slice(0, visibleLimit);
  const visibleFreeAgents = freeAgents.slice(0, visibleLimit);
  const visibleUnlistedPlayers = unlistedPlayers;

  const submitTransferOffer = (
    playerId: string,
    club: string,
    listed: boolean,
    offerOverride?: {
      transferFee: number;
      wagePerYear: number;
      yearsRequested: number;
      /** Share of wages the user (loanee) pays, 0–1. Defaults to 50%. */
      loanUserWageShare?: number;
    },
    dealOverride?: DealType
  ) => {
    const player =
      getManagerPlayer(career, playerId) ?? getPlayerById(playerId);
    const demand = getPlayerSigningDemand(career, playerId);
    const type = dealOverride ?? dealType;

    if (type === "loan") {
      if (
        !canUserLoanInPlayers(career) ||
        !isValidLoanDirection(career, club, career.club)
      ) {
        setTransferResult({
          playerName: player?.name ?? "Player",
          club,
          fee: 0,
          wagePerYear: 0,
          years: 1,
          accepted: false,
          reason:
            "Loans: Super League → Championship only.",
        });
        playTransferOffer();
        return;
      }
      const loanFee =
        offerOverride?.transferFee ??
        suggestedLoanFee(career, playerId, club, listed);
      const wagePerYear = offerOverride?.wagePerYear ?? demand.wagePerYear;
      const shareEval = evaluateLoanWageShareOffer(
        career,
        playerId,
        offerOverride?.loanUserWageShare ?? 0.5
      );
      const loaneeWageShare = shareEval.userWageShare;
      const parentWageShare = 1 - loaneeWageShare;
      const loaneeWage = Math.round(wagePerYear * loaneeWageShare);
      const canAfford =
        getTransferBudget(career) >= loanFee &&
        canAffordAdditionalWage(career, loaneeWage);
      const accepted =
        shareEval.accepted && canAfford && career.squad.length < 35;
      const sharePct = Math.round(loaneeWageShare * 100);
      setTransferResult({
        playerName: player?.name ?? "Player",
        club,
        fee: loanFee,
        wagePerYear: loaneeWage,
        years: 1,
        accepted,
        loanWageSharePct: sharePct,
        reason: accepted
          ? `Loan agreed until end of season (no fee · you pay ${sharePct}% of wages).`
          : !shareEval.accepted
            ? shareEval.reason
            : !canAfford
              ? "Cannot afford that wage share on this loan."
              : "Squad is full.",
      });
      if (accepted) {
        playTransferComplete();
        const afterLoan = completeIncomingLoan(career, playerId, club, {
          loanFee,
          parentWageShare,
          wagePerYear,
          yearsRequested: 1,
          squadRole: demand.squadRole,
        });
        if (!afterLoan.squad.some((p) => p.playerId === playerId)) {
          setTransferResult({
            playerName: player?.name ?? "Player",
            club,
            fee: loanFee,
            wagePerYear: loaneeWage,
            years: 1,
            accepted: false,
            reason:
              "Club refused the loan — try a listed loan target, or a non-core player.",
          });
          playTransferOffer();
          return;
        }
        onUpdate(afterLoan);
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
    setListedOfferLoanSharePct(50);
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
        loanUserWageShare: 0.5,
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
    const sharePct = normalizeLoanWageSharePct(listedOfferLoanSharePct);
    playUiClick();
    submitTransferOffer(
      playerId,
      club,
      true,
      {
        transferFee: fee,
        wagePerYear: listedOfferWage,
        yearsRequested: listedOfferYears,
        loanUserWageShare: sharePct / 100,
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
    startTransition(() => {
      setTab(next);
      setListedNegotiateId(null);
      setFreeAgentNegotiateId(null);
      setOfferPlayerId(null);
      setDealType(next === "loans" ? "loan" : "permanent");
      setVisibleLimit(TRANSFER_CARD_PAGE);
    });
  };

  const showMoreButton = (total: number) =>
    total > visibleLimit ? (
      <div className="col-span-full flex justify-center pt-1">
        <GameButton
          variant="secondary"
          size="sm"
          onClick={() => {
            playUiClick();
            setVisibleLimit((n) => n + TRANSFER_CARD_PAGE);
          }}
        >
          Show more ({Math.min(TRANSFER_CARD_PAGE, total - visibleLimit)} of{" "}
          {total - visibleLimit} remaining)
        </GameButton>
      </div>
    ) : null;

  const transferSubTabs = (
    [
      ["listed", tabCounts.listed],
      ["loans", tabCounts.loans],
      ["freeAgents", tabCounts.freeAgents],
      ["unlisted", null],
      ["watch", tabCounts.watch],
    ] as const
  )
    .filter(([id]) => id !== "loans" || canLoanIn)
    .map(([id, count]) => ({
      id,
      label: `${TRANSFER_TAB_LABELS[id]}${count != null && count > 0 ? ` (${count})` : ""}`,
      shortLabel: `${TRANSFER_TAB_SHORT_LABELS[id]}${count != null && count > 0 ? ` (${count})` : ""}`,
    }));

  const tabSubtitle =
    tab === "listed"
      ? "On the market"
      : tab === "loans"
        ? "Season-long loans · set wage %"
        : tab === "freeAgents"
          ? "No fee · wages only"
          : tab === "watch"
            ? "Your shortlist"
            : canLoanIn
              ? "Permanent bid or season loan (SL → Champ)"
              : "Make an offer";

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
          Reach ~{comfortableTarget} OVR
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
                      {outgoing
                        ? `LOANED TO: ${loan.loaneeClub} · Returns end of season`
                        : `ON LOAN from ${loan.parentClub} · Returns end of season`}
                      {loan.loanFee > 0
                        ? ` · Fee ${formatWage(loan.loanFee)}`
                        : ""}
                      {` · You pay ${Math.round((outgoing ? loan.parentWageShare : 1 - loan.parentWageShare) * 100)}% wages`}
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
          {visibleListedPlayers.map(({ player, club, listingType, askingPrice }) => {
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
            const loanFee = suggestedLoanFee(career, player.id, club, true);
            const sellerAllowsLoanIn =
              canLoanIn &&
              listingAllowsLoan(listingType) &&
              isValidLoanDirection(career, club, career.club);
            const effectiveDeal: DealType =
              tab === "loans"
                ? "loan"
                : dealType === "loan" && sellerAllowsLoanIn
                  ? "loan"
                  : "permanent";
            const dealFee = effectiveDeal === "loan" ? loanFee : buyerFee;
            const appeal = evaluateClubSigningAppeal(career.club, player.peakRating, careerStars, competition);
            const isNegotiating = listedNegotiateId === player.id;
            const canAffordFee = getTransferBudget(career) >= dealFee;
            const wageCheck =
              effectiveDeal === "loan"
                ? Math.round(
                    demand.wagePerYear *
                      (isNegotiating
                        ? normalizeLoanWageSharePct(listedOfferLoanSharePct) /
                          100
                        : 0.5)
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
                listingType={listingType}
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
                      sellerAllowsLoanIn &&
                      listingAllowsPermanent(listingType) && (
                        <DealTypeToggle value={dealType} onChange={setDealType} />
                      )}
                    {effectiveDeal === "loan" ? (
                      <>
                        <p className={`${TYPO.bodySm} text-pitch-400`}>
                          Season loan · no fee · set your wage %
                        </p>
                        <label className={TYPO.bodySm}>
                          <span className="text-pitch-500">
                            Your wage share (%)
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={5}
                            value={listedOfferLoanSharePct}
                            onChange={(e) =>
                              setListedOfferLoanSharePct(
                                Number(e.target.value)
                              )
                            }
                            onBlur={() =>
                              setListedOfferLoanSharePct(
                                normalizeLoanWageSharePct(
                                  listedOfferLoanSharePct
                                )
                              )
                            }
                            className={`${FILTER.input} mt-1`}
                          />
                          <span className={`mt-1 block ${TYPO.meta} text-pitch-500`}>
                            You pay{" "}
                            {formatWage(
                              Math.round(
                                demand.wagePerYear *
                                  (normalizeLoanWageSharePct(
                                    listedOfferLoanSharePct
                                  ) /
                                    100)
                              )
                            )}
                            /yr · parent keeps{" "}
                            {100 -
                              normalizeLoanWageSharePct(
                                listedOfferLoanSharePct
                              )}
                            %
                          </span>
                        </label>
                      </>
                    ) : (
                      <>
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
                              value={listedOfferWage}
                              onChange={(e) =>
                                setListedOfferWage(Number(e.target.value))
                              }
                              className={`${FILTER.input} mt-1`}
                            />
                          </label>
                          <label className={TYPO.bodySm}>
                            <span className="text-pitch-500">
                              Contract length
                            </span>
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
                        </div>
                      </>
                    )}
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
                        Submit{" "}
                        {effectiveDeal === "loan"
                          ? `${normalizeLoanWageSharePct(listedOfferLoanSharePct)}% loan`
                          : `offer — ${formatWage(dealFee)}`}
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
                      sellerAllowsLoanIn &&
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
                      {effectiveDeal === "loan" ? "Offer loan" : "Make offer"}
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
                ? "No Super League loan listings right now. Use Bid and switch to Loan for fringe Super League players, or check again after the market refreshes."
                : "No transfer-listed players available right now."}
            </p>
          )}
          {showMoreButton(listedPlayers.length)}
        </div>
      </section>
      )}

      {tab === "freeAgents" && (
      <section className="space-y-3">
        <div className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${SPACING.cardGridGap}`}>
          {visibleFreeAgents.map(({ player, formerClub, playerId, source }) => {
            const demand = getPlayerSigningDemand(career, player.id);
            const appeal = evaluateClubSigningAppeal(career.club, player.peakRating, careerStars, competition);
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
                      Make offer
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
              No free agents available right now. The pool tops up during the
              season and when contracts expire.
            </p>
          )}
          {showMoreButton(freeAgents.length)}
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
                  transferType={tx.transferType}
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
          {visibleUnlistedPlayers.map(({ player, club }) => {
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
            const canLoanThisClub =
              canLoanIn &&
              isValidLoanDirection(career, club, career.club) &&
              !getProtectedTransferPlayerIds(career, club).has(player.id);
            const unlistedDeal: DealType =
              dealType === "loan" && canLoanThisClub ? "loan" : "permanent";
            const appeal = evaluateClubSigningAppeal(career.club, player.peakRating, careerStars, competition);
            const demand = getPlayerSigningDemand(career, player.id);
            const isOffering = offerPlayerId === player.id;
            const offerDealFee =
              unlistedDeal === "loan"
                ? loanFee
                : isOffering && offerFee > 0
                  ? offerFee
                  : buyerFee;
            const canAffordBid =
              appeal.allowed &&
              getTransferBudget(career) >=
                (unlistedDeal === "loan" ? loanFee : buyerFee);
            return (
              <ManagerTransferPlayerCard
                key={player.id}
                player={player}
                club={club}
                listed={false}
                fee={offerDealFee}
                sellerListedFee={
                  unlistedDeal === "permanent" && listedPrice < buyerFee
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
                    {canLoanThisClub && (
                      <DealTypeToggle value={dealType} onChange={setDealType} />
                    )}
                    {unlistedDeal === "loan" ? (
                      <>
                        <p className={`${TYPO.bodySm} text-pitch-400`}>
                          Season loan · no fee · set your wage %
                        </p>
                        <label className={TYPO.bodySm}>
                          <span className="text-pitch-500">
                            Your wage share (%)
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={5}
                            value={offerLoanSharePct}
                            onChange={(e) =>
                              setOfferLoanSharePct(Number(e.target.value))
                            }
                            onBlur={() =>
                              setOfferLoanSharePct(
                                normalizeLoanWageSharePct(offerLoanSharePct)
                              )
                            }
                            className={`${FILTER.input} mt-1`}
                          />
                          <span className={`mt-1 block ${TYPO.meta} text-pitch-500`}>
                            You pay{" "}
                            {formatWage(
                              Math.round(
                                demand.wagePerYear *
                                  (normalizeLoanWageSharePct(offerLoanSharePct) /
                                    100)
                              )
                            )}
                            /yr
                          </span>
                        </label>
                      </>
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
                      disabled={
                        !appeal.allowed ||
                        (unlistedDeal === "loan" &&
                          !canAffordAdditionalWage(
                            career,
                            Math.round(
                              demand.wagePerYear *
                                (normalizeLoanWageSharePct(offerLoanSharePct) /
                                  100)
                            )
                          ))
                      }
                      onClick={() =>
                        submitTransferOffer(
                          player.id,
                          club,
                          false,
                          unlistedDeal === "loan"
                            ? {
                                transferFee: loanFee,
                                wagePerYear: demand.wagePerYear,
                                yearsRequested: 1,
                                loanUserWageShare:
                                  normalizeLoanWageSharePct(offerLoanSharePct) /
                                  100,
                              }
                            : undefined,
                          unlistedDeal
                        )
                      }
                    >
                      Submit{" "}
                      {unlistedDeal === "loan"
                        ? `${normalizeLoanWageSharePct(offerLoanSharePct)}% loan`
                        : `${formatWage(offerFee)} offer`}
                    </GameButton>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {canLoanThisClub && (
                      <DealTypeToggle value={dealType} onChange={setDealType} />
                    )}
                    <GameButton
                      variant="secondary"
                      size="sm"
                      fullWidth
                      disabled={!canAffordBid}
                      onClick={() => {
                        playUiClick();
                        setOfferPlayerId(player.id);
                        setOfferFee(buyerFee);
                        setOfferLoanSharePct(50);
                        if (!canLoanThisClub) setDealType("permanent");
                      }}
                    >
                      {unlistedDeal === "loan"
                        ? "Offer loan"
                        : `Make offer — from ${formatWage(buyerFee)}`}
                    </GameButton>
                  </div>
                )}
              </ManagerTransferPlayerCard>
            );
          })}
          {filteredUnlistedIndex.length === 0 && (
            <p className={`col-span-full ${TYPO.bodySm} text-pitch-400`}>
              {unlistedIndex.length === 0
                ? "No unlisted players available to bid on right now."
                : "No unlisted players match your filters."}
            </p>
          )}
          {filteredUnlistedIndex.length > 0 && (
            <p className={`col-span-full ${TYPO.meta} text-pitch-500`}>
              Showing{" "}
              {Math.min(visibleLimit, filteredUnlistedIndex.length)} of{" "}
              {filteredUnlistedIndex.length}
              {deferredSearch.trim() ? " matching" : ""} players — use search
              or position filters to narrow the market.
            </p>
          )}
          {showMoreButton(filteredUnlistedIndex.length)}
        </div>
      </section>
      )}

      {tab === "watch" && (
        <section aria-label="Watchlist">
          <div className={`grid gap-3 sm:grid-cols-2 ${SPACING.stackMd}`}>
            {watchedPlayers.map(
              ({ player, club, listed, freeAgent, playerId, listingType }) => {
              const demand = getPlayerSigningDemand(career, playerId);
              const canLoan =
                canLoanIn &&
                listed &&
                listingAllowsLoan(listingType) &&
                isValidLoanDirection(career, club, career.club);
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
                  listingType={listingType}
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
                          Make offer
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
                          Offer loan
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
      {transferDebugId ? (
        <ManagerTransferDebugPanel career={career} playerId={transferDebugId} />
      ) : null}
    </ManagerPage>
  );
}
