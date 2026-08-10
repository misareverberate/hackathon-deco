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

export interface RecommendationReportSite {
  baseUrl: string;
  host: string;
  title?: string;
}

export interface RecommendationReport {
  analysisId?: string;
  site: RecommendationReportSite;
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
  analyzedAt?: string;
  executiveSummaryModel?: ExecutiveSummaryModel;
  businessInput?: ClientBusinessInput;
  geo?: GeoReport;
  samples?: ProductSample[];
}

export const CATEGORY_LABELS: Record<OpportunityCategory, string> = {
  SEO: "SEO",
  GEO: "GEO",
  Schema: "Schema",
  Conteudo: "Conteúdo",
  Produto: "Produto",
};

export const CATEGORY_ORDER: OpportunityCategory[] = [
  "SEO",
  "GEO",
  "Schema",
  "Conteudo",
  "Produto",
];

export const CATEGORY_ICONS: Record<OpportunityCategory, string> = {
  SEO: "Search",
  GEO: "Sparkles",
  Schema: "Braces",
  Conteudo: "FileText",
  Produto: "Package",
};

export type GeoPersonaId = "price" | "spec" | "brand" | "compare";

export interface GeoPersonaScore {
  persona: GeoPersonaId;
  label: string;
  questions: number;
  successRate: number;
  avgConfidence: number;
}

export type GeoEvaluationStatus = "SUCCESS" | "PARTIAL" | "FAIL";

export interface SimulatedAnswerFact {
  id: string;
  name: string;
  price?: string;
  brand?: string;
}

export interface SimulatedAnswer {
  text: string;
  facts: SimulatedAnswerFact[];
  blockingAttributes: string[];
}

export interface GeoEvaluation {
  questionId: string;
  questionText: string;
  persona: GeoPersonaId;
  status: GeoEvaluationStatus;
  confidence: number;
  explanation: string;
  missingAttributes: string[];
  answer: SimulatedAnswer;
  categoryId?: string;
  categoryName?: string;
}

export interface GeoRecommendation {
  title: string;
  impact: "high" | "medium" | "low";
  affectedProducts: number;
  reason: string;
}

export interface GeoReport {
  overallScore: number;
  successRate: number;
  llmEnabled: boolean;
  categoryScores: {
    categoryId: string;
    categoryName: string;
    total: number;
    successRate: number;
  }[];
  personaScores: GeoPersonaScore[];
  questionsTested: number;
  evaluations: GeoEvaluation[];
  recommendations: GeoRecommendation[];
  journeys?: BuyerJourney[];
  simulationErrors?: Array<{
    missionId: string;
    code: "TIMEOUT" | "SIMULATION_ERROR";
    message: string;
  }>;
  simulationMeta?: {
    version: string;
    durationMs: number;
    requestedJourneys: number;
    completedJourneys: number;
    failedJourneys: number;
    maxQuestions: number;
    concurrency: number;
    journeyTimeoutMs: number;
    totalBudgetMs: number;
    llmLogicalCalls: number;
    llmHttpRequests: number;
    llmRetries: number;
    llmFailures: number;
  };
}

export type BuyerActionType =
  | "search_catalog"
  | "inspect_product"
  | "compare_products"
  | "ask_follow_up"
  | "inspect_store_policy"
  | "finish_purchase"
  | "abandon_journey";

export interface BuyerJourney {
  id: string;
  mission: {
    id: string;
    persona: GeoPersonaId;
    categoryId: string;
    categoryName: string;
    goal: string;
    context?: string;
    expectedAttributes: string[];
    budget?: number;
    priorities?: string[];
    riskTolerance?: number;
    patience?: number;
    maxSteps: number;
  };
  steps: Array<{
    index: number;
    action: BuyerActionType;
    reason: string;
    observation: {
      summary: string;
      evidence: string[];
      productIds: string[];
      missingAttributes: string[];
    };
    confidenceBefore: number;
    confidenceAfter: number;
  }>;
  finalState: {
    consideredProductIds: string[];
    inspectedProductIds: string[];
    rejectedProductIds: string[];
    selectedProductId?: string;
    openQuestions: string[];
    conversionBlockers?: string[];
    confidence: number;
    decision: "PURCHASE" | "ABANDON" | "UNRESOLVED";
    decisionReason?: string;
  };
  evaluation: GeoEvaluation;
}

export interface ProductSample {
  id: string;
  name: string;
  price?: string;
  brand?: string;
  url: string;
  categoryId: string;
  categoryName: string;
  attributes: Record<string, string>;
  schema: Record<string, unknown> | null;
}
