"use client";

import { useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { GameSectionHeader } from "@/components/ui/GameSectionHeader";
import { ProgrammePanel } from "@/components/ui/ProgrammePanel";
import { CollapsibleDetails } from "@/components/ui/MobileLayout";
import { CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import {
  ManagerInboxMessageCard,
  ManagerPage,
  ManagerSection,
} from "@/components/manager/manager-ui";
import type { InboxMessage, InboxMessageType, ManagerCareer, ManagerView } from "@/lib/manager/types";
import {
  acceptIncomingOffer,
  negotiateIncomingOffer,
  rejectIncomingOffer,
} from "@/lib/manager/managerTransferLeague";
import {
  acceptReserveTransferOffer,
  rejectReserveTransferOffer,
} from "@/lib/manager/championshipBidForSlReserves";
import { resolveInboxMessage, viewAllInboxAsSeen, canViewAllInboxAsSeen } from "@/lib/manager/managerInbox";
import { formatWage } from "@/lib/manager/managerContracts";
import { playUiClick } from "@/lib/sound";

interface ManagerInboxProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
  onNavigate?: (view: ManagerView) => void;
}

type InboxFilter = "all" | InboxMessageType;

const INBOX_FILTERS: { id: InboxFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "transfer_offer_in", label: "Bids" },
  { id: "contract", label: "Contracts" },
  { id: "board", label: "Board" },
  { id: "injury", label: "Medical" },
  { id: "cup_draw", label: "Cup" },
  { id: "youth_intake", label: "Youth" },
  { id: "reserve_report", label: "Reserves" },
];

function defaultCounterAmount(msg: InboxMessage): number {
  const offer = msg.offerAmount ?? 0;
  const asking = msg.askingPrice ?? offer;
  return Math.round((offer + asking) / 2);
}

function matchesFilter(msg: InboxMessage, filter: InboxFilter): boolean {
  if (filter === "all") return true;
  if (filter === "transfer_offer_in") {
    return (
      msg.type === "transfer_offer_in" ||
      msg.type === "transfer" ||
      msg.type === "transfer_offer_out" ||
      msg.type === "transfer_complete" ||
      msg.type === "sale"
    );
  }
  if (filter === "contract") {
    return msg.type === "contract" || msg.type === "retirement";
  }
  if (filter === "injury") {
    return msg.type === "injury" || msg.type === "release";
  }
  if (filter === "reserve_report") {
    return (
      msg.type === "reserve_report" ||
      msg.type === "reserve_callup" ||
      msg.type === "reserve_return"
    );
  }
  return msg.type === filter;
}

function InboxActionRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid w-full max-w-lg gap-2 sm:grid-cols-3">
      {children}
    </div>
  );
}

function InboxSingleAction({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-xs justify-center sm:max-w-sm">
      {children}
    </div>
  );
}

