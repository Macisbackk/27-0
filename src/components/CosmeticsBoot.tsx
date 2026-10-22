"use client";

import { useEffect } from "react";
import { useCosmetics } from "@/lib/storage/cosmetics-store";

/** Puts page-wide Store cosmetics (the player-card frame) on <html> so plain CSS can style them. */
export function CosmeticsBoot() {
  const { equipped } = useCosmetics();
  useEffect(() => {
    const root = document.documentElement;
    const frame = equipped.frame?.replace(/^frame-/, "") ?? "";
    if (frame) root.dataset.cardFrame = frame;
    else delete root.dataset.cardFrame;
  }, [equipped.frame]);
  return null;
}
