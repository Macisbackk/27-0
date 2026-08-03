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
  DEFAULT_RESERVE_DEVELOPMENT_SETTINGS,
  type ManagerAutoRenewContractYears,
  type ManagerCareer,
  type ManagerReserveDevelopmentSettings,
  type ManagerSettings,
} from "@/lib/manager/types";
import { GameButton } from "@/components/ui/GameButton";
import { ManagerDialog } from "@/components/manager/ManagerDialog";
import {
  applyReserveReleases,
  previewReleaseBySettings,
  type ReserveReleaseCandidate,
} from "@/lib/manager/managerReserveRelease";

interface ManagerSettingsProps {
  career: ManagerCareer;
  onUpdate: (career: ManagerCareer) => void;
}

const CONTRACT_YEAR_OPTIONS: ManagerAutoRenewContractYears[] = [1, 2, 3, 4];

const TOGGLE_OPTIONS: {
  key: keyof Omit<
    ManagerSettings,
    | "autoRenewContractYears"
    | "reserveReleaseSettings"
    | "reserveDevelopmentSettings"
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

export function resolveManagerSettings(career: ManagerCareer): ManagerSettings {
  const base = career.managerSettings ?? { ...DEFAULT_MANAGER_SETTINGS };
  const reserveDevelopmentSettings: ManagerReserveDevelopmentSettings = {
    ...DEFAULT_RESERVE_DEVELOPMENT_SETTINGS,
    ...base.reserveDevelopmentSettings,
    ...(base.reserveReleaseSettings ?? {}),
  };
  return {
    ...DEFAULT_MANAGER_SETTINGS,
    ...base,
    reserveDevelopmentSettings,
    reserveReleaseSettings: reserveDevelopmentSettings,
  };
}

function getSettings(career: ManagerCareer): ManagerSettings {
  return resolveManagerSettings(career);
}

export function patchManagerCareerSettings(
  career: ManagerCareer,
  onUpdate: (career: ManagerCareer) => void,
  settings: ManagerSettings,
  patch: Partial<ManagerSettings>
): void {
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
}

function SettingsToggle({
  label,
  description,
  on,
  onToggle,
}: {
  label: string;
  description: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className={`${TYPO.bodySm} font-semibold text-white`}>{label}</p>
        <p className={`mt-0.5 ${TYPO.bodySm} text-pitch-500`}>{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onToggle}
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
}

function SettingsNumberInput({
  label,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={`${TYPO.bodySm} text-pitch-400 ${disabled ? "opacity-50" : ""}`}
    >
      {label}
      <input
        type="number"
        min={min}
        max={max}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || min)}
        className="mt-1 w-full rounded-md border border-pitch-600/60 bg-pitch-950 px-2 py-1.5 text-white disabled:cursor-not-allowed"
      />
    </label>
  );
}

export function ManagerSettings({ career, onUpdate }: ManagerSettingsProps) {
  const settings = getSettings(career);

  const patchSettings = (patch: Partial<ManagerSettings>) => {
    patchManagerCareerSettings(career, onUpdate, settings, patch);
  };

  return (
    <ManagerPage>
      <ManagerSection width="narrow">
        <GameSectionHeader
          size="page"
          label="Preferences"
          title="Settings"
          subtitle="Preferences now live on Contracts, Reserves, and Club."
        />
        <p className={`${CARD.base} ${SPACING.cardPadding} ${TYPO.bodySm} text-pitch-400`}>
          Contract renewals are under <span className="text-white">Contracts → Settings</span>.
          Reserve rules are under <span className="text-white">Reserves → Settings</span>.
          Matchday toggles are on the <span className="text-white">Club</span> page.
        </p>
        <GameplaySettingsCard settings={settings} onPatch={patchSettings} />
      </ManagerSection>
    </ManagerPage>
  );
}

export function ContractSettingsCard({
  settings,
  onPatch,
}: {
  settings: ManagerSettings;
  onPatch: (patch: Partial<ManagerSettings>) => void;
}) {
  return (
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
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                        onPatch({ autoRenewContractYears: years })
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
  );
}

