"use client";

import { useEffect, useRef, useState } from "react";
import { Confetti } from "@/components/Confetti";
import { GameButton } from "@/components/ui/GameButton";
import { triggerMiniGameAchievements } from "@/lib/achievements/achievementTriggers";
import { getClubColors } from "@/lib/clubs";
import { getLocalDateKey } from "@/lib/mini-games/date";
import type { GridCatalogue, GridCriterionDef } from "@/lib/mini-games/grid/criteria";
import {
  buildGridShareText,
  createGridRun,
  finishGridRun,
  formatGridDate,
  getGridCatalogue,
  gridCellAnswers,
  gridCellHeaders,
  gridRewardAmount,
  gridRewardRunId,
  gridScore,
  isGridRunValid,
  recordGridResult,
  remainingGridGuesses,
  submitGridGuess,
  GRID_CELL_COUNT,
  GRID_MAX_GUESSES,
  GRID_SIZE,
} from "@/lib/mini-games/grid/engine";
import {
  loadGridRun,
  loadGridStats,
  saveGridRun,
  saveGridStats,
} from "@/lib/mini-games/grid/storage";
import type { GridRun, GridStats } from "@/lib/mini-games/grid/types";
import { claimMiniGameReward, GRID_REWARD_PER_CELL } from "@/lib/mini-games/rewards";
import {
  playMiniCorrect,
  playMiniIncorrect,
  playMiniReveal,
  playMiniSelect,
  playMiniWin,
} from "@/lib/mini-games/sound";
import { syncMiniGameWins } from "@/lib/storage/mini-games-leaderboard";
import { TYPO } from "@/lib/ui/typography";
import { MiniGameEndActions, MiniGameShell, MiniGameStatLine } from "./MiniGameShell";
import { MiniGameRewardPopup } from "./MiniGameRewardPopup";
import { DailyMissionToast } from "@/components/DailyMissionToast";
import { reportMissionEvent } from "@/lib/daily-missions";
import { PlayerAutocomplete } from "./PlayerAutocomplete";

type GridRunView = GridRun & { payoutAwarded?: boolean; payoutAmount?: number };

const MUTED = "text-[color:var(--fl-muted)]";

/** Stats, achievements and (daily only, once per UK day) the Club Funds reward. */
function settleGrid(run: GridRun): GridRunView {
  if (run.status !== "finished" || run.rewardClaimed) return run;
  const perfect = gridScore(run) === GRID_CELL_COUNT;
  triggerMiniGameAchievements({ played: true, gridPerfect: perfect });
  reportMissionEvent({ kind: "grid", daily: run.mode === "daily", score: gridScore(run) });
  if (run.mode !== "daily") return { ...run, rewardClaimed: true };
  const stats = recordGridResult(loadGridStats(), run);
  saveGridStats(stats);
  syncMiniGameWins("grid", stats.perfect);
  const amount = gridRewardAmount(run);
  if (amount <= 0) return { ...run, rewardClaimed: true };
  const payout = claimMiniGameReward(
    gridRewardRunId(run.dateKey),
    "Rugby League Grid",
    amount
  );
  return {
    ...run,
    rewardClaimed: true,
    payoutAwarded: payout.awarded,
    payoutAmount: amount,
  };
}

function loadOrCreateDaily(catalogue: GridCatalogue): GridRun {
  const today = getLocalDateKey();
  const saved = loadGridRun();
  if (
    saved &&
    saved.mode === "daily" &&
    saved.dateKey === today &&
    isGridRunValid(saved, catalogue)
  ) {
    return saved;
  }
  const fresh = createGridRun({ mode: "daily", dateKey: today }, catalogue);
  saveGridRun(fresh);
  return fresh;
}

function ClubChip({ clubName }: { clubName: string }) {
  const colors = getClubColors(clubName);
  return (
    <span
      aria-hidden
      className="inline-block h-3 w-3 shrink-0 rounded-full"
      style={{
        background: `linear-gradient(135deg, ${colors.primary} 0 50%, ${colors.secondary} 50% 100%)`,
        boxShadow: "0 0 0 1px rgba(255,255,255,0.18)",
      }}
    />
  );
}

