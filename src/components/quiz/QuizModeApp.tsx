"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { GameModal } from "@/components/ui/GameModal";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { PAGE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { formatClubFundsExact } from "@/lib/club-funds";
import { triggerQuizAchievements } from "@/lib/achievements/achievementTriggers";
import { playUiClick } from "@/lib/sound";
import { getQuizQuestionBank } from "@/lib/quiz/bank";
import { QUIZ_CLUBS, getQuizClub, getQuizClubColors } from "@/lib/quiz/clubs";
import { settleCompletedQuizRun } from "@/lib/quiz/complete";
import {
  continueAfterReveal,
  countCorrectAnswers,
  createQuizRun,
  getCorrectDisplayIndex,
  getDisplayedOptions,
  getQuestionById,
  isActiveQuizPhase,
  isTerminalQuizPhase,
  lockAnswer,
  revealAnswer,
  useChangeQuestion,
  useCrowd,
  useFiftyFifty,
  usePhone,
  walkAway,
} from "@/lib/quiz/engine";
import {
  getCurrentPrize,
  getGuaranteedPrize,
  getNextPrize,
  getPrizeForQuestionNumber,
  isSafeQuestionNumber,
  QUIZ_PRIZE_LADDER,
} from "@/lib/quiz/prizes";
import {
  clearQuizRun,
  loadQuizRun,
  loadQuizStats,
  saveQuizRun,
} from "@/lib/quiz/storage";
import type { QuizRun, QuizTeamId } from "@/lib/quiz/types";

type QuizView = "landing" | "team" | "play" | "result";

const LETTERS = ["A", "B", "C", "D"] as const;

function persist(run: QuizRun | null): QuizRun | null {
  if (!run) {
    clearQuizRun();
    return null;
  }
  saveQuizRun(run);
  return run;
}

