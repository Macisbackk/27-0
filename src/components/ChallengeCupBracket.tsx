"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { SquadSlot } from "@/lib/types";
import {
  buildChallengeCupResult,
  canSimulateMatch,
  createChallengeCupBracket,
  getActiveRound,
  getCupRoundLabel,
  getMatchesForRound,
  simulateBracketMatch,
  simulateBracketRound,
  simulateBracketTournament,
  type BracketMatch,
  type ChallengeCupBracketState,
} from "@/lib/game/challenge-cup-bracket";
import type { ChallengeCupResult } from "@/lib/game/challenge-cup-simulation";
import {
  playCupFinalLoss,
  playCupFinalWin,
  playMatchBigWin,
  playMatchDefeat,
  playMatchNarrowWin,
  playMatchUpsetVictory,
  playPanelClose,
  playSimulateAll,
  playSimulateRound,
  playUiClick,
} from "@/lib/sound";
import { getReadableTextColor } from "@/lib/ui/contrast";
import { UI_SURFACES } from "@/lib/ui/surfaces";
import { resolveEraTeamClubName } from "@/lib/players/era-teams";
import { ClubDualSwatch } from "./ClubDualSwatch";
import { BracketMatchDetailsPanel } from "./BracketMatchDetailsPanel";
import { GameButton } from "./ui/GameButton";
import { EraChallengeCupBranding } from "./EraChallengeCupBranding";
import { BracketMobileRoundNav } from "./BracketMobileRoundNav";

const CUP_ROUND_SHORT: Record<number, string> = {
  1: "R16",
  2: "QF",
  3: "SF",
  4: "Final",
};

interface ChallengeCupBracketProps {
  squad: SquadSlot[];
  seed: string;
  userClub: string;
  onComplete: (result: ChallengeCupResult) => void;
  initialState?: ChallengeCupBracketState;
  headerLabel?: string;
  eraClubLookup?: Record<string, string>;
  eraMode?: boolean;
  eraTeamDisplayName?: string;
  eraTeamYear?: string | number;
  eraClubName?: string;
}

const ROUNDS = [1, 2, 3, 4] as const;

