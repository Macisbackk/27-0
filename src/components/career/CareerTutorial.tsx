"use client";

import { useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { BodyPortal } from "@/components/ui/BodyPortal";
import { useModalA11y } from "@/hooks/useModalA11y";
import { DIVISION_LABEL, formatMoney, type CareerState } from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { playUiClick } from "@/lib/sound";
import { ClubBadge } from "./bits";

type Step = { title: string; body: string; tab?: "match" | "team" | "table" | "club" };

function steps(s: CareerState): Step[] {
  const club = s.clubs[s.userClubId]!;
  const sl = club.division === "super-league";
  return [
    {
      title: `Welcome to ${club.name}, gaffer`,
      body: sl
        ? `You're in ${DIVISION_LABEL[club.division]} with ${formatMoney(s.budget)} to spend. Win games, win trophies, and build a legacy that unlocks legends for future saves.`
        : `You're in the ${DIVISION_LABEL[club.division]} with ${formatMoney(s.budget)} to spend. Finish top and win the Million Pound Game to go up to Super League.`,
    },
    {
      title: "Match day",
      body: "Play match lets you make the big calls as it happens. Quick sim plays it in a second. Your game plan (attack, balanced, defend) changes how the game goes.",
      tab: "match",
    },
    {
      title: "Pick your XIII",
      body: "The Team tab is your squad. Tap a shirt to swap a player in, or let Auto-pick choose your strongest side.",
      tab: "team",
    },
    {
      title: "Pre-season and transfers",
      body: "Before Round 1 you can arrange two friendlies for match sharpness and gate money. The transfer window opens after Round 10, and on Deadline Day the season waits until you shut it.",
      tab: "match",
    },
    {
      title: "Table and club",
      body: "Table shows the league. Club has your season challenges, finances, records and the Legend Vault. That's it: good luck!",
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
