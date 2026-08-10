import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, Check, Download, Hand, Loader2, Store, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CategoryBadge, ImpactBadge } from "./badges";
import type { ApplyActionResponse, ApplyArtifact } from "@/lib/api";
import type { Recommendation } from "@/lib/report";

interface ActionListProps {
  title: string;
  description: string;
  recommendations: Recommendation[];
  mode: "automatic" | "manual";
  onSelect: (recommendation: Recommendation) => void;
  onApply?: (recommendation: Recommendation) => Promise<ApplyActionResponse>;
}

const modeConfig = {
  automatic: {
    icon: Bot,
    iconClasses: "border-primary text-primary",
    ring: "ring-primary/20",
    applyLabel: "Aplicar",
  },
  manual: {
    icon: Store,
    iconClasses: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
    ring: "ring-amber-500/20",
    applyLabel: "Ver detalhes",
  },
};

function downloadArtifact(artifact: ApplyArtifact) {
  const type = artifact.kind === "json-ld" ? "application/json" : "text/markdown";
  const blob = new Blob([artifact.content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = artifact.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function ApplyResult({ result }: { result: ApplyActionResponse }) {
  const { artifact, counterfactual } = result.data;
  const rate = (value: number) => `${Math.round(value * 100)}%`;
  return (
    <div className="mt-3 rounded border border-primary/20 bg-primary/5 p-3 text-sm">
      <p className="font-medium">{result.summary}</p>
      {counterfactual.simulatable ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="success">
            Sucesso {rate(counterfactual.beforeSuccessRate)} → {rate(counterfactual.afterSuccessRate)}
          </Badge>
          <Badge variant="success">
            {counterfactual.resolvedJourneys} jornada(s) resolvida(s)
          </Badge>
          {counterfactual.avgConfidenceDelta !== 0 ? (
            <Badge>
              Confiança {counterfactual.avgConfidenceDelta >= 0 ? "+" : ""}
              {counterfactual.avgConfidenceDelta}
            </Badge>
          ) : null}
        </div>
      ) : null}
      <div className="mt-2">
        <Button variant="outline" size="sm" onClick={() => downloadArtifact(artifact)}>
          <Download className="size-3.5" />
          Baixar {artifact.kind} ({artifact.filename})
        </Button>
      </div>
    </div>
  );
}

export function ActionList({
  title,
  description,
  recommendations,
  mode,
  onSelect,
  onApply,
}: ActionListProps) {
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<Record<string, ApplyActionResponse>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const config = modeConfig[mode];
  const Icon = config.icon;

  const handleApply = async (recommendation: Recommendation) => {
    if (mode !== "automatic" || !onApply) {
      onSelect(recommendation);
      return;
    }
    setApplying((current) => new Set(current).add(recommendation.id));
    setErrors((current) => {
      const next = { ...current };
      delete next[recommendation.id];
      return next;
    });
    try {
      const response = await onApply(recommendation);
      setResults((current) => ({ ...current, [recommendation.id]: response }));
      setApplied((current) => new Set(current).add(recommendation.id));
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [recommendation.id]: error instanceof Error ? error.message : "Não foi possível aplicar a correção.",
      }));
    } finally {
      setApplying((current) => {
        const next = new Set(current);
        next.delete(recommendation.id);
        return next;
      });
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5 }}
      className="flex flex-col gap-3"
    >
      <div className="flex items-center gap-3 px-1">
        <span className={`flex size-9 items-center justify-center border-l-2 ${config.iconClasses}`}>
          <Icon className="size-4.5" />
        </span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="grid overflow-hidden border">
        {recommendations.map((recommendation) => {
          const isApplied = applied.has(recommendation.id);
          const isApplying = applying.has(recommendation.id);
          const result = results[recommendation.id];
          const error = errors[recommendation.id];
          return (
            <div
              key={recommendation.id}
              className={`border-b bg-card p-4 transition-colors last:border-b-0 hover:bg-muted/30 ${isApplied ? "opacity-75" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium leading-snug">{recommendation.title}</p>
                  <p className="mt-1 line-clamp-2 max-w-xl text-sm text-muted-foreground">
                    {recommendation.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isApplied ? (
                    <Badge variant="success" className="gap-1">
                      <Check className="size-3" />
                      Aplicada
                    </Badge>
                  ) : null}
                  <Button
                    variant={mode === "automatic" ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleApply(recommendation)}
                    disabled={isApplied || isApplying}
                  >
                    {isApplying ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : mode === "automatic" ? (
                      <Wrench className="size-3.5" />
                    ) : (
                      <Hand className="size-3.5" />
                    )}
                    {isApplying ? "Aplicando…" : isApplied ? "Aplicada" : config.applyLabel}
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <CategoryBadge category={recommendation.category} />
                <ImpactBadge impact={recommendation.impact} />
              </div>
              {result ? <ApplyResult result={result} /> : null}
              {error ? (
                <p className="mt-3 text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}
