"use client";

import { useCallback, useEffect, useState } from "react";
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
  UI_THEMES,
  type UiThemeDefinition,
} from "@/lib/ui-themes";
import { CARD, SPACING } from "@/lib/ui/design-system";
import { TYPO } from "@/lib/ui/typography";
import { GameButton } from "./ui/GameButton";

function ThemeColourStrip({ theme }: { theme: UiThemeDefinition }) {
  const swatches = [
    { label: "Primary", colour: theme.primary },
    { label: "Secondary", colour: theme.secondary },
    { label: "Tertiary", colour: theme.tertiary },
  ];

  return (
    <div className="border-b border-pitch-700/40 bg-pitch-950/80">
      <div className="flex h-3 w-full overflow-hidden">
        {swatches.map((swatch) => (
          <span
            key={swatch.label}
            className="flex-1"
            style={{ backgroundColor: swatch.colour }}
            title={swatch.label}
          />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1 px-2 py-1.5">
        {swatches.map((swatch) => (
          <div key={swatch.label} className="min-w-0 text-center">
            <span
              className="mx-auto mb-0.5 block h-5 w-full rounded border border-white/20"
              style={{ backgroundColor: swatch.colour }}
            />
            <span className="block truncate text-[9px] font-semibold uppercase tracking-wide text-gray-400">
              {swatch.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ThemePreviewButton({ theme }: { theme: UiThemeDefinition }) {
  return (
    <div
      className="mt-3 rounded-lg border-2 p-2"
      style={{
        borderColor: theme.tertiary,
        background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.secondary} 100%)`,
        color: theme.textOnPrimary,
        boxShadow: `0 0 12px ${theme.glow}`,
      }}
    >
      <span className="block text-center font-display text-[10px] font-black uppercase tracking-wider">
        Button preview
      </span>
    </div>
  );
}

function ThemeSwatches({ theme }: { theme: UiThemeDefinition }) {
  const colours = [
    { label: "Primary", colour: theme.primary },
    { label: "Secondary", colour: theme.secondary },
    { label: "Tertiary", colour: theme.tertiary },
  ];

  return (
    <div className="flex shrink-0 gap-1" aria-hidden>
      {colours.map((swatch) => (
        <span
          key={swatch.label}
          className="h-7 w-7 rounded-full border border-white/15"
          style={{ backgroundColor: swatch.colour }}
          title={swatch.label}
        />
      ))}
    </div>
  );
}

export function StorePanel() {
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
      <div
        className={`${CARD.inset} flex flex-wrap items-center justify-between gap-3 ${SPACING.cardPaddingSm}`}
      >
        <div>
          <p className={TYPO.statLabel}>Club Funds</p>
          <p className="mt-1 font-display text-2xl font-black text-white">
            {formatClubFunds(balance)}
          </p>
          <p className={`mt-0.5 ${TYPO.bodySm} text-gray-500`}>
            {formatClubFundsExact(balance)}
          </p>
        </div>
        <p className={`max-w-xs ${TYPO.bodySm} text-gray-400`}>
          Team colour themes cost {formatClubFundsExact(UI_THEME_PURCHASE_PRICE)}{" "}
          each. Purchases use your current balance only — lifetime earned is
          unchanged.
        </p>
      </div>

      {purchaseError && (
        <p className="mt-4 text-sm font-medium text-red-400" role="alert">
          {purchaseError}
        </p>
      )}

      <ul className={`mt-6 grid gap-3 sm:grid-cols-2 ${SPACING.stackMd}`}>
        {UI_THEMES.map((theme) => {
          const isUnlocked = unlocked.includes(theme.id);
          const isSelected = selectedId === theme.id;
          const canAfford = balance >= UI_THEME_PURCHASE_PRICE;

          return (
            <li
              key={theme.id}
              className={`${CARD.base} ${CARD.panel} overflow-hidden rounded-xl border transition ${
                isSelected
                  ? "border-[var(--theme-tertiary)] shadow-[0_0_24px_var(--theme-glow)] ring-1 ring-[var(--theme-tertiary)]"
                  : "border-pitch-700/50"
              }`}
            >
              <ThemeColourStrip theme={theme} />
              <div className={SPACING.cardPaddingSm}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-display text-sm font-bold text-white sm:text-base">
                      {theme.label}
                    </p>
                    <p className={`mt-0.5 ${TYPO.bodySm} text-gray-500`}>
                      {isUnlocked
                        ? isSelected
                          ? "Selected"
                          : "Unlocked"
                        : formatClubFundsExact(UI_THEME_PURCHASE_PRICE)}
                    </p>
                  </div>
                  <ThemeSwatches theme={theme} />
                </div>

                <ThemePreviewButton theme={theme} />

                <div className="mt-4">
                  {isUnlocked ? (
                    <GameButton
                      variant={isSelected ? "theme" : "secondary"}
                      size="sm"
                      onClick={() => handleSelect(theme.id)}
                      disabled={isSelected}
                    >
                      {isSelected ? "Selected" : "Select"}
                    </GameButton>
                  ) : (
                    <GameButton
                      variant="theme"
                      size="sm"
                      disabled={!canAfford || purchasingId === theme.id}
                      onClick={() => handlePurchase(theme)}
                    >
                      Buy — {formatClubFunds(UI_THEME_PURCHASE_PRICE)}
                    </GameButton>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
