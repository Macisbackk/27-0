"use client";

import { useCallback, useRef, useState } from "react";
import { SeasonShareCard, type SeasonShareCardData } from "@/components/SeasonShareCard";
import { captureAndShareSeasonCard } from "@/lib/share-season-card";
import { playUiClick } from "@/lib/sound";
import { ActionButton } from "@/components/ui/ActionButton";

interface ShareSeasonButtonProps {
  data: SeasonShareCardData;
  filename?: string;
  className?: string;
  variant?: "theme" | "secondary" | "ghost";
  size?: "sm" | "md";
  label?: string;
  fullWidth?: boolean;
}

export function ShareSeasonButton({
  data,
  filename = "27-0-season.png",
  className = "",
  variant = "secondary",
  size = "md",
  label = "Share season",
  fullWidth = true,
}: ShareSeasonButtonProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const handleShare = useCallback(async () => {
    playUiClick();
    if (!cardRef.current || busy) return;
    setBusy(true);
    setStatus(null);
    const result = await captureAndShareSeasonCard(cardRef.current, filename);
    setBusy(false);
    if (result === "shared") setStatus("Shared");
    else if (result === "downloaded") setStatus("Saved image");
    else setStatus("Could not share");
  }, [busy, filename]);

  return (
    <div className={className}>
      <div
        aria-hidden
        className="pointer-events-none fixed left-[-9999px] top-0 opacity-0"
      >
        <SeasonShareCard ref={cardRef} data={data} />
      </div>
      <ActionButton
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        onClick={() => void handleShare()}
        disabled={busy}
      >
        {busy ? "Preparing…" : label}
      </ActionButton>
      {status ? (
        <p className="mt-2 text-center text-xs text-[color:var(--fl-muted)]">{status}</p>
      ) : null}
    </div>
  );
}
