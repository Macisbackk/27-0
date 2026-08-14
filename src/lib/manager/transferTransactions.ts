/**
 * Canonical transfer transaction entry point.
 * All permanent / loan / reserve / FA moves should go through here when possible.
 */
import { getPlayerById } from "../players";
import { isSameManagerClub } from "../clubs/super-league-display";
import type { ManagerCareer, SquadRole } from "./types";
import {
  appendCanonicalTransferActivity,
  buildTransferActivity,
  clearAllMarketPresenceForPlayer,
  markTransferTxProcessed,
  wasTransferTxProcessed,
} from "./transferLedger";
import { getTransferEligibility } from "./transferEligibility";
import { logTransferInvariantFailure } from "./transferInvariants";
import {
  completeIncomingLoan,
  completeOutgoingLoan,
  getActiveLoan,
  recallLoan,
  returnExpiredLoans,
} from "./managerLoans";
import { completeFreeAgentSigning } from "./managerFreeAgents";
import type { BuyOffer } from "./managerTransferLeague";
import { completePlayerPurchase } from "./managerTransferLeague";
import { getManagerPlayer } from "./managerPlayers";

export type TransferTransactionType =
  | "PERMANENT"
  | "LOAN"
  | "LOAN_RETURN"
  | "RESERVE_TO_CHAMP"
  | "FREE_AGENT_SIGN"
  | "RELEASE_TO_FA"
  | "RECALL_LOAN";

export type TransferTransaction = {
  id: string;
  type: TransferTransactionType;
  playerId: string;
  fromClubId: string;
  toClubId: string;
  fee?: number;
  loanTerms?: {
    parentWageShare?: number;
    wagePerYear?: number;
    yearsRequested?: number;
    squadRole?: SquadRole;
    canRecall?: boolean;
    /** User is the loanee (loan in) vs parent (loan out). */
    direction: "in" | "out";
  };
  permanentOffer?: BuyOffer;
  listed?: boolean;
  meta?: {
    playerName?: string;
    skipInbox?: boolean;
    /** Pre-built career mutator for complex reserve/permanent paths. */
    apply?: (career: ManagerCareer) => ManagerCareer;
  };
};

export type TransferTransactionResult = {
  ok: boolean;
  career: ManagerCareer;
  error?: string;
  alreadyProcessed?: boolean;
};

function playerNameOf(career: ManagerCareer, playerId: string): string {
  return (
    getManagerPlayer(career, playerId)?.name ??
    getPlayerById(playerId)?.name ??
    "Player"
  );
}

/**
 * Apply one transfer transaction idempotently.
 * For complex permanent/reserve sales, pass meta.apply that performs the mutation;
 * this wrapper still enforces idempotency, history, and market clears.
 */
