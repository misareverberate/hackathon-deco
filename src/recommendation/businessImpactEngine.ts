import type { KnowledgeBase } from "../knowledge/knowledgeBuilder.js";
import type {
  BusinessImpact,
  EvidenceSource,
  ExecutiveSummaryModel,
  MetricExplanation,
} from "./types.js";
import type { ImpactConfig } from "./config/impactConfig.js";
import { classifyImpactLevel, loadConfigFromEnv, resolveConfig } from "./config/impactConfig.js";
import {
  derivePriority,
  type ScoredOpportunity,
} from "./priorityCalculator.js";
import {
  OpportunityScorer,
  type KnowledgeQuality,
} from "./scoring/opportunityScorer.js";
import { TrafficEstimator } from "./estimation/trafficEstimator.js";
import { RevenueEstimator } from "./estimation/revenueEstimator.js";
import { CostEstimator } from "./estimation/costEstimator.js";
import {
  Aggregator,
  computeOverlap,
  type AggregateItem,
} from "./estimation/aggregator.js";
import { ExecutiveSummaryBuilder } from "./report/executiveSummaryBuilder.js";
import { evidenceExplanation } from "./evidence.js";
import { explanation, input } from "./explanation/explanationBuilder.js";

export interface BusinessImpactModel {
  impacts: Record<string, BusinessImpact>;
  aggregate: ReturnType<Aggregator["aggregate"]>;
  summary: ExecutiveSummaryModel;
  config: ImpactConfig;
}

export interface ImpactContext {
  siteName: string;
  healthScore: number;
  estimatedScoreGain: number;
}

export class BusinessImpactEngine {
  constructor(
    private readonly config: ImpactConfig = resolveConfig(loadConfigFromEnv()),
    private readonly scorer = new OpportunityScorer(),
    private readonly trafficEstimator = new TrafficEstimator(),
    private readonly revenueEstimator = new RevenueEstimator(),
    private readonly costEstimator = new CostEstimator(),
    private readonly aggregator = new Aggregator(),
    private readonly summaryBuilder = new ExecutiveSummaryBuilder(),
  ) {}

  getConfig(): ImpactConfig {
    return this.config;
  }

  scoreOpportunities(
    knowledge: KnowledgeBase,
    scored: ScoredOpportunity[],
  ): ScoredOpportunity[] {
    const quality = this.computeKnowledgeQuality(knowledge);
    const sources = this.buildSources(knowledge);
    const maxReach = this.scorer.maxReach(scored, knowledge, this.config);
    return scored.map((entry) => {
      const scoredImpact = this.scorer.score(
        entry,
        knowledge,
        this.config,
        maxReach,
        quality,
        sources,
      );
      return {
        ...entry,
        score: scoredImpact.opportunityScore,
        priority: derivePriority(scoredImpact.opportunityScore),
      };
    });
  }

  run(
    knowledge: KnowledgeBase,
    scored: ScoredOpportunity[],
    context: ImpactContext,
  ): BusinessImpactModel {
    const config = this.config;
    const quality = this.computeKnowledgeQuality(knowledge);
    const sources = this.buildSources(knowledge);
    const evidence = evidenceExplanation(sources, config);
    const maxReach = this.scorer.maxReach(scored, knowledge, config);
    const idsPerEntry = scored.map(
      (entry) => entry.opportunity.affectedProductIds ?? [],
    );

    const calibratedConfig = this.calibrateConfig(config, knowledge);

    const impacts: Record<string, BusinessImpact> = {};
    const items: AggregateItem[] = scored.map((entry, index) => {
      const denominator = this.scorer.denominator(
        entry.opportunity,
        knowledge,
      );
      const scoredImpact = this.scorer.score(
        entry,
        knowledge,
        config,
        maxReach,
        quality,
        sources,
      );
      const traffic = this.trafficEstimator.estimate(
        calibratedConfig,
        entry.opportunity.affectedProducts,
        denominator,
        entry.opportunity.id,
      );
      const revenue = this.revenueEstimator.estimate(
        calibratedConfig,
        traffic.perYear,
      );
      const costAvoided = this.costEstimator.estimate(
        calibratedConfig,
        entry.opportunity,
      );

      const othersIds = idsPerEntry.flatMap((ids, otherIndex) =>
        otherIndex === index ? [] : ids,
      );
      const overlap = computeOverlap(
        entry.opportunity.affectedProductIds,
        othersIds,
      );
      const businessImpactLevel = classifyImpactLevel(
        scoredImpact.opportunityScore,
        config,
      );

      const impact: BusinessImpact = {
        opportunity: {
          score: scoredImpact.opportunityScore,
          coverage: this.round3(scoredImpact.coverage),
          severity: this.round3(scoredImpact.severity),
          businessWeight: this.round3(scoredImpact.businessWeight),
          reach: scoredImpact.reach,
          normalizedReach: this.round3(scoredImpact.normalizedReach),
          explanation: this.opportunityExplanation(scoredImpact, config),
        },
        businessImpactLevel,
        traffic,
        revenue,
        costAvoided,
        confidence: scoredImpact.confidence,
        evidence,
        overlap,
      };

      impacts[entry.opportunity.id] = impact;
      return {
        recommendationId: entry.opportunity.id,
        title: entry.opportunity.title,
        impact,
        affectedProductIds: entry.opportunity.affectedProductIds,
      };
    });

    const aggregate = this.aggregator.aggregate(items, config);
    const automaticActions = scored.filter(
      (entry) => entry.opportunity.automatable,
    ).length;

    const summary = this.summaryBuilder.build(
      {
        siteName: context.siteName,
        healthScore: context.healthScore,
        totalOpportunities: scored.length,
        estimatedScoreGain: context.estimatedScoreGain,
        automaticActions,
        manualActions: scored.length - automaticActions,
        aggregate,
      },
      config,
    );

    return { impacts, aggregate, summary, config };
  }

