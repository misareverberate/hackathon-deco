import { motion } from "framer-motion";
import {
  Bot,
  CalendarDays,
  ListChecks,
  Store,
  Target,
} from "lucide-react";
import { CountUp } from "./count-up";
import { MetricCard } from "./metric-card";
import { HealthGradeBadge } from "./badges";
import type { HealthResult, RecommendationReport } from "@/lib/report";

const RING_RADIUS = 68;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

interface HeroProps {
  report: RecommendationReport;
}

function formatDate(iso?: string): string {
  if (!iso) {
    return "";
  }
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function ReadinessRing({ health }: { health: HealthResult }) {
  const clamped = Math.min(Math.max(health.score, 0), 100);

  return (
    <div className="relative flex size-44 items-center justify-center sm:size-52">
      <svg
        className="absolute inset-0 size-full -rotate-90"
        viewBox="0 0 160 160"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#4f46e5" />
          </linearGradient>
        </defs>
        <circle
          cx="80"
          cy="80"
          r={RING_RADIUS}
          fill="none"
          stroke="var(--border)"
          strokeWidth="10"
        />
        <motion.circle
          cx="80"
          cy="80"
          r={RING_RADIUS}
          fill="none"
          stroke="url(#ring-gradient)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          initial={{ strokeDashoffset: RING_CIRCUMFERENCE }}
          animate={{ strokeDashoffset: RING_CIRCUMFERENCE * (1 - clamped / 100) }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="relative flex flex-col items-center">
        <span
          className="text-6xl font-extrabold tabular-nums tracking-tight sm:text-7xl"
          aria-label={`Nota ${health.grade} — ${health.label}`}
        >
          {health.grade}
        </span>
        <span className="mt-0.5 text-sm font-semibold text-muted-foreground">
          {health.label}
        </span>
        <span className="mt-0.5 flex items-baseline gap-1 text-xs text-muted-foreground">
          <CountUp value={health.score} ariaLabel={`Health Score ${health.score}`} />
          <span>/ 100</span>
        </span>
      </div>
    </div>
  );
}

export function Hero({ report }: HeroProps) {
  const { impactEstimate } = report;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border bg-card shadow-sm"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_120%_at_0%_0%,oklch(0.9_0.06_293/0.5),transparent_60%),radial-gradient(60%_100%_at_100%_100%,oklch(0.9_0.06_230/0.35),transparent_55%)]"
        aria-hidden="true"
      />
      <div className="relative grid gap-8 p-6 sm:p-10 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
          <ReadinessRing health={report.health} />
          <div className="text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <p className="inline-flex items-center gap-1.5 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-primary">
                <Target className="size-3.5" />
                AI Readiness Score
              </p>
              <HealthGradeBadge
                grade={report.health.grade}
                label={report.health.label}
              />
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              <span className="text-gradient">{report.site.title ?? report.site.host}</span>
            </h1>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-muted-foreground sm:justify-start">
              <span className="inline-flex items-center gap-1.5">
                <Store className="size-3.5" />
                {report.site.host}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-3.5" />
                {formatDate(report.analyzedAt)}
              </span>
            </div>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              {report.totalOpportunities} oportunidades mapeadas para decidir as
              próximas semanas — {impactEstimate.automaticActions} executáveis
              automaticamente.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <MetricCard
            label="Health Score"
            value={report.health.score}
            icon={Target}
            tone="primary"
            description="/ 100"
          />
          <MetricCard
            label="Oportunidades"
            value={report.totalOpportunities}
            icon={ListChecks}
            tone="info"
          />
          <MetricCard
            label="Ações automáticas"
            value={impactEstimate.automaticActions}
            icon={Bot}
            tone="success"
          />
          <MetricCard
            label="Ações manuais"
            value={impactEstimate.manualActions}
            icon={Store}
            tone="warning"
          />
        </div>
      </div>
    </motion.section>
  );
}
