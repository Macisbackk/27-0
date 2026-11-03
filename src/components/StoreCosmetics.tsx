"use client";

import Link from "next/link";
import { frameRowClass } from "@/lib/coach-flair";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ClubShirt } from "@/components/ClubShirt";
import { GameButton } from "@/components/ui/GameButton";
import { formatClubFunds } from "@/lib/club-funds";
import {
  COSMETICS,
  KIT_COLOURS,
  KIT_DESIGNER_ID,
  KIT_PATTERNS,
  KIT_PRESETS,
  PITCH_STYLES,
  cosmeticById,
  cosmeticsOfKind,
  kitFromDesign,
  pitchStyleForItem,
  titleName,
  type CosmeticItem,
} from "@/lib/cosmetics";
import { ACHIEVEMENT_KITS, syncAchievementKits } from "@/lib/achievement-kits";
import type { ClubKit } from "@/lib/club-kits";
import { StorePreviewSheet, type StorePreviewItem, type StorePreviewLook } from "./StorePreview";
import { MODE_UNLOCKS, syncModeUnlocks } from "@/lib/mode-unlocks";
import { MODES_PAGE } from "@/lib/play-side-modes";
import { equipCosmetic, purchaseCosmetic, setKitDesign, useCosmetics, type CosmeticsState } from "@/lib/storage/cosmetics-store";
import { playThemePurchaseFail, playThemePurchaseSuccess, playThemeSelect, playUiClick } from "@/lib/sound";

/** Starter rung first, then the rest of the catalogue. */
const items = cosmeticsOfKind;

