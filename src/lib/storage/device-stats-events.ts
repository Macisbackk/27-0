/** Fired by the stats save functions; device-stats-cloud.ts pushes the cloud copy shortly after. */
export const DEVICE_STATS_CHANGED_EVENT = "27-0-device-stats-changed";

/** Notify the cloud sync that a device stats key changed (safe anywhere, any time). */
export function notifyDeviceStatsChanged(): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(DEVICE_STATS_CHANGED_EVENT));
  } catch {
    // no-op
  }
}
