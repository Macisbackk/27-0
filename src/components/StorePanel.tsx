"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CountUp } from "@/components/ui/CountUp";
import {
  formatClubFunds,
  formatClubFundsExact,
} from "@/lib/club-funds";
import {
  CLUB_FUNDS_CHANGED_EVENT,
  getClubFundsBalance,
} from "@/lib/storage/club-funds";
import {
  getUiThemeStoreState,
  isUiThemeUnlocked,
  purchaseUiTheme,
  selectUiTheme,
  UI_THEME_CHANGED_EVENT,
} from "@/lib/storage/ui-theme-store";
import {
  playStoreOpen,
  playThemePurchaseFail,
  playThemePurchaseSuccess,
  playThemeSelect,
  playUiClick,
} from "@/lib/sound";
import {
  UI_THEME_PURCHASE_PRICE,
  sortUiThemesForStore,
  UI_THEMES,
  type UiThemeDefinition,
} from "@/lib/ui-themes";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { GameButton } from "./ui/GameButton";
import { ClubLogoBox } from "./ClubBadge";
import { FramesStore, KitAndPitchStore, ModesStore, TitlesStore } from "./StoreCosmetics";

type StoreTab = "themes" | "kit" | "titles" | "frames" | "modes";

const STORE_TABS: { id: StoreTab; label: string }[] = [
  { id: "themes", label: "Themes" },
  { id: "kit", label: "Kit & pitch" },
  { id: "titles", label: "Titles" },
  { id: "frames", label: "Frames" },
  { id: "modes", label: "Modes" },
];


/** Mini app preview in the theme's colours: header bar, accent text and a primary button. */
/**
 * The same little screen for every theme (the site's own dark cards), so the only thing that
 * changes between previews is the accent: the score, the progress bar and the button.
 */
function ThemePreview({ theme }: { theme: UiThemeDefinition }) {
  return (
    <div className="bg-pitch-950 p-3" aria-label={`${theme.label} preview`} role="img">
      <div className="flex items-center justify-between">
        <span className="font-display text-[15px] leading-none" style={{ color: theme.primary }}>
          27<span className="text-white">-0</span>
        </span>
        {/* The theme's three kit colours. */}
        <span className="flex gap-1" aria-hidden>
          <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/15" style={{ backgroundColor: theme.primary }} />
          <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/15" style={{ backgroundColor: theme.secondary }} />
          <span className="h-2.5 w-2.5 rounded-full ring-1 ring-white/15" style={{ backgroundColor: theme.tertiary }} />
        </span>
      </div>
      <div className="mt-2.5 rounded-[10px] bg-pitch-900 p-2">
        <span className="block h-1.5 w-3/4 rounded-full bg-white/20" />
        <span className="mt-1.5 block h-1.5 w-1/2 rounded-full" style={{ backgroundColor: theme.secondary, opacity: 0.8 }} />
        <span className="mt-2 block h-1 overflow-hidden rounded-full bg-white/10">
          <span className="block h-full w-2/3 rounded-full" style={{ backgroundColor: theme.primary }} />
        </span>
      </div>
      <span
        className="mt-2.5 block rounded-[10px] py-1.5 text-center font-cond text-[12px] font-bold"
        style={{ backgroundColor: theme.primary, color: theme.textOnPrimary, boxShadow: `inset 0 0 0 1.5px ${theme.tertiary}` }}
      >
        Play
      </span>
    </div>
  );
}

