import type { Metadata } from "next";
import { CareerApp } from "@/components/career/CareerApp";
import { StandardPageShell } from "@/components/ui/StandardPageShell";

export const metadata: Metadata = {
  title: "Manager Mode — 27-0",
  description:
    "Run a real Super League or Championship club. Win trophies and unlock legends.",
};

export default function ManagerPage() {
  return (
    <StandardPageShell>
      <CareerApp />
    </StandardPageShell>
  );
}
