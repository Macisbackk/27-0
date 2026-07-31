"use client";

import { useState } from "react";
import { GameButton } from "@/components/ui/GameButton";
import { GameModal } from "@/components/ui/GameModal";
import { TYPO } from "@/lib/ui/typography";
import type { ManagerCareer } from "@/lib/manager/types";
import {
  applyReserveReleases,
  getReserveGrowth,
  getReserveYearsAtClub,
  previewReleaseByLowGrowth,
  previewReleaseByYearsRating,
  previewReleaseOverAge,
  previewReleaseUnderRating,
  type ReserveReleaseCandidate,
} from "@/lib/manager/managerReserveRelease";
import { playPanelClose, playUiClick } from "@/lib/sound";
import { ManagerDialog } from "@/components/manager/ManagerDialog";

type ReleaseToolId = "rating" | "age" | "growth" | "progress";

interface ManagerReserveReleaseToolsModalProps {
  open: boolean;
  career: ManagerCareer;
  onClose: () => void;
  onUpdate: (career: ManagerCareer) => void;
  onMessage?: (message: string) => void;
}

function CandidatePreview({
  career,
  candidates,
}: {
  career: ManagerCareer;
  candidates: ReserveReleaseCandidate[] | undefined;
}) {
  if (!candidates) return null;
  if (candidates.length === 0) {
    return (
      <p className={`mt-1.5 ${TYPO.bodySm} text-pitch-500`}>No matching players</p>
    );
  }
  return (
    <ul className="mt-1.5 space-y-1">
      {candidates.map(({ reserve, reason }) => {
        const years = getReserveYearsAtClub(career, reserve);
        const growth = getReserveGrowth(reserve);
        return (
          <li
            key={reserve.id}
            className={`rounded-md border border-pitch-700/40 bg-pitch-950/50 px-2.5 py-1.5 ${TYPO.bodySm}`}
          >
            <span className="font-medium text-white">{reserve.name}</span>
            <span className="text-pitch-400">
              {" "}
              · Age {reserve.age} · Rating {reserve.rating} · {years}y · Growth{" "}
              {growth >= 0 ? "+" : ""}
              {growth}
            </span>
            <span className="block text-pitch-500">{reason}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function ManagerReserveReleaseToolsModal({
  open,
  career,
  onClose,
  onUpdate,
  onMessage,
}: ManagerReserveReleaseToolsModalProps) {
  const [bulkRating, setBulkRating] = useState(55);
  const [bulkAge, setBulkAge] = useState(24);
  const [growthYears, setGrowthYears] = useState(2);
  const [growthMin, setGrowthMin] = useState(3);
  const [progressYears, setProgressYears] = useState(2);
  const [progressRating, setProgressRating] = useState(60);
  const [previews, setPreviews] = useState<
    Partial<Record<ReleaseToolId, ReserveReleaseCandidate[]>>
  >({});
  const [pending, setPending] = useState<{
    tool: ReleaseToolId;
    candidates: ReserveReleaseCandidate[];
    label: string;
    forceBelowMinimum: boolean;
  } | null>(null);

  const getCandidates = (tool: ReleaseToolId): ReserveReleaseCandidate[] => {
    switch (tool) {
      case "rating":
        return previewReleaseUnderRating(career, bulkRating);
      case "age":
        return previewReleaseOverAge(career, bulkAge);
      case "growth":
        return previewReleaseByLowGrowth(career, growthYears, growthMin);
      case "progress":
        return previewReleaseByYearsRating(career, progressYears, progressRating);
    }
  };

  const toolLabel = (tool: ReleaseToolId): string => {
    switch (tool) {
      case "rating":
        return `rated under ${bulkRating}`;
      case "age":
        return `over age ${bulkAge}`;
      case "growth":
        return `after ${growthYears} years if growth under ${growthMin}`;
      case "progress":
        return `after ${progressYears} years if rating under ${progressRating}`;
    }
  };

  const handlePreview = (tool: ReleaseToolId) => {
    playUiClick();
    const candidates = getCandidates(tool);
    setPreviews((prev) => ({ ...prev, [tool]: candidates }));
    onMessage?.(
      candidates.length === 0
        ? `No reserves match: ${toolLabel(tool)}`
        : `Preview ${candidates.length} player${candidates.length === 1 ? "" : "s"} (${toolLabel(tool)})`
    );
  };

  const handleRelease = (tool: ReleaseToolId) => {
    playUiClick();
    const candidates = previews[tool] ?? getCandidates(tool);
    if (candidates.length === 0) {
      setPreviews((prev) => ({ ...prev, [tool]: [] }));
      onMessage?.(`No reserves match: ${toolLabel(tool)}`);
      return;
    }
    setPreviews((prev) => ({ ...prev, [tool]: candidates }));
    setPending({
      tool,
      candidates,
      label: toolLabel(tool),
      forceBelowMinimum: false,
    });
  };

  const confirmPending = () => {
    if (!pending) return;
    const result = applyReserveReleases(career, pending.candidates, {
      forceBelowMinimum: pending.forceBelowMinimum,
    });
    if (!result.ok && result.wouldBreachMinimum) {
      setPending({ ...pending, forceBelowMinimum: true });
      return;
    }
    if (!result.ok || !result.career) {
      onMessage?.(result.error ?? "Release failed");
      setPending(null);
      return;
    }
    onUpdate(result.career);
    setPreviews((prev) => ({ ...prev, [pending.tool]: [] }));
    setPending(null);
    onMessage?.(
      `Released ${result.released} reserve player${result.released === 1 ? "" : "s"}`
    );
  };

  const handleClose = () => {
    playPanelClose();
    setPending(null);
    onClose();
  };

  return (
    <>
      <GameModal open={open} onClose={handleClose} labelledBy="release-tools-title">
        <h2 id="release-tools-title" className={TYPO.cardTitle}>
          Release Tools
        </h2>
        <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
          Preview each option independently, then release only the previewed
          players. Called-up matchday players are skipped.
        </p>

        <div className="mt-4 space-y-4">
          <section className="rounded-lg border border-pitch-700/45 bg-pitch-950/40 p-3">
            <h3 className={`${TYPO.bodySm} font-semibold text-pitch-200`}>
              Release by Rating
            </h3>
            <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
              Release reserves rated under{" "}
              <input
                type="number"
                min={40}
                max={99}
                value={bulkRating}
                onChange={(e) => setBulkRating(Number(e.target.value))}
                className="mx-1 w-14 rounded border border-pitch-600 bg-pitch-900/60 px-2 py-0.5 text-sm text-white"
              />
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <GameButton variant="secondary" size="sm" onClick={() => handlePreview("rating")}>
                Preview
              </GameButton>
              <GameButton variant="danger" size="sm" onClick={() => handleRelease("rating")}>
                Release
              </GameButton>
              {previews.rating && (
                <span className={`${TYPO.bodySm} self-center text-pitch-400`}>
                  {previews.rating.length} affected
                </span>
              )}
            </div>
            <CandidatePreview career={career} candidates={previews.rating} />
          </section>

          <section className="rounded-lg border border-pitch-700/45 bg-pitch-950/40 p-3">
            <h3 className={`${TYPO.bodySm} font-semibold text-pitch-200`}>
              Release by Age
            </h3>
            <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
              Release reserves over age{" "}
              <input
                type="number"
                min={16}
                max={40}
                value={bulkAge}
                onChange={(e) => setBulkAge(Number(e.target.value))}
                className="mx-1 w-14 rounded border border-pitch-600 bg-pitch-900/60 px-2 py-0.5 text-sm text-white"
              />
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <GameButton variant="secondary" size="sm" onClick={() => handlePreview("age")}>
                Preview
              </GameButton>
              <GameButton variant="danger" size="sm" onClick={() => handleRelease("age")}>
                Release
              </GameButton>
              {previews.age && (
                <span className={`${TYPO.bodySm} self-center text-pitch-400`}>
                  {previews.age.length} affected
                </span>
              )}
            </div>
            <CandidatePreview career={career} candidates={previews.age} />
          </section>

          <section className="rounded-lg border border-pitch-700/45 bg-pitch-950/40 p-3">
            <h3 className={`${TYPO.bodySm} font-semibold text-pitch-200`}>
              Release by Development
            </h3>
            <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
              Release players after{" "}
              <input
                type="number"
                min={1}
                max={6}
                value={growthYears}
                onChange={(e) => setGrowthYears(Number(e.target.value))}
                className="mx-1 w-12 rounded border border-pitch-600 bg-pitch-900/60 px-2 py-0.5 text-sm text-white"
              />{" "}
              years if growth is under{" "}
              <input
                type="number"
                min={0}
                max={20}
                value={growthMin}
                onChange={(e) => setGrowthMin(Number(e.target.value))}
                className="mx-1 w-12 rounded border border-pitch-600 bg-pitch-900/60 px-2 py-0.5 text-sm text-white"
              />
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <GameButton variant="secondary" size="sm" onClick={() => handlePreview("growth")}>
                Preview
              </GameButton>
              <GameButton variant="danger" size="sm" onClick={() => handleRelease("growth")}>
                Release
              </GameButton>
              {previews.growth && (
                <span className={`${TYPO.bodySm} self-center text-pitch-400`}>
                  {previews.growth.length} affected
                </span>
              )}
            </div>
            <CandidatePreview career={career} candidates={previews.growth} />
          </section>

          <section className="rounded-lg border border-pitch-700/45 bg-pitch-950/40 p-3">
            <h3 className={`${TYPO.bodySm} font-semibold text-pitch-200`}>
              Release by Progress
            </h3>
            <p className={`mt-1 ${TYPO.bodySm} text-pitch-400`}>
              Release players after{" "}
              <input
                type="number"
                min={1}
                max={6}
                value={progressYears}
                onChange={(e) => setProgressYears(Number(e.target.value))}
                className="mx-1 w-12 rounded border border-pitch-600 bg-pitch-900/60 px-2 py-0.5 text-sm text-white"
              />{" "}
              years if rating is under{" "}
              <input
                type="number"
                min={40}
                max={90}
                value={progressRating}
                onChange={(e) => setProgressRating(Number(e.target.value))}
                className="mx-1 w-14 rounded border border-pitch-600 bg-pitch-900/60 px-2 py-0.5 text-sm text-white"
              />
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <GameButton variant="secondary" size="sm" onClick={() => handlePreview("progress")}>
                Preview
              </GameButton>
              <GameButton variant="danger" size="sm" onClick={() => handleRelease("progress")}>
                Release
              </GameButton>
              {previews.progress && (
                <span className={`${TYPO.bodySm} self-center text-pitch-400`}>
                  {previews.progress.length} affected
                </span>
              )}
            </div>
            <CandidatePreview career={career} candidates={previews.progress} />
          </section>
        </div>

        <GameButton variant="secondary" className="mt-4 w-full" onClick={handleClose}>
          Close
        </GameButton>
      </GameModal>

      <ManagerDialog
        open={pending !== null}
        variant="confirm"
        destructive
        title="Confirm reserve releases"
        message={
          pending
            ? [
                `Release ${pending.candidates.length} reserve player${pending.candidates.length === 1 ? "" : "s"} (${pending.label})?`,
                pending.forceBelowMinimum
                  ? "This would drop the reserve squad below the minimum listing size."
                  : "",
              ]
                .filter(Boolean)
                .join("\n\n")
            : ""
        }
        confirmLabel={pending?.forceBelowMinimum ? "Force release" : "Release"}
        cancelLabel="Cancel"
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      />
    </>
  );
}
