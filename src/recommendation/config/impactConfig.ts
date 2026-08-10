import type {
  BusinessImpactLevel,
  ClientBusinessInput,
  EvidenceSource,
  ImpactLevel,
} from "../types.js";

export interface ScoreWeights {
  coverage: number;
  severity: number;
  business: number;
  reach: number;
  confidence: number;
}

export interface ImpactAssumptions {
  ctrLiftMin: number;
  ctrLiftMax: number;
  organicConversionRate: number;
  avgTicket: number;
  organicOpportunityIndex: number;
  monthlyOrganicSessions?: number;
  hoursPerTask: number;
  laborCostPerHour: number;
  taskFrequencyPerYear: number;
  monthsPerYear: number;
  currency: string;
}

export interface ImpactWeights {
  business: Record<string, number>;
  severity: Record<ImpactLevel, number>;
  score: ScoreWeights;
  category: Record<string, number>;
}

export interface ImpactLevelThresholds {
  critical: number;
  high: number;
  medium: number;
}

export interface HealthGradeThresholds {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
}

export interface ImpactConfig {
  version: string;
  assumptions: ImpactAssumptions;
  weights: ImpactWeights;
  confidenceThresholds: { high: number; medium: number };
  impactLevelThresholds: ImpactLevelThresholds;
  healthGradeThresholds: HealthGradeThresholds;
  sourceWeights: Record<EvidenceSource, number>;
  defaultCategoryWeight: number;
  defaultBusinessWeight: number;
  organicLiftByOpportunity: Record<string, { min: number; max: number }>;
  overlapNote: string;
  disclaimer: string;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

const DEFAULT_BUSINESS_WEIGHTS: Record<string, number> = {
  "op:schema-product": 1,
  "op:schema-incomplete": 0.7,
  "op:geo-attributes": 0.6,
  "op:produto-price": 0.5,
  "op:seo-title": 0.5,
  "op:produto-brand": 0.4,
  "op:produto-category": 0.4,
  "op:conteudo-description": 0.4,
  "op:conteudo-faq": 0.35,
  "op:seo-description": 0.35,
  "op:seo-canonical": 0.3,
  "op:schema-entity": 0.3,
  "op:conteudo-institutional": 0.3,
};

const DEFAULT_SEVERITY_WEIGHTS: Record<ImpactLevel, number> = {
  baixo: 0.3,
  medio: 0.6,
  alto: 0.8,
  muito_alto: 1,
};

const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  coverage: 0.2,
  severity: 0.2,
  business: 0.2,
  reach: 0.25,
  confidence: 0.15,
};

const DEFAULT_CATEGORY_WEIGHTS: Record<string, number> = {
  Notebook: 1,
  Notebooks: 1,
  "Placa de Vídeo": 1,
  GPU: 1,
  "Placa de vídeo": 1,
  Processador: 0.9,
  Processadores: 0.9,
  Memória: 0.8,
  Memórias: 0.8,
  Storage: 0.8,
  "Placa-mãe": 0.8,
  Periféricos: 0.5,
  Acessórios: 0.4,
  Mousepad: 0.3,
};

const DEFAULT_SOURCE_WEIGHTS: Record<EvidenceSource, number> = {
  SEARCH_CONSOLE: 0.9,
  GA4: 0.9,
  MERCHANT_CENTER: 0.9,
  CRAWLER: 0.65,
  STRUCTURED_DATA: 0.6,
  STATIC_ASSUMPTION: 0.4,
};

const DEFAULT_ORGANIC_LIFT_BY_OPPORTUNITY: Record<
  string,
  { min: number; max: number }
> = {
  "op:seo-title": { min: 0.02, max: 0.08 },
  "op:seo-description": { min: 0.02, max: 0.08 },
  "op:seo-canonical": { min: 0.01, max: 0.05 },
  "op:schema-product": { min: 0.05, max: 0.15 },
  "op:schema-incomplete": { min: 0.03, max: 0.1 },
  "op:schema-entity": { min: 0.01, max: 0.05 },
  "op:geo-attributes": { min: 0.03, max: 0.12 },
  "op:conteudo-description": { min: 0.05, max: 0.2 },
  "op:conteudo-faq": { min: 0.03, max: 0.1 },
  "op:conteudo-institutional": { min: 0.01, max: 0.04 },
  "op:produto-price": { min: 0.03, max: 0.1 },
  "op:produto-brand": { min: 0.02, max: 0.08 },
  "op:produto-category": { min: 0.02, max: 0.08 },
};

