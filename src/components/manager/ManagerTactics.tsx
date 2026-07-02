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
  balanced: "Even risk and reward — reliable in most match-ups. Live play defaults to Balanced.",
  expansive:
    "Spread the ball wide for more try chances; slightly more errors. With Offloads or Aggressive Contact, live play defaults to Champagne rugby.",
  direct: "Run hard through the middle — good for wearing down packs.",
  defensive:
    "Tighter shape, fewer points conceded; harder to score yourself. Live play defaults to Defend.",
  high_tempo:
    "Fast sets and quick play-the-balls; opens the game but tires players. Live play defaults to Attack.",
  middle: "Target the forwards and short-ball running lanes.",
  edges: "Use width and wingers to create line breaks.",
  kicking_game: "Territory through kicks; can pin opponents deep.",
  offloads:
    "Keep the ball alive in contact for broken-field chances. With Expansive style, live play defaults to Champagne rugby.",
  safe_sets: "Lower error rate on possession; fewer flashy plays.",
  line_speed: "Rush up in defence to shut down their attack early.",
  conservative:
    "Hold your line and wait for mistakes. Live play defaults to Defend.",
  aggressive_contact:
    "Big hits and dominant tackles; higher injury risk. With Expansive style, live play defaults to Champagne rugby.",
  edge_defence: "Shut down their wide threats.",
  goal_line:
    "Protect your try line when under sustained pressure. Live play defaults to Defend.",
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
