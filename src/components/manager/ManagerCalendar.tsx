"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ManagerPage,
  ManagerSection,
  ManagerSectionCard,
} from "@/components/manager/manager-ui";
import { GameSectionHeader } from "@/components/ui/GameSectionHeader";
import { GameButton } from "@/components/ui/GameButton";
import { ManagerDialog } from "@/components/manager/ManagerDialog";
import {
  CalendarSimAnimation,
  type CalendarSimAnimationPhase,
} from "@/components/manager/CalendarSimAnimation";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import {
  buildManagerSeasonCalendar,
  CALENDAR_HIGHLIGHT_STYLES,
  getDateKeyForGameWeek,
  getEventsForDate,
  getSimTargetGameWeekForDate,
  toDateKey,
  type ManagerCalendarEvent,
} from "@/lib/manager/managerCalendar";
import { simulateCareerToGameWeek } from "@/lib/manager/managerSimToDate";
import { playUiClick } from "@/lib/sound";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const IDLE_SIM_ANIM: {
  status: CalendarSimAnimationPhase;
  startDate: string | null;
  reachedDate: string | null;
  message: string | null;
} = {
  status: "idle",
  startDate: null,
  reachedDate: null,
  message: null,
};

interface ManagerCalendarProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Monday-based weekday index 0–6 for the 1st of the month. */
function mondayFirstOffset(year: number, month: number): number {
  const dow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay(); // 0 Sun
  return dow === 0 ? 6 : dow - 1;
}

