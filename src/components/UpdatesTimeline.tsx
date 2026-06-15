"use client";

import { useState } from "react";
import type { UpdateEntry } from "../../data/updates";
import { formatUpdateDate } from "../../data/updates";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { playUiClick } from "@/lib/sound";

interface UpdatesTimelineProps {
  entries: UpdateEntry[];
}

export function UpdatesTimeline({ entries }: UpdatesTimelineProps) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(entries.length > 0 ? [entries[0].version] : [])
  );

  const toggle = (version: string) => {
    playUiClick();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  };

  return (
    <ol className="relative space-y-0">
      {entries.map((entry, index) => {
        const isOpen = expanded.has(entry.version);
        const panelId = `update-panel-${entry.version.replace(".", "-")}`;

        return (
          <li key={entry.version} className="relative pb-6 last:pb-0">
            {index < entries.length - 1 && (
              <span
                className="absolute left-[11px] top-6 bottom-0 w-px bg-pitch-700/70"
                aria-hidden
              />
            )}
            <div className="flex gap-3 sm:gap-4">
              <span
                className="relative z-10 mt-1.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 border-accent-green/50 bg-pitch-950"
                aria-hidden
              >
                <span className="h-2 w-2 rounded-full bg-accent-green" />
              </span>

              <article
                className={`min-w-0 flex-1 ${CARD.panel} ${SPACING.cardPadding}`}
              >
                <button
                  type="button"
                  onClick={() => toggle(entry.version)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <h2 className={`${TYPO.cardTitle} text-accent-gold`}>
                        v{entry.version}
                      </h2>
                      <span className={`${TYPO.bodySm} text-gray-400`}>
                        {entry.title}
                      </span>
                    </div>
                    <p className={`mt-1.5 ${TYPO.bodySm} text-gray-300`}>
                      {entry.summary}
                    </p>
                  </div>
                  <span
                    className={`mt-0.5 shrink-0 text-xs font-semibold uppercase tracking-wider ${
                      isOpen ? "text-accent-green" : "text-gray-500"
                    }`}
                  >
                    {isOpen ? "Hide" : "Expand"}
                  </span>
                </button>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <time
                    dateTime={entry.date}
                    className={`${TYPO.statLabel} shrink-0`}
                  >
                    {formatUpdateDate(entry.date)}
                  </time>
                </div>

                {isOpen && (
                  <ul
                    id={panelId}
                    className={`mt-3 space-y-1.5 border-t border-pitch-700/50 pt-3 ${TYPO.bodySm} text-gray-300`}
                  >
                    {entry.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-2">
                        <span
                          className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent-green/70"
                          aria-hidden
                        />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