export function ChallengeCupBracket({
  squad,
  seed,
  userClub,
  onComplete,
  initialState,
  headerLabel = "Challenge Cup",
  eraClubLookup,
  eraMode = false,
  eraTeamDisplayName,
  eraTeamYear,
  eraClubName,
}: ChallengeCupBracketProps) {
  const [state, setState] = useState<ChallengeCupBracketState>(
    () => initialState ?? createChallengeCupBracket(seed, userClub)
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileViewRound, setMobileViewRound] = useState(() => getActiveRound(state));
  const matchDetailsRef = useRef<HTMLDivElement>(null);
  const lookup = eraClubLookup ?? state.eraClubLookup;
  const activeRound = getActiveRound(state);

  useEffect(() => {
    setMobileViewRound(activeRound);
  }, [activeRound]);

  const selectedMatch = selectedId
    ? state.matches.find((m) => m.id === selectedId)
    : null;

  useEffect(() => {
    if (!selectedId) return;
    const match = state.matches.find((m) => m.id === selectedId);
    if (match?.status !== "complete") return;
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    matchDetailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedId, state.matches]);

  const handleSimulateMatch = useCallback(
    (matchId: string) => {
      if (!canSimulateMatch(state, matchId)) return;
      playSimulateRound();
      const next = simulateBracketMatch(state, matchId, squad);
      const match = state.matches.find((m) => m.id === matchId);
      const completed = next.matches.find((m) => m.id === matchId);

      if (completed?.status === "complete" && match?.isUserMatch) {
        const uf = completed.userFixture;
        if (uf?.result === "W") {
          const margin = uf.pointsFor - uf.pointsAgainst;
          if (uf.isUpset) playMatchUpsetVictory();
          else if (uf.isThrashing || margin >= 16) playMatchBigWin();
          else playMatchNarrowWin();
        } else {
          playMatchDefeat();
        }
      }

      setState(next);
      setSelectedId(matchId);
      if (next.tournamentComplete) {
        const cupResult = buildChallengeCupResult(next, squad);
        if (cupResult.isWinner) playCupFinalWin();
        else if (cupResult.finish === "Runners-Up") playCupFinalLoss();
        else playMatchDefeat();
        onComplete(cupResult);
      }
    },
    [state, squad, onComplete]
  );

  const handleMatchPress = useCallback(
    (matchId: string) => {
      const match = state.matches.find((m) => m.id === matchId);
      if (!match) return;

      if (match.status === "ready" && canSimulateMatch(state, matchId)) {
        handleSimulateMatch(matchId);
        return;
      }

      if (match.status === "complete") {
        setSelectedId((prev) => {
          const next = prev === matchId ? null : matchId;
          if (next !== null) playUiClick();
          return next;
        });
      }
    },
    [state, handleSimulateMatch]
  );

  const handleSimulateRound = useCallback(() => {
    playSimulateRound();
    const next = simulateBracketRound(state, activeRound, squad);
    setState(next);
    if (next.tournamentComplete) {
      const cupResult = buildChallengeCupResult(next, squad);
      if (cupResult.isWinner) playCupFinalWin();
      else if (cupResult.finish === "Runners-Up") playCupFinalLoss();
      else playMatchDefeat();
      onComplete(cupResult);
    }
  }, [state, activeRound, squad, onComplete]);

  const handleSimulateTournament = useCallback(() => {
    playSimulateAll();
    const next = simulateBracketTournament(state, squad);
    setState(next);
    const cupResult = buildChallengeCupResult(next, squad);
    if (cupResult.isWinner) playCupFinalWin();
    else if (cupResult.finish === "Runners-Up") playCupFinalLoss();
    else playMatchDefeat();
    onComplete(cupResult);
  }, [state, squad, onComplete]);

  const canSimRound = useMemo(
    () =>
      !state.tournamentComplete &&
      getMatchesForRound(state, activeRound).some((m) => m.status === "ready"),
    [state, activeRound]
  );

  return (
    <div className="w-full px-2 py-4 pb-28 sm:px-4 md:pb-6">
      <div className="bracket-header-panel mx-auto max-w-3xl rounded-xl border border-pitch-600/45 bg-pitch-900/55 px-4 py-4 backdrop-blur-sm sm:py-5">
        {eraMode ? (
          <EraChallengeCupBranding
            teamDisplayName={eraTeamDisplayName ?? userClub}
            clubName={eraClubName}
            year={eraTeamYear}
            subtitle={
              state.tournamentComplete
                ? "Tournament complete"
                : `${getCupRoundLabel(activeRound)} — simulate matches to advance`
            }
            compact
          />
        ) : (
          <div className="text-center">
            <p className="font-display text-xs font-bold uppercase tracking-[0.35em] text-theme-primary">
              {headerLabel}
            </p>
            <h2 className="mt-2 font-display text-2xl font-black sm:text-3xl">
              Knockout Bracket
            </h2>
            <p className="mt-2 text-sm text-gray-400">
              {state.tournamentComplete
                ? "Tournament complete"
                : `${getCupRoundLabel(activeRound)} — simulate matches to advance`}
            </p>
          </div>
        )}

        {!eraMode && state.byeTeams.length > 0 && (
          <div className="mx-auto mt-3 flex max-w-md flex-wrap items-center justify-center gap-2">
            {state.byeTeams.map((club) => (
              <span
                key={club}
                className="rounded-full border border-theme-primary/30 bg-theme-primary/10 px-3 py-1 text-[10px] font-semibold text-theme-primary"
              >
                {club} — Quarter-Final Bye
              </span>
            ))}
          </div>
        )}

        {eraMode && state.byeTeams.length > 0 && (
          <div className="mx-auto mt-3 flex max-w-md flex-wrap items-center justify-center gap-2">
            {state.byeTeams.map((club) => (
              <span
                key={club}
                className="rounded-full border border-accent-gold/30 bg-accent-gold/10 px-3 py-1 text-[10px] font-semibold text-accent-gold"
              >
                {club} — Quarter-Final Bye
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto mt-4 max-w-3xl">
        <BracketMobileRoundNav
          rounds={ROUNDS}
          viewRound={mobileViewRound}
          activeRound={activeRound}
          onViewRoundChange={setMobileViewRound}
          getLabel={getCupRoundLabel}
          getShortLabel={(round) => CUP_ROUND_SHORT[round] ?? getCupRoundLabel(round)}
          activeClassName={
            eraMode
              ? "border-accent-gold/55 bg-accent-gold/12 text-accent-gold"
              : undefined
          }
        />
      </div>

      <div className="mx-auto mt-5 max-w-3xl space-y-3 md:hidden">
        <p className="text-center font-display text-[10px] font-bold uppercase tracking-wider text-gray-500">
          {getCupRoundLabel(mobileViewRound)}
        </p>
        {getMatchesForRound(state, mobileViewRound).map((match) => (
          <BracketMatchCard
            key={match.id}
            match={match}
            selected={selectedId === match.id}
            onSelect={() => handleMatchPress(match.id)}
            isActiveRound={mobileViewRound === activeRound}
            userClub={userClub}
            byeTeams={state.byeTeams}
            eraClubLookup={lookup}
            eraMode={eraMode}
            mobile
          />
        ))}
      </div>

      <div className="mt-6 hidden overflow-x-auto pb-4 md:block md:overflow-x-visible md:pb-0">
        <div className="mx-auto flex w-full min-w-0 max-w-5xl items-stretch justify-between gap-2 sm:gap-4">
          {ROUNDS.map((round) => (
            <BracketRoundColumn
              key={round}
              round={round}
              matches={getMatchesForRound(state, round)}
              selectedId={selectedId}
              userClub={userClub}
              byeTeams={state.byeTeams}
              eraClubLookup={lookup}
              eraMode={eraMode}
              onSelect={handleMatchPress}
              activeRound={activeRound}
            />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedMatch && selectedMatch.status === "complete" && (
          <div ref={matchDetailsRef} className="max-md:mb-4">
            <BracketMatchDetailsPanel
              match={selectedMatch}
              eraClubLookup={lookup}
              onClose={() => {
                playPanelClose();
                setSelectedId(null);
              }}
            />
          </div>
        )}
      </AnimatePresence>

      <div className="bracket-sticky-actions mx-auto max-w-3xl md:mt-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
          <GameButton
            variant="secondary"
            size="md"
            disabled={!canSimRound}
            onClick={handleSimulateRound}
            className="w-full sm:w-auto disabled:opacity-40"
          >
            Simulate Round
          </GameButton>
          <GameButton
            variant="theme"
            size="md"
            disabled={state.tournamentComplete}
            onClick={handleSimulateTournament}
            className="w-full sm:w-auto disabled:opacity-40"
          >
            Simulate Tournament
          </GameButton>
        </div>
      </div>
    </div>
  );
}

function BracketRoundColumn({
  round,
  matches,
  selectedId,
  onSelect,
  userClub,
  byeTeams,
  eraClubLookup,
  eraMode,
  activeRound,
}: {
  round: number;
  matches: BracketMatch[];
  selectedId: string | null;
  userClub: string;
  byeTeams: [string, string];
  eraClubLookup?: Record<string, string>;
  eraMode: boolean;
  onSelect: (id: string) => void;
  activeRound: number;
}) {
  return (
    <div className="cup-bracket-column relative flex flex-1 flex-col px-1">
      <p
        className={`mb-3 text-center font-display text-[10px] font-bold uppercase tracking-wider sm:text-xs ${
          round === activeRound ? "text-theme-primary" : "text-gray-500"
        }`}
      >
        {getCupRoundLabel(round)}
      </p>
      <div
        className="flex flex-1 flex-col justify-around gap-3"
        style={{ minHeight: `${Math.max(8, 9 - round) * 52}px` }}
      >
        {matches.map((match) => (
          <BracketMatchCard
            key={match.id}
            match={match}
            selected={selectedId === match.id}
            onSelect={() => onSelect(match.id)}
            isActiveRound={round === activeRound}
            userClub={userClub}
            byeTeams={byeTeams}
            eraClubLookup={eraClubLookup}
            eraMode={eraMode}
          />
        ))}
      </div>
    </div>
  );
}

function BracketMatchCard({
  match,
  selected,
  onSelect,
  isActiveRound,
  userClub,
  byeTeams,
  eraClubLookup,
  eraMode,
  mobile = false,
}: {
  match: BracketMatch;
  selected: boolean;
  onSelect: () => void;
  isActiveRound: boolean;
  userClub: string;
  byeTeams: [string, string];
  eraClubLookup?: Record<string, string>;
  eraMode: boolean;
  mobile?: boolean;
}) {
  const userAccent = eraMode ? "text-accent-gold" : "text-mode-current";
  const isComplete = match.status === "complete";
  const isReady = match.status === "ready";
  const isPending = match.status === "pending";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isPending}
      className={`cup-bracket-match w-full rounded-xl border text-left transition ${
        mobile ? "min-h-[88px] shadow-sm" : "rounded-lg"
      } ${
        selected
          ? "border-mode-current/50 bg-mode-current/10 ring-1 ring-mode-current/30"
          : isReady && isActiveRound
            ? "border-mode-current/30 bg-pitch-900/60 hover:border-mode-current/50"
            : "border-pitch-600/40 bg-pitch-900/40 hover:border-pitch-500/50"
      } ${isPending ? "cursor-default opacity-50" : "cursor-pointer"}`}
    >
      <BracketTeamRow
        team={match.homeTeam}
        score={match.homeScore}
        isWinner={isComplete && match.winner === match.homeTeam}
        isLoser={isComplete && match.loser === match.homeTeam}
        isUser={match.homeTeam === userClub}
        eraClubLookup={eraClubLookup}
        eraMode={eraMode}
        mobile={mobile}
        showByeAdvance={
          match.round === 2 &&
          match.status !== "complete" &&
          match.homeTeam !== null &&
          byeTeams.includes(match.homeTeam)
        }
      />
      <div className="border-t border-pitch-600/30" />
      <BracketTeamRow
        team={match.awayTeam}
        score={match.awayScore}
        isWinner={isComplete && match.winner === match.awayTeam}
        isLoser={isComplete && match.loser === match.awayTeam}
        isUser={match.awayTeam === userClub}
        eraClubLookup={eraClubLookup}
        eraMode={eraMode}
        mobile={mobile}
        showByeAdvance={
          match.round === 2 &&
          match.status !== "complete" &&
          match.awayTeam !== null &&
          byeTeams.includes(match.awayTeam)
        }
      />
      {isReady && match.isUserMatch && (
        <p className={`border-t border-pitch-600/20 px-2 py-0.5 text-center text-[8px] font-bold uppercase tracking-wider ${userAccent}`}>
          Your Match
        </p>
      )}
      {isReady && isActiveRound && (
        <p className={`border-t border-pitch-600/20 px-2 py-0.5 text-center text-[8px] font-bold uppercase tracking-wider ${userAccent}`}>
          Tap to simulate
        </p>
      )}
      {isComplete && !selected && (
        <p className="border-t border-pitch-600/20 px-2 py-0.5 text-center text-[8px] font-bold uppercase tracking-wider text-gray-500">
          View details
        </p>
      )}
    </button>
  );
}

function BracketTeamRow({
  team,
  score,
  isWinner,
  isLoser,
  isUser,
  eraClubLookup,
  eraMode,
  showByeAdvance,
  mobile = false,
}: {
  team: string | null;
  score: number | null;
  isWinner: boolean;
  isLoser: boolean;
  isUser: boolean;
  eraClubLookup?: Record<string, string>;
  eraMode: boolean;
  showByeAdvance?: boolean;
  mobile?: boolean;
}) {
  const userAccent = eraMode ? "text-accent-gold" : "text-mode-current";
  const byeAccent = eraMode ? "text-accent-gold/90" : "text-mode-current/90";
  if (!team) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 sm:px-2.5">
        <span className="text-[10px] italic text-gray-600">TBD</span>
      </div>
    );
  }

  const teamTextColor = isUser
    ? undefined
    : isLoser
      ? "#6b7280"
      : getReadableTextColor(
          isWinner ? UI_SURFACES.bracketWinner : UI_SURFACES.bracketRow
        );

  const colorClub = resolveEraTeamClubName(team, eraClubLookup);

  return (
    <div
      className={`${mobile ? "px-3 py-2" : "px-2 py-1.5 sm:px-2.5"} ${
        isWinner ? "bg-success/10" : isLoser ? "opacity-45" : ""
      } ${isUser ? "font-semibold" : ""}`}
    >
      <div className="flex items-center gap-2">
        <ClubDualSwatch club={colorClub} size="xs" />
        <span
          className={`min-w-0 flex-1 break-words font-bold leading-snug ${
            mobile ? "text-xs" : "text-[10px] sm:text-[11px]"
          } ${isUser ? userAccent : ""}`}
          style={teamTextColor ? { color: teamTextColor } : undefined}
        >
          {team}
        </span>
        {score !== null && (
          <span
            className={`shrink-0 font-display text-xs font-bold ${
              isWinner ? "text-success" : "text-gray-400"
            }`}
          >
            {score}
          </span>
        )}
      </div>
      {showByeAdvance && (
        <p className={`mt-0.5 pl-7 text-[8px] font-semibold uppercase tracking-wide ${byeAccent}`}>
          Advanced to Quarter Finals
        </p>
      )}
    </div>
  );
}
