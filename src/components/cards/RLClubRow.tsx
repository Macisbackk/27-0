import { formatValue } from "@/lib/players";
import { ClubNameLabel } from "@/components/ClubNameLabel";
import { RL_INFO_BOX_CLASS } from "./rl-card";

interface RLClubRowProps {
  club: string;
  count: number;
  totalValue: number;
  expanded?: boolean;
  onClick?: () => void;
}

export function RLClubRow({
  club,
  count,
  totalValue,
  expanded,
  onClick,
}: RLClubRowProps) {
  const interactive = Boolean(onClick);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm ${RL_INFO_BOX_CLASS} ${
        interactive
          ? "cursor-pointer transition hover:border-accent-green/40 hover:bg-pitch-800/60"
          : ""
      } ${expanded ? "border-accent-green/40 bg-pitch-800/40" : ""}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <ClubNameLabel
          club={club}
          variant="row"
          compact
          showAccent={false}
          surface="matchDetails"
          className="min-w-0 flex-1"
        />
        <span className="shrink-0 text-xs text-gray-500">({count})</span>
        {interactive && (
          <span
            className={`shrink-0 text-[10px] text-gray-500 transition ${
              expanded ? "rotate-180" : ""
            }`}
            aria-hidden
          >
            ▼
          </span>
        )}
      </div>
      <span className="shrink-0 font-display text-sm font-bold text-accent-gold">
        {formatValue(totalValue)}
      </span>
    </button>
  );
}
