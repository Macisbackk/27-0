"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "@/app/quiz/quiz.css";
import { Confetti } from "@/components/Confetti";
import { GameButton } from "@/components/ui/GameButton";
import { GameModal } from "@/components/ui/GameModal";
import { StandardPageShell } from "@/components/ui/StandardPageShell";
import { MiniGameEndActions } from "@/components/mini-games/MiniGameShell";
import { PAGE } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { formatClubFundsExact } from "@/lib/club-funds";
import { triggerQuizAchievements } from "@/lib/achievements/achievementTriggers";
import { playUiClick } from "@/lib/sound";
import { getQuizQuestionBank } from "@/lib/quiz/bank";
import { QUIZ_CLUBS, getQuizClub, getQuizClubColors } from "@/lib/quiz/clubs";
import { isEligibleMiniGameQuizTeamId } from "@/lib/mini-games/eligibility";
import {
  playMiniCorrect,
  playMiniIncorrect,
  playMiniMilestone,
  playMiniSelect,
  playMiniWin,
} from "@/lib/mini-games/sound";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<QuizView>(
    searchParams.get("mode") === "team" ? "team" : "landing"
  );
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
    } else if (searchParams.get("mode") === "team") {
      setView("team");
    }
    setReady(true);
    return () => {
      if (lockTimer.current) window.clearTimeout(lockTimer.current);
    };
  }, [bank, searchParams]);

  const updateRun = useCallback((next: QuizRun) => {
    setRun(persist(next));
  }, []);

  const startMillionaire = () => {
    playUiClick();
    if (run && isActiveQuizPhase(run.phase)) {
      const ok = window.confirm("Start a new quiz and abandon the current run?");
      if (!ok) return;
    }
    const stats = loadQuizStats();
    const next = createQuizRun({
      bank,
      mode: "millionaire",
      recentIds: stats.recentQuestionIds,
      recentTopicIds: stats.recentTopicIds,
    });
    router.replace("/mini-games/quiz");
    updateRun(next);
    setView("play");
  };

  const startTeam = () => {
    if (!teamId) return;
    playUiClick();
    if (run && isActiveQuizPhase(run.phase)) {
      const ok = window.confirm("Start a new quiz and abandon the current run?");
      if (!ok) return;
    }
    const stats = loadQuizStats();
    const next = createQuizRun({
      bank,
      mode: "team",
      teamId,
      recentIds: stats.recentQuestionIds,
      recentTopicIds: stats.recentTopicIds,
    });
    router.replace("/mini-games/quiz?mode=team");
    updateRun(next);
    setView("play");
  };

  const handleLock = (displayIndex: number) => {
    if (!run || run.phase !== "question_active") return;
    playMiniSelect();
    const locked = lockAnswer(run, displayIndex);
    updateRun(locked);
    if (lockTimer.current) window.clearTimeout(lockTimer.current);
    lockTimer.current = window.setTimeout(() => {
      setRun((current) => {
        if (!current) return current;
        const revealed = revealAnswer(current, bank);
        persist(revealed);
        const slot = revealed.questions[revealed.questionIndex];
        if (slot?.correct) {
          playMiniCorrect();
          const correctSoFar = countCorrectAnswers(revealed);
          if (correctSoFar === 5 || correctSoFar === 10) playMiniMilestone();
          if (correctSoFar === 15) playMiniWin();
        } else if (slot?.correct === false) {
          playMiniIncorrect();
        }
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
    const stats = loadQuizStats();
    if (run?.mode === "team" && run.teamId) {
      const next = createQuizRun({
        bank,
        mode: "team",
        teamId: run.teamId,
        recentIds: stats.recentQuestionIds,
        recentTopicIds: stats.recentTopicIds,
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
    router.replace("/mini-games/quiz");
  };

  return (
    <StandardPageShell>
      <div className={`${PAGE.section} quiz-arena mx-auto flex w-full max-w-5xl flex-col items-center`}>
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
              router.replace("/mini-games/quiz?mode=team");
              setView("team");
            }}
          />
        ) : view === "team" ? (
          <QuizTeamSelect
            teamId={teamId}
            query={teamQuery}
            onQuery={setTeamQuery}
            onSelect={setTeamId}
            onBack={() => {
              router.replace("/mini-games/quiz");
              setView("landing");
            }}
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
            onChange={() => {
              const stats = loadQuizStats();
              updateRun(
                useChangeQuestion(
                  run,
                  bank,
                  stats.recentQuestionIds,
                  stats.recentTopicIds
                )
              );
            }}
            onHub={() => setView("landing")}
          />
        ) : view === "result" && run ? (
          <QuizResultScreen run={run} bank={bank} onAgain={playAgain} onBack={backToQuiz} />
        ) : (
          <QuizLanding
            hasActiveRun={false}
            onResume={() => undefined}
            onMillionaire={startMillionaire}
            onTeam={() => {
              router.replace("/mini-games/quiz?mode=team");
              setView("team");
            }}
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
      <h1 className={`mt-2 ${TYPO.pageTitle}`}>Choose your quiz</h1>
      <p className={`mx-auto mt-3 max-w-md ${TYPO.pageSubtitle}`}>
        Play the classic ladder or take on a Team Challenge.
      </p>

      {hasActiveRun && (
        <div className="mx-auto mt-5 max-w-sm">
          <GameButton variant="theme" onClick={onResume}>
            Resume quiz
          </GameButton>
        </div>
      )}

      <div className="mt-8 grid gap-3">
        <button
          type="button"
          onClick={onMillionaire}
          className="w-full border border-white/10 bg-[#0c1210] px-4 py-4 text-center"
        >
          <p className={TYPO.keyLabel}>Normal Quiz</p>
          <p className={`mt-1 ${TYPO.bodySm}`}>
            Super League Millionaire — 15 questions to £1,000,000.
          </p>
        </button>
        <button
          type="button"
          onClick={onTeam}
          className="w-full border border-white/10 bg-[#0c1210] px-4 py-4 text-center"
        >
          <p className={TYPO.keyLabel}>Team Challenge</p>
          <p className={`mt-1 ${TYPO.bodySm}`}>
            Every question is about one club.
          </p>
        </button>
      </div>
      <div className="mx-auto mt-6 max-w-sm">
        <GameButton variant="secondary" href="/mini-games">
          Mini Games
        </GameButton>
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
  const filtered = QUIZ_CLUBS.filter(
    (club) =>
      isEligibleMiniGameQuizTeamId(club.id) &&
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
  const isFinal = questionNumber === 15;
  const locked = run.phase !== "question_active";
  const revealed = run.phase === "answer_revealed";
  const club = run.teamId ? getQuizClub(run.teamId) : null;
  const options = question && slot ? getDisplayedOptions(question, slot) : [];
  const correctDisplay = question && slot ? getCorrectDisplayIndex(question, slot) : -1;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,36rem)_minmax(0,1fr)] lg:items-start">
      <aside className="hidden lg:block lg:justify-self-end lg:pt-1">
        <ol className="w-[13.5rem] space-y-1 text-left">
          {[...QUIZ_PRIZE_LADDER].map((amount, index) => {
            const number = index + 1;
            const current = number === questionNumber;
            const safe = isSafeQuestionNumber(number);
            const final = number === 15;
            return (
              <li
                key={amount}
                className={`flex items-center justify-between px-2 py-1 text-sm ${
                  current ? "quiz-ladder-item--current" : ""
                } ${safe ? "quiz-ladder-item--safe" : "text-gray-400"} ${
                  final ? "quiz-ladder-item--final" : ""
                }`}
              >
                <span>
                  {number}
                  {safe ? " · SAFE" : ""}
                  {final ? " · FINAL" : ""}
                </span>
                <span className="tabular-nums">{formatClubFundsExact(amount)}</span>
              </li>
            );
          }).reverse()}
        </ol>
      </aside>

      <section className="mx-auto min-w-0 w-full max-w-xl text-center lg:col-start-2">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start sm:justify-center sm:gap-4">
          <div className="min-w-0">
            <p className={TYPO.sectionLabel}>Super League Millionaire</p>
            {club && (
              <p className={`mt-1 ${TYPO.clubName}`}>{club.name} Team Challenge</p>
            )}
          </div>
          <button
            type="button"
            onClick={onHub}
            className="text-sm text-pitch-400 underline-offset-2 hover:underline"
          >
            Quiz home
          </button>
        </div>

        {isFinal ? (
          <div className="quiz-final-banner mt-4">
            <p className={TYPO.keyLabel}>Final question</p>
            <p className="quiz-prize mt-1 text-3xl">£1,000,000</p>
            <p className={`mt-1 ${TYPO.meta}`}>
              15 of 15 — one question from £1,000,000
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-white/10 bg-[#0c1210] px-3 py-3">
            <p className={`text-center ${TYPO.keyLabel}`}>
              Question {questionNumber} of 15
            </p>
            <p className="quiz-prize mt-1 text-center text-3xl sm:text-4xl">
              {formatClubFundsExact(getPrizeForQuestionNumber(questionNumber))}
            </p>
            <div
              className={`mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-center ${TYPO.bodySm}`}
            >
              <span>
                Next: {nextPrize ? formatClubFundsExact(nextPrize) : "—"}
              </span>
              <span>Safe: {formatClubFundsExact(guaranteed)}</span>
              <span>{15 - questionNumber} to £1,000,000</span>
            </div>
            <details className="mt-3 lg:hidden">
              <summary className={`cursor-pointer text-center ${TYPO.meta}`}>
                Prize ladder
              </summary>
              <ol className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-left">
                {[...QUIZ_PRIZE_LADDER]
                  .map((amount, index) => {
                    const number = index + 1;
                    const current = number === questionNumber;
                    const safe = isSafeQuestionNumber(number);
                    return (
                      <li
                        key={amount}
                        className={`flex justify-between px-1 text-xs ${
                          current ? "text-white" : "text-gray-500"
                        }`}
                      >
                        <span>
                          {number}
                          {safe ? " · SAFE" : ""}
                        </span>
                        <span>{formatClubFundsExact(amount)}</span>
                      </li>
                    );
                  })
                  .reverse()}
              </ol>
            </details>
          </div>
        )}

        <div className="quiz-progress-track mt-3" aria-hidden>
          <div
            className="quiz-progress-fill"
            style={{ width: `${(questionNumber / 15) * 100}%` }}
          />
        </div>

        <div
          className={`mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 ${TYPO.meta}`}
        >
          <span>Current: {formatClubFundsExact(currentPrize)}</span>
          <span>Guaranteed: {formatClubFundsExact(guaranteed)}</span>
        </div>

        <p className={`mt-5 text-lg leading-snug text-white sm:text-xl`}>
          {question?.question ?? "Question unavailable."}
        </p>

        <div className="mt-4 grid gap-2 text-left md:grid-cols-2">
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
            Phone a fan ({slot.phone.confidence}): {slot.phone.quote} They&apos;re on{" "}
            {LETTERS[slot.phone.suggestionIndex]}
            {options[slot.phone.suggestionIndex]
              ? ` — ${options[slot.phone.suggestionIndex]}`
              : ""}
            .
          </p>
        )}

        {revealed && (
          <div className="mx-auto mt-5 w-full max-w-xs">
            <GameButton variant="theme" onClick={onContinue}>
              {slot?.correct ? "Continue" : "See result"}
            </GameButton>
          </div>
        )}

        <div className="mt-5 grid w-full grid-cols-4 gap-1.5">
          <GameButton
            variant="secondary"
            size="sm"
            className="quiz-lifeline"
            disabled={run.lifelines.fiftyFifty || locked}
            onClick={onFifty}
          >
            50/50
          </GameButton>
          <GameButton
            variant="secondary"
            size="sm"
            className="quiz-lifeline"
            disabled={run.lifelines.crowd || locked}
            onClick={onCrowd}
          >
            Crowd
          </GameButton>
          <GameButton
            variant="secondary"
            size="sm"
            className="quiz-lifeline"
            disabled={run.lifelines.phone || locked}
            onClick={onPhone}
          >
            Phone
          </GameButton>
          <GameButton
            variant="secondary"
            size="sm"
            className="quiz-lifeline"
            disabled={run.lifelines.change || locked}
            onClick={onChange}
          >
            Change
          </GameButton>
        </div>

        {run.phase === "question_active" && (
          <div className="mx-auto mt-3 w-full max-w-xs">
            <GameButton variant="secondary" onClick={onWalkAway}>
              Walk Away
            </GameButton>
          </div>
        )}
      </section>
      <div className="hidden lg:block" aria-hidden />
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
  const club = run.teamId ? getQuizClub(run.teamId) : null;
  const title =
    run.phase === "quiz_complete"
      ? "Millionaire"
      : run.phase === "quiz_walked_away"
        ? "You banked it"
        : "Quiz over";

  return (
    <div className="mx-auto w-full max-w-xl text-center">
      {run.phase === "quiz_complete" && <Confetti />}
      <p className={TYPO.sectionLabel}>
        {club ? club.name : "Super League Millionaire"}
      </p>
      <h1 className={`mt-2 ${TYPO.pageTitle}`}>{title}</h1>
      {run.phase === "quiz_complete" ? (
        <p className={`mt-3 ${TYPO.pageSubtitle}`}>
          You answered all 15 questions correctly — Super League Millionaire payout.
        </p>
      ) : (
        <p className={`mt-3 ${TYPO.pageSubtitle}`}>
          You reached Question {run.questionIndex + 1}
        </p>
      )}
      <p className="quiz-prize mt-4 text-4xl">
        {run.phase === "quiz_complete"
          ? "£1,000,000"
          : formatClubFundsExact(run.rewardAmount)}
      </p>
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
        <li>Incorrect: {Math.max(0, answered - correct)}</li>
        <li>Money won: {formatClubFundsExact(run.rewardAmount)}</li>
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
      </ul>
      <MiniGameEndActions onPlayAgain={onAgain} playAgainLabel="Play again" />
      <div className="mx-auto mt-2 w-full max-w-xs">
        <GameButton variant="secondary" onClick={onBack}>
          Back to Quiz
        </GameButton>
      </div>
    </div>
  );
}
