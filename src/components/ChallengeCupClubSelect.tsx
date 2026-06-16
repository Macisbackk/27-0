"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import seedrandom from "seedrandom";
import { getClubsWithPlayers } from "@/lib/players";
import { ClubDualSwatch } from "./ClubDualSwatch";
import { ClubHeaderBar } from "./ClubBadge";
import { getClubColors } from "@/lib/clubs";
import { BTN, CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

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
    <div className={`mx-auto w-full max-w-xl ${SPACING.pageX} py-6`}>
      <div
        className={`${CARD.glass} ${CARD.panel} w-full ${SPACING.cardPaddingLg} transition hover:border-accent-green/30`}
      >
        <h2 className={TYPO.cardTitle}>Challenge Cup</h2>
        <p className={`mt-3 ${TYPO.body}`}>
          Draft players from one club only — build the greatest version of that
          team and battle through a knockout tournament.
        </p>

        <AnimatePresence mode="wait">
        {revealing ? (
          <motion.div
            key="reveal"
            className={`${CARD.panel} mt-8 overflow-hidden ${SPACING.cardPaddingLg} text-center`}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
          >
            <p className={`${TYPO.sectionTitle} text-accent-green`}>
              Random Club
            </p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-6"
            >
              <ClubHeaderBar club={revealing} size="lg" thick />
              <p className={`mt-4 ${TYPO.pageTitle}`}>{revealing}</p>
              <p className={`mt-2 ${TYPO.bodySm}`}>Preparing your squad…</p>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="select"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`${CARD.panel} mt-8 ${SPACING.cardPadding}`}
          >
            <label htmlFor="cup-club-select" className={`mb-2 block ${TYPO.statLabel}`}>
              Select Team
            </label>
            <div className={`flex ${SPACING.buttonGap}`}>
              <select
                id="cup-club-select"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className={`${FILTER.input} min-w-0 flex-1`}
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
              <div className={`mt-4 overflow-hidden ${CARD.base}`}>
                <ClubHeaderBar club={selected} size="md" thick />
                <p className={`px-3 py-2 ${TYPO.bodySm}`}>
                  Draft pool: {selected} players only (current, historic &
                  legends).
                </p>
              </div>
            )}

            <div className={`mt-6 grid ${SPACING.buttonGap} sm:grid-cols-2`}>
              <button
                type="button"
                disabled={!selected}
                onClick={handleConfirm}
                className={`${BTN.base} ${BTN.primary} w-full disabled:opacity-40`}
              >
                Confirm Team
              </button>
              <button
                type="button"
                onClick={handleRandom}
                className={`${BTN.base} ${BTN.secondary} w-full`}
              >
                Random Club
              </button>
            </div>

            <div className={`mt-5 max-h-48 overflow-y-auto ${CARD.inset} p-3`}>
              <p className={`mb-2 ${TYPO.statLabel}`}>Available Clubs</p>
              <div className={`grid gap-1.5 sm:grid-cols-2`}>
                {clubs.map((club) => {
                  const colors = getClubColors(club);
                  return (
                    <button
                      key={club}
                      type="button"
                      onClick={() => setSelected(club)}
                      className={`flex min-h-[44px] items-center gap-2 rounded-lg border px-2.5 py-2 text-left ${TYPO.bodySm} transition ${
                        selected === club
                          ? `${CARD.selected} border-accent-green/50 text-accent-green`
                          : `${CARD.base} text-gray-300 hover:border-pitch-500/50`
                      }`}
                    >
                      <ClubDualSwatch club={club} size="xs" />
                      <span className="min-w-0 flex-1 break-words font-medium leading-snug">
                        {club}
                      </span>
                      <span className="ml-auto hidden text-[9px] sm:inline">
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
    </div>
  );
}