export function QuizModeApp() {
  const bank = useMemo(() => getQuizQuestionBank(), []);
  const [view, setView] = useState<QuizView>("landing");
  const [run, setRun] = useState<QuizRun | null>(null);
  const [teamId, setTeamId] = useState<QuizTeamId | null>(null);
  const [teamQuery, setTeamQuery] = useState("");
  const [walkOpen, setWalkOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const lockTimer = useRef<number | null>(null);

  useEffect(() => {
    const loaded = loadQuizRun();
    const stored =
      loaded?.phase === "answer_locked"
        ? revealAnswer(loaded, bank)
        : loaded;
    if (stored !== loaded) persist(stored);
    setRun(stored);
    if (stored && isTerminalQuizPhase(stored.phase)) {
      setRun(persist(settleCompletedQuizRun(stored, bank)));
      setView("result");
    } else if (stored && isActiveQuizPhase(stored.phase)) {
      setView("play");
    }
    setReady(true);
    return () => {
      if (lockTimer.current) window.clearTimeout(lockTimer.current);
    };
  }, [bank]);

  const updateRun = useCallback((next: QuizRun) => {
    setRun(persist(next));
  }, []);

  const startMillionaire = () => {
    playUiClick();
    const stats = loadQuizStats();
    const next = createQuizRun({
      bank,
      mode: "millionaire",
      recentIds: stats.recentQuestionIds,
    });
    updateRun(next);
    setView("play");
  };

  const startTeam = () => {
    if (!teamId) return;
    playUiClick();
    const stats = loadQuizStats();
    const next = createQuizRun({
      bank,
      mode: "team",
      teamId,
      recentIds: stats.recentQuestionIds,
    });
    updateRun(next);
    setView("play");
  };

  const handleLock = (displayIndex: number) => {
    if (!run || run.phase !== "question_active") return;
    playUiClick();
    const locked = lockAnswer(run, displayIndex);
    updateRun(locked);
    if (lockTimer.current) window.clearTimeout(lockTimer.current);
    lockTimer.current = window.setTimeout(() => {
      setRun((current) => {
        if (!current) return current;
        const revealed = revealAnswer(current, bank);
        persist(revealed);
        const storedStats = loadQuizStats();
        const runCorrect = countCorrectAnswers(revealed);
        const runAnswered = revealed.questions.filter(
          (question) => question.correct !== null
        ).length;
        triggerQuizAchievements({
          questionsAnswered:
            storedStats.questionsCorrect +
            storedStats.questionsIncorrect +
            runAnswered,
          questionsCorrect: storedStats.questionsCorrect + runCorrect,
          highestPrize: Math.max(
            storedStats.highestPrize,
            getCurrentPrize(runCorrect)
          ),
          perfectRun: false,
          noLifelines: false,
          teamCompleted: false,
          teamMillionaire: false,
        });
        return revealed;
      });
    }, 750);
  };

  const handleContinue = () => {
    if (!run) return;
    playUiClick();
    const advanced = continueAfterReveal(run);
    if (isTerminalQuizPhase(advanced.phase)) {
      const settled = settleCompletedQuizRun(advanced, bank);
      updateRun(settled);
      setView("result");
      return;
    }
    updateRun(advanced);
  };

  const confirmWalkAway = () => {
    if (!run) return;
    playUiClick();
    const finished = settleCompletedQuizRun(walkAway(run), bank);
    updateRun(finished);
    setWalkOpen(false);
    setView("result");
  };

  const playAgain = () => {
    playUiClick();
    if (run?.mode === "team" && run.teamId) {
      const stats = loadQuizStats();
      const next = createQuizRun({
        bank,
        mode: "team",
        teamId: run.teamId,
        recentIds: stats.recentQuestionIds,
      });
      updateRun(next);
      setView("play");
      return;
    }
    startMillionaire();
  };

  const backToQuiz = () => {
    playUiClick();
    persist(null);
    setRun(null);
    setView("landing");
    setTeamId(null);
  };

  return (
    <StandardPageShell>
      <div className={`${PAGE.section} quiz-arena`}>
        {!ready ? (
          <p className={`text-center ${TYPO.meta}`}>Loading Quiz Mode…</p>
        ) : view === "landing" ? (
          <QuizLanding
            hasActiveRun={Boolean(run && isActiveQuizPhase(run.phase))}
            onResume={() => {
              playUiClick();
              setView("play");
            }}
            onMillionaire={startMillionaire}
            onTeam={() => {
              playUiClick();
              setView("team");
            }}
          />
        ) : view === "team" ? (
          <QuizTeamSelect
            teamId={teamId}
            query={teamQuery}
            onQuery={setTeamQuery}
            onSelect={setTeamId}
            onBack={() => setView("landing")}
            onStart={startTeam}
          />
        ) : view === "play" && run ? (
          <QuizPlayScreen
            run={run}
            bank={bank}
            onLock={handleLock}
            onContinue={handleContinue}
            onWalkAway={() => setWalkOpen(true)}
            onFifty={() => updateRun(useFiftyFifty(run, bank))}
            onCrowd={() => updateRun(useCrowd(run, bank))}
            onPhone={() => updateRun(usePhone(run, bank))}
            onChange={() =>
              updateRun(useChangeQuestion(run, bank, loadQuizStats().recentQuestionIds))
            }
            onHub={() => setView("landing")}
          />
        ) : view === "result" && run ? (
          <QuizResultScreen run={run} bank={bank} onAgain={playAgain} onBack={backToQuiz} />
        ) : (
          <QuizLanding
            hasActiveRun={false}
            onResume={() => undefined}
            onMillionaire={startMillionaire}
            onTeam={() => setView("team")}
          />
        )}
      </div>

      <GameModal
        open={walkOpen}
        onClose={() => setWalkOpen(false)}
        labelledBy="quiz-walk-title"
      >
        <div className="space-y-4 text-center">
          <h2 id="quiz-walk-title" className={TYPO.cardTitle}>
            Walk away?
          </h2>
          <p className={TYPO.body}>
            Walk away with{" "}
            {formatClubFundsExact(getCurrentPrize(run ? countCorrectAnswers(run) : 0))}?
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <GameButton
              variant="secondary"
              onClick={() => {
                playUiClick();
                setWalkOpen(false);
              }}
            >
              Keep Playing
            </GameButton>
            <GameButton variant="theme" onClick={confirmWalkAway}>
              Walk Away
            </GameButton>
          </div>
        </div>
      </GameModal>
    </StandardPageShell>
  );
}

function QuizLanding({
  hasActiveRun,
  onResume,
  onMillionaire,
  onTeam,
}: {
  hasActiveRun: boolean;
  onResume: () => void;
  onMillionaire: () => void;
  onTeam: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-xl text-center">
      <p className={TYPO.sectionLabel}>Quiz</p>
      <h1 className={`mt-2 ${TYPO.pageTitle}`}>Quiz Mode</h1>
      <p className={`mx-auto mt-3 max-w-md ${TYPO.pageSubtitle}`}>
        Test your Super League knowledge. How far can you go?
      </p>

      {hasActiveRun && (
        <div className="mx-auto mt-5 max-w-sm">
          <GameButton variant="theme" onClick={onResume}>
            Resume quiz
          </GameButton>
        </div>
      )}

      <div className="mt-8 grid gap-4">
        <button
          type="button"
          onClick={onMillionaire}
          className="w-full rounded-lg border border-white/10 bg-[#0c1210] px-4 py-5 text-left"
        >
          <p className={TYPO.keyLabel}>Super League Millionaire</p>
          <p className={`mt-1 ${TYPO.cardTitle}`}>15 questions. One life.</p>
          <p className={`mt-2 ${TYPO.bodySm}`}>
            General Super League knowledge, climbing a prize ladder to £1,000,000.
          </p>
        </button>
        <button
          type="button"
          onClick={onTeam}
          className="w-full rounded-lg border border-white/10 bg-[#0c1210] px-4 py-5 text-left"
        >
          <p className={TYPO.keyLabel}>Team Challenge</p>
          <p className={`mt-1 ${TYPO.cardTitle}`}>Pick a club. Stay there.</p>
          <p className={`mt-2 ${TYPO.bodySm}`}>
            Every question is about your chosen Super League club.
          </p>
        </button>
      </div>
    </div>
  );
}

function QuizTeamSelect({
  teamId,
  query,
  onQuery,
  onSelect,
  onBack,
  onStart,
}: {
  teamId: QuizTeamId | null;
  query: string;
  onQuery: (value: string) => void;
  onSelect: (id: QuizTeamId) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const filtered = QUIZ_CLUBS.filter((club) =>
    club.name.toLowerCase().includes(query.trim().toLowerCase())
  );
  const selected = teamId ? getQuizClub(teamId) : null;

  return (
    <div className="mx-auto w-full max-w-xl">
      <p className={`text-center ${TYPO.sectionLabel}`}>Team Challenge</p>
      <h1 className={`mt-2 text-center ${TYPO.pageTitle}`}>Choose your club</h1>
      <label className="mt-5 block">
        <span className="sr-only">Search teams</span>
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Search teams..."
          className="game-input w-full"
        />
      </label>
      <ul className="mt-4 max-h-[50dvh] space-y-2 overflow-y-auto overscroll-contain pb-3">
        {filtered.map((club) => {
          const colors = getQuizClubColors(club.id);
          const active = club.id === teamId;
          return (
            <li key={club.id}>
              <button
                type="button"
                onClick={() => {
                  playUiClick();
                  onSelect(club.id);
                }}
                className={`flex min-h-[56px] w-full items-center gap-3 rounded-lg border px-3 py-3 text-left ${
                  active
                    ? "border-theme-primary bg-theme-primary/10"
                    : "border-white/10 bg-[#0c1210]"
                }`}
              >
                <span
                  className="h-8 w-8 shrink-0 rounded-full"
                  style={{ background: colors.primary, boxShadow: `inset 0 0 0 2px ${colors.secondary}` }}
                />
                <span>
                  <span className={`block ${TYPO.cardTitle}`}>{club.name}</span>
                  {active && (
                    <span className={`mt-1 block ${TYPO.bodySm}`}>{club.blurb}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {selected && (
        <p className={`mt-3 ${TYPO.bodySm}`}>{selected.blurb}</p>
      )}
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <GameButton variant="secondary" onClick={onBack}>
          Back
        </GameButton>
        <GameButton variant="theme" disabled={!teamId} onClick={onStart}>
          Start Challenge
        </GameButton>
      </div>
    </div>
  );
}

function QuizPlayScreen({
  run,
  bank,
  onLock,
  onContinue,
  onWalkAway,
  onFifty,
  onCrowd,
  onPhone,
  onChange,
  onHub,
}: {
  run: QuizRun;
  bank: ReturnType<typeof getQuizQuestionBank>;
  onLock: (index: number) => void;
  onContinue: () => void;
  onWalkAway: () => void;
  onFifty: () => void;
  onCrowd: () => void;
  onPhone: () => void;
  onChange: () => void;
  onHub: () => void;
}) {
  const slot = run.questions[run.questionIndex];
  const question = slot ? getQuestionById(bank, slot.questionId) : undefined;
  const correctCount = countCorrectAnswers(run);
  const currentPrize = getCurrentPrize(correctCount);
  const nextPrize = getNextPrize(correctCount);
  const guaranteed = getGuaranteedPrize(correctCount);
  const questionNumber = run.questionIndex + 1;
  const locked = run.phase !== "question_active";
  const revealed = run.phase === "answer_revealed";
  const club = run.teamId ? getQuizClub(run.teamId) : null;
  const options = question && slot ? getDisplayedOptions(question, slot) : [];
  const correctDisplay = question && slot ? getCorrectDisplayIndex(question, slot) : -1;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <ol className="space-y-1">
          {[...QUIZ_PRIZE_LADDER].map((amount, index) => {
            const number = index + 1;
            const current = number === questionNumber;
            const safe = isSafeQuestionNumber(number);
            return (
              <li
                key={amount}
                className={`flex items-center justify-between rounded px-2 py-1 text-sm ${
                  current ? "quiz-ladder-item--current" : ""
                } ${safe ? "quiz-ladder-item--safe" : "text-gray-400"}`}
              >
                <span>{number}</span>
                <span className="tabular-nums">{formatClubFundsExact(amount)}</span>
              </li>
            );
          }).reverse()}
        </ol>
      </aside>

      <section className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`quiz-prize text-3xl sm:text-4xl`}>
              {formatClubFundsExact(getPrizeForQuestionNumber(questionNumber))}
            </p>
            <p className={`mt-1 ${TYPO.keyLabel}`}>
              Question {questionNumber} / 15
            </p>
            {club && <p className={`mt-1 ${TYPO.clubName}`}>{club.name}</p>}
          </div>
          <button
            type="button"
            onClick={onHub}
            className="text-sm text-pitch-400 underline-offset-2 hover:underline"
          >
            Quiz home
          </button>
        </div>

        <div className={`mt-3 flex flex-wrap gap-x-4 gap-y-1 ${TYPO.meta}`}>
          <span>Current: {formatClubFundsExact(currentPrize)}</span>
          <span>Guaranteed: {formatClubFundsExact(guaranteed)}</span>
          <span>Next: {nextPrize ? formatClubFundsExact(nextPrize) : "—"}</span>
        </div>

        <p className={`mt-5 text-lg leading-snug text-white sm:text-xl`}>
          {question?.question ?? "Question unavailable."}
        </p>

        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {options.map((option, index) => {
            const hidden = slot?.hiddenOptionIndexes.includes(index);
            const selected = slot?.selectedDisplayIndex === index;
            const showCorrect = revealed && index === correctDisplay;
            const showWrong = revealed && selected && index !== correctDisplay;
            return (
              <button
                key={`${option}-${index}`}
                type="button"
                disabled={locked || hidden}
                onClick={() => onLock(index)}
                className={`quiz-answer ${hidden ? "quiz-answer--hidden" : ""} ${
                  selected ? "quiz-answer--selected" : ""
                } ${showCorrect ? "quiz-answer--correct" : ""} ${
                  showWrong ? "quiz-answer--wrong" : ""
                }`}
              >
                <span className="mr-2 font-semibold text-theme-primary">
                  {LETTERS[index]}
                </span>
                {option}
                {slot?.crowd && !hidden && (
                  <span className="ml-2 text-xs text-pitch-400">
                    {slot.crowd.percents[index]}%
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {slot?.phone && (
          <p className={`mt-3 ${TYPO.bodySm}`}>
            Phone a fan ({slot.phone.confidence}): {slot.phone.quote} They would pick{" "}
            {LETTERS[slot.phone.suggestionIndex]}.
          </p>
        )}

        {revealed && (
          <div className="mt-5">
            <GameButton variant="theme" onClick={onContinue}>
              {slot?.correct ? "Continue" : "See result"}
            </GameButton>
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <GameButton
            variant="secondary"
            className="quiz-lifeline"
            disabled={run.lifelines.fiftyFifty || locked}
            onClick={onFifty}
          >
            50/50
          </GameButton>
          <GameButton
            variant="secondary"
            className="quiz-lifeline"
            disabled={run.lifelines.crowd || locked}
            onClick={onCrowd}
          >
            Crowd
          </GameButton>
          <GameButton
            variant="secondary"
            className="quiz-lifeline"
            disabled={run.lifelines.phone || locked}
            onClick={onPhone}
          >
            Phone
          </GameButton>
          <GameButton
            variant="secondary"
            className="quiz-lifeline"
            disabled={run.lifelines.change || locked}
            onClick={onChange}
          >
            Change
          </GameButton>
        </div>

        {run.phase === "question_active" && (
          <div className="mt-3">
            <GameButton variant="secondary" onClick={onWalkAway}>
              Walk Away
            </GameButton>
          </div>
        )}
      </section>
    </div>
  );
}

function QuizResultScreen({
  run,
  bank,
  onAgain,
  onBack,
}: {
  run: QuizRun;
  bank: ReturnType<typeof getQuizQuestionBank>;
  onAgain: () => void;
  onBack: () => void;
}) {
  const correct = countCorrectAnswers(run);
  const answered = run.questions.filter((question) => question.correct !== null).length;
  const lastSlot = [...run.questions].reverse().find((question) => question.correct !== null);
  const lastQuestion = lastSlot ? getQuestionById(bank, lastSlot.questionId) : undefined;
  const stats = loadQuizStats();
  const club = run.teamId ? getQuizClub(run.teamId) : null;
  const title =
    run.phase === "quiz_complete"
      ? "Millionaire"
      : run.phase === "quiz_walked_away"
        ? "You banked it"
        : "Quiz over";

  const categoryLines = Object.entries(
    run.questions.reduce<
      Record<string, { correct: number; answered: number }>
    >((categories, slot) => {
      if (slot.correct === null) return categories;
      const question = getQuestionById(bank, slot.questionId);
      if (!question) return categories;
      const current = categories[question.category] ?? {
        correct: 0,
        answered: 0,
      };
      categories[question.category] = {
        correct: current.correct + Number(slot.correct),
        answered: current.answered + 1,
      };
      return categories;
    }, {})
  );

  return (
    <div className="mx-auto w-full max-w-xl text-center">
      <p className={TYPO.sectionLabel}>{club ? club.name : "Super League Millionaire"}</p>
      <h1 className={`mt-2 ${TYPO.pageTitle}`}>{title}</h1>
      <p className={`mt-3 ${TYPO.pageSubtitle}`}>
        You reached Question {run.questionIndex + 1}
      </p>
      <p className="quiz-prize mt-4 text-4xl">{formatClubFundsExact(run.rewardAmount)}</p>
      {run.phase === "quiz_walked_away" && (
        <p className={`mt-2 ${TYPO.body}`}>You banked {formatClubFundsExact(run.rewardAmount)}.</p>
      )}
      {lastQuestion && lastSlot?.correct === false && (
        <p className={`mt-4 ${TYPO.body}`}>
          Correct answer: {lastQuestion.correctAnswer}
        </p>
      )}
      <ul className={`mx-auto mt-5 max-w-sm space-y-1 text-left ${TYPO.bodySm}`}>
        <li>Questions answered: {answered}</li>
        <li>Correct: {correct}</li>
        <li>Highest prize this run: {formatClubFundsExact(getCurrentPrize(correct))}</li>
        <li>
          Lifelines used:{" "}
          {[
            run.lifelines.fiftyFifty && "50/50",
            run.lifelines.crowd && "Crowd",
            run.lifelines.phone && "Phone",
            run.lifelines.change && "Change",
          ]
            .filter(Boolean)
            .join(", ") || "None"}
        </li>
        <li>Best-ever prize: {formatClubFundsExact(stats.highestPrize)}</li>
      </ul>
      {categoryLines.length > 0 && (
        <div className={`mx-auto mt-4 max-w-sm text-left ${TYPO.meta}`}>
          {categoryLines.map(([category, value]) => (
            <p key={category}>
              {category}: {value.correct}/{value.answered}
            </p>
          ))}
        </div>
      )}
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <GameButton variant="theme" onClick={onAgain}>
          Play Again
        </GameButton>
        <GameButton variant="secondary" onClick={onBack}>
          Back to Quiz
        </GameButton>
      </div>
    </div>
  );
}
