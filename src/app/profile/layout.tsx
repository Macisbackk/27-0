import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coach Profile — 27-0",
  description: "Your coach profile, records and achievements.
===",
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
