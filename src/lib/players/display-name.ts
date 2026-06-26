/** Short label for compact pitch slots (surname-first on mobile team sheets). */
export function formatPitchSlotPlayerName(
  name: string,
  compact = false
): string {
  const trimmed = name.trim();
  if (!compact) return trimmed;

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return trimmed;

  const surname = parts[parts.length - 1]!;
  if (surname.length <= 11) return surname;

  const initial = parts[0]![0] ?? "";
  const clipped = surname.length > 9 ? `${surname.slice(0, 8)}…` : surname;
  return initial ? `${initial}. ${clipped}` : clipped;
}