export function GameplaySettingsCard({
  settings,
  onPatch,
}: {
  settings: ManagerSettings;
  onPatch: (patch: Partial<ManagerSettings>) => void;
}) {
  return (
        <ManagerSectionCard title="Gameplay" variant="elevated">
          <ul className={`mt-2 divide-y divide-pitch-700/50`}>
            {TOGGLE_OPTIONS.map((option) => {
              const on = settings[option.key];
              return (
                <SettingsToggle
                  key={option.key}
                  label={option.label}
                  description={option.description}
                  on={on}
                  onToggle={() => onPatch({ [option.key]: !on })}
                />
              );
            })}
          </ul>
        </ManagerSectionCard>
  );
}

export function ReserveDevelopmentSettingsPanel({
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
  return (
    <ReserveDevelopmentSettingsCard
      career={career}
      settings={settings}
      onPatch={onPatch}
      onUpdate={onUpdate}
    />
  );
}

function ReserveDevelopmentSettingsCard({
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
  const dev = {
    ...DEFAULT_RESERVE_DEVELOPMENT_SETTINGS,
    ...settings.reserveDevelopmentSettings,
  };
  const [preview, setPreview] = useState<ReserveReleaseCandidate[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [pendingApply, setPendingApply] = useState<
    ReserveReleaseCandidate[] | null
  >(null);
  const [pendingForceApply, setPendingForceApply] = useState<
    ReserveReleaseCandidate[] | null
  >(null);

  const careerWithSettings = { ...career, managerSettings: settings };

  const patchDev = (patch: Partial<ManagerReserveDevelopmentSettings>) => {
    const next = { ...dev, ...patch };
    onPatch({
      reserveDevelopmentSettings: next,
      reserveReleaseSettings: next,
    });
  };

  const runPreview = () => {
    playUiClick();
    const candidates = previewReleaseBySettings(careerWithSettings);
    setPreview(candidates);
    setPreviewError(
      candidates.length === 0
        ? "No players match the current development rules."
        : null
    );
  };

  const startApply = () => {
    playUiClick();
    const candidates = previewReleaseBySettings(careerWithSettings);
    if (candidates.length === 0) {
      setPreview([]);
      setPreviewError("No players match the current development rules.");
      return;
    }
    setPreview(candidates);
    setPreviewError(null);
    setPendingApply(candidates);
  };

  const confirmApply = (candidates: ReserveReleaseCandidate[], force = false) => {
    const result = applyReserveReleases(career, candidates, {
      forceBelowMinimum: force,
    });
    if (!result.ok) {
      if (result.wouldBreachMinimum) {
        setPendingForceApply(candidates);
        return;
      }
      setPreviewError(result.error ?? "Release failed");
      return;
    }
    if (result.career) {
      onUpdate(result.career);
      setPreview([]);
      setPreviewError(null);
    }
  };

  return (
    <>
      <ManagerSectionCard title="Reserve Development Settings" variant="elevated">
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
          Time- and progress-based rules for the reserve listing. Preview before
          releasing; flags also appear on reserve cards and in monthly reports.
        </p>

        <div className="mt-4 space-y-5">
          <section>
            <h3 className={`${TYPO.bodySm} font-semibold text-pitch-200`}>
              Release rules
            </h3>
            <ul className="mt-1 divide-y divide-pitch-700/50">
              <SettingsToggle
                label="Release after years if rating not reached"
                description={`Release if still below ${dev.releaseIfRatingBelow} rating after ${dev.releaseAfterYears} year${dev.releaseAfterYears === 1 ? "" : "s"}.`}
                on={dev.releaseAfterYearsEnabled}
                onToggle={() =>
                  patchDev({
                    releaseAfterYearsEnabled: !dev.releaseAfterYearsEnabled,
                  })
                }
              />
            </ul>
            <div
              className={`mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 ${dev.releaseAfterYearsEnabled ? "" : "opacity-50"}`}
            >
              <SettingsNumberInput
                label="Years at club before check"
                value={dev.releaseAfterYears}
                min={1}
                max={6}
                disabled={!dev.releaseAfterYearsEnabled}
                onChange={(releaseAfterYears) => patchDev({ releaseAfterYears })}
              />
              <SettingsNumberInput
                label="Rating must reach"
                value={dev.releaseIfRatingBelow}
                min={40}
                max={90}
                disabled={!dev.releaseAfterYearsEnabled}
                onChange={(releaseIfRatingBelow) =>
                  patchDev({ releaseIfRatingBelow })
                }
              />
            </div>

            <ul className="mt-3 divide-y divide-pitch-700/50">
              <SettingsToggle
                label="Release after years if growth is less than"
                description={`Release if growth is below +${dev.releaseIfGrowthBelow} after ${dev.growthCheckAfterYears} year${dev.growthCheckAfterYears === 1 ? "" : "s"}.`}
                on={dev.releaseIfGrowthBelowEnabled}
                onToggle={() =>
                  patchDev({
                    releaseIfGrowthBelowEnabled: !dev.releaseIfGrowthBelowEnabled,
                  })
                }
              />
            </ul>
            <div
              className={`mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 ${dev.releaseIfGrowthBelowEnabled ? "" : "opacity-50"}`}
            >
              <SettingsNumberInput
                label="Years at club before growth check"
                value={dev.growthCheckAfterYears}
                min={1}
                max={6}
                disabled={!dev.releaseIfGrowthBelowEnabled}
                onChange={(growthCheckAfterYears) =>
                  patchDev({ growthCheckAfterYears })
                }
              />
              <SettingsNumberInput
                label="Minimum growth (points)"
                value={dev.releaseIfGrowthBelow}
                min={0}
                max={20}
                disabled={!dev.releaseIfGrowthBelowEnabled}
                onChange={(releaseIfGrowthBelow) =>
                  patchDev({ releaseIfGrowthBelow })
                }
              />
            </div>
          </section>

          <section>
            <h3 className={`${TYPO.bodySm} font-semibold text-pitch-200`}>
              Review flags
            </h3>
            <ul className="divide-y divide-pitch-700/50">
              <SettingsToggle
                label="Flag for full-time deal if rating reaches"
                description={`Promote candidates at ${dev.fullTimeRatingThreshold}+ rating.`}
                on={dev.flagForFullTimeEnabled}
                onToggle={() =>
                  patchDev({
                    flagForFullTimeEnabled: !dev.flagForFullTimeEnabled,
                  })
                }
              />
            </ul>
            <div
              className={`mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 ${dev.flagForFullTimeEnabled ? "" : "opacity-50"}`}
            >
              <SettingsNumberInput
                label="Full-time rating threshold"
                value={dev.fullTimeRatingThreshold}
                min={60}
                max={90}
                disabled={!dev.flagForFullTimeEnabled}
                onChange={(fullTimeRatingThreshold) =>
                  patchDev({ fullTimeRatingThreshold })
                }
              />
            </div>
          </section>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <GameButton variant="secondary" size="sm" onClick={runPreview}>
            Preview releases
          </GameButton>
          <GameButton variant="theme" size="sm" onClick={startApply}>
            Apply now
          </GameButton>
        </div>

        {previewError && (
          <p className={`mt-2 ${TYPO.bodySm} text-amber-300`}>{previewError}</p>
        )}
        {preview.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {preview.slice(0, 10).map(({ reserve, reason }) => (
              <li
                key={reserve.id}
                className={`rounded-lg border border-pitch-700/45 bg-pitch-950/50 px-3 py-2 ${TYPO.bodySm}`}
              >
                <span className="font-medium text-white">{reserve.name}</span>
                <span className="text-pitch-400">
                  {" "}
                  · Age {reserve.age} · Rating {reserve.rating}
                </span>
                <span className={`block text-pitch-500`}>{reason}</span>
              </li>
            ))}
            {preview.length > 10 && (
              <li className={`${TYPO.bodySm} text-pitch-500`}>
                …and {preview.length - 10} more
              </li>
            )}
          </ul>
        )}
      </ManagerSectionCard>

      <ManagerDialog
        open={pendingApply !== null}
        variant="confirm"
        destructive
        title="Confirm reserve releases"
        message={
          pendingApply
            ? `Release ${pendingApply.length} reserve player${pendingApply.length === 1 ? "" : "s"} matching the current development rules?\n\nThis cannot be undone.`
            : ""
        }
        confirmLabel="Release"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (pendingApply) confirmApply(pendingApply);
          setPendingApply(null);
        }}
        onCancel={() => setPendingApply(null)}
      />

      <ManagerDialog
        open={pendingForceApply !== null}
        variant="confirm"
        destructive
        title="Below minimum squad size"
        message={
          pendingForceApply
            ? `Releasing ${pendingForceApply.length} player${pendingForceApply.length === 1 ? "" : "s"} would drop the reserve squad below the minimum listing size.\n\nForce release anyway?`
            : ""
        }
        confirmLabel="Force release"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (pendingForceApply) confirmApply(pendingForceApply, true);
          setPendingForceApply(null);
        }}
        onCancel={() => setPendingForceApply(null)}
      />
    </>
  );
}