export function applyTransferTransaction(
  career: ManagerCareer,
  tx: TransferTransaction
): TransferTransactionResult {
  if (wasTransferTxProcessed(career, tx.id)) {
    return { ok: true, career, alreadyProcessed: true };
  }

  let next = career;
  const fee = Math.max(0, Math.round(tx.fee ?? 0));
  const playerName = tx.meta?.playerName ?? playerNameOf(career, tx.playerId);

  try {
    switch (tx.type) {
      case "PERMANENT": {
        if (tx.meta?.apply) {
          next = tx.meta.apply(next);
          break;
        }
        if (!tx.permanentOffer) {
          return { ok: false, career, error: "Permanent offer details missing." };
        }
        const eligibility = getTransferEligibility(
          next,
          tx.playerId,
          isSameManagerClub(tx.toClubId, next.club)
            ? "permanent_buy"
            : "permanent_sell",
          { fromClub: tx.fromClubId, toClub: tx.toClubId, listed: tx.listed }
        );
        if (!eligibility.allowed) {
          return { ok: false, career, error: eligibility.reason };
        }
        // Permanent buy/sell without apply must be provided by caller wrappers.
        return {
          ok: false,
          career,
          error: "Permanent transfer requires a bound apply mutator.",
        };
      }
      case "LOAN": {
        const direction = tx.loanTerms?.direction;
        if (direction === "in") {
          const eligibility = getTransferEligibility(next, tx.playerId, "loan_in", {
            fromClub: tx.fromClubId,
            toClub: tx.toClubId,
          });
          if (!eligibility.allowed) {
            return { ok: false, career, error: eligibility.reason };
          }
          next = completeIncomingLoan(next, tx.playerId, tx.fromClubId, {
            loanFee: fee,
            parentWageShare: tx.loanTerms?.parentWageShare,
            wagePerYear: tx.loanTerms?.wagePerYear,
            yearsRequested: tx.loanTerms?.yearsRequested,
            squadRole: tx.loanTerms?.squadRole,
          });
        } else if (direction === "out") {
          const eligibility = getTransferEligibility(next, tx.playerId, "loan_out", {
            fromClub: tx.fromClubId,
            toClub: tx.toClubId,
          });
          if (!eligibility.allowed) {
            return { ok: false, career, error: eligibility.reason };
          }
          next = completeOutgoingLoan(next, tx.playerId, tx.toClubId, {
            loanFee: fee,
            parentWageShare: tx.loanTerms?.parentWageShare,
            canRecall: tx.loanTerms?.canRecall ?? true,
          });
        } else {
          return { ok: false, career, error: "Loan direction required." };
        }
        if (!getActiveLoan(next, tx.playerId)) {
          return { ok: false, career, error: "Loan could not be completed." };
        }
        break;
      }
      case "LOAN_RETURN": {
        // Full season return pass (idempotent per season via tx id).
        next = returnExpiredLoans(next);
        break;
      }
      case "RECALL_LOAN": {
        next = recallLoan(next, tx.playerId);
        if (getActiveLoan(next, tx.playerId)) {
          return { ok: false, career, error: "Recall failed." };
        }
        break;
      }
      case "FREE_AGENT_SIGN": {
        const eligibility = getTransferEligibility(
          next,
          tx.playerId,
          "free_agent_sign"
        );
        if (!eligibility.allowed) {
          return { ok: false, career, error: eligibility.reason };
        }
        if (!tx.permanentOffer) {
          return { ok: false, career, error: "Free agent offer details missing." };
        }
        next = completeFreeAgentSigning(next, tx.playerId, tx.permanentOffer);
        break;
      }
      case "RESERVE_TO_CHAMP":
      case "RELEASE_TO_FA": {
        if (!tx.meta?.apply) {
          return {
            ok: false,
            career,
            error: `${tx.type} requires a bound apply mutator.`,
          };
        }
        next = tx.meta.apply(next);
        break;
      }
      default:
        return { ok: false, career, error: "Unknown transaction type." };
    }
  } catch (err) {
    return {
      ok: false,
      career,
      error: err instanceof Error ? err.message : "Transfer failed.",
    };
  }

  // Market presence must clear after completed moves (except pure loan-return batch).
  if (tx.type !== "LOAN_RETURN") {
    next = clearAllMarketPresenceForPlayer(next, tx.playerId);
  }

  // Loans already append history inside completeIncoming/OutgoingLoan.
  const skipHistory =
    tx.type === "LOAN_RETURN" ||
    tx.type === "LOAN" ||
    Boolean(tx.meta?.skipInbox);

  if (!skipHistory) {
    const transferType =
      tx.type === "RECALL_LOAN"
        ? "loan"
        : fee <= 0 && tx.type === "FREE_AGENT_SIGN"
          ? "free"
          : "permanent";
    next = appendCanonicalTransferActivity(
      next,
      buildTransferActivity({
        id: `hist-${tx.id}`,
        career: next,
        playerId: tx.playerId,
        playerName,
        fromClub: tx.fromClubId,
        toClub: tx.toClubId,
        fee,
        transferType,
        sourceSquad:
          tx.type === "RESERVE_TO_CHAMP"
            ? "reserve"
            : tx.type === "FREE_AGENT_SIGN"
              ? "free-agent"
              : "senior",
      })
    );
  }

  next = markTransferTxProcessed(next, tx.id);
  logTransferInvariantFailure(next, tx.playerId, `tx:${tx.type}`);
  return { ok: true, career: next };
}

