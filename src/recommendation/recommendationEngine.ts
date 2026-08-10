import type { KnowledgeBase } from "../knowledge/knowledgeBuilder.js";
import type {
  ImpactEstimate,
  OpportunityReport,
  Recommendation,
  RecommendationReport,
} from "./types.js";
import type { ImpactConfig } from "./config/impactConfig.js";
import { toScoredOpportunities } from "./priorityCalculator.js";
import { ImpactCalculator } from "./impactCalculator.js";
import { ActionGenerator } from "./actionGenerator.js";
import { RoadmapBuilder } from "./roadmapBuilder.js";
import { ReportGenerator } from "./reportGenerator.js";

export class RecommendationEngine {
  constructor(
    private readonly impactCalculator = new ImpactCalculator(),
    private readonly actionGenerator = new ActionGenerator(),
    private readonly roadmapBuilder = new RoadmapBuilder(),
    private readonly reportGenerator = new ReportGenerator(),
  ) {}

  run(
    knowledge: KnowledgeBase,
    opportunityReport: OpportunityReport,
    config?: ImpactConfig,
  ): RecommendationReport {
    const scored = this.impactCalculator.scoreOpportunities(
      knowledge,
      toScoredOpportunities(opportunityReport.opportunities),
      config,
    );
    const healthScore = this.impactCalculator.calculateHealthScore(
      opportunityReport.healthScore,
      scored,
    );
    const estimate = this.impactCalculator.calculateEstimate(scored, healthScore);
    const health = this.impactCalculator.buildHealth(healthScore, config);
    const model = this.impactCalculator.buildImpactModel(knowledge, scored, {
      siteName: opportunityReport.site.title ?? opportunityReport.site.host,
      healthScore,
      estimatedScoreGain: estimate.estimatedScoreGain,
    }, config);

    const recommendations: Recommendation[] = scored
      .map(({ opportunity, score, priority }) => ({
        id: `rec:${opportunity.id}`,
        opportunityId: opportunity.id,
        title: opportunity.title,
        description: opportunity.description,
        category: opportunity.category,
        priority,
        impact: opportunity.impact,
        confidence: opportunity.confidence,
        effort: opportunity.effort,
        automatable: opportunity.automatable,
        score,
        expectedImpact: this.impactCalculator.calculateExpectedImpact(
          opportunity,
        ),
        action: this.actionGenerator.generate(opportunity, knowledge),
        reason: opportunity.reason,
        affectedProducts: opportunity.affectedProducts,
        affectedItems: opportunity.affectedItems,
        businessImpact: model.impacts[opportunity.id],
      }))
      .sort((a, b) => b.score - a.score);

    const impactEstimate: ImpactEstimate = {
      ...estimate,
      aggregate: model.aggregate,
    };
    const roadmap = this.roadmapBuilder.build(recommendations);

    return this.reportGenerator.build({
      site: opportunityReport.site,
      recommendations,
      healthScore,
      health,
      impactEstimate,
      roadmap,
      summaryModel: model.summary,
    });
  }
}
