"use client";

interface RecordWithPercentageProps {
  wins: number;
  losses: number;
  className?: string;
  recordClassName?: string;
  percentageClassName?: string;
}

/** e.g. 184-96 with (66%) in accent colour */
export function RecordWithPercentage({
  wins,
  losses,
  className = "",
  recordClassName = "",
  percentageClassName = "text-accent-green",
}: RecordWithPercentageProps) {
  const games = wins + losses;
  if (games === 0) {
    return <span className={className}>0-0</span>;
  }
  const pct = Math.round((wins / games) * 100);
  return (
    <span className={className}>
      <span className={recordClassName}>
        {wins}-{losses}
      </span>
      <span className={`ml-3 sm:ml-4 ${percentageClassName}`}>({pct}%)</span>
    </span>
  );
}

export function parseRecordWithPercentage(
  display: string
): { wins: number; losses: number; hasPercentage: boolean } | null {
  const match = display.match(/^(\d+)-(\d+)(?:\s+\([\d.]+%\))?$/);
  if (!match) return null;
  return {
    wins: Number.parseInt(match[1]!, 10),
    losses: Number.parseInt(match[2]!, 10),
    hasPercentage: display.includes("%"),
  };
}
