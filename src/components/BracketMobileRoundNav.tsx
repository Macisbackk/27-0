"use client";

interface BracketMobileRoundNavProps {
  rounds: readonly number[];
  viewRound: number;
  activeRound: number;
  onViewRoundChange: (round: number) => void;
  getLabel: (round: number) => string;
  getShortLabel?: (round: number) => string;
  activeClassName?: string;
}

export function BracketMobileRoundNav({
  rounds,
  viewRound,
  activeRound,
  onViewRoundChange,
  getLabel,
  getShortLabel,
  activeClassName = "bg-pitch-800 text-white",
}: BracketMobileRoundNavProps) {
  const useSnapScroll = rounds.length >= 5;

  if (useSnapScroll) {
    return (
      <div
        className="bracket-round-nav flex snap-x snap-mandatory gap-1 overflow-x-auto rounded-control bg-pitch-950 p-1 scroll-pl-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:hidden [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Bracket rounds"
      >
        {rounds.map((round) => {
          const isViewing = viewRound === round;
          const isLive = activeRound === round;
          const shortLabel = getShortLabel?.(round) ?? getLabel(round);
          const isFinal = round === rounds[rounds.length - 1];

          return (
            <button
              key={round}
              type="button"
              role="tab"
              aria-selected={isViewing}
              onClick={() => onViewRoundChange(round)}
              className={`min-h-[44px] min-w-[4.25rem] flex-none snap-start rounded-control px-2.5 py-1.5 text-center transition ${
                isViewing
                  ? activeClassName
                  : "text-[color:var(--fl-muted)] hover:text-white"
              }`}
            >
              <span className="block text-[13px] font-bold">
                {shortLabel}
              </span>
              <span
                className={`mt-0.5 block truncate text-[11px] font-semibold ${
                  isLive
                    ? isFinal
                      ? "text-accent-gold"
                      : "text-theme-primary"
                    : "text-[color:var(--fl-muted)]"
                }`}
              >
                {isLive ? "Live" : getLabel(round)}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  const columnClass =
    rounds.length >= 4
      ? "grid-cols-4"
      : rounds.length === 2
        ? "grid-cols-2"
        : "grid-cols-3";

  return (
    <div
      className={`bracket-round-nav grid gap-1 rounded-control bg-pitch-950 p-1 sm:hidden ${columnClass}`}
      role="tablist"
      aria-label="Bracket rounds"
    >
      {rounds.map((round) => {
        const isViewing = viewRound === round;
        const isLive = activeRound === round;
        const shortLabel = getShortLabel?.(round) ?? getLabel(round);
        const isFinal = round === rounds[rounds.length - 1];

        return (
          <button
            key={round}
            type="button"
            role="tab"
            aria-selected={isViewing}
            onClick={() => onViewRoundChange(round)}
            className={`min-h-[44px] min-w-0 rounded-control px-2 py-1.5 text-center transition ${
              isViewing
                ? activeClassName
                : "text-[color:var(--fl-muted)] hover:text-white"
            }`}
          >
            <span className="block text-[13px] font-bold">
              {shortLabel}
            </span>
            <span
              className={`mt-0.5 block truncate text-[11px] font-semibold ${
                isLive
                  ? isFinal
                    ? "text-accent-gold"
                    : "text-theme-primary"
                  : "text-[color:var(--fl-muted)]"
              }`}
            >
              {isLive ? "Live" : getLabel(round)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
