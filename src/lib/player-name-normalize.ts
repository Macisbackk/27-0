/**
 * Canonical player name keys for duplicate detection across data files.
 */
export function normalizePlayerNameKey(name: string): string {
  let key = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");

  if (key.startsWith("gary ")) {
    key = `garry ${key.slice(5)}`;
  }

  // Mick / Mickey short-name variants (e.g. Mick Higham = Mickey Higham)
  if (key.startsWith("mick ")) {
    key = `mickey ${key.slice(5)}`;
  }

  return key;
}
