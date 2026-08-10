import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Globe,
  Loader2,
  Plus,
  Radar,
  Sparkles,
  Store,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAnalysis } from "@/hooks/use-analysis";
import type { AnalysisStage } from "@/lib/api";
import { DashboardPage } from "@/pages/dashboard-page";
import type { RecommendationReport } from "@/lib/report";
import type { ClientBusinessInput } from "@/lib/report";
import { BusinessInputFields } from "@/components/dashboard/business-input-fields";

interface AnalyzePageProps {
  onReport: (report: RecommendationReport) => void;
}

const STAGE_LIST: { stage: AnalysisStage; label: string }[] = [
  { stage: "discovery", label: "Coleta de robots.txt e sitemap" },
  { stage: "crawl", label: "Crawling e extração" },
  { stage: "knowledge", label: "Montagem do Knowledge Graph" },
  {
    stage: "opportunities",
    label: "Análise de oportunidades (SEO · GEO · Schema)",
  },
  { stage: "recommendations", label: "Priorização e roadmap" },
  { stage: "geo", label: "Simulação de compradores (GEO)" },
];

export function AnalyzePage({ onReport }: AnalyzePageProps) {
  const [url, setUrl] = useState("");
  const [business, setBusiness] = useState<ClientBusinessInput>({});
  const { status, report, error, run, reset, cancel, activeStage, completedStages, crawl } =
    useAnalysis();

  useEffect(() => {
    if (status === "success" && report) {
      onReport(report);
    }
  }, [status, report, onReport]);

  const submit = () => {
    if (url.trim()) {
      void run(url.trim(), {
        ...(Object.keys(business).length > 0 ? { business } : {}),
      });
    }
  };

  const startAgain = () => {
    reset();
    setUrl("");
    setBusiness({});
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {status === "running" ? (
        <div className="mx-auto max-w-lg">
          <div className="flex flex-col items-center gap-4 rounded-md border border-t-2 border-t-primary bg-card p-8 text-center">
            <Radar className="size-10 animate-pulse text-primary" />
            <h1 className="text-xl font-bold">
              Analisando {url}
            </h1>
            <p className="text-sm text-muted-foreground">
              Pipeline local: crawl → knowledge graph → oportunidades → roadmap
            </p>
            <div className="mt-2 flex w-full flex-col gap-3 border bg-muted/30 p-4 text-left" role="status">
              {STAGE_LIST.map(({ stage, label }) => {
                const complete = completedStages.some(
                  (entry) => entry.stage === stage,
                );
                const active = !complete && activeStage?.stage === stage;
                return (
                  <div key={stage} className="flex items-center gap-2.5 text-sm">
                    {complete ? (
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    ) : active ? (
                      <Loader2 className="size-4 animate-spin text-primary" />
                    ) : (
                      <span className="size-4 rounded-full border-2 border-border" />
                    )}
                    <span className={complete ? "text-muted-foreground line-through" : ""}>
                      {label}
                    </span>
                    {stage === "crawl" && active && crawl ? (
                      <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">
                        {crawl.pages} páginas · {crawl.products} produtos
                        {crawl.total > 0 ? ` · ${crawl.discovered}/${crawl.total}` : ""}
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <Button variant="outline" onClick={cancel}>Cancelar análise</Button>
          </div>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="mx-auto max-w-lg">
          <div className="flex flex-col items-center gap-3 rounded-md border border-t-2 border-t-destructive bg-destructive/5 p-8 text-center">
            <TriangleAlert className="size-10 text-destructive" />
            <h1 className="text-lg font-bold">
              Não foi possível concluir a análise
            </h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <div className="mt-2 flex flex-col items-center gap-2">
              <Globe className="size-4 text-muted-foreground" />
              <Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://www.sualoja.com.br"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    submit();
                  }
                }}
                className="w-full sm:w-96"
                aria-label="URL da loja"
              />
            </div>
            <div className="mt-2 flex gap-2">
              <Button onClick={submit} disabled={!url.trim()}>
                <Loader2 className="size-4" />
                Tentar novamente
              </Button>
              <Button variant="ghost" onClick={reset}>
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {status === "idle" ? (
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto max-w-3xl overflow-hidden rounded-md border border-t-2 border-t-primary bg-card p-8 text-center sm:p-12"
        >
          <div className="flex flex-col items-center gap-5">
            <span className="flex size-14 items-center justify-center border-r text-primary">
              <Radar className="size-7" />
            </span>
            <div>
              <h1 className="text-2xl font-bold sm:text-3xl">
                Analisar uma loja agora
              </h1>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                Informe a URL da loja para executar o pipeline completo de
                análise (crawl, conhecimento, oportunidades e roadmap) sem sair
                desta tela.
              </p>
            </div>
            <div className="flex w-full max-w-md items-center gap-2">
              <Globe className="size-4 shrink-0 text-muted-foreground" />
              <Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://www.sualoja.com.br"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    submit();
                  }
                }}
                aria-label="URL da loja"
              />
            </div>
            <div className="w-full max-w-md text-left">
              <BusinessInputFields value={business} onChange={setBusiness} />
            </div>
            <Button onClick={submit} disabled={!url.trim()} size="lg">
              <Sparkles className="size-4" />
              Executar análise
            </Button>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Store className="size-3.5" />
                Evidências coletadas diretamente da loja analisada
              </span>
            </div>
          </div>
        </motion.section>
      ) : null}

      {status === "success" && report ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-6 text-emerald-500" />
              <div>
                <p className="font-semibold">Análise concluída</p>
                <p className="text-sm text-muted-foreground">
                  {report.site.title ?? report.site.host} · {report.health.score}{" "}
                  de prontidão · {report.totalOpportunities} oportunidade(s)
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={startAgain}>
              <Plus />
              Nova análise
            </Button>
          </div>
          <DashboardPage report={report} crawl={report.crawl} geo={report.geo} />
        </div>
      ) : null}
    </main>
  );
}
