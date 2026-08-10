import type { EvidenceSource } from "./types.js";

export const EVIDENCE_SOURCE_LABELS: Record<EvidenceSource, string> = {
  SEARCH_CONSOLE: "Search Console",
  GA4: "Google Analytics 4",
  MERCHANT_CENTER: "Google Merchant Center",
  CRAWLER: "observações do crawler",
  STRUCTURED_DATA: "dados estruturados",
  STATIC_ASSUMPTION: "suposições do setor",
};

export const EVIDENCE_ORDER: EvidenceSource[] = [
  "SEARCH_CONSOLE",
  "GA4",
  "MERCHANT_CENTER",
  "CRAWLER",
  "STRUCTURED_DATA",
  "STATIC_ASSUMPTION",
];

export const MISSING_CLIENT_SOURCES: EvidenceSource[] = [
  "SEARCH_CONSOLE",
  "GA4",
  "MERCHANT_CENTER",
];