/** Helper for wrappers that already mutated career and only need ledger finalize. */
export function finalizeAppliedTransfer(
  career: ManagerCareer,
  tx: Pick<
    TransferTransaction,
    "id" | "type" | "playerId" | "fromClubId" | "toClubId" | "fee"
  > & { playerName?: string; sourceSquad?: "senior" | "reserve" | "free-agent" }
): ManagerCareer {
  if (wasTransferTxProcessed(career, tx.id)) return career;
  let next = clearAllMarketPresenceForPlayer(career, tx.playerId);
  const fee = Math.max(0, Math.round(tx.fee ?? 0));
  const transferType =
    tx.type === "LOAN" || tx.type === "LOAN_RETURN" || tx.type === "RECALL_LOAN"
      ? ("loan" as const)
      : fee <= 0 && tx.type === "FREE_AGENT_SIGN"
        ? ("free" as const)
        : ("permanent" as const);
  next = appendCanonicalTransferActivity(
    next,
    buildTransferActivity({
      id: `hist-${tx.id}`,
      career: next,
      playerId: tx.playerId,
      playerName: tx.playerName ?? playerNameOf(next, tx.playerId),
      fromClub: tx.fromClubId,
      toClub: tx.toClubId,
      fee,
      transferType,
      sourceSquad: tx.sourceSquad ?? "senior",
    })
  );
  return markTransferTxProcessed(next, tx.id);
}

function txId(
  career: ManagerCareer,
  kind: string,
  playerId: string
): string {
  return `${kind}-${playerId}-s${career.seasonYear}-w${career.gameWeek}-${career.fixtures.length}`;
}

export function executePermanentBuy(
  career: ManagerCareer,
  playerId: string,
  fromClub: string,
  offer: BuyOffer,
  listed: boolean
): TransferTransactionResult {
  return applyTransferTransaction(career, {
    id: txId(career, "buy", playerId),
    type: "PERMANENT",
    playerId,
    fromClubId: fromClub,
    toClubId: career.club,
    fee: offer.transferFee,
    permanentOffer: offer,
    listed,
    meta: {
      skipInbox: true,
      apply: (next) =>
        completePlayerPurchase(next, playerId, fromClub, offer, listed),
    },
  });
}

export function executeLoanIn(
  career: ManagerCareer,
  playerId: string,
  fromClub: string,
  opts: {
    loanFee: number;
    parentWageShare?: number;
    wagePerYear?: number;
    yearsRequested?: number;
    squadRole?: SquadRole;
  }
): TransferTransactionResult {
  return applyTransferTransaction(career, {
    id: txId(career, "loan-in", playerId),
    type: "LOAN",
    playerId,
    fromClubId: fromClub,
    toClubId: career.club,
    fee: opts.loanFee,
    loanTerms: {
      direction: "in",
      parentWageShare: opts.parentWageShare,
      wagePerYear: opts.wagePerYear,
      yearsRequested: opts.yearsRequested,
      squadRole: opts.squadRole,
    },
  });
}

export function executeLoanOut(
  career: ManagerCareer,
  playerId: string,
  toClub: string,
  opts: {
    loanFee: number;
    parentWageShare?: number;
    canRecall?: boolean;
  }
): TransferTransactionResult {
  return applyTransferTransaction(career, {
    id: txId(career, "loan-out", playerId),
    type: "LOAN",
    playerId,
    fromClubId: career.club,
    toClubId: toClub,
    fee: opts.loanFee,
    loanTerms: {
      direction: "out",
      parentWageShare: opts.parentWageShare,
      canRecall: opts.canRecall,
    },
  });
}

export function executeFreeAgentSign(
  career: ManagerCareer,
  playerId: string,
  offer: BuyOffer
): TransferTransactionResult {
  return applyTransferTransaction(career, {
    id: txId(career, "fa", playerId),
    type: "FREE_AGENT_SIGN",
    playerId,
    fromClubId: "free-agent",
    toClubId: career.club,
    fee: 0,
    permanentOffer: offer,
  });
}

export function executeAiPermanentMove(
  career: ManagerCareer,
  apply: (next: ManagerCareer) => ManagerCareer,
  details: {
    playerId: string;
    fromClub: string;
    toClub: string;
    fee: number;
  }
): TransferTransactionResult {
  return applyTransferTransaction(career, {
    id: txId(career, "ai", details.playerId),
    type: "PERMANENT",
    playerId: details.playerId,
    fromClubId: details.fromClub,
    toClubId: details.toClub,
    fee: details.fee,
    meta: { skipInbox: true, apply },
  });
}
