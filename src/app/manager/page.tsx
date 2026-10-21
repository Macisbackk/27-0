import type { Metadata } from "next";
import { CareerApp } from "@/components/career/CareerApp";
import { StandardPageShell } from "@/components/ui/StandardPageShell";

export const metadata: Metadata = {
  title: "Manager Mode — 27-0",
  description:
    "Manage a real Super League or Championship club. Play each round in a tap, win promotion, lift the Grand Final, unlock rugby league legends and chase records.",
};

export default function ManagerPage() {
  return (
    <StandardPageShell>
      <CareerApp />
    </StandardPageShell>
  );
}
