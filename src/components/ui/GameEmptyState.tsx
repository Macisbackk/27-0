import type { ReactNode } from "react";
import { TYPO } from "@/lib/ui/typography";
import { GameShortContent } from "./GameShortContent";

interface GameEmptyStateProps {
  title?: string;
  message: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Shared empty / placeholder state — centred within the content column. */
export function GameEmptyState({
  title,
  message,
  action,
  className = "",
}: GameEmptyStateProps) {
  return (
    <GameShortContent className={`py-6 sm:py-8 ${className}`.trim()}>
      {title ? (
        <p className={`${TYPO.sectionLabel} text-pitch-400`}>{title}</p>
      ) : null}
      <p
        className={`${title ? "mt-2 " : ""}${TYPO.bodySm} text-pitch-400`}
      >
        {message}
      </p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </GameShortContent>
  );
}
