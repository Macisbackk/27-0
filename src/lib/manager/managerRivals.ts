/** Local derbies and historic rivalries — used for attendance, transfers, etc. */
export const RIVAL_CLUBS: Record<string, string[]> = {
  "Wigan Warriors": ["St Helens", "Leigh Leopards"],
  "St Helens": ["Wigan Warriors", "Leigh Leopards", "Warrington Wolves"],
  "Leigh Leopards": ["Wigan Warriors", "St Helens"],
  "Leeds Rhinos": ["Bradford Bulls"],
  "Bradford Bulls": ["Leeds Rhinos"],
  "Hull FC": ["Hull KR"],
  "Hull KR": ["Hull FC"],
  "Castleford Tigers": ["Wakefield Trinity"],
  "Wakefield Trinity": ["Castleford Tigers"],
  "Warrington Wolves": ["St Helens", "Wigan Warriors"],
  "Toulouse Olympique": ["Catalans Dragons"],
  "Catalans Dragons": ["Toulouse Olympique"],
  "Huddersfield Giants": ["York Knights"],
  "York Knights": ["Huddersfield Giants"],
};

export function areRivalClubs(clubA: string, clubB: string): boolean {
  if (clubA === clubB) return false;
  return (
    (RIVAL_CLUBS[clubA]?.includes(clubB) ?? false) ||
    (RIVAL_CLUBS[clubB]?.includes(clubA) ?? false)
  );
}
