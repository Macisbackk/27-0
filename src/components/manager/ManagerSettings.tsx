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
import { UI_COPY } from "@/lib/ui/copy";
import { TYPO } from "@/lib/ui/typography";
import {
  DEFAULT_MANAGER_SETTINGS,
  DEFAULT_RESERVE_DEVELOPMENT_SETTINGS,
  type ManagerAutoRenewContractYears,
  type ManagerCareer,
  type ManagerReserveDevelopmentSettings,
  type ManagerSettings,
  type MassReleaseMatchMode,
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
    | "autoOpenNextFixture"
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
    protectedFromMassReleaseIds:
      base.reserveDevelopmentSettings?.protectedFromMassReleaseIds ??
      base.reserveReleaseSettings?.protectedFromMassReleaseIds ??
      DEFAULT_RESERVE_DEVELOPMENT_SETTINGS.protectedFromMassReleaseIds,
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
    const next = { ...dev, ...patch, reserveManagementSettingsVersion: 2 };
    setPreview([]);
    setPreviewError(null);
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
        ? "No players match the current mass-release rules."
        : null
    );
  };

  const startApply = () => {
    playUiClick();
    const candidates =
      preview.length > 0
        ? preview
        : previewReleaseBySettings(careerWithSettings);
    if (candidates.length === 0) {
      setPreview([]);
      setPreviewError("No players match the current mass-release rules.");
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

  const matchMode: MassReleaseMatchMode = dev.massReleaseMatchMode ?? "all";

  return (
    <>
      <ManagerSectionCard title="Reserve Management" variant="elevated">
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
          Auto-promote by rating and mass-release rules. Preview before releasing;
          protected players are never included.
        </p>

        <div className="mt-4 space-y-5">
          <section>
            <h3 className={`${TYPO.bodySm} font-semibold text-pitch-200`}>
              Auto promote
            </h3>
            <ul className="mt-1 divide-y divide-pitch-700/50">
              <SettingsToggle
                label="Auto promote by rating"
                description={`Promote reserves at ${dev.autoPromoteRatingThreshold}+ when senior capacity allows. Off by default.`}
                on={dev.autoPromoteByRatingEnabled}
                onToggle={() =>
                  patchDev({
                    autoPromoteByRatingEnabled: !dev.autoPromoteByRatingEnabled,
                  })
                }
              />
            </ul>
            <div
              className={`mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 ${dev.autoPromoteByRatingEnabled ? "" : "opacity-50"}`}
            >
              <SettingsNumberInput
                label="Promote at rating"
                value={dev.autoPromoteRatingThreshold}
                min={70}
                max={95}
                disabled={!dev.autoPromoteByRatingEnabled}
                onChange={(autoPromoteRatingThreshold) =>
                  patchDev({ autoPromoteRatingThreshold })
                }
              />
            </div>
          </section>

          <section>
            <h3 className={`${TYPO.bodySm} font-semibold text-pitch-200`}>
              Mass release
            </h3>
            <fieldset className="mt-2">
              <legend className={`mb-2 ${TYPO.bodySm} text-pitch-400`}>
                Match mode
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {(["all", "any"] as const).map((mode) => {
                  const selected = matchMode === mode;
                  return (
                    <label
                      key={mode}
                      className={`flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-center transition ${
                        selected
                          ? "border-theme-primary/60 bg-theme-primary/15 text-theme-primary"
                          : "border-pitch-600/55 bg-pitch-900/40 text-pitch-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="massReleaseMatchMode"
                        className="sr-only"
                        checked={selected}
                        onChange={() => patchDev({ massReleaseMatchMode: mode })}
                      />
                      <span className="text-sm font-bold uppercase">
                        Match {mode}
                      </span>
                      <span className="text-[10px] text-pitch-500">
                        {mode === "all" ? "Every enabled rule" : "Any enabled rule"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <ul className="mt-3 divide-y divide-pitch-700/50">
              <SettingsToggle
                label="Release by potential"
                description={`Potential below ${dev.massReleasePotentialBelow}.`}
                on={dev.massReleaseByPotentialEnabled}
                onToggle={() =>
                  patchDev({
                    massReleaseByPotentialEnabled: !dev.massReleaseByPotentialEnabled,
                  })
                }
              />
            </ul>
            <div
              className={`mt-2 ${dev.massReleaseByPotentialEnabled ? "" : "opacity-50"}`}
            >
              <SettingsNumberInput
                label="Potential below"
                value={dev.massReleasePotentialBelow}
                min={60}
                max={95}
                disabled={!dev.massReleaseByPotentialEnabled}
                onChange={(massReleasePotentialBelow) =>
                  patchDev({ massReleasePotentialBelow })
                }
              />
            </div>

            <ul className="mt-3 divide-y divide-pitch-700/50">
              <SettingsToggle
                label="Release by rating"
                description={`Current rating below ${dev.massReleaseRatingBelow}.`}
                on={dev.massReleaseByRatingEnabled}
                onToggle={() =>
                  patchDev({
                    massReleaseByRatingEnabled: !dev.massReleaseByRatingEnabled,
                  })
                }
              />
            </ul>
            <div
              className={`mt-2 ${dev.massReleaseByRatingEnabled ? "" : "opacity-50"}`}
            >
              <SettingsNumberInput
                label="Rating below"
                value={dev.massReleaseRatingBelow}
                min={60}
                max={95}
                disabled={!dev.massReleaseByRatingEnabled}
                onChange={(massReleaseRatingBelow) =>
                  patchDev({ massReleaseRatingBelow })
                }
              />
            </div>

            <ul className="mt-3 divide-y divide-pitch-700/50">
              <SettingsToggle
                label="Release by age"
                description={`Age above ${dev.massReleaseAgeAbove}.`}
                on={dev.massReleaseByAgeEnabled}
                onToggle={() =>
                  patchDev({
                    massReleaseByAgeEnabled: !dev.massReleaseByAgeEnabled,
                  })
                }
              />
            </ul>
            <div
              className={`mt-2 ${dev.massReleaseByAgeEnabled ? "" : "opacity-50"}`}
            >
              <SettingsNumberInput
                label="Age above"
                value={dev.massReleaseAgeAbove}
                min={18}
                max={35}
                disabled={!dev.massReleaseByAgeEnabled}
                onChange={(massReleaseAgeAbove) =>
                  patchDev({ massReleaseAgeAbove })
                }
              />
            </div>
          </section>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <GameButton variant="secondary" size="sm" onClick={runPreview}>
            {UI_COPY.previewPlayers}
          </GameButton>
          <GameButton
            variant="theme"
            size="sm"
            onClick={startApply}
            disabled={preview.length === 0}
          >
            Confirm release
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
                  · Age {reserve.age} · Rating {reserve.rating} · Pot{" "}
                  {reserve.potentialRating}
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
            ? `Release ${pendingApply.length} reserve player${pendingApply.length === 1 ? "" : "s"} matching the current mass-release rules?\n\nThis cannot be undone.`
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
