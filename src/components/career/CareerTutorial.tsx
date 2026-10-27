"use client";

import { useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { useModalA11y } from "@/hooks/useModalA11y";
import { DIVISION_LABEL, boardGoal, formatMoney, type CareerState } from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { playUiClick } from "@/lib/sound";
import { ClubBadge } from "./bits";

type Step = { title: string; body: string; tab?: "match" | "team" | "table" | "club" };

function steps(s: CareerState): Step[] {
  const club = s.clubs[s.userClubId]!;
  const goal = boardGoal(s);
  return [
    {
      title: `Welcome to ${club.name}, gaffer`,
      body: `${DIVISION_LABEL[club.division]}, ${formatMoney(s.budget)} to spend. The board wants you to ${goal.label.charAt(0).toLowerCase()}${goal.label.slice(1)}.`,
    },
    {
      title: "Match day",
      body: "Play match to make the big calls live, or sim it. Sim to… jumps to your next big moment. Your best XIII is picked for you.",
      tab: "match",
    },
    {
      title: "Transfers and the club",
      body: "Buy and sell on Deadline Day (before Round 16) and in the summer. Club has your challenges, money and the Legend Vault.",
      tab: "club",
    },
  ];
}

/** A short, skippable walkthrough the first time a save starts. */
export function CareerTutorial({ onTab }: { onTab: (tab: "match" | "team" | "table" | "club") => void }) {
  const { state, finishTutorial } = useCareer();
  const [i, setI] = useState(0);
  const s = state;
  const open = !!s && !s.tutorialDone && s.seasonNumber === 1 && s.matchdayIndex === 0 && s.phase === "season";
  // Escape skips the walkthrough; focus moves into it so keyboard users land on its buttons.
  const panelRef = useModalA11y(open, finishTutorial);
  if (!open || !s) return null;
  const list = steps(s);
  const step = list[i]!;
  const last = i === list.length - 1;
  const club = s.clubs[s.userClubId]!;
  const go = (next: number) => {
    playUiClick();
    const target = list[next]?.tab;
    if (target) onTab(target);
    setI(next);
  };
  return (
    <BodyPortal>
      <div className="fl-backdrop fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-3 sm:items-center" role="presentation">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Manager Mode walkthrough"
          ref={panelRef}
          tabIndex={-1}
          className="mobile-bottom-sheet outline-none w-full max-w-md rounded-card bg-pitch-900 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
          style={{ height: "auto" }}
        >
          <div className="flex items-center gap-3">
            <ClubBadge club={club} size="md" />
            <p className="text-[13px] font-semibold text-theme-primary">
              Step {i + 1} of {list.length}
            </p>
            <button
              type="button"
              onClick={() => {
                playUiClick();
                finishTutorial();
              }}
              className="ml-auto text-sm font-semibold text-[color:var(--fl-muted)] hover:text-white"
            >
              Skip
            </button>
          </div>
          <div key={i} className="fl-rise">
            <h2 className="mt-3 text-[20px] font-bold leading-tight text-white">{step.title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-gray-300">{step.body}</p>
          </div>
          <div className="mt-4 flex items-center justify-center gap-1.5" aria-hidden>
            {list.map((_, n) => (
              <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? "w-6 bg-theme-primary" : "w-1.5 bg-pitch-700"}`} />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <GameButton variant="secondary" size="md" disabled={i === 0} onClick={() => go(i - 1)}>
              Back
            </GameButton>
            <GameButton
              size="md"
              onClick={() => {
                if (last) {
                  playUiClick();
                  onTab("match");
                  finishTutorial();
                } else go(i + 1);
              }}
            >
              {last ? "Let's go" : "Next"}
            </GameButton>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}
