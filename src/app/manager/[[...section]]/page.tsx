/** Static paths for Capacitor / `output: "export"` builds. */
export function generateStaticParams() {
  const sections = [
    [],
    ["hub"],
    ["inbox"],
    ["squad"],
    ["squad", "tactics"],
    ["reserves"],
    ["contracts"],
    ["transfers"],
    ["club"],
    ["fixtures"],
    ["across-league"],
    ["stats"],
    ["settings"],
    ["new"],
  ] as const;

  return sections.map((section) => ({ section: [...section] }));
}

/**
 * URL endpoint only — UI lives in `../layout.tsx` so the Manager shell does
 * not remount when catch-all section params change.
 */
export default function ManagerSectionPage() {
  return null;
}
