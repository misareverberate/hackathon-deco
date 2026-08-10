import { motion } from "framer-motion";
import { Flag, ListChecks } from "lucide-react";
import { CategoryBadge, PriorityBadge } from "./badges";
import type { Recommendation, RoadmapPhase } from "@/lib/report";

interface RoadmapTimelineProps {
  phases: RoadmapPhase[];
  onSelect: (recommendation: Recommendation) => void;
}

const phaseAccent: Record<number, { bar: string; chip: string }> = {
  1: {
    bar: "bg-emerald-500",
    chip: "border-emerald-500 text-emerald-700 dark:text-emerald-300",
  },
  2: {
    bar: "bg-sky-600",
    chip: "border-sky-600 text-sky-700 dark:text-sky-300",
  },
  3: {
    bar: "bg-sky-500",
    chip: "border-amber-500 text-amber-700 dark:text-amber-300",
  },
};

export function RoadmapTimeline({ phases, onSelect }: RoadmapTimelineProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5 }}
      className="relative"
    >
      <div className="absolute bottom-0 left-[19px] top-2 w-px bg-border" aria-hidden="true" />
      <div className="space-y-8">
        {phases.map((phase) => {
          const accent = phaseAccent[phase.phase] ?? phaseAccent[3];
          return (
            <div key={phase.phase} className="relative pl-12">
              <span
                className={`absolute left-0 top-0 flex size-10 items-center justify-center border-l-2 bg-card ${accent.chip}`}
              >
                <Flag className="size-4" />
              </span>
              <div className="border-t bg-card py-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold tracking-tight">{phase.name}</h3>
                    <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground">
                      {phase.objective}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <ListChecks className="size-3.5" />
                    {phase.recommendations.length}{" "}
                    {phase.recommendations.length === 1 ? "ação" : "ações"}
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  {phase.recommendations.map((recommendation) => (
                    <button
                      key={recommendation.id}
                      type="button"
                      onClick={() => onSelect(recommendation)}
                      className="flex w-full items-center justify-between gap-3 border-b px-1 py-3 text-left transition-colors hover:bg-accent/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {recommendation.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <CategoryBadge category={recommendation.category} />
                          <PriorityBadge priority={recommendation.priority} />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                          {recommendation.score}
                        </span>
                        <span className={`h-8 w-1 rounded-full ${accent.bar}`} aria-hidden="true" />
                      </div>
                    </button>
                  ))}
                  {phase.recommendations.length === 0 ? (
                    <p className="border-b border-dashed px-3.5 py-3 text-center text-xs text-muted-foreground">
                      Nenhuma ação nesta fase
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
