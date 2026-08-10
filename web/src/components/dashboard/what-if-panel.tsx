import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  Bot,
  Calculator,
  Database,
  ExternalLink,
  FlaskConical,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  anchoredInputValue,
  equivalentSessions,
  recomputeBusinessImpact,
  type WhatIfParams,
} from "@/lib/what-if";
import type {
  OverlapRisk,
  RecommendationReport,
} from "@/lib/report";
import { useAgentCommand } from "@/contexts/agent-command-context";

interface WhatIfPanelProps {
  report: RecommendationReport;
}

interface SliderState {
  avgTicket: number;
  conversionPct: number;
  monthlySessions: number;
  laborCost: number;
}

const OVERLAP_LABEL: Record<OverlapRisk, string> = {
  none: "Sem sobreposição",
  low: "Baixa sobreposição",
  medium: "Sobreposição média",
  high: "Alta sobreposição",
};

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

function formatPercent(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "percent",
    maximumFractionDigits: 1,
  });
}

function formatDelta(base: number, value: number): string {
  if (base === 0) {
    return value === 0 ? "0%" : "novo cenário";
  }
  const change = ((value - base) / base) * 100;
  return `${change >= 0 ? "+" : ""}${Math.round(change)}%`;
}

function baselineState(report: RecommendationReport): SliderState {
  const input = report.businessInput ?? {};
  const recs = report.recommendations;
  const anchoredTicket = anchoredInputValue(recs, "revenue", "ticket");
  const anchoredConversion = anchoredInputValue(recs, "revenue", "conversion");
  const anchoredSessions = anchoredInputValue(recs, "traffic", "monthlySessions");
  const anchoredLabor = anchoredInputValue(recs, "costAvoided", "laborCost");
  const equivalent = equivalentSessions(recs);

  return {
    avgTicket: input.avgTicket ?? anchoredTicket ?? 500,
    conversionPct: (input.organicConversionRate ?? anchoredConversion ?? 0.02) * 100,
    monthlySessions:
      input.monthlyOrganicSessions ??
      anchoredSessions ??
      (equivalent > 0 ? equivalent : 45000),
    laborCost: input.laborCostPerHour ?? anchoredLabor ?? 60,
  };
}

function toParams(state: SliderState, overlapIndex = 0): WhatIfParams {
  return {
    avgTicket: state.avgTicket,
    conversion: state.conversionPct / 100,
    monthlySessions: state.monthlySessions,
    laborCost: state.laborCost,
    overlapIndex,
  };
}

