"use client";

import { useEffect, useMemo, useState } from "react";
import { BALL_KNOWER_ID } from "@/lib/cosmetics";
import { ownsCosmetic } from "@/lib/storage/cosmetics-store";
import { useRouter, useSearchParams } from "next/navigation";
import { GameStarter } from "@/components/GameStarter";
import {
  getDailyChallengeHref,
  getDailyChallengeScenario,
  isDailyChallengeActive,
} from "@/lib/daily-challenge";
import {
  getWeeklyChallengeHref,
  getWeeklyChallengeScenario,
  isWeeklyChallengeActive,
} from "@/lib/weekly-challenge";
import { getPlayPageTitle } from "@/lib/mode-labels";
import { isNormalEraMode } from "@/lib/play-links";
import type { GameDifficulty, GameMode } from "@/lib/types";
import { SHOW_DAILY_CHALLENGE_UI } from "@/lib/feature-flags";
import { challengeBannerText, decodeChallenge } from "@/lib/challenge-link";
import { getChallengeEraMode, getChallengeGate } from "@/lib/challenge-run";
import { ChallengeLinkNotice } from "@/components/ChallengeLinkNotice";
import { getOneClubBySlug } from "@/lib/game/one-club";
import {
  DAILY_ARCHIVE_PAGE,
  getDailyArchiveScenario,
  isDailyArchiveDateKey,
} from "@/lib/daily-archive";
import { MODES_PAGE, sideModeKey, type SideMode } from "@/lib/play-side-modes";

