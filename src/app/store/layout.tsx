import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Store — 27-0",
  description: "Spend Club Funds on themes, a custom kit, pitch styles, coach titles, card frames and Ball Knower mode.",
};

export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return children;
}
