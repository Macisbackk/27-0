"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../supabase";
import { getAuthUserId } from "../auth-session";
import { COSMETICS, DEFAULT_KIT_DESIGN, KIT_COLOURS, KIT_PATTERNS, cosmeticById, type CosmeticKind, type KitDesign } from "../cosmetics";
import { getClubFundsBalance, spendClubFunds } from "./club-funds";
import { STORAGE_KEYS } from "./keys";

export const COSMETICS_CHANGED_EVENT = "27-0-cosmetics-changed";

export interface CosmeticsState {
  owned: string[];
  purchaseIds: string[];
  /** Equipped item id per slot (null = default). */
  equipped: { pitch: string | null; title: string | null; frame: string | null };
  kit: KitDesign & { enabled: boolean };
}

function empty(): CosmeticsState {
  return { owned: [], purchaseIds: [], equipped: { pitch: null, title: null, frame: null }, kit: { ...DEFAULT_KIT_DESIGN, enabled: false } };
}

const validColour = (c: unknown) => typeof c === "string" && KIT_COLOURS.some((k) => k.hex === c);

function normalize(raw: unknown): CosmeticsState {
  const base = empty();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<CosmeticsState>;
  const owned = Array.isArray(r.owned) ? [...new Set(r.owned.filter((id) => typeof id === "string" && cosmeticById(id)))] : [];
  const equipFor = (kind: CosmeticKind, id: unknown) =>
    typeof id === "string" && owned.includes(id) && cosmeticById(id)?.kind === kind ? id : null;
  const kit = r.kit && typeof r.kit === "object" ? r.kit : base.kit;
  return {
    owned,
    purchaseIds: Array.isArray(r.purchaseIds) ? r.purchaseIds.filter((id) => typeof id === "string") : [],
    equipped: {
      pitch: equipFor("pitch", r.equipped?.pitch),
      title: equipFor("title", r.equipped?.title),
      frame: equipFor("frame", r.equipped?.frame),
    },
    kit: {
      pattern: KIT_PATTERNS.some((p) => p.id === kit.pattern) ? kit.pattern : base.kit.pattern,
      body: validColour(kit.body) ? kit.body : base.kit.body,
      trim: validColour(kit.trim) ? kit.trim : base.kit.trim,
      enabled: Boolean(kit.enabled) && owned.includes("kit-designer"),
    },
  };
}

export function getCosmetics(): CosmeticsState {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.cosmeticsStore);
    return raw ? normalize(JSON.parse(raw)) : empty();
  } catch {
    return empty();
  }
}

function save(state: CosmeticsState, { cloud = true } = {}) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.cosmeticsStore, JSON.stringify(state));
  } catch {
    /* storage full / blocked */
  }
  window.dispatchEvent(new CustomEvent(COSMETICS_CHANGED_EVENT));
  if (cloud) void saveCloud(state);
}

export const ownsCosmetic = (id: string) => getCosmetics().owned.includes(id);

export interface CosmeticPurchaseResult {
  success: boolean;
  reason?: "insufficient" | "owned" | "invalid";
  newBalance: number;
}

export function purchaseCosmetic(id: string): CosmeticPurchaseResult {
  const item = cosmeticById(id);
  if (!item || item.notForSale) return { success: false, reason: "invalid", newBalance: getClubFundsBalance() };
  const state = getCosmetics();
  if (state.owned.includes(id)) return { success: false, reason: "owned", newBalance: getClubFundsBalance() };
  const purchaseId = `cosmetic-${id}`;
  if (!state.purchaseIds.includes(purchaseId)) {
    const spend = spendClubFunds(item.price, purchaseId);
    if (!spend.success) return { success: false, reason: "insufficient", newBalance: spend.newBalance };
    state.purchaseIds.push(purchaseId);
  }
  state.owned.push(id);
  // New pitch / title / frame goes straight on; the kit designer switches your kit on.
  if (item.kind === "pitch" || item.kind === "title" || item.kind === "frame") state.equipped[item.kind] = id;
  if (item.kind === "kit") state.kit.enabled = true;
  save(state);
  if (item.kind === "title") void publishFlair({ flair: id });
  if (item.kind === "frame") void publishFlair({ frame: id });
  return { success: true, newBalance: getClubFundsBalance() };
}

/**
 * Give an item without charging (login welcome gift, promotions). Saves and syncs to the cloud
 * like a purchase, and puts a pitch / title / frame on when that slot is empty. Returns true when
 * the item was newly added.
 */
export function grantCosmetic(id: string): boolean {
  const item = cosmeticById(id);
  if (!item) return false;
  const state = getCosmetics();
  if (state.owned.includes(id)) return false;
  state.owned.push(id);
  if ((item.kind === "pitch" || item.kind === "title" || item.kind === "frame") && !state.equipped[item.kind]) {
    state.equipped[item.kind] = id;
    save(state);
    if (item.kind === "title") void publishFlair({ flair: id });
    if (item.kind === "frame") void publishFlair({ frame: id });
    return true;
  }
  save(state);
  return true;
}

