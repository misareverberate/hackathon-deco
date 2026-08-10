import { ShieldAlert, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BusinessImpactLevelBadge,
  ConfidenceBadge,
  EvidenceBadge,
  OverlapBadge,
} from "./badges";
import { ExplainableMetric, ScoreBreakdown } from "./explain";
import { recomputeBusinessImpact } from "@/lib/what-if";
import type { RecommendationReport } from "@/lib/report";

interface BusinessImpactCardProps {
  report: RecommendationReport;
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return value.toLocaleString("pt-BR");
}

export function BusinessImpactCard({ report }: BusinessImpactCardProps) {
  const aggregate = report.impactEstimate.aggregate;
  if (!aggregate) {
    return null;
  }

  const { headline, potentialMaximum, overlapRisk, overlapIndex, evidence } =
    aggregate;
  const currency = potentialMaximum.revenue.currency ?? "BRL";
  const highest = aggregate.highestOpportunity;
  const hasBusinessInput =
    report.businessInput &&
    Object.keys(report.businessInput).length > 0;
  const hasRecommendationImpact = report.recommendations.some(
    (recommendation) => recommendation.businessImpact,
  );
  const consolidated = hasRecommendationImpact
    ? recomputeBusinessImpact(report.recommendations, {
        avgTicket: report.businessInput?.avgTicket,
        conversion: report.businessInput?.organicConversionRate,
        monthlySessions: report.businessInput?.monthlyOrganicSessions,
        laborCost: report.businessInput?.laborCostPerHour,
        overlapIndex,
      }).potentialMaximum
    : potentialMaximum;
  const costAvoided = consolidated.costAvoided;
  const consolidatedExplanation = {
    ...aggregate.explanation,
    summary:
      "Cenário consolidado do portfólio, com cobertura limitada a 100% e desconto de sobreposição.",
    formula:
      "sessões incrementais = sessões anuais × cobertura efetiva × ganho orgânico; receita = sessões incrementais × conversão × ticket",
  };

  return (
    <section aria-label="Impacto de negócio estimado">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-4 text-primary" />
            Impacto de negócio estimado
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">
              Modelo de apoio à decisão, não uma projeção financeira
            </p>
            {hasBusinessInput ? (
              <span className="inline-flex items-center gap-1 border-l-2 border-emerald-600 pl-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                <Wallet className="size-3" />
                Ancorado nos dados da operação
              </span>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid overflow-hidden border sm:grid-cols-2 xl:grid-cols-4 [&>*]:border-b [&>*]:p-4 sm:[&>*]:border-r xl:[&>*]:border-b-0">
            <div>
              <ExplainableMetric
                large
                label="Opportunity Score"
                explanation={aggregate.explanation}
                value={
                  <p className="flex items-baseline gap-1 text-3xl font-extrabold tabular-nums">
                    {highest.opportunityScore}
                    <span className="text-base font-semibold text-muted-foreground">
                      /100
                    </span>
                  </p>
                }
                secondary={
                  <div className="space-y-1.5">
                    <p className="line-clamp-1 text-xs font-medium text-foreground">
                      {highest.title}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <BusinessImpactLevelBadge level={highest.businessImpactLevel} />
                      <ConfidenceBadge confidence={highest.confidence} />
                    </div>
                    <ScoreBreakdown inputs={highest.explanation.inputs} />
                  </div>
                }
              />
            </div>

            <div>
              <ExplainableMetric
                label="Receita incremental / ano"
                explanation={consolidatedExplanation}
                value={
                  <p className="mt-1.5 text-xl font-bold tabular-nums">
                    {formatCurrency(headline.revenueLow, currency)} –{" "}
                    {formatCurrency(headline.revenueHigh, currency)}
                  </p>
                }
                secondary={
                  <p className="text-xs text-muted-foreground">
                    cenário consolidado:{" "}
                    {formatCurrency(consolidated.revenue.low, currency)} –{" "}
                    {formatCurrency(consolidated.revenue.high, currency)}
                  </p>
                }
              />
            </div>

            <div>
              <ExplainableMetric
                label="Sessões incrementais / ano"
                explanation={consolidatedExplanation}
                value={
                  <p className="mt-1.5 text-xl font-bold tabular-nums">
                    {formatNumber(headline.trafficLow)} –{" "}
                    {formatNumber(headline.trafficHigh)}
                  </p>
                }
                secondary={
                  <p className="text-xs text-muted-foreground">
                    cenário consolidado: {formatNumber(consolidated.traffic.low)} –{" "}
                    {formatNumber(consolidated.traffic.high)}
                  </p>
                }
              />
            </div>

            <div className="xl:border-r-0">
              <ExplainableMetric
                label="Execução manual evitada"
                explanation={consolidatedExplanation}
                value={
                  <p className="mt-1.5 text-xl font-bold tabular-nums">
                    {formatCurrency(costAvoided.low, currency)} –{" "}
                    {formatCurrency(costAvoided.high, currency)}
                  </p>
                }
                secondary={
                  <p className="text-xs text-muted-foreground">
                    economia pontual, sem recorrência presumida
                  </p>
                }
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Evidência:
            </span>
            <EvidenceBadge level={evidence.level} />
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sobreposição:
            </span>
            <OverlapBadge risk={overlapRisk} />
            {overlapIndex > 0 ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                índice {Math.round(overlapIndex * 100)}%
              </span>
            ) : null}
            <span className="ml-auto text-xs text-muted-foreground">
              modelo v{aggregate.modelVersion}
            </span>
          </div>

          <p className="flex items-start gap-2 border-l-2 border-l-muted-foreground/30 bg-muted/25 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
            <span>{evidence.description}</span>
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
