"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { ClubLogoBox } from "@/components/ClubBadge";
import { PAGE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { ensurePlayersLoaded } from "@/lib/players";
import { getOneClubOptions, type OneClubOption } from "@/lib/game/one-club";
import { GAUNTLET_LENGTH, getGauntletOpponents, type GauntletOpponent } from "@/lib/game/gauntlet";
import {
  formatOneClubRecord,
  loadModeRecords,
  MODE_RECORDS_CHANGED_EVENT,
  type ModeRecords,
} from "@/lib/storage/mode-records";
import { getGauntletHref, getOneClubHref } from "@/lib/play-side-modes";
import { DAILY_ARCHIVE_DAYS, DAILY_ARCHIVE_PAGE } from "@/lib/daily-archive";
import { SHOW_DAILY_CHALLENGE_UI } from "@/lib/feature-flags";
import { BALL_KNOWER_ID } from "@/lib/cosmetics";
import { useCosmetics } from "@/lib/storage/cosmetics-store";
import { setNormalEraVariant } from "@/lib/storage/preferences";
import { playUiClick } from "@/lib/sound";

function Section({ id, title, kicker, children }: { id: string; title: string; kicker: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card bg-pitch-900 p-4 text-left" aria-labelledby={id}>
      <h2 id={id} className="font-cond text-[22px] font-bold leading-tight text-white">
        {title}
      </h2>
      <p className="mt-0.5 text-[14px] leading-snug text-[color:var(--fl-muted)]">{kicker}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * More modes — the side modes that don't get a home-screen card: One-Club XI, the Gauntlet,
 * past Dailies (practice) and Ball Knower once bought.
 */
export default function ModesPage() {
  const [clubs, setClubs] = useState<OneClubOption[] | null>(null);
  const [gauntlet, setGauntlet] = useState<GauntletOpponent[] | null>(null);
  const [records, setRecords] = useState<ModeRecords | null>(null);
  const cosmetics = useCosmetics();
  const ownsBallKnower = cosmetics.owned.includes(BALL_KNOWER_ID);

  useEffect(() => {
    let live = true;
    void ensurePlayersLoaded()
      .catch(() => undefined)
      .then(() => {
        if (!live) return;
        try {
          setClubs(getOneClubOptions());
          setGauntlet(getGauntletOpponents());
        } catch {
          setClubs([]);
          setGauntlet([]);
        }
      });
    const read = () => setRecords(loadModeRecords());
    read();
    window.addEventListener(MODE_RECORDS_CHANGED_EVENT, read);
    return () => {
      live = false;
      window.removeEventListener(MODE_RECORDS_CHANGED_EVENT, read);
    };
  }, []);

  const g = records?.gauntlet;

  return (
    <StandardPageShell>
      <div className={`${PAGE.section} mx-auto w-full max-w-[44rem]`}>
        <header className="text-center">
          <h1 className="font-cond text-[30px] font-bold leading-none text-white">More modes</h1>
          <p className="mt-1 text-[14px] text-[color:var(--fl-muted)]">
            Side modes for when today&apos;s Daily is done. Unranked: no leaderboards or Club Funds.
          </p>
        </header>

        <Section
          id="one-club-title"
          title="One-Club XI"
          kicker="Pick a club. Every spin is one of its seasons, any era, this year included. Build their all-time 13 and play the season."
        >
          {clubs === null ? (
            <p className={TYPO.meta}>Loading clubs…</p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {clubs.map((option) => {
                const best = records?.oneClub[option.club];
                return (
                  <li key={option.slug}>
                    <Link
                      href={getOneClubHref(option.slug)}
                      onClick={() => playUiClick()}
                      className="btn-press flex min-h-[56px] items-center gap-3 rounded-control bg-pitch-950 px-3 py-2 text-white hover:bg-pitch-800"
                    >
                      <ClubLogoBox club={option.club} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-bold">{option.club}</span>
                        <span className="block truncate text-xs text-[color:var(--fl-muted)]">
                          {option.teamYears} seasons · {option.firstYear}–{option.lastYear}
                        </span>
                      </span>
                      <span className={`shrink-0 text-xs font-bold ${best ? "text-theme-primary" : "text-[color:var(--fl-muted)]"}`}>
                        {best ? `Best ${formatOneClubRecord(best)}` : "Play ›"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section
          id="gauntlet-title"
          title="Gauntlet"
          kicker={`Draft your 13, then face ${GAUNTLET_LENGTH} of the greatest Grand Final winners in a row, each one tougher. One defeat ends the run.`}
        >
          {gauntlet && gauntlet.length > 0 ? (
            <p className="text-xs leading-relaxed text-[color:var(--fl-muted)]">
              {gauntlet.map((o) => o.label).join(" → ")}
            </p>
          ) : null}
          {g && g.runs > 0 ? (
            <p className="mt-2 text-sm font-bold text-theme-primary">
              Best: {g.best}/{GAUNTLET_LENGTH}
              {g.sweeps > 0 ? ` · ${g.sweeps} clean sweep${g.sweeps === 1 ? "" : "s"}` : ""}
            </p>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              href={getGauntletHref(false)}
              onClick={() => {
                playUiClick();
                setNormalEraVariant(false);
              }}
              className="btn-press flex h-[48px] items-center justify-center rounded-control bg-theme-primary font-cond text-[17px] font-bold text-[color:var(--theme-text-on-primary)]"
            >
              Classic draft
            </Link>
            <Link
              href={getGauntletHref(true)}
              onClick={() => {
                playUiClick();
                setNormalEraVariant(true);
              }}
              className="btn-press flex h-[48px] items-center justify-center rounded-control bg-pitch-800 font-cond text-[17px] font-bold text-white"
            >
              Era Classic draft
            </Link>
          </div>
        </Section>

        {SHOW_DAILY_CHALLENGE_UI ? (
          <Section
            id="past-dailies-title"
            title="Past Dailies"
            kicker={`Replay any of the last ${DAILY_ARCHIVE_DAYS} Dailies with the same rule and spins. Practice only: no streak, board or Club Funds.`}
          >
            <Link
              href={DAILY_ARCHIVE_PAGE}
              onClick={() => playUiClick()}
              className="btn-press flex h-[48px] items-center justify-center rounded-control bg-pitch-800 font-cond text-[17px] font-bold text-white"
            >
              Play past Dailies
            </Link>
          </Section>
        ) : null}

        {ownsBallKnower ? (
          <Section id="ball-knower-title" title="Ball Knower" kicker="Classic with every rating hidden.">
            <div className="grid grid-cols-2 gap-2">
              <Link href="/play?bk=1" className="btn-press flex h-[48px] items-center justify-center rounded-control bg-theme-primary text-sm font-bold text-[color:var(--theme-text-on-primary)]">
                Classic
              </Link>
              <Link href="/play?bk=1&era=1" className="btn-press flex h-[48px] items-center justify-center rounded-control bg-pitch-800 text-sm font-bold text-white">
                Era Classic
              </Link>
            </div>
          </Section>
        ) : null}
      </div>
    </StandardPageShell>
  );
}
