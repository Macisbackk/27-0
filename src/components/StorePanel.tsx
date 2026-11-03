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
  getUiThemeById,
  sortUiThemesForStore,
  uiThemePrice,
  UI_THEMES,
  type UiThemeDefinition,
} from "@/lib/ui-themes";
import { syncAchievementKits } from "@/lib/achievement-kits";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { GameButton } from "./ui/GameButton";
import { FramesStore, InUseBadge, KitStore, ModesStore, PitchStore, TitlesStore } from "./StoreCosmetics";
import { StorePreviewSheet, type StorePreviewItem } from "./StorePreview";

type StoreTab = "themes" | "kit" | "pitches" | "titles" | "frames" | "modes";

const STORE_TABS: { id: StoreTab; label: string }[] = [
  { id: "themes", label: "Themes" },
  { id: "kit", label: "Kit" },
  { id: "pitches", label: "Pitches" },
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
      {/* Accent swatch only: a labelled "Play" bar here looked like a button people could tap. */}
      <span
        aria-hidden
        className="mt-2.5 block h-2.5 rounded-full"
        style={{ backgroundColor: theme.primary, boxShadow: `inset 0 0 0 1.5px ${theme.tertiary}` }}
      />
    </div>
  );
}

export function StorePanel() {
  // Opens on themes (v1.66: £750k–£4m each, see docs/store-economy.md).
  const [tab, setTab] = useState<StoreTab>("themes");
  const [balance, setBalance] = useState(0);
  const [selectedId, setSelectedId] = useState("default");
  const [unlocked, setUnlocked] = useState<string[]>(["default"]);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<StorePreviewItem | null>(null);

  const refresh = useCallback(() => {
    const state = getUiThemeStoreState();
    setBalance(getClubFundsBalance());
    setSelectedId(state.selectedThemeId);
    setUnlocked(state.unlockedThemeIds);
  }, []);

  useEffect(() => {
    refresh();
    playStoreOpen();
    syncAchievementKits();

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

  /** Tap a theme → preview sheet in its colours → Buy / Cancel. */
  const openPreview = (theme: UiThemeDefinition) => {
    playUiClick();
    setPurchaseError(null);
    setPreview({
      id: theme.id,
      name: theme.label,
      blurb: theme.blurb,
      price: uiThemePrice(theme.id),
      look: { kind: "theme", theme },
      owned: unlocked.includes(theme.id),
    });
  };

  const handlePurchase = (themeId: string) => {
    if (purchasingId) return;
    const theme = getUiThemeById(themeId);
    const price = uiThemePrice(theme.id);
    setPurchaseError(null);
    setPurchasingId(theme.id);

    const result = purchaseUiTheme(theme.id);
    setBalance(getClubFundsBalance());
    refresh();
    setPurchasingId(null);

    if (result.success || result.reason === "already_unlocked") {
      if (result.success) playThemePurchaseSuccess();
      setPreview(null);
      return;
    }

    playThemePurchaseFail();
    if (result.reason === "insufficient") {
      setPurchaseError(`Need ${formatClubFundsExact(price)} — balance ${formatClubFundsExact(result.newBalance)}`);
    }
  };

  // Progress bar: towards the cheapest theme not yet owned.
  const nextTheme = displayThemes
    .filter((t) => !unlocked.includes(t.id))
    .reduce<UiThemeDefinition | null>((best, t) => (!best || uiThemePrice(t.id) < uiThemePrice(best.id) ? t : best), null);
  const nextPrice = nextTheme ? uiThemePrice(nextTheme.id) : 0;

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
            className={`min-h-[44px] rounded-full px-4 font-cond text-[16px] font-bold transition ${
              tab === t.id ? "bg-white text-pitch-950" : "bg-pitch-900 text-white hover:bg-pitch-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div key={tab} className="fl-rise">
      {tab === "kit" ? <KitStore balance={balance} /> : null}
      {tab === "pitches" ? <PitchStore balance={balance} /> : null}
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
          <p className={`mt-0.5 ${TYPO.bodySm} text-[color:var(--fl-muted)]`}>
            {formatClubFundsExact(balance)}
          </p>
        </div>
        <div className="min-w-[9rem] flex-1 sm:max-w-xs">
          {nextTheme ? (
            <>
              <p className={`${TYPO.bodySm} text-gray-400`}>
                Next: {nextTheme.label} · {formatClubFunds(nextPrice)}
              </p>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-pitch-800" aria-hidden>
                <div
                  className="h-full rounded-full bg-accent-gold transition-[width] duration-500 ease-out motion-reduce:transition-none"
                  style={{ width: `${Math.min(100, (balance / Math.max(1, nextPrice)) * 100)}%` }}
                />
              </div>
              <p className={`mt-1 ${TYPO.bodySm} ${balance >= nextPrice ? "text-lime-300" : "text-[color:var(--fl-muted)]"}`}>
                {balance >= nextPrice ? "You can afford a theme" : `${formatClubFunds(nextPrice - balance)} to your next theme`}
              </p>
            </>
          ) : (
            <p className={`${TYPO.bodySm} text-lime-300`}>Every theme owned</p>
          )}
        </div>
      </div>

      {purchaseError && (
        <p className="mt-4 text-center text-sm font-medium text-red-400" role="alert">
          {purchaseError}
        </p>
      )}

      <ul className="fl-stagger mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {displayThemes.map((theme) => {
          const isUnlocked = unlocked.includes(theme.id);
          const isSelected = selectedId === theme.id;
          const price = uiThemePrice(theme.id);
          const canAfford = balance >= price;

          return (
            <li
              key={theme.id}
              className={`flex flex-col overflow-hidden rounded-card bg-pitch-900 transition ${
                isSelected ? "ring-2 ring-theme-primary" : ""
              }`}
            >
              <button type="button" onClick={() => openPreview(theme)} aria-label={`Preview ${theme.label}`} className="block text-left">
                <ThemePreview theme={theme} />
              </button>
              <div className="flex flex-1 flex-col p-3">
                <p className="min-w-0 font-cond text-[15px] font-bold leading-tight text-white">{theme.label}</p>
                {theme.blurb ? <p className="mt-0.5 text-xs text-[color:var(--fl-muted)]">{theme.blurb}</p> : null}
                {isUnlocked && !isSelected ? (
                  <p className="mt-1 text-xs text-[color:var(--fl-muted)]">Owned</p>
                ) : null}

                <div className="mt-auto pt-3">
                  {isSelected ? (
                    <InUseBadge />
                  ) : isUnlocked ? (
                    <GameButton variant="secondary" size="sm" onClick={() => handleSelect(theme.id)}>
                      Use
                    </GameButton>
                  ) : (
                    <GameButton
                      variant={canAfford ? "theme" : "secondary"}
                      size="sm"
                      onClick={() => openPreview(theme)}
                    >
                      {canAfford ? `Buy · ${formatClubFunds(price)}` : formatClubFunds(price)}
                    </GameButton>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <StorePreviewSheet
        item={preview}
        balance={balance}
        busy={purchasingId !== null}
        onBuy={(item) => handlePurchase(item.id)}
        onClose={() => setPreview(null)}
      />
        </>
      )}
      </div>
    </div>
  );
}
