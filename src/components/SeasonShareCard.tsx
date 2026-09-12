"use client";

import { forwardRef } from "react";
import { TYPO } from "@/lib/ui/typography";

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

/** Fixed-size shareable season summary — captured off-screen via html-to-image. */
export const SeasonShareCard = forwardRef<HTMLDivElement, SeasonShareCardProps>(
  function SeasonShareCard({ data }, ref) {
    return (
      <div
        ref={ref}
        className="box-border flex w-[1080px] flex-col justify-between bg-[#07120f] p-16 text-white"
        style={{
          height: 1350,
          background:
            "linear-gradient(160deg, #0a1a14 0%, #07120f 45%, #0c2418 100%)",
        }}
      >
        <div>
          <p className={`${TYPO.eyebrow} text-sm tracking-[0.28em] text-theme-primary/90`}>
            27-0
          </p>
          <h2 className={`mt-6 text-6xl leading-tight ${TYPO.pageTitle}`}>
            {data.title}
          </h2>
          <p className={`mt-4 text-2xl text-white/70 ${TYPO.pageSubtitle}`}>
            {data.subtitle}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/35 p-10">
          <p className={`text-5xl tracking-tight ${TYPO.statValueLg} tabular-nums`}>
            {data.recordLine}
          </p>
          <ul className="mt-8 space-y-4">
            {data.detailLines.map((line) => (
              <li key={line} className={`text-2xl text-white/80 ${TYPO.body}`}>
                {line}
              </li>
            ))}
          </ul>
        </div>

        <p className={`text-xl text-white/50 ${TYPO.meta}`}>
          {data.footer ?? "www.27-0.co.uk"}
        </p>
      </div>
    );
  }
);
