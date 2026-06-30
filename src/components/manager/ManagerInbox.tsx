"use client";

import { GameButton } from "@/components/ui/GameButton";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import {
  acceptIncomingOffer,
  rejectIncomingOffer,
} from "@/lib/manager/managerTransferLeague";
import { formatWage } from "@/lib/manager/managerContracts";
import { playUiClick } from "@/lib/sound";

interface ManagerInboxProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
}

export function ManagerInbox({ career, onUpdate }: ManagerInboxProps) {
  const messages = career.inboxMessages.filter((m) => !m.resolved);
  const resolved = career.inboxMessages.filter((m) => m.resolved).slice(0, 10);

  const handleAccept = (id: string) => {
    const result = acceptIncomingOffer(career, id);
    if (result.ok && result.career) onUpdate(result.career);
  };

  const handleReject = (id: string) => {
    onUpdate(rejectIncomingOffer(career, id));
  };

  return (
    <div className={`mx-auto max-w-3xl ${SPACING.stackLg}`}>
      <div>
        <h1 className={TYPO.pageTitle}>Inbox</h1>
        <p className={`${TYPO.bodySm} text-pitch-400`}>
          {messages.length} unread message{messages.length === 1 ? "" : "s"}
        </p>
      </div>

      {messages.length === 0 && (
        <p className={`${TYPO.bodySm} text-pitch-500`}>
          No new messages. List players for transfer to attract offers.
        </p>
      )}

      {messages.map((msg) => (
        <div key={msg.id} className={`${CARD.base} ${SPACING.cardPadding}`}>
          <p className={TYPO.sectionLabel}>{msg.title}</p>
          <p className={`mt-1 ${TYPO.bodySm} text-white`}>{msg.body}</p>
          <p className={`mt-1 text-xs text-pitch-500`}>
            Week {msg.gameWeek}
          </p>
          {msg.type === "transfer_offer_in" && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <GameButton
                variant="theme"
                size="sm"
                onClick={() => {
                  playUiClick();
                  handleAccept(msg.id);
                }}
              >
                Accept {msg.offerAmount ? formatWage(msg.offerAmount) : ""}
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
      ))}

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
