"use client";

import type { CSSProperties, ReactNode } from "react";
import { ClubShirt } from "@/components/ClubShirt";
import { GameModal } from "@/components/ui/GameModal";
import { GameButton } from "@/components/ui/GameButton";
import { FlairBadge, frameRowClass } from "@/lib/coach-flair";
import { formatClubFunds } from "@/lib/club-funds";
import type { ClubKit } from "@/lib/club-kits";
import { PITCH_STYLES, type PitchStyleId } from "@/lib/cosmetics";
import type { UiThemeDefinition } from "@/lib/ui-themes";
import { buildThemeCssVars } from "@/lib/ui/theme-css-vars";

/**
 * Store preview sheet (v1.66): tap an item to see it applied before buying, with Buy and Cancel.
 * Every preview reuses the game's own renderers: theme CSS variables scoped to the preview, the
 * ClubShirt, the pitch styles and the leaderboard frame / title classes.
 */
export type StorePreviewLook =
  | { kind: "theme"; theme: UiThemeDefinition }
  | { kind: "kit"; kit: ClubKit; pitch: PitchStyleId }
  | { kind: "pitch"; pitch: PitchStyleId; kit: ClubKit | null }
  | { kind: "frame"; frameId: string; title: string | null }
  | { kind: "title"; title: string; frameId: string | null };

export interface StorePreviewItem {
  id: string;
  name: string;
  blurb?: string;
  price: number;
  look: StorePreviewLook;
  /** Earned items (achievement kits): no Buy, just how to earn it. */
  earn?: string;
  owned?: boolean;
}

function PitchScene({ pitch, kit, height = "h-44" }: { pitch: PitchStyleId; kit: ClubKit | null; height?: string }) {
  const look = PITCH_STYLES[pitch] ?? PITCH_STYLES.classic;
  return (
    <div className={`relative ${height} overflow-hidden rounded-tile`} style={{ background: look.background }}>
      <div className="absolute left-0 right-0 top-1/2 h-[2px]" style={{ background: look.line }} />
      <div className="absolute bottom-0 left-0 right-0 top-[18%] h-[2px] opacity-60" style={{ background: look.line }} />
      <div className="absolute inset-0 flex items-center justify-center gap-3">
        {["7", "1", "6"].map((n, i) => (
          <span key={n} className={i === 1 ? "-translate-y-4" : "translate-y-3"}>
            <ClubShirt kit={kit} label={n} size={i === 1 ? 64 : 52} />
          </span>
        ))}
      </div>
    </div>
  );
}

function LeaderboardScene({ frameId, title }: { frameId: string | null; title: string | null }) {
  const rows = [
    { rank: 1, name: "You", score: "27-0", me: true },
    { rank: 2, name: "Coach Bennett", score: "26-1", me: false },
    { rank: 3, name: "Wayne's World", score: "25-2", me: false },
  ];
  return (
    <ul className="space-y-1.5 rounded-tile bg-pitch-950 p-2">
      {rows.map((r) => (
        <li
          key={r.rank}
          className={`grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-tile px-3 py-2.5 ${r.me ? frameRowClass(frameId) : "bg-pitch-900/60"}`}
        >
          <span className="font-display text-sm text-accent-gold">{r.rank}</span>
          <span className="flex min-w-0 flex-wrap items-center gap-1 text-left">
            <span className="coach-name truncate text-sm font-bold text-white">{r.name}</span>
            {r.me && title ? <FlairBadge title={title} className="" /> : null}
          </span>
          <span className="text-sm font-semibold text-accent-gold">{r.score}</span>
        </li>
      ))}
    </ul>
  );
}

