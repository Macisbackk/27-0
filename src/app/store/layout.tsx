import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Store — 27-0",
  description: "Spend Club Funds on UI themes and Classic boosts.",
};

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
