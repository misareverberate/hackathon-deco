import { Globe, Package, Timer, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CrawlStats } from "@/lib/api";

const TYPE_LABELS: Record<string, string> = {
  homepage: "Home",
  category: "Categorias",
  product: "Produtos",
  institutional: "Institucionais",
  unknown: "Outros",
};

const TIMING_LABELS: Record<string, string> = {
  robotsMs: "Robots",
  sitemapMs: "Sitemap",
  pagesMs: "Páginas",
  knowledgeMs: "Knowledge graph",
  opportunitiesMs: "Oportunidades",
  recommendationsMs: "Roadmap",
  geoMs: "Simulações GEO",
};

interface CrawlStatsCardProps {
  crawl: CrawlStats;
  compact?: boolean;
}

function formatDuration(milliseconds?: number): string {
  if (milliseconds === undefined) {
    return "—";
  }
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  return `${(milliseconds / 1000).toFixed(1)}s`;
}

export function CrawlStatsCard({ crawl, compact = false }: CrawlStatsCardProps) {
  const pagesByType = crawl.pagesByType ?? {};
  const types = Object.entries(pagesByType).filter(([, count]) => count > 0);

  return (
    <section aria-label="Detalhes do crawl">
      <div className="mb-5">
        <h2 className="font-semibold tracking-tight">Visão da coleta</h2>
        <p className="text-sm text-muted-foreground">
          O que o crawler descobriu durante a análise
        </p>
      </div>

      <div
        className={cn(
          "grid gap-3 sm:grid-cols-2",
          compact ? "grid-cols-2" : "lg:grid-cols-4",
        )}
      >
        <Card>
          <CardContent className={cn("flex items-center gap-4 p-5", compact && "gap-3 p-4")}>
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Globe className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Páginas visitadas
              </p>
              <p className="text-2xl font-bold tabular-nums tracking-tight">
                {crawl.pages}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className={cn("flex items-center gap-4 p-5", compact && "gap-3 p-4")}>
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Package className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Produtos detalhados
              </p>
              <p className="text-2xl font-bold tabular-nums tracking-tight">
                {crawl.products}
              </p>
              {crawl.catalogCount ? (
                <p className="text-xs text-muted-foreground">
                  {crawl.catalogCount.toLocaleString("pt-BR")} no catálogo
                  (sitemap)
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className={cn("flex items-center gap-4 p-5", compact && "gap-3 p-4")}>
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Globe className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                URLs no sitemap
              </p>
              <p className="text-2xl font-bold tabular-nums tracking-tight">
                {crawl.sitemap?.count ?? crawl.sitemap?.urls.length ?? "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className={cn("flex items-center gap-4 p-5", compact && "gap-3 p-4")}>
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Timer className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Duração do crawl
              </p>
              <p className="text-2xl font-bold tabular-nums tracking-tight">
                {formatDuration(crawl.crawlDurationMs)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-3">
        <CardHeader>
          <CardTitle>Páginas por tipo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {types.length > 0 ? (
            types.map(([type, count]) => (
              <Badge
                key={type}
                variant="outline"
                className="gap-1.5 py-1 pl-2.5 pr-3"
              >
                {TYPE_LABELS[type] ?? type}
                <span className="font-semibold tabular-nums">{count}</span>
              </Badge>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Sem dados de tipo.</p>
          )}
          {crawl.categories ? (
            <Badge variant="outline" className="gap-1.5 py-1 pl-2.5 pr-3">
              Categorias
              <span className="font-semibold tabular-nums">
                {crawl.categories.count}
              </span>
            </Badge>
          ) : null}
        </CardContent>
      </Card>

      {crawl.timings ? (
        <Card className="mt-3">
          <CardHeader>
            <CardTitle>Tempo por etapa</CardTitle>
          </CardHeader>
          <CardContent
            className={cn(
              "grid gap-x-6 gap-y-3 sm:grid-cols-2",
              !compact && "lg:grid-cols-4",
            )}
          >
            {Object.entries(crawl.timings)
              .filter(([key, value]) => key !== "totalMs" && typeof value === "number")
              .map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-3 border-b pb-2 text-sm">
                  <span className="text-muted-foreground">{TIMING_LABELS[key] ?? key}</span>
                  <span className="font-mono text-xs tabular-nums">{formatDuration(value)}</span>
                </div>
              ))}
          </CardContent>
        </Card>
      ) : null}

      {crawl.categories?.names?.length ? (
        <Card className="mt-3">
          <CardHeader>
            <CardTitle>Exemplos de categorias encontradas</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {crawl.categories.names.map((name) => (
              <Badge key={name} variant="secondary">
                {name}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {crawl.sitemap?.source ? (
        <Card className="mt-3">
          <CardHeader>
            <CardTitle>Sitemap</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="truncate font-mono text-xs">
              {crawl.sitemap.source}
            </span>
            <span>
              · {crawl.sitemap.count ?? crawl.sitemap.urls.length} URL(s) descoberta(s)
            </span>
          </CardContent>
        </Card>
      ) : null}

      {crawl.errors.length > 0 ? (
        <Card className="mt-3 border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Wrench className="size-4" />
              Erros na coleta ({crawl.errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-1.5">
            {crawl.errors.slice(0, 10).map((error) => (
              <p
                key={error}
                className="truncate font-mono text-xs text-muted-foreground"
                title={error}
              >
                {error}
              </p>
            ))}
            {crawl.errors.length > 10 ? (
              <p className="text-xs text-muted-foreground">
                +{crawl.errors.length - 10} outro(s)
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </section>
  );
}
