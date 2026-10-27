"use client";

import { useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { GameModal } from "@/components/ui/GameModal";
import { useArmed } from "@/hooks/useArmed";
import { contractLabel, formatMoney, newDealLength, renewalFee } from "@/lib/career";
import { useCareer } from "@/lib/career/context";
import { playContractSigned, playUiClick, playWarning } from "@/lib/sound";
import { Card, Eyebrow, RatingPill, CAREER_PAGE_CLASS, CareerBackLink } from "./bits";
import { ShirtGlyph } from "@/components/icons/rugby-icons";
import { PitchHero } from "@/components/ui/PitchHero";

/**
 * The summer, before the transfer window: who retired, whose contracts are up (renew or let go),
 * and the academy graduates who have joined.
 */
export function Departures() {
  const { state, renew, release, finishDepartures } = useCareer();
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const armed = useArmed();
  const s = state!;
  const d = s.departures;
  // Each decision removes a row, so the next player's buttons slide under the finger: re-arm briefly.
  const decisionsArmed = useArmed(400, (d?.renewed?.length ?? 0) + (d?.released?.length ?? 0), { armedOnMount: true });
  const expiring = (d?.expiring ?? []).map((id) => s.players[id]).filter((p): p is NonNullable<typeof p> => !!p);
  const renewed = (d?.renewed ?? []).map((id) => s.players[id]).filter((p): p is NonNullable<typeof p> => !!p);
  const academy = (d?.academy ?? []).map((id) => s.players[id]).filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <div className={CAREER_PAGE_CLASS}>
      <CareerBackLink label="Home (progress saved)" />
      <PitchHero
        icon={<ShirtGlyph />}
        eyebrow={<>Before the {s.year} season</>}
        title="Comings and goings"
        description={<>Sort out contracts. Budget {formatMoney(s.budget)}.</>}
      />

      <Card>
        <Eyebrow>Contracts up · {expiring.length}</Eyebrow>
        {expiring.length ? (
          <>
            <p className="mt-1 text-xs text-gray-400">Renew for a one-off fee, or let him go.</p>
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
                        <span className="block truncate text-[11px] text-gray-500">
                          Age {p.age} · {p.apps} apps · {p.tries} tries
                        </span>
                        <span className="block text-[11px] text-gray-500">
                          New deal: {years} yr{years > 1 ? "s" : ""}
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
                        className="!px-2 whitespace-nowrap"
                        disabled={s.budget < fee || !decisionsArmed}
                        onClick={() => {
                          const err = renew(p.id);
                          if (err === "budget") {
                            playWarning();
                            setError(`Not enough budget to renew ${p.name}.`);
                          } else {
                            playContractSigned();
                            setError(null);
                          }
                        }}
                      >
                        {`Renew · ${formatMoney(fee)}`}
                      </GameButton>
                    </div>
                  </li>
                );
              })}
            </ul>
            {error ? <p className="mt-2 text-sm text-danger" role="alert">{error}</p> : null}
          </>
        ) : (
          <p className="mt-2 text-sm text-gray-300">All done. Everyone else is under contract.</p>
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
            {expiring.length ? `Letting the rest go leaves ${after} players.` : `Squad: ${squadNow} players.`} The minimum is 20. The board
            fills gaps with fringe players.
          </p>
        ) : null;
      })()}

      <div className="mobile-action-bar sm:static sm:border-0 sm:bg-transparent sm:p-0" role="toolbar">
        <div className="mobile-action-bar__inner">
          <GameButton
            size="lg"
            variant={expiring.length ? "secondary" : "theme"}
            disabled={!armed}
            onClick={() => {
              playUiClick();
              // Never release a whole list on one tap: confirm who's leaving first.
              if (expiring.length) setConfirmOpen(true);
              else finishDepartures();
            }}
          >
            {expiring.length ? "Continue to the window" : "Open the transfer window"}
          </GameButton>
        </div>
      </div>

      <GameModal open={confirmOpen} onClose={() => setConfirmOpen(false)} labelledBy="departures-confirm-title">
        {(() => {
          const squadNow = s.clubs[s.userClubId]!.squad.length;
          const after = squadNow - expiring.length;
          const sorted = [...expiring].sort((a, b) => b.rating - a.rating);
          return (
            <div>
              <h2 id="departures-confirm-title" className="text-center text-xl font-bold text-white">
                Let {expiring.length} go?
              </h2>
              <p className="mt-1 text-center text-sm text-[color:var(--fl-muted)]">
                They leave on a free.
              </p>
              <ul className="mt-3 max-h-64 divide-y divide-pitch-800 overflow-y-auto rounded-tile bg-pitch-950 px-3">
                {sorted.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 py-2">
                    <span className="w-8 text-[11px] font-bold uppercase text-gray-400">{p.pos}</span>
                    <span className="min-w-0 flex-1 truncate text-white">{p.name}</span>
                    <span className="text-xs text-gray-500">Age {p.age}</span>
                    <RatingPill rating={p.rating} />
                  </li>
                ))}
              </ul>
              {after < 20 ? (
                <p className="mt-3 text-center text-xs text-amber-300" role="note">
                  That leaves {after}. The minimum is 20. The board fills gaps with fringe players.
                </p>
              ) : null}
              <div className="mt-4 grid gap-2">
                <GameButton
                  onClick={() => {
                    playUiClick();
                    setConfirmOpen(false);
                    finishDepartures();
                  }}
                >
                  {`Let ${expiring.length} go · open the window`}
                </GameButton>
                <GameButton variant="secondary" onClick={() => setConfirmOpen(false)}>
                  Go back and renew
                </GameButton>
              </div>
            </div>
          );
        })()}
      </GameModal>
    </div>
  );
}
