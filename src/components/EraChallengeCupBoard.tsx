"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SquadSlot } from "@/lib/types";
import type { ChallengeCupResult } from "@/lib/game/challenge-cup-simulation";
import { generateRunSeed } from "@/lib/game/generator";
import {
  buildEraSquadFromRoster,
  getAllEraTeams,
  type EraTeam,
} from "@/lib/players/era-teams";
import {
  createEraChallengeCupBracket,
  type ChallengeCupBracketState,
} from "@/lib/game/challenge-cup-bracket";
import {
  getFilledCount,
  getSquadValue,
  TOTAL_SLOTS,
} from "@/lib/positions";
import { recordCompletedRun } from "@/lib/storage/run";
import { getAverageSquadRating } from "@/lib/squad-analysis";
import { playModeChallengeCupStart } from "@/lib/sound";
import { ERA_CHALLENGE_CUP_INTRO } from "@/lib/mode-labels";
import { ChallengeCupBracket } from "./ChallengeCupBracket";
import { ChallengeCupReview } from "./ChallengeCupReview";
import { EraChallengeCupSelect } from "./EraChallengeCupSelect";
import { ChallengeCupVariantToggle } from "./ChallengeCupVariantToggle";
import { GuestNotice } from "./GuestNotice";
import { BTN, CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";

type EraPhase = "start" | "select" | "preview" | "bracket" | "review";

function createRunSeed(runKey: number): string {
  return `${generateRunSeed()}-${runKey}`;
}

export function EraChallengeCupBoard() {
  const [runKey, setRunKey] = useState(0);
  const [phase, setPhase] = useState<EraPhase>("start");
  const [eraTeam, setEraTeam] = useState<EraTeam | null>(null);
  const [squad, setSquad] = useState<SquadSlot[]>([]);
  const [bracketState, setBracketState] =
    useState<ChallengeCupBracketState | null>(null);
  const [cupResult, setCupResult] = useState<ChallengeCupResult | null>(null);
  const [submittedOnline, setSubmittedOnline] = useState(false);
  const recordedRef = useRef(false);
  const modeSoundPlayed = useRef(false);

  const allEraTeams = useMemo(() => getAllEraTeams(), []);

  const { seed, runId } = useMemo(() => {
    const s = createRunSeed(runKey);
    return { seed: s, runId: `era-cup-${Date.now()}-${runKey}` };
  }, [runKey]);

  useEffect(() => {
    if (modeSoundPlayed.current) return;
    modeSoundPlayed.current = true;
    playModeChallengeCupStart();
  }, []);

  const resetRun = useCallback(() => {
    setRunKey((k) => k + 1);
    setPhase("start");
    setEraTeam(null);
    setSquad([]);
    setBracketState(null);
    setCupResult(null);
    setSubmittedOnline(false);
    recordedRef.current = false;
    modeSoundPlayed.current = false;
  }, []);

  const handleTeamConfirm = (team: EraTeam) => {
    setEraTeam(team);
    setSquad(
      buildEraSquadFromRoster(
        team.playerIds,
        team.slotPositions,
        Number(team.year)
      )
    );
    setPhase("preview");
  };

  const handleStartBracket = () => {
    if (!eraTeam) return;
    setBracketState(createEraChallengeCupBracket(seed, eraTeam, allEraTeams));
    setPhase("bracket");
  };

  const handleCupComplete = useCallback(
    (result: ChallengeCupResult) => {
      const eraResult: ChallengeCupResult = {
        ...result,
        resultLabel: result.isWinner
          ? "Era Challenge Cup Winners"
          : result.resultLabel,
        userClub: eraTeam?.displayName ?? result.userClub,
        eraMode: true,
      };
      setCupResult(eraResult);
      setPhase("review");

      if (recordedRef.current || !eraTeam) return;
      recordedRef.current = true;

      const signedIds = squad
        .filter((slot) => slot.player)
        .map((slot) => slot.player!.id);
      const value = getSquadValue(squad);

      void recordCompletedRun(
        {
          id: runId,
          mode: "ERA_CHALLENGE_CUP",
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
          eraChallengeCupMode: true,
          seasonWins: result.wins,
          seasonLosses: result.losses,
          cupFinish: result.finish,
          cupWon: result.isWinner,
          averageSquadRating: getAverageSquadRating(squad),
          matchResults: result.fixtures.map((fixture) => fixture.result),
          eraTeamUsed: eraTeam.displayName,
        }
      ).then(({ submittedOnline: online }) => {
        setSubmittedOnline(online);
      });
    },
    [squad, runId, seed, eraTeam]
  );

  return (
    <div className="matchday-arena min-h-screen pb-16 pt-6">
      <div className="mx-auto max-w-5xl px-4">
        <GuestNotice variant="play" />

        <header className="mb-6 text-center">
          <h1 className="font-display text-3xl font-black sm:text-4xl">
            Challenge Cup
          </h1>
          {(phase === "start" || phase === "select") && (
            <p className={`mx-auto mt-3 max-w-lg ${TYPO.body}`}>
              {ERA_CHALLENGE_CUP_INTRO}
            </p>
          )}
        </header>

        {phase === "start" && (
          <div
            className={`mx-auto max-w-xl ${CARD.glass} ${CARD.panel} ${SPACING.cardPaddingLg}`}
          >
            <ChallengeCupVariantToggle eraMode className="mb-5" />
            <h2 className={TYPO.cardTitle}>Era Challenge Cup</h2>
            <p className={`mt-3 ${TYPO.body}`}>{ERA_CHALLENGE_CUP_INTRO}</p>
            <ul className="mt-5 space-y-2 text-sm text-gray-400">
              <li>17 historic clubs · era-accurate squads</li>
              <li>16-team knockout bracket vs random era opponents</li>
              <li>Win four matches to lift the Era Challenge Cup</li>
            </ul>
            <button
              type="button"
              onClick={() => setPhase("select")}
              className={`mt-6 w-full ${BTN.base} ${BTN.primary}`}
            >
              Choose Your Era →
            </button>
          </div>
        )}

        {phase === "select" && (
          <EraChallengeCupSelect onConfirm={handleTeamConfirm} />
        )}

        {phase === "preview" && eraTeam && (
          <div
            className={`mx-auto max-w-xl ${CARD.glass} ${CARD.panel} ${SPACING.cardPaddingLg}`}
          >
            <p className={TYPO.sectionLabel}>Squad Ready</p>
            <h2 className={`mt-2 ${TYPO.cardTitle} text-accent-gold`}>
              {eraTeam.displayName}
            </h2>
            <p className={`mt-3 ${TYPO.body}`}>
              Your era squad is locked in. You&apos;ll face 15 random historic
              opponents in a knockout draw.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => setPhase("select")}
                className={`${BTN.base} ${BTN.secondary} flex-1`}
              >
                ← Change Era
              </button>
              <button
                type="button"
                onClick={handleStartBracket}
                className={`${BTN.base} ${BTN.primary} flex-1`}
              >
                Enter Draw →
              </button>
            </div>
          </div>
        )}

        {phase === "bracket" && eraTeam && bracketState && (
          <div className={`${CARD.panel} mt-4 p-2 sm:p-4`}>
            <ChallengeCupBracket
              squad={squad}
              seed={seed}
              userClub={eraTeam.displayName}
              initialState={bracketState}
              headerLabel="Era Challenge Cup"
              eraClubLookup={bracketState.eraClubLookup}
              onComplete={handleCupComplete}
            />
          </div>
        )}

        {phase === "review" && cupResult && (
          <ChallengeCupReview
            squad={squad}
            cupResult={cupResult}
            seed={seed}
            title="Era Challenge Cup Review"
            submittedOnline={submittedOnline}
            onPlayAgain={resetRun}
            onClose={() => {}}
          />
        )}
      </div>
    </div>
  );
}
