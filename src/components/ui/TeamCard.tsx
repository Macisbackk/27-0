import type { ReactNode } from "react";
import { TeamColourStrip } from "@/components/ui/TeamColourStrip";
import { CARD } from "@/lib/ui/design-system";

interface TeamCardProps {
  club: string;
  children?: ReactNode;
  className?: string;
}

/** Club identity panel — kit strip + club name over CARD.player surface. */
export function TeamCard({ club, children, className = "" }: TeamCardProps) {
  return (
    <div className={`${CARD.player} overflow-hidden ${className}`.trim()}>
      <TeamColourStrip club={club} />
      <div className="p-3 sm:p-4">
        <p className="font-display text-sm font-semibold tracking-tight text-white">
          {club}
        </p>
        {children ? <div className="mt-2">{children}</div> : null}
      </div>
    </div>
  );
}
