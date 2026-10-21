import { notFound } from "next/navigation";
import MobileUiFixturesPage from "./MobileUiFixtures";

/** Internal UI fixtures — available in `next dev` only, 404 in production. */
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <MobileUiFixturesPage />;
}
