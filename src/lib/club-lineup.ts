import type { Position } from "./types";
import type { ClubPlayerEntry } from "./squad-analysis";
import { formatPositionReviewText } from "./squad-display";

export interface LineupRow {
  positionLabel: string;
  players: ClubPlayerEntry[];
}

export interface LineupGroup {
  label: string;
  rows: LineupRow[];
}

const WING_LABELS = ["Left Wing", "Right Wing"] as const;
const CENTRE_LABELS = ["Left Centre", "Right Centre"] as const;
const PROP_LABELS = ["Left Prop", "Right Prop"] as const;
const SECOND_ROW_LABELS = ["Left Second Row", "Right Second Row"] as const;

const LINEUP_GROUPS: {
  label: string;
  positions: Position[];
}[] = [
  { label: "Full Back", positions: ["FULLBACK"] },
  { label: "Wings / Centres", positions: ["WING", "CENTRE"] },
  { label: "Halves", positions: ["STAND_OFF", "SCRUM_HALF"] },
  {
    label: "Forwards",
    positions: ["PROP", "HOOKER", "SECOND_ROW", "LOOSE_FORWARD"],
  },
];

function lineupPositionLabel(position: Position, index: number): string {
  if (position === "WING") return WING_LABELS[index] ?? "Wing";
  if (position === "CENTRE") return CENTRE_LABELS[index] ?? "Centre";
  if (position === "PROP") return PROP_LABELS[index] ?? "Prop";
  if (position === "SECOND_ROW") return SECOND_ROW_LABELS[index] ?? "Second Row";
  if (position === "FULLBACK") return "Fullback";
  if (position === "STAND_OFF") return "Stand Off";
  if (position === "SCRUM_HALF") return "Scrum Half";
  if (position === "HOOKER") return "Hooker";
  return "Loose Forward";
}

const POSITION_SORT: Record<Position, number> = {
  FULLBACK: 0,
  WING: 1,
  CENTRE: 2,
  STAND_OFF: 3,
  SCRUM_HALF: 4,
  PROP: 5,
  HOOKER: 6,
  SECOND_ROW: 7,
  LOOSE_FORWARD: 8,
};

/** Group club representation players into a rugby league line-up view. */
export function buildClubLineupGroups(players: ClubPlayerEntry[]): LineupGroup[] {
  const sorted = [...players].sort(
    (a, b) =>
      POSITION_SORT[a.playedPosition] - POSITION_SORT[b.playedPosition] ||
      a.name.localeCompare(b.name)
  );

  const positionCounts = new Map<Position, number>();

  const groups: LineupGroup[] = [];

  for (const groupDef of LINEUP_GROUPS) {
    const rows: LineupRow[] = [];

    for (const position of groupDef.positions) {
      const matching = sorted.filter((p) => p.playedPosition === position);
      for (const player of matching) {
        const index = positionCounts.get(position) ?? 0;
        positionCounts.set(position, index + 1);
        rows.push({
          positionLabel: lineupPositionLabel(position, index),
          players: [player],
        });
      }
    }

    if (rows.length > 0) {
      groups.push({ label: groupDef.label, rows });
    }
  }

  return groups;
}

export function formatLineupPositionText(player: ClubPlayerEntry): string {
  return formatPositionReviewText(player);
}
