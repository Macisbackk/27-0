"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import seedrandom from "seedrandom";
import { getClubsWithPlayers } from "@/lib/players";
import { ClubDualSwatch } from "./ClubDualSwatch";
import { ClubHeaderBar } from "./ClubBadge";
import { getClubColors } from "@/lib/clubs";

interface ChallengeCupClubSelectProps {
  seed: string;
  onSelect: (club: string) => void;
}

export function ChallengeCupClubSelect({
  seed,
  onSelect,
}: ChallengeCupClubSelectProps) {
  const clubs = useMemo(() => getClubsWithPlayers(), []);
  const [selected, setSelected] = useState<string>("");
  const [revealing, setRevealing] = useState<string | null>(null);

  const handleConfirm = () => {
    if (selected) onSelect(selected);
  };

  const handleRandom = () => {
    const rng = seedrandom(`${seed}-random-club`);
    const club = clubs[Math.floor(rng() * clubs.length)];
    setRevealing(club);
    setTimeout(() => {
      setSelected(club);
      setRevealing(null);
      onSelect(club);
    }, 2200);
  };

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="text-center">
        <p className="font-display text-xs font-bold uppercase tracking-[0.35em] text-accent-green">
          Challenge Cup
        </p>
        <h2 className="mt-2 font-display text-2xl font-black sm:text-3xl">
          Choose Your Team
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          Draft players from one club only — build the greatest version of that
          team.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {revealing ? (
          <motion.div
            key="reveal"
            className="matchday-panel mt-8 overflow-hidden p-8 text-center"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
          >
            <p className="font-display text-xs font-bold uppercase tracking-[0.3em] text-accent-gold">
              Random Club
            </p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6"
            >
              <ClubHeaderBar club={revealing} size="lg" thick />
              <p className="mt-4 font-display text-2xl font-black text-white">
                {revealing}
              </p>
              <p className="mt-2 text-sm text-gray-400">Preparing your squad…</p>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="select"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="matchday-panel mt-8 p-5 sm:p-6"
          >
            <label
              htmlFor="cup-club-select"
              className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500"
            >
              Select Team
            </label>
            <div className="flex gap-2">
              <select
                id="cup-club-select"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="rl-filter-input min-w-0 flex-1 rounded-lg border border-pitch-600 bg-pitch-900/60 px-3 py-2.5 text-sm text-white outline-none focus:border-accent-green"
              >
                <option value="">Choose a club…</option>
                {clubs.map((club) => (
                  <option key={club} value={club}>
                    {club}
                  </option>
                ))}
              </select>
              {selected && (
                <ClubDualSwatch club={selected} size="md" className="self-center" />
              )}
            </div>

            {selected && (
              <div className="mt-4 overflow-hidden rounded-lg border border-pitch-600/40">
                <ClubHeaderBar club={selected} size="md" thick />
                <p className="px-3 py-2 text-xs text-gray-400">
                  Draft pool: {selected} players only (current, historic &
                  legends).
                </p>
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={!selected}
                onClick={handleConfirm}
                className="btn-primary w-full py-3 font-display text-sm font-bold uppercase tracking-wider disabled:opacity-40"
              >
                Confirm Team
              </button>
              <button
                type="button"
                onClick={handleRandom}
                className="btn-secondary w-full py-3 font-display text-sm font-bold uppercase tracking-wider"
              >
                Random Club
              </button>
            </div>

            <div className="mt-5 max-h-48 overflow-y-auto rounded-lg border border-pitch-600/30 p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">
                Available Clubs
              </p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {clubs.map((club) => {
                  const colors = getClubColors(club);
                  return (
                    <button
                      key={club}
                      type="button"
                      onClick={() => setSelected(club)}
                      className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition ${
                        selected === club
                          ? "border-accent-green/50 bg-accent-green/10 text-accent-green"
                          : "border-pitch-600/40 text-gray-300 hover:border-pitch-500/50"
                      }`}
                    >
                      <ClubDualSwatch club={club} size="xs" />
                      <span className="min-w-0 flex-1 break-words font-medium leading-snug">
                        {club}
                      </span>
                      <span
                        className="ml-auto hidden text-[9px] text-gray-500 sm:inline"
                        style={{ color: "inherit" }}
                      >
                        {colors.shortName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
