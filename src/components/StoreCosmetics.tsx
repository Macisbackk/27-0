"use client";

import Link from "next/link";
import { frameRowClass } from "@/lib/coach-flair";
import { useState, type ReactNode } from "react";
import { ClubShirt } from "@/components/ClubShirt";
import { GameButton } from "@/components/ui/GameButton";
import { formatClubFunds } from "@/lib/club-funds";
import {
  BALL_KNOWER_ID,
  COSMETICS,
  KIT_COLOURS,
  KIT_DESIGNER_ID,
  KIT_PATTERNS,
  PITCH_STYLES,
  cosmeticsOfKind,
  kitFromDesign,
  pitchStyleForItem,
  type CosmeticItem,
} from "@/lib/cosmetics";
import { equipCosmetic, purchaseCosmetic, setKitDesign, useCosmetics } from "@/lib/storage/cosmetics-store";
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

function useBuy(balance: number) {
  const [message, setMessage] = useState<string | null>(null);
  const buy = (item: CosmeticItem) => {
    playUiClick();
    const r = purchaseCosmetic(item.id);
    if (r.success) {
      playThemePurchaseSuccess();
      setMessage(`${item.name} unlocked.`);
    } else {
      playThemePurchaseFail();
      setMessage(r.reason === "insufficient" ? `You need ${formatClubFunds(item.price - balance)} more for ${item.name}.` : null);
    }
  };
  return { message, buy };
}

function BuyButton({ item, balance, onBuy }: { item: CosmeticItem; balance: number; onBuy: (i: CosmeticItem) => void }) {
  const canAfford = balance >= item.price;
  return (
    <GameButton size="sm" fullWidth={false} variant={canAfford ? "theme" : "secondary"} disabled={!canAfford} onClick={() => onBuy(item)}>
      {canAfford ? `Buy · ${formatClubFunds(item.price)}` : `${formatClubFunds(item.price)}`}
    </GameButton>
  );
}

function Section({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <section className="rounded-card bg-pitch-900 p-4 text-left">
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
      className={`h-9 w-9 rounded-full border-2 ${selected ? "border-theme-primary ring-2 ring-theme-primary/40" : "border-white/20"}`}
      style={{ background: hex }}
    />
  );
}

