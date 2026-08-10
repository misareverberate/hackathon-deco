import type {
  AggregateImpact,
  BusinessImpact,
  EvidenceSource,
  OverlapResult,
  OverlapRisk,
  RevenueRange,
  TrafficRange,
} from "../types.js";
import type { ImpactConfig } from "../config/impactConfig.js";
import {
  EVIDENCE_ORDER,
  evidenceExplanation,
  describeSources,
  primaryEvidenceLevel,
} from "../evidence.js";
import { explanation, input, warning } from "../explanation/explanationBuilder.js";

export interface AggregateItem {
  recommendationId: string;
  title: string;
  impact: BusinessImpact;
  affectedProductIds?: string[];
}

export function overlapRiskFor(index: number): OverlapRisk {
  if (index === 0) {
    return "none";
  }
  if (index < 0.2) {
    return "low";
  }
  if (index <= 0.5) {
    return "medium";
  }
  return "high";
}

export function computeOverlap(
  ids: string[] | undefined,
  othersIds: string[] | undefined,
): OverlapResult {
  const own = ids ?? [];
  if (own.length === 0) {
    return { index: 0, risk: "none" };
  }
  const others = new Set(othersIds ?? []);
  const shared = own.filter((id) => others.has(id)).length;
  const index = shared / own.length;
  return { index: round3(index), risk: overlapRiskFor(index) };
}

export class Aggregator {
  aggregate(items: AggregateItem[], config: ImpactConfig): AggregateImpact {
    const currency = config.assumptions.currency;

    if (items.length === 0) {
      const evidence = evidenceExplanation([], config);
      const emptyExplanation = explanation(
        {
          metric: "opportunity",
          summary: "Nenhuma recomendação para pontuar.",
          formula: "score = Σ fator × peso",
          inputs: [],
        },
        config,
      );
      return {
        headline: {
          recommendationId: "",
          title: "Nenhuma recomendação",
          revenueLow: 0,
          revenueHigh: 0,
          trafficLow: 0,
          trafficHigh: 0,
          confidence: "HIGH",
          opportunityScore: 0,
          businessImpactLevel: "low",
          explanation: emptyExplanation,
        },
        potentialMaximum: {
          revenue: { low: 0, high: 0, currency },
          traffic: { low: 0, high: 0 },
          costAvoided: { low: 0, high: 0, currency },
        },
        overlapRisk: "none",
        overlapIndex: 0,
        evidence,
        highestOpportunity: {
          recommendationId: "",
          title: "Nenhuma recomendação",
          opportunityScore: 0,
          businessImpactLevel: "low",
          confidence: "HIGH",
          explanation: emptyExplanation,
        },
        explanation: this.explainAggregate(items, currency, config),
        modelVersion: config.version,
      };
    }

    const headline = this.headline(items);
    const best = this.bestOf(items);

    const sumRevenue = items.reduce<RevenueRange>(
      (acc, item) => ({
        low: acc.low + item.impact.revenue.low,
        high: acc.high + item.impact.revenue.high,
        currency: item.impact.revenue.currency,
      }),
      { low: 0, high: 0, currency },
    );

    const sumTraffic = items.reduce<TrafficRange>(
      (acc, item) => ({
        low: acc.low + item.impact.traffic.perYear.low,
        high: acc.high + item.impact.traffic.perYear.high,
      }),
      { low: 0, high: 0 },
    );

    const sumCostAvoided = items.reduce<RevenueRange>(
      (acc, item) => ({
        low: acc.low + item.impact.costAvoided.low,
        high: acc.high + item.impact.costAvoided.high,
        currency: item.impact.costAvoided.currency,
      }),
      { low: 0, high: 0, currency },
    );

    const overlap = this.aggregateOverlap(items);
    const evidence = this.combineEvidence(items, config);

    return {
      headline,
      potentialMaximum: {
        revenue: sumRevenue,
        traffic: sumTraffic,
        costAvoided: sumCostAvoided,
      },
      overlapRisk: overlap.risk,
      overlapIndex: overlap.index,
      evidence,
      highestOpportunity: {
        recommendationId: headline.recommendationId,
        title: headline.title,
        opportunityScore: headline.opportunityScore,
        businessImpactLevel: headline.businessImpactLevel,
        confidence: headline.confidence,
        explanation: best.impact.opportunity.explanation,
      },
      explanation: this.explainAggregate(items, currency, config),
      modelVersion: config.version,
    };
  }

