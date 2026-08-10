import { useState } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  CircleGauge,
  Package,
  SearchCheck,
  Store,
  Target,
  FileCode2,
  FlaskConical,
  ListTodo,
  Play,
  Presentation,
} from "lucide-react";
import { HealthGradeBadge, PriorityBadge } from "./badges";
import type { CrawlStats } from "@/lib/api";
import type { GeoReport, Recommendation, RecommendationReport } from "@/lib/report";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAgentCommand } from "@/contexts/agent-command-context";

interface AgentContextPanelProps {
  report: RecommendationReport;
  crawl?: CrawlStats;
  geo?: GeoReport;
  onSelect: (recommendation: Recommendation) => void;
}

function formatDate(iso?: string): string {
  if (!iso) return "Análise de demonstração";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function AgentContextPanel({
  report,
  crawl,
  geo,
  onSelect,
}: AgentContextPanelProps) {
  const { ask } = useAgentCommand();
  const [persona, setPersona] = useState("spec");
  const [goal, setGoal] = useState("Encontrar o melhor produto para minha necessidade");
  const [budget, setBudget] = useState("");
  const [counterfactual, setCounterfactual] = useState(true);
  const priorities = (
    report.topRecommendations.length > 0
      ? report.topRecommendations
      : report.recommendations
  ).slice(0, 3);

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden rounded-md border bg-card" aria-label="Contexto disponível para o agente">
      <div className="border-b p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase text-muted-foreground">Contexto da análise</p>
            <h1 className="mt-1 truncate text-xl font-semibold">
              {report.site.title ?? report.site.host}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Store className="size-3.5" />{report.site.host}</span>
              <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" />{formatDate(report.analyzedAt)}</span>
            </div>
          </div>
          <HealthGradeBadge grade={report.health.grade} label={report.health.label} />
        </div>
      </div>

      <div className="grid grid-cols-2 border-b sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        <ContextMetric icon={CircleGauge} label="Prontidão" value={`${report.health.score}/100`} tone="text-primary" />
        <ContextMetric icon={Target} label="Oportunidades" value={String(report.totalOpportunities)} tone="text-rose-600 dark:text-rose-400" />
        <ContextMetric icon={Package} label="Produtos" value={String(crawl?.products ?? report.samples?.length ?? 0)} tone="text-cyan-600 dark:text-cyan-400" />
        <ContextMetric icon={SearchCheck} label="Sucesso GEO" value={geo ? `${Math.round(geo.successRate * 100)}%` : "—"} tone="text-emerald-600 dark:text-emerald-400" />
      </div>

      <div className="flex flex-1 flex-col overflow-y-auto p-5">
        <p className="text-xs font-medium uppercase text-muted-foreground">Leitura do agente</p>
        <p className="mt-2 text-sm leading-relaxed text-foreground/85">
          {report.executiveSummaryModel?.headline ?? report.executiveSummary}
        </p>

        {priorities.length > 0 ? (
          <div className="mt-6 border-t pt-4">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Prioridades atuais
            </p>
            <div className="mt-2 divide-y">
              {priorities.map((recommendation, index) => (
                <button
                  key={recommendation.id}
                  type="button"
                  className="group flex w-full items-start gap-3 py-3 text-left"
                  onClick={() => onSelect(recommendation)}
                >
                  <span className="mt-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold leading-snug group-hover:text-primary">
                        {recommendation.title}
                      </span>
                      <PriorityBadge priority={recommendation.priority} />
                    </span>
                    {index === 0 ? (
                      <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
                        {recommendation.reason ?? recommendation.description}
                      </span>
                    ) : null}
                  </span>
                  <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 border-t pt-4">
          <p className="text-xs font-medium uppercase text-muted-foreground">Operar com o agente</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button type="button" size="sm" variant="outline" className="justify-start" onClick={() => ask("Monte um plano de 7 dias para 2 pessoas usando as recomendações desta análise.")}><ListTodo />Plano de 7 dias</Button>
            <Button type="button" size="sm" variant="outline" className="justify-start" onClick={() => ask(`Gere um artefato executável para a recomendação ${priorities[0]?.id ?? "principal"}: ${priorities[0]?.title ?? "principal"}.`)}><FileCode2 />Gerar artefato</Button>
            <Button type="button" size="sm" variant="outline" className="justify-start" onClick={() => ask(`Simule o antes e depois da correção ${priorities[0]?.id ?? "principal"}: ${priorities[0]?.title ?? "principal"}.`)}><FlaskConical />Antes/depois</Button>
            <Button type="button" size="sm" variant="outline" className="justify-start" onClick={() => ask("Prepare um pitch executivo desta análise para uma reunião de decisão.")}><Presentation />Gerar pitch</Button>
          </div>
        </div>

        <form
          className="mt-5 border-t pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            const personaLabel = { price: "sensível a preço", spec: "técnico", brand: "orientado por marca", compare: "comparador" }[persona] ?? persona;
            const base = `Simule um comprador ${personaLabel} com a missão: ${goal}${budget ? `. Orçamento máximo de R$ ${budget}` : ""}.`;
            ask(counterfactual && priorities[0]
              ? `${base} Faça uma simulação contrafactual antes e depois da correção ${priorities[0].id}: ${priorities[0].title}.`
              : base);
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase text-muted-foreground">Laboratório de compradores</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Configure uma jornada nova contra o catálogo.</p>
            </div>
            <Play className="size-4 text-primary" />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">Persona
              <select className="mt-1 h-9 w-full rounded-md border bg-card px-2 text-sm text-foreground" value={persona} onChange={(event) => setPersona(event.target.value)}>
                <option value="spec">Técnico</option><option value="price">Preço</option><option value="brand">Marca</option><option value="compare">Comparador</option>
              </select>
            </label>
            <label className="text-xs text-muted-foreground">Orçamento
              <Input className="mt-1 h-9" inputMode="numeric" value={budget} onChange={(event) => setBudget(event.target.value.replace(/\D/g, ""))} placeholder="Sem limite" />
            </label>
          </div>
          <label className="mt-2 block text-xs text-muted-foreground">Missão
            <Input className="mt-1 h-9" value={goal} onChange={(event) => setGoal(event.target.value)} />
          </label>
          <label className="mt-3 flex items-center gap-2 text-xs">
            <input type="checkbox" className="accent-primary" checked={counterfactual} onChange={(event) => setCounterfactual(event.target.checked)} />
            Comparar com a principal correção aplicada virtualmente
          </label>
          <Button type="submit" size="sm" className="mt-3 w-full"><Play />Executar jornada</Button>
        </form>
      </div>
    </aside>
  );
}

interface ContextMetricProps {
  icon: typeof CircleGauge;
  label: string;
  value: string;
  tone: string;
}

function ContextMetric({ icon: Icon, label, value, tone }: ContextMetricProps) {
  return (
    <div className="min-w-0 border-r p-4 last:border-r-0 lg:[&:nth-child(2)]:border-r-0 xl:[&:nth-child(2)]:border-r">
      <Icon className={`size-4 ${tone}`} />
      <p className="mt-3 truncate text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
