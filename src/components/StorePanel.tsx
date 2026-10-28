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
import { FramesStore, InUseBadge, KitStore, ModesStore, PitchStore, TitlesStore } from "./StoreCosmetics";
import { COSMETICS, nextStoreUnlock, type CosmeticKind } from "@/lib/cosmetics";
import { purchaseCosmetic, useCosmetics } from "@/lib/storage/cosmetics-store";

type StoreTab = "foryou" | "themes" | "kit" | "pitches" | "titles" | "frames" | "modes";

const STORE_TABS: { id: StoreTab; label: string }[] = [
  { id: "foryou", label: "For you" },
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
  // Opens on what this coach can buy now (themes are £2.5m: a new player can't afford one).
  const [tab, setTab] = useState<StoreTab>("foryou");
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
      {tab !== "themes" && tab !== "foryou" ? (
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
      {tab === "foryou" ? (
        <ForYouStore
          balance={balance}
          unlockedThemes={unlocked}
          purchasingThemeId={purchasingId}
          onBuyTheme={handlePurchase}
          onOpenTab={(next) => {
            playUiClick();
            setTab(next);
          }}
        />
      ) : null}
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
          <p className={`${TYPO.bodySm} text-gray-400`}>
            Themes {formatClubFunds(UI_THEME_PURCHASE_PRICE)} each
          </p>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-pitch-800" aria-hidden>
            <div
              className="h-full rounded-full bg-accent-gold transition-[width] duration-500 ease-out motion-reduce:transition-none"
              style={{ width: `${Math.min(100, (balance / UI_THEME_PURCHASE_PRICE) * 100)}%` }}
            />
          </div>
          <p className={`mt-1 ${TYPO.bodySm} ${balance >= UI_THEME_PURCHASE_PRICE ? "text-lime-300" : "text-[color:var(--fl-muted)]"}`}>
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
                      disabled={!canAfford || purchasingId === theme.id}
                      onClick={() => handlePurchase(theme)}
                    >
                      {canAfford
                        ? `Buy · ${formatClubFunds(UI_THEME_PURCHASE_PRICE)}`
                        : `Need ${formatClubFunds(UI_THEME_PURCHASE_PRICE - balance)} more`}
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

const KIND_LABEL: Record<CosmeticKind | "theme", string> = {
  theme: "Theme",
  kit: "Kit",
  pitch: "Pitch",
  title: "Coach title",
  frame: "Leaderboard frame",
  mode: "Mode",
};

const KIND_TAB: Record<CosmeticKind | "theme", StoreTab> = {
  theme: "themes",
  kit: "kit",
  pitch: "pitches",
  title: "titles",
  frame: "frames",
  mode: "modes",
};

interface ForYouItem {
  id: string;
  kind: CosmeticKind | "theme";
  name: string;
  price: number;
}

/**
 * Default Store tab: everything this coach can afford right now (cheapest first), and the
 * next thing to save for. Buying here is the same purchase as on the item's own tab.
 */
function ForYouStore({
  balance,
  unlockedThemes,
  purchasingThemeId,
  onBuyTheme,
  onOpenTab,
}: {
  balance: number;
  unlockedThemes: string[];
  purchasingThemeId: string | null;
  onBuyTheme: (theme: UiThemeDefinition) => void;
  onOpenTab: (tab: StoreTab) => void;
}) {
  const c = useCosmetics();
  const [message, setMessage] = useState<string | null>(null);

  const items: ForYouItem[] = useMemo(() => {
    const cosmetics: ForYouItem[] = COSMETICS.filter((i) => !i.notForSale && !c.owned.includes(i.id)).map((i) => ({
      id: i.id,
      kind: i.kind,
      name: i.name,
      price: i.price,
    }));
    const themes: ForYouItem[] = UI_THEMES.filter((t) => !unlockedThemes.includes(t.id)).map((t) => ({
      id: t.id,
      kind: "theme" as const,
      name: t.label,
      price: UI_THEME_PURCHASE_PRICE,
    }));
    return [...cosmetics, ...themes].sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
  }, [c.owned, unlockedThemes]);

  const affordable = items.filter((i) => i.price <= balance);
  const next = nextStoreUnlock(balance, c.owned);
  const saveFor = items.find((i) => i.price > balance) ?? null;

  const buy = (item: ForYouItem) => {
    playUiClick();
    setMessage(null);
    if (item.kind === "theme") {
      const theme = UI_THEMES.find((t) => t.id === item.id);
      if (theme) onBuyTheme(theme);
      return;
    }
    const r = purchaseCosmetic(item.id);
    if (r.success) {
      playThemePurchaseSuccess();
      setMessage(`${item.name} unlocked. Find it under ${STORE_TABS.find((t) => t.id === KIND_TAB[item.kind])?.label}.`);
    } else {
      playThemePurchaseFail();
      if (r.reason === "insufficient") setMessage(`You need ${formatClubFunds(item.price - balance)} more for ${item.name}.`);
    }
  };

  return (
    <div className="flex flex-col gap-3 text-left">
      <div className={`${CARD.inset} ${SPACING.cardPaddingSm}`}>
        <p className={TYPO.label}>Club Funds</p>
        <p className="fl-number mt-1 text-[28px] leading-none text-theme-primary tabular-nums">
          <CountUp value={balance} format={formatClubFunds} durationMs={700} />
        </p>
        {saveFor ? (
          <>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-pitch-800" aria-hidden>
              <div
                className="h-full rounded-full bg-accent-gold transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${Math.min(100, (Math.max(0, balance) / saveFor.price) * 100)}%` }}
              />
            </div>
            <p className={`mt-1.5 ${TYPO.bodySm} text-[color:var(--fl-muted)]`}>
              Next: {saveFor.name} ({KIND_LABEL[saveFor.kind].toLowerCase()}) · {formatClubFunds(saveFor.price - balance)} to go
            </p>
          </>
        ) : null}
      </div>

      {message ? (
        <p className="text-center text-sm text-theme-primary" role="status">
          {message}
        </p>
      ) : null}

      <section className="rounded-card bg-pitch-900 p-4" aria-labelledby="store-for-you">
        <h2 id="store-for-you" className="text-[17px] font-bold text-white">
          {affordable.length > 0 ? "You can buy now" : "Nothing in reach yet"}
        </h2>
        {affordable.length === 0 ? (
          <p className="mt-1 text-sm text-[color:var(--fl-muted)]">
            {next
              ? `Win games and play puzzles to earn Club Funds. Items start at ${formatClubFunds(next.price)}.`
              : "You own everything in the Store."}
          </p>
        ) : null}
        <ul className="mt-2 divide-y divide-[color:var(--fl-line)]">
          {(affordable.length > 0 ? affordable : items.slice(0, 3)).map((item) => {
            const canAfford = item.price <= balance;
            return (
              <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3 py-2.5">
                <button
                  type="button"
                  onClick={() => onOpenTab(KIND_TAB[item.kind])}
                  className="min-w-0 flex-1 text-left"
                  aria-label={`${item.name}, ${KIND_LABEL[item.kind]}: see it on its tab`}
                >
                  <span className="block truncate text-[15px] font-semibold text-white">{item.name}</span>
                  <span className="block text-xs text-[color:var(--fl-muted)]">
                    {KIND_LABEL[item.kind]} · {formatClubFunds(item.price)}
                  </span>
                </button>
                <GameButton
                  size="sm"
                  fullWidth={false}
                  variant={canAfford ? "theme" : "secondary"}
                  disabled={!canAfford || (item.kind === "theme" && purchasingThemeId === item.id)}
                  onClick={() => buy(item)}
                >
                  {canAfford ? "Buy" : `Need ${formatClubFunds(item.price - balance)} more`}
                </GameButton>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
