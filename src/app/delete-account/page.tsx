import type { Metadata } from "next";
import { DeleteAccountPanel } from "@/components/DeleteAccountPanel";
import { StandardPageShell } from "@/components/ui/StandardPageShell";

export const metadata: Metadata = {
  title: "Delete account — 27-0",
  description: "Permanently delete your 27-0 account and the data stored with it.",
};

export default function DeleteAccountPage() {
  return (
    <StandardPageShell compact>
      <DeleteAccountPanel />
    </StandardPageShell>
  );
}
