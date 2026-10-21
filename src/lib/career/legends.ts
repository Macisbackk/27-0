/** Extracted from data/legends.json + historic-players.json (category "legend"); see scripts/build-career-legends.py. */
import legendsData from "./legends-data.json";
import type { CareerPlayer, Pos } from "./types";

type Row = { name: string; peakRating?: number; position?: string | null; club?: string; nationality?: string };

export interface LegendCard {
  id: string;
  name: string;
  pos: Pos;
  peak: number;
  club: string;
  nationality: string;
  /** Legacy points to unlock (permanent, all careers). */
  unlockCost: number;
  /** One-off transfer fee to sign in a career once unlocked. */
  signingFee: number;
}

const POS_WORDS: Record<string, Pos> = {
  fullback: "FB",
  wing: "WG",
  centre: "CE",
  "stand-off": "SO",
  stand_off: "SO",
  "scrum-half": "SH",
  scrum_half: "SH",
  prop: "PR",
  hooker: "HK",
  "second row": "SR",
  second_row: "SR",
  "loose forward": "LF",
  loose_forward: "LF",
};

function legendPos(position: string | null | undefined): Pos {
  return POS_WORDS[(position ?? "").toLowerCase()] ?? "SR";
}

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function tier(peak: number): { unlockCost: number; signingFee: number } {
  if (peak >= 96) return { unlockCost: 300, signingFee: 500_000 };
  if (peak >= 93) return { unlockCost: 200, signingFee: 300_000 };
  return { unlockCost: 120, signingFee: 150_000 };
}

let cache: LegendCard[] | null = null;

/** Every legend available in the Legend Vault, strongest first. */
export function legendCatalog(): LegendCard[] {
  if (cache) return cache;
  const rows = legendsData as Row[];
  const byName = new Map<string, LegendCard>();
  for (const r of rows) {
    const peak = r.peakRating ?? 90;
    const existing = byName.get(r.name);
    if (existing && existing.peak >= peak) continue;
    byName.set(r.name, {
      id: slug(r.name),
      name: r.name,
      pos: legendPos(r.position),
      peak,
      club: r.club ?? "",
      nationality: r.nationality ?? "England",
      ...tier(peak),
    });
  }
  cache = [...byName.values()].sort((a, b) => b.peak - a.peak || a.name.localeCompare(b.name));
  return cache;
}

export function legendById(id: string): LegendCard | undefined {
  return legendCatalog().find((l) => l.id === id);
}

/** A legend as a signable career player: a few years past peak, still elite. */
export function legendAsPlayer(card: LegendCard): CareerPlayer {
  const rating = Math.min(94, card.peak - 3);
  return {
    id: `legend-${card.id}`,
    name: card.name,
    pos: card.pos,
    rating,
    potential: rating,
    age: 30,
    nationality: card.nationality,
    real: true,
    legend: true,
    apps: 0,
    tries: 0,
    careerApps: 0,
    careerTries: 0,
  };
}
