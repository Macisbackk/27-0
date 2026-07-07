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
  activeClassName = "border-theme-primary/60 bg-theme-primary/15 text-theme-primary",
}: BracketMobileRoundNavProps) {
  const columnClass =
    rounds.length >= 4
      ? "grid-cols-4"
      : rounds.length === 2
        ? "grid-cols-2"
        : "grid-cols-3";

  return (
    <div
      className={`bracket-round-nav grid gap-2 md:hidden ${columnClass}`}
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
            className={`min-w-0 rounded-lg border px-2 py-2.5 text-center transition ${
              isViewing
                ? activeClassName
                : "border-pitch-600/50 bg-pitch-900/50 text-gray-400 hover:border-pitch-500/60 hover:text-gray-200"
            } ${isFinal && isLive ? "border-accent-gold/40" : ""}`}
          >
            <span className="block font-display text-xs font-black uppercase tracking-wide">
              {shortLabel}
            </span>
            <span
              className={`mt-0.5 block truncate text-[9px] font-medium uppercase tracking-wider ${
                isLive
                  ? isFinal
                    ? "text-accent-gold"
                    : "text-mode-current"
                  : "text-gray-500"
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
