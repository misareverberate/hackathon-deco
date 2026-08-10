import type {
  AggregateImpact,
  ConfidenceLabel,
  ExecutiveSummaryModel,
} from "../types.js";
import { businessImpactLevelLabel } from "../types.js";
import type { ImpactConfig } from "../config/impactConfig.js";
import { formatCurrency } from "../config/impactConfig.js";
import { healthGrade } from "../health.js";

export interface SummaryContext {
  siteName: string;
  healthScore: number;
  totalOpportunities: number;
  estimatedScoreGain: number;
  automaticActions: number;
  manualActions: number;
  aggregate: AggregateImpact;
}

export class ExecutiveSummaryBuilder {
  build(
    context: SummaryContext,
    config: ImpactConfig,
  ): ExecutiveSummaryModel {
    const { aggregate } = context;
    const { highestOpportunity, overlapRisk } = aggregate;
    const currency = config.assumptions.currency;
    const { assumptions } = config;
    const health = healthGrade(context.healthScore, config);
    const levelLabel = businessImpactLevelLabel(
      highestOpportunity.businessImpactLevel,
    );

    const revenueText = highestOpportunity.recommendationId
      ? `${formatCurrency(aggregate.headline.revenueLow, currency)} – ${formatCurrency(
          aggregate.headline.revenueHigh,
          currency,
        )}`
      : `${formatCurrency(0, currency)} – ${formatCurrency(0, currency)}`;

    const trafficText = highestOpportunity.recommendationId
      ? `${this.number(aggregate.headline.trafficLow)} – ${this.number(
          aggregate.headline.trafficHigh,
        )}`
      : "0 – 0";

    const costAvoidedText = aggregate.potentialMaximum.costAvoided
      ? `${formatCurrency(
          aggregate.potentialMaximum.costAvoided.low,
          currency,
        )} – ${formatCurrency(
          aggregate.potentialMaximum.costAvoided.high,
          currency,
        )}`
      : `${formatCurrency(0, currency)} – ${formatCurrency(0, currency)}`;

    const headlineSentence = highestOpportunity.recommendationId
      ? `A maior oportunidade é "${highestOpportunity.title}" (Opportunity Score ${highestOpportunity.opportunityScore}, relevância ${levelLabel.toLowerCase()}), com ${revenueText} de receita incremental estimada e confiança ${this.confidenceLabel(highestOpportunity.confidence).toLowerCase()}.`
      : "Nenhuma recomendação de alto impacto identificada.";

    const highlights: string[] = [
      `Health atual: ${context.healthScore}/100 (nota ${health.grade}, ${health.label.toLowerCase()}).`,
      `${context.totalOpportunities} oportunidade(s) mapeada(s), ${context.automaticActions} automatizável(is) e ${context.manualActions} manual(is).`,
      `Maior oportunidade: "${highestOpportunity.title}" — Opportunity Score ${highestOpportunity.opportunityScore} (${levelLabel}).`,
      `Tráfego incremental estimado: ${trafficText} sessões/ano.`,
      `Custo evitado estimado: ${costAvoidedText}/ano em mão de obra (${context.automaticActions} ação(ões) automatizável(is)).`,
      `Ganho potencial de health score: +${context.estimatedScoreGain} ponto(s) se todas as oportunidades forem resolvidas.`,
    ];

    const warnings: string[] = [];
    if (overlapRisk === "medium" || overlapRisk === "high") {
      warnings.push(
        `Os valores não são aditivos: há sobreposição ${overlapRisk} entre as recomendações.`,
      );
    }
    if (highestOpportunity.confidence === "LOW") {
      warnings.push(
        "Confiança baixa na estimativa de maior impacto: considere dados de Search Console/GA4 para elevar a qualidade.",
      );
    }
    if (highestOpportunity.confidence === "MEDIUM") {
      warnings.push(
        "Confiança média: a estimativa combina evidência de crawler com suposições do setor.",
      );
    }

    const assumptionsList: string[] = [
      `CTR lift de rich results: ${Math.round(
        assumptions.ctrLiftMin * 100,
      )}%–${Math.round(assumptions.ctrLiftMax * 100)}%.`,
      `Conversão orgânica: ${Math.round(
        assumptions.organicConversionRate * 100,
      )}%.`,
      `Ticket médio: ${formatCurrency(assumptions.avgTicket, currency)}.`,
      `Índice de oportunidade orgânica: ${assumptions.organicOpportunityIndex} por unidade (fator de calibração, não sessões reais).`,
      `Moeda: ${currency}.`,
      `Health Score vira nota (A–F): ${health.grade} (${health.label}).`,
    ];

    const methodology = aggregate.explanation.assumptions.join(" ");
    const text = `O site ${context.siteName} está com saúde ${health.label.toLowerCase()} (${context.healthScore}/100, nota ${health.grade}). ${context.totalOpportunities} oportunidade(s) identificada(s), ${context.automaticActions} automatizável(is) e ${context.manualActions} manual(is). A maior oportunidade é "${highestOpportunity.title}" (Opportunity Score ${highestOpportunity.opportunityScore}, relevância ${levelLabel.toLowerCase()}). Impacto estimado: ${trafficText} sessões/ano e ${revenueText} de receita incremental, com confiança ${this.confidenceLabel(highestOpportunity.confidence).toLowerCase()}. Custo evitado estimado: ${costAvoidedText}/ano em mão de obra com as ações automatizáveis. Ganho potencial de health score: +${context.estimatedScoreGain} ponto(s) se todas as oportunidades forem resolvidas. ${methodology}`;

    return {
      headline: headlineSentence,
      highlights,
      warnings,
      assumptions: assumptionsList,
      methodology,
      text,
      highestOpportunity,
    };
  }

  confidenceLabel(label: ConfidenceLabel): string {
    switch (label) {
      case "HIGH":
        return "alta";
      case "MEDIUM":
        return "média";
      case "LOW":
        return "baixa";
    }
  }

  private number(value: number): string {
    return value.toLocaleString("pt-BR");
  }
}
