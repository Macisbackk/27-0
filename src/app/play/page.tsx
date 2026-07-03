import { redirect } from "next/navigation";
import { PlayPageClient } from "./PlayPageClient";

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{
    difficulty?: string;
    cup?: string;
    era?: string;
    eraCup?: string;
    joeMellor?: string;
    superSamHallas?: string;
    draft?: string;
    fantasy?: string;
  }>;
}) {
  const params = await searchParams;

  const isHiddenMode =
    params.joeMellor === "1" || params.superSamHallas === "1";

  if (
    !isHiddenMode &&
    (params.cup === "1" ||
      params.eraCup === "1" ||
      params.fantasy === "1" ||
      params.draft === "1" ||
      params.difficulty === "hard")
  ) {
    redirect("/play");
  }

  return (
    <PlayPageClient
      params={{
        difficulty: params.difficulty,
        era: params.era,
        joeMellor: params.joeMellor,
        superSamHallas: params.superSamHallas,
      }}
    />
  );
}