export function ManagerInbox({
  career,
  onUpdate,
  onNavigate,
}: ManagerInboxProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [negotiatingId, setNegotiatingId] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState(0);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const messages = career.inboxMessages.filter((m) => !m.resolved);
  const filteredMessages = useMemo(
    () => messages.filter((m) => matchesFilter(m, filter)),
    [messages, filter]
  );

  const activeExpandedId =
    expandedId && filteredMessages.some((m) => m.id === expandedId)
      ? expandedId
      : filteredMessages[0]?.id ?? null;

  const showViewAllAsSeen = canViewAllInboxAsSeen(career);

  const resolved = career.inboxMessages.filter((m) => m.resolved).slice(0, 10);

  const handleAccept = (id: string) => {
    const msg = career.inboxMessages.find((m) => m.id === id);
    const result = msg?.reserveOffer
      ? acceptReserveTransferOffer(career, id)
      : acceptIncomingOffer(career, id);
    if (result.ok && result.career) {
      setFeedback(null);
      onUpdate(result.career);
      return;
    }
    setFeedback(result.error ?? "Could not complete this transfer.");
    if (result.error?.includes("no longer")) {
      onUpdate(
        msg?.reserveOffer
          ? rejectReserveTransferOffer(career, id)
          : rejectIncomingOffer(career, id)
      );
    }
  };

  const handleReject = (id: string) => {
    const msg = career.inboxMessages.find((m) => m.id === id);
    onUpdate(
      msg?.reserveOffer
        ? rejectReserveTransferOffer(career, id)
        : rejectIncomingOffer(career, id)
    );
    setNegotiatingId(null);
    setFeedback(null);
  };

  const handleNegotiate = (msg: InboxMessage) => {
    const result = negotiateIncomingOffer(career, msg.id, counterAmount);
    setFeedback(result.feedback);
    if (result.career) onUpdate(result.career);
    setNegotiatingId(null);
  };

  const startNegotiate = (msg: InboxMessage) => {
    playUiClick();
    setNegotiatingId(msg.id);
    setCounterAmount(defaultCounterAmount(msg));
    setFeedback(null);
  };

  const dismiss = (id: string) => {
    onUpdate(resolveInboxMessage(career, id));
  };

  const handleViewAllAsSeen = () => {
    playUiClick();
    onUpdate(viewAllInboxAsSeen(career));
    setFeedback(null);
  };

  return (
    <ManagerPage>
      <ManagerSection>
      <GameSectionHeader
        size="page"
        label="Inbox"
        title="Club Mail"
        subtitle={`${messages.length} open · Wk ${career.gameWeek}`}
        collapseSubtitleOnMobile={false}
        action={
          showViewAllAsSeen ? (
            <GameButton
              variant="secondary"
              size="sm"
              onClick={handleViewAllAsSeen}
            >
              Mark all seen
            </GameButton>
          ) : undefined
        }
      />

      {messages.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible">
            {INBOX_FILTERS.map((f) => {
              const count =
                f.id === "all"
                  ? messages.length
                  : messages.filter((m) => matchesFilter(m, f.id)).length;
              if (f.id !== "all" && count === 0) return null;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    playUiClick();
                    setFilter(f.id);
                    setExpandedId(null);
                  }}
                  className={`shrink-0 rounded-sm border px-2.5 py-1.5 text-[11px] font-medium transition min-h-[36px] sm:min-h-[44px] ${
                    filter === f.id ? FILTER.chipActive : FILTER.chipIdle
                  }`}
                >
                  {f.label}
                  {count > 0 && (
                    <span className="ml-1.5 opacity-70">({count})</span>
                  )}
                </button>
              );
            })}
        </div>
      )}

      {feedback && (
        <ProgrammePanel variant="inset" padded>
          <p className={`${TYPO.bodySm} text-theme-primary`}>{feedback}</p>
        </ProgrammePanel>
      )}

      {messages.length === 0 && (
        <div className="py-6 text-center">
          <p className={`${TYPO.bodySm} text-pitch-400`}>
            No new messages. Rival clubs may approach you about unlisted
            players, or list your own squad to attract bids.
          </p>
        </div>
      )}

      {messages.length > 0 && filteredMessages.length === 0 && (
        <div className="py-4 text-center">
          <p className={`${TYPO.bodySm} text-pitch-400`}>
            No messages in this category.
          </p>
        </div>
      )}

      <div className={SPACING.stackMd}>
        {filteredMessages.map((msg) => {
          const isExpanded = msg.id === activeExpandedId;
          return (
          <ManagerInboxMessageCard
            key={msg.id}
            message={msg}
            expanded={isExpanded}
            onToggleExpand={() => {
              playUiClick();
              setExpandedId(isExpanded ? null : msg.id);
            }}
          >
            {isExpanded ? (
              <>
            {(msg.type === "transfer" || msg.type === "transfer_offer_in") &&
              msg.askingPrice != null && (
                <>
                  {negotiatingId === msg.id ? (
                    <div className={`${CARD.inset} ${SPACING.cardPaddingSm} space-y-3`}>
                      <label className={TYPO.bodySm}>
                        <span className="text-pitch-400">Your counter offer</span>
                        <input
                          type="number"
                          step={5000}
                          value={counterAmount}
                          onChange={(e) =>
                            setCounterAmount(Number(e.target.value))
                          }
                          className={`${FILTER.input} mt-2`}
                        />
                      </label>
                      <InboxActionRow>
                        <GameButton
                          variant="theme"
                          size="sm"
                          fullWidth
                          onClick={() => {
                            playUiClick();
                            handleNegotiate(msg);
                          }}
                        >
                          Submit counter
                        </GameButton>
                        <GameButton
                          variant="secondary"
                          size="sm"
                          fullWidth
                          onClick={() => setNegotiatingId(null)}
                        >
                          Cancel
                        </GameButton>
                      </InboxActionRow>
                    </div>
                  ) : (
                    <InboxActionRow>
                      <GameButton
                        variant="theme"
                        size="sm"
                        fullWidth
                        onClick={() => {
                          playUiClick();
                          handleAccept(msg.id);
                        }}
                      >
                        Accept{" "}
                        {msg.offerAmount ? formatWage(msg.offerAmount) : ""}
                      </GameButton>
                      <GameButton
                        variant="secondary"
                        size="sm"
                        fullWidth
                        onClick={() => startNegotiate(msg)}
                      >
                        Negotiate
                      </GameButton>
                      <GameButton
                        variant="secondary"
                        size="sm"
                        fullWidth
                        onClick={() => {
                          playUiClick();
                          handleReject(msg.id);
                        }}
                      >
                        Reject
                      </GameButton>
                    </InboxActionRow>
                  )}
                </>
              )}

            {msg.type === "cup_draw" && onNavigate && (
              <InboxSingleAction>
                <GameButton
                  variant="theme"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    playUiClick();
                    dismiss(msg.id);
                    onNavigate("fixtures");
                  }}
                >
                  View fixture
                </GameButton>
              </InboxSingleAction>
            )}

            {msg.type === "season_reward" && onNavigate && (
              <InboxSingleAction>
                <GameButton
                  variant="theme"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    playUiClick();
                    dismiss(msg.id);
                    onNavigate(
                      career.isSeasonComplete &&
                        career.seasonRewardClaimedForYear !== career.seasonYear
                        ? "season-review"
                        : "season-rewards"
                    );
                  }}
                >
                  View rewards
                </GameButton>
              </InboxSingleAction>
            )}

            {msg.type === "youth_intake" && onNavigate && (
              <InboxSingleAction>
                <GameButton
                  variant="theme"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    playUiClick();
                    dismiss(msg.id);
                    onNavigate("reserves");
                  }}
                >
                  View youth intake
                </GameButton>
              </InboxSingleAction>
            )}

            {(msg.type === "release" ||
              msg.type === "board" ||
              msg.type === "contract" ||
              msg.type === "injury" ||
              msg.type === "sale" ||
              msg.type === "transfer_complete" ||
              msg.type === "reserve_report" ||
              msg.type === "reserve_callup" ||
              msg.type === "reserve_return" ||
              msg.type === "position_retraining_complete" ||
              msg.type === "news" ||
              msg.type === "general") && (
              <InboxSingleAction>
                <GameButton
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => {
                    playUiClick();
                    dismiss(msg.id);
                  }}
                >
                  Dismiss
                </GameButton>
              </InboxSingleAction>
            )}
              </>
            ) : null}
          </ManagerInboxMessageCard>
          );
        })}
      </div>

      {resolved.length > 0 && (
        <CollapsibleDetails summary={`Recent (${resolved.length})`}>
          <div className={SPACING.stackSm}>
            {resolved.map((msg) => (
              <ManagerInboxMessageCard
                key={msg.id}
                message={msg}
                compact
              />
            ))}
          </div>
        </CollapsibleDetails>
      )}
      </ManagerSection>
    </ManagerPage>
  );
}
