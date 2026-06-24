"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SquadSlot } from "@/lib/types";
import type { ChallengeCupResult } from "@/lib/game/challenge-cup-simulation";
import { generateRunSeed } from "@/lib/game/generator";
import {
  buildEraSquadFromRoster,
  FULL_ERA_SQUAD_SIZE,
  getAllEraTeams,
  getEraSquadYear,
  type EraTeam,
} from "@/lib/players/era-teams";
import {
  createEraChallengeCupBracket,
  EraBracketError,
  getBracketFinalWinner,
  type ChallengeCupBracketState,
} from "@/lib/game/challenge-cup-bracket";
import {
  getFilledCount,
  getSquadValue,
  TOTAL_SLOTS,
} from "@/lib/positions";
import { recordCompletedRun } from "@/lib/storage/run";
import type { ClubFundsPayoutResult } from "@/lib/club-funds";
import { awardClubFundsForRun } from "@/lib/storage/club-funds";
import { getAverageSquadRating } from "@/lib/squad-analysis";
import type { EraTournamentType } from "@/lib/storage/preferences";
import { playModeChallengeCupStart } from "@/lib/sound";
import { CupPreGameSubstitutions } from "./CupPreGameSubstitutions";
import { ChallengeCupBracket } from "./ChallengeCupBracket";
import { ChallengeCupReview } from "./ChallengeCupReview";
import { EraChallengeCupSelect } from "./EraChallengeCupSelect";
import { GuestNotice } from "./GuestNotice";
import { CARD, SPACING } from "@/lib/ui/design-system";

type EraPhase = "select" | "substitutions" | "bracket" | "review";

function createRunSeed(runKey: number): string {
  return `${generateRunSeed()}-${runKey}`;
}

export function EraChallengeCupBoard() {
  const [runKey, setRunKey] = useState(0);
  const [phase, setPhase] = useState<EraPhase>("select");
  const [eraTeam, setEraTeam] = useState<EraTeam | null>(null);
  const [squad, setSquad] = useState<SquadSlot[]>([]);
  const [bracketState, setBracketState] =
    useState<ChallengeCupBracketState | null>(null);
  const [bracketError, setBracketError] = useState<string | null>(null);
  const [cupResult, setCupResult] = useState<ChallengeCupResult | null>(null);
  const [submittedOnline, setSubmittedOnline] = useState(false);
  const [clubFundsPayout, setClubFundsPayout] =
    useState<ClubFundsPayoutResult | null>(null);
  const recordedRef = useRef(false);
  const fundsAwardedRef = useRef(false);
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
    setPhase("select");
    setEraTeam(null);
    setSquad([]);
    setBracketState(null);
    setBracketError(null);
    setCupResult(null);
    setSubmittedOnline(false);
    setClubFundsPayout(null);
    recordedRef.current = false;
    fundsAwardedRef.current = false;
    modeSoundPlayed.current = false;
  }, []);

  useEffect(() => {
    if (phase !== "review" || fundsAwardedRef.current || !cupResult) return;
    fundsAwardedRef.current = true;
    setClubFundsPayout(
      awardClubFundsForRun({
        runId,
        mode: "CHALLENGE_CUP",
        cupResult,
      })
    );
  }, [phase, runId, cupResult]);

  const handleTeamConfirm = (team: EraTeam, type: EraTournamentType) => {
    try {
      const bracket = createEraChallengeCupBracket(seed, team, allEraTeams, type);
      setBracketError(null);
      setEraTeam(team);

      const xiiiIds =
        team.xiiiPlayerIds.length > 0
          ? team.xiiiPlayerIds
          : team.playerIds.slice(0, FULL_ERA_SQUAD_SIZE);
      const xiiiPositions =
        team.slotPositions && team.slotPositions.length >= xiiiIds.length
          ? team.slotPositions.slice(0, xiiiIds.length)
          : undefined;

      const builtSquad = buildEraSquadFromRoster(
        xiiiIds,
        xiiiPositions,
        getEraSquadYear(team),
        team.displayName
      );

      setSquad(builtSquad);
      setBracketState(bracket);

      const hasBench = team.benchPlayerIds.some((id) => {
        const used = new Set(
          builtSquad.filter((s) => s.player).map((s) => s.player!.id)
        );
        return !used.has(id);
      });

      setPhase(hasBench ? "substitutions" : "bracket");
    } catch (error) {
      if (error instanceof EraBracketError) {
        setBracketError(error.message);
        return;
      }
      throw error;
    }
  };

  const handleCupComplete = useCallback(
    (result: ChallengeCupResult) => {
      const eraResult: ChallengeCupResult = {
        ...result,
        resultLabel: result.isWinner
          ? "Era Challenge Cup Winners"
          : result.resultLabel,
        userClub: eraTeam?.displayName ?? result.userClub,
        userTeamYearId: eraTeam
          ? `${eraTeam.clubName}|${getEraSquadYear(eraTeam)}`
          : undefined,
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

      const bracketWinner = result.bracketMatches
        ? getBracketFinalWinner(result.bracketMatches)
        : null;

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
          eraCupWinner: bracketWinner ?? undefined,
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

        {phase === "select" && (
          <>
            {bracketError && (
              <div
                className={`mx-auto mb-4 max-w-3xl rounded-xl border border-accent-red/50 bg-accent-red/10 px-4 py-3 text-center text-sm text-accent-red`}
                role="alert"
              >
                {bracketError}
              </div>
            )}
            <EraChallengeCupSelect onConfirm={handleTeamConfirm} />
          </>
        )}

        {phase === "substitutions" && eraTeam && (
          <CupPreGameSubstitutions
            eraTeam={eraTeam}
            initialSquad={squad}
            onConfirm={(confirmedSquad) => {
              setSquad(confirmedSquad);
              setPhase("bracket");
            }}
          />
        )}

        {phase === "bracket" && eraTeam && bracketState && (
          <div className={`${CARD.panel} mt-4 p-2 sm:p-4`}>
            <ChallengeCupBracket
              squad={squad}
              seed={seed}
              userClub={eraTeam.displayName}
              initialState={bracketState}
              headerLabel="Era Challenge Cup"
              eraMode
              eraTeamDisplayName={eraTeam.displayName}
              eraTeamYear={getEraSquadYear(eraTeam)}
              eraClubName={eraTeam.clubName}
              eraClubLookup={bracketState.eraClubLookup}
              onComplete={handleCupComplete}
            />
          </div>
        )}

        {phase === "review" && cupResult && eraTeam && (
          <ChallengeCupReview
            squad={squad}
            cupResult={cupResult}
            seed={seed}
            title="Era Challenge Cup Review"
            submittedOnline={submittedOnline}
            clubFundsPayout={clubFundsPayout}
            userClubColorOverride={eraTeam.displayName}
            onPlayAgain={resetRun}
            onClose={() => {}}
            onReturnHome={resetRun}
          />
        )}
      </div>
    </div>
  );
}
