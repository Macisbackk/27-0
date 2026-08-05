"use client";

import { ManagerPage, ManagerSection } from "@/components/manager/manager-ui";
import { CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer, ManagerTactics } from "@/lib/manager/types";
import {
  ATTACK_FOCUS_BIOS,
  ATTACK_FOCUS_OPTIONS,
  DEFENCE_FOCUS_BIOS,
  DEFENCE_FOCUS_OPTIONS,
  PLAYING_STYLE_BIOS,
  PLAYING_STYLE_OPTIONS,
} from "@/lib/manager/managerTacticsCopy";
import {
  LIVE_MATCH_COMMANDS,
  commandFromTactics,
  describeLiveCommand,
  getLiveCommandLabel,
  getTacticsLiveCommandReason,
} from "@/lib/manager/managerLiveMatch";
import { getTacticGameplaySummary } from "@/lib/manager/managerTacticsScoring";
import { ManagerPositionRetrainingPanel } from "@/components/manager/ManagerPositionRetraining";
import { playUiClick } from "@/lib/sound";

function CompactOptionRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <p className={`${TYPO.sectionLabel}`}>{label}</p>
      <div className="flex min-w-0 flex-wrap justify-center gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              playUiClick();
              onChange(opt.value);
            }}
            className={`rounded-md border px-2.5 py-1.5 text-xs leading-tight transition ${
              value === opt.value ? FILTER.chipActive : `${FILTER.chipIdle} btn-press`
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TacticsSetupPanel({
  tactics,
  onChange,
}: {
  tactics: ManagerTactics;
  onChange: (patch: Partial<ManagerTactics>) => void;
}) {
  return (
    <div className={`${CARD.stat} ${SPACING.cardPaddingSm} space-y-3`}>
      <CompactOptionRow
        label="Style"
        options={PLAYING_STYLE_OPTIONS}
        value={tactics.playingStyle}
        onChange={(v) => onChange({ playingStyle: v })}
      />
      <CompactOptionRow
        label="Attack"
        options={ATTACK_FOCUS_OPTIONS}
        value={tactics.attackFocus}
        onChange={(v) => onChange({ attackFocus: v })}
      />
      <CompactOptionRow
        label="Defence"
        options={DEFENCE_FOCUS_OPTIONS}
        value={tactics.defenceFocus}
        onChange={(v) => onChange({ defenceFocus: v })}
      />
      <p className={`mx-auto max-w-lg border-t border-pitch-700/40 pt-2 text-center ${TYPO.meta} sm:text-xs sm:leading-snug sm:text-pitch-400`}>
        <span className="sm:hidden">Tap options to set your match plan</span>
        <span className="hidden sm:inline">
          {PLAYING_STYLE_BIOS[tactics.playingStyle]}{" "}
          <span className="text-pitch-600">·</span>{" "}
          {ATTACK_FOCUS_BIOS[tactics.attackFocus]}{" "}
          <span className="text-pitch-600">·</span>{" "}
          {DEFENCE_FOCUS_BIOS[tactics.defenceFocus]}
        </span>
      </p>
    </div>
  );
}

function MatchImpactPreview({ tactics }: { tactics: ManagerTactics }) {
  const summary = getTacticGameplaySummary(tactics);

  return (
    <div className={`${CARD.stat} ${SPACING.cardPaddingSm} text-center`}>
      <p className={TYPO.sectionLabel}>Match Impact</p>
      <p className={`mt-1.5 text-[11px] leading-snug text-pitch-300 sm:text-xs`}>
        <span className="font-semibold text-theme-primary">Attack: </span>
        {summary.attackEffect}
        <span className="mx-1.5 text-pitch-600">·</span>
        <span className="font-semibold text-sky-300">Defence: </span>
        {summary.defenceEffect}
      </p>
      <p className={`mt-1.5 text-xs font-semibold text-theme-primary sm:text-sm`}>
        {summary.matchImpact}
      </p>
      {summary.cautions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap justify-center gap-1">
          {summary.cautions.map((caution) => (
            <span
              key={caution}
              className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200"
            >
              {caution}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function LivePlayPreview({ career }: { career: ManagerCareer }) {
  const defaultCommand = commandFromTactics(career);
  const reason = getTacticsLiveCommandReason(career);

  return (
    <div className={`${CARD.stat} ${SPACING.cardPaddingSm} text-center`}>
      <p className={TYPO.sectionLabel}>Live Play</p>
      <div className="mt-1.5 flex flex-wrap justify-center gap-1">
        {LIVE_MATCH_COMMANDS.map((cmd) => (
          <span
            key={cmd}
            className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
              cmd === defaultCommand
                ? "border-theme-primary/50 bg-theme-primary/15 text-theme-primary"
                : "border-pitch-600/60 bg-pitch-900/40 text-pitch-400"
            }`}
          >
            {getLiveCommandLabel(cmd)}
          </span>
        ))}
      </div>
      <p className={`mx-auto mt-1.5 max-w-lg text-[11px] leading-snug text-pitch-300 sm:text-xs`}>
        <span className="font-semibold text-theme-primary">
          {getLiveCommandLabel(defaultCommand)}
        </span>{" "}
        at kick-off — {reason}. {describeLiveCommand(defaultCommand)}
      </p>
    </div>
  );
}

export function ManagerTacticsPanel({
  career,
  onChange,
  onCareerUpdate,
}: {
  career: ManagerCareer;
  onChange: (tactics: ManagerTactics) => void;
  onCareerUpdate?: (career: ManagerCareer) => void;
}) {
  const t = career.tactics;
  const update = (patch: Partial<ManagerTactics>) => {
    onChange({ ...t, ...patch });
  };

  return (
    <div className={SPACING.stackSm}>
      <TacticsSetupPanel tactics={t} onChange={update} />
      <section className={`${CARD.inset} ${SPACING.cardPaddingSm}`}>
        <h2 className={`text-center ${TYPO.sectionLabel}`}>
          Match impact & live play
        </h2>
        <div className="mt-3">
          <MatchImpactPreview tactics={t} />
          <LivePlayPreview career={career} />
        </div>
      </section>
      {onCareerUpdate && (
        <section className={`${CARD.inset} ${SPACING.cardPaddingSm}`}>
          <h2 className={`text-center ${TYPO.sectionLabel}`}>
            Dual position training
          </h2>
          <div className="mt-3">
            <ManagerPositionRetrainingPanel
              career={career}
              onUpdate={onCareerUpdate}
            />
          </div>
        </section>
      )}
    </div>
  );
}

export function ManagerTactics({
  career,
  onChange,
}: {
  career: ManagerCareer;
  onChange: (tactics: ManagerTactics) => void;
}) {
  return (
    <ManagerPage>
      <ManagerSection>
        <h1 className={`text-center ${TYPO.pageTitle}`}>Tactics</h1>
        <ManagerTacticsPanel career={career} onChange={onChange} />
      </ManagerSection>
    </ManagerPage>
  );
}
