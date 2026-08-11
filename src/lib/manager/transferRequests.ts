/**
 * Lean transfer-request system — unhappy first-team players ask to leave.
 * Does not auto-list; manager must list/reject/ignore.
 * Boosted when an active transfer-interest story chain exists.
 */
import seedrandom from "seedrandom";
import { getPlayerById } from "../players";
import type { ManagerCareer, PlayerTransferStatus } from "./types";
import { isPlayerAwayOnLoan, isPlayerLoanedIn } from "./managerLoans";
import { pushInboxMessage, normalizeInboxMessage } from "./managerInbox";
import { getContractStatus } from "./managerContracts";
import { getWorldStory } from "./managerWorldStory";

const REQUEST_CHANCE = 0.08;
const CHAIN_REQUEST_CHANCE = 0.4;

/** Clear a transfer request without listing. */
export function dismissTransferRequest(
  career: ManagerCareer,
  playerId: string
): ManagerCareer {
  const prev = career.playerTransferStatus[playerId];
  if (!prev?.transferRequested) return career;
  const nextStatus = { ...career.playerTransferStatus };
  if (prev.listed) {
    nextStatus[playerId] = { ...prev, transferRequested: false };
  } else {
    delete nextStatus[playerId];
  }
  return {
    ...career,
    playerTransferStatus: nextStatus,
    updatedAt: new Date().toISOString(),
  };
}

export function maybeGenerateTransferRequests(
  career: ManagerCareer
): ManagerCareer {
  const rng = seedrandom(
    `${career.seed}-transfer-request-w${career.gameWeek}-s${career.seasonYear}`
  );
  let next = career;
  let generated = 0;
  const story = getWorldStory(career);

  for (const ps of career.squad) {
    if (generated >= 1) break;
    const playerId = ps.playerId;
    if (isPlayerAwayOnLoan(next, playerId) || isPlayerLoanedIn(next, playerId)) {
      continue;
    }
    const status = next.playerTransferStatus[playerId];
    if (status?.listed || status?.transferRequested) continue;

    const chain = story.chains.find(
      (c) =>
        c.kind === "transfer_interest" &&
        c.playerId === playerId &&
        c.stage >= 1 &&
        c.stage < 3
    );
    const contract = next.contracts[playerId];
    if (!chain) {
      if (!contract) continue;
      if (getContractStatus(contract) !== "unhappy") continue;
      if (rng() > REQUEST_CHANCE) continue;
    } else if (career.gameWeek - chain.lastWeek < 2) {
      continue;
    } else if (rng() > CHAIN_REQUEST_CHANCE) {
      continue;
    }

    const player = getPlayerById(playerId);
    const name = player?.name ?? "A squad player";
    const interested = chain?.clubId;
    const requestStatus: PlayerTransferStatus = {
      listed: false,
      askingPrice: 0,
      listedAtGameWeek: next.gameWeek,
      transferRequested: true,
    };

    next = {
      ...next,
      playerTransferStatus: {
        ...next.playerTransferStatus,
        [playerId]: requestStatus,
      },
    };

    next = pushInboxMessage(
      next,
      normalizeInboxMessage(
        {
          id: `transfer-request-${playerId}-w${next.gameWeek}`,
          type: "news",
          title: "Transfer Request",
          body: interested
            ? `${name} has requested a transfer after limited first-team football. ${interested} have been tracking the situation.`
            : `${name} has asked to leave the club. List them for transfer or speak to them later.`,
          read: false,
          resolved: false,
          playerId,
          playerName: name,
          offerClub: interested,
        },
        next
      )
    );
    generated += 1;
  }

  return next;
}
