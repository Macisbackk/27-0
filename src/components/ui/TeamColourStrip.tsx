import { ClubColourBar } from "@/components/ClubBadge";

interface TeamColourStripProps {
  club: string;
  className?: string;
}

/**
 * Club kit colour strip for player/team identity.
 * Never uses Store UI theme colours.
 */
export function TeamColourStrip({
  club,
  className = "",
}: TeamColourStripProps) {
  return (
    <div className={className}>
      <ClubColourBar club={club} />
    </div>
  );
}
