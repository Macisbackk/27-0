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
  return (
    <div
      className="bracket-round-nav flex gap-2 overflow-x-auto pb-1 md:hidden"
      role="tablist"
      aria-label="Bracket rounds"
    >
      {rounds.map((round) => {
        const isViewing = viewRound === round;
        const isLive = activeRound === round;
        const label = getShortLabel?.(round) ?? getLabel(round);

        return (
          <button
            key={round}
            type="button"
            role="tab"
            aria-selected={isViewing}
            onClick={() => onViewRoundChange(round)}
            className={`shrink-0 rounded-lg border px-3 py-2 text-left transition ${
              isViewing
                ? activeClassName
                : "border-pitch-600/50 bg-pitch-900/50 text-gray-400 hover:border-pitch-500/60 hover:text-gray-200"
            }`}
          >
            <span className="block font-display text-xs font-black uppercase tracking-wide">
              {label}
            </span>
            <span className="mt-0.5 block text-[9px] font-medium uppercase tracking-wider text-gray-500">
              {isLive ? "Live" : getLabel(round)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