export function equipCosmetic(kind: "pitch" | "title" | "frame", id: string | null) {
  const state = getCosmetics();
  if (id && (!state.owned.includes(id) || cosmeticById(id)?.kind !== kind)) return;
  state.equipped[kind] = id;
  save(state);
  if (kind === "title") void publishFlair({ flair: id });
  if (kind === "frame") void publishFlair({ frame: id });
}

export function setKitDesign(patch: Partial<KitDesign & { enabled: boolean }>) {
  const state = getCosmetics();
  if (!state.owned.includes("kit-designer")) return;
  // Apply only valid fields; anything invalid keeps the current choice.
  if (patch.pattern && KIT_PATTERNS.some((p) => p.id === patch.pattern)) state.kit.pattern = patch.pattern;
  if (validColour(patch.body)) state.kit.body = patch.body!;
  if (validColour(patch.trim)) state.kit.trim = patch.trim!;
  if (typeof patch.enabled === "boolean") state.kit.enabled = patch.enabled;
  save(state);
}

/** React hook: current cosmetics, re-rendering when anything changes. */
export function useCosmetics(): CosmeticsState {
  const [state, setState] = useState<CosmeticsState>(empty);
  useEffect(() => {
    const read = () => setState(getCosmetics());
    read();
    window.addEventListener(COSMETICS_CHANGED_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(COSMETICS_CHANGED_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return state;
}

/* ------------------------------------------------------------------------ cloud */

const STAT_MODE = "GLOBAL";
const STAT_KEY = "cosmetics_store";

async function saveCloud(state: CosmeticsState) {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;
  try {
    await supabase.from("user_stats").upsert(
      { user_id: userId, mode: STAT_MODE, stat_key: STAT_KEY, stat_value: state.owned.length, stat_json: state, updated_at: new Date().toISOString() },
      { onConflict: "user_id,mode,stat_key" }
    );
  } catch {
    /* offline: next change retries */
  }
}

/** Show the equipped title to other players (profiles.flair; silently skipped until that column exists). */
/** Title and frame are public on the coach's profile so leaderboards can show them. */
async function publishFlair(patch: { flair?: string | null; frame?: string | null }) {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;
  try {
    const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
    // Database without the frame column yet: still save the title.
    if (error && patch.frame !== undefined && patch.flair !== undefined) {
      await supabase.from("profiles").update({ flair: patch.flair }).eq("id", userId);
    }
  } catch {
    /* column not added yet */
  }
}

/**
 * Union of local and cloud cosmetics (cloud's equipped choices win when owned). Pure, for tests.
 */
export function mergeCosmeticsStates(localRaw: unknown, cloudRaw: unknown): CosmeticsState {
  const local = normalize(localRaw);
  const cloud = normalize(cloudRaw);
  return normalize({
    owned: [...new Set([...local.owned, ...cloud.owned])],
    purchaseIds: [...new Set([...local.purchaseIds, ...cloud.purchaseIds])],
    equipped: {
      pitch: cloud.equipped.pitch ?? local.equipped.pitch,
      title: cloud.equipped.title ?? local.equipped.title,
      frame: cloud.equipped.frame ?? local.equipped.frame,
    },
    kit: cloud.owned.includes("kit-designer") ? cloud.kit : local.kit,
  });
}

/**
 * On login: union of owned items, cloud's equipped choices win when owned.
 *
 * Rejects (and leaves both copies alone) when the cloud read fails. It used to ignore the
 * Supabase `error`, treat the row as empty and save + upload the local copy, so one failed read
 * on a new device overwrote the account's cloud cosmetics with an empty store — and the login
 * welcome (which waits for this to succeed) went ahead on a bad read.
 */
export async function mergeCosmeticsFromCloud(): Promise<void> {
  const userId = getAuthUserId();
  if (!userId || !isSupabaseConfigured) return;
  const { data, error } = await supabase
    .from("user_stats")
    .select("stat_json")
    .eq("user_id", userId)
    .eq("mode", STAT_MODE)
    .eq("stat_key", STAT_KEY)
    .maybeSingle();
  if (error) throw error;
  try {
    const cloud = normalize(data?.stat_json ?? null);
    const local = getCosmetics();
    const merged = mergeCosmeticsStates(local, cloud);
    save(merged);
    if (merged.equipped.title || merged.equipped.frame) {
      void publishFlair({ flair: merged.equipped.title ?? null, frame: merged.equipped.frame ?? null });
    }
  } catch {
    /* keep local */
  }
}

export const ALL_COSMETICS = COSMETICS;
