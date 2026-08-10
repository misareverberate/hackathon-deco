import { describe, expect, it } from "vitest";
import {
  anchoredInputValue,
  equivalentSessions,
  recomputeBusinessImpact,
} from "@/lib/what-if";
import type {
  BusinessImpact,
  BusinessImpactLevel,
  CostEstimate,
  ExplanationInput,
  MetricExplanation,
  OpportunityScoreResult,
  Recommendation,
  RevenueEstimate,
  TrafficEstimate,
} from "@/lib/report";

function explanation(
  metric: string,
  inputs: ExplanationInput[],
): MetricExplanation {
  return {
    metric,
    summary: "s",
    formula: "f",
    inputs,
    rationale: [],
    assumptions: [],
    modelVersion: "1.1",
  };
}

function input(key: string, label: string, value: number): ExplanationInput {
  return { key, label, display: String(value), value };
}

function makeOpportunity(score: number): OpportunityScoreResult {
  return {
    score,
    coverage: 0.5,
    severity: 0.5,
    businessWeight: 0.5,
    reach: 10,
    normalizedReach: 0.5,
    explanation: explanation("opportunityScore", []),
  };
}

function makeImpact(opts: {
  score: number;
  trafficInputs: ExplanationInput[];
  revenueInputs: ExplanationInput[];
  costInputs: ExplanationInput[];
  currency?: string;
}): BusinessImpact {
  const currency = opts.currency ?? "BRL";
  const traffic: TrafficEstimate = {
    perMonth: { low: 0, high: 0 },
    perYear: { low: 0, high: 0 },
    explanation: explanation("traffic", opts.trafficInputs),
  };
  const revenue: RevenueEstimate = {
    low: 0,
    high: 0,
    currency,
    explanation: explanation("revenue", opts.revenueInputs),
  };
  const costAvoided: CostEstimate = {
    low: 0,
    high: 0,
    currency,
    explanation: explanation("costAvoided", opts.costInputs),
  };
  return {
    opportunity: makeOpportunity(opts.score),
    businessImpactLevel: "high" as BusinessImpactLevel,
    traffic,
    revenue,
    costAvoided,
    confidence: {
      label: "MEDIUM",
      score: 70,
      quality: { coverageQuality: 1, freshness: 1, completeness: 1 },
      explanation: explanation("confidence", []),
    },
    evidence: {
      sources: ["CRAWLER"],
      missingSources: [],
      level: "MEDIUM",
      description: "d",
      explanation: explanation("evidence", []),
    },
    overlap: { index: 0, risk: "none" },
  };
}

function makeRecommendation(
  id: string,
  title: string,
  impact: BusinessImpact,
): Recommendation {
  return {
    id,
    opportunityId: id,
    title,
    description: "d",
    category: "GEO",
    priority: "alta",
    impact: "alto",
    confidence: 80,
    effort: "baixo",
    automatable: true,
    score: impact.opportunity.score,
    expectedImpact: "Alto",
    action: { title: "t", description: "d", steps: [] },
    businessImpact: impact,
  };
}

const recommendations: Recommendation[] = [
  makeRecommendation("rec:a", "Atrativos GEO", makeImpact({
    score: 80,
    trafficInputs: [
      input("monthlySessions", "Sessões/mês", 45000),
      input("denominator", "Denominador", 100),
      input("coverage", "Cobertura", 0.5),
      input("ctrLiftMin", "CTR lift min", 0.05),
      input("ctrLiftMax", "CTR lift max", 0.15),
      input("months", "Meses/ano", 12),
    ],
    revenueInputs: [
      input("conversion", "Conversão", 0.02),
      input("ticket", "Ticket", 500),
    ],
    costInputs: [],
  })),
  makeRecommendation("rec:b", "Schema automatizável", makeImpact({
    score: 60,
    trafficInputs: [],
    revenueInputs: [],
    costInputs: [
      input("affected", "Produtos", 10),
      input("hoursPerTask", "Horas/tarefa", 0.25),
      input("frequency", "Frequência", 12),
      input("laborCost", "Mão de obra/h", 60),
    ],
  })),
];

