"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
} from "@/lib/sound";
import { getReadableTextColor } from "@/lib/ui/contrast";
import { UI_SURFACES } from "@/lib/ui/surfaces";
import { resolveEraTeamClubName } from "@/lib/players/era-teams";
import { ClubDualSwatch } from "./ClubDualSwatch";
import { BracketMatchDetailsPanel } from "./BracketMatchDetailsPanel";
import { EraChallengeCupBranding } from "./EraChallengeCupBranding";

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
  const lookup = eraClubLookup ?? state.eraClubLookup;
  const activeRound = getActiveRound(state);

  const selectedMatch = selectedId
    ? state.matches.find((m) => m.id === selectedId)
    : null;

  const handleSimulateMatch = useCallback(
    (matchId: string) => {
      if (!canSimulateMatch(state, matchId)) return;
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

  const handleSimulateRound = useCallback(() => {
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

  const canSimSelected =
    selectedId !== null && canSimulateMatch(state, selectedId);

  return (
    <div className="w-full px-2 py-4 sm:px-4">
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
          className="mb-4"
        />
      ) : (
        <div className="text-center">
          <p className="font-display text-xs font-bold uppercase tracking-[0.35em] text-accent-green">
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

      {!eraMode && (
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

      {eraMode && state.byeTeams.length > 0 && (
        <div className="mx-auto mt-2 flex max-w-md flex-wrap items-center justify-center gap-2">
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

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          disabled={!canSimSelected}
          onClick={() => selectedId && handleSimulateMatch(selectedId)}
          className="rounded-lg border border-accent-green/50 bg-accent-green/10 px-4 py-2 font-display text-[10px] font-bold uppercase tracking-wider text-accent-green transition hover:bg-accent-green/20 disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs"
        >
          Simulate Selected Match
        </button>
        <button
          type="button"
          disabled={!canSimRound}
          onClick={handleSimulateRound}
          className="rounded-lg border border-pitch-600 px-4 py-2 font-display text-[10px] font-bold uppercase tracking-wider text-gray-300 transition hover:border-accent-green/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs"
        >
          Simulate Round
        </button>
        <button
          type="button"
          disabled={state.tournamentComplete}
          onClick={handleSimulateTournament}
          className="rounded-lg border border-accent-gold/40 bg-accent-gold/10 px-4 py-2 font-display text-[10px] font-bold uppercase tracking-wider text-accent-gold transition hover:bg-accent-gold/20 disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs"
        >
          Simulate Tournament
        </button>
      </div>

      <div className="mt-6 overflow-x-auto pb-4">
        <div className="mx-auto flex min-w-[720px] max-w-5xl items-stretch justify-between gap-2 sm:gap-4">
          {ROUNDS.map((round) => (
            <BracketRoundColumn
              key={round}
              round={round}
              matches={getMatchesForRound(state, round)}
              selectedId={selectedId}
              userClub={userClub}
              byeTeams={state.byeTeams}
              eraClubLookup={lookup}
              onSelect={(id) =>
                setSelectedId((prev) => (prev === id ? null : id))
              }
              activeRound={activeRound}
            />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selectedMatch && selectedMatch.status === "complete" && (
          <BracketMatchDetailsPanel
            match={selectedMatch}
            eraClubLookup={lookup}
            onClose={() => setSelectedId(null)}
          />
        )}
      </AnimatePresence>
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
  activeRound,
}: {
  round: number;
  matches: BracketMatch[];
  selectedId: string | null;
  userClub: string;
  byeTeams: [string, string];
  eraClubLookup?: Record<string, string>;
  onSelect: (id: string) => void;
  activeRound: number;
}) {
  return (
    <div className="cup-bracket-column relative flex flex-1 flex-col px-1">
      <p
        className={`mb-3 text-center font-display text-[10px] font-bold uppercase tracking-wider sm:text-xs ${
          round === activeRound ? "text-accent-green" : "text-gray-500"
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
}: {
  match: BracketMatch;
  selected: boolean;
  onSelect: () => void;
  isActiveRound: boolean;
  userClub: string;
  byeTeams: [string, string];
  eraClubLookup?: Record<string, string>;
}) {
  const isComplete = match.status === "complete";
  const isReady = match.status === "ready";
  const isPending = match.status === "pending";

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={isPending}
      className={`cup-bracket-match w-full rounded-lg border text-left transition ${
        selected
          ? "border-accent-green/50 bg-accent-green/10 ring-1 ring-accent-green/30"
          : isReady && isActiveRound
            ? "border-accent-green/30 bg-pitch-900/60 hover:border-accent-green/50"
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
        showByeAdvance={
          match.round === 2 &&
          match.status !== "complete" &&
          match.awayTeam !== null &&
          byeTeams.includes(match.awayTeam)
        }
      />
      {isReady && match.isUserMatch && (
        <p className="border-t border-pitch-600/20 px-2 py-0.5 text-center text-[8px] font-bold uppercase tracking-wider text-accent-gold">
          Your Match
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
  showByeAdvance,
}: {
  team: string | null;
  score: number | null;
  isWinner: boolean;
  isLoser: boolean;
  isUser: boolean;
  eraClubLookup?: Record<string, string>;
  showByeAdvance?: boolean;
}) {
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
      className={`px-2 py-1.5 sm:px-2.5 ${
        isWinner ? "bg-accent-green/10" : isLoser ? "opacity-45" : ""
      } ${isUser ? "font-semibold" : ""}`}
    >
      <div className="flex items-center gap-2">
        <ClubDualSwatch club={colorClub} size="xs" />
        <span
          className={`min-w-0 flex-1 break-words text-[10px] font-bold leading-snug sm:text-[11px] ${
            isUser ? "text-accent-gold" : ""
          }`}
          style={teamTextColor ? { color: teamTextColor } : undefined}
        >
          {team}
        </span>
        {score !== null && (
          <span
            className={`shrink-0 font-display text-xs font-bold ${
              isWinner ? "text-accent-green" : "text-gray-400"
            }`}
          >
            {score}
          </span>
        )}
      </div>
      {showByeAdvance && (
        <p className="mt-0.5 pl-7 text-[8px] font-semibold uppercase tracking-wide text-accent-gold/90">
          Advanced to Quarter Finals
        </p>
      )}
    </div>
  );
}
