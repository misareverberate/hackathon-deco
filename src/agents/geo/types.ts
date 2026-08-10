import type { KnowledgeBase as KB } from "../../knowledge/knowledgeBuilder.js";

export type KnowledgeBase = KB;

export type BuyerPersona = "price" | "spec" | "brand" | "compare";

export interface QuestionConstraint {
  attributeName: string;
  attributeValue: string;
  normalizedName: string;
  normalizedValue: string;
  operator: "equals" | "contains" | "lte" | "gte";
}

export interface GeoQuestion {
  id: string;
  categoryId: string;
  categoryName: string;
  persona: BuyerPersona;
  text: string;
  constraints: QuestionConstraint[];
  candidateProductIds?: string[];
}

export type BuyerActionType =
  | "search_catalog"
  | "inspect_product"
  | "compare_products"
  | "ask_follow_up"
  | "inspect_store_policy"
  | "finish_purchase"
  | "abandon_journey";

export type BuyerDecision = "PURCHASE" | "ABANDON" | "UNRESOLVED";

export interface BuyerMission {
  id: string;
  persona: BuyerPersona;
  categoryId: string;
  categoryName: string;
  goal: string;
  context: string;
  constraints: QuestionConstraint[];
  candidateProductIds?: string[];
  expectedAttributes: string[];
  budget?: number;
  priorities: string[];
  riskTolerance: number;
  patience: number;
  maxSteps: number;
}

export interface BuyerObservation {
  action: BuyerActionType;
  summary: string;
  evidence: string[];
  productIds: string[];
  missingAttributes: string[];
  resolvedAttributes?: string[];
  selectedProductId?: string;
}

export interface BuyerJourneyStep {
  index: number;
  action: BuyerActionType;
  reason: string;
  observation: BuyerObservation;
  confidenceBefore: number;
  confidenceAfter: number;
}

export interface BuyerState {
  missionId: string;
  consideredProductIds: string[];
  inspectedProductIds: string[];
  rejectedProductIds: string[];
  selectedProductId?: string;
  openQuestions: string[];
  satisfiedConstraints: string[];
  missingAttributes: string[];
  conversionBlockers: string[];
  confidence: number;
  decision: BuyerDecision;
  decisionReason?: string;
}

export interface BuyerJourney {
  id: string;
  mission: BuyerMission;
  steps: BuyerJourneyStep[];
  finalState: BuyerState;
  evaluation: EvaluationResult;
}

export interface BuyerResponse {
  questionId: string;
  questionText: string;
  categoryId: string;
  categoryName: string;
  persona: BuyerPersona;
  productIds: string[];
  matchedAttributes: string[];
  missingAttributes: string[];
  explanation: string;
  confidence: number;
}

export type EvaluationStatus = "SUCCESS" | "PARTIAL" | "FAIL";

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

export interface EvaluationResult {
  questionId: string;
  questionText: string;
  categoryId: string;
  categoryName: string;
  persona: BuyerPersona;
  status: EvaluationStatus;
  productIds: string[];
  missingAttributes: string[];
  explanation: string;
  confidence: number;
  answer: SimulatedAnswer;
}

export type RawEvaluation = Omit<EvaluationResult, "answer">;

export interface CategoryScore {
  categoryId: string;
  categoryName: string;
  total: number;
  successRate: number;
}

export interface PersonaScore {
  persona: BuyerPersona;
  label: string;
  questions: number;
  successRate: number;
  avgConfidence: number;
}

export interface PageProblem {
  pageId: string;
  url: string;
  reason: string;
}

export interface GeoRecommendation {
  title: string;
  impact: "high" | "medium" | "low";
  affectedProducts: number;
  reason: string;
}

export interface GeoReadinessReport {
  overallScore: number;
  successRate: number;
  llmEnabled: boolean;
  categoryScores: CategoryScore[];
  personaScores: PersonaScore[];
  questionsTested: number;
  failures: EvaluationResult[];
  missingAttributes: Record<string, number>;
  pageProblems: PageProblem[];
  recommendations: GeoRecommendation[];
  journeys: BuyerJourney[];
  simulationErrors: Array<{
    missionId: string;
    code: "TIMEOUT" | "SIMULATION_ERROR";
    message: string;
  }>;
  simulationMeta: {
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
  details: {
    evaluations: EvaluationResult[];
    missingAttributes: Record<string, number>;
    pageProblems: PageProblem[];
  };
}
