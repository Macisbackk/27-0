"use client";

import { useEffect, useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import {
  ManagerInboxMessageCard,
  ManagerSectionCard,
  ManagerStat,
} from "@/components/manager/manager-ui";
import type { InboxMessage, InboxMessageType, ManagerCareer, ManagerView } from "@/lib/manager/types";
import {
  acceptIncomingOffer,
  negotiateIncomingOffer,
  rejectIncomingOffer,
} from "@/lib/manager/managerTransferLeague";
import { resolveInboxMessage, markInboxMessagesRead, countUnreadInbox } from "@/lib/manager/managerInbox";
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
  return <div className="grid gap-2 sm:grid-cols-3">{children}</div>;
}

function InboxSingleAction({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2">{children}</div>;
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

  const messages = career.inboxMessages.filter((m) => !m.resolved);
  const filteredMessages = useMemo(
    () => messages.filter((m) => matchesFilter(m, filter)),
    [messages, filter]
  );

  useEffect(() => {
    if (countUnreadInbox(career) > 0) {
      onUpdate(markInboxMessagesRead(career));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolved = career.inboxMessages.filter((m) => m.resolved).slice(0, 10);
  const bidCount = messages.filter((m) => matchesFilter(m, "transfer_offer_in")).length;

  const handleAccept = (id: string) => {
    const result = acceptIncomingOffer(career, id);
    if (result.ok && result.career) {
      setFeedback(null);
      onUpdate(result.career);
    }
  };

  const handleReject = (id: string) => {
    onUpdate(rejectIncomingOffer(career, id));
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

  return (
    <div className={`mx-auto w-full max-w-3xl ${SPACING.stackLg}`}>
      <div>
        <h1 className={TYPO.pageTitle}>Inbox</h1>
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
          Club messages and transfer offers — auto-cleared after 7 weeks
        </p>
      </div>

      <ManagerSectionCard variant="elevated" accent="primary">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <ManagerStat
            label="Open"
            value={String(messages.length)}
            tone={messages.length > 0 ? "primary" : "muted"}
            large
          />
          <ManagerStat
            label="Bids"
            value={String(bidCount)}
            tone={bidCount > 0 ? "gold" : "muted"}
          />
          <ManagerStat
            label="Season"
            value={`${career.seasonYear} · Wk ${career.gameWeek}`}
            tone="muted"
          />
        </div>
      </ManagerSectionCard>

      {messages.length > 0 && (
        <div className={`${CARD.base} ${SPACING.cardPaddingSm}`}>
          <p className={`${TYPO.sectionLabel} mb-2.5`}>Filter</p>
          <div className="flex flex-wrap gap-2">
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
                  }}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
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
        </div>
      )}

      {feedback && (
        <div className={`${CARD.inset} ${SPACING.cardPaddingSm}`}>
          <p className={`${TYPO.bodySm} text-theme-primary`}>{feedback}</p>
        </div>
      )}

      {messages.length === 0 && (
        <ManagerSectionCard variant="inset">
          <p className={`${TYPO.bodySm} text-pitch-400`}>
            No new messages. Rival clubs may approach you about unlisted
            players, or list your own squad to attract bids.
          </p>
        </ManagerSectionCard>
      )}

      {messages.length > 0 && filteredMessages.length === 0 && (
        <ManagerSectionCard variant="inset">
          <p className={`${TYPO.bodySm} text-pitch-400`}>
            No messages in this category.
          </p>
        </ManagerSectionCard>
      )}

      <div className={SPACING.stackMd}>
        {filteredMessages.map((msg) => (
          <ManagerInboxMessageCard key={msg.id} message={msg}>
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
                          className="sm:col-span-2"
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
                    onNavigate("season-rewards");
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
          </ManagerInboxMessageCard>
        ))}
      </div>

      {resolved.length > 0 && (
        <section>
          <h2 className={`${TYPO.sectionLabel} mb-3`}>Recent</h2>
          <div className={SPACING.stackSm}>
            {resolved.map((msg) => (
              <ManagerInboxMessageCard
                key={msg.id}
                message={msg}
                compact
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
