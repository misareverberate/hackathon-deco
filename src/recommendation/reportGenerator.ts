import {
  OpportunityReportSite,
  Recommendation,
  RecommendationReport,
  ImpactEstimate,
  RoadmapPhase,
  ExecutiveSummaryModel,
  HealthResult,
} from "./types.js";

export interface ReportInput {
  site: OpportunityReportSite;
  recommendations: Recommendation[];
  healthScore: number;
  health: HealthResult;
  impactEstimate: ImpactEstimate;
  roadmap: RoadmapPhase[];
  summaryModel?: ExecutiveSummaryModel;
}

export class ReportGenerator {
  build(input: ReportInput): RecommendationReport {
    const automaticActions = input.recommendations.filter(
      (recommendation) => recommendation.automatable,
    );
    const manualActions = input.recommendations.filter(
      (recommendation) => !recommendation.automatable,
    );
    const topRecommendations = input.recommendations.slice(0, 10);

    return {
      site: input.site,
      healthScore: input.healthScore,
      health: input.health,
      totalOpportunities: input.recommendations.length,
      executiveSummary:
        input.summaryModel?.text ?? this.buildExecutiveSummary(input),
      executiveSummaryModel: input.summaryModel,
      recommendations: input.recommendations,
      topRecommendations,
      automaticActions,
      manualActions,
      roadmap: input.roadmap,
      impactEstimate: input.impactEstimate,
    };
  }

  private buildExecutiveSummary(input: ReportInput): string {
    const siteName = input.site.title || input.site.host;
    const firstPhase = input.roadmap.find(
      (phase) => phase.recommendations.length > 0,
    );
    const phaseDescription =
      firstPhase && firstPhase.recommendations.length > 0
        ? `A prioridade imediata é a ${firstPhase.name.toLowerCase()}, com ${firstPhase.recommendations.length} ação(ões).`
        : "Nenhuma ação prioritária identificada no momento.";

    return `O site ${siteName} está com saúde ${input.health.label.toLowerCase()} (${input.healthScore}/100, nota ${input.health.grade}). ${input.recommendations.length} oportunidade(s) identificada(s), ${input.impactEstimate.automaticActions} automatizável(is) e ${input.impactEstimate.manualActions} manual(is). Ganho potencial de health score: +${input.impactEstimate.estimatedScoreGain} ponto(s) se todas as oportunidades forem resolvidas. ${phaseDescription}`;
  }
}
