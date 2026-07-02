"use client";

import { CARD, FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type {
  ManagerCareer,
  ManagerTactics,
  PlayingStyle,
  AttackFocus,
  DefenceFocus,
} from "@/lib/manager/types";
import {
  LIVE_MATCH_COMMANDS,
  commandFromTactics,
  describeLiveCommand,
  getLiveCommandLabel,
  getTacticsLiveCommandReason,
} from "@/lib/manager/managerLiveMatch";
import { getTacticGameplaySummary } from "@/lib/manager/managerTacticsScoring";
import { playUiClick } from "@/lib/sound";

const PLAYING_STYLES: { value: PlayingStyle; label: string }[] = [
  { value: "balanced", label: "Balanced" },
  { value: "expansive", label: "Expansive" },
  { value: "direct", label: "Direct" },
  { value: "defensive", label: "Defensive" },
  { value: "high_tempo", label: "High Tempo" },
];

const ATTACK_FOCUS: { value: AttackFocus; label: string }[] = [
  { value: "middle", label: "Middle" },
  { value: "edges", label: "Edges" },
  { value: "kicking_game", label: "Kicking Game" },
  { value: "offloads", label: "Offloads" },
  { value: "safe_sets", label: "Safe Sets" },
];

const DEFENCE_FOCUS: { value: DefenceFocus; label: string }[] = [
  { value: "line_speed", label: "Line Speed" },
  { value: "conservative", label: "Conservative" },
  { value: "aggressive_contact", label: "Aggressive Contact" },
  { value: "edge_defence", label: "Edge Defence" },
  { value: "goal_line", label: "Goal-Line Defence" },
];

const TACTIC_BIOS: Record<string, string> = {
  balanced: "Even risk and reward — reliable in most match-ups.",
  expansive:
    "Spread the ball wide for more tries; higher error risk. Strong attacking edge.",
  direct: "Run hard through the middle — forwards score more, backs less.",
  defensive:
    "Tighter defence, fewer points conceded; harder to score yourself.",
  high_tempo:
    "Fast sets open the game but tire players faster — extra injury risk.",
  middle: "Target the pack — +edge for forward tries.",
  edges: "Use width — wingers and centres favoured for tries.",
  kicking_game: "Territory through kicks — halves and wingers benefit.",
  offloads:
    "Keep the ball alive in contact — broken-field tries, slightly more errors.",
  safe_sets: "Fewer errors and a tighter game — less explosive attack.",
  line_speed: "Rush defence shuts down halves; watch kicks behind the line.",
  conservative:
    "Hold your line — fewer tries conceded, less turnover ball to attack with.",
  aggressive_contact:
    "Dominant tackles and contact; higher fatigue and injury risk.",
  edge_defence: "Shut down wingers — strong wide defence, middle can leak.",
  goal_line:
    "Protect the posts — tough to score close range, edges remain a threat.",
};

function OptionGroup<T extends string>({
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
    <div>
      <p className={`${TYPO.sectionLabel} mb-2`}>{label}</p>
      <div className="flex flex-wrap gap-2">
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
      <p className={`mt-2 ${TYPO.bodySm} text-pitch-400`}>
        {TACTIC_BIOS[value] ?? ""}
      </p>
    </div>
  );
}

function MatchImpactPreview({ tactics }: { tactics: ManagerTactics }) {
  const summary = getTacticGameplaySummary(tactics);

  return (
    <div className={`${CARD.stat} ${SPACING.cardPaddingSm}`}>
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
        <div className="mt-2 flex flex-wrap gap-1.5">
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
    <div className={`${CARD.stat} ${SPACING.cardPaddingSm}`}>
      <p className={TYPO.sectionLabel}>Live Play</p>
      <p className={`mt-2 ${TYPO.bodySm} text-pitch-200`}>
        When you play a match live, you can switch between{" "}
        <span className="text-pitch-100">Attack</span>,{" "}
        <span className="text-pitch-100">Balanced</span>,{" "}
        <span className="text-pitch-100">Defend</span>, and{" "}
        <span className="text-pitch-100">Champagne</span> during the game.
      </p>
      <div className="mt-3 flex flex-wrap gap-1.5">
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
      <p className={`mt-3 ${TYPO.bodySm} text-pitch-300`}>
        <span className="font-semibold text-theme-primary">
          {getLiveCommandLabel(defaultCommand)}
        </span>{" "}
        is your kick-off command with this setup.
      </p>
      <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>{reason}</p>
      <p className={`mt-2 ${TYPO.bodySm} text-pitch-500`}>
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
        options={PLAYING_STYLES}
        value={t.playingStyle}
        onChange={(v) => update({ playingStyle: v })}
      />
      <OptionGroup
        label="Attack Focus"
        options={ATTACK_FOCUS}
        value={t.attackFocus}
        onChange={(v) => update({ attackFocus: v })}
      />
      <OptionGroup
        label="Defence Focus"
        options={DEFENCE_FOCUS}
        value={t.defenceFocus}
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
      <h1 className={TYPO.pageTitle}>Tactics</h1>
      <ManagerTacticsPanel career={career} onChange={onChange} />
    </div>
  );
}
