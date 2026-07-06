import { getClubIndicatorColor } from "@/lib/clubs";
import type { LiveMatchEvent } from "@/lib/manager/types";

function stripEventMinutePrefix(description: string, minute: number): string {
  const prefix = `${minute}'`;
  if (!description.startsWith(prefix)) return description;
  return description.slice(prefix.length).trimStart();
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
  const teamClub = event.team === "user" ? userClub : opponentClub;
  const teamColor = getClubIndicatorColor(teamClub);
  const body = stripEventMinutePrefix(event.description, event.minute);

  return (
    <li className={`text-[11px] leading-snug sm:text-xs ${className}`}>
      <span className="font-mono text-pitch-500">{event.minute}&apos;</span>{" "}
      <span className="font-semibold" style={{ color: teamColor }}>
        {teamClub}
      </span>
      {body ? (
        <>
          <span className="text-pitch-500"> · </span>
          <span className="text-pitch-200">{body}</span>
        </>
      ) : null}
    </li>
  );
}
