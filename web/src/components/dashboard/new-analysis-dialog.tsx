import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Globe,
  Loader2,
  Package,
  Radar,
  TriangleAlert,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useAnalysis } from "@/hooks/use-analysis";
import type { AnalysisStage } from "@/lib/api";
import type { RecommendationReport } from "@/lib/report";
import type { ClientBusinessInput } from "@/lib/report";
import { BusinessInputFields } from "@/components/dashboard/business-input-fields";

interface NewAnalysisDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted: (report: RecommendationReport) => void;
  defaultUrl?: string;
}

interface StageMeta {
  key: AnalysisStage;
  label: string;
  hint?: string;
}

const STAGES: StageMeta[] = [
  { key: "discovery", label: "Coleta de robots.txt e sitemap", hint: "Descobrir URLs do site" },
  { key: "crawl", label: "Crawling e extração", hint: "Baixar páginas e extrair dados" },
  { key: "knowledge", label: "Montagem do Knowledge Graph", hint: "Estruturar produtos e páginas" },
  { key: "opportunities", label: "Análise de oportunidades", hint: "SEO · GEO · Schema" },
  { key: "recommendations", label: "Priorização e roadmap", hint: "Ordenar por impacto" },
  { key: "geo", label: "Simulação de compradores", hint: "Testar jornadas e objeções" },
];