/** A small slice of the app in the theme's colours, scoped with the theme's own CSS variables. */
function ThemeScene({ theme }: { theme: UiThemeDefinition }) {
  const vars = buildThemeCssVars(theme) as unknown as CSSProperties;
  return (
    <div style={vars} className="rounded-tile bg-pitch-950 p-3 text-center" aria-hidden>
      <p className="font-display text-[30px] leading-none text-theme-primary">
        27<span className="text-white">-0</span>
      </p>
      <p className="mt-1 text-xs text-[color:var(--fl-muted)]">Classic · Season 3</p>
      <div className="mx-auto mt-3 h-2 max-w-[14rem] overflow-hidden rounded-full bg-pitch-800">
        <div className="h-full w-2/3 rounded-full bg-theme-primary" />
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        <span className="rounded-full bg-theme-primary px-3 py-1 text-xs font-bold text-[color:var(--theme-text-on-primary)]">In use</span>
        <span className="rounded-full bg-theme-primary/15 px-3 py-1 text-xs font-bold text-theme-primary">22 wins</span>
        <span className="rounded-full px-3 py-1 text-xs font-bold text-theme-primary ring-1 ring-theme-primary/50">Top of the table</span>
      </div>
      {/* The real button in the theme's colours; inert, so it can't be tapped or focused. */}
      <div className="pointer-events-none mx-auto mt-3 max-w-[16rem]" inert>
        <GameButton size="sm" variant="theme">
          Play Classic
        </GameButton>
      </div>
    </div>
  );
}

function Scene({ look }: { look: StorePreviewLook }): ReactNode {
  switch (look.kind) {
    case "theme":
      return <ThemeScene theme={look.theme} />;
    case "kit":
      return <PitchScene pitch={look.pitch} kit={look.kit} />;
    case "pitch":
      return <PitchScene pitch={look.pitch} kit={look.kit} />;
    case "frame":
      return <LeaderboardScene frameId={look.frameId} title={look.title} />;
    case "title":
      return <LeaderboardScene frameId={look.frameId} title={look.title} />;
  }
}

export function StorePreviewSheet({
  item,
  balance,
  busy = false,
  onBuy,
  onClose,
}: {
  item: StorePreviewItem | null;
  balance: number;
  busy?: boolean;
  onBuy: (item: StorePreviewItem) => void;
  onClose: () => void;
}) {
  const open = Boolean(item);
  const canAfford = item ? balance >= item.price : false;
  return (
    <GameModal open={open} onClose={onClose} labelledBy="store-preview-title" className="fl-modal">
      {item ? (
        <div className="space-y-4 text-center" data-testid="store-preview">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-[color:var(--fl-muted)]">Preview</p>
            <h2 id="store-preview-title" className="mt-0.5 text-[20px] font-bold text-white">
              {item.name}
            </h2>
            {item.blurb ? <p className="mt-1 text-sm text-[color:var(--fl-muted)]">{item.blurb}</p> : null}
          </div>
          <Scene look={item.look} />
          {item.earn ? (
            <p className="text-sm font-semibold text-amber-300">
              {item.owned ? "✓ Earned" : `🔒 Earn: ${item.earn}`}
            </p>
          ) : (
            <p className="text-sm text-[color:var(--fl-muted)]">
              {item.owned
                ? "You own this."
                : canAfford
                  ? `Price ${formatClubFunds(item.price)} · you have ${formatClubFunds(balance)}`
                  : `You need ${formatClubFunds(item.price - balance)} more.`}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            <GameButton size="md" variant="secondary" onClick={onClose} className="sm:w-40">
              {item.earn || item.owned ? "Close" : "Cancel"}
            </GameButton>
            {!item.earn && !item.owned ? (
              <GameButton
                size="md"
                variant={canAfford ? "theme" : "secondary"}
                disabled={!canAfford || busy}
                onClick={() => onBuy(item)}
                className="sm:w-48"
              >
                {canAfford ? `Buy · ${formatClubFunds(item.price)}` : `Need ${formatClubFunds(item.price - balance)}`}
              </GameButton>
            ) : null}
          </div>
        </div>
      ) : null}
    </GameModal>
  );
}
