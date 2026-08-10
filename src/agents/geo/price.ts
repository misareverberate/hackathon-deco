export function parseBrlPrice(value: string | undefined | null): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  const cleaned = value
    .replace(/[^\d.,]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