describe("recomputeBusinessImpact", () => {
  it("reproduz a base com parâmetros padrão", () => {
    const result = recomputeBusinessImpact(recommendations, {});

    expect(result.potentialMaximum.revenue.low).toBe(135000);
    expect(result.potentialMaximum.revenue.high).toBe(405000);
    expect(result.potentialMaximum.traffic.low).toBe(13500);
    expect(result.potentialMaximum.traffic.high).toBe(40500);
    expect(result.potentialMaximum.costAvoided.low).toBe(120);
    expect(result.potentialMaximum.costAvoided.high).toBe(180);
    expect(result.scenario.annualOrganicSessions).toBe(540000);
    expect(result.scenario.annualOrganicOrders).toBe(10800);
    expect(result.scenario.annualOrganicRevenue).toBe(5400000);
    expect(result.potentialMaximum.orders).toEqual({ low: 270, high: 810 });
  });

  it("consolida recomendações sobrepostas sem multiplicar o mesmo tráfego", () => {
    const duplicate: Recommendation = {
      ...recommendations[0],
      id: "rec:duplicate",
      opportunityId: "rec:duplicate",
    };

    const raw = recomputeBusinessImpact([recommendations[0], duplicate], {});
    const consolidated = recomputeBusinessImpact(
      [recommendations[0], duplicate],
      { overlapIndex: 0.5 },
    );

    expect(raw.scenario.effectiveCoverage).toBe(1);
    expect(raw.potentialMaximum.traffic.low).toBe(27000);
    expect(consolidated.scenario.effectiveCoverage).toBe(0.5);
    expect(consolidated.potentialMaximum.traffic.low).toBe(13500);
    expect(consolidated.potentialMaximum.revenue.low).toBe(135000);
  });

  it("dobra a receita quando o ticket médio dobra", () => {
    const result = recomputeBusinessImpact(recommendations, { avgTicket: 1000 });

    expect(result.potentialMaximum.revenue.low).toBe(270000);
    expect(result.potentialMaximum.revenue.high).toBe(810000);
    expect(result.potentialMaximum.traffic.low).toBe(13500);
  });

  it("dobra a receita quando a conversão dobra", () => {
    const result = recomputeBusinessImpact(recommendations, { conversion: 0.04 });

    expect(result.potentialMaximum.revenue.low).toBe(270000);
    expect(result.potentialMaximum.revenue.high).toBe(810000);
  });

  it("zera a receita quando a conversão é zero", () => {
    const result = recomputeBusinessImpact(recommendations, { conversion: 0 });

    expect(result.potentialMaximum.revenue.low).toBe(0);
    expect(result.potentialMaximum.revenue.high).toBe(0);
    expect(result.potentialMaximum.traffic.low).toBe(13500);
    expect(result.potentialMaximum.costAvoided.low).toBe(120);
  });

  it("recalcula o tráfego quando as sessões orgânicas mudam", () => {
    const result = recomputeBusinessImpact(recommendations, {
      monthlySessions: 90000,
    });

    expect(result.potentialMaximum.traffic.low).toBe(27000);
    expect(result.potentialMaximum.traffic.high).toBe(81000);
    expect(result.potentialMaximum.revenue.low).toBe(270000);
  });

  it("recalcula o custo evitado quando a mão de obra muda", () => {
    const result = recomputeBusinessImpact(recommendations, { laborCost: 120 });

    expect(result.potentialMaximum.costAvoided.low).toBe(240);
    expect(result.potentialMaximum.costAvoided.high).toBe(360);
    expect(result.potentialMaximum.revenue.low).toBe(135000);
  });

  it("seleciona a headline pela maior nota de oportunidade", () => {
    const result = recomputeBusinessImpact(recommendations, {});

    expect(result.headline?.recommendationId).toBe("rec:a");
    expect(result.headline?.revenue.low).toBe(135000);
  });

  it("ancla o tráfego nas sessões informadas mesmo com fallback", () => {
    const fallback: Recommendation[] = [
      makeRecommendation("rec:c", "Sem sessão", makeImpact({
        score: 50,
        trafficInputs: [
          input("index", "Índice", 100),
          input("denominator", "Denominador", 100),
          input("coverage", "Cobertura", 0.5),
          input("ctrLiftMin", "CTR lift min", 0.05),
          input("ctrLiftMax", "CTR lift max", 0.15),
          input("months", "Meses/ano", 12),
        ],
        revenueInputs: [
          input("conversion", "Conversão", 0.02),
          input("ticket", "Ticket", 500),
        ],
        costInputs: [],
      })),
    ];

    const baseline = recomputeBusinessImpact(fallback, {});
    expect(baseline.potentialMaximum.traffic.low).toBe(3000);

    const anchored = recomputeBusinessImpact(fallback, { monthlySessions: 90000 });
    expect(anchored.potentialMaximum.traffic.low).toBe(27000);
  });

  it("zera o custo evitado para ações manuais", () => {
    const manual = makeRecommendation("rec:manual", "Ação manual", makeImpact({
      score: 50,
      trafficInputs: [],
      revenueInputs: [],
      costInputs: [
        input("affected", "Produtos", 10),
        input("hoursPerTask", "Horas/tarefa", 0.25),
        input("frequency", "Frequência", 12),
        input("laborCost", "Mão de obra/h", 60),
      ],
    }));

    const result = recomputeBusinessImpact(
      [{ ...manual, automatable: false }],
      {},
    );

    expect(result.potentialMaximum.costAvoided.low).toBe(0);
    expect(result.potentialMaximum.costAvoided.high).toBe(0);
    expect(result.potentialMaximum.revenue.low).toBe(0);
  });

  it("não inventa custo evitado quando há zero itens afetados", () => {
    const noAffectedItems = makeRecommendation(
      "rec:zero",
      "Sem itens afetados",
      makeImpact({
        score: 50,
        trafficInputs: [],
        revenueInputs: [],
        costInputs: [
          input("affected", "Produtos", 0),
          input("hoursPerTask", "Horas/tarefa", 0.25),
          input("frequency", "Frequência", 12),
          input("laborCost", "Mão de obra/h", 60),
        ],
      }),
    );

    const result = recomputeBusinessImpact([noAffectedItems], {});

    expect(result.potentialMaximum.costAvoided.low).toBe(0);
    expect(result.potentialMaximum.costAvoided.high).toBe(0);
  });
});

