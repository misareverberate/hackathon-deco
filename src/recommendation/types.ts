export type OpportunityCategory =
  | "SEO"
  | "GEO"
  | "Conteudo"
  | "Schema"
  | "Produto";

export type Priority = "critica" | "alta" | "media" | "baixa";
export type ImpactLevel = "muito_alto" | "alto" | "medio" | "baixo";
export type EffortLevel = "muito_baixo" | "baixo" | "medio" | "alto";

export type EvidenceSource =
  | "SEARCH_CONSOLE"
  | "GA4"
  | "MERCHANT_CENTER"
  | "CRAWLER"
  | "STRUCTURED_DATA"
  | "STATIC_ASSUMPTION";

export type EvidenceLevel = "HIGH" | "MEDIUM" | "LOW";
export type ConfidenceLabel = "HIGH" | "MEDIUM" | "LOW";
export type OpportunityScope =
  | "product"
  | "category"
  | "page"
  | "site"
  | "global";

export type BusinessImpactLevel = "critical" | "high" | "medium" | "low";
export type HealthGrade = "A" | "B" | "C" | "D" | "E" | "F";
export type OverlapRisk = "none" | "low" | "medium" | "high";

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  category: OpportunityCategory;
  priority: Priority;
  impact: ImpactLevel;
  confidence: number;
  effort: EffortLevel;
  automatable: boolean;
  affectedProducts?: number;
  reason?: string;
  affectedItems?: string[];
  scope?: OpportunityScope;
  affectedProductIds?: string[];
}

export interface OpportunityReportSite {
  baseUrl: string;
  host: string;
  title?: string;
}

export interface OpportunityReport {
  site: OpportunityReportSite;
  opportunities: Opportunity[];
  healthScore?: number;
}

export interface ConcreteAction {
  title: string;
  description: string;
  steps: string[];
}

export interface Recommendation {
  id: string;
  opportunityId: string;
  title: string;
  description: string;
  category: OpportunityCategory;
  priority: Priority;
  impact: ImpactLevel;
  confidence: number;
  effort: EffortLevel;
  automatable: boolean;
  score: number;
  expectedImpact: string;
  action: ConcreteAction;
  reason?: string;
  affectedProducts?: number;
  affectedItems?: string[];
  businessImpact?: BusinessImpact;
}

export interface RoadmapPhase {
  phase: 1 | 2 | 3;
  name: string;
  objective: string;
  recommendations: Recommendation[];
}

export interface ImpactEstimate {
  automaticActions: number;
  manualActions: number;
  estimatedScoreGain: number;
  topCategory: OpportunityCategory | null;
  aggregate?: AggregateImpact;
}

export interface RecommendationReport {
  site: OpportunityReportSite;
  healthScore: number;
  health: HealthResult;
  totalOpportunities: number;
  executiveSummary: string;
  recommendations: Recommendation[];
  topRecommendations: Recommendation[];
  automaticActions: Recommendation[];
  manualActions: Recommendation[];
  roadmap: RoadmapPhase[];
  impactEstimate: ImpactEstimate;
  executiveSummaryModel?: ExecutiveSummaryModel;
  businessInput?: ClientBusinessInput;
}

export const IMPACT_WEIGHTS: Record<ImpactLevel, number> = {
  muito_alto: 1,
  alto: 0.75,
  medio: 0.5,
  baixo: 0.25,
};

export const EASE_WEIGHTS: Record<EffortLevel, number> = {
  muito_baixo: 1,
  baixo: 0.75,
  medio: 0.5,
  alto: 0.25,
};

export const PRIORITY_WEIGHTS: Record<Priority, number> = {
  critica: 1,
  alta: 0.75,
  media: 0.5,
  baixa: 0.25,
};

export const PRIORITY_ORDER: Record<Priority, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};

export function impactLabel(impact: ImpactLevel): string {
  switch (impact) {
    case "muito_alto":
      return "Muito Alto";
    case "alto":
      return "Alto";
    case "medio":
      return "Médio";
    case "baixo":
      return "Baixo";
  }
}

