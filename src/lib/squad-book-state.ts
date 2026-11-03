/**
 * Read-only Squad Book state for pages that only show it (home "Squad Book" count, profile,
 * records). lib/squad-book.ts imports the player database for its catalog, so importing its
 * hook put the whole database into those pages' first-load JS. This mirrors getSquadBook /
 * normalizeSquadBook / useSquadBook there: keep the two in step.
 */
import { useEffect, useState } from "react";
import type { SquadBookEntry, SquadBookSource, SquadBookState } from "./squad-book";
import { STORAGE_KEYS } from "./storage/keys";

/** Same value as SQUAD_BOOK_CHANGED_EVENT in lib/squad-book.ts. */
export const SQUAD_BOOK_STATE_CHANGED_EVENT = "27-0-squad-book-changed";

const MAX_RUN_IDS = 100;
const SOURCES: SquadBookSource[] = ["classic", "era", "daily", "weekly"];

function empty(): SquadBookState {
  return { v: 1, cards: {}, claimed: [], runs: [] };
}

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

export function normalizeSquadBookState(raw: unknown): SquadBookState {
  const base = empty();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<SquadBookState>;
  if (r.cards && typeof r.cards === "object") {
    for (const [id, value] of Object.entries(r.cards)) {
      const entry = normalizeEntry(value);
      if (id && entry) base.cards[id] = entry;
    }
  }
  if (Array.isArray(r.claimed)) base.claimed = [...new Set(r.claimed.filter((id): id is string => typeof id === "string"))];
  if (Array.isArray(r.runs)) base.runs = [...new Set(r.runs.filter((id): id is string => typeof id === "string"))].slice(-MAX_RUN_IDS);
  return base;
}

export function readSquadBookState(): SquadBookState {
  if (typeof window === "undefined") return empty();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.squadBook);
    return raw ? normalizeSquadBookState(JSON.parse(raw)) : empty();
  } catch {
    return empty();
  }
}

/** React hook: the book, re-rendering on change (same as useSquadBook, without the catalog). */
export function useSquadBookState(): SquadBookState {
  const [state, setState] = useState<SquadBookState>(empty);
  useEffect(() => {
    const read = () => setState(readSquadBookState());
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
