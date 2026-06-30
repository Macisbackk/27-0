"use client";

import { FILTER, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import type {
  ManagerCareer,
  ManagerTactics,
  PlayingStyle,
  AttackFocus,
  DefenceFocus,
} from "@/lib/manager/types";
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
