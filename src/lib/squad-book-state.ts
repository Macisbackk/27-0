/**
 * The collected Squad Book cards, read-only, for pages that only show them (home "Squad Book"
 * count, profile, records). lib/squad-book.ts imports the player database for its catalog, so
 * importing its hook put the whole database into those pages' first-load JS. This reads the
 * same storage and keeps the cards normalizeSquadBook would keep (keep the two in step).
 */
import { useEffect, useState } from "react";
import type { SquadBookEntry, SquadBookSource, SquadBookState } from "./squad-book";
import { STORAGE_KEYS } from "./storage/keys";

/** Same value as SQUAD_BOOK_CHANGED_EVENT in lib/squad-book.ts. */
export const SQUAD_BOOK_STATE_CHANGED_EVENT = "27-0-squad-book-changed";

export type SquadBookCards = Pick<SquadBookState, "cards">;

const SOURCES: SquadBookSource[] = ["classic", "era", "daily", "weekly"];

function normalizeEntry(raw: unknown): SquadBookEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<SquadBookEntry>;
  if (typeof r.name !== "string" || !r.name) return null;
  return {
    name: r.name,
    club: typeof r.club === "string" ? r.club : "",
    year: typeof r.year === "number" && Number.isFinite(r.year) ? r.year : null,
    firstAt: typeof r.firstAt === "number" && Number.isFinite(r.firstAt) ? r.firstAt : 0,
    source: SOURCES.includes(r.source as SquadBookSource) ? (r.source as SquadBookSource) : "classic",
    times: typeof r.times === "number" && r.times > 0 ? Math.floor(r.times) : 1,
  };
}

export function normalizeSquadBookCards(raw: unknown): SquadBookCards {
  const cards: Record<string, SquadBookEntry> = {};
  const r = raw && typeof raw === "object" ? (raw as Partial<SquadBookState>) : null;
  if (r?.cards && typeof r.cards === "object") {
    for (const [id, value] of Object.entries(r.cards)) {
      const entry = normalizeEntry(value);
      if (id && entry) cards[id] = entry;
    }
  }
  return { cards };
}

export function readSquadBookCards(): SquadBookCards {
  if (typeof window === "undefined") return { cards: {} };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.squadBook);
    return raw ? normalizeSquadBookCards(JSON.parse(raw)) : { cards: {} };
  } catch {
    return { cards: {} };
  }
}

/** React hook: the collected cards, re-rendering on change (like useSquadBook, without the catalog). */
export function useSquadBookState(): SquadBookCards {
  const [state, setState] = useState<SquadBookCards>(() => ({ cards: {} }));
  useEffect(() => {
    const read = () => setState(readSquadBookCards());
    read();
    window.addEventListener(SQUAD_BOOK_STATE_CHANGED_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(SQUAD_BOOK_STATE_CHANGED_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  return state;
}
