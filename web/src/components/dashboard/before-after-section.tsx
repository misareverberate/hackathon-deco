import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, CheckCircle2, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryBadge } from "@/components/dashboard/badges";
import {
  beforeAfterScenarios,
  generateBeforeAfterScenarios,
} from "@/lib/before-after";
import { CATEGORY_LABELS } from "@/lib/report";
import type { RecommendationReport } from "@/lib/report";
import { cn } from "@/lib/utils";

function CodeBlock({ code, tone }: { code: string; tone: "before" | "after" }) {
  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-md border p-3 text-[11px] leading-relaxed sm:text-xs",
        tone === "after"
          ? "border-emerald-500/30 bg-emerald-950/[0.06] text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200"
          : "border-border bg-muted/50 text-muted-foreground",
      )}
    >
      <code className="font-mono">{code}</code>
    </pre>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="relative pl-8">
      <span className="absolute left-0 top-0 flex size-5 items-center justify-center border-l-2 border-primary text-primary">
        <ChevronRight className="size-3" />
      </span>
      <p className="text-[11px] font-semibold uppercase text-muted-foreground">
        {title}
      </p>
      <div className="mt-1 text-xs leading-relaxed">{children}</div>
    </div>
  );
}

interface BeforeAfterSectionProps {
  report: RecommendationReport;
}

export function BeforeAfterSection({ report }: BeforeAfterSectionProps) {
  const scenarios =
    report && report.recommendations.length > 0
      ? generateBeforeAfterScenarios(report)
      : beforeAfterScenarios;
  const visible = scenarios.slice(0, 3);
  const [activeId, setActiveId] = useState(visible[0]?.id ?? "");
  const scenario = visible.find((item) => item.id === activeId) ?? visible[0];

  if (visible.length === 0) {
    return null;
  }

  return (
    <section aria-label="Antes e Depois">
      <div className="mb-5">
        <h2 className="font-semibold">Antes × Depois</h2>
        <p className="text-sm text-muted-foreground">
          Como cada correção transforma o que mecanismos de busca e agentes de IA
          enxergam do seu catálogo.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Cenários">
        {visible.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === activeId}
            onClick={() => setActiveId(item.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md border bg-card px-3 py-2 text-left text-xs font-medium transition-colors hover:border-primary/40",
              item.id === activeId &&
                "border-primary/50 bg-accent",
            )}
          >
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                item.id === activeId ? "bg-primary" : "bg-muted-foreground/40",
              )}
              aria-hidden="true"
            />
            {CATEGORY_LABELS[item.category]}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={scenario.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.25 }}
          className="mt-4"
        >
          <Card>
            <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
              <div>
                <CategoryBadge category={scenario.category} />
                <h3 className="mt-1.5 text-base font-bold">
                  {scenario.title}
                </h3>
                {scenario.realExample ? (
                  <p className="mt-0.5 text-[11px] font-medium text-primary">
                    Exemplo real: {scenario.realExample}
                  </p>
                ) : null}
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {scenario.problem}
                </p>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase text-muted-foreground">
                    Antes
                  </p>
                  <CodeBlock code={scenario.before} tone="before" />
                </div>
                <div>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                    Depois
                  </p>
                  <CodeBlock code={scenario.after} tone="after" />
                </div>
              </div>

              <div className="flex flex-col gap-3 border-l-2 border-primary bg-muted/30 p-4">
                <Step title="Problema">
                  <p>{scenario.problem}</p>
                </Step>
                <span className="mx-auto -my-1 text-muted-foreground">
                  <ArrowDown className="size-3" />
                </span>
                {scenario.actionSteps && scenario.actionSteps.length > 0 ? (
                  <>
                    <Step title="Como aplicar">
                      <ul className="flex flex-col gap-1">
                        {scenario.actionSteps.map((step) => (
                          <li key={step} className="flex items-start gap-1.5">
                            <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-primary" />
                            {step}
                          </li>
                        ))}
                      </ul>
                    </Step>
                    <span className="mx-auto -my-1 text-muted-foreground">
                      <ArrowDown className="size-3" />
                    </span>
                  </>
                ) : null}
                <Step title="Resultado esperado">
                  <p className="flex items-start gap-1.5">
                    <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-emerald-500" />
                    {scenario.expectedResult}
                  </p>
                </Step>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
