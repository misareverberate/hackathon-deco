export function isAvailableForPurchase(value?: string): boolean {
  if (!value) return false;
  const normalized = value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
  if (
    normalized.includes("outofstock") ||
    normalized.includes("soldout") ||
    normalized.includes("discontinued") ||
    normalized.includes("esgotado") ||
    normalized.includes("indisponivel")
  ) {
    return false;
  }
  return normalized.includes("instock") || normalized.includes("emestoque") ||
    normalized === "available" || normalized === "disponivel";
}
