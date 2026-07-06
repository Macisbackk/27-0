"use client";

import { useCallback, useState } from "react";
import type { GameUpdate } from "../../data/updates";
import { playPanelClose, playPanelExpand, playUiClick } from "@/lib/sound";
import { CARD } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

const HEADER_HEIGHT = "h-14";
const CHEVRON_BOX =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-pitch-600/50 bg-pitch-900/50 text-sm text-accent-green transition-transform duration-200";

interface ChangelogAccordionProps {
  entries: GameUpdate[];
  defaultOpenId?: string | null;
}

export function ChangelogAccordion({
  entries,
  defaultOpenId = null,
}: ChangelogAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(
    defaultOpenId ?? entries[0]?.id ?? null
  );

  const toggle = useCallback((id: string) => {
    playUiClick();
    setOpenId((prev) => {
      if (prev === id) {
        playPanelClose();
        return null;
      }
      playPanelExpand();
      return id;
    });
  }, []);

  return (
    <ul className="space-y-3">
      {entries.map((entry) => {
        const isOpen = openId === entry.id;
        return (
          <li key={entry.id}>
            <div
              className={`${CARD.panel} overflow-hidden rounded-xl border transition-colors ${
                isOpen
                  ? "border-accent-green/40 bg-pitch-900/80"
                  : "border-pitch-700/50 hover:border-pitch-600/60"
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(entry.id)}
                aria-expanded={isOpen}
                className={`box-border flex ${HEADER_HEIGHT} w-full shrink-0 items-center gap-3 px-4 text-left transition-colors hover:bg-pitch-800/35 active:bg-pitch-800/50 sm:px-5`}
              >
                <span
                  className="min-w-0 flex-1 truncate font-display text-sm font-bold text-white sm:text-base"
                  title={entry.title}
                >
                  {entry.title}
                </span>
                <span
                  className={`${CHEVRON_BOX} ${isOpen ? "rotate-180 bg-pitch-800/60" : ""}`}
                  aria-hidden
                >
                  ▾
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-pitch-700/40 px-4 pb-4 pt-3 sm:px-5">
                  <p className={`${TYPO.bodySm} leading-relaxed text-gray-400`}>
                    {entry.summary}
                  </p>
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
