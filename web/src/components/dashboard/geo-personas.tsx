import { motion } from "framer-motion";
import {
  BadgeDollarSign,
  BadgeCheck,
  Bot,
  Cpu,
  Crown,
  MessageSquareText,
  Quote,
  Scale,
  Footprints,
  ShoppingCart,
  LogOut,
  TriangleAlert,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAgentCommand } from "@/contexts/agent-command-context";
import type {
  BuyerActionType,
  GeoEvaluation,
  GeoPersonaId,
  GeoPersonaScore,
  GeoReport,
} from "@/lib/report";

const ACTION_LABELS: Record<BuyerActionType, string> = {
  search_catalog: "Buscou no catálogo",
  inspect_product: "Inspecionou produto",
  compare_products: "Comparou candidatos",
  ask_follow_up: "Fez nova pergunta",
  inspect_store_policy: "Consultou políticas",
  finish_purchase: "Decidiu comprar",
  abandon_journey: "Abandonou a compra",
};

interface GeoPersonasSectionProps {
  geo: GeoReport;
}

const PERSONA_META: Record<
  GeoPersonaId,
  { description: string; icon: typeof Cpu }
> = {
  price: {
    description:
      "Comprador que pesquisa o melhor custo-benefício antes de decidir.",
    icon: BadgeDollarSign,
  },
  spec: {
    description:
      "Comprador técnico que só compra quando a ficha técnica está completa.",
    icon: Cpu,
  },
  brand: {
    description:
      "Comprador que prioriza marcas reconhecidas e confiáveis.",
    icon: Crown,
  },
  compare: {
    description:
      "Comprador que compara alternativas lado a lado antes de decidir.",
    icon: Scale,
  },
};

function personaVerdict(score: GeoPersonaScore): {
  label: string;
  tone: "success" | "warning" | "destructive";
} {
  if (score.questions === 0) {
    return { label: "Sem dados", tone: "warning" };
  }
  if (score.successRate >= 0.75) {
    return { label: "Loja responde bem", tone: "success" };
  }
  if (score.successRate >= 0.4) {
    return { label: "Resposta parcial", tone: "warning" };
  }
  return { label: "Loja não responde", tone: "destructive" };
}

const verdictStyles: Record<
  "success" | "warning" | "destructive",
  string
> = {
  success:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  destructive:
    "border-destructive/30 bg-destructive/10 text-destructive",
};

const statusStyles: Record<GeoEvaluation["status"], string> = {
  SUCCESS: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  PARTIAL: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  FAIL: "border-destructive/30 bg-destructive/10 text-destructive",
};

const statusLabel: Record<GeoEvaluation["status"], string> = {
  SUCCESS: "Respondida",
  PARTIAL: "Parcial",
  FAIL: "Falha",
};

