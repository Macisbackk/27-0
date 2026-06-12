"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { Player, SquadSlot } from "@/lib/types";
import type { SeasonResult } from "@/lib/game/season-simulation";
import { generateRunSeed } from "@/lib/game/generator";
import {
  FANTASY_BUDGET,
  FANTASY_SEASON_ROUNDS,
  FANTASY_SQUAD_SIZE,
  DEFAULT_FANTASY_PICKER_FILTERS,
  autofillFantasySquad,
  getFantasyBudgetRemaining,
  signFantasyPlayerToSlot,
  clearFantasySlot,
  type FantasyPickerFilters,
} from "@/lib/game/fantasy-mode";
import { createFantasySeasonState } from "@/lib/game/fantasy-season";
import {
  createEmptySquad,
  getFilledCount,
  getSquadValue,
  isSquadComplete,
  TOTAL_SLOTS,
} from "@/lib/positions";
import { recordCompletedRun } from "@/lib/storage/run";
import { getAverageSquadRating } from "@/lib/squad-analysis";
import {
  playModeClassicStart,
  playPositionSelect,
  playSeasonStart,
  playUiClick,
} from "@/lib/sound";
import { formatValue } from "@/lib/players";
import { FANTASY_MODE_INTRO } from "@/lib/mode-labels";
import { RugbyPitch } from "./RugbyPitch";
import { SeasonReview } from "./SeasonReview";
import { FantasyBudgetPanel } from "./FantasyBudgetPanel";
import { FantasyPlayerPicker } from "./FantasyPlayerPicker";
import { FantasySeasonPlay } from "./FantasySeasonPlay";
import { GuestNotice } from "./GuestNotice";
import { BTN, CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

type FantasyPhase = "start" | "squadBuild" | "season" | "review";

function createRunSeed(runKey: number): string {
  return `${generateRunSeed()}-${runKey}`;
}

export function FantasyModeBoard() {
  const [runKey, setRunKey] = useState(0);
  const [phase, setPhase] = useState<FantasyPhase>("start");
  const [squad, setSquad] = useState<SquadSlot[]>(() => createEmptySquad());
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(
    null
  );
  const [seasonState, setSeasonState] = useState<ReturnType<
    typeof createFantasySeasonState
  > | null>(null);
  const [seasonResult, setSeasonResult] = useState<SeasonResult | null>(null);
  const [runRank, setRunRank] = useState<number | undefined>();
  const [submittedOnline, setSubmittedOnline] = useState(false);
  const [pickerFilters, setPickerFilters] = useState<FantasyPickerFilters>(
    DEFAULT_FANTASY_PICKER_FILTERS
  );
  const [autofillError, setAutofillError] = useState<string | null>(null);
  const recordedRef = useRef(false);
  const modeSoundPlayed = useRef(false);

  const { seed, runId } = useMemo(() => {
    const s = createRunSeed(runKey);
    return { seed: s, runId: `fantasy-${Date.now()}-${runKey}` };
  }, [runKey]);

  useEffect(() => {
    if (modeSoundPlayed.current) return;
    modeSoundPlayed.current = true;
    playModeClassicStart("NORMAL");
  }, []);

  const filledCount = getFilledCount(squad);
  const squadComplete = isSquadComplete(squad);
  const budgetOk = getFantasyBudgetRemaining(squad) >= 0;
  const selectedSlot =
    selectedSlotIndex !== null
      ? squad.find((s) => s.slotIndex === selectedSlotIndex) ?? null
      : null;

  const resetRun = useCallback(() => {
    setRunKey((k) => k + 1);
    setPhase("start");
    setSquad(createEmptySquad());
    setSelectedSlotIndex(null);
    setSeasonState(null);
    setSeasonResult(null);
    setRunRank(undefined);
    setSubmittedOnline(false);
    setPickerFilters(DEFAULT_FANTASY_PICKER_FILTERS);
    setAutofillError(null);
    recordedRef.current = false;
    modeSoundPlayed.current = false;
  }, []);

  const handleStart = () => {
    setPhase("squadBuild");
  };

  const handleSelectSlot = (slotIndex: number) => {
    playPositionSelect();
    setSelectedSlotIndex(slotIndex);
  };

  const handlePickPlayer = (player: Player) => {
    if (selectedSlotIndex === null) return;
    setSquad((prev) => signFantasyPlayerToSlot(prev, player, selectedSlotIndex));
    setSelectedSlotIndex(null);
  };

  const handleRemovePlayer = () => {
    if (selectedSlotIndex === null) return;
    setSquad((prev) => clearFantasySlot(prev, selectedSlotIndex));
    setSelectedSlotIndex(null);
  };

  const handleAutofill = () => {
    playUiClick();
    const result = autofillFantasySquad(squad);
    if (result.success) {
      setSquad(result.squad);
      setAutofillError(null);
      setSelectedSlotIndex(null);
    } else {
      setAutofillError(result.message);
    }
  };

  const handleBeginSeason = () => {
    if (!squadComplete || !budgetOk) return;
    playSeasonStart();
    setSeasonState(createFantasySeasonState(squad, seed));
    setPhase("season");
  };

  const handleSeasonComplete = useCallback(
    (result: SeasonResult) => {
      setSeasonResult(result);
      setPhase("review");

      if (recordedRef.current) return;
      recordedRef.current = true;

      const signedIds = squad
        .filter((s) => s.player)
        .map((s) => s.player!.id);
      const value = getSquadValue(squad);
      const avgRating = getAverageSquadRating(squad);

      void recordCompletedRun(
        {
          id: runId,
          mode: "FANTASY",
          status: "COMPLETED",
          currentPlayer: null,
          currentIndex: TOTAL_SLOTS,
          totalOffers: TOTAL_SLOTS,
          squad,
          totalValue: value,
          filledCount: getFilledCount(squad),
          totalSlots: TOTAL_SLOTS,
          canSign: false,
          seed,
        },
        signedIds,
        "NORMAL",
        {
          seasonWins: result.wins,
          seasonLosses: result.losses,
          seasonLeaguePosition: result.leaguePosition,
          isPerfectSeason: result.isPerfect,
          longestWinStreak: result.longestWinStreak,
          longestLosingStreak: result.longestLosingStreak,
          averageSquadRating: avgRating,
        }
      ).then(({ nationalRank, submittedOnline: online }) => {
        setRunRank(nationalRank);
        setSubmittedOnline(online);
      });

    },
    [squad, runId, seed]
  );

  return (
    <div className="matchday-arena min-h-screen pb-16 pt-6">
      <div className="mx-auto max-w-5xl px-4">
        <GuestNotice variant="play" />

        <header className="mb-6 text-center">
          <h1 className="font-display text-3xl font-black sm:text-4xl">
            Fantasy Mode
          </h1>
          {phase === "start" && (
            <p className={`mx-auto mt-3 max-w-lg ${TYPO.body}`}>{FANTASY_MODE_INTRO}</p>
          )}
        </header>

        {phase === "start" && (
          <div className={`mx-auto max-w-xl ${CARD.glass} ${CARD.panel} ${SPACING.cardPaddingLg}`}>
            <h2 className={TYPO.cardTitle}>Fantasy Mode</h2>
            <p className={`mt-3 ${TYPO.body}`}>{FANTASY_MODE_INTRO}</p>
            <ul className="mt-5 space-y-2 text-sm text-gray-400">
              <li>Budget: {formatValue(FANTASY_BUDGET)}</li>
              <li>Squad size: {FANTASY_SQUAD_SIZE} players</li>
              <li>Season length: {FANTASY_SEASON_ROUNDS} rounds</li>
            </ul>
            <button
              type="button"
              onClick={handleStart}
              className={`mt-6 w-full ${BTN.base} ${BTN.primary}`}
            >
              Start Fantasy Mode →
            </button>
          </div>
        )}

        {(phase === "squadBuild" || phase === "season") && (
          <>
            <FantasyBudgetPanel squad={squad} />

            {phase === "squadBuild" && (
              <>
                <p className={`mt-4 text-center ${TYPO.bodySm}`}>
                  Tap a position to browse and sign players (
                  {filledCount}/{TOTAL_SLOTS} filled).
                </p>

                {!squadComplete && (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={handleAutofill}
                      className={`${BTN.base} ${BTN.greenOutlineSm} px-6`}
                    >
                      Auto Fill Squad
                    </button>
                  </div>
                )}
                {autofillError && (
                  <p className="mx-auto mt-2 max-w-md text-center text-xs font-medium text-accent-red sm:text-sm">
                    {autofillError}
                  </p>
                )}

                <div className={`${CARD.panel} mt-4 p-2 sm:p-4`}>
                  <RugbyPitch
                    squad={squad}
                    totalValue={getSquadValue(squad)}
                    filledCount={filledCount}
                    totalSlots={TOTAL_SLOTS}
                    selectedSlot={selectedSlotIndex ?? undefined}
                    interactive
                    allowFilledSlotClick
                    hideValueSummary
                    onSlotClick={handleSelectSlot}
                  />
                </div>

                {squadComplete && budgetOk && (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={handleBeginSeason}
                      className={`${BTN.base} ${BTN.primary}`}
                    >
                      Begin Season →
                    </button>
                  </div>
                )}
              </>
            )}

            {phase === "season" && seasonState && (
              <div className="mt-4">
                <FantasySeasonPlay
                  initialState={seasonState}
                  squad={squad}
                  onComplete={handleSeasonComplete}
                />
              </div>
            )}
          </>
        )}

        {phase === "review" && seasonResult && (
          <SeasonReview
            squad={squad}
            mode="FANTASY"
            seasonResult={seasonResult}
            seed={seed}
            difficulty="NORMAL"
            runRank={runRank}
            submittedOnline={submittedOnline}
            onPlayAgain={resetRun}
            onClose={() => {}}
          />
        )}

        <AnimatePresence>
          {phase === "squadBuild" && selectedSlot && (
            <FantasyPlayerPicker
              slot={selectedSlot}
              squad={squad}
              filters={pickerFilters}
              onFiltersChange={setPickerFilters}
              onSelect={handlePickPlayer}
              onRemove={selectedSlot.player ? handleRemovePlayer : undefined}
              onClose={() => setSelectedSlotIndex(null)}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
