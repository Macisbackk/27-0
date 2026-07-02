"use client";

import { useEffect, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import {
  ManagerInboxBadge,
  ManagerSectionCard,
  inboxMessageAccent,
} from "@/components/manager/manager-ui";
import type { InboxMessage, ManagerCareer, ManagerView } from "@/lib/manager/types";
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

function defaultCounterAmount(msg: InboxMessage): number {
  const offer = msg.offerAmount ?? 0;
  const asking = msg.askingPrice ?? offer;
  return Math.round((offer + asking) / 2);
}

export function ManagerInbox({
  career,
  onUpdate,
  onNavigate,
}: ManagerInboxProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [negotiatingId, setNegotiatingId] = useState<string | null>(null);
  const [counterAmount, setCounterAmount] = useState(0);

  const messages = career.inboxMessages.filter((m) => !m.resolved);

  useEffect(() => {
    if (countUnreadInbox(career) > 0) {
      onUpdate(markInboxMessagesRead(career));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolved = career.inboxMessages.filter((m) => m.resolved).slice(0, 10);

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
    <div className={`mx-auto max-w-3xl ${SPACING.stackLg}`}>
      <div>
        <h1 className={TYPO.pageTitle}>Inbox</h1>
        <p className={`${TYPO.bodySm} text-pitch-400`}>
          {messages.length} open message{messages.length === 1 ? "" : "s"} ·
          messages auto-delete after 7 weeks
        </p>
      </div>

      {feedback && (
        <p className={`${TYPO.bodySm} text-theme-primary`}>{feedback}</p>
      )}

      {messages.length === 0 && (
        <p className={`${TYPO.bodySm} text-pitch-500`}>
          No new messages. List players for transfer to attract offers.
        </p>
      )}

      {messages.map((msg) => {
        const accent = inboxMessageAccent(msg.type);
        const isActionable =
          msg.type === "transfer" ||
          msg.type === "transfer_offer_in" ||
          msg.type === "cup_draw" ||
          msg.type === "season_reward" ||
          msg.type === "youth_intake";

        return (
        <ManagerSectionCard
          key={msg.id}
          variant={isActionable ? "elevated" : "base"}
          accent={accent}
        >
          <div className="flex flex-wrap items-center gap-2">
            <ManagerInboxBadge type={msg.type} />
            <span className="text-xs text-pitch-500">Week {msg.gameWeek}</span>
          </div>
          <p className={`mt-2 font-semibold text-white`}>{msg.title}</p>
          <p className={`mt-1 ${TYPO.bodySm} text-pitch-300`}>{msg.body}</p>

          {(msg.type === "transfer" || msg.type === "transfer_offer_in") &&
            msg.askingPrice != null && (
            <div className="mt-3 space-y-2">
              {negotiatingId === msg.id ? (
                <div className={`${CARD.inset} ${SPACING.cardPaddingSm}`}>
                  <label className={TYPO.bodySm}>
                    <span className="text-pitch-400">Your counter</span>
                    <input
                      type="number"
                      step={5000}
                      value={counterAmount}
                      onChange={(e) =>
                        setCounterAmount(Number(e.target.value))
                      }
                      className="mt-1 w-full rounded-lg border border-pitch-600 bg-pitch-900 px-2 py-1 text-white"
                    />
                  </label>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <GameButton
                      variant="theme"
                      size="sm"
                      onClick={() => {
                        playUiClick();
                        handleNegotiate(msg);
                      }}
                    >
                      Submit Counter
                    </GameButton>
                    <GameButton
                      variant="secondary"
                      size="sm"
                      onClick={() => setNegotiatingId(null)}
                    >
                      Cancel
                    </GameButton>
                  </div>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-3">
                  <GameButton
                    variant="theme"
                    size="sm"
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
                    onClick={() => startNegotiate(msg)}
                  >
                    Negotiate
                  </GameButton>
                  <GameButton
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      playUiClick();
                      handleReject(msg.id);
                    }}
                  >
                    Reject
                  </GameButton>
                </div>
              )}
            </div>
          )}

          {msg.type === "cup_draw" && onNavigate && (
            <GameButton
              variant="theme"
              size="sm"
              className="mt-3"
              onClick={() => {
                playUiClick();
                dismiss(msg.id);
                onNavigate("fixtures");
              }}
            >
              View Fixture
            </GameButton>
          )}

          {msg.type === "season_reward" && onNavigate && (
            <GameButton
              variant="theme"
              size="sm"
              className="mt-3"
              onClick={() => {
                playUiClick();
                dismiss(msg.id);
                onNavigate("season-rewards");
              }}
            >
              View Rewards
            </GameButton>
          )}

          {msg.type === "youth_intake" && onNavigate && (
            <GameButton
              variant="theme"
              size="sm"
              className="mt-3"
              onClick={() => {
                playUiClick();
                dismiss(msg.id);
                onNavigate("reserves");
              }}
            >
              View youth intake
            </GameButton>
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
            <GameButton
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => {
                playUiClick();
                dismiss(msg.id);
              }}
            >
              Dismiss
            </GameButton>
          )}
        </ManagerSectionCard>
        );
      })}

      {resolved.length > 0 && (
        <section>
          <h2 className={`${TYPO.sectionLabel} mb-2`}>Recent</h2>
          <div className={SPACING.stackSm}>
            {resolved.map((msg) => (
              <div
                key={msg.id}
                className={`${CARD.inset} ${SPACING.cardPaddingSm} opacity-70`}
              >
                <p className={`${TYPO.bodySm} text-pitch-300`}>{msg.title}</p>
                <p className="text-xs text-pitch-500">{msg.body}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
