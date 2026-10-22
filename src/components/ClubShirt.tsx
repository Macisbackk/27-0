"use client";

import { useId, type ReactNode } from "react";
import type { ClubKit } from "@/lib/club-kits";
import { isLightKitColor } from "@/lib/club-kits";

/** Rugby shirt silhouette in a 48×46 box. */
const SHIRT_PATH =
  "M16 3 L7 7 L1 17 L8 22 L11 19 L11 44 L37 44 L37 19 L40 22 L47 17 L41 7 L32 3 C29 8 19 8 16 3 Z";
const COLLAR_PATH = "M16 3 C19 8 29 8 32 3";

function Pattern({ kit }: { kit: ClubKit }) {
  const { pattern, trim, trim2 } = kit;
  // Cuffs: thick strokes along the sleeve ends, half of each is clipped away by the shirt outline.
  const cuffs = (color: string) => (
    <>
      <line x1="1" y1="17" x2="8" y2="22" stroke={color} strokeWidth="6" />
      <line x1="47" y1="17" x2="40" y2="22" stroke={color} strokeWidth="6" />
    </>
  );
  switch (pattern) {
    case "hoops":
      return (
        <>
          <rect x="0" y="9" width="48" height="6" fill={trim} />
          <rect x="0" y="21" width="48" height="6" fill={trim} />
          <rect x="0" y="33" width="48" height="6" fill={trim} />
        </>
      );
    case "v":
      return (
        <>
          {trim2 ? <polygon points="5,0 24,31 43,0 28,0 24,9 20,0" fill={trim2} /> : null}
          <polygon points="8,0 24,27 40,0 31,0 24,13 17,0" fill={trim} />
          {cuffs(trim)}
        </>
      );
    case "band":
      return (
        <>
          {trim2 ? <rect x="0" y="14" width="48" height="14" fill={trim2} /> : null}
          <rect x="0" y="16" width="48" height="10" fill={trim} />
          {cuffs(trim)}
          <rect x="0" y="41" width="48" height="4" fill={trim} />
        </>
      );
    case "yoke":
      return (
        <>
          <polygon points="0,0 48,0 48,24 37,24 37,14 11,14 11,24 0,24" fill={trim} />
          <rect x="0" y="41" width="48" height="4" fill={trim} />
        </>
      );
    case "stripes":
      return (
        <>
          {[13, 19.5, 26, 32.5].map((x) => (
            <rect key={x} x={x - 1.75} y="0" width="3.5" height="46" fill={trim} />
          ))}
          {cuffs(trim)}
        </>
      );
    case "centre-stripe":
      return (
        <>
          {trim2 ? <rect x="17" y="0" width="14" height="46" fill={trim2} /> : null}
          <rect x="19" y="0" width="10" height="46" fill={trim} />
          {cuffs(trim)}
        </>
      );
    default:
      return null;
  }
}

/**
 * A small club shirt: two-colour design from `kit`, with `label` (the rating) on the chest.
 * Pass `kit={null}` for an empty position (dashed outline).
 */
export function ClubShirt({
  kit,
  label,
  size = 46,
  className = "",
}: {
  kit: ClubKit | null;
  label?: ReactNode;
  size?: number;
  className?: string;
}) {
  const clipId = `shirt-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const height = Math.round((size * 46) / 48);

  if (!kit) {
    return (
      <svg width={size} height={height} viewBox="0 0 48 46" aria-hidden className={className}>
        <path d={SHIRT_PATH} fill="rgba(10,17,14,0.55)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeDasharray="3 2.5" />
        {label ? (
          <text x="24" y="31" textAnchor="middle" fontSize="18" fontWeight="700" fill="currentColor">
            {label}
          </text>
        ) : null}
      </svg>
    );
  }

  const lightBody = isLightKitColor(kit.body);
  return (
    <svg width={size} height={height} viewBox="0 0 48 46" aria-hidden className={className}>
      <defs>
        <clipPath id={clipId}>
          <path d={SHIRT_PATH} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="48" height="46" fill={kit.body} />
        <Pattern kit={kit} />
      </g>
      <path d={COLLAR_PATH} fill="none" stroke={kit.trim2 ?? kit.trim} strokeWidth="2.5" />
      <path
        d={SHIRT_PATH}
        fill="none"
        stroke={lightBody ? "rgba(10,17,14,0.55)" : "rgba(255,255,255,0.4)"}
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      {label !== undefined ? (
        <text
          x="24"
          y="33"
          textAnchor="middle"
          fontSize="17"
          fill="#FFFFFF"
          stroke="rgba(0,0,0,0.85)"
          strokeWidth="3.2"
          strokeLinejoin="round"
          paintOrder="stroke"
          style={{ fontFamily: "var(--font-display), 'Arial Black', Impact, sans-serif" }}
        >
          {label}
        </text>
      ) : null}
    </svg>
  );
}