export function effortLabel(effort: EffortLevel): string {
  switch (effort) {
    case "muito_baixo":
      return "Muito Baixo";
    case "baixo":
      return "Baixo";
    case "medio":
      return "Médio";
    case "alto":
      return "Alto";
  }
}

export function businessImpactLevelLabel(level: BusinessImpactLevel): string {
  switch (level) {
    case "critical":
      return "Crítica";
    case "high":
      return "Alta";
    case "medium":
      return "Média";
    case "low":
      return "Baixa";
  }
}

export interface TrafficRange {
  low: number;
  high: number;
}

export interface RevenueRange {
  low: number;
  high: number;
  currency: string;
}

export interface ExplanationInput {
  key: string;
  label: string;
  display: string;
  value?: number;
  weight?: number;
  contribution?: number;
}

export type RationaleKind = "supporting" | "missing" | "warning";

export interface RationalePoint {
  kind: RationaleKind;
  label: string;
  source?: EvidenceSource;
}

export interface MetricExplanation {
  metric: string;
  summary: string;
  formula: string;
  inputs: ExplanationInput[];
  rationale: RationalePoint[];
  assumptions: string[];
  modelVersion: string;
}

export interface OpportunityScoreResult {
  score: number;
  coverage: number;
  severity: number;
  businessWeight: number;
  reach: number;
  normalizedReach: number;
  explanation: MetricExplanation;
}

export interface TrafficEstimate {
  perMonth: TrafficRange;
  perYear: TrafficRange;
  explanation: MetricExplanation;
}

export interface RevenueEstimate {
  low: number;
  high: number;
  currency: string;
  explanation: MetricExplanation;
}

export interface CostEstimate {
  low: number;
  high: number;
  currency: string;
  explanation: MetricExplanation;
}

export interface ClientBusinessInput {
  avgTicket?: number;
  organicConversionRate?: number;
  monthlyOrganicSessions?: number;
  laborCostPerHour?: number;
  currency?: string;
}

export interface ConfidenceQuality {
  coverageQuality: number;
  freshness: number;
  completeness: number;
}

export interface ConfidenceResult {
  label: ConfidenceLabel;
  score: number;
  quality: ConfidenceQuality;
  explanation: MetricExplanation;
}

export interface EvidenceResult {
  sources: EvidenceSource[];
  missingSources: EvidenceSource[];
  level: EvidenceLevel;
  description: string;
  explanation: MetricExplanation;
}

export interface OverlapResult {
  index: number;
  risk: OverlapRisk;
}

export interface BusinessImpact {
  opportunity: OpportunityScoreResult;
  businessImpactLevel: BusinessImpactLevel;
  traffic: TrafficEstimate;
  revenue: RevenueEstimate;
  costAvoided: CostEstimate;
  confidence: ConfidenceResult;
  evidence: EvidenceResult;
  overlap: OverlapResult;
}

export interface HeadlineEstimate {
  recommendationId: string;
  title: string;
  revenueLow: number;
  revenueHigh: number;
  trafficLow: number;
  trafficHigh: number;
  confidence: ConfidenceLabel;
  opportunityScore: number;
  businessImpactLevel: BusinessImpactLevel;
  explanation: MetricExplanation;
}

export interface HighestOpportunity {
  recommendationId: string;
  title: string;
  opportunityScore: number;
  businessImpactLevel: BusinessImpactLevel;
  confidence: ConfidenceLabel;
  explanation: MetricExplanation;
}

export interface AggregateImpact {
  headline: HeadlineEstimate;
  potentialMaximum: {
    revenue: RevenueRange;
    traffic: TrafficRange;
    costAvoided: RevenueRange;
  };
  overlapRisk: OverlapRisk;
  overlapIndex: number;
  evidence: EvidenceResult;
  highestOpportunity: HighestOpportunity;
  explanation: MetricExplanation;
  modelVersion: string;
}

export interface HealthResult {
  score: number;
  grade: HealthGrade;
  label: string;
  explanation: MetricExplanation;
}

export interface ExecutiveSummaryModel {
  headline: string;
  highlights: string[];
  warnings: string[];
  assumptions: string[];
  methodology: string;
  text: string;
  highestOpportunity: HighestOpportunity;
}
