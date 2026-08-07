import { getClubColors } from "@/lib/clubs";
import { getMatchEventTeamAccentColour } from "@/lib/ui/contrast";
import { TYPO } from "@/lib/ui/typography";
import type { LiveMatchEvent } from "@/lib/manager/types";

function stripEventMinutePrefix(description: string, minute: number): string {
  const prefix = `${minute}'`;
  if (!description.startsWith(prefix)) return description;
  return description.slice(prefix.length).trimStart();
}

function mentionsClub(body: string, club: string): boolean {
  if (!club || !body) return false;
  return body.toLowerCase().includes(club.toLowerCase());
}

/**
 * Ensure the line names the side when commentary only has a kicker/player
 * (or a generic) and no club string — color dots alone are easy to miss.
 */
function ensureTeamAttribution(
  body: string,
  teamClub: string,
  userClub: string,
  opponentClub: string
): string {
  if (!teamClub || !body) return body;
  if (
    mentionsClub(body, userClub) ||
    mentionsClub(body, opponentClub) ||
    mentionsClub(body, teamClub)
  ) {
    return body;
  }
  return `${teamClub} · ${body}`;
}

interface ManagerMatchEventLineProps {
  event: LiveMatchEvent;
  userClub: string;
  opponentClub: string;
  className?: string;
}

export function ManagerMatchEventLine({
  event,
  userClub,
  opponentClub,
  className = "",
}: ManagerMatchEventLineProps) {
  const isPeriodMarker =
    event.type === "half_time" || event.type === "full_time";
  const teamClub =
    event.teamName?.trim() ||
    (event.team === "user" ? userClub : opponentClub);
  const colors = getClubColors(teamClub);
  const teamColor = getMatchEventTeamAccentColour(colors);
  let body = stripEventMinutePrefix(event.description, event.minute);
  if (!isPeriodMarker) {
    // Keep club names in commentary — stripping them left orphan phrases
    // like "earn a six-again…" with no readable team/player actor.
    body = ensureTeamAttribution(body, teamClub, userClub, opponentClub);
  }

  return (
    <li
      className={`grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-x-2 ${TYPO.bodySm} ${className}`}
    >
      <span className="pt-px text-right font-mono tabular-nums text-pitch-500">
        {event.minute}&apos;
      </span>
      <span className="min-w-0">
        {isPeriodMarker ? (
          <span className="font-semibold text-pitch-200">{body}</span>
        ) : (
          <span className="flex min-w-0 gap-1.5">
            <span
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: teamColor }}
              aria-hidden
            />
            <span className="min-w-0 text-pitch-200">{body}</span>
          </span>
        )}
      </span>
    </li>
  );
}