export function ManagerCalendar({ career, onUpdate }: ManagerCalendarProps) {
  const events = useMemo(() => buildManagerSeasonCalendar(career), [career]);
  const bounds = useMemo(() => {
    if (events.length === 0) {
      return {
        startMonth: 2,
        startYear: career.seasonYear,
        endMonth: 10,
        endYear: career.seasonYear,
      };
    }
    return {
      startMonth: events[0]!.month,
      startYear: events[0]!.year,
      endMonth: events[events.length - 1]!.month,
      endYear: events[events.length - 1]!.year,
    };
  }, [events, career.seasonYear]);

  const [viewYear, setViewYear] = useState(bounds.startYear);
  const [viewMonth, setViewMonth] = useState(bounds.startMonth);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [simConfirm, setSimConfirm] = useState(false);
  const [simBusy, setSimBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [simAnim, setSimAnim] = useState(IDLE_SIM_ANIM);
  const animCompleteTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (animCompleteTimerRef.current != null) {
        window.clearTimeout(animCompleteTimerRef.current);
        animCompleteTimerRef.current = null;
      }
    };
  }, []);

  const selectedEvents = selectedDate
    ? getEventsForDate(events, selectedDate)
    : [];

  const cells = useMemo(() => {
    const dim = daysInMonth(viewYear, viewMonth);
    const offset = mondayFirstOffset(viewYear, viewMonth);
    const list: { day: number | null; dateKey: string | null }[] = [];
    for (let i = 0; i < offset; i++) list.push({ day: null, dateKey: null });
    for (let d = 1; d <= dim; d++) {
      list.push({ day: d, dateKey: toDateKey(viewYear, viewMonth, d) });
    }
    while (list.length % 7 !== 0) list.push({ day: null, dateKey: null });
    return list;
  }, [viewYear, viewMonth]);

  const canGoPrev =
    viewYear > bounds.startYear ||
    (viewYear === bounds.startYear && viewMonth > bounds.startMonth);
  const canGoNext =
    viewYear < bounds.endYear ||
    (viewYear === bounds.endYear && viewMonth < bounds.endMonth);

  const shiftMonth = (delta: number) => {
    playUiClick();
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setViewMonth(m);
    setViewYear(y);
    setSelectedDate(null);
  };

  const dismissSimAnim = () => {
    if (animCompleteTimerRef.current != null) {
      window.clearTimeout(animCompleteTimerRef.current);
      animCompleteTimerRef.current = null;
    }
    // Close overlay first; any follow-up weekly UI continues only after this.
    setSimAnim(IDLE_SIM_ANIM);
  };

  const runSimToDate = () => {
    if (!selectedDate || simBusy || simAnim.status !== "idle") return;
    const target = getSimTargetGameWeekForDate(events, selectedDate);
    if (target == null) {
      setStatusMsg("No fixtures on or before that date.");
      setSimConfirm(false);
      return;
    }

    const startDate =
      getDateKeyForGameWeek(events, career.gameWeek) ?? selectedDate;

    setSimBusy(true);
    setSimConfirm(false);
    setSimAnim({
      status: "processing",
      startDate,
      reachedDate: null,
      message: null,
    });

    try {
      const result = simulateCareerToGameWeek(career, target);
      const reachedDate =
        getDateKeyForGameWeek(
          buildManagerSeasonCalendar(result.career),
          result.career.gameWeek
        ) ?? selectedDate;

      if (!result.ok) {
        setSimAnim({
          status: "error",
          startDate,
          reachedDate: startDate,
          message: result.error ?? "Could not simulate to that date.",
        });
        setStatusMsg(result.error ?? "Could not simulate to that date.");
        return;
      }

      onUpdate(result.career);
      setStatusMsg(
        `Simulated ${result.matchesSimulated} match${result.matchesSimulated === 1 ? "" : "es"} · advanced ${result.weeksAdvanced} week${result.weeksAdvanced === 1 ? "" : "s"}.${result.error && result.stoppedEarly ? ` (${result.error})` : ""}`
      );

      if (startDate === reachedDate) {
        setSimAnim({
          status: "complete",
          startDate,
          reachedDate,
          message: "Already at that date.",
        });
      } else {
        setSimAnim({
          status: "animating",
          startDate,
          reachedDate,
          message: null,
        });
        if (animCompleteTimerRef.current != null) {
          window.clearTimeout(animCompleteTimerRef.current);
        }
        animCompleteTimerRef.current = window.setTimeout(() => {
          animCompleteTimerRef.current = null;
          setSimAnim((prev) =>
            prev.status === "animating"
              ? { ...prev, status: "complete" }
              : prev
          );
        }, 2800);
      }
    } catch (err) {
      setSimAnim({
        status: "error",
        startDate,
        reachedDate: startDate,
        message: err instanceof Error ? err.message : "Simulation failed.",
      });
    } finally {
      setSimBusy(false);
    }
  };

  return (
    <ManagerPage>
      <ManagerSection>
        <GameSectionHeader
          size="page"
          label="Schedule"
          title="Calendar"
          subtitle={`Season ${career.seasonYear} · select a date to review fixtures or sim forward`}
        />

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <GameButton
            variant="secondary"
            size="sm"
            disabled={!canGoPrev}
            onClick={() => shiftMonth(-1)}
          >
            Prev
          </GameButton>
          <p className={TYPO.cardTitle}>
            {MONTH_NAMES[viewMonth - 1]} {viewYear}
          </p>
          <GameButton
            variant="secondary"
            size="sm"
            disabled={!canGoNext}
            onClick={() => shiftMonth(1)}
          >
            Next
          </GameButton>
        </div>

        <div className={`${CARD.elevated} ${SPACING.cardPadding}`}>
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wider text-pitch-500">
            {WEEKDAYS.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, idx) => {
              if (!cell.day || !cell.dateKey) {
                return <div key={`e-${idx}`} className="min-h-[4.5rem]" />;
              }
              const dayEvents = getEventsForDate(events, cell.dateKey);
              const selected = selectedDate === cell.dateKey;
              return (
                <button
                  key={cell.dateKey}
                  type="button"
                  onClick={() => {
                    playUiClick();
                    setSelectedDate(cell.dateKey);
                    setStatusMsg(null);
                  }}
                  className={`min-h-[4.5rem] rounded-lg border p-1 text-left transition ${
                    selected
                      ? "border-theme-primary/60 bg-theme-primary/15"
                      : "border-pitch-700/45 bg-pitch-950/40 hover:border-pitch-500/55"
                  }`}
                >
                  <span className="text-[11px] font-semibold text-pitch-300">
                    {cell.day}
                  </span>
                  <ul className="mt-0.5 space-y-0.5">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <li key={ev.id}>
                        <span
                          className={`block truncate rounded px-0.5 text-[9px] font-semibold leading-tight ${CALENDAR_HIGHLIGHT_STYLES[ev.highlight].chip}`}
                        >
                          {ev.label}
                        </span>
                      </li>
                    ))}
                    {dayEvents.length > 2 ? (
                      <li className="text-[9px] text-pitch-500">
                        +{dayEvents.length - 2}
                      </li>
                    ) : null}
                  </ul>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {(
            Object.entries(CALENDAR_HIGHLIGHT_STYLES) as [
              keyof typeof CALENDAR_HIGHLIGHT_STYLES,
              { chip: string; label: string },
            ][]
          ).map(([key, style]) => (
            <span
              key={key}
              className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${style.chip}`}
            >
              {style.label}
            </span>
          ))}
        </div>

        {selectedDate ? (
          <ManagerSectionCard
            title={selectedDate}
            variant="elevated"
            className="mt-4"
          >
            {selectedEvents.length === 0 ? (
              <p className={`mt-2 ${TYPO.bodySm} text-pitch-500`}>
                No fixtures on this date.
              </p>
            ) : (
              <ul className={`mt-3 ${SPACING.stackSm}`}>
                {selectedEvents.map((ev) => (
                  <CalendarEventRow key={ev.id} event={ev} club={career.club} />
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <GameButton
                variant="theme"
                size="sm"
                disabled={
                  simBusy ||
                  simAnim.status !== "idle" ||
                  selectedEvents.every((e) => e.played)
                }
                onClick={() => {
                  playUiClick();
                  setSimConfirm(true);
                }}
              >
                Sim to date
              </GameButton>
            </div>
            {statusMsg ? (
              <p className={`mt-2 ${TYPO.bodySm} text-pitch-400`}>{statusMsg}</p>
            ) : null}
          </ManagerSectionCard>
        ) : (
          <p className={`mt-4 ${TYPO.bodySm} text-pitch-500`}>
            Select a date to see fixtures and simulate forward.
          </p>
        )}

        <ManagerDialog
          open={simConfirm}
          variant="confirm"
          title="Simulate to date"
          message={
            selectedDate
              ? `Auto-simulate your matches and advance Match Weeks up to ${selectedDate}? You can still review results afterwards.`
              : ""
          }
          confirmLabel={simBusy ? "Simulating…" : "Sim to date"}
          cancelLabel="Cancel"
          onConfirm={runSimToDate}
          onCancel={() => (!simBusy ? setSimConfirm(false) : undefined)}
        />
      </ManagerSection>

      <CalendarSimAnimation
        open={simAnim.status !== "idle"}
        startDateKey={simAnim.startDate}
        reachedDateKey={simAnim.reachedDate}
        status={simAnim.status}
        statusMessage={simAnim.message}
        onDismiss={dismissSimAnim}
        onTrailComplete={() => {
          if (animCompleteTimerRef.current != null) {
            window.clearTimeout(animCompleteTimerRef.current);
            animCompleteTimerRef.current = null;
          }
          setSimAnim((prev) =>
            prev.status === "animating"
              ? { ...prev, status: "complete" }
              : prev
          );
        }}
      />
    </ManagerPage>
  );
}

function CalendarEventRow({
  event,
  club,
}: {
  event: ManagerCalendarEvent;
  club: string;
}) {
  const style = CALENDAR_HIGHLIGHT_STYLES[event.highlight];
  const venue =
    event.competition === "world_club_challenge" && event.label.includes("AI")
      ? event.opponent
      : event.isHome
        ? `vs ${event.opponent}`
        : `@ ${event.opponent}`;
  return (
    <li
      className={`${CARD.inset} ${SPACING.cardPaddingSm} flex items-start gap-3`}
    >
      <span
        className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase ${style.chip}`}
      >
        {style.label}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-white">{event.label}</p>
        <p className={`${TYPO.bodySm} text-pitch-400`}>
          {club} {venue}
        </p>
        {event.played && event.scoreline ? (
          <p className={`${TYPO.bodySm} text-theme-primary`}>
            {event.result ? `${event.result} ` : ""}
            {event.scoreline}
          </p>
        ) : (
          <p className={`${TYPO.bodySm} text-pitch-500`}>Upcoming</p>
        )}
      </div>
    </li>
  );
}
