/** Log validation issues in development only — never throws in production. */
export function devWarn(scope: string, message: string, detail?: unknown): void {
  if (process.env.NODE_ENV !== "development") return;
  const prefix = `[27-0 stats:${scope}]`;
  if (detail !== undefined) {
    console.warn(prefix, message, detail);
  } else {
    console.warn(prefix, message);
  }
}

export function devWarnMany(
  scope: string,
  issues: string[],
  detail?: unknown
): void {
  if (issues.length === 0) return;
  for (const issue of issues) {
    devWarn(scope, issue, detail);
  }
}
