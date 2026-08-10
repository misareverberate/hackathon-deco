import { useEffect, useState } from "react";
import { AlertCircle, Ban, Bot, Check, FileCode2, LoaderCircle, Package, ShieldCheck, Sparkles, TrendingUp, User, UserRoundCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetCloseButton,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  BusinessImpactLevelBadge,
  CategoryBadge,
  ConfidenceBadge,
  EffortBadge,
  EvidenceBadge,
  ImpactBadge,
  PriorityBadge,
} from "./badges";
import { ExplainableMetric, ScoreBreakdown } from "./explain";
import type { Recommendation } from "@/lib/report";
import { useAgentCommand } from "@/contexts/agent-command-context";
import { validateRecommendation, type ValidationResponse } from "@/lib/api";

interface RecommendationDrawerProps {
  analysisId?: string;
  recommendation: Recommendation | null;
  onClose: () => void;
}

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </p>
      <div className="mt-1.5 text-sm leading-relaxed">{children}</div>
    </div>
  );
}

export function RecommendationDrawer({
  analysisId,
  recommendation,
  onClose,
}: RecommendationDrawerProps) {
  const { ask } = useAgentCommand();
  const [validation, setValidation] = useState<ValidationResponse | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  useEffect(() => {
    setValidation(null);
    setValidationError(null);
    setValidating(false);
  }, [recommendation?.id]);
  const run = (prompt: string) => {
    onClose();
    ask(prompt);
  };
  return (
    <Sheet open={recommendation !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {recommendation ? (
          <>
            <SheetHeader className="border-b pr-10">
              <div className="flex flex-wrap items-center gap-1.5">
                <CategoryBadge category={recommendation.category} />
                <PriorityBadge priority={recommendation.priority} />
                <Badge variant="outline" className="gap-1">
                  Score {recommendation.score}
                </Badge>
              </div>
              <SheetTitle className="mt-2 leading-snug">
                {recommendation.title}
              </SheetTitle>
              <SheetDescription className="line-clamp-2">
                {recommendation.description}
              </SheetDescription>
              <SheetCloseButton />
            </SheetHeader>

            <div className="grid grid-cols-2 gap-2 border-b p-4">
              <Button size="sm" onClick={() => run(`Marque a recomendação ${recommendation.id}: ${recommendation.title} como aceita.`)}><Check />Aceitar</Button>
              <Button size="sm" variant="outline" onClick={() => run(`Marque a recomendação ${recommendation.id}: ${recommendation.title} como delegada.`)}><UserRoundCheck />Delegar</Button>
              <Button size="sm" variant="outline" onClick={() => run(`Gere um artefato executável para a recomendação ${recommendation.id}: ${recommendation.title}.`)}><FileCode2 />Gerar artefato</Button>
              <Button size="sm" variant="ghost" onClick={() => run(`Marque a recomendação ${recommendation.id}: ${recommendation.title} como rejeitada.`)}><Ban />Rejeitar</Button>
            </div>

            <div className="flex flex-col gap-5 p-5">
              <DetailRow icon={AlertCircle} label="Problema encontrado">
                <p>{recommendation.description}</p>
              </DetailRow>

              <DetailRow icon={Sparkles} label="Por quê">
                <p>{recommendation.reason ?? recommendation.expectedImpact}</p>
              </DetailRow>

              <div className="grid grid-cols-2 gap-3">
                <DetailRow icon={TrendingUp} label="Impacto esperado">
                  <p>
                    <ImpactBadge impact={recommendation.impact} />
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {recommendation.expectedImpact}
                  </p>
                </DetailRow>
                <DetailRow icon={Package} label="Produtos afetados">
                  <p className="font-semibold tabular-nums">
                    {recommendation.affectedProducts ?? "—"}
                  </p>
                  {recommendation.affectedProducts ? (
                    <p className="text-xs text-muted-foreground">no catálogo</p>
                  ) : null}
                </DetailRow>
              </div>

              {recommendation.businessImpact ? (
                <div className="rounded-xl border bg-muted/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <TrendingUp className="size-3.5" />
                      Impacto de negócio estimado
                    </p>
                    <BusinessImpactLevelBadge
                      level={recommendation.businessImpact.businessImpactLevel}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <ExplainableMetric
                        label="Opportunity Score"
                        explanation={recommendation.businessImpact.opportunity.explanation}
                        value={
                          <p className="text-xl font-bold tabular-nums">
                            {recommendation.businessImpact.opportunity.score}
                            <span className="text-sm text-muted-foreground">/100</span>
                          </p>
                        }
                      />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Cobertura</p>
                      <p className="text-xl font-bold tabular-nums">
                        {Math.round(recommendation.businessImpact.opportunity.coverage * 100)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Alcance (Reach)</p>
                      <p className="text-xl font-bold tabular-nums">
                        {recommendation.businessImpact.opportunity.reach.toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Confiança</p>
                      <p className="flex items-center gap-1.5">
                        <ConfidenceBadge confidence={recommendation.businessImpact.confidence.label} />
                        <span className="text-sm tabular-nums text-muted-foreground">
                          {recommendation.businessImpact.confidence.score}%
                        </span>
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Sessões/ano</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {recommendation.businessImpact.traffic.perYear.low.toLocaleString("pt-BR")} –{" "}
                        {recommendation.businessImpact.traffic.perYear.high.toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Receita/ano</p>
                      <p className="text-sm font-semibold tabular-nums">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: recommendation.businessImpact.revenue.currency,
                          maximumFractionDigits: 0,
                        }).format(recommendation.businessImpact.revenue.low)}{" "}
                        –{" "}
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: recommendation.businessImpact.revenue.currency,
                          maximumFractionDigits: 0,
                        }).format(recommendation.businessImpact.revenue.high)}
                      </p>
                    </div>
                  </div>

                  {recommendation.businessImpact.costAvoided.high > 0 ? (
                    <div className="mt-3 rounded-lg border bg-emerald-500/5 px-3 py-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <Bot className="size-3.5" />
                        Custo evitado / ano
                      </p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums">
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: recommendation.businessImpact.costAvoided.currency,
                          maximumFractionDigits: 0,
                        }).format(recommendation.businessImpact.costAvoided.low)}{" "}
                        –{" "}
                        {new Intl.NumberFormat("pt-BR", {
                          style: "currency",
                          currency: recommendation.businessImpact.costAvoided.currency,
                          maximumFractionDigits: 0,
                        }).format(recommendation.businessImpact.costAvoided.high)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        mão de obra automatizável
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-3">
                    <ScoreBreakdown
                      inputs={recommendation.businessImpact.opportunity.explanation.inputs}
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <EvidenceBadge level={recommendation.businessImpact.evidence.level} />
                    <span className="text-xs text-muted-foreground">
                      {recommendation.businessImpact.evidence.description}
                    </span>
                  </div>
                  {recommendation.businessImpact.evidence.missingSources.length > 0 ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      Fontes não conectadas:{" "}
                      {recommendation.businessImpact.evidence.missingSources.join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {recommendation.affectedItems?.length ? (
                <DetailRow icon={Package} label="Exemplos afetados">
                  <ul className="mt-1 space-y-1">
                    {recommendation.affectedItems.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-sm leading-snug text-muted-foreground"
                      >
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                        <span className="break-words">{item}</span>
                      </li>
                    ))}
                  </ul>
                </DetailRow>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <DetailRow icon={User} label="Esforço estimado">
                  <EffortBadge effort={recommendation.effort} />
                </DetailRow>
                <DetailRow icon={Bot} label="Pode automatizar?">
                  {recommendation.automatable ? (
                    <Badge variant="success" className="gap-1">
                      <Bot className="size-3" />
                      Sim
                    </Badge>
                  ) : (
                    <Badge variant="neutral">Não</Badge>
                  )}
                </DetailRow>
              </div>

              <Separator />

              <DetailRow icon={Bot} label="Ação sugerida">
                <p className="font-semibold">{recommendation.action.title}</p>
                <p className="mt-1 text-muted-foreground">
                  {recommendation.action.description}
                </p>
                <ol className="mt-3 space-y-2">
                  {recommendation.action.steps.map((step, index) => (
                    <li key={step} className="flex items-start gap-2.5">
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[11px] font-bold text-primary">
                        {index + 1}
                      </span>
                      <span className="text-sm leading-snug">{step}</span>
                    </li>
                  ))}
                </ol>
                <Button
                  className="mt-4 w-full"
                  variant="outline"
                  disabled={!analysisId || validating}
                  onClick={async () => {
                    if (!analysisId) return;
                    setValidating(true);
                    setValidationError(null);
                    try {
                      setValidation(await validateRecommendation(analysisId, recommendation.id));
                    } catch (error) {
                      setValidationError(error instanceof Error ? error.message : String(error));
                    } finally {
                      setValidating(false);
                    }
                  }}
                >
                  {validating ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
                  {validating ? "Recrawleando…" : "Revalidar agora"}
                </Button>
                {validation ? (
                  <div className={`mt-3 border-l-2 p-3 text-xs ${validation.status === "resolved" ? "border-emerald-500 bg-emerald-500/5" : "border-amber-500 bg-amber-500/5"}`}>
                    <p className="font-semibold">{validation.status === "resolved" ? "Correção confirmada" : "Problema ainda presente"}</p>
                    <p className="mt-1 text-muted-foreground">{validation.evidence}</p>
                    <p className="mt-1 tabular-nums text-muted-foreground">{validation.pages} páginas · {validation.products} produtos reavaliados</p>
                  </div>
                ) : null}
                {validationError ? <p className="mt-3 text-xs text-destructive">{validationError}</p> : null}
              </DetailRow>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
