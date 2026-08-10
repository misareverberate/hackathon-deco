import type { KnowledgeBase } from "../../knowledge/knowledgeBuilder.js";
import type { ConfidenceResult, EvidenceSource, Opportunity } from "../types.js";
import type { ImpactConfig } from "../config/impactConfig.js";
import type { ScoredOpportunity } from "../priorityCalculator.js";
import { BusinessWeightResolver } from "./businessWeightResolver.js";
import { ReachEstimator } from "./reachEstimator.js";
import { ConfidenceEngine } from "./confidenceEngine.js";

export interface KnowledgeQuality {
  coverageQuality: number;
  freshness: number;
  completeness: number;
}

export interface ScoredImpact {
  opportunityId: string;
  opportunityScore: number;
  coverage: number;
  severity: number;
  businessWeight: number;
  reach: number;
  normalizedReach: number;
  confidence: ConfidenceResult;
}

export class OpportunityScorer {
  constructor(
    private readonly businessWeightResolver = new BusinessWeightResolver(),
    private readonly reachEstimator = new ReachEstimator(),
    private readonly confidenceEngine = new ConfidenceEngine(),
  ) {}

  maxReach(
    scored: ScoredOpportunity[],
    knowledge: KnowledgeBase,
    config: ImpactConfig,
  ): number {
    return scored.reduce((max, entry) => {
      const reach = this.reachEstimator.estimate(
        config,
        knowledge,
        entry.opportunity.affectedProductIds,
        entry.opportunity.affectedProducts,
      ).reach;
      return Math.max(max, reach);
    }, 0);
  }

  score(
    entry: ScoredOpportunity,
    knowledge: KnowledgeBase,
    config: ImpactConfig,
    maxReach: number,
    quality: KnowledgeQuality,
    sources: EvidenceSource[],
  ): ScoredImpact {
    const opportunity = entry.opportunity;
    const denominator = this.denominator(opportunity, knowledge);
    const affected = opportunity.affectedProducts ?? 0;
    const coverage =
      denominator > 0 ? this.clamp01(affected / denominator) : 0;

    const severity = config.weights.severity[opportunity.impact] ?? 0.5;
    const businessWeight = this.businessWeightResolver.resolve(
      config,
      opportunity.id,
    );

    const reachEstimate = this.reachEstimator.estimate(
      config,
      knowledge,
      opportunity.affectedProductIds,
      opportunity.affectedProducts,
    );
    const normalizedReach =
      maxReach > 0 ? this.clamp01(reachEstimate.reach / maxReach) : 0;

    const confidence = this.confidenceEngine.compute(
      {
        sources,
        ruleConfidence: opportunity.confidence,
        coverageQuality: quality.coverageQuality,
        freshness: quality.freshness,
        completeness: quality.completeness,
      },
      config,
    );

    const weights = config.weights.score;
    const raw =
      coverage * weights.coverage +
      severity * weights.severity +
      businessWeight * weights.business +
      normalizedReach * weights.reach +
      (confidence.score / 100) * weights.confidence;
    const opportunityScore = this.clamp(Math.round(raw * 100), 0, 100);

    return {
      opportunityId: opportunity.id,
      opportunityScore,
      coverage,
      severity,
      businessWeight,
      reach: this.round2(reachEstimate.reach),
      normalizedReach: this.round3(normalizedReach),
      confidence,
    };
  }

  denominator(opportunity: Opportunity, knowledge: KnowledgeBase): number {
    switch (opportunity.scope) {
      case "product":
      case "category":
      case "site":
        return knowledge.products.length;
      case "page":
        return knowledge.pages.length;
      default:
        return 1;
    }
  }

  private clamp01(value: number): number {
    return Math.min(Math.max(value, 0), 1);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private round3(value: number): number {
    return Math.round(value * 1000) / 1000;
  }
}
