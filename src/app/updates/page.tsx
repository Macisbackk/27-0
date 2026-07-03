"use client";

import { useState } from "react";
import { GAME_UPDATES } from "../../../data/updates";
import { playPanelClose, playPanelExpand, playUiClick } from "@/lib/sound";
import { PageShell } from "@/components/ui/PageShell";
import { CARD, PAGE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

export default function UpdatesPage() {
  const [openId, setOpenId] = useState<string | null>(GAME_UPDATES[0]?.id ?? null);

  return (
    <PageShell withLights compact>
      <div className={`mx-auto max-w-2xl ${PAGE.section}`}>
        <header className="text-center">
          <p className={TYPO.sectionLabel}>Changelog</p>
          <h1 className="mt-2 font-display text-3xl font-black text-white sm:text-4xl">
            Updates
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-gray-500">
            What&apos;s new in 27-0 — latest changes first.
          </p>
        </header>

        <ul className="space-y-3">
          {GAME_UPDATES.map((update) => {
            const isOpen = openId === update.id;
            return (
              <li key={update.id}>
                <div
                  className={`${CARD.panel} overflow-hidden rounded-xl border transition-colors ${
                    isOpen
                      ? "border-accent-green/40 bg-pitch-900/80"
                      : "border-pitch-700/50 hover:border-pitch-600/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      playUiClick();
                      if (isOpen) {
                        playPanelClose();
                        setOpenId(null);
                      } else {
                        playPanelExpand();
                        setOpenId(update.id);
                      }
                    }}
                    className="no-btn-press grid h-14 w-full grid-cols-[minmax(0,1fr)_2rem] items-center gap-3 px-4 text-left transition-colors hover:bg-pitch-800/35 active:bg-pitch-800/50 sm:px-5"
                    aria-expanded={isOpen}
                  >
                    <span className="line-clamp-2 font-display text-sm font-bold leading-tight text-white sm:text-base">
                      {update.title}
                    </span>
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-md border border-pitch-600/50 bg-pitch-900/50 text-sm text-accent-green transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden
                    >
                      ▾
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-pitch-700/40 px-4 pb-4 pt-3 sm:px-5">
                      <p className={`${TYPO.bodySm} leading-relaxed text-gray-400`}>
                        {update.summary}
                      </p>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </PageShell>
  );
}
