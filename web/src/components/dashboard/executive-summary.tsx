import { AlertTriangle, Check, MessageSquareQuote, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BusinessImpactLevelBadge,
  CategoryBadge,
  ConfidenceBadge,
  ImpactBadge,
  PriorityBadge,
} from "./badges";
import type { Recommendation, RecommendationReport } from "@/lib/report";

interface ExecutiveSummaryProps {
  report: RecommendationReport;
}

function topRisks(recommendations: Recommendation[]): Recommendation[] {
  const order = { critica: 0, alta: 1, media: 2, baixa: 3 };
  return [...recommendations]
    .sort(
      (a, b) =>
        order[a.priority] - order[b.priority] || b.score - a.score,
    )
    .slice(0, 3);
}

export function ExecutiveSummary({ report }: ExecutiveSummaryProps) {
  const risks = topRisks(report.recommendations);
  const biggest = report.recommendations.reduce<Recommendation | null>(
    (max, item) => (max && max.score >= item.score ? max : item),
    null,
  );
  const model = report.executiveSummaryModel;
  const highest = model?.highestOpportunity;
  const biggestRec =
    report.recommendations.find(
      (recommendation) =>
        highest !== undefined &&
        recommendation.opportunityId === highest.recommendationId,
    ) ?? biggest;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5 }}
      aria-label="Resumo executivo"
    >
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-9 items-center justify-center border-r text-primary">
              <MessageSquareQuote className="size-4.5" />
            </span>
            <div>
              <CardTitle>Resumo executivo</CardTitle>
              <CardDescription>
                O que importa, em linguagem natural
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-0 border-t p-0 lg:grid-cols-[1.45fr_1fr]">
          <div>
            <p className="p-5 text-sm leading-relaxed text-foreground/90">
              {model?.text ?? report.executiveSummary}
            </p>

            {model ? (
              <div className="grid border-t sm:grid-cols-2 sm:divide-x">
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Destaques
                  </p>
                  <ul className="mt-2 space-y-2">
                    {model.highlights.map((highlight) => (
                      <li
                        key={highlight}
                        className="flex items-start gap-2 text-sm leading-snug"
                      >
                        <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="border-t p-5 sm:border-t-0">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Premissas
                  </p>
                  <ul className="mt-2 space-y-2">
                    {model.assumptions.map((assumption) => (
                      <li
                        key={assumption}
                        className="flex items-start gap-2 text-xs leading-snug text-muted-foreground"
                      >
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                        <span>{assumption}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : null}

            {biggestRec ? (
              <div className="border-t border-l-2 border-l-primary p-5">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
                  <TrendingUp className="size-3.5" />
                  Maior oportunidade
                </p>
                <p className="mt-1.5 font-semibold">{biggestRec.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CategoryBadge category={biggestRec.category} />
                  <ImpactBadge impact={biggestRec.impact} />
                  <PriorityBadge priority={biggestRec.priority} />
                  {highest ? (
                    <>
                      <BusinessImpactLevelBadge level={highest.businessImpactLevel} />
                      <ConfidenceBadge confidence={highest.confidence} />
                    </>
                  ) : null}
                </div>
                {highest ? (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Opportunity Score {highest.opportunityScore}/100
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-muted-foreground">
                  {biggestRec.action.title} — {biggestRec.expectedImpact}
                </p>
              </div>
            ) : null}
          </div>

          <div className="border-t bg-muted/20 p-5 lg:border-l lg:border-t-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase text-muted-foreground">
              <AlertTriangle className="size-3.5" />
              Principais riscos
            </p>
            <ul className="mt-3 space-y-3">
              {risks.map((risk) => (
                <li key={risk.id} className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-snug">{risk.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {risk.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </motion.section>
  );
}