export const DEFAULT_IMPACT_CONFIG: ImpactConfig = {
  version: "1.1",
  assumptions: {
    ctrLiftMin: 0.05,
    ctrLiftMax: 0.15,
    organicConversionRate: 0.02,
    avgTicket: 500,
    organicOpportunityIndex: 100,
    monthlyOrganicSessions: undefined,
    hoursPerTask: 0.25,
    laborCostPerHour: 60,
    taskFrequencyPerYear: 12,
    monthsPerYear: 12,
    currency: "BRL",
  },
  weights: {
    business: DEFAULT_BUSINESS_WEIGHTS,
    severity: DEFAULT_SEVERITY_WEIGHTS,
    score: DEFAULT_SCORE_WEIGHTS,
    category: DEFAULT_CATEGORY_WEIGHTS,
  },
  confidenceThresholds: { high: 82, medium: 55 },
  impactLevelThresholds: { critical: 75, high: 60, medium: 40 },
  healthGradeThresholds: { a: 90, b: 75, c: 60, d: 40, e: 20 },
  sourceWeights: DEFAULT_SOURCE_WEIGHTS,
  defaultCategoryWeight: 0.6,
  defaultBusinessWeight: 0.3,
  organicLiftByOpportunity: DEFAULT_ORGANIC_LIFT_BY_OPPORTUNITY,
  overlapNote:
    "As recomendações podem afetar os mesmos produtos e não devem ser interpretadas como aditivas.",
  disclaimer:
    "Esta estimativa representa um modelo simplificado de apoio à decisão e não deve ser interpretada como projeção financeira.",
};

export function resolveConfig(
  partial?: DeepPartial<ImpactConfig>,
): ImpactConfig {
  return deepMerge(DEFAULT_IMPACT_CONFIG, partial ?? {});
}

