import { Bot, Eye, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CategoryBadge, EffortBadge, ImpactBadge, PriorityBadge } from "./badges";
import type { Recommendation } from "@/lib/report";
import { useAgentCommand } from "@/contexts/agent-command-context";

interface RecommendationTableProps {
  recommendations: Recommendation[];
  onSelect: (recommendation: Recommendation) => void;
}

export function RecommendationTable({
  recommendations,
  onSelect,
}: RecommendationTableProps) {
  const { ask } = useAgentCommand();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5 }}
      className="overflow-hidden rounded-md border bg-card"
    >
      <div className="flex items-center justify-between gap-4 border-b px-5 py-4">
        <div>
          <h2 className="font-semibold">
            Top 10 oportunidades
          </h2>
          <p className="text-sm text-muted-foreground">
            Priorizadas por impacto × confiança × facilidade × abrangência
          </p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="w-[42%]">Oportunidade</TableHead>
            <TableHead className="hidden md:table-cell">Prioridade</TableHead>
            <TableHead className="hidden sm:table-cell">Impacto</TableHead>
            <TableHead className="hidden lg:table-cell">Confiança</TableHead>
            <TableHead className="hidden lg:table-cell">Esforço</TableHead>
            <TableHead className="text-right">Detalhes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recommendations.map((recommendation) => (
            <TableRow
              key={recommendation.id}
              className="group cursor-pointer"
              onClick={() => onSelect(recommendation)}
            >
              <TableCell>
                <p className="font-medium leading-snug group-hover:text-primary">
                  {recommendation.title}
                </p>
                <div className="mt-1 flex items-center gap-1.5">
                  <CategoryBadge category={recommendation.category} />
                  {recommendation.automatable ? (
                    <span className="inline-flex items-center gap-1 border-l-2 border-primary pl-1.5 text-xs font-medium text-primary">
                      <Sparkles className="size-3" />
                      Automatizável
                    </span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <PriorityBadge priority={recommendation.priority} />
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <ImpactBadge impact={recommendation.impact} />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <div className="flex w-28 items-center gap-2">
                  <Progress
                    value={recommendation.confidence}
                    className="h-1.5"
                    indicatorClassName="bg-primary"
                  />
                  <span className="w-9 text-xs font-medium tabular-nums text-muted-foreground">
                    {recommendation.confidence}%
                  </span>
                </div>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <EffortBadge effort={recommendation.effort} />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Perguntar ao agente sobre ${recommendation.title}`}
                  title="Perguntar ao agente"
                  onClick={(event) => {
                    event.stopPropagation();
                    ask(`Investigue a recomendação ${recommendation.id}: ${recommendation.title}. Explique evidência, impacto, risco e próximo passo.`);
                  }}
                >
                  <Bot />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-100 md:opacity-0 md:transition-opacity md:group-hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(recommendation);
                  }}
                >
                  <Eye />
                  Ver detalhes
                </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </motion.div>
  );
}
