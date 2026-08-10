/**
 * Local derbies and historic rivalries — used for attendance, calendar
 * highlights, board inbox, Magic Weekend pairing, and transfer bias.
 *
 * Championship entries are based on named RFL derbies (Heavy Woollen,
 * Cumbrian, East Lancashire / Law Cup, South Yorkshire, Salford) plus
 * 2026 Championship local fixtures called out by rugby-league.com.
 * Cross-tier pairs are included where clubs still meet in Challenge Cup.
 */
export const RIVAL_CLUBS: Record<string, string[]> = {
  // —— Super League ——
  "Wigan Warriors": ["St Helens", "Leigh Leopards"],
  "St Helens": ["Wigan Warriors", "Leigh Leopards", "Warrington Wolves"],
  "Leigh Leopards": ["Wigan Warriors", "St Helens"],
  "Leeds Rhinos": ["Bradford Bulls", "Hunslet RLFC"],
  "Bradford Bulls": ["Leeds Rhinos"],
  "Hull FC": ["Hull KR"],
  "Hull KR": ["Hull FC"],
  "Castleford Tigers": ["Wakefield Trinity"],
  "Wakefield Trinity": ["Castleford Tigers"],
  // Cheshire Derby (Warrington ↔ Widnes) + Locker Cup neighbours
  "Warrington Wolves": ["St Helens", "Wigan Warriors", "Widnes Vikings"],
  "Toulouse Olympique": ["Catalans Dragons"],
  "Catalans Dragons": ["Toulouse Olympique"],
  // Roses neighbour + West Yorkshire
  "Huddersfield Giants": ["York Knights", "Halifax Panthers"],
  "York Knights": ["Huddersfield Giants"],

  // —— Championship ——
  // Heavy Woollen Derby
  "Batley Bulldogs": ["Dewsbury Rams"],
  "Dewsbury Rams": ["Batley Bulldogs", "Hunslet RLFC"],

  // Cumbrian Derby + Barrow triangle
  "Whitehaven RLFC": ["Workington Town", "Barrow Raiders"],
  "Workington Town": ["Whitehaven RLFC", "Barrow Raiders"],
  "Barrow Raiders": ["Whitehaven RLFC", "Workington Town"],

  // East Lancashire Derby (Law Cup) + Greater Manchester neighbours + Roses
  "Oldham RLFC": ["Rochdale Hornets", "Salford RLFC", "Halifax Panthers"],
  "Rochdale Hornets": ["Oldham RLFC", "Swinton Lions"],

  // South Yorkshire Derby
  "Sheffield Eagles": ["Doncaster RLFC"],
  "Doncaster RLFC": ["Sheffield Eagles"],

  // Salford Derby + Oldham neighbours
  "Salford RLFC": ["Swinton Lions", "Oldham RLFC"],
  "Swinton Lions": ["Salford RLFC", "Rochdale Hornets"],

  // Leeds Derby (cross-tier with Rhinos) + West Yorkshire / former L1 locals
  "Hunslet RLFC": ["Leeds Rhinos", "Dewsbury Rams", "Keighley Cougars"],
  "Keighley Cougars": ["Hunslet RLFC"],

  // Cheshire Derby (cross-tier with Warrington)
  "Widnes Vikings": ["Warrington Wolves"],

  // Roses / West Yorkshire neighbours
  "Halifax Panthers": ["Huddersfield Giants", "Oldham RLFC"],

  // Former League One title-path rivals (2025–26 expansion cohort)
  "North Wales Crusaders": ["Midlands Hurricanes"],
  "Midlands Hurricanes": ["North Wales Crusaders"],
};

export function areRivalClubs(clubA: string, clubB: string): boolean {
  if (clubA === clubB) return false;
  return (
    (RIVAL_CLUBS[clubA]?.includes(clubB) ?? false) ||
    (RIVAL_CLUBS[clubB]?.includes(clubA) ?? false)
  );
}

/** Named rivals for a club (empty if none configured). */
export function getRivalClubs(clubName: string): string[] {
  return RIVAL_CLUBS[clubName] ?? [];
}
