"use client";

import { ClubNameLabel } from "./ClubNameLabel";

interface TryScorerClubBadgeProps {
  club: string;
  className?: string;
}

/** Club name pill with automatic contrast on club primary colour. */
export function TryScorerClubBadge({
  club,
  className = "",
}: TryScorerClubBadgeProps) {
  return <ClubNameLabel club={club} variant="pill" className={className} />;
}
