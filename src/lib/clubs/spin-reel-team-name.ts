/** Explicit short labels for spin reel display (full name shown in locked summary). */
const SPIN_REEL_TEAM_SHORT: Record<string, string> = {
  "Bradford Bulls": "Bradford",
  "Castleford Tigers": "Castleford",
  "Catalans Dragons": "Catalans",
  "Huddersfield Giants": "Huddersfield",
  "Hull FC": "Hull FC",
  "Hull KR": "Hull KR",
  "Leeds Rhinos": "Leeds",
  "Leigh Leopards": "Leigh",
  "London Broncos": "London",
  "Salford Red Devils": "Salford",
  "St Helens": "St Helens",
  "Toulouse Olympique": "Toulouse",
  "Wakefield Trinity": "Wakefield",
  "Warrington Wolves": "Warrington",
  "Wigan Warriors": "Wigan",
  "York Knights": "York",
};

const DROP_SUFFIXES = new Set([
  "Bulls",
  "Tigers",
  "Dragons",
  "Giants",
  "Wolves",
  "Warriors",
  "Rhinos",
  "Raiders",
  "Rovers",
  "Eagles",
  "Trinity",
  "Olympique",
  "Leopards",
  "Broncos",
  "Knights",
  "Devils",
]);

/** Compact team label for Normal Mode spin reels — fixed height, no wrap. */
export function formatSpinReelTeamName(team: string): string {
  const trimmed = team.trim();
  if (!trimmed) return "—";

  const mapped = SPIN_REEL_TEAM_SHORT[trimmed];
  if (mapped) return mapped;

  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2 && DROP_SUFFIXES.has(parts[parts.length - 1]!)) {
    return parts.slice(0, -1).join(" ");
  }

  return trimmed;
}
