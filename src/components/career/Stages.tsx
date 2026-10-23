"use client";

import { DIVISION_LABEL, leagueOverPicture, ordinal, promotionPicture, sortTable } from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { ClubLink } from "./ClubSheet";
import { Card, ClubBadge, Eyebrow } from "./bits";

/** The regular season is over: where you finished and what it means, before the play-offs. */
export function LeagueOverCard() {
  const { state } = useCareer();
  const s = state!;
  const pic = leagueOverPicture(s);
  const table = sortTable(s.tables[pic.division]);
  const opponentId = pic.next ? (pic.next.home === s.userClubId ? pic.next.away : pic.next.home) : null;
  const opponent = opponentId ? s.clubs[opponentId] : null;
  // The rows that decide things: the top four (or top two) and the bottom two.
  const keyRows = pic.division === "super-league" ? [0, 1, 2, 3, table.length - 2, table.length - 1] : [0, 1];
  const shown = new Set([...keyRows, pic.position - 1]);

  return (
    <section aria-label="League over" className="flex flex-col gap-4">
      <Card>
        <Eyebrow>{DIVISION_LABEL[pic.division]} · final table</Eyebrow>
        <p className="mt-2 font-display text-4xl font-bold leading-none text-white">{ordinal(pic.position)}</p>
        <p className="mt-2 text-sm text-gray-300">{pic.verdict}</p>
        {opponent && pic.next ? (
          <div className="mt-4 flex items-center gap-3 rounded-tile bg-pitch-950 p-3">
            <ClubBadge club={opponent} size="md" />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-400">{pic.next.label} · {pic.next.home === s.userClubId ? "home" : "away"}</p>
              <p className="truncate font-display text-lg font-bold text-white">
                <ClubLink clubId={opponent.id}>{opponent.name}</ClubLink>
              </p>
            </div>
          </div>
        ) : null}
      </Card>
      <Card>
        <Eyebrow>How it finished</Eyebrow>
        <ol className="mt-2 space-y-1">
          {table.map((row, i) =>
            shown.has(i) ? (
              <li
                key={row.clubId}
                className={`flex items-center gap-2 rounded-control px-2 py-1.5 text-sm ${row.clubId === s.userClubId ? "bg-theme-primary/10 text-white" : "text-gray-300"}`}
              >
                <span className="w-6 text-right tabular-nums text-gray-500">{i + 1}</span>
                <ClubBadge club={s.clubs[row.clubId]!} size="sm" />
                <span className="min-w-0 flex-1 truncate">{s.clubs[row.clubId]!.name}</span>
                <span className="tabular-nums text-gray-400">{row.pts} pts</span>
              </li>
            ) : null
          )}
        </ol>
      </Card>
    </section>
  );
}

/** Promotion and relegation, settled after the Million Pound Game and before the Grand Final. */
export function PromotionCard() {
  const { state } = useCareer();
  const s = state!;
  const pic = promotionPicture(s);
  const mine = (ids: string[]) => ids.includes(s.userClubId);
  const row = (id: string, tone: string, to: string) => {
    const club = s.clubs[id]!;
    return (
      <li key={id} className={`flex items-center gap-3 rounded-tile p-2.5 ${id === s.userClubId ? "bg-theme-primary/10" : "bg-pitch-950"}`}>
        <ClubBadge club={club} size="md" />
        <span className="min-w-0 flex-1 truncate font-semibold text-white">{club.name}</span>
        <span className={`text-xs font-bold ${tone}`}>{to}</span>
      </li>
    );
  };
  const mpg = pic.mpg;
  const mpgWinner = mpg?.result ? (mpg.result.homeScore > mpg.result.awayScore ? mpg.home : mpg.away) : null;

  return (
    <section aria-label="Promotion and relegation" className="flex flex-col gap-4">
      <Card>
        <Eyebrow>Promotion and relegation</Eyebrow>
        <p className="mt-2 text-sm text-gray-300">
          {mine(pic.up)
            ? "You're going up. Super League next season."
            : mine(pic.down)
              ? "You're going down. The Championship next season."
              : "Your division stays the same next season."}
        </p>
        {mpg?.result && mpgWinner ? (
          <p className="mt-2 text-xs text-gray-400">
            Million Pound Game: {s.clubs[mpg.home]!.short} {mpg.result.homeScore}–{mpg.result.awayScore} {s.clubs[mpg.away]!.short}.{" "}
            {mpgWinner === mpg.away ? `${s.clubs[mpg.away]!.name} win promotion.` : `${s.clubs[mpg.home]!.name} stay up.`}
          </p>
        ) : null}
      </Card>
      <Card>
        <Eyebrow>Going up</Eyebrow>
        <ul className="mt-2 space-y-1.5">{pic.up.map((id) => row(id, "text-success", "To Super League"))}</ul>
      </Card>
      <Card>
        <Eyebrow>Going down</Eyebrow>
        <ul className="mt-2 space-y-1.5">{pic.down.map((id) => row(id, "text-danger", "To Championship"))}</ul>
      </Card>
    </section>
  );
}
