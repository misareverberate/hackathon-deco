import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type OpportunityCategory,
  type Recommendation,
  type RecommendationReport,
} from "@/lib/report";

interface CategoryMetricsProps {
  report: RecommendationReport;
  onSelect: (recommendation: Recommendation) => void;
}

const categoryDot: Record<OpportunityCategory, string> = {
  SEO: "var(--chart-1)",
  GEO: "var(--chart-2)",
  Schema: "var(--chart-3)",
  Conteudo: "var(--chart-4)",
  Produto: "var(--chart-5)",
};

function groupByCategory(recommendations: Recommendation[]) {
  return CATEGORY_ORDER.map((category) => {
    const items = recommendations.filter((item) => item.category === category);
    const top = items.reduce<Recommendation | null>(
      (max, item) => (max && max.score >= item.score ? max : item),
      null,
    );
    return { category, items, top };
  }).filter((entry) => entry.items.length > 0);
}

export function CategoryMetrics({ report, onSelect }: CategoryMetricsProps) {
  const groups = groupByCategory(report.recommendations);
  const chartData = groups.map((group) => ({
    category: CATEGORY_LABELS[group.category],
    oportunidades: group.items.length,
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
      >
        <Card className="h-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-4 text-primary" />
              Problemas por categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -28, bottom: 0 }}>
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--border)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="category"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--accent)" }}
                    contentStyle={{
                      borderRadius: 4,
                      border: "1px solid var(--border)",
                      background: "var(--card)",
                      fontSize: 13,
                    }}
                  />
                  <Bar
                    dataKey="oportunidades"
                    radius={[2, 2, 0, 0]}
                    fill="var(--chart-1)"
                    maxBarSize={42}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, delay: 0.05 }}
        className="grid content-start overflow-hidden border sm:grid-cols-2"
      >
        {groups.map((group) => (
          <button
            key={group.category}
            type="button"
            onClick={() => group.top && onSelect(group.top)}
            className="border-b border-r bg-card p-4 text-left transition-colors hover:bg-muted/50"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                <span
                  className="size-2.5 rounded-full"
                  style={{ background: categoryDot[group.category] }}
                  aria-hidden="true"
                />
                {CATEGORY_LABELS[group.category]}
              </span>
              <span className="text-lg font-bold tabular-nums">
                {group.items.length}
              </span>
            </div>
            {group.top ? (
              <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
                {group.top.title}
              </p>
            ) : null}
          </button>
        ))}
      </motion.div>
    </div>
  );
}
