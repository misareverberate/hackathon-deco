import type {
  ConfidenceLabel,
  ConfidenceResult,
  EvidenceSource,
} from "../types.js";
import type { ImpactConfig } from "../config/impactConfig.js";
import { EVIDENCE_SOURCE_LABELS, missingSources } from "../evidence.js";
import {
  explanation,
  input,
  missing as missingRationale,
  supporting,
  warning as warningRationale,
} from "../explanation/explanationBuilder.js";

export interface ConfidenceInput {
  sources: EvidenceSource[];
  ruleConfidence: number;
  coverageQuality: number;
  freshness: number;
  completeness: number;
}

export interface ConfidenceComponents {
  evidence: number;
  quality: number;
  rule: number;
}

export class ConfidenceEngine {
  compute(input: ConfidenceInput, config: ImpactConfig): ConfidenceResult {
    const base = this.baseSourceWeight(input.sources, config);
    const quality =
      (this.clamp(input.coverageQuality, 0, 1) +
        this.clamp(input.freshness, 0, 1) +
        this.clamp(input.completeness, 0, 1)) /
      3;
    const rule = this.clamp(input.ruleConfidence, 0, 100) / 100;

    const score = this.clamp(
      Math.round((base * 0.55 + quality * 0.25 + rule * 0.2) * 100),
      0,
      100,
    );
    const label = this.labelFor(score, config);
    const components: ConfidenceComponents = {
      evidence: this.round3(base),
      quality: this.round3(quality),
      rule: this.round3(rule),
    };

    return {
      label,
      score,
      quality: {
        coverageQuality: this.round3(input.coverageQuality),
        freshness: this.round3(input.freshness),
        completeness: this.round3(input.completeness),
      },
      explanation: this.explain(input, components, score, label, config),
    };
  }

  labelFor(score: number, config: ImpactConfig): ConfidenceLabel {
    if (score >= config.confidenceThresholds.high) {
      return "HIGH";
    }
    if (score >= config.confidenceThresholds.medium) {
      return "MEDIUM";
    }
    return "LOW";
  }

  private explain(
    data: ConfidenceInput,
    components: ConfidenceComponents,
    score: number,
    label: ConfidenceLabel,
    config: ImpactConfig,
  ): ConfidenceResult["explanation"] {
    const missing = missingSources(data.sources);
    return explanation(
      {
        metric: "confidence",
        summary: `Confiança ${label} (${score}/100) combinando evidência, qualidade dos dados e regra de detecção.`,
        formula:
          "score = base × 0,55 + qualidade × 0,25 + regra × 0,20 (base = fonte de maior peso)",
        inputs: [
          input(
            "evidence",
            "Evidência",
            this.percent(components.evidence),
            components.evidence,
            0.55,
          ),
          input(
            "quality",
            "Qualidade dos dados",
            this.percent(components.quality),
            components.quality,
            0.25,
          ),
          input(
            "rule",
            "Regra de detecção",
            this.percent(components.rule),
            components.rule,
            0.2,
          ),
        ],
        rationale: [
          ...data.sources.map((source) => supporting(source)),
          ...missing.map((source) => missingRationale(source)),
          ...(missing.length > 0
            ? [
                warningRationale(
                  "Sem dados do cliente, a confiança fica no limite entre MEDIUM e HIGH — conecte Search Console/GA4 para elevá-la de forma consistente.",
                ),
              ]
            : []),
        ],
        assumptions: [
          `Fontes consideradas: ${data.sources
            .map((source) => EVIDENCE_SOURCE_LABELS[source])
            .join(", ")}.`,
          "A base de evidência é a fonte de maior peso presente (ex.: Search Console eleva a confiança).",
          "Qualidade média de cobertura, frescor e completude dos dados.",
        ],
      },
      config,
    );
  }

  private baseSourceWeight(
    sources: EvidenceSource[],
    config: ImpactConfig,
  ): number {
    if (sources.length === 0) {
      return config.sourceWeights.STATIC_ASSUMPTION;
    }
    return Math.max(
      ...sources.map((source) => config.sourceWeights[source]),
    );
  }

  private percent(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private round3(value: number): number {
    return Math.round(value * 1000) / 1000;
  }
}