export function KitStore({ balance }: { balance: number }) {
  const c = useCosmetics();
  const { message, buy } = useBuy(balance);
  const kitItem = COSMETICS.find((i) => i.id === KIT_DESIGNER_ID)!;
  const ownsKit = c.owned.includes(KIT_DESIGNER_ID);
  const kit = kitFromDesign(c.kit);

  return (
    <div className="flex flex-col gap-3">
      {message ? <p className="text-center text-sm text-theme-primary" role="status">{message}</p> : null}
      <Section title="Kit designer" intro="Design your own shirt. Your Classic team wears it.">
        <div className="flex items-center gap-4">
          <span className="flex h-28 w-28 shrink-0 items-center justify-center rounded-tile bg-pitch-950">
            <ClubShirt kit={kit} label="27" size={92} />
          </span>
          {ownsKit ? (
            <label className="flex min-h-[44px] flex-1 items-center justify-between gap-3 text-sm font-semibold text-white">
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
                <BuyButton item={kitItem} balance={balance} onBuy={buy} />
              </div>
            </div>
          )}
        </div>
        {ownsKit ? (
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-xs font-semibold text-[color:var(--fl-muted)]">Pattern</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {KIT_PATTERNS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={c.kit.pattern === p.id}
                    onClick={() => {
                      playUiClick();
                      setKitDesign({ pattern: p.id });
                    }}
                    className={`min-h-[40px] rounded-full px-3.5 text-sm font-semibold ${c.kit.pattern === p.id ? "bg-theme-primary text-[color:var(--theme-text-on-primary)]" : "bg-pitch-800 text-white"}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {(["body", "trim"] as const).map((part) => (
              <div key={part}>
                <p className="text-xs font-semibold text-[color:var(--fl-muted)]">{part === "body" ? "Main colour" : "Second colour"}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
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
    </div>
  );
}

export function PitchStore({ balance }: { balance: number }) {
  const c = useCosmetics();
  const { message, buy } = useBuy(balance);
  const activePitch = pitchStyleForItem(c.equipped.pitch);

  return (
    <div className="flex flex-col gap-3">
      {message ? <p className="text-center text-sm text-theme-primary" role="status">{message}</p> : null}
      <Section title="Pitch styles" intro="The pitch under your team sheet.">
        <ul className="grid grid-cols-2 gap-3">
          {(["classic", ...items("pitch").map((i) => i.id)] as string[]).map((id) => {
            const item = id === "classic" ? null : COSMETICS.find((i) => i.id === id)!;
            const styleId = id === "classic" ? "classic" : pitchStyleForItem(id);
            const look = PITCH_STYLES[styleId];
            const owned = !item || c.owned.includes(item.id);
            const active = activePitch === styleId;
            return (
              <li key={id} className="overflow-hidden rounded-tile bg-pitch-950">
                <div className="relative h-20" style={{ background: look.background }}>
                  <div className="absolute left-0 right-0 top-1/2 h-[2px]" style={{ background: look.line }} />
                </div>
                <div className="p-2.5">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-bold text-white">
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
                      <BuyButton item={item!} balance={balance} onBuy={buy} />
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>
    </div>
  );
}

export function TitlesStore({ balance }: { balance: number }) {
  const c = useCosmetics();
  const { message, buy } = useBuy(balance);
  return (
    <Section title="Coach titles" intro="Shown next to your name on every leaderboard.">
      {message ? <p className="mb-2 text-sm text-theme-primary" role="status">{message}</p> : null}
      <ul className="divide-y divide-[color:var(--fl-line)]">
        {items("title").map((item) => {
          const owned = c.owned.includes(item.id);
          const active = c.equipped.title === item.id;
          return (
            <li key={item.id} className="flex items-center gap-3 py-2.5">
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                <span className="inline-flex rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-bold text-amber-300">{item.name}</span>
                <StarterTag item={item} />
              </span>
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
                <BuyButton item={item} balance={balance} onBuy={buy} />
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

export function FramesStore({ balance }: { balance: number }) {
  const c = useCosmetics();
  const { message, buy } = useBuy(balance);
  return (
    <Section title="Leaderboard frames" intro="Frame your row on every leaderboard.">
      {message ? <p className="mb-2 text-sm text-theme-primary" role="status">{message}</p> : null}
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {items("frame").map((item) => {
          const owned = c.owned.includes(item.id);
          const active = c.equipped.frame === item.id;
          return (
            <li key={item.id} className="flex flex-col gap-2 rounded-control bg-pitch-800 p-2.5">
              <div className={`grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-tile px-3 py-2.5 ${frameRowClass(item.id)}`}>
                <span className="font-display text-sm text-accent-gold">1</span>
                <span className="truncate text-sm font-bold text-white">You</span>
                <span className="text-sm font-semibold text-accent-gold">27-0</span>
              </div>
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
                <BuyButton item={item} balance={balance} onBuy={buy} />
              )}
              </div>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

export function ModesStore({ balance }: { balance: number }) {
  const c = useCosmetics();
  const { message, buy } = useBuy(balance);
  const item = COSMETICS.find((i) => i.id === BALL_KNOWER_ID)!;
  const owned = c.owned.includes(item.id);
  return (
    <Section title="Ball Knower mode" intro="Classic with every rating hidden and no respins. Unranked.">
      {message ? <p className="mb-2 text-sm text-theme-primary" role="status">{message}</p> : null}
      {owned ? (
        <div className="grid grid-cols-2 gap-2">
          <Link href="/play?bk=1" className="btn-press flex h-11 items-center justify-center rounded-control bg-theme-primary text-sm font-bold text-[color:var(--theme-text-on-primary)]">
            Play Classic
          </Link>
          <Link href="/play?bk=1&era=1" className="btn-press flex h-11 items-center justify-center rounded-control bg-pitch-800 text-sm font-bold text-white">
            Play Era Classic
          </Link>
        </div>
      ) : (
        <BuyButton item={item} balance={balance} onBuy={buy} />
      )}
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
