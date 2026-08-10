import { ExecutiveSummary } from "@/components/dashboard/executive-summary";
import { BusinessImpactCard } from "@/components/dashboard/business-impact-card";
import { WhatIfPanel } from "@/components/dashboard/what-if-panel";
import { BeforeAfterSection } from "@/components/dashboard/before-after-section";
import { GeoPersonasSection } from "@/components/dashboard/geo-personas";
import { RecommendationTable } from "@/components/dashboard/recommendation-table";
import { RoadmapTimeline } from "@/components/dashboard/roadmap-timeline";
import { CategoryMetrics } from "@/components/dashboard/category-metrics";
import { ActionList } from "@/components/dashboard/action-list";
import { CrawlStatsCard } from "@/components/dashboard/crawl-stats";
import { applyRecommendation } from "@/lib/api";
import { useCallback } from "react";
import type { CrawlStats } from "@/lib/api";
import type { GeoReport, Recommendation, RecommendationReport } from "@/lib/report";

interface DashboardDetailsProps {
  report: RecommendationReport;
  crawl?: CrawlStats;
  geo?: GeoReport;
  onSelect: (recommendation: Recommendation) => void;
}

export function DashboardDetails({ report, crawl, geo, onSelect }: DashboardDetailsProps) {
  const onApply = useCallback(
    async (recommendation: Recommendation) => {
      if (!report.analysisId) {
        throw new Error("Esta análise não possui identificador para aplicar correções.");
      }
      return applyRecommendation(report.analysisId, recommendation.id);
    },
    [report.analysisId],
  );
  return (
    <div className="space-y-16 border-t pb-8">
      <nav
        aria-label="Seções do relatório"
        className="sticky top-16 z-30 -mx-4 overflow-x-auto border-b bg-background/95 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        <div className="flex min-w-max items-center gap-4 py-2">
          <ReportLink href="#visao" icon={BarChart3} label="Visão" />
          {report.impactEstimate.aggregate ? (
            <ReportLink href="#cenarios" icon={SlidersHorizontal} label="Cenários" />
          ) : null}
          <ReportLink href="#diagnostico" icon={ScanSearch} label="Diagnóstico" />
          <ReportLink href="#plano" icon={ListChecks} label="Plano" />
          {geo ? <ReportLink href="#compradores" icon={Users} label="Compradores" /> : null}
          <ReportLink href="#acoes" icon={Sparkles} label="Ações" />
        </div>
      </nav>

      <section id="visao" aria-label="Visão executiva" className="scroll-mt-32 space-y-6">
        <SectionHeading
          eyebrow="Relatório do agente"
          title="Visão executiva"
          description="Decisão, impacto econômico e principais riscos da operação."
        />
        <ExecutiveSummary report={report} />
        <BusinessImpactCard report={report} />
      </section>

      {report.impactEstimate.aggregate ? (
        <section id="cenarios" aria-label="Cenários econômicos" className="scroll-mt-32">
          <WhatIfPanel report={report} />
        </section>
      ) : null}

      <section id="diagnostico" aria-label="Diagnóstico técnico" className="scroll-mt-32 space-y-6">
        <SectionHeading
          eyebrow="Evidências"
          title="Diagnóstico técnico"
          description="Coleta realizada e oportunidades priorizadas pelo agente."
        />
        <div className={crawl ? "grid items-start gap-6 xl:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.6fr)]" : "grid"}>
          {crawl ? <CrawlStatsCard crawl={crawl} compact /> : null}
          <RecommendationTable recommendations={report.topRecommendations} onSelect={onSelect} />
        </div>
      </section>

      <section id="plano" aria-label="Plano de execução" className="scroll-mt-32 space-y-10">
        <SectionHeading
          eyebrow="Da análise à ação"
          title="Plano de execução"
          description="Roadmap priorizado e transformação esperada em cada correção."
        />
        <RoadmapTimeline phases={report.roadmap} onSelect={onSelect} />
        <BeforeAfterSection report={report} />
      </section>

      {geo ? (
        <section id="compradores" aria-label="Simulação de compradores" className="scroll-mt-32">
          <GeoPersonasSection geo={geo} />
        </section>
      ) : null}

      <section id="acoes" aria-label="Ações recomendadas" className="scroll-mt-32 space-y-8">
        <SectionHeading
          eyebrow="Execução"
          title="Ações recomendadas"
          description="Distribuição dos problemas e fila de trabalho sugerida."
        />
        <CategoryMetrics report={report} onSelect={onSelect} />
        <div className="grid gap-6 lg:grid-cols-2">
          <ActionList title="Ações automáticas" description="Executáveis por automação, com um clique" recommendations={report.automaticActions} mode="automatic" onSelect={onSelect} onApply={onApply} />
          <ActionList title="Ações manuais" description="Exigem planejamento e execução humana" recommendations={report.manualActions} mode="manual" onSelect={onSelect} />
        </div>
      </section>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase text-primary">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ReportLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof BarChart3;
  label: string;
}) {
  return (
    <a
      href={href}
      className="inline-flex h-8 items-center gap-1.5 border-b border-transparent px-0 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
    >
      <Icon className="size-3.5" />
      {label}
    </a>
  );
}
import {
  BarChart3,
  ListChecks,
  ScanSearch,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";
