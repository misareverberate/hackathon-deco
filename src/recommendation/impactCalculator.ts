import {
  Opportunity,
  OpportunityCategory,
  ImpactEstimate,
  HealthResult,
  impactLabel,
} from "./types.js";
import type { ScoredOpportunity } from "./priorityCalculator.js";
import type { KnowledgeBase } from "../knowledge/knowledgeBuilder.js";
import type { ImpactConfig } from "./config/impactConfig.js";
import { healthResult } from "./health.js";
import {
  BusinessImpactEngine,
  type BusinessImpactModel,
  type ImpactContext,
} from "./businessImpactEngine.js";

export class ImpactCalculator {
  constructor(private readonly engine = new BusinessImpactEngine()) {}

  calculateExpectedImpact(opportunity: Opportunity): string {
    if (opportunity.scope === "site") {
      return `Impacto esperado ${impactLabel(opportunity.impact)}. Abrange todo o site, sem depender de produtos específicos.`;
    }
    const coverage = Math.max(1, opportunity.affectedProducts ?? 1);
    return `Impacto esperado ${impactLabel(opportunity.impact)}. Abrange ${coverage} produto(s) na categoria ${opportunity.category}.`;
  }

  scoreOpportunities(
    knowledge: KnowledgeBase,
    scored: ScoredOpportunity[],
    config?: ImpactConfig,
  ): ScoredOpportunity[] {
    const engine = config ? new BusinessImpactEngine(config) : this.engine;
    return engine.scoreOpportunities(knowledge, scored);
  }

  calculateEstimate(
    scored: ScoredOpportunity[],
    healthScore?: number,
  ): ImpactEstimate {
    const automaticActions = scored.filter(
      (entry) => entry.opportunity.automatable,
    ).length;

    return {
      automaticActions,
      manualActions: scored.length - automaticActions,
      estimatedScoreGain:
        healthScore !== undefined
          ? this.clamp(100 - healthScore, 0, 100)
          : this.averageScore(scored),
      topCategory: this.topCategory(scored),
    };
  }

  calculateHealthScore(
    providedHealthScore: number | undefined,
    scored: ScoredOpportunity[],
  ): number {
    if (providedHealthScore !== undefined) {
      return this.clamp(Math.round(providedHealthScore), 0, 100);
    }
    if (scored.length === 0) {
      return 100;
    }

    return this.clamp(100 - this.averageScore(scored), 0, 100);
  }

  buildImpactModel(
    knowledge: KnowledgeBase,
    scored: ScoredOpportunity[],
    context: ImpactContext,
    config?: ImpactConfig,
  ): BusinessImpactModel {
    const engine = config ? new BusinessImpactEngine(config) : this.engine;
    return engine.run(knowledge, scored, context);
  }

  buildHealth(score: number, config?: ImpactConfig): HealthResult {
    return healthResult(score, config ?? this.engine.getConfig());
  }

  private averageScore(scored: ScoredOpportunity[]): number {
    if (scored.length === 0) {
      return 0;
    }
    const total = scored.reduce((sum, entry) => sum + entry.score, 0);
    return Math.round(total / scored.length);
  }

  private topCategory(
    scored: ScoredOpportunity[],
  ): OpportunityCategory | null {
    if (scored.length === 0) {
      return null;
    }

    const counts = new Map<OpportunityCategory, number>();
    scored.forEach((entry) => {
      const category = entry.opportunity.category;
      counts.set(category, (counts.get(category) ?? 0) + 1);
    });

    let top: OpportunityCategory | null = null;
    let topCount = 0;
    counts.forEach((count, category) => {
      if (count > topCount) {
        top = category;
        topCount = count;
      }
    });

    return top;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }
}
