import { ClubColourBar } from "@/components/ClubBadge";
import { getClubColors } from "@/lib/clubs";

interface TeamColourStripProps {
  club: string;
  /** Slightly taller strip for featured / expanded cards. */
  thick?: boolean;
  className?: string;
}

/**
 * Club kit colour strip for player/team identity.
 * Never uses Store UI theme colours.
 */
export function TeamColourStrip({
  club,
  thick = false,
  className = "",
}: TeamColourStripProps) {
  if (!thick) {
    return (
      <div className={className}>
        <ClubColourBar club={club} />
      </div>
    );
  }

  const colors = getClubColors(club);
  return (
    <div
      className={`flex h-2 w-full shrink-0 overflow-hidden ${className}`.trim()}
      aria-hidden
    >
      <span className="h-full flex-1" style={{ backgroundColor: colors.primary }} />
      <span className="h-full flex-1" style={{ backgroundColor: colors.secondary }} />
      {colors.accent ? (
        <span className="h-full w-1.5" style={{ backgroundColor: colors.accent }} />
      ) : null}
    </div>
  );
}