export function loadConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ImpactConfig {
  const partial: DeepPartial<ImpactConfig> = {};

  const numberVar = (value: string | undefined): number | undefined => {
    if (value === undefined || value.trim() === "") {
      return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const assumptions: DeepPartial<ImpactAssumptions> = {};
  const ctrLiftMin = numberVar(env.CTR_LIFT_MIN);
  if (ctrLiftMin !== undefined) {
    assumptions.ctrLiftMin = ctrLiftMin;
  }
  const ctrLiftMax = numberVar(env.CTR_LIFT_MAX);
  if (ctrLiftMax !== undefined) {
    assumptions.ctrLiftMax = ctrLiftMax;
  }
  const conversionRate = numberVar(env.ORGANIC_CONVERSION_RATE);
  if (conversionRate !== undefined) {
    assumptions.organicConversionRate = conversionRate;
  }
  const avgTicket = numberVar(env.AVG_TICKET);
  if (avgTicket !== undefined) {
    assumptions.avgTicket = avgTicket;
  }
  const organicIndex = numberVar(env.ORGANIC_OPPORTUNITY_INDEX);
  if (organicIndex !== undefined) {
    assumptions.organicOpportunityIndex = organicIndex;
  }
  const monthlySessions = numberVar(env.MONTHLY_ORGANIC_SESSIONS);
  if (monthlySessions !== undefined) {
    assumptions.monthlyOrganicSessions = monthlySessions;
  }
  const hoursPerTask = numberVar(env.HOURS_PER_TASK);
  if (hoursPerTask !== undefined) {
    assumptions.hoursPerTask = hoursPerTask;
  }
  const laborCostPerHour = numberVar(env.LABOR_COST_PER_HOUR);
  if (laborCostPerHour !== undefined) {
    assumptions.laborCostPerHour = laborCostPerHour;
  }
  const taskFrequency = numberVar(env.TASK_FREQUENCY_PER_YEAR);
  if (taskFrequency !== undefined) {
    assumptions.taskFrequencyPerYear = taskFrequency;
  }
  const monthsPerYear = numberVar(env.MONTHS_PER_YEAR);
  if (monthsPerYear !== undefined) {
    assumptions.monthsPerYear = monthsPerYear;
  }
  if (env.CURRENCY !== undefined && env.CURRENCY.trim() !== "") {
    assumptions.currency = env.CURRENCY.trim().toUpperCase();
  }
  if (Object.keys(assumptions).length > 0) {
    partial.assumptions = assumptions;
  }

  const weights: DeepPartial<ImpactWeights> = {};
  const businessWeights = parseNumberRecord(env.IMPACT_WEIGHTS_JSON);
  if (businessWeights) {
    weights.business = businessWeights;
  }
  const categoryWeights = parseNumberRecord(env.CATEGORY_WEIGHTS_JSON);
  if (categoryWeights) {
    weights.category = categoryWeights;
  }
  const severityWeights = parseNumberRecord(env.SEVERITY_WEIGHTS_JSON);
  if (severityWeights) {
    weights.severity = severityWeights as Partial<Record<ImpactLevel, number>>;
  }
  const scoreWeights = parseNumberRecord(env.SCORE_WEIGHTS_JSON);
  if (scoreWeights) {
    weights.score = scoreWeights as DeepPartial<ScoreWeights>;
  }
  if (Object.keys(weights).length > 0) {
    partial.weights = weights;
  }

  const confidenceThresholds = parseNumberRecord(
    env.CONFIDENCE_THRESHOLDS_JSON,
  );
  if (confidenceThresholds) {
    partial.confidenceThresholds = confidenceThresholds;
  }

  const sourceWeights = parseNumberRecord(env.SOURCE_WEIGHTS_JSON);
  if (sourceWeights) {
    partial.sourceWeights = sourceWeights as Partial<
      Record<EvidenceSource, number>
    >;
  }

  const defaultCategoryWeight = numberVar(env.DEFAULT_CATEGORY_WEIGHT);
  if (defaultCategoryWeight !== undefined) {
    partial.defaultCategoryWeight = defaultCategoryWeight;
  }
  const defaultBusinessWeight = numberVar(env.DEFAULT_BUSINESS_WEIGHT);
  if (defaultBusinessWeight !== undefined) {
    partial.defaultBusinessWeight = defaultBusinessWeight;
  }

  const impactLevelThresholds = parseNumberRecord(
    env.IMPACT_LEVEL_THRESHOLDS_JSON,
  );
  if (impactLevelThresholds) {
    partial.impactLevelThresholds = impactLevelThresholds;
  }

  const healthGradeThresholds = parseNumberRecord(
    env.HEALTH_GRADE_THRESHOLDS_JSON,
  );
  if (healthGradeThresholds) {
    partial.healthGradeThresholds = healthGradeThresholds;
  }

  return resolveConfig(partial);
}

export function buildBusinessConfig(
  input: ClientBusinessInput,
): ImpactConfig {
  const partial: DeepPartial<ImpactConfig> = {};
  const assumptions: DeepPartial<ImpactAssumptions> = {};

  if (input.avgTicket !== undefined && Number.isFinite(input.avgTicket)) {
    assumptions.avgTicket = Math.max(1, input.avgTicket);
  }
  if (
    input.organicConversionRate !== undefined &&
    Number.isFinite(input.organicConversionRate)
  ) {
    assumptions.organicConversionRate = Math.min(
      1,
      Math.max(0, input.organicConversionRate),
    );
  }
  if (
    input.monthlyOrganicSessions !== undefined &&
    Number.isFinite(input.monthlyOrganicSessions)
  ) {
    assumptions.monthlyOrganicSessions = Math.max(0, input.monthlyOrganicSessions);
  }
  if (
    input.laborCostPerHour !== undefined &&
    Number.isFinite(input.laborCostPerHour)
  ) {
    assumptions.laborCostPerHour = Math.max(1, input.laborCostPerHour);
  }
  if (input.currency !== undefined && input.currency.trim() !== "") {
    assumptions.currency = input.currency.trim().toUpperCase();
  }

  if (Object.keys(assumptions).length > 0) {
    partial.assumptions = assumptions;
  }

  return resolveConfig(partial);
}

export function classifyImpactLevel(
  score: number,
  config: ImpactConfig,
): BusinessImpactLevel {
  const thresholds = config.impactLevelThresholds;
  if (score >= thresholds.critical) {
    return "critical";
  }
  if (score >= thresholds.high) {
    return "high";
  }
  if (score >= thresholds.medium) {
    return "medium";
  }
  return "low";
}

export function currencyFormatter(
  currency: string,
): Intl.NumberFormat {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}

export function formatCurrency(value: number, currency: string): string {
  return currencyFormatter(currency).format(value);
}

function parseNumberRecord(
  raw: string | undefined,
): Record<string, number> | null {
  if (raw === undefined || raw.trim() === "") {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object") {
      return null;
    }
    const record: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        record[key] = value;
      }
    }
    return Object.keys(record).length > 0 ? record : null;
  } catch {
    return null;
  }
}

function deepMerge<T>(base: T, override: DeepPartial<T>): T {
  const baseRecord = base as Record<string, unknown>;
  const overrideRecord = (override ?? {}) as Record<string, unknown>;
  const merged: Record<string, unknown> = { ...baseRecord };
  for (const [key, value] of Object.entries(overrideRecord)) {
    const baseValue = baseRecord[key];
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      baseValue !== null &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue)
    ) {
      merged[key] = deepMerge(baseValue, value);
    } else {
      merged[key] = value;
    }
  }
  return merged as T;
}
