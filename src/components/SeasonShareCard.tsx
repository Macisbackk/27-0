"use client";

import { forwardRef } from "react";

export interface SeasonShareCardData {
  title: string;
  subtitle: string;
  recordLine: string;
  detailLines: string[];
  footer?: string;
}

interface SeasonShareCardProps {
  data: SeasonShareCardData;
}

/**
 * Fixed-size shareable season summary — captured off-screen via html-to-image.
 * Floodlights at 1080px: ground background, one surface card (radius scaled
 * ×2 from the 20px card), Inter text, Anton only for the record.
 */
export const SeasonShareCard = forwardRef<HTMLDivElement, SeasonShareCardProps>(
  function SeasonShareCard({ data }, ref) {
    return (
      <div
        ref={ref}
        className="box-border flex w-[1080px] flex-col justify-between bg-pitch-950 p-16 font-body text-white"
        style={{ height: 1350 }}
      >
        <div>
          <p className="logo-mark text-5xl text-theme-primary">27-0</p>
          <h2 className="mt-10 text-[72px] font-bold leading-tight tracking-tight text-white">
            {data.title}
          </h2>
          <p className="mt-4 text-[34px] font-semibold text-[color:var(--fl-muted)]">
            {data.subtitle}
          </p>
        </div>

        <div className="rounded-[40px] bg-pitch-900 p-12">
          <p className="fl-number text-[120px] tabular-nums text-theme-primary">
            {data.recordLine}
          </p>
          <ul className="mt-10 space-y-5">
            {data.detailLines.map((line) => (
              <li
                key={line}
                className="text-[34px] font-semibold leading-snug text-[color:var(--fl-text)]"
              >
                {line}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[28px] font-semibold text-[color:var(--fl-muted)]">
          {data.footer ?? "www.27-0.co.uk"}
        </p>
      </div>
    );
  }
);
