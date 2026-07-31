"use client";

import { useState } from "react";
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
  DEFAULT_RESERVE_RELEASE_SETTINGS,
  type ManagerAutoRenewContractYears,
  type ManagerCareer,
  type ManagerSettings,
} from "@/lib/manager/types";
import { GameButton } from "@/components/ui/GameButton";
import {
  applyReserveReleases,
  previewReleaseBySettings,
} from "@/lib/manager/managerReserveRelease";

interface ManagerSettingsProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
}

const CONTRACT_YEAR_OPTIONS: ManagerAutoRenewContractYears[] = [1, 2, 3, 4];

const TOGGLE_OPTIONS: {
  key: keyof Omit<
    ManagerSettings,
    "autoRenewContractYears" | "reserveReleaseSettings"
  >;
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

        <ReserveReleaseSettingsCard
          career={career}
          settings={settings}
          onPatch={patchSettings}
          onUpdate={onUpdate}
        />

        <p className={`${CARD.base} ${SPACING.cardPadding} ${TYPO.bodySm} text-pitch-500`}>
          Settings are stored with this save slot.
        </p>
      </ManagerSection>
    </ManagerPage>
  );
}

function ReserveReleaseSettingsCard({
  career,
  settings,
  onPatch,
  onUpdate,
}: {
  career: ManagerCareer;
  settings: ManagerSettings;
  onPatch: (patch: Partial<ManagerSettings>) => void;
  onUpdate: (career: ManagerCareer) => void;
}) {
  const release = {
    ...DEFAULT_RESERVE_RELEASE_SETTINGS,
    ...settings.reserveReleaseSettings,
  };
  const [previewNames, setPreviewNames] = useState<string[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const patchRelease = (patch: Partial<typeof release>) => {
    onPatch({
      reserveReleaseSettings: { ...release, ...patch },
    });
  };

  return (
    <ManagerSectionCard title="Reserve Release Settings" variant="elevated">
      <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
        Auto-release rules for the reserve listing. Preview before applying.
      </p>
      <ul className="mt-3 divide-y divide-pitch-700/50">
        {(
          [
            {
              key: "enableAutoReleaseByRating" as const,
              label: "Auto-release by rating",
              description: `Release reserves under rating ${release.releaseUnderRating}.`,
            },
            {
              key: "enableAutoReleaseByAge" as const,
              label: "Auto-release over age",
              description: `Release reserves older than ${release.releaseOverAge}.`,
            },
            {
              key: "enableAutoReleaseUnderAge" as const,
              label: "Auto-release under age",
              description: `Release reserves younger than ${release.releaseUnderAge}.`,
            },
            {
              key: "protectHighPotentialPlayers" as const,
              label: "Protect high-potential players",
              description: "Keep prospects with strong ceilings.",
            },
          ] as const
        ).map((option) => {
          const on = release[option.key];
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
                onClick={() => patchRelease({ [option.key]: !on })}
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

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className={`${TYPO.bodySm} text-pitch-400`}>
          Release under rating
          <input
            type="number"
            min={40}
            max={90}
            value={release.releaseUnderRating}
            onChange={(e) =>
              patchRelease({
                releaseUnderRating: Number(e.target.value) || 55,
              })
            }
            className="mt-1 w-full rounded-md border border-pitch-600/60 bg-pitch-950 px-2 py-1.5 text-white"
          />
        </label>
        <label className={`${TYPO.bodySm} text-pitch-400`}>
          Release over age
          <input
            type="number"
            min={17}
            max={35}
            value={release.releaseOverAge}
            onChange={(e) =>
              patchRelease({ releaseOverAge: Number(e.target.value) || 23 })
            }
            className="mt-1 w-full rounded-md border border-pitch-600/60 bg-pitch-950 px-2 py-1.5 text-white"
          />
        </label>
        <label className={`${TYPO.bodySm} text-pitch-400`}>
          Minimum reserve size
          <input
            type="number"
            min={17}
            max={30}
            value={release.minimumReserveSquadSize}
            onChange={(e) =>
              patchRelease({
                minimumReserveSquadSize: Number(e.target.value) || 22,
              })
            }
            className="mt-1 w-full rounded-md border border-pitch-600/60 bg-pitch-950 px-2 py-1.5 text-white"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <GameButton
          variant="secondary"
          size="sm"
          onClick={() => {
            playUiClick();
            const preview = previewReleaseBySettings({
              ...career,
              managerSettings: settings,
            });
            setPreviewNames(preview.map((p) => p.reserve.name));
            setPreviewError(
              preview.length === 0 ? "No players match the current rules." : null
            );
          }}
        >
          Preview Releases
        </GameButton>
        <GameButton
          variant="theme"
          size="sm"
          onClick={() => {
            playUiClick();
            const preview = previewReleaseBySettings({
              ...career,
              managerSettings: settings,
            });
            if (preview.length === 0) {
              setPreviewError("No players match the current rules.");
              return;
            }
            const confirmed = window.confirm(
              `Release ${preview.length} reserve player${preview.length === 1 ? "" : "s"} using the current rules?\nThis cannot be undone.`
            );
            if (!confirmed) return;
            const result = applyReserveReleases(career, preview);
            if (!result.ok) {
              if (result.wouldBreachMinimum) {
                const force = window.confirm(
                  `${result.error}\n\nForce release anyway?`
                );
                if (!force) return;
                const forced = applyReserveReleases(career, preview, {
                  forceBelowMinimum: true,
                });
                if (forced.ok && forced.career) {
                  onUpdate(forced.career);
                  setPreviewNames([]);
                  setPreviewError(null);
                }
                return;
              }
              setPreviewError(result.error ?? "Release failed");
              return;
            }
            if (result.career) {
              onUpdate(result.career);
              setPreviewNames([]);
              setPreviewError(null);
            }
          }}
        >
          Apply Release Rules
        </GameButton>
      </div>

      {previewError && (
        <p className={`mt-2 ${TYPO.bodySm} text-amber-300`}>{previewError}</p>
      )}
      {previewNames.length > 0 && (
        <p className={`mt-2 ${TYPO.bodySm} text-pitch-300`}>
          Preview ({previewNames.length}): {previewNames.slice(0, 10).join(", ")}
          {previewNames.length > 10 ? "…" : ""}
        </p>
      )}
    </ManagerSectionCard>
  );
}