describe("equivalentSessions", () => {
  it("reproduz o baseline quando há sessões ancoradas", () => {
    const baseline = recomputeBusinessImpact(recommendations, {});

    const sessions = equivalentSessions(recommendations);
    const reproduced = recomputeBusinessImpact(recommendations, {
      monthlySessions: sessions,
    });

    expect(sessions).toBe(45000);
    expect(reproduced.potentialMaximum.traffic.low).toBe(
      baseline.potentialMaximum.traffic.low,
    );
    expect(reproduced.potentialMaximum.traffic.high).toBe(
      baseline.potentialMaximum.traffic.high,
    );
  });

  it("recupera sessões a partir do potencial máximo sem âncora", () => {
    const fallback: Recommendation[] = [
      makeRecommendation("rec:c", "Sem sessão", makeImpact({
        score: 50,
        trafficInputs: [
          input("index", "Índice", 100),
          input("denominator", "Denominador", 100),
          input("coverage", "Cobertura", 0.5),
          input("ctrLiftMin", "CTR lift min", 0.05),
          input("ctrLiftMax", "CTR lift max", 0.15),
          input("months", "Meses/ano", 12),
        ],
        revenueInputs: [
          input("conversion", "Conversão", 0.02),
          input("ticket", "Ticket", 500),
        ],
        costInputs: [],
      })),
    ];

    const baseline = recomputeBusinessImpact(fallback, {});
    const sessions = equivalentSessions(fallback);
    const reproduced = recomputeBusinessImpact(fallback, {
      monthlySessions: sessions,
    });

    expect(sessions).toBe(10000);
    expect(reproduced.potentialMaximum.traffic.low).toBe(
      baseline.potentialMaximum.traffic.low,
    );
    expect(reproduced.potentialMaximum.traffic.high).toBe(
      baseline.potentialMaximum.traffic.high,
    );
  });
});

describe("anchoredInputValue", () => {
  it("extrai valores ancorados das explanations", () => {
    expect(anchoredInputValue(recommendations, "revenue", "ticket")).toBe(500);
    expect(
      anchoredInputValue(recommendations, "traffic", "monthlySessions"),
    ).toBe(45000);
    expect(anchoredInputValue(recommendations, "costAvoided", "affected")).toBe(
      10,
    );
  });

  it("retorna undefined quando a métrica não está ancorada", () => {
    expect(anchoredInputValue(recommendations, "traffic", "missing")).toBe(
      undefined,
    );
    expect(
      anchoredInputValue(recommendations, "costAvoided", "monthlySessions"),
    ).toBe(undefined);
    expect(
      anchoredInputValue(recommendations, "revenue", "monthlySessions"),
    ).toBe(undefined);
  });
});
