import type {
  ExplanationInput,
  Recommendation,
  RevenueRange,
  TrafficRange,
} from "./report";

export interface WhatIfParams {
  avgTicket?: number;
  conversion?: number;
  monthlySessions?: number;
  laborCost?: number;
  overlapIndex?: number;
}

export interface WhatIfRecommendation {
  recommendationId: string;
  title: string;
  opportunityScore: number;
  coverage: number;
  organicLiftLow: number;
  organicLiftHigh: number;
  traffic: TrafficRange;
  revenue: RevenueRange;
  costAvoided: RevenueRange;
  currency: string;
}

export interface WhatIfResult {
  headline: WhatIfRecommendation | null;
  scenario: {
    annualOrganicSessions: number;
    annualOrganicOrders: number;
    annualOrganicRevenue: number;
    effectiveCoverage: number;
    organicLiftLow: number;
    organicLiftHigh: number;
    currency: string;
  };
  potentialMaximum: {
    traffic: TrafficRange;
    orders: TrafficRange;
    revenue: RevenueRange;
    costAvoided: RevenueRange;
    currency: string;
  };
  recommendations: WhatIfRecommendation[];
}

function inputValue(
  inputs: ExplanationInput[],
  key: string,
): number | undefined {
  const found = inputs.find((item) => item.key === key);
  return typeof found?.value === "number" ? found.value : undefined;
}