function RangeRow({
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-xs">
      <span className="flex items-center justify-between">
        <span className="font-medium text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums text-foreground">
          {display}
        </span>
      </span>
      <input
        type="range"
        aria-label={label}
        className="h-2 w-full cursor-pointer accent-primary"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function WhatIfPanel({ report }: WhatIfPanelProps) {
  const { ask } = useAgentCommand();
  const baseline = useMemo(() => baselineState(report), [report]);
  const [state, setState] = useState<SliderState>(() => baseline);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(report.recommendations.map((item) => item.id)),
  );
  const aggregate = report.impactEstimate.aggregate;

  useEffect(() => {
    setState(baseline);
    setSelectedIds(new Set(report.recommendations.map((item) => item.id)));
  }, [baseline, report.recommendations]);

  const selectedRecommendations = useMemo(
    () => report.recommendations.filter((item) => selectedIds.has(item.id)),
    [report.recommendations, selectedIds],
  );

  const baselineMaximum = useMemo(
    () =>
      recomputeBusinessImpact(
        report.recommendations,
        toParams(baseline, aggregate?.overlapIndex),
      ).potentialMaximum,
    [report.recommendations, baseline, aggregate?.overlapIndex],
  );

  const current = useMemo(
    () =>
      recomputeBusinessImpact(
        selectedRecommendations,
        toParams(state, aggregate?.overlapIndex),
      ),
    [selectedRecommendations, state, aggregate?.overlapIndex],
  );

  const rows = useMemo(() => {
    const headlineId = current.headline?.recommendationId;
    return [...current.recommendations]
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .map((item) => ({
        ...item,
        isHeadline: item.recommendationId === headlineId,
      }));
  }, [current]);

  const currency = current.potentialMaximum.currency ?? "BRL";
  const hasObservedBusinessData = Boolean(
    report.businessInput?.avgTicket !== undefined &&
      report.businessInput?.organicConversionRate !== undefined &&
      report.businessInput?.monthlyOrganicSessions !== undefined,
  );
  const changed =
    state.avgTicket !== baseline.avgTicket ||
    state.conversionPct !== baseline.conversionPct ||
    state.monthlySessions !== baseline.monthlySessions ||
    state.laborCost !== baseline.laborCost;

  const metrics = [
    {
      label: "Sessões incrementais / ano",
      baseline: baselineMaximum.traffic,
      current: current.potentialMaximum.traffic,
      currency,
      money: false,
    },
    {
      label: "Pedidos incrementais / ano",
      baseline: baselineMaximum.orders,
      current: current.potentialMaximum.orders,
      currency,
      money: false,
    },
    {
      label: "Receita incremental / ano",
      baseline: baselineMaximum.revenue,
      current: current.potentialMaximum.revenue,
      currency,
      money: true,
    },
    {
      label: "Execução manual evitada",
      baseline: baselineMaximum.costAvoided,
      current: current.potentialMaximum.costAvoided,
      currency,
      money: true,
    },
  ];

  return (
    <section aria-label="What-if econômico">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20 px-5 py-5 sm:px-6">
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-primary" />
            What-if econômico
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Ajuste as premissas e compare o funil orgânico atual com o cenário
            incremental consolidado
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]">
            <aside className="border-b bg-muted/20 p-5 lg:border-b-0 lg:border-r lg:p-6">
              <div className="mb-5">
                <p className="text-sm font-semibold">Premissas do cenário</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Valores da operação usados para recalcular o funil.
                </p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            <RangeRow
              label="Ticket médio"
              value={state.avgTicket}
              display={formatCurrency(state.avgTicket, currency)}
              min={0}
              max={Math.max(2000, Math.ceil(baseline.avgTicket / 100) * 100)}
              step={50}
              onChange={(avgTicket) => setState((prev) => ({ ...prev, avgTicket }))}
            />
            <RangeRow
              label="Conversão orgânica"
              value={state.conversionPct}
              display={`${state.conversionPct.toFixed(1).replace(".", ",")}%`}
              min={0}
              max={Math.max(10, Math.ceil(baseline.conversionPct))}
              step={0.1}
              onChange={(conversionPct) =>
                setState((prev) => ({ ...prev, conversionPct }))
              }
            />
            <RangeRow
              label="Sessões orgânicas / mês"
              value={state.monthlySessions}
              display={formatNumber(state.monthlySessions)}
              min={0}
              max={Math.max(
                200000,
                Math.ceil(baseline.monthlySessions / 10000) * 10000,
              )}
              step={1000}
              onChange={(monthlySessions) =>
                setState((prev) => ({ ...prev, monthlySessions }))
              }
            />
            <RangeRow
              label="Mão de obra (R$/h)"
              value={state.laborCost}
              display={formatCurrency(state.laborCost, currency)}
              min={0}
              max={Math.max(200, Math.ceil(baseline.laborCost / 25) * 25)}
              step={5}
              onChange={(laborCost) => setState((prev) => ({ ...prev, laborCost }))}
            />
              </div>
              <div className="mt-6 border-t pt-5">
                <Button
                  className="w-full justify-center"
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={!changed}
                  onClick={() => setState(baseline)}
                >
                  <RotateCcw className="size-3.5" />
                  Restaurar base
                </Button>
              </div>
            </aside>

            <div className="grid min-w-0 gap-5 p-5 sm:p-6">

          <div className="border-b pb-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Operação orgânica atual
              </p>
              <span className="text-[11px] text-muted-foreground">
                Base anualizada
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Sessões / ano</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatNumber(current.scenario.annualOrganicSessions)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pedidos / ano</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatNumber(current.scenario.annualOrganicOrders)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Receita / ano</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatCurrency(current.scenario.annualOrganicRevenue, currency)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-b pb-5 md:grid-cols-3">
            <div className="grid grid-cols-[auto_1fr] gap-2.5">
              <Database className="mt-0.5 size-4 text-primary" />
              <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Dados observados
              </p>
              <p className="mt-1 text-xs leading-relaxed text-foreground">
                {hasObservedBusinessData
                  ? "Sessões, conversão e ticket informados pela operação; cobertura medida pelo crawler."
                  : "Premissas recuperadas do relatório; informe dados da operação para substituir os fallbacks."}
              </p>
              </div>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-2.5">
              <FlaskConical className="mt-0.5 size-4 text-primary" />
              <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Hipóteses do modelo
              </p>
              <p className="mt-1 text-xs leading-relaxed text-foreground">
                Faixas de ganho variam por recomendação e são ponderadas pela
                cobertura, com desconto de sobreposição.
              </p>
              </div>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-2.5">
              <Calculator className="mt-0.5 size-4 text-primary" />
              <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Impacto estimado
              </p>
              <p className="mt-1 text-xs leading-relaxed text-foreground">
                Potencial econômico, não previsão. Valide a hipótese com Search
                Console, Analytics ou experimento controlado.
              </p>
              <a
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                href="https://developers.google.com/search/docs/specialty/ecommerce/share-your-product-data-with-google"
                target="_blank"
                rel="noreferrer"
              >
                Evidência do mecanismo no Google
                <ExternalLink className="size-3" />
              </a>
              </div>
            </div>
          </div>

          <div>
            <div className="mb-5 border-b pb-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">Portfólio do cenário</p>
                  <p className="text-xs text-muted-foreground">{selectedIds.size} de {report.recommendations.length} ações incluídas no cálculo</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedIds(new Set(report.recommendations.map((item) => item.id)))}>Todas</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Limpar</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => ask(`Otimize este cenário econômico. Considere ticket de ${state.avgTicket}, conversão de ${state.conversionPct}% e ${state.monthlySessions} sessões mensais. Monte um plano com as ${selectedIds.size} ações selecionadas.`)}><Bot />Otimizar</Button>
                </div>
              </div>
              <div className="mt-3 flex max-h-28 flex-wrap gap-x-4 gap-y-2 overflow-y-auto">
                {report.recommendations.map((recommendation) => (
                  <label key={recommendation.id} className="flex max-w-xs items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      className="mt-0.5 accent-primary"
                      checked={selectedIds.has(recommendation.id)}
                      onChange={(event) => setSelectedIds((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(recommendation.id); else next.delete(recommendation.id);
                        return next;
                      })}
                    />
                    <span className="line-clamp-1">{recommendation.title}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Impacto incremental consolidado</p>
                <p className="text-xs text-muted-foreground">
                  Cobertura efetiva {Math.round(current.scenario.effectiveCoverage * 100)}%
                  {aggregate?.overlapIndex
                    ? ` após descontar ${Math.round(aggregate.overlapIndex * 100)}% de sobreposição`
                    : ""}
                </p>
              </div>
              <p className="text-xs tabular-nums text-muted-foreground">
                Ganho orgânico efetivo: {formatPercent(current.scenario.organicLiftLow)} – {formatPercent(current.scenario.organicLiftHigh)}
              </p>
            </div>
            <div className="grid overflow-hidden border sm:grid-cols-2">
              {metrics.map((metric) => (
                <div key={metric.label} className="border-b border-r p-4 last:border-b-0 sm:[&:nth-last-child(-n+2)]:border-b-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    {metric.label}
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums">
                    {metric.money
                      ? `${formatCurrency(metric.current.low, currency)} – ${formatCurrency(metric.current.high, currency)}`
                      : `${formatNumber(metric.current.low)} – ${formatNumber(metric.current.high)}`}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
                    <ArrowDownUp className="size-3" />
                    base:{" "}
                    {metric.money
                      ? `${formatCurrency(metric.baseline.low, currency)} – ${formatCurrency(metric.baseline.high, currency)}`
                      : `${formatNumber(metric.baseline.low)} – ${formatNumber(metric.baseline.high)}`}
                    <span
                      data-testid={`delta-${metric.label.split(" ")[0].toLowerCase()}`}
                      className={
                        metric.current.low >= metric.baseline.low
                          ? "font-semibold text-emerald-600 dark:text-emerald-400"
                          : "font-semibold text-destructive"
                      }
                    >
                      {formatDelta(metric.baseline.low, metric.current.low)}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          {current.headline ? (
            <div className="grid gap-4 border-l-2 border-primary bg-primary/5 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5">
              <div>
              <p className="text-xs font-medium text-muted-foreground">
                Maior oportunidade
              </p>
              <p className="mt-1 font-semibold">{current.headline.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Opportunity Score {current.headline.opportunityScore}/100
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Hipótese de ganho {formatPercent(current.headline.organicLiftLow)} – {formatPercent(current.headline.organicLiftHigh)} sobre {formatPercent(current.headline.coverage)} de cobertura
              </p>
              </div>
              <div className="sm:text-right">
              <p className="text-lg font-bold tabular-nums">
                {formatCurrency(current.headline.revenue.low, currency)} –{" "}
                {formatCurrency(current.headline.revenue.high, currency)}
                <span className="text-xs font-normal text-muted-foreground">
                  {" "}
                  de receita/ano
                </span>
              </p>
              <p className="text-xs text-muted-foreground">
                {formatNumber(current.headline.traffic.low)} –{" "}
                {formatNumber(current.headline.traffic.high)} sessões
                incrementais/ano
              </p>
              </div>
            </div>
          ) : null}

          {rows.length > 0 ? (
            <div className="overflow-x-auto border">
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3 font-medium">Ação</th>
                    <th className="p-3 text-right font-medium">Score</th>
                    <th className="p-3 text-right font-medium">Hipótese</th>
                    <th className="p-3 text-right font-medium">Sessões/ano</th>
                    <th className="p-3 text-right font-medium">Receita/ano</th>
                    <th className="p-3 text-right font-medium">Execução evitada</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.recommendationId}
                      className={
                        row.isHeadline
                          ? "border-b bg-primary/5 last:border-0"
                          : "border-b last:border-0"
                      }
                    >
                      <td className="p-3">
                        <span className="font-medium">{row.title}</span>
                        {row.isHeadline ? (
                          <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                            destaque
                          </span>
                        ) : null}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {row.opportunityScore}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {formatPercent(row.organicLiftLow)} –{" "}
                        {formatPercent(row.organicLiftHigh)}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {formatNumber(row.traffic.low)} –{" "}
                        {formatNumber(row.traffic.high)}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {formatCurrency(row.revenue.low, row.currency)} –{" "}
                        {formatCurrency(row.revenue.high, row.currency)}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {formatCurrency(row.costAvoided.low, row.currency)} –{" "}
                        {formatCurrency(row.costAvoided.high, row.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {aggregate ? (
            <div className="flex items-start gap-2 border-l-2 border-amber-600 bg-amber-500/5 p-3 text-xs leading-relaxed text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
              <p>
                {OVERLAP_LABEL[aggregate.overlapRisk]}
                {aggregate.overlapIndex > 0
                  ? ` (índice ${Math.round(aggregate.overlapIndex * 100)}%)`
                  : ""}
                . Tráfego e receita consolidados descontam essa sobreposição;
                as linhas por recomendação são diagnósticas e não devem ser somadas.
              </p>
            </div>
          ) : null}

          <div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Funil consolidado: sessões × cobertura efetiva × ganho orgânico;
              pedidos = sessões incrementais × conversão; receita = pedidos × ticket.
              Economia operacional é pontual, sem recorrência presumida.
            </p>
          </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