export function StorePanel() {
  const [tab, setTab] = useState<StoreTab>("themes");
  const [balance, setBalance] = useState(0);
  const [selectedId, setSelectedId] = useState("default");
  const [unlocked, setUnlocked] = useState<string[]>(["default"]);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const state = getUiThemeStoreState();
    setBalance(getClubFundsBalance());
    setSelectedId(state.selectedThemeId);
    setUnlocked(state.unlockedThemeIds);
  }, []);

  useEffect(() => {
    refresh();
    playStoreOpen();

    const onFunds = () => setBalance(getClubFundsBalance());
    const onTheme = () => refresh();

    window.addEventListener(CLUB_FUNDS_CHANGED_EVENT, onFunds);
    window.addEventListener(UI_THEME_CHANGED_EVENT, onTheme);
    return () => {
      window.removeEventListener(CLUB_FUNDS_CHANGED_EVENT, onFunds);
      window.removeEventListener(UI_THEME_CHANGED_EVENT, onTheme);
    };
  }, [refresh]);

  const displayThemes = useMemo(
    () => sortUiThemesForStore(UI_THEMES, unlocked),
    [unlocked]
  );

  const handleSelect = (themeId: string) => {
    playUiClick();
    if (!isUiThemeUnlocked(themeId)) return;
    if (selectUiTheme(themeId)) {
      playThemeSelect();
      setSelectedId(themeId);
      setPurchaseError(null);
    }
  };

  const handlePurchase = (theme: UiThemeDefinition) => {
    if (purchasingId) return;
    playUiClick();
    setPurchaseError(null);
    setPurchasingId(theme.id);

    const result = purchaseUiTheme(theme.id);
    setBalance(getClubFundsBalance());
    refresh();
    setPurchasingId(null);

    if (result.success) {
      playThemePurchaseSuccess();
      return;
    }

    playThemePurchaseFail();
    if (result.reason === "insufficient") {
      setPurchaseError(
        `Need ${formatClubFundsExact(UI_THEME_PURCHASE_PRICE)} — balance ${formatClubFundsExact(result.newBalance)}`
      );
    }
  };

  return (
    <div>
      {tab !== "themes" ? (
        <p className="mb-3 text-center text-sm text-[color:var(--fl-muted)]">
          Club Funds <span className="font-bold text-theme-primary"><CountUp value={balance} format={formatClubFunds} durationMs={700} /></span>
        </p>
      ) : null}
      <div role="tablist" aria-label="Store sections" className="mb-4 flex flex-wrap justify-center gap-2">
        {STORE_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => {
              playUiClick();
              setTab(t.id);
            }}
            className={`min-h-[44px] rounded-full px-4 text-sm font-bold transition ${
              tab === t.id ? "bg-theme-primary text-[color:var(--theme-text-on-primary)]" : "bg-pitch-900 text-white hover:bg-pitch-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div key={tab} className="fl-rise">
      {tab === "kit" ? <KitAndPitchStore balance={balance} /> : null}
      {tab === "titles" ? <TitlesStore balance={balance} /> : null}
      {tab === "frames" ? <FramesStore balance={balance} /> : null}
      {tab === "modes" ? <ModesStore balance={balance} /> : null}
      {tab !== "themes" ? null : (
        <>
      <div
        className={`${CARD.inset} flex flex-wrap items-center justify-between gap-3 ${SPACING.cardPaddingSm}`}
      >
        <div>
          <p className={TYPO.statLabel}>Club Funds</p>
          <p className="mt-1 font-display text-2xl font-black text-white">
            <CountUp value={balance} format={formatClubFunds} durationMs={700} />
          </p>
          <p className={`mt-0.5 ${TYPO.bodySm} text-gray-500`}>
            {formatClubFundsExact(balance)}
          </p>
        </div>
        <div className="min-w-[9rem] flex-1 sm:max-w-xs">
          <p className={`${TYPO.bodySm} text-gray-400`}>
            Themes {formatClubFunds(UI_THEME_PURCHASE_PRICE)} each
          </p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-pitch-800" aria-hidden>
            <div
              className="h-full rounded-full bg-accent-gold transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${Math.min(100, (balance / UI_THEME_PURCHASE_PRICE) * 100)}%` }}
            />
          </div>
          <p className={`mt-1 ${TYPO.bodySm} ${balance >= UI_THEME_PURCHASE_PRICE ? "text-lime-300" : "text-gray-500"}`}>
            {balance >= UI_THEME_PURCHASE_PRICE
              ? "You can afford a theme"
              : `${formatClubFunds(UI_THEME_PURCHASE_PRICE - balance)} to your next theme`}
          </p>
        </div>
      </div>

      {purchaseError && (
        <p className="mt-4 text-sm font-medium text-red-400" role="alert">
          {purchaseError}
        </p>
      )}

      <ul className="fl-stagger mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {displayThemes.map((theme) => {
          const isUnlocked = unlocked.includes(theme.id);
          const isSelected = selectedId === theme.id;
          const canAfford = balance >= UI_THEME_PURCHASE_PRICE;

          return (
            <li
              key={theme.id}
              className={`flex flex-col overflow-hidden rounded-card bg-pitch-900 transition ${
                isSelected ? "ring-2 ring-theme-primary" : ""
              }`}
            >
              <ThemePreview theme={theme} />
              <div className="flex flex-1 flex-col p-3">
                <div className="flex min-w-0 items-center gap-2">
                  {theme.clubName ? (
                    <ClubLogoBox club={theme.clubName} size="sm" showAbbrev={false} />
                  ) : null}
                  <p className="min-w-0 flex-1 font-cond text-[15px] font-bold leading-tight text-white">{theme.label}</p>
                </div>
                <p className={`mt-1 text-xs ${isSelected ? "text-theme-primary" : "text-[color:var(--fl-muted)]"}`}>
                  {isUnlocked ? (isSelected ? "In use" : "Owned") : formatClubFunds(UI_THEME_PURCHASE_PRICE)}
                </p>

                <div className="mt-auto pt-3">
                  {isUnlocked ? (
                    <GameButton
                      variant={isSelected ? "theme" : "secondary"}
                      size="sm"
                      onClick={() => handleSelect(theme.id)}
                      disabled={isSelected}
                    >
                      {isSelected ? "Selected" : "Use"}
                    </GameButton>
                  ) : (
                    <GameButton
                      variant="secondary"
                      size="sm"
                      disabled={!canAfford || purchasingId === theme.id}
                      onClick={() => handlePurchase(theme)}
                    >
                      {canAfford ? "Buy" : formatClubFunds(UI_THEME_PURCHASE_PRICE)}
                    </GameButton>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
        </>
      )}
      </div>
    </div>
  );
}