  private calibrateConfig(
    config: ImpactConfig,
    knowledge: KnowledgeBase,
  ): ImpactConfig {
    const total = knowledge.products.length;
    const catalogCount = knowledge.catalogCount;

    const organicOpportunityIndex =
      total > 0 && catalogCount !== undefined && catalogCount > 0
        ? Math.min(1, total / catalogCount)
        : config.assumptions.organicOpportunityIndex;

    return {
      ...config,
      assumptions: {
        ...config.assumptions,
        organicOpportunityIndex,
      },
    };
  }

  private opportunityExplanation(
    scored: {
      opportunityScore: number;
      coverage: number;
      severity: number;
      businessWeight: number;
      normalizedReach: number;
      confidence: { score: number };
    },
    config: ImpactConfig,
  ): MetricExplanation {
    const weights = config.weights.score;
    return explanation(
      {
        metric: "opportunityScore",
        summary: `Opportunity Score ${scored.opportunityScore}/100, prioridade estratégica derivada de cinco fatores.`,
        formula:
          "score = Σ fator × peso (cobertura 20%, severidade 20%, negócio 20%, alcance 25%, confiança 15%)",
        inputs: [
          input(
            "coverage",
            "Cobertura",
            this.percent(scored.coverage),
            scored.coverage,
            weights.coverage,
          ),
          input(
            "severity",
            "Severidade",
            this.percent(scored.severity),
            scored.severity,
            weights.severity,
          ),
          input(
            "business",
            "Peso de negócio",
            this.percent(scored.businessWeight),
            scored.businessWeight,
            weights.business,
          ),
          input(
            "reach",
            "Alcance",
            this.percent(scored.normalizedReach),
            scored.normalizedReach,
            weights.reach,
          ),
          input(
            "confidence",
            "Confiança",
            this.percent(scored.confidence.score / 100),
            scored.confidence.score / 100,
            weights.confidence,
          ),
        ],
        assumptions: [
          "Fatores e pesos são configuráveis (SCORE_WEIGHTS_JSON).",
          "O score reflete relevância estratégica, não valor financeiro.",
        ],
      },
      config,
    );
  }

  private computeKnowledgeQuality(knowledge: KnowledgeBase): KnowledgeQuality {
    const total = knowledge.products.length;
    const catalogCount = knowledge.catalogCount;
    const coverageQuality =
      total > 0 && catalogCount !== undefined && catalogCount > 0
        ? Math.min(1, total / catalogCount)
        : 1;

    const completeness =
      total > 0
        ? knowledge.products.reduce((sum, product) => {
            const present =
              (product.price ? 1 : 0) +
              (product.description ? 1 : 0) +
              (product.brand ? 1 : 0) +
              (product.category ? 1 : 0);
            return sum + present / 4;
          }, 0) / total
        : 0;

    return {
      coverageQuality: this.round3(coverageQuality),
      freshness: 1,
      completeness: this.round3(completeness),
    };
  }

  private buildSources(knowledge: KnowledgeBase): EvidenceSource[] {
    const sources: EvidenceSource[] = ["CRAWLER"];
    if (knowledge.schemas.length > 0) {
      sources.push("STRUCTURED_DATA");
    }
    sources.push("STATIC_ASSUMPTION");
    return sources;
  }

  private percent(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  private round3(value: number): number {
    return Math.round(value * 1000) / 1000;
  }
}