export function GeoPersonasSection({ geo }: GeoPersonasSectionProps) {
  const { ask } = useAgentCommand();
  const examples = geo.evaluations.slice(0, 6);
  const journeys = geo.journeys?.slice(0, 6) ?? [];
  const noUsableProducts = geo.questionsTested === 0;

  return (
    <section aria-label="Simulação de compradores GEO">
      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">
            Simulação de compradores (GEO)
          </h2>
          <span className="inline-flex items-center gap-1 border-l-2 border-primary pl-1.5 text-[11px] font-medium text-primary">
            <Bot className="size-3" />
            {geo.llmEnabled ? "LLM" : "Fallback"}
          </span>
          <Button type="button" size="sm" variant="outline" className="ml-auto" onClick={() => ask(`Analise as simulações de compradores. A taxa de sucesso GEO é ${Math.round(geo.successRate * 100)}% e foram concluídas ${geo.simulationMeta?.completedJourneys ?? geo.journeys?.length ?? 0} jornadas. Identifique o principal bloqueador e gere uma ação.`)}>
            <Bot />Investigar com agente
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Quatro perfis de comprador avaliam se seus dados estruturados
          respondem às perguntas que eles fazem aos mecanismos generativos.
        </p>
        {geo.simulationMeta ? (
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{geo.simulationMeta.completedJourneys}/{geo.simulationMeta.requestedJourneys} jornadas concluídas</span>
            <span>{(geo.simulationMeta.durationMs / 1000).toFixed(1)}s</span>
            <span>{geo.simulationMeta.llmLogicalCalls} chamada(s) de LLM</span>
            <span>{geo.simulationMeta.version}</span>
          </div>
        ) : null}
        {geo.simulationErrors?.length ? (
          <div className="mt-3 flex items-start gap-2 border-l-2 border-amber-500 bg-amber-500/5 p-3 text-xs text-muted-foreground">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
            {geo.simulationErrors.length} jornada(s) falharam ou excederam o tempo limite; as demais foram preservadas.
          </div>
        ) : null}
        {noUsableProducts ? (
          <Card className="mt-4 border-amber-500/30 bg-amber-500/5">
            <CardContent className="flex items-start gap-3 p-4">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                A loja não expôs produtos utilizáveis pela simulação (sem
                páginas de produto, categorias ou dados estruturados
                reconhecíveis). Por isso, nenhuma pergunta de comprador pôde ser
                simulada — não é possível avaliar a prontidão GEO deste site.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="grid overflow-hidden border sm:grid-cols-2 lg:grid-cols-4">
        {geo.personaScores.map((score, index) => {
          const meta = PERSONA_META[score.persona];
          const Icon = meta.icon;
          const verdict = personaVerdict(score);
          return (
            <motion.div
              key={score.persona}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.08 }}
            >
              <Card className="h-full rounded-none border-0 border-b border-r">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 items-center justify-center border-r text-primary">
                        <Icon className="size-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold leading-tight">
                          {score.label}
                        </p>
                        <p className="text-[11px] uppercase text-muted-foreground">
                          {score.persona}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "rounded-sm border px-1.5 py-0.5 text-[11px] font-medium",
                        verdictStyles[verdict.tone],
                      )}
                    >
                      {verdict.label}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {meta.description}
                  </p>

                  <div className="mt-auto flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Taxa de resposta
                      </span>
                      <span className="font-semibold tabular-nums">
                        {Math.round(score.successRate * 100)}%
                      </span>
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-valuenow={Math.round(score.successRate * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Taxa de resposta ${score.label}`}
                    >
                      <motion.div
                        className={cn(
                          "h-full rounded-full",
                          verdict.tone === "success" && "bg-emerald-500",
                          verdict.tone === "warning" && "bg-amber-500",
                          verdict.tone === "destructive" && "bg-destructive",
                        )}
                        initial={{ width: 0 }}
                        animate={{
                          width: `${Math.round(score.successRate * 100)}%`,
                        }}
                        transition={{ duration: 0.5, delay: 0.2 + index * 0.08 }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Confiança média</span>
                      <span className="font-medium tabular-nums">
                        {score.avgConfidence}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {journeys.length > 0 ? (
        <Card className="mt-3">
          <CardContent className="flex flex-col gap-4 p-4 sm:p-5">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase text-muted-foreground">
              <Footprints className="size-3.5" />
              Jornadas agênticas
            </p>
            <div className="grid overflow-hidden border lg:grid-cols-2">
              {journeys.map((journey) => {
                const purchased = journey.finalState.decision === "PURCHASE";
                return (
                  <div key={journey.id} className="border-b border-r bg-muted/15 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          {PERSONA_META[journey.mission.persona].description}
                        </p>
                        <p className="mt-1 text-sm font-semibold leading-snug">
                          {journey.mission.goal}
                        </p>
                      </div>
                      <span className={cn(
                        "inline-flex shrink-0 items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[10px] font-medium",
                        purchased ? verdictStyles.success : verdictStyles.destructive,
                      )}>
                        {purchased ? <ShoppingCart className="size-3" /> : <LogOut className="size-3" />}
                        {purchased ? "Comprou" : "Abandonou"}
                      </span>
                    </div>
                    <ol className="mt-3 space-y-2 border-l pl-3">
                      {journey.steps.map((step) => (
                        <li key={step.index} className="text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">{ACTION_LABELS[step.action]}</span>
                            <span className="tabular-nums text-muted-foreground">{step.confidenceBefore}% → {step.confidenceAfter}%</span>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-muted-foreground">{step.observation.summary}</p>
                        </li>
                      ))}
                    </ol>
                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                      {journey.finalState.decisionReason}
                    </p>
                    {journey.finalState.conversionBlockers?.length ? (
                      <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                        Bloqueadores: {journey.finalState.conversionBlockers.join(", ")}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {examples.length > 0 ? (
        <Card className="mt-3">
          <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase text-muted-foreground">
              <MessageSquareText className="size-3.5" />
              Perguntas simuladas
            </p>
            {examples.map((evaluation) => {
              const meta = PERSONA_META[evaluation.persona];
              const Icon = meta.icon;
              return (
                <div
                  key={evaluation.questionId}
                  className="flex flex-col gap-1.5 border-b bg-muted/20 py-4 last:border-b-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Icon className="size-3" />
                      {evaluation.persona}
                    </span>
                    <span
                      className={cn(
                        "rounded-sm border px-1.5 py-0.5 text-[10px] font-medium",
                        statusStyles[evaluation.status],
                      )}
                    >
                      {statusLabel[evaluation.status]} ·{" "}
                      {evaluation.confidence}%
                    </span>
                    {evaluation.missingAttributes.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                        <TriangleAlert className="size-3" />
                        falta: {evaluation.missingAttributes.join(", ")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                        <BadgeCheck className="size-3" />
                        dados estruturados suficientes
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium">{evaluation.questionText}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {evaluation.explanation}
                  </p>
                  <div className="border-l-2 border-primary bg-primary/5 p-2.5">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase text-primary">
                      <Quote className="size-3" />
                      O que um agente de IA responderia hoje
                    </p>
                    <p className="mt-1 text-xs leading-relaxed">
                      {evaluation.answer?.text ?? evaluation.explanation}
                    </p>
                    {evaluation.answer &&
                    evaluation.answer.facts.length > 0 ? (
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        Fontes:{" "}
                        {evaluation.answer.facts
                          .map(
                            (fact) =>
                              `${fact.name}${
                                fact.price ? ` (${fact.price})` : ""
                              }`,
                          )
                          .join(", ")}
                      </p>
                    ) : null}
                  </div>
                  {evaluation.answer &&
                  evaluation.answer.blockingAttributes.length > 0 ? (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      Atributo bloqueador: estruture{" "}
                      {evaluation.answer.blockingAttributes.join(", ")} para
                      converter esta pergunta em resposta completa.
                    </p>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