export function PlayPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const difficultyParam = searchParams.get("difficulty");
  const cup = searchParams.get("cup");
  const era = searchParams.get("era");
  const eraCup = searchParams.get("eraCup");
  const joeMellor = searchParams.get("joeMellor");
  const superSamHallas = searchParams.get("superSamHallas");
  const draft = searchParams.get("draft");
  const fantasy = searchParams.get("fantasy");
  const daily = searchParams.get("daily");
  const weekly = searchParams.get("weekly");
  // "Challenge a mate" link: wins over every other flag in the URL.
  const challengeParam = searchParams.get("challenge");
  const challenge = useMemo(() => (challengeParam ? decodeChallenge(challengeParam) : null), [challengeParam]);
  const hasChallengeParam = challengeParam !== null;
  // Ball Knower (Store): Classic with every rating hidden. null = still checking ownership.
  const wantsBallKnower =
    searchParams.get("bk") === "1" && daily !== "1" && weekly !== "1" && !hasChallengeParam;
  const [ballKnower, setBallKnower] = useState<boolean | null>(wantsBallKnower ? null : false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!wantsBallKnower) {
      setBallKnower(false);
      return;
    }
    const owned = ownsCosmetic(BALL_KNOWER_ID);
    setBallKnower(owned);
    if (!owned) router.replace("/store");
  }, [wantsBallKnower, router]);

  const wantsSuperSamHallas = superSamHallas === "1";
  const wantsJoeMellor = joeMellor === "1" && !wantsSuperSamHallas;
  const isHiddenMode = wantsJoeMellor || wantsSuperSamHallas;
  const isDaily =
    SHOW_DAILY_CHALLENGE_UI && !hasChallengeParam && isDailyChallengeActive({ daily });
  const dailyScenario = isDaily ? getDailyChallengeScenario() : null;
  // The Daily wins if both flags are set (GameStarter does the same).
  const isWeekly =
    SHOW_DAILY_CHALLENGE_UI && !isDaily && !hasChallengeParam && isWeeklyChallengeActive({ weekly });
  const weeklyScenario = isWeekly ? getWeeklyChallengeScenario() : null;

  // v1.19 side modes (entries on /modes). Never combined with the Daily / Weekly / hidden modes.
  const oneClubParam = searchParams.get("oneclub");
  const gauntletParam = searchParams.get("gauntlet");
  const archiveParam = searchParams.get("archive");
  const sideModeAllowed = !hasChallengeParam && !isDaily && !isWeekly && !isHiddenMode && !wantsBallKnower;
  const oneClubOption = sideModeAllowed && oneClubParam ? getOneClubBySlug(oneClubParam) : null;
  const archiveKey =
    sideModeAllowed && SHOW_DAILY_CHALLENGE_UI && isDailyArchiveDateKey(archiveParam) ? archiveParam : null;
  const archiveScenario = archiveKey ? getDailyArchiveScenario(archiveKey) : null;
  const archiveEra = archiveScenario ? archiveScenario.eraMode : null;
  const sideMode: SideMode | null = oneClubOption
    ? { kind: "one-club", club: oneClubOption.club }
    : archiveKey
      ? { kind: "daily-archive", dateKey: archiveKey }
      : sideModeAllowed && gauntletParam === "1"
        ? { kind: "gauntlet" }
        : null;
  const badSideModeLink =
    sideModeAllowed && ((oneClubParam !== null && !oneClubOption) || (archiveParam !== null && !archiveKey));

  useEffect(() => {
    // Unknown club / a Daily outside the archive window: back to the list to pick again.
    if (badSideModeLink) {
      router.replace(oneClubParam !== null && !oneClubOption ? MODES_PAGE : DAILY_ARCHIVE_PAGE);
      return;
    }
    if (archiveKey && archiveEra !== null) {
      const currentEra = searchParams.get("era") === "1";
      if (archiveEra !== currentEra) {
        router.replace(`/play?archive=${archiveKey}${archiveEra ? "&era=1" : ""}`);
        return;
      }
    }
    if (!SHOW_DAILY_CHALLENGE_UI && (daily === "1" || weekly === "1")) {
      router.replace("/play");
      return;
    }
    if (
      !isHiddenMode &&
      (cup === "1" ||
        eraCup === "1" ||
        fantasy === "1" ||
        draft === "1" ||
        difficultyParam === "hard")
    ) {
      router.replace("/play");
      return;
    }
    // Keep daily URL era flag aligned with today's scenario.
    if (isDaily && dailyScenario) {
      const expectedEra = getDailyChallengeHref().includes("era=1");
      const currentEra = searchParams.get("era") === "1";
      if (expectedEra !== currentEra) {
        router.replace(getDailyChallengeHref());
      }
    }
    // Same for the Weekly: Current/Era comes from the week's rule, not the URL.
    if (isWeekly && weeklyScenario) {
      const expectedEra = getWeeklyChallengeHref().includes("era=1");
      const currentEra = searchParams.get("era") === "1";
      if (expectedEra !== currentEra) {
        router.replace(getWeeklyChallengeHref());
      }
    }
  }, [
    isHiddenMode,
    cup,
    eraCup,
    fantasy,
    draft,
    difficultyParam,
    daily,
    router,
    isDaily,
    dailyScenario,
    weekly,
    isWeekly,
    weeklyScenario,
    searchParams,
    badSideModeLink,
    oneClubParam,
    oneClubOption,
    archiveKey,
    archiveEra,
  ]);

  const wantsNormalEra = dailyScenario
    ? dailyScenario.eraMode
    : weeklyScenario
      ? weeklyScenario.eraMode
      : archiveScenario
        ? archiveScenario.eraMode
        : oneClubOption
          ? true // One-Club XI plays on the Era ladder (its own club ladder mapped onto it)
          : isNormalEraMode({ era, cup });
  const difficulty: GameDifficulty = ballKnower ? "HARD" : "NORMAL";
  const mode: GameMode = "CLASSIC";

  const title = ballKnower
    ? `Ball Knower · ${wantsNormalEra ? "Era Classic" : "Classic"}`
    : wantsSuperSamHallas
    ? "Super Sam Hallas Mode"
    : wantsJoeMellor
      ? "Joe Mellor GOAT Mode"
      : isDaily && dailyScenario
        ? `Daily: ${dailyScenario.ruleTitle}`
        : isWeekly && weeklyScenario
          ? `Weekly: ${weeklyScenario.ruleTitle}`
          : oneClubOption
            ? `One-Club XI: ${oneClubOption.club}`
            : archiveScenario
              ? `Past Daily: ${archiveScenario.ruleTitle}`
              : sideMode?.kind === "gauntlet"
                ? `Gauntlet · ${wantsNormalEra ? "Era Classic" : "Classic"}`
                : getPlayPageTitle(mode, difficulty, wantsNormalEra);
  const subtitle = oneClubOption
    ? `Every spin is a ${oneClubOption.club} side, ${oneClubOption.firstYear}–${oneClubOption.lastYear}. Build their all-time 13.`
    : sideMode?.kind === "gauntlet"
      ? "Draft your 13, then beat ten of the greatest sides in a row. One defeat ends it."
      : undefined;

  // The static metadata says "Classic"; name the tab after the variant actually being played.
  useEffect(() => {
    if (!mounted || ballKnower === null) return;
    document.title = challenge ? `${challengeBannerText(challenge)} — 27-0` : `${title} — 27-0`;
  }, [mounted, ballKnower, title, challenge]);

  // The board reads saved runs and Store boosts from this device on its first render; the server
  // can't, so render it only once mounted (otherwise React hydration error #418 on /play).
  if (!mounted || ballKnower === null || badSideModeLink) {
    return <p className="p-6 text-center text-pitch-400">Loading…</p>;
  }

  if (hasChallengeParam) {
    if (!challenge) return <ChallengeLinkNotice reason="invalid" />;
    const gate = getChallengeGate(challenge);
    if (gate !== "ok") return <ChallengeLinkNotice reason={gate} challenge={challenge} />;
    return (
      <GameStarter
        key={`challenge-${challengeParam}`}
        mode="CLASSIC"
        title="Challenge"
        difficulty="NORMAL"
        normalEraMode={getChallengeEraMode(challenge)}
        challenge={challenge}
      />
    );
  }

  return (
    <GameStarter
      key={`${ballKnower ? "bk" : "normal"}-${sideModeKey(sideMode)}-${wantsNormalEra ? "era" : "cur"}`}
      mode={mode}
      title={title}
      subtitle={subtitle}
      sideMode={sideMode}
      difficulty={difficulty}
      joeMellorMode={wantsJoeMellor}
      superSamHallasMode={wantsSuperSamHallas}
      normalEraMode={wantsNormalEra}
    />
  );
}