export function anchoredInputValue(
  recommendations: Recommendation[],
  metric: "traffic" | "revenue" | "costAvoided",
  key: string,
): number | undefined {
  for (const recommendation of recommendations) {
    const inputs =
      recommendation.businessImpact?.[metric]?.explanation.inputs ?? [];
    const value = inputValue(inputs, key);
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function computeRecommendation(
  recommendation: Recommendation,
  params: WhatIfParams,
): WhatIfRecommendation {
  const business = recommendation.businessImpact;
  const currency = business?.revenue.currency ?? "BRL";

  const trafficInputs = business?.traffic.explanation.inputs ?? [];
  const revenueInputs = business?.revenue.explanation.inputs ?? [];
  const costInputs = business?.costAvoided.explanation.inputs ?? [];

  const anchored = inputValue(trafficInputs, "monthlySessions");
  const index = inputValue(trafficInputs, "index");
  const denominator = inputValue(trafficInputs, "denominator") ?? 0;
  const coverage = inputValue(trafficInputs, "coverage") ?? 1;
  const ctrLiftMin = inputValue(trafficInputs, "ctrLiftMin") ?? 0;
  const ctrLiftMax = inputValue(trafficInputs, "ctrLiftMax") ?? 0;
  const months = inputValue(trafficInputs, "months") ?? 12;

  const sessionsSlider = params.monthlySessions;
  const sessionsBase =
    sessionsSlider !== undefined
      ? sessionsSlider
      : anchored !== undefined
        ? anchored
        : (index ?? 0) * denominator;

  const traffic: TrafficRange = {
    low: Math.round(sessionsBase * coverage * ctrLiftMin * months),
    high: Math.round(sessionsBase * coverage * ctrLiftMax * months),
  };

  const conversion = params.conversion ?? inputValue(revenueInputs, "conversion") ?? 0;
  const ticket = params.avgTicket ?? inputValue(revenueInputs, "ticket") ?? 0;
  const revenue: RevenueRange = {
    low: Math.round(traffic.low * conversion * ticket),
    high: Math.round(traffic.high * conversion * ticket),
    currency,
  };

  const affected = inputValue(costInputs, "affected");
  const hoursPerTask = inputValue(costInputs, "hoursPerTask") ?? 0;
  const laborCost = params.laborCost ?? inputValue(costInputs, "laborCost") ?? 0;
  const count = affected === undefined ? 1 : Math.max(0, affected);
  const costAvoided: RevenueRange = recommendation.automatable
    ? {
        low: Math.round(count * hoursPerTask * 0.8 * laborCost),
        high: Math.round(count * hoursPerTask * 1.2 * laborCost),
        currency,
      }
    : { low: 0, high: 0, currency };

  return {
    recommendationId: recommendation.id,
    title: recommendation.title,
    opportunityScore: business?.opportunity.score ?? 0,
    coverage,
    organicLiftLow: ctrLiftMin,
    organicLiftHigh: ctrLiftMax,
    traffic,
    revenue,
    costAvoided,
    currency,
  };
}

export function recomputeBusinessImpact(
  recommendations: Recommendation[],
  params: WhatIfParams,
): WhatIfResult {
  const computed = recommendations
    .filter((recommendation) => recommendation.businessImpact)
    .map((recommendation) => computeRecommendation(recommendation, params));

  const currency = computed[0]?.currency ?? "BRL";
  const sum = (pick: (item: WhatIfRecommendation) => TrafficRange | RevenueRange) =>
    computed.reduce(
      (acc, item) => {
        const value = pick(item);
        return { low: acc.low + value.low, high: acc.high + value.high };
      },
      { low: 0, high: 0 },
    );

  const monthlySessions =
    params.monthlySessions ??
    anchoredInputValue(recommendations, "traffic", "monthlySessions") ??
    equivalentSessions(recommendations);
  const conversion =
    params.conversion ??
    anchoredInputValue(recommendations, "revenue", "conversion") ??
    0;
  const avgTicket =
    params.avgTicket ??
    anchoredInputValue(recommendations, "revenue", "ticket") ??
    0;

  const portfolioDrivers = recommendations.reduce(
    (acc, recommendation) => {
      const inputs =
        recommendation.businessImpact?.traffic.explanation.inputs ?? [];
      const coverage = Math.max(0, inputValue(inputs, "coverage") ?? 0);
      acc.coverage += coverage;
      acc.weightedLiftLow += coverage * Math.max(0, inputValue(inputs, "ctrLiftMin") ?? 0);
      acc.weightedLiftHigh += coverage * Math.max(0, inputValue(inputs, "ctrLiftMax") ?? 0);
      return acc;
    },
    { coverage: 0, weightedLiftLow: 0, weightedLiftHigh: 0 },
  );
  const overlapIndex = Math.min(1, Math.max(0, params.overlapIndex ?? 0));
  const effectiveCoverage = Math.min(
    1,
    portfolioDrivers.coverage * (1 - overlapIndex),
  );
  const averageLiftLow =
    portfolioDrivers.coverage > 0
      ? portfolioDrivers.weightedLiftLow / portfolioDrivers.coverage
      : 0;
  const averageLiftHigh =
    portfolioDrivers.coverage > 0
      ? portfolioDrivers.weightedLiftHigh / portfolioDrivers.coverage
      : 0;
  const annualOrganicSessions = Math.round(Math.max(0, monthlySessions) * 12);
  const annualOrganicOrders = Math.round(
    annualOrganicSessions * Math.max(0, conversion),
  );
  const annualOrganicRevenue = Math.round(
    annualOrganicSessions * Math.max(0, conversion) * Math.max(0, avgTicket),
  );
  const portfolioTraffic: TrafficRange = {
    low: Math.round(annualOrganicSessions * effectiveCoverage * averageLiftLow),
    high: Math.round(annualOrganicSessions * effectiveCoverage * averageLiftHigh),
  };
  const portfolioRevenue: RevenueRange = {
    low: Math.round(portfolioTraffic.low * conversion * avgTicket),
    high: Math.round(portfolioTraffic.high * conversion * avgTicket),
    currency,
  };
  const portfolioOrders: TrafficRange = {
    low: Math.round(portfolioTraffic.low * conversion),
    high: Math.round(portfolioTraffic.high * conversion),
  };

  const headline =
    [...computed].sort((a, b) => {
      const byScore = b.opportunityScore - a.opportunityScore;
      if (byScore !== 0) {
        return byScore;
      }
      return b.revenue.low - a.revenue.low;
    })[0] ?? null;

  return {
    headline,
    scenario: {
      annualOrganicSessions,
      annualOrganicOrders,
      annualOrganicRevenue,
      effectiveCoverage,
      organicLiftLow: effectiveCoverage * averageLiftLow,
      organicLiftHigh: effectiveCoverage * averageLiftHigh,
      currency,
    },
    potentialMaximum: {
      traffic: portfolioTraffic,
      orders: portfolioOrders,
      revenue: portfolioRevenue,
      costAvoided: { ...sum((item) => item.costAvoided), currency },
      currency,
    },
    recommendations: computed,
  };
}

export function equivalentSessions(
  recommendations: Recommendation[],
): number {
  let estimatedTrafficLow = 0;
  let weight = 0;
  recommendations.forEach((recommendation) => {
    const trafficInputs =
      recommendation.businessImpact?.traffic.explanation.inputs ?? [];
    const anchored = inputValue(trafficInputs, "monthlySessions");
    const index = inputValue(trafficInputs, "index") ?? 0;
    const denominator = inputValue(trafficInputs, "denominator") ?? 0;
    const coverage = inputValue(trafficInputs, "coverage") ?? 1;
    const ctrLiftMin = inputValue(trafficInputs, "ctrLiftMin") ?? 0;
    const months = inputValue(trafficInputs, "months") ?? 12;
    const contributionWeight = coverage * ctrLiftMin * months;
    estimatedTrafficLow += (anchored ?? index * denominator) * contributionWeight;
    weight += contributionWeight;
  });
  if (weight <= 0) {
    return 0;
  }
  return Math.round(estimatedTrafficLow / weight);
}
