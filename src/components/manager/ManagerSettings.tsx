"use client";

import {
  ManagerPage,
  ManagerSection,
  ManagerSectionCard,
} from "@/components/manager/manager-ui";
import { GameSectionHeader } from "@/components/ui/GameSectionHeader";
import { playUiClick } from "@/lib/sound";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import {
  DEFAULT_MANAGER_SETTINGS,
  type ManagerAutoRenewContractYears,
  type ManagerCareer,
  type ManagerSettings,
} from "@/lib/manager/types";

interface ManagerSettingsProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
}

const CONTRACT_YEAR_OPTIONS: ManagerAutoRenewContractYears[] = [1, 2, 3, 4];

const TOGGLE_OPTIONS: {
  key: keyof Omit<ManagerSettings, "autoRenewContractYears">;
  label: string;
  description: string;
}[] = [
  {
    key: "autoFixSquadBeforeMatch",
    label: "Auto-fix squad before match",
    description: "Fill gaps and injuries automatically when you kick off.",
  },
  {
    key: "showAchievementPopups",
    label: "Show achievement popups",
    description: "Display unlock toasts when you earn achievements.",
  },
  {
    key: "compactFixtureRows",
    label: "Compact fixture rows",
    description: "Use a denser fixtures list layout.",
  },
  {
    key: "autoOpenNextFixture",
    label: "Auto-open next fixture",
    description: "Jump to the next match after finishing a game.",
  },
  {
    key: "wccWriteUpExpandedByDefault",
    label: "WCC write-up expanded",
    description: "Expand World Club Challenge match write-ups by default.",
  },
];

function getSettings(career: ManagerCareer): ManagerSettings {
  return career.managerSettings ?? { ...DEFAULT_MANAGER_SETTINGS };
}

export function ManagerSettings({ career, onUpdate }: ManagerSettingsProps) {
  const settings = getSettings(career);

  const patchSettings = (patch: Partial<ManagerSettings>) => {
    playUiClick();
    const next = { ...settings, ...patch };
    if (typeof window !== "undefined" && "showAchievementPopups" in patch) {
      window.localStorage.setItem(
        "manager-show-achievement-popups",
        next.showAchievementPopups ? "1" : "0"
      );
    }
    onUpdate({
      ...career,
      managerSettings: next,
      updatedAt: new Date().toISOString(),
    });
  };

  return (
    <ManagerPage>
      <ManagerSection width="narrow">
        <GameSectionHeader
          label="Preferences"
          title="Settings"
          subtitle="Tune contract renewals and Manager Mode behaviour for this save."
        />

        <ManagerSectionCard
          title="Contract settings"
          variant="elevated"
          accent="primary"
        >
          <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
            Bulk renew offers this many years instead of each player&apos;s
            demand.
          </p>
          <fieldset className="mt-4">
            <legend className="sr-only">Auto-renew contract length</legend>
            <div className="grid grid-cols-4 gap-2">
              {CONTRACT_YEAR_OPTIONS.map((years) => {
                const selected = settings.autoRenewContractYears === years;
                return (
                  <label
                    key={years}
                    className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center transition ${
                      selected
                        ? "border-theme-primary/60 bg-theme-primary/15 text-theme-primary"
                        : "border-pitch-600/55 bg-pitch-900/40 text-pitch-300 hover:border-pitch-500/55"
                    }`}
                  >
                    <input
                      type="radio"
                      name="autoRenewContractYears"
                      className="sr-only"
                      checked={selected}
                      onChange={() =>
                        patchSettings({ autoRenewContractYears: years })
                      }
                    />
                    <span className="text-lg font-bold">{years}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider">
                      {years === 1 ? "Year" : "Years"}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </ManagerSectionCard>

        <ManagerSectionCard title="Gameplay" variant="elevated">
          <ul className={`mt-2 divide-y divide-pitch-700/50`}>
            {TOGGLE_OPTIONS.map((option) => {
              const on = settings[option.key];
              return (
                <li
                  key={option.key}
                  className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className={`${TYPO.bodySm} font-semibold text-white`}>
                      {option.label}
                    </p>
                    <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-500`}>
                      {option.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={option.label}
                    onClick={() => patchSettings({ [option.key]: !on })}
                    className={`relative mt-0.5 h-7 w-12 shrink-0 rounded-full border transition ${
                      on
                        ? "border-theme-primary/50 bg-theme-primary/80"
                        : "border-pitch-600/55 bg-pitch-800"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                        on ? "left-6" : "left-0.5"
                      }`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </ManagerSectionCard>

        <p className={`${CARD.base} ${SPACING.cardPadding} ${TYPO.bodySm} text-pitch-500`}>
          Settings are stored with this save slot.
        </p>
      </ManagerSection>
    </ManagerPage>
  );
}
