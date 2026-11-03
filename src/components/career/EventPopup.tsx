"use client";

import { GameButton } from "@/components/ui/GameButton";
import { pendingEvent } from "@/lib/career";
import type { CareerEventKind } from "@/lib/career/types";
import { useCareer } from "@/lib/career/context";
import { playUiClick } from "@/lib/sound";
import { useSheetSlot } from "@/lib/ui/popup-queue";
import { ClubBadge, RatingPill } from "./bits";
import { ManagerSheet, SheetButtons } from "./Sheet";

/** The small line over each pop-up's title. */
const EYEBROW: Record<CareerEventKind, string> = {
  "legend-signing": "Legend signing",
  "legend-retired": "Legend retires",
  "transfer-request": "Transfer request",
  "record-bid": "Transfer bid",
  sponsor: "Club news",
  wonderkid: "Academy",
  takeover: "Boardroom",
  "club-record": "Club record",
  "world-club-challenge": "World Club Challenge",
  injury: "Injury news",
  "board-warning": "Boardroom",
  fans: "Supporters",
};

/**
 * The hub's pop-ups (legend signings and retirements, random events): one at a time, each once.
 * Waits its turn behind other sheets (Club Funds, login) via the shared popup queue.
 * Escape or the backdrop takes the first (default) option.
 */
export function EventPopup() {
  const { state, resolveEvent } = useCareer();
  const e = state ? pendingEvent(state) : undefined;
  const show = useSheetSlot(!!e);
  if (!e || !state) return null;
  const club = e.clubId ? state.clubs[e.clubId] : undefined;
  const answer = (optionId?: string) => {
    playUiClick();
    resolveEvent(e.id, optionId);
  };
  const two = e.options.length > 1;
  return (
    <ManagerSheet
      open={show}
      onClose={() => answer()}
      eyebrow={EYEBROW[e.kind] ?? "Club news"}
      title={e.title}
      footer={
        <SheetButtons>
          {e.options.map((o, i) => (
            <GameButton key={o.id} variant={two && i === 0 ? "secondary" : undefined} onClick={() => answer(o.id)}>
              {o.label}
            </GameButton>
          ))}
        </SheetButtons>
      }
    >
      <div className="flex flex-col items-center text-center" data-testid="career-event" data-kind={e.kind}>
        {club ? <ClubBadge club={club} size="lg" /> : null}
        {e.name ? (
          <p className="mt-2 flex items-center justify-center gap-2 text-[17px] font-bold text-white">
            <span className="min-w-0 break-words">{e.name}</span>
            {e.rating ? <RatingPill rating={e.rating} /> : null}
          </p>
        ) : null}
        <p className="mt-2 text-sm leading-relaxed text-gray-300">{e.text}</p>
      </div>
    </ManagerSheet>
  );
}
