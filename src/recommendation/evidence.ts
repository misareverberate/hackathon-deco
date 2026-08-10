import type {
  EvidenceLevel,
  EvidenceResult,
  EvidenceSource,
} from "./types.js";
import type { ImpactConfig } from "./config/impactConfig.js";
import {
  EVIDENCE_ORDER,
  EVIDENCE_SOURCE_LABELS,
  MISSING_CLIENT_SOURCES,
} from "./evidenceSources.js";
import {
  explanation,
  input,
  missing as missingRationale,
  supporting,
} from "./explanation/explanationBuilder.js";

export {
  EVIDENCE_ORDER,
  EVIDENCE_SOURCE_LABELS,
  MISSING_CLIENT_SOURCES,
} from "./evidenceSources.js";

export function missingSources(
  sources: EvidenceSource[],
): EvidenceSource[] {
  return MISSING_CLIENT_SOURCES.filter(
    (source) => !sources.includes(source),
  );
}

export function primaryEvidenceLevel(
  sources: EvidenceSource[],
): EvidenceLevel {
  if (
    sources.includes("SEARCH_CONSOLE") ||
    sources.includes("GA4") ||
    sources.includes("MERCHANT_CENTER")
  ) {
    return "HIGH";
  }
  if (sources.includes("CRAWLER") || sources.includes("STRUCTURED_DATA")) {
    return "MEDIUM";
  }
  return "LOW";
}

export function describeSources(sources: EvidenceSource[]): string {
  if (sources.length === 0) {
    return "Sem fontes de evidência";
  }
  return EVIDENCE_ORDER.filter((source) => sources.includes(source))
    .map((source) => EVIDENCE_SOURCE_LABELS[source])
    .join(" + ");
}

export function evidenceExplanation(
  sources: EvidenceSource[],
  config: ImpactConfig,
): EvidenceResult {
  const level = primaryEvidenceLevel(sources);
  return {
    sources,
    missingSources: missingSources(sources),
    level,
    description: describeSources(sources),
    explanation: explanation(
      {
        metric: "evidence",
        summary: `Nível de evidência ${level} com base nas fontes disponíveis.`,
        formula:
          "primary = melhor fonte presente (Search Console/GA4/Merchant Center > crawler/dados estruturados > suposições)",
        inputs: sources.map((source) =>
          input(source, EVIDENCE_SOURCE_LABELS[source], "disponível"),
        ),
        rationale: [
          ...sources.map((source) => supporting(source)),
          ...missingSources(sources).map((source) => missingRationale(source)),
        ],
        assumptions: [
          "Fontes do cliente (Search Console, GA4, Merchant Center) elevam a confiança para HIGH.",
          "Sem integração com dados do cliente, o nível máximo é MEDIUM.",
        ],
      },
      config,
    ),
  };
}
