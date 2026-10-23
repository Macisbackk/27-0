"use client";

import { useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { useArmed } from "@/hooks/useArmed";
import { contractLabel, formatMoney, newDealLength, renewalFee } from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { playUiClick, playWarning } from "@/lib/sound";
import { Card, Eyebrow, RatingPill } from "./bits";

/**
 * The summer, before the transfer window: who retired, whose contracts are up (renew or let go),
 * and the academy graduates who have joined.
 */
export function Departures() {
  const { state, renew, release, finishDepartures } = useCareer();
  const [error, setError] = useState<string | null>(null);
  const armed = useArmed();
  const s = state!;
  const d = s.departures;
  // Each decision removes a row, so the next player's buttons slide under the finger: re-arm briefly.
  const decisionsArmed = useArmed(400, (d?.renewed?.length ?? 0) + (d?.released?.length ?? 0), { armedOnMount: true });
  const expiring = (d?.expiring ?? []).map((id) => s.players[id]).filter((p): p is NonNullable<typeof p> => !!p);
  const renewed = (d?.renewed ?? []).map((id) => s.players[id]).filter((p): p is NonNullable<typeof p> => !!p);
  const academy = (d?.academy ?? []).map((id) => s.players[id]).filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <div className="mx-auto flex w-full max-w-[44rem] flex-col gap-4 pb-40 sm:pb-10">
      <header className="text-center">
        <p className="text-[13px] font-semibold text-theme-primary">Summer {s.year}</p>
        <h1 className="mt-1 text-[30px] font-bold leading-none text-white">Comings and goings</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-[color:var(--fl-muted)]">
          Sort out contracts before the transfer window opens. Budget {formatMoney(s.budget)}.
        </p>
      </header>

      <Card>
        <Eyebrow>Contracts up · {expiring.length}</Eyebrow>
        {expiring.length ? (
          <>
            <p className="mt-1 text-xs text-gray-400">Renew for a one-off signing-on fee, or let him leave on a free.</p>
            <ul className="mt-3 space-y-2">
              {expiring.map((p) => {
                const fee = renewalFee(p);
                const years = newDealLength(p.age);
                return (
                  <li key={p.id} className="rounded-tile bg-pitch-950 p-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 text-[11px] font-bold uppercase text-gray-400">{p.pos}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-white">{p.name}</span>
                        <span className="text-[11px] text-gray-500">
                          Age {p.age} · {p.apps} apps, {p.tries} tries last season
                        </span>
                      </span>
                      <RatingPill rating={p.rating} />
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-2">
                      <GameButton
                        size="sm"
                        variant="secondary"
                        disabled={!decisionsArmed}
                        onClick={() => {
                          playUiClick();
                          setError(null);
                          release(p.id);
                        }}
                      >
                        Let him go
                      </GameButton>
                      <GameButton
                        size="sm"
                        disabled={s.budget < fee || !decisionsArmed}
                        onClick={() => {
                          playUiClick();
                          const err = renew(p.id);
                          if (err === "budget") {
                            playWarning();
                            setError(`Not enough budget to renew ${p.name}.`);
                          } else setError(null);
                        }}
                      >
                        {`Renew ${years} yr${years > 1 ? "s" : ""} · ${formatMoney(fee)}`}
                      </GameButton>
                    </div>
                  </li>
                );
              })}
            </ul>
            {error ? <p className="mt-2 text-sm text-danger" role="alert">{error}</p> : null}
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-300">No decisions left. Everyone else is under contract.</p>
        )}
        {renewed.length ? (
          <p className="mt-3 text-xs text-success">
            Renewed: {renewed.map((p) => `${p.name} (${contractLabel(p.contract ?? 1)})`).join(", ")}
          </p>
        ) : null}
        {d?.released?.length ? <p className="mt-1 text-xs text-gray-400">Leaving on a free: {d.released.join(", ")}</p> : null}
      </Card>

      <Card>
        <Eyebrow>Retired · {d?.retired.length ?? 0}</Eyebrow>
        {d?.retired.length ? (
          <ul className="mt-2 divide-y divide-pitch-800">
            {d.retired.map((r) => (
              <li key={r.name} className="flex items-center gap-3 py-2">
                <span className="w-8 text-[11px] font-bold uppercase text-gray-400">{r.pos}</span>
                <span className="min-w-0 flex-1 truncate text-white">{r.name}</span>
                <span className="text-xs text-gray-500">Age {r.age}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gray-300">Nobody hung up their boots this year.</p>
        )}
      </Card>

      {academy.length ? (
        <Card>
          <Eyebrow>Academy graduates</Eyebrow>
          <ul className="mt-2 divide-y divide-pitch-800">
            {academy.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <span className="w-8 text-[11px] font-bold uppercase text-gray-400">{p.pos}</span>
                <span className="min-w-0 flex-1 truncate text-white">{p.name}</span>
                <span className="text-xs text-gray-500">Age {p.age}</span>
                <RatingPill rating={p.rating} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {(() => {
        const squadNow = s.clubs[s.userClubId]!.squad.length;
        const after = squadNow - expiring.length;
        return after < 20 ? (
          <p className="text-center text-xs text-amber-300" role="note">
            {expiring.length ? `Letting the rest go leaves ${after} players.` : `Squad: ${squadNow} players.`} The minimum is 20, so the board will
            fill the gaps with fringe players. Renew or sign to keep your quality.
          </p>
        ) : null;
      })()}

      <div className="mobile-action-bar sm:static sm:border-0 sm:bg-transparent sm:p-0" role="toolbar">
        <div className="mobile-action-bar__inner">
          <GameButton
            size="lg"
            disabled={!armed}
            onClick={() => {
              playUiClick();
              finishDepartures();
            }}
          >
            {expiring.length ? "Let the rest go · open the window" : "Open the transfer window"}
          </GameButton>
        </div>
      </div>
    </div>
  );
}
