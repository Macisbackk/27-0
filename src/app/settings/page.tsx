import type { Metadata } from "next";
import { SettingsPanel } from "@/components/SettingsPanel";
import { StandardPageShell } from "@/components/ui/StandardPageShell";

export const metadata: Metadata = {
  title: "Settings — 27-0",
  description: "Sound, theme, account and saved progress.",
};

export default function SettingsPage() {
  return (
    <StandardPageShell compact>
      <SettingsPanel />
    </StandardPageShell>
  );
}
