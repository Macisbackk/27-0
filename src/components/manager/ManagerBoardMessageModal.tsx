"use client";

import { useCallback, useEffect } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { ManagerModal } from "@/components/manager/ManagerModal";
import { ManagerInboxBadge } from "@/components/manager/manager-ui";
import { TYPO } from "@/lib/ui/typography";
import { useModalA11y } from "@/hooks/useModalA11y";
import type { InboxMessage } from "@/lib/manager/types";
import { isStoryInboxMessage } from "@/lib/manager/managerWorldStory";
import { managerModalHeaderClass } from "@/lib/manager/managerSurfaces";
import { playMenuOpen, playUiClick } from "@/lib/sound";

interface ManagerBoardMessageModalProps {
  message: InboxMessage;
  onDismiss: () => void;
  onViewInbox?: () => void;
}

export function ManagerBoardMessageModal({
  message,
  onDismiss,
  onViewInbox,
}: ManagerBoardMessageModalProps) {
  const isStory = isStoryInboxMessage(message);
  const handleDismiss = useCallback(() => {
    playUiClick();
    onDismiss();
  }, [onDismiss]);

  const panelRef = useModalA11y(true, handleDismiss);

  useEffect(() => {
    playMenuOpen();
  }, []);

  return (
    <ManagerModal
      open
      labelledBy="board-message-title"
      panelRef={panelRef}
      header={
        <div
          className={managerModalHeaderClass(
            isStory ? "gold" : "primary",
            { centered: true, slotted: true }
          )}
        >
          <div
            className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 shadow-inner ${
              isStory
                ? "border-accent-gold/45 bg-accent-gold/15"
                : "border-theme-primary/45 bg-theme-primary/15"
            }`}
          >
            <span
              className={`font-display text-xl font-black ${
                isStory ? "text-accent-gold" : "text-theme-primary"
              }`}
              aria-hidden
            >
              {isStory ? "!" : "B"}
            </span>
          </div>
          <div className="mt-3 flex justify-center gap-2">
            <ManagerInboxBadge type={isStory ? "news" : "board"} />
            <span className={`${TYPO.bodySm} text-pitch-400`}>
              {isStory
                ? `Club Update · Week ${message.gameWeek}`
                : `From Board · Week ${message.gameWeek}`}
            </span>
          </div>
          <h2 id="board-message-title" className={`mt-3 ${TYPO.cardTitle}`}>
            {message.title}
          </h2>
        </div>
      }
      footer={
        <div className="flex flex-col gap-2 sm:flex-row">
          <GameButton
            variant="theme"
            size="md"
            fullWidth
            onClick={handleDismiss}
          >
            Continue
          </GameButton>
          {onViewInbox && (
            <GameButton
              variant="secondary"
              size="md"
              fullWidth
              onClick={() => {
                playUiClick();
                onViewInbox();
              }}
            >
              Open Inbox
            </GameButton>
          )}
        </div>
      }
    >
      <p
        className={`whitespace-pre-line ${TYPO.bodySm} leading-relaxed text-pitch-200`}
      >
        {message.body}
      </p>

      {(message.deadlineLabel || message.requiredAction) && (
        <div className="mt-4 space-y-2 rounded-xl border border-pitch-700/50 bg-pitch-950/50 p-3">
          {message.deadlineLabel && (
            <p className={`${TYPO.bodySm} text-pitch-300`}>
              <span className="font-semibold text-white">Deadline: </span>
              {message.deadlineLabel}
            </p>
          )}
          {message.requiredAction && (
            <p className={`${TYPO.bodySm} text-pitch-300`}>
              <span className="font-semibold text-white">Required: </span>
              {message.requiredAction}
            </p>
          )}
        </div>
      )}
    </ManagerModal>
  );
}