/** Small tag on the cheap first-rung items so a new player spots what they can reach. */
function StarterTag({ item, className = "" }: { item: CosmeticItem | null | undefined; className?: string }) {
  if (item?.tier !== "starter") return null;
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full bg-lime-300/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lime-300 ${className}`}>
      Starter
    </span>
  );
}

/** The shirt the coach wears now: a ready-made kit, their own design, or a plain default. */
function wornKit(c: CosmeticsState): ClubKit {
  if (c.equipped.kit && KIT_PRESETS[c.equipped.kit]) return KIT_PRESETS[c.equipped.kit]!;
  return kitFromDesign(c.kit);
}

/** How an item looks applied, for the preview sheet (reuses the coach's other equipped items). */
function lookFor(item: CosmeticItem, c: CosmeticsState): StorePreviewLook | null {
  if (item.kind === "pitch") return { kind: "pitch", pitch: pitchStyleForItem(item.id), kit: wornKit(c) };
  if (item.kind === "kit") {
    const kit = KIT_PRESETS[item.id] ?? kitFromDesign(c.kit);
    return { kind: "kit", kit, pitch: pitchStyleForItem(c.equipped.pitch) };
  }
  if (item.kind === "frame") return { kind: "frame", frameId: item.id, title: titleName(c.equipped.title) };
  if (item.kind === "title") return { kind: "title", title: item.name, frameId: c.equipped.frame };
  return null;
}

/**
 * Tap an item → preview sheet → Buy / Cancel (v1.66). The sheet buys once (a second tap finds the
 * item owned and charges nothing).
 */
function usePreviewBuy(balance: number) {
  const c = useCosmetics();
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<StorePreviewItem | null>(null);
  const [busy, setBusy] = useState(false);
  const open = useCallback(
    (item: CosmeticItem, extra: Partial<StorePreviewItem> = {}) => {
      const look = lookFor(item, c);
      if (!look) return;
      playUiClick();
      setPreview({ id: item.id, name: item.name, blurb: item.blurb, price: item.price, look, owned: c.owned.includes(item.id), ...extra });
    },
    [c]
  );
  const close = useCallback(() => setPreview(null), []);
  const buy = useCallback(
    (p: StorePreviewItem) => {
      if (busy) return;
      const item = cosmeticById(p.id);
      if (!item) return;
      setBusy(true);
      const r = purchaseCosmetic(item.id);
      setBusy(false);
      if (r.success) {
        playThemePurchaseSuccess();
        setMessage(`${item.name} unlocked.`);
        setPreview(null);
      } else {
        playThemePurchaseFail();
        if (r.reason === "owned") setPreview(null);
        setMessage(r.reason === "insufficient" ? `You need ${formatClubFunds(item.price - balance)} more for ${item.name}.` : null);
      }
    },
    [balance, busy]
  );
  const sheet = <StorePreviewSheet item={preview} balance={balance} busy={busy} onBuy={buy} onClose={close} />;
  return { c, message, open, sheet };
}

/** The list's price button: opens the preview (Buy and Cancel are in the sheet). */
function BuyButton({ item, balance, onOpen }: { item: CosmeticItem; balance: number; onOpen: (i: CosmeticItem) => void }) {
  const canAfford = balance >= item.price;
  return (
    <GameButton size="sm" fullWidth={false} variant={canAfford ? "theme" : "secondary"} onClick={() => onOpen(item)}>
      {canAfford ? `Buy · ${formatClubFunds(item.price)}` : `${formatClubFunds(item.price)}`}
    </GameButton>
  );
}

function StatusMessage({ message }: { message: string | null }) {
  return message ? <p className="text-center text-sm text-theme-primary" role="status">{message}</p> : null;
}

function Section({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <section className="rounded-card bg-pitch-900 p-4 text-center sm:text-left">
      <h2 className="text-[17px] font-bold text-white">{title}</h2>
      <p className="mt-1 text-sm text-[color:var(--fl-muted)]">{intro}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Swatch({ hex, selected, onClick, label }: { hex: string; selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className={`h-10 w-10 rounded-full border-2 ${selected ? "border-theme-primary ring-2 ring-theme-primary/40" : "border-white/20"}`}
      style={{ background: hex }}
    />
  );
}

/** One ready-made kit card: tap the shirt to preview it on your pitch. */
function KitCard({
  item,
  owned,
  active,
  locked,
  footer,
  onPreview,
}: {
  item: CosmeticItem;
  owned: boolean;
  active: boolean;
  locked?: string;
  footer: ReactNode;
  onPreview: () => void;
}) {
  const kit = KIT_PRESETS[item.id] ?? null;
  return (
    <li className={`flex flex-col overflow-hidden rounded-tile bg-pitch-950 ${active ? "ring-2 ring-theme-primary" : ""}`}>
      <button
        type="button"
        onClick={onPreview}
        aria-label={`Preview ${item.name}`}
        className={`flex h-24 items-center justify-center bg-pitch-900/60 ${locked && !owned ? "opacity-60 grayscale-[35%]" : ""}`}
      >
        <ClubShirt kit={kit} label="27" size={64} />
      </button>
      <div className="flex flex-1 flex-col p-2.5 text-center">
        <p className="flex flex-wrap items-center justify-center gap-1.5 text-sm font-bold text-white">
          <span>{item.name}</span>
          <StarterTag item={item} />
        </p>
        {locked ? (
          <p className={`mt-1 text-xs font-semibold ${owned ? "text-theme-primary" : "text-amber-300"}`}>{owned ? "✓ Earned" : `🔒 Earn: ${locked}`}</p>
        ) : null}
        <div className="mt-auto pt-2">{footer}</div>
      </div>
    </li>
  );
}

export function KitStore({ balance }: { balance: number }) {
  const { c, message, open, sheet } = usePreviewBuy(balance);
  useEffect(() => {
    syncAchievementKits();
  }, []);
  const kitItem = COSMETICS.find((i) => i.id === KIT_DESIGNER_ID)!;
  const ownsKit = c.owned.includes(KIT_DESIGNER_ID);
  const kit = kitFromDesign(c.kit);
  const wearButton = (item: CosmeticItem) => {
    const active = c.equipped.kit === item.id;
    return active ? (
      <GameButton
        size="sm"
        variant="theme"
        onClick={() => {
          playThemeSelect();
          equipCosmetic("kit", null);
        }}
      >
        Wearing
      </GameButton>
    ) : (
      <GameButton
        size="sm"
        variant="secondary"
        onClick={() => {
          playThemeSelect();
          equipCosmetic("kit", item.id);
        }}
      >
        Wear
      </GameButton>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <StatusMessage message={message} />
      <Section title="Kits" intro="A ready-made shirt for your Classic team. Tap one to see it on your pitch.">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items("kit")
            .filter((i) => i.id !== KIT_DESIGNER_ID)
            .map((item) => {
              const owned = c.owned.includes(item.id);
              return (
                <KitCard
                  key={item.id}
                  item={item}
                  owned={owned}
                  active={c.equipped.kit === item.id}
                  onPreview={() => open(item)}
                  footer={owned ? wearButton(item) : <BuyButton item={item} balance={balance} onOpen={open} />}
                />
              );
            })}
        </ul>
      </Section>
      <Section title="Earned kits" intro="Never sold. Each one is earned by a feat in the game.">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ACHIEVEMENT_KITS.map((k) => {
            const item = cosmeticById(k.id);
            if (!item) return null;
            const owned = c.owned.includes(item.id);
            return (
              <KitCard
                key={item.id}
                item={item}
                owned={owned}
                active={c.equipped.kit === item.id}
                locked={k.earn}
                onPreview={() => open(item, { earn: k.earn })}
                footer={owned ? wearButton(item) : null}
              />
            );
          })}
        </ul>
      </Section>
      <Section title="Kit designer" intro="Design your own shirt. Your Classic team wears it.">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <span className="flex h-28 w-28 shrink-0 items-center justify-center rounded-tile bg-pitch-950">
            <ClubShirt kit={kit} label="27" size={92} />
          </span>
          {ownsKit ? (
            <label className="flex min-h-[44px] w-full flex-1 items-center justify-between gap-3 text-sm font-semibold text-white">
              Wear my kit
              <input
                type="checkbox"
                checked={c.kit.enabled}
                onChange={(e) => {
                  playUiClick();
                  setKitDesign({ enabled: e.target.checked });
                }}
                className="h-6 w-6 accent-[color:var(--theme-primary)]"
              />
            </label>
          ) : (
            <div className="flex-1">
              <p className="text-sm text-[color:var(--fl-muted)]">{kitItem.blurb}</p>
              <div className="mt-2">
                <BuyButton item={kitItem} balance={balance} onOpen={open} />
              </div>
            </div>
          )}
        </div>
        {ownsKit ? (
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-[color:var(--fl-muted)]">Pattern</p>
              <div className="mt-1.5 flex flex-wrap justify-center gap-2 sm:justify-start">
                {KIT_PATTERNS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={c.kit.pattern === p.id}
                    onClick={() => {
                      playUiClick();
                      setKitDesign({ pattern: p.id });
                    }}
                    className={`min-h-[40px] min-w-[44px] rounded-full px-3.5 text-sm font-semibold ${c.kit.pattern === p.id ? "bg-theme-primary text-[color:var(--theme-text-on-primary)]" : "bg-pitch-800 text-white"}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {(["body", "trim"] as const).map((part) => (
              <div key={part}>
                <p className="text-xs font-semibold text-[color:var(--fl-muted)]">{part === "body" ? "Main colour" : "Second colour"}</p>
                <div className="mt-1.5 flex flex-wrap justify-center gap-2 sm:justify-start">
                  {KIT_COLOURS.map((col) => (
                    <Swatch
                      key={col.hex}
                      hex={col.hex}
                      label={`${part === "body" ? "Main" : "Second"} colour ${col.name}`}
                      selected={c.kit[part] === col.hex}
                      onClick={() => {
                        playUiClick();
                        setKitDesign({ [part]: col.hex });
                      }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Section>
      {sheet}
    </div>
  );
}

export function PitchStore({ balance }: { balance: number }) {
  const { c, message, open, sheet } = usePreviewBuy(balance);
  const activePitch = pitchStyleForItem(c.equipped.pitch);

  return (
    <div className="flex flex-col gap-3">
      <StatusMessage message={message} />
      <Section title="Pitch styles" intro="The pitch under your team sheet. Tap one to preview it.">
        <ul className="grid grid-cols-2 gap-3">
          {(["classic", ...items("pitch").map((i) => i.id)] as string[]).map((id) => {
            const item = id === "classic" ? null : COSMETICS.find((i) => i.id === id)!;
            const styleId = id === "classic" ? "classic" : pitchStyleForItem(id);
            const look = PITCH_STYLES[styleId];
            const owned = !item || c.owned.includes(item.id);
            const active = activePitch === styleId;
            return (
              <li key={id} className="overflow-hidden rounded-tile bg-pitch-950">
                <button
                  type="button"
                  aria-label={`Preview ${look.label}`}
                  onClick={() => (item ? open(item) : undefined)}
                  className="relative block h-20 w-full"
                  style={{ background: look.background }}
                >
                  <span className="absolute left-0 right-0 top-1/2 h-[2px]" style={{ background: look.line }} />
                </button>
                <div className="p-2.5 text-center">
                  <p className="flex flex-wrap items-center justify-center gap-1.5 text-sm font-bold text-white">
                    <span>{look.label}</span>
                    <StarterTag item={item} />
                  </p>
                  <div className="mt-2">
                    {owned && active ? (
                      <InUseBadge />
                    ) : owned ? (
                      <GameButton
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          playThemeSelect();
                          equipCosmetic("pitch", item ? item.id : null);
                        }}
                      >
                        Use
                      </GameButton>
                    ) : (
                      <BuyButton item={item!} balance={balance} onOpen={open} />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>
      {sheet}
    </div>
  );
}

export function TitlesStore({ balance }: { balance: number }) {
  const { c, message, open, sheet } = usePreviewBuy(balance);
  return (
    <Section title="Coach titles" intro="Shown next to your name on every leaderboard. Tap one to preview it.">
      <div className="mb-2">
        <StatusMessage message={message} />
      </div>
      <ul className="divide-y divide-[color:var(--fl-line)]">
        {items("title").map((item) => {
          const owned = c.owned.includes(item.id);
          const active = c.equipped.title === item.id;
          return (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <button
                type="button"
                onClick={() => open(item)}
                aria-label={`Preview ${item.name}`}
                className="flex min-h-[40px] min-w-0 flex-1 flex-wrap items-center gap-1.5 text-left"
              >
                <span className="inline-flex rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-bold text-amber-300">{item.name}</span>
                <StarterTag item={item} />
              </button>
              {owned ? (
                <GameButton
                  size="sm"
                  fullWidth={false}
                  variant={active ? "theme" : "secondary"}
                  onClick={() => {
                    playThemeSelect();
                    equipCosmetic("title", active ? null : item.id);
                  }}
                >
                  {active ? "Wearing" : "Wear"}
                </GameButton>
              ) : (
                <BuyButton item={item} balance={balance} onOpen={open} />
              )}
            </li>
          );
        })}
      </ul>
      {sheet}
    </Section>
  );
}

export function FramesStore({ balance }: { balance: number }) {
  const { c, message, open, sheet } = usePreviewBuy(balance);
  return (
    <Section title="Leaderboard frames" intro="Frame your row on every leaderboard. Tap one to preview it.">
      <div className="mb-2">
        <StatusMessage message={message} />
      </div>
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {items("frame").map((item) => {
          const owned = c.owned.includes(item.id);
          const active = c.equipped.frame === item.id;
          return (
            <li key={item.id} className="flex flex-col gap-2 rounded-control bg-pitch-800 p-2.5">
              <button
                type="button"
                onClick={() => open(item)}
                aria-label={`Preview ${item.name}`}
                className={`grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-tile px-3 py-2.5 text-left ${frameRowClass(item.id)}`}
              >
                <span className="font-display text-sm text-accent-gold">1</span>
                <span className="truncate text-sm font-bold text-white">You</span>
                <span className="text-sm font-semibold text-accent-gold">27-0</span>
              </button>
              <div className="flex items-center justify-between gap-2">
                <p className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-bold text-white">
                  <span>{item.name}</span>
                  <StarterTag item={item} />
                </p>
              {owned ? (
                <GameButton
                  size="sm"
                  fullWidth={false}
                  variant={active ? "theme" : "secondary"}
                  onClick={() => {
                    playThemeSelect();
                    equipCosmetic("frame", active ? null : item.id);
                  }}
                >
                  {active ? "On" : "Use"}
                </GameButton>
              ) : (
                <BuyButton item={item} balance={balance} onOpen={open} />
              )}
              </div>
            </li>
          );
        })}
      </ul>
      {sheet}
    </Section>
  );
}

export function ModesStore(props: { balance: number }) {
  void props; // Modes are earned by challenges (v1.50), so the balance isn't needed here.
  const c = useCosmetics();
  useEffect(() => {
    syncModeUnlocks();
  }, []);
  return (
    <Section title="More modes" intro="Earned by challenges, not bought. Unranked.">
      <ul className="space-y-2">
        {MODE_UNLOCKS.map((m) => {
          const owned = c.owned.includes(m.id);
          return (
            <li key={m.id} className="rounded-control bg-pitch-950 px-3 py-2.5 text-center">
              <p className="text-[15px] font-bold text-white">{m.name}</p>
              <p className={`mt-0.5 text-sm font-semibold ${owned ? "text-theme-primary" : "text-[color:var(--fl-muted)]"}`}>
                {owned ? "✓ Unlocked" : `🔒 ${m.text}`}
              </p>
            </li>
          );
        })}
      </ul>
      <Link
        href={MODES_PAGE}
        className="btn-press mt-3 flex h-11 items-center justify-center rounded-control bg-pitch-800 text-sm font-bold text-white"
      >
        Go to More modes
      </Link>
    </Section>
  );
}

/** "In use" state: a check badge, not a disabled button that looks tappable. */
export function InUseBadge({ label = "In use" }: { label?: string }) {
  return (
    <span className="flex min-h-[36px] items-center justify-center gap-1.5 rounded-control bg-theme-primary/15 px-3 text-sm font-bold text-theme-primary">
      <span aria-hidden>✓</span>
      {label}
    </span>
  );
}
