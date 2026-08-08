import ManagerSectionClient from "./ManagerSectionClient";

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

export default function ManagerSectionPage() {
  return <ManagerSectionClient />;
}
