import { Braces, FileText, Package, Search, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS } from "@/lib/report";
import type {
  BusinessImpactLevel,
  ConfidenceLabel,
  EffortLevel,
  EvidenceLevel,
  HealthGrade,
  ImpactLevel,
  OpportunityCategory,
  Priority,
} from "@/lib/report";

const priorityConfig: Record<
  Priority,
  { variant: "destructive" | "warning" | "info" | "neutral"; label: string }
> = {
  critica: { variant: "destructive", label: "Crítica" },
  alta: { variant: "warning", label: "Alta" },
  media: { variant: "info", label: "Média" },
  baixa: { variant: "neutral", label: "Baixa" },
};

const impactConfig: Record<
  ImpactLevel,
  { variant: "success" | "info" | "neutral"; label: string }
> = {
  muito_alto: { variant: "success", label: "Muito Alto" },
  alto: { variant: "success", label: "Alto" },
  medio: { variant: "info", label: "Médio" },
  baixo: { variant: "neutral", label: "Baixo" },
};

const effortConfig: Record<
  EffortLevel,
  { variant: "success" | "info" | "warning" | "destructive"; label: string }
> = {
  muito_baixo: { variant: "success", label: "Muito Baixo" },
  baixo: { variant: "success", label: "Baixo" },
  medio: { variant: "info", label: "Médio" },
  alto: { variant: "warning", label: "Alto" },
};

const categoryIcons: Record<OpportunityCategory, LucideIcon> = {
  SEO: Search,
  GEO: Sparkles,
  Schema: Braces,
  Conteudo: FileText,
  Produto: Package,
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const config = priorityConfig[priority];
  return (
    <Badge variant={config.variant} aria-label={`Prioridade ${config.label}`}>
      {config.label}
    </Badge>
  );
}

export function ImpactBadge({ impact }: { impact: ImpactLevel }) {
  const config = impactConfig[impact];
  return (
    <Badge variant={config.variant} aria-label={`Impacto ${config.label}`}>
      {config.label}
    </Badge>
  );
}

export function EffortBadge({ effort }: { effort: EffortLevel }) {
  const config = effortConfig[effort];
  return (
    <Badge variant={config.variant} aria-label={`Esforço ${config.label}`}>
      {config.label}
    </Badge>
  );
}

export function CategoryBadge({ category }: { category: OpportunityCategory }) {
  const Icon = categoryIcons[category];
  return (
    <Badge variant="outline" className="gap-1.5">
      <Icon className="size-3.5 text-primary" />
      {CATEGORY_LABELS[category]}
    </Badge>
  );
}

const confidenceConfig: Record<
  ConfidenceLabel,
  { variant: "success" | "info" | "neutral"; label: string }
> = {
  HIGH: { variant: "success", label: "Alta" },
  MEDIUM: { variant: "info", label: "Média" },
  LOW: { variant: "neutral", label: "Baixa" },
};

export function ConfidenceBadge({ confidence }: { confidence: ConfidenceLabel }) {
  const config = confidenceConfig[confidence];
  return (
    <Badge variant={config.variant} aria-label={`Confiança ${config.label}`}>
      {config.label}
    </Badge>
  );
}

const evidenceConfig: Record<
  EvidenceLevel,
  { variant: "success" | "info" | "neutral"; label: string }
> = {
  HIGH: { variant: "success", label: "Forte" },
  MEDIUM: { variant: "info", label: "Média" },
  LOW: { variant: "neutral", label: "Fraca" },
};

export function EvidenceBadge({ level }: { level: EvidenceLevel }) {
  const config = evidenceConfig[level];
  return (
    <Badge variant={config.variant} aria-label={`Evidência ${config.label}`}>
      {config.label}
    </Badge>
  );
}

const OVERLAP_LABELS: Record<string, string> = {
  none: "Nenhuma",
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

const overlapConfig: Record<
  string,
  { variant: "neutral" | "success" | "info" | "destructive" }
> = {
  none: { variant: "neutral" },
  low: { variant: "success" },
  medium: { variant: "info" },
  high: { variant: "destructive" },
};

export function OverlapBadge({ risk }: { risk: string }) {
  const config = overlapConfig[risk] ?? { variant: "neutral" };
  return (
    <Badge variant={config.variant} aria-label={`Sobreposição ${OVERLAP_LABELS[risk]}`}>
      {OVERLAP_LABELS[risk] ?? risk}
    </Badge>
  );
}

const businessImpactConfig: Record<
  BusinessImpactLevel,
  { variant: "destructive" | "warning" | "info" | "neutral"; label: string }
> = {
  critical: { variant: "destructive", label: "Crítico" },
  high: { variant: "warning", label: "Alto" },
  medium: { variant: "info", label: "Médio" },
  low: { variant: "neutral", label: "Baixo" },
};

export function BusinessImpactLevelBadge({
  level,
}: {
  level: BusinessImpactLevel;
}) {
  const config = businessImpactConfig[level];
  return (
    <Badge
      variant={config.variant}
      aria-label={`Nível de impacto ${config.label}`}
    >
      {config.label}
    </Badge>
  );
}

const HEALTH_GRADE_LABELS: Record<HealthGrade, string> = {
  A: "Excelente",
  B: "Bom",
  C: "Regular",
  D: "Ruim",
  E: "Muito Ruim",
  F: "Crítico",
};

const healthGradeConfig: Record<
  HealthGrade,
  { variant: "success" | "info" | "warning" | "destructive"; className: string }
> = {
  A: { variant: "success", className: "" },
  B: { variant: "success", className: "" },
  C: { variant: "info", className: "" },
  D: { variant: "warning", className: "" },
  E: { variant: "warning", className: "" },
  F: { variant: "destructive", className: "" },
};

export function HealthGradeBadge({
  grade,
  label,
}: {
  grade: HealthGrade;
  label?: string;
}) {
  const config = healthGradeConfig[grade] ?? healthGradeConfig.F;
  const displayLabel = label ?? HEALTH_GRADE_LABELS[grade];
  return (
    <Badge
      variant={config.variant}
      aria-label={`Saúde ${grade} — ${displayLabel}`}
      className={config.className}
    >
      Nota {grade} · {displayLabel}
    </Badge>
  );
}