function GridHeader({ def }: { def: GridCriterionDef }) {
  return (
    <div
      className="flex min-h-[44px] min-w-0 flex-col items-center justify-center gap-1 px-0.5 text-center"
      title={def.name}
    >
      <span className="sr-only">{def.name}</span>
      {def.kind === "club" && def.clubName ? (
        <>
          <ClubChip clubName={def.clubName} />
          <span aria-hidden className="text-[13px] font-bold leading-none tracking-wide text-white">
            {def.label}
          </span>
        </>
      ) : (
        <>
          <span
            aria-hidden
            className="text-[11px] font-semibold leading-tight text-white [overflow-wrap:anywhere]"
          >
            {def.label}
          </span>
          {def.tag ? (
            <span aria-hidden className={`text-[10px] font-medium uppercase leading-none tracking-wide ${MUTED}`}>
              {def.tag}
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the textarea fallback.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function GridGame() {
  const [catalogue, setCatalogue] = useState<GridCatalogue | null>(null);
  const [run, setRun] = useState<GridRunView | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [shakeCell, setShakeCell] = useState<number | null>(null);
  const [stats, setStats] = useState<GridStats | null>(null);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const shakeTimer = useRef<number | null>(null);

  useEffect(() => {
    try {
      const nextCatalogue = getGridCatalogue();
      const daily = settleGrid(loadOrCreateDaily(nextCatalogue));
      if (daily.status === "finished") saveGridRun(daily);
      setCatalogue(nextCatalogue);
      setRun(daily);
      setStats(loadGridStats());
    } catch {
      setLoadError(true);
    }
    return () => {
      if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
    };
  }, []);

  if (loadError) {
    return (
      <MiniGameShell title="Rugby League Grid">
        <p className={`mt-6 text-center ${TYPO.meta}`}>Couldn&apos;t build today&apos;s grid. Try again later.</p>
      </MiniGameShell>
    );
  }

  if (!catalogue || !run) {
    return (
      <MiniGameShell title="Rugby League Grid">
        <p className={`mt-6 text-center ${TYPO.meta}`}>Loading…</p>
      </MiniGameShell>
    );
  }

  const playing = run.status === "playing";
  const score = gridScore(run);
  const usedIds = new Set(run.cells.map((cell) => cell?.playerId).filter(Boolean));
  const selectedHeaders =
    selected !== null ? gridCellHeaders(run, selected, catalogue) : null;
  const rowDefs = run.rows.map((id) => catalogue.byId.get(id));
  const colDefs = run.cols.map((id) => catalogue.byId.get(id));

  const commit = (next: GridRunView) => {
    const settled = next.status === "finished" ? settleGrid(next) : next;
    saveGridRun(settled);
    setRun(settled);
    if (settled.status === "finished") {
      setSelected(null);
      setStats(loadGridStats());
      const finalScore = gridScore(settled);
      if (finalScore === GRID_CELL_COUNT) {
        playMiniWin();
        setCelebrate(true);
      } else {
        playMiniReveal();
      }
      if (settled.payoutAwarded) setRewardOpen(true);
    }
  };

  const selectCell = (index: number) => {
    if (!playing || run.cells[index]) return;
    playMiniSelect();
    setConfirmFinish(false);
    setSelected(index);
    setQuery("");
    setMessage(null);
  };

  const submit = (text: string) => {
    if (selected === null) return;
    const result = submitGridGuess(run, selected, text, catalogue);
    if (result.error) {
      setMessage({ tone: "error", text: result.error });
      playMiniIncorrect();
      return;
    }
    setQuery("");
    // "Puzzle Starter" fires on the first answer, not on opening a grid.
    triggerMiniGameAchievements({ played: true });
    if (result.correct) {
      playMiniCorrect();
      setMessage({ tone: "ok", text: `${result.player?.displayName ?? "That player"} fits.` });
      setSelected(null);
    } else {
      playMiniIncorrect();
      setMessage({
        tone: "error",
        text: `${result.player?.displayName ?? "That player"} doesn't fit that square.`,
      });
      const cell = selected;
      setShakeCell(cell);
      if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
      shakeTimer.current = window.setTimeout(() => setShakeCell(null), 400);
    }
    commit(result.run);
  };

  const endEarly = () => {
    playMiniSelect();
    if (!confirmFinish) {
      setConfirmFinish(true);
      return;
    }
    setConfirmFinish(false);
    setMessage(null);
    commit(finishGridRun(run));
  };

  const startPractice = () => {
    playMiniSelect();
    const next = createGridRun({ mode: "practice", dateKey: getLocalDateKey() }, catalogue);
    setRun(next);
    setSelected(null);
    setQuery("");
    setMessage(null);
    setCelebrate(false);
    setRewardOpen(false);
    setCopied(false);
  };

  const backToDaily = () => {
    playMiniSelect();
    setRun(loadOrCreateDaily(catalogue));
    setSelected(null);
    setQuery("");
    setMessage(null);
    setCelebrate(false);
    setCopied(false);
  };

  const share = async () => {
    const ok = await copyText(buildGridShareText(run));
    setCopied(ok);
    if (ok) playMiniSelect();
  };

  const missedCells = playing
    ? []
    : Array.from({ length: GRID_CELL_COUNT }, (_, i) => i).filter((i) => !run.cells[i]);

  return (
    <MiniGameShell
      title="Rugby League Grid"
      eyebrow={run.mode === "daily" ? `Puzzles · ${formatGridDate(run.dateKey)}` : "Practice grid"}
    >
      {celebrate && <Confetti />}
      <DailyMissionToast />
      <MiniGameRewardPopup
        open={rewardOpen}
        amount={run.payoutAmount ?? 0}
        detail={`${score}/${GRID_CELL_COUNT} squares. One reward per day. Resets at midnight UK time.`}
        onClose={() => setRewardOpen(false)}
      />

      <div className="mx-auto flex w-full max-w-md flex-col items-center">
        <p className={`mt-1 text-sm leading-snug ${MUTED}`}>
          Name a player who fits each row and column.
        </p>

        <MiniGameStatLine
          items={[
            { label: "Guesses", value: remainingGridGuesses(run) },
            { label: "Score", value: `${score}/${GRID_CELL_COUNT}` },
            { label: "Streak", value: stats?.currentStreak ?? 0 },
          ]}
        />

        <div
          className="mt-4 grid w-full gap-1 sm:gap-1.5"
          style={{ gridTemplateColumns: "minmax(0, 0.95fr) repeat(3, minmax(0, 1fr))" }}
        >
          <div className="flex items-center justify-center" aria-hidden>
            <span className={`text-[10px] font-semibold uppercase tracking-wide ${MUTED}`}>
              {run.mode === "daily" ? "Daily" : "Practice"}
            </span>
          </div>
          {colDefs.map((def, c) =>
            def ? <GridHeader key={`col-${def.id}`} def={def} /> : <div key={`col-${c}`} />
          )}

          {rowDefs.map((rowDef, r) => (
            <RowCells
              key={`row-${run.rows[r] ?? r}`}
              rowIndex={r}
              rowDef={rowDef}
              colDefs={colDefs}
              run={run}
              selected={selected}
              shakeCell={shakeCell}
              onSelect={selectCell}
            />
          ))}
        </div>

        {playing ? (
          <div className="mt-4 w-full rounded-card bg-pitch-900 p-3 text-center">
            {selectedHeaders ? (
              <>
                <p className="text-sm font-semibold leading-snug text-white">
                  {selectedHeaders[0].name}
                  <span className={`px-1.5 ${MUTED}`} aria-hidden>
                    +
                  </span>
                  <span className="sr-only"> and </span>
                  {selectedHeaders[1].name}
                </p>
                <form
                  className="mt-3 flex w-full flex-col items-stretch gap-2 sm:flex-row sm:items-center"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submit(query);
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <PlayerAutocomplete
                      key={selected ?? "none"}
                      value={query}
                      autoFocus
                      onChange={(value) => {
                        setQuery(value);
                        setMessage(null);
                      }}
                      onPick={(player) => submit(player.displayName)}
                      pool={catalogue.players}
                    />
                  </div>
                  <GameButton type="submit" size="sm" fullWidth={false} className="mx-auto shrink-0 sm:mx-0">
                    Guess
                  </GameButton>
                </form>
              </>
            ) : (
              <p className={`text-sm ${MUTED}`}>Tap a square to name a player.</p>
            )}
            {message ? (
              <p
                className={`mt-2 text-sm ${message.tone === "error" ? "text-red-400" : "text-emerald-300"}`}
                role={message.tone === "error" ? "alert" : "status"}
              >
                {message.text}
              </p>
            ) : null}
            <p className={`mt-2 text-xs leading-snug ${MUTED}`}>
              {GRID_MAX_GUESSES} guesses. A wrong guess uses one up. Each player once.
            </p>
            {run.guessesUsed > 0 ? (
              <div className="mt-2 flex justify-center">
                <GameButton
                  variant="ghost"
                  size="sm"
                  fullWidth={false}
                  className="!min-h-[44px] !px-3 text-xs font-medium"
                  onClick={endEarly}
                >
                  {confirmFinish ? "Tap again to finish" : "Finish now"}
                </GameButton>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 w-full rounded-card bg-pitch-900 p-4 text-center">
            <p className={`text-xs font-semibold uppercase tracking-wide ${MUTED}`}>
              {run.mode === "daily" ? "Today's grid" : "Practice grid"}
            </p>
            <p className="fl-number mt-2 text-5xl text-white">
              {score}/{GRID_CELL_COUNT}
            </p>
            <p className={`mt-2 text-sm ${MUTED}`}>
              {score === GRID_CELL_COUNT
                ? "Perfect grid."
                : score >= 6
                  ? "Strong effort."
                  : score >= 3
                    ? "Not bad."
                    : "Tough one."}
              {run.mode === "daily"
                ? score > 0
                  ? ` ${score} × £${GRID_REWARD_PER_CELL.toLocaleString("en-GB")} Club Funds.`
                  : ""
                : " Practice grids don't pay."}
            </p>

            {missedCells.length > 0 ? (
              <div className="mt-4 text-left">
                <p className={`text-xs font-semibold uppercase tracking-wide ${MUTED}`}>You could have had</p>
                <ul className="mt-2 space-y-2">
                  {missedCells.map((cell) => {
                    const headers = gridCellHeaders(run, cell, catalogue);
                    const options = gridCellAnswers(run, cell, catalogue)
                      .filter((player) => !usedIds.has(player.id))
                      .slice(0, 2)
                      .map((player) => player.displayName);
                    if (!headers) return null;
                    return (
                      <li key={cell} className="rounded-control bg-pitch-800 px-3 py-2">
                        <p className={`text-xs leading-snug ${MUTED}`}>
                          {headers[0].name} + {headers[1].name}
                        </p>
                        <p className="text-sm font-semibold text-white">{options.join(", ") || "—"}</p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <pre className="mx-auto mt-4 w-fit max-w-full whitespace-pre-wrap rounded-control [overflow-wrap:anywhere] bg-pitch-950 px-4 py-3 text-left font-sans text-sm leading-relaxed text-white">
              {buildGridShareText(run)}
            </pre>
            <div className="mx-auto mt-3 grid w-full max-w-xs gap-2">
              <GameButton variant="secondary" onClick={() => void share()}>
                {copied ? "Copied" : "Copy result"}
              </GameButton>
            </div>
            {run.mode === "daily" && stats ? (
              <p className={`mt-3 text-xs ${MUTED}`}>
                Played {stats.played} · Perfect {stats.perfect} · Best streak {stats.bestStreak}
              </p>
            ) : null}
            <MiniGameEndActions
              onPlayAgain={startPractice}
              playAgainLabel={run.mode === "daily" ? "Practice grid" : "New practice grid"}
              hubLabel="More puzzles"
            />
          </div>
        )}

        {run.mode === "practice" ? (
          <div className="mt-3 flex justify-center">
            <GameButton variant="ghost" size="sm" fullWidth={false} className="!min-h-[44px]" onClick={backToDaily}>
              Back to today&apos;s grid
            </GameButton>
          </div>
        ) : null}

        <p className={`mt-4 text-xs leading-snug ${MUTED}`}>
          Answers come from the 27-0 player database. Daily grid pays £
          {GRID_REWARD_PER_CELL.toLocaleString("en-GB")} per square, once a day.
        </p>
      </div>
    </MiniGameShell>
  );
}

function RowCells({
  rowIndex,
  rowDef,
  colDefs,
  run,
  selected,
  shakeCell,
  onSelect,
}: {
  rowIndex: number;
  rowDef: GridCriterionDef | undefined;
  colDefs: (GridCriterionDef | undefined)[];
  run: GridRunView;
  selected: number | null;
  shakeCell: number | null;
  onSelect: (index: number) => void;
}) {
  const playing = run.status === "playing";
  return (
    <>
      {rowDef ? <GridHeader def={rowDef} /> : <div />}
      {Array.from({ length: GRID_SIZE }, (_, c) => {
        const index = rowIndex * GRID_SIZE + c;
        const entry = run.cells[index] ?? null;
        const colDef = colDefs[c];
        const isSelected = selected === index;
        const label = `${rowDef?.name ?? "Row"} and ${colDef?.name ?? "column"}: ${
          entry ? entry.name : playing ? "empty" : "missed"
        }`;
        const tone = entry
          ? "bg-emerald-500/15 text-emerald-50"
          : isSelected
            ? "bg-pitch-800 ring-2 ring-theme-primary"
            : playing
              ? "bg-pitch-800 hover:bg-pitch-700"
              : "bg-pitch-900";
        return (
          <button
            key={index}
            type="button"
            aria-label={label}
            aria-pressed={isSelected}
            disabled={!playing || Boolean(entry)}
            onClick={() => onSelect(index)}
            className={`flex aspect-square min-h-[44px] min-w-0 items-center justify-center rounded-tile p-1 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-primary/70 disabled:cursor-default ${tone} ${
              shakeCell === index ? "mini-game-shake ring-2 ring-red-400/60" : ""
            }`}
          >
            {entry ? (
              <span className="text-[11px] font-semibold leading-tight [overflow-wrap:anywhere]">
                {entry.name}
              </span>
            ) : playing ? (
              <span aria-hidden className={`text-lg leading-none ${isSelected ? "text-theme-primary" : "text-pitch-600"}`}>
                +
              </span>
            ) : (
              <span aria-hidden className={`text-lg leading-none ${MUTED}`}>
                —
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}
