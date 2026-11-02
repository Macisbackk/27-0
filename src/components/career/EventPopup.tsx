"use client";

import { GameButton } from "@/components/ui/GameButton";
import { MobileModal } from "@/components/ui/MobileOverlay";
import { pendingEvent } from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { playUiClick } from "@/lib/sound";
import { useSheetSlot } from "@/lib/ui/popup-queue";
import { ClubBadge, RatingPill } from "./bits";

/**
 * The hub's pop-ups (legend signings and retirements, random events): one at a time, each once.
 * Waits its turn behind other sheets (Club Funds, login) via the shared popup queue.
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
  return (
    <MobileModal open={show} onClose={() => answer()} title={e.title}>
      <div className="text-center" data-testid="career-event" data-kind={e.kind}>
        {club ? (
          <div className="flex justify-center">
            <ClubBadge club={club} size="lg" />
          </div>
        ) : null}
        {e.name ? (
          <p className="mt-2 flex items-center justify-center gap-2 text-lg font-bold text-white">
            <span className="min-w-0 break-words">{e.name}</span>
            {e.rating ? <RatingPill rating={e.rating} /> : null}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-gray-300">{e.text}</p>
      </div>
      <div className={`mt-4 grid gap-2 ${e.options.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {e.options.map((o, i) => (
          <GameButton key={o.id} variant={i === 0 && e.options.length > 1 ? "secondary" : undefined} onClick={() => answer(o.id)}>
            {o.label}
          </GameButton>
        ))}
      </div>
    </MobileModal>
  );
}