  private bestOf(items: AggregateItem[]): AggregateItem {
    return [...items].sort((a, b) => {
      const byScore = b.impact.opportunity.score - a.impact.opportunity.score;
      if (byScore !== 0) {
        return byScore;
      }
      return b.impact.revenue.low - a.impact.revenue.low;
    })[0];
  }

  headline(items: AggregateItem[]): AggregateImpact["headline"] {
    const best = this.bestOf(items);
    return {
      recommendationId: best.recommendationId,
      title: best.title,
      revenueLow: best.impact.revenue.low,
      revenueHigh: best.impact.revenue.high,
      trafficLow: best.impact.traffic.perYear.low,
      trafficHigh: best.impact.traffic.perYear.high,
      confidence: best.impact.confidence.label,
      opportunityScore: best.impact.opportunity.score,
      businessImpactLevel: best.impact.businessImpactLevel,
      explanation: best.impact.opportunity.explanation,
    };
  }

  private aggregateOverlap(items: AggregateItem[]): OverlapResult {
    const allIds = items.flatMap((item) => item.affectedProductIds ?? []);
    if (allIds.length === 0) {
      return { index: 0, risk: "none" };
    }
    const unique = new Set(allIds);
    const index = 1 - unique.size / allIds.length;
    return { index: round3(index), risk: overlapRiskFor(index) };
  }

  private combineEvidence(
    items: AggregateItem[],
    config: ImpactConfig,
  ): AggregateImpact["evidence"] {
    const present = new Set<EvidenceSource>();
    items.forEach((item) => {
      item.impact.evidence.sources.forEach((source) => present.add(source));
    });
    const sources = EVIDENCE_ORDER.filter((source) => present.has(source));
    const level = primaryEvidenceLevel(sources);
    return {
      ...evidenceExplanation(sources, config),
      level,
      description: describeSources(sources),
    };
  }

  private explainAggregate(
    items: AggregateItem[],
    currency: string,
    config: ImpactConfig,
  ): AggregateImpact["explanation"] {
    const best = items.length > 0 ? this.headline(items) : null;
    const overlapIndex = items.length > 0 ? this.aggregateOverlap(items).index : 0;
    const sumRevenue = items.reduce(
      (acc, item) => acc + item.impact.revenue.low,
      0,
    );
    const sumCostAvoided = items.reduce(
      (acc, item) => acc + item.impact.costAvoided.low,
      0,
    );
    return explanation(
      {
        metric: "aggregate",
        summary: best
          ? `Headline é "${best.title}" (Opportunity Score ${best.opportunityScore}). O potencial máximo soma os ranges e não é aditivo.`
          : "Sem recomendações para estimar impacto.",
        formula:
          "headline = max(opportunityScore); potentialMaximum = Σ ranges de todas as recomendações",
        inputs: [
          input(
            "recommendations",
            "Recomendações",
            String(items.length),
            items.length,
          ),
          input(
            "overlapIndex",
            "Índice de sobreposição",
            this.percent(overlapIndex),
            overlapIndex,
          ),
          input(
            "sumRevenueLow",
            "Receita incremental estimada (soma)",
            this.currency(sumRevenue, currency),
            sumRevenue,
          ),
          input(
            "sumCostAvoidedLow",
            "Custo evitado estimado (soma)",
            this.currency(sumCostAvoided, currency),
            sumCostAvoided,
          ),
        ],
        rationale: [
          ...(items.length > 1
            ? [
                warning(
                  "As recomendações podem afetar os mesmos produtos; o potencial máximo não é aditivo.",
                ),
              ]
            : []),
        ],
        assumptions: [
          config.overlapNote,
          config.disclaimer,
        ],
      },
      config,
    );
  }

  private percent(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  private currency(value: number, currency: string): string {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  }
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
