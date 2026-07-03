"use client";

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
import { playUiClick } from "@/lib/sound";

function OptionGroup<T extends string>({
  label,
  options,
  value,
  bio,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  bio: string;
  onChange: (v: T) => void;
}) {
  return (
    <div className="text-center">
      <p className={`${TYPO.sectionLabel} mb-2`}>{label}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => {
              playUiClick();
              onChange(opt.value);
            }}
            className={`rounded-lg border px-3 py-2 text-xs transition ${
              value === opt.value ? FILTER.chipActive : FILTER.chipIdle
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className={`mx-auto mt-2 max-w-lg ${TYPO.bodySm} text-pitch-400`}>
        {bio}
      </p>
    </div>
  );
}

function MatchImpactPreview({ tactics }: { tactics: ManagerTactics }) {
  const summary = getTacticGameplaySummary(tactics);

  return (
    <div className={`${CARD.stat} ${SPACING.cardPaddingSm} text-center`}>
      <p className={TYPO.sectionLabel}>Match Impact</p>
      <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>
        <span className="font-semibold text-theme-primary">Attack: </span>
        {summary.attackEffect}
      </p>
      <p className={`mt-1.5 ${TYPO.bodySm} text-pitch-300`}>
        <span className="font-semibold text-sky-300">Defence: </span>
        {summary.defenceEffect}
      </p>
      <p className={`mt-3 text-sm font-semibold text-theme-primary`}>
        {summary.matchImpact}
      </p>
      {summary.cautions.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
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
      <p className={`mx-auto mt-2 max-w-lg ${TYPO.bodySm} text-pitch-200`}>
        When you play a match live, you can switch between{" "}
        <span className="text-pitch-100">Attack</span>,{" "}
        <span className="text-pitch-100">Balanced</span>,{" "}
        <span className="text-pitch-100">Defend</span>, and{" "}
        <span className="text-pitch-100">Champagne</span> during the game.
      </p>
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {LIVE_MATCH_COMMANDS.map((cmd) => (
          <span
            key={cmd}
            className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
              cmd === defaultCommand
                ? "border-theme-primary/50 bg-theme-primary/15 text-theme-primary"
                : "border-pitch-600/60 bg-pitch-900/40 text-pitch-400"
            }`}
          >
            {getLiveCommandLabel(cmd)}
          </span>
        ))}
      </div>
      <p className={`mx-auto mt-3 max-w-lg ${TYPO.bodySm} text-pitch-300`}>
        <span className="font-semibold text-theme-primary">
          {getLiveCommandLabel(defaultCommand)}
        </span>{" "}
        is your kick-off command with this setup.
      </p>
      <p className={`mx-auto mt-1 max-w-lg ${TYPO.bodySm} text-pitch-400`}>
        {reason}
      </p>
      <p className={`mx-auto mt-2 max-w-lg ${TYPO.bodySm} text-pitch-500`}>
        {describeLiveCommand(defaultCommand)}
      </p>
    </div>
  );
}

export function ManagerTacticsPanel({
  career,
  onChange,
}: {
  career: ManagerCareer;
  onChange: (tactics: ManagerTactics) => void;
}) {
  const t = career.tactics;
  const update = (patch: Partial<ManagerTactics>) => {
    onChange({ ...t, ...patch });
  };

  return (
    <div className={`${SPACING.stackLg}`}>
      <OptionGroup
        label="Playing Style"
        options={PLAYING_STYLE_OPTIONS}
        value={t.playingStyle}
        bio={PLAYING_STYLE_BIOS[t.playingStyle]}
        onChange={(v) => update({ playingStyle: v })}
      />
      <OptionGroup
        label="Attack Focus"
        options={ATTACK_FOCUS_OPTIONS}
        value={t.attackFocus}
        bio={ATTACK_FOCUS_BIOS[t.attackFocus]}
        onChange={(v) => update({ attackFocus: v })}
      />
      <OptionGroup
        label="Defence Focus"
        options={DEFENCE_FOCUS_OPTIONS}
        value={t.defenceFocus}
        bio={DEFENCE_FOCUS_BIOS[t.defenceFocus]}
        onChange={(v) => update({ defenceFocus: v })}
      />
      <MatchImpactPreview tactics={t} />
      <LivePlayPreview career={career} />
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
    <div className={`mx-auto max-w-3xl ${SPACING.stackLg}`}>
      <h1 className={`text-center ${TYPO.pageTitle}`}>Tactics</h1>
      <ManagerTacticsPanel career={career} onChange={onChange} />
    </div>
  );
}