function formatMs(ms: number): string {
  const seconds = Math.max(0, ms) / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(0)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${rest}s`;
}

function formatCounter(value: number): string {
  return value.toLocaleString("pt-BR");
}

export function NewAnalysisDialog({
  open,
  onOpenChange,
  onCompleted,
  defaultUrl,
}: NewAnalysisDialogProps) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [maxProducts, setMaxProducts] = useState("");
  const [business, setBusiness] = useState<ClientBusinessInput>({});
  const [now, setNow] = useState<number>(Date.now());
  const {
    status,
    report,
    error,
    run: runAnalysis,
    cancel,
    reset,
    startedAt,
    activeStage,
    completedStages,
    crawl,
  } = useAnalysis();
  const completedRef = useRef(false);

  useEffect(() => {
    if (open) {
      setUrl(defaultUrl ?? "");
      setMaxProducts("");
      setBusiness({});
      setNow(Date.now());
      completedRef.current = false;
      reset();
    }
  }, [open, defaultUrl, reset]);

  useEffect(() => {
    if (status !== "running") {
      return;
    }
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (status === "success" && report && !completedRef.current) {
      completedRef.current = true;
      onCompleted(report);
    }
  }, [status, report, onCompleted]);

  const run = () => {
    if (!url.trim()) {
      return;
    }
    const parsedMax = Number.parseInt(maxProducts, 10);
    const options = {
      ...(Number.isFinite(parsedMax) && parsedMax > 0
        ? { maxProducts: parsedMax }
        : {}),
      ...(Object.keys(business).length > 0 ? { business } : {}),
    };
    setNow(Date.now());
    void runAnalysis(url, options);
  };

  const completedKeys = new Set(completedStages.map((stage) => stage.stage));
  const activeIndex = activeStage
    ? STAGES.findIndex((stage) => stage.key === activeStage.stage)
    : -1;

  const crawlRatio =
    crawl && crawl.total > 0
      ? Math.min(1, crawl.pages / crawl.total)
      : null;

  const stageFraction =
    activeIndex < 0
      ? 0
      : activeStage?.stage === "crawl" && crawlRatio !== null
        ? crawlRatio
        : 0.5;

  const progress =
    status === "running"
      ? Math.round(
          ((completedKeys.size / STAGES.length) * 100) +
            (activeIndex >= 0 ? (stageFraction / STAGES.length) * 100 : 0),
        )
      : 0;

  const elapsed = startedAt ? now - startedAt : 0;
  const currentLabel = activeStage?.label ?? "Preparando análise…";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && status === "running") cancel();
        onOpenChange(next);
      }}
    >
      <DialogContent
        className="max-w-lg"
        onInteractOutside={(event) => {
          if (status === "running") event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          if (status === "running") event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radar className="size-4.5 text-primary" />
            Nova análise
          </DialogTitle>
          <DialogDescription>
            Informe a URL da loja para gerar um novo relatório de prontidão.
          </DialogDescription>
        </DialogHeader>

        {status === "idle" || status === "error" ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Globe className="size-4 shrink-0 text-muted-foreground" />
              <Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://www.sualoja.com.br"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    run();
                  }
                }}
                aria-label="URL da loja"
              />
            </div>
            <div className="flex items-center gap-2">
              <Package className="size-4 shrink-0 text-muted-foreground" />
              <Input
                type="number"
                min={1}
                value={maxProducts}
                onChange={(event) => setMaxProducts(event.target.value)}
                placeholder="Produtos a detalhar (opcional)"
                aria-label="Máximo de produtos a detalhar"
              />
            </div>
            <BusinessInputFields value={business} onChange={setBusiness} />
            {status === "error" ? (
              <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                {error}
              </p>
            ) : null}
          </div>
        ) : null}

        {status === "running" ? (
          <div className="flex flex-col gap-4 rounded-xl border bg-muted/40 p-4" role="status">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Análise em andamento</p>
                <p className="text-xs text-muted-foreground">
                  Etapa {Math.max(1, Math.min(activeIndex + 1, STAGES.length))} de{" "}
                  {STAGES.length} · {currentLabel}
                </p>
              </div>
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground"
                aria-label={`Tempo decorrido ${formatMs(elapsed)}`}
              >
                <Clock3 className="size-3.5" />
                {formatMs(elapsed)}
              </span>
            </div>

            <Progress value={progress} aria-label={`Progresso ${progress}%`} />
            <p className="text-right text-[11px] font-medium tabular-nums text-muted-foreground">
              {progress}%
            </p>

            <ol className="flex flex-col gap-1.5">
              {STAGES.map((meta, index) => {
                const complete = completedKeys.has(meta.key);
                const active = index === activeIndex && !complete;
                const stage = completedStages.find(
                  (item) => item.stage === meta.key,
                );
                const startedAtForStage =
                  activeStage?.stage === meta.key
                    ? activeStage.startedAt
                    : stage?.startedAt;
                const duration =
                  complete && stage
                    ? stage.endedAt - stage.startedAt
                    : active && startedAtForStage
                      ? now - startedAtForStage
                      : null;

                return (
                  <li
                    key={meta.key}
                    className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2"
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center">
                      {complete ? (
                        <CheckCircle2 className="size-4 text-emerald-500" />
                      ) : active ? (
                        <Loader2 className="size-4 animate-spin text-primary" />
                      ) : (
                        <span className="size-4 rounded-full border-2 border-border" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={
                          complete
                            ? "text-sm text-muted-foreground line-through"
                            : "text-sm font-medium"
                        }
                      >
                        {meta.label}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {meta.key === "crawl" && crawl ? (
                          <>
                            {formatCounter(crawl.pages)} páginas ·{" "}
                            {formatCounter(crawl.products)} produtos ·{" "}
                            {formatCounter(crawl.discovered)} descobertas
                          </>
                        ) : (
                          meta.hint
                        )}
                      </p>
                    </div>
                    {duration !== null ? (
                      <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
                        {formatMs(duration)}
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>

            {activeStage?.stage === "crawl" && crawl && crawlRatio !== null ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Páginas visitadas</span>
                  <span className="tabular-nums">
                    {formatCounter(crawl.pages)} / {formatCounter(crawl.total)}
                  </span>
                </div>
                <Progress value={Math.round(crawlRatio * 100)} />
              </div>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Você pode cancelar com segurança; o crawler e as simulações serão interrompidos.
            </p>
          </div>
        ) : null}

        {status === "success" && report ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border bg-emerald-500/5 p-6 text-center">
            <CheckCircle2 className="size-10 text-emerald-500" />
            <p className="font-semibold">Análise concluída</p>
            <p className="text-sm text-muted-foreground">
              {report.site.title ?? report.site.host} · {report.health.score} de
              prontidão · {report.totalOpportunities} oportunidade(s)
            </p>
            {report.crawl?.crawlDurationMs ? (
              <p className="text-xs text-muted-foreground">
                Crawling em {formatMs(report.crawl.crawlDurationMs)} ·{" "}
                {formatCounter(report.crawl.pages)} páginas ·{" "}
                {formatCounter(report.crawl.products)} produtos
              </p>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          {status === "idle" || status === "error" ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={run} disabled={!url.trim()}>
                {status === "error" ? "Tentar novamente" : "Executar análise"}
              </Button>
            </>
          ) : null}
          {status === "running" ? (
            <Button variant="outline" className="w-full" onClick={() => {
              cancel();
              onOpenChange(false);
            }}>
              Cancelar análise
            </Button>
          ) : null}
          {status === "success" ? (
            <Button onClick={() => onOpenChange(false)}>Concluir</Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
