import type { ManagerCareer } from "./types";
import { MANAGER_SAVE_VERSION } from "./managerSaveVersion";
import { hydrateManagerCareer } from "./managerState";

export interface ManagerSaveExportPayload {
  type: "27-0-manager-career";
  version: number;
  exportedAt: string;
  career: ManagerCareer;
}

export function exportManagerCareer(career: ManagerCareer): string {
  const payload: ManagerSaveExportPayload = {
    type: "27-0-manager-career",
    version: MANAGER_SAVE_VERSION,
    exportedAt: new Date().toISOString(),
    career: { ...career, saveVersion: MANAGER_SAVE_VERSION },
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadManagerCareerExport(career: ManagerCareer): void {
  const json = exportManagerCareer(career);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const safeClub = career.club.replace(/\s+/g, "-").toLowerCase();
  anchor.href = url;
  anchor.download = `27-0-manager-${safeClub}-s${career.seasonYear}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function parseManagerCareerImport(raw: string): ManagerCareer {
  const parsed = JSON.parse(raw) as Partial<ManagerSaveExportPayload> & ManagerCareer;
  if (parsed.type === "27-0-manager-career" && parsed.career) {
    return hydrateManagerCareer({
      ...parsed.career,
      saveVersion: parsed.version ?? MANAGER_SAVE_VERSION,
    });
  }
  if (typeof parsed.club === "string" && typeof parsed.seasonYear === "number") {
    return hydrateManagerCareer(parsed as ManagerCareer);
  }
  throw new Error("Unrecognised save file format");
}

export async function importManagerCareerFromFile(
  file: File
): Promise<ManagerCareer> {
  const text = await file.text();
  return parseManagerCareerImport(text);
}
