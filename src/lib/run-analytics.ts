import { isSupabaseConfigured, supabase } from "./supabase";
import { GAME_VERSION } from "../../data/version";

/**
 * Anonymous run analytics (v1.70): a "start" row when a run begins and a "finish" row with
 * the league record when its regular season ends. Starts with no finish are abandoned runs.
 * Rows hold a random per-device id, never an account, and can't be read back from the app
 * (supabase/migrations/20261104090000_run_events.sql). Fire-and-forget: never blocks or throws.
 */
const DEVICE_KEY = "27-0-analytics-device";
const SENT_KEY = "27-0-analytics-sent";
const SENT_CAP = 60;

export type RunEventKind = string;

function deviceId(): string | null {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id || !/^[a-z0-9-]{8,64}$/.test(id)) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `d-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Remember what was sent so a reload or a resumed run doesn't send it twice. */
function markSent(key: string): boolean {
  try {
    const raw = localStorage.getItem(SENT_KEY);
    const list: string[] = raw ? (JSON.parse(raw) as string[]).filter((x) => typeof x === "string") : [];
    if (list.includes(key)) return false;
    list.push(key);
    localStorage.setItem(SENT_KEY, JSON.stringify(list.slice(-SENT_CAP)));
    return true;
  } catch {
    return true;
  }
}

/** Analytics kind for a run: classic, era, ball-knower, daily, weekly or side-<mode>. Exported for tests. */
export function runEventKind(input: {
  era: boolean;
  hard: boolean;
  daily: boolean;
  weekly: boolean;
  side?: string | null;
}): RunEventKind {
  if (input.daily) return "daily";
  if (input.weekly) return "weekly";
  if (input.side) return `side-${input.side}`.replace(/[^a-z0-9-]/g, "-").slice(0, 40);
  if (input.era) return input.hard ? "era-hard" : "era";
  return input.hard ? "ball-knower" : "classic";
}

export function logRunEvent(
  runId: string,
  event: "start" | "finish",
  kind: RunEventKind,
  result?: { wins: number; losses: number; perfect: boolean }
): void {
  if (typeof window === "undefined" || !isSupabaseConfigured || !runId) return;
  const device = deviceId();
  if (!device || !markSent(`${runId}:${event}`)) return;
  const clamp = (n: number) => Math.max(0, Math.min(40, Math.round(n)));
  const row = {
    device_id: device,
    run_id: runId.slice(0, 120),
    event,
    kind,
    version: GAME_VERSION,
    wins: result ? clamp(result.wins) : null,
    losses: result ? clamp(result.losses) : null,
    perfect: result ? result.perfect : null,
  };
  try {
    void supabase
      .from("run_events")
      .upsert(row, { onConflict: "device_id,run_id,event", ignoreDuplicates: true })
      .then(
        () => undefined,
        () => undefined
      );
  } catch {
    // analytics must never affect the game
  }
}
