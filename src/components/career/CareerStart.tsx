"use client";

import { useEffect, useMemo, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { GameSegmentedControl } from "@/components/ui/GameSegmentedControl";
import { buildWorld, totalMajorTrophies, type Division } from "@/lib/career";
import { newCareerSeed } from "@/lib/career/rng";
import { useCareer } from "@/lib/career/context";
import { getUsername } from "@/lib/storage/user";
import { playSeasonStart, playUiClick } from "@/lib/sound";
import { Card, ClubBadge, Eyebrow, Stars, CAREER_PAGE_CLASS, CareerBackLink } from "./bits";

export function CareerStart({ onOpenVault, onOpenRecords }: { onOpenVault: () => void; onOpenRecords: () => void }) {
  const { newCareer, legacy } = useCareer();
  // Super League first (it's the league most players know); Championship is one tap away.
  const [division, setDivision] = useState<Division>("super-league");
  const [clubId, setClubId] = useState<string | null>(null);
  const [name, setName] = useState("");
  // The seed is created on the client so the preview squads are exactly the ones you'll manage.
  const [seed, setSeed] = useState<string | null>(null);
  const choices = useMemo(() => (seed ? buildWorld(seed).choices : []), [seed]);

  useEffect(() => {
    setSeed(newCareerSeed());
    setName((n) => n || getUsername() || "");
  }, []);

  // Alphabetical within the league, so a club is easy to find.
  const list = choices
    .filter((c) => c.division === division)
    .sort((a, b) => a.name.localeCompare(b.name, "en-GB"));
  const selected = choices.find((c) => c.id === clubId) ?? null;
  const hasLegacy = legacy.lifetimeLegacyPoints > 0 || legacy.careersStarted > 0;

  return (
    <div className={CAREER_PAGE_CLASS}>
      <CareerBackLink />
      <header className="text-center">
        <Eyebrow>Rugby League Manager</Eyebrow>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Pick your club</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-300">
          Real squads. Play each round in a tap. Climb from the Championship to Old Trafford, unlock legends, and chase records.
        </p>
      </header>

      {hasLegacy ? (
        <Card className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Eyebrow>Your legacy</Eyebrow>
            <p className="mt-1 text-sm text-gray-300">
              <span className="font-display text-xl font-bold text-accent-gold">{legacy.legacyPoints}</span> Legacy points ·{" "}
              {totalMajorTrophies(legacy)} trophies · {legacy.unlockedLegends.length} legends unlocked
            </p>
          </div>
          <div className="flex gap-2">
            <GameButton size="sm" variant="secondary" fullWidth={false} onClick={() => { playUiClick(); onOpenVault(); }}>
              Legend Vault
            </GameButton>
            <GameButton size="sm" variant="secondary" fullWidth={false} onClick={() => { playUiClick(); onOpenRecords(); }}>
              Records
            </GameButton>
          </div>
        </Card>
      ) : null}

      <label className="block rounded-tile bg-pitch-900 px-3 py-2.5">
        <span className="block text-xs font-semibold text-gray-300">Manager name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 24))}
          placeholder="Your name"
          maxLength={24}
          autoComplete="nickname"
          enterKeyHint="done"
          spellCheck={false}
          className="mt-1 w-full rounded-lg border border-pitch-600 bg-pitch-950 px-3 py-2.5 text-white placeholder:text-gray-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-theme-primary"
        />
        <span className="mt-1 block text-[11px] text-gray-500">
          Shown on your Manager records. Leave it blank and you&apos;re &ldquo;Coach&rdquo;.
        </span>
      </label>

      <GameSegmentedControl<Division>
        options={[
          { id: "super-league", label: "Super League", shortLabel: "Super League" },
          { id: "championship", label: "Championship", shortLabel: "Championship" },
        ]}
        value={division}
        onChange={(d) => {
          setDivision(d);
          setClubId(null);
        }}
        ariaLabel="Division"
      />
      <p className="-mt-2 text-center text-xs text-gray-400">
        {division === "championship"
          ? "Win the league to go up. Finish 2nd and you get the Million Pound Game."
          : "Top 4 make the play-offs. Finish 13th and you play the Million Pound Game; finish bottom and you go down."}
      </p>

      <ul className="fl-stagger grid grid-cols-[minmax(0,1fr)] gap-2" aria-label="Clubs">
        {list.map((c) => {
          const active = c.id === clubId;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  playUiClick();
                  setClubId(c.id);
                }}
                aria-pressed={active}
                className={`flex w-full items-center gap-3 rounded-tile px-3 py-3 text-left transition-colors ${
                  active ? "bg-pitch-800 ring-2 ring-theme-primary" : "bg-pitch-900 hover:bg-pitch-800"
                }`}
              >
                <ClubBadge club={c} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-tight text-white">{c.name}</span>
                  <span className="mt-0.5 flex items-center text-xs text-gray-400">
                    <Stars value={c.prestige} label={`Prestige ${c.prestige} stars`} />
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-display text-lg font-bold tabular-nums text-white">{c.rating.toFixed(1)}</span>
                  <span className="block text-[10px] uppercase tracking-wide text-gray-500">Rating</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mobile-action-bar sm:static sm:mt-2 sm:border-0 sm:bg-transparent sm:p-0" role="toolbar">
        <div className="mobile-action-bar__inner flex flex-col gap-2 sm:flex-row sm:items-end">
          <GameButton
            size="lg"
            disabled={!selected}
            fullWidth
            className="sm:w-auto"
            onClick={() => {
              if (!selected || !seed) return;
              playSeasonStart();
              newCareer(selected.id, name.trim() || "Coach", seed);
            }}
          >
            {selected ? `Take charge of ${selected.name}` : "Pick a club to start"}
          </GameButton>
        </div>
      </div>
    </div>
  );
}
