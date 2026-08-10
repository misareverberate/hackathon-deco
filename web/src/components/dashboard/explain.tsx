import { Info } from "lucide-react";
import type { ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  ExplanationInput,
  MetricExplanation,
  RationalePoint,
} from "@/lib/report";

export function ExplainHint({
  explanation,
  label = "Como chegamos a essa estimativa",
}: {
  explanation: MetricExplanation;
  label?: string;
}) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger
          type="button"
          aria-label={label}
          className="inline-flex shrink-0 cursor-help items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-foreground"
        >
          <Info className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>{explanation.summary}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function RationaleList({ rationale }: { rationale: RationalePoint[] }) {
  if (rationale.length === 0) {
    return null;
  }
  return (
    <ul className="mt-1.5 space-y-1">
      {rationale.map((point, index) => {
        const color =
          point.kind === "supporting"
            ? "text-emerald-600 dark:text-emerald-400"
            : point.kind === "missing"
              ? "text-muted-foreground"
              : "text-amber-600 dark:text-amber-400";
        return (
          <li
            key={`${point.kind}-${point.label}-${index}`}
            className={`flex items-start gap-1.5 leading-snug ${color}`}
          >
            {point.kind === "warning" ? (
              <span className="mt-0.5 shrink-0">!</span>
            ) : null}
            <span className="break-words">{point.label}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function ScoreBreakdown({ inputs }: { inputs: ExplanationInput[] }) {
  const weighted = inputs.filter(
    (entry) => entry.weight !== undefined && entry.contribution !== undefined,
  );
  if (weighted.length === 0) {
    return null;
  }
  return (
    <div className="space-y-2">
      {weighted.map((entry) => (
        <div key={entry.key}>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground">{entry.label}</span>
            <span className="font-medium tabular-nums">{entry.display}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/70"
              style={{
                width: `${Math.min(100, Math.max(0, (entry.contribution ?? 0) * 100))}%`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ExplainDetails({ explanation }: { explanation: MetricExplanation }) {
  const hasInputs = explanation.inputs.length > 0;
  const hasRationale = explanation.rationale.length > 0;
  const hasAssumptions = explanation.assumptions.length > 0;
  if (!hasInputs && !hasRationale && !hasAssumptions) {
    return null;
  }
  return (
    <details className="group mt-2 text-xs">
      <summary className="inline-flex cursor-pointer items-center gap-1 text-muted-foreground transition-colors hover:text-foreground">
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          Como chegamos a essa estimativa
        </span>
      </summary>
      <div className="mt-2 space-y-2 rounded-lg border bg-card p-3 text-muted-foreground">
        {hasInputs ? (
          <div className="space-y-1">
            {explanation.inputs.map((entry) => (
              <div key={entry.key} className="flex items-center justify-between gap-2">
                <span>{entry.label}</span>
                <span className="tabular-nums">
                  {entry.display}
                  {entry.weight !== undefined ? ` (peso ${Math.round(entry.weight * 100)}%)` : ""}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <RationaleList rationale={explanation.rationale} />
        {hasAssumptions ? (
          <ul className="space-y-1">
            {explanation.assumptions.map((assumption) => (
              <li key={assumption} className="flex items-start gap-1.5">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                <span className="leading-snug">{assumption}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="pt-1 text-[10px] text-muted-foreground/70">
          {explanation.formula} · modelo v{explanation.modelVersion}
        </p>
      </div>
    </details>
  );
}

interface ExplainableMetricProps {
  label: ReactNode;
  value: ReactNode;
  explanation: MetricExplanation;
  secondary?: ReactNode;
  large?: boolean;
}

export function ExplainableMetric({
  label,
  value,
  explanation,
  secondary,
  large = false,
}: ExplainableMetricProps) {
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <ExplainHint explanation={explanation} />
      </div>
      <div className={large ? "mt-1.5" : "mt-0.5"}>{value}</div>
      {secondary ? <div className="mt-1">{secondary}</div> : null}
      <ExplainDetails explanation={explanation} />
    </div>
  );
}
