import test from "node:test";
import assert from "node:assert/strict";
import type { KnowledgeBase } from "../src/knowledge/knowledgeBuilder.js";
import type { SearchIndexes } from "../src/knowledge/searchIndex.js";
import type { Opportunity } from "../src/recommendation/types.js";
import { toScoredOpportunities } from "../src/recommendation/priorityCalculator.js";
import { OpportunityScorer } from "../src/recommendation/scoring/opportunityScorer.js";
import { ConfidenceEngine } from "../src/recommendation/scoring/confidenceEngine.js";
import { BusinessWeightResolver } from "../src/recommendation/scoring/businessWeightResolver.js";
import { ReachEstimator } from "../src/recommendation/scoring/reachEstimator.js";
import { TrafficEstimator } from "../src/recommendation/estimation/trafficEstimator.js";
import { RevenueEstimator } from "../src/recommendation/estimation/revenueEstimator.js";
import { CostEstimator } from "../src/recommendation/estimation/costEstimator.js";
import { Aggregator, computeOverlap, type AggregateItem } from "../src/recommendation/estimation/aggregator.js";
import { ExecutiveSummaryBuilder } from "../src/recommendation/report/executiveSummaryBuilder.js";
import { BusinessImpactEngine } from "../src/recommendation/businessImpactEngine.js";
import {
  resolveConfig,
  loadConfigFromEnv,
  buildBusinessConfig,
  DEFAULT_IMPACT_CONFIG,
  classifyImpactLevel,
  type DeepPartial,
  type ImpactConfig,
} from "../src/recommendation/config/impactConfig.js";
import {
  primaryEvidenceLevel,
  describeSources,
  evidenceExplanation,
} from "../src/recommendation/evidence.js";
import { healthGrade } from "../src/recommendation/health.js";
import type {
  BusinessImpact,
  MetricExplanation,
} from "../src/recommendation/types.js";

const emptyIndexes: SearchIndexes = {
  productsByCategory: {},
  productsByBrand: {},
  productsByAttribute: {},
  productsByUrl: {},
  categories: [],
  schemas: [],
  pages: [],
};

const baseConfig: ImpactConfig = resolveConfig({
  version: "1.0-test",
  assumptions: {
    ctrLiftMin: 0.05,
    ctrLiftMax: 0.15,
    organicConversionRate: 0.02,
    avgTicket: 500,
    organicOpportunityIndex: 100,
    monthsPerYear: 12,
    currency: "BRL",
  },
});

function makeKnowledge(
  totalProducts: number,
  catalogCount?: number,
  category: string = "Notebook",
): KnowledgeBase {
  const products = Array.from({ length: totalProducts }, (_, index) => ({
    id: `product:${index + 1}`,
    name: `Produto ${index + 1}`,
    normalizedName: `produto ${index + 1}`,
    url: `https://example.com/produto/${index + 1}`,
    price: "$100",
    description: "Descrição completa do produto.",
    brand: "Marca",
    category,
    attributes: ["Cor"],
    pageIds: [] as string[],
    schemaIds: [] as string[],
  }));
  const pages = Array.from({ length: totalProducts }, (_, index) => ({
    id: `page:${index + 1}`,
    title: `Produto ${index + 1}`,
    description: "Descrição",
    canonical: undefined as string | undefined,
    url: `https://example.com/produto/${index + 1}`,
    type: "product",
    productIds: [`product:${index + 1}`],
    categoryIds: [] as string[],
  }));
  return {
    site: {
      baseUrl: "https://example.com",
      host: "example.com",
      title: "Loja Teste",
    },
    products,
    categories: [],
    brands: [],
    attributes: [],
    pages,
    schemas: [],
    faqs: [],
    relationships: [],
    indexes: emptyIndexes,
    issues: [],
    catalogCount,
  };
}

function makeOpportunity(
  partial: Partial<Opportunity> & { id: string },
): Opportunity {
  return {
    title: partial.id,
    description: "Descrição da oportunidade.",
    category: "Schema",
    priority: "alta",
    impact: "muito_alto",
    confidence: 100,
    effort: "baixo",
    automatable: true,
    affectedProducts: 1,
    scope: "product",
    ...partial,
  };
}

function productIds(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `product:${index + 1}`);
}

function baseExplanation(metric: string): MetricExplanation {
  return {
    metric,
    summary: "explicação de teste",
    formula: "fórmula",
    inputs: [],
    rationale: [],
    assumptions: [],
    modelVersion: "1.0-test",
  };
}

function makeImpact(
  partial: DeepPartial<BusinessImpact>,
): BusinessImpact {
  return {
    opportunity: {
      score: 0,
      coverage: 0,
      severity: 1,
      businessWeight: 1,
      reach: 0,
      normalizedReach: 0,
      explanation: baseExplanation("opportunityScore"),
    },
    businessImpactLevel: "medium",
    traffic: {
      perMonth: { low: 0, high: 0 },
      perYear: { low: 0, high: 0 },
      explanation: baseExplanation("traffic"),
    },
    revenue: {
      low: 0,
      high: 0,
      currency: "BRL",
      explanation: baseExplanation("revenue"),
    },
    costAvoided: {
      low: 0,
      high: 0,
      currency: "BRL",
      explanation: baseExplanation("costAvoided"),
    },
    confidence: {
      label: "MEDIUM",
      score: 70,
      quality: { coverageQuality: 1, freshness: 1, completeness: 1 },
      explanation: baseExplanation("confidence"),
    },
    evidence: {
      sources: ["CRAWLER", "STATIC_ASSUMPTION"],
      missingSources: ["SEARCH_CONSOLE", "GA4", "MERCHANT_CENTER"],
      level: "MEDIUM",
      description: "observações do crawler + suposições do setor",
      explanation: baseExplanation("evidence"),
    },
    overlap: { index: 0, risk: "none" },
    ...partial,
  } as BusinessImpact;
}

test("coverage é a razão entre afetados e denominador por scope", () => {
  const knowledge = makeKnowledge(100);
  const scorer = new OpportunityScorer();

  const product = scorer.denominator(
    makeOpportunity({ id: "op:a", scope: "product", affectedProducts: 50 }),
    knowledge,
  );
  const page = scorer.denominator(
    makeOpportunity({ id: "op:b", scope: "page", affectedProducts: 2 }),
    knowledge,
  );
  const site = scorer.denominator(
    makeOpportunity({ id: "op:c", scope: "site", affectedProducts: 1 }),
    knowledge,
  );

  assert.equal(product, 100);
  assert.equal(page, 100);
  assert.equal(site, 100);

  const scored = scorer.score(
    {
      opportunity: makeOpportunity({
        id: "op:a",
        scope: "product",
        affectedProducts: 50,
        affectedProductIds: productIds(50),
      }),
      score: 75,
      priority: "critica",
    },
    knowledge,
    baseConfig,
    50,
    { coverageQuality: 1, freshness: 1, completeness: 1 },
    ["CRAWLER", "STATIC_ASSUMPTION"],
  );
  assert.equal(scored.coverage, 0.5);
});

test("business weights: default, id desconhecido e override", () => {
  const resolver = new BusinessWeightResolver();
  assert.equal(resolver.resolve(baseConfig, "op:schema-product"), 1);
  assert.equal(resolver.resolve(baseConfig, "op:produto-price"), 0.5);
  assert.equal(resolver.resolve(baseConfig, "op:desconhecido"), 0.3);

  const override = resolveConfig({
    weights: { business: { "op:x": 0.9 } },
  });
  assert.equal(resolver.resolve(override, "op:x"), 0.9);
  assert.equal(resolver.resolve(override, "op:desconhecido"), 0.3);
});

test("reach: média de peso de categoria dos produtos afetados", () => {
  const knowledge = makeKnowledge(2, undefined, "Mousepad");
  const estimator = new ReachEstimator();

  const comIds = estimator.estimate(
    baseConfig,
    knowledge,
    ["product:1", "product:2"],
    2,
  );
  assert.equal(comIds.reach, 2 * 0.3);
  assert.equal(comIds.averageCategoryWeight, 0.3);

  const semIds = estimator.estimate(baseConfig, knowledge, undefined, 2);
  assert.equal(semIds.reach, 2 * 0.6);
});

test("opportunity score combina os cinco fatores em 0-100", () => {
  const knowledge = makeKnowledge(100);
  const scorer = new OpportunityScorer();
  const scored = scorer.score(
    {
      opportunity: makeOpportunity({
        id: "op:schema-product",
        scope: "product",
        affectedProducts: 50,
        affectedProductIds: productIds(50),
      }),
      score: 75,
      priority: "critica",
    },
    knowledge,
    baseConfig,
    50,
    { coverageQuality: 1, freshness: 1, completeness: 1 },
    ["CRAWLER", "STATIC_ASSUMPTION"],
  );

  assert.equal(scored.coverage, 0.5);
  assert.equal(scored.severity, 1);
  assert.equal(scored.businessWeight, 1);
  assert.equal(scored.normalizedReach, 1);
  assert.equal(scored.opportunityScore, 87);
  assert.equal(scored.confidence.score, 81);
  assert.equal(scored.confidence.label, "MEDIUM");
});

test("confidence: fontes do cliente elevam, evidência fraca mantém confiança baixa", () => {
  const engine = new ConfidenceEngine();

  const client = engine.compute(
    {
      sources: ["SEARCH_CONSOLE"],
      ruleConfidence: 100,
      coverageQuality: 1,
      freshness: 1,
      completeness: 1,
    },
    baseConfig,
  );
  assert.equal(client.label, "HIGH");
  assert.equal(client.score, 95);

  const fraca = engine.compute(
    {
      sources: ["STATIC_ASSUMPTION"],
      ruleConfidence: 50,
      coverageQuality: 0.18,
      freshness: 1,
      completeness: 0.3,
    },
    baseConfig,
  );
  assert.equal(fraca.label, "LOW");

  const media = engine.compute(
    {
      sources: ["CRAWLER", "STATIC_ASSUMPTION"],
      ruleConfidence: 100,
      coverageQuality: 1,
      freshness: 1,
      completeness: 1,
    },
    baseConfig,
  );
  assert.equal(media.label, "MEDIUM");
});

test("confidence: explicação expõe componentes e racional ✓/✗", () => {
  const engine = new ConfidenceEngine();
  const media = engine.compute(
    {
      sources: ["CRAWLER", "STATIC_ASSUMPTION"],
      ruleConfidence: 100,
      coverageQuality: 1,
      freshness: 1,
      completeness: 1,
    },
    baseConfig,
  );

  assert.equal(media.explanation.metric, "confidence");
  assert.equal(media.explanation.inputs.length, 3);
  assert.ok(
    media.explanation.rationale.some(
      (point) => point.kind === "supporting" && point.source === "CRAWLER",
    ),
  );
  assert.ok(
    media.explanation.rationale.some(
      (point) =>
        point.kind === "missing" &&
        point.label.includes("Search Console não conectado"),
    ),
  );
  assert.ok(
    media.explanation.rationale.some((point) => point.kind === "warning"),
  );
});

test("evidência: nível primário, descrição e fontes ausentes", () => {
  assert.equal(primaryEvidenceLevel(["SEARCH_CONSOLE"]), "HIGH");
  assert.equal(primaryEvidenceLevel(["CRAWLER", "STATIC_ASSUMPTION"]), "MEDIUM");
  assert.equal(primaryEvidenceLevel(["STATIC_ASSUMPTION"]), "LOW");
  assert.equal(
    describeSources(["CRAWLER", "STATIC_ASSUMPTION"]),
    "observações do crawler + suposições do setor",
  );

  const evidence = evidenceExplanation(
    ["CRAWLER", "STATIC_ASSUMPTION"],
    baseConfig,
  );
  assert.deepEqual(evidence.missingSources, [
    "SEARCH_CONSOLE",
    "GA4",
    "MERCHANT_CENTER",
  ]);
  assert.equal(evidence.explanation.metric, "evidence");
  assert.ok(
    evidence.explanation.rationale.some(
      (point) => point.kind === "missing" && point.source === "GA4",
    ),
  );
});

test("traffic: sessões incrementais por ano com range de CTR", () => {
  const estimator = new TrafficEstimator();
  const result = estimator.estimate(baseConfig, 50, 100);

  assert.deepEqual(result.perMonth, { low: 250, high: 750 });
  assert.deepEqual(result.perYear, { low: 3000, high: 9000 });
  assert.equal(result.explanation.metric, "traffic");
  assert.ok(
    result.explanation.inputs.some((entry) => entry.key === "coverage"),
  );

  const zero = estimator.estimate(baseConfig, 0, 100);
  assert.deepEqual(zero.perYear, { low: 0, high: 0 });

  const semDenominador = estimator.estimate(baseConfig, 50, 0);
  assert.deepEqual(semDenominador.perYear, { low: 0, high: 0 });
});

test("revenue: transações convertem sessões em receita com moeda", () => {
  const estimator = new RevenueEstimator();
  const revenue = estimator.estimate(baseConfig, { low: 3000, high: 9000 });
  assert.equal(revenue.low, 30000);
  assert.equal(revenue.high, 90000);
  assert.equal(revenue.currency, "BRL");
  assert.equal(revenue.explanation.metric, "revenue");

  const zero = estimator.estimate(baseConfig, { low: 0, high: 0 });
  assert.equal(zero.low, 0);
  assert.equal(zero.high, 0);
  assert.equal(zero.currency, "BRL");
});

test("classification: opportunity score vira nível de impacto de negócio", () => {
  assert.equal(classifyImpactLevel(80, baseConfig), "critical");
  assert.equal(classifyImpactLevel(75, baseConfig), "critical");
  assert.equal(classifyImpactLevel(74, baseConfig), "high");
  assert.equal(classifyImpactLevel(60, baseConfig), "high");
  assert.equal(classifyImpactLevel(59, baseConfig), "medium");
  assert.equal(classifyImpactLevel(40, baseConfig), "medium");
  assert.equal(classifyImpactLevel(39, baseConfig), "low");
});

test("aggregation: headline por score, potential maximum e sobreposição medida", () => {
  const aggregator = new Aggregator();
  const items: AggregateItem[] = [
    {
      recommendationId: "op:schema-product",
      title: "Schema Product ausente",
      impact: makeImpact({
        opportunity: {
          score: 86,
          coverage: 0.5,
          severity: 1,
          businessWeight: 1,
          reach: 50,
          normalizedReach: 1,
        },
        businessImpactLevel: "critical",
        revenue: { low: 30000, high: 90000, currency: "BRL" },
        traffic: { perYear: { low: 3000, high: 9000 } },
        confidence: { label: "MEDIUM" },
      }),
      affectedProductIds: productIds(50),
    },
    {
      recommendationId: "op:produto-price",
      title: "Produtos sem preço",
      impact: makeImpact({
        opportunity: {
          score: 80,
          coverage: 0.5,
          severity: 1,
          businessWeight: 0.5,
          reach: 50,
          normalizedReach: 1,
        },
        businessImpactLevel: "critical",
        revenue: { low: 25000, high: 75000, currency: "BRL" },
        traffic: { perYear: { low: 2500, high: 7500 } },
      }),
      affectedProductIds: productIds(50),
    },
  ];

  const aggregate = aggregator.aggregate(items, baseConfig);

  assert.equal(aggregate.headline.recommendationId, "op:schema-product");
  assert.equal(aggregate.headline.opportunityScore, 86);
  assert.equal(aggregate.headline.businessImpactLevel, "critical");
  assert.equal(aggregate.headline.revenueLow, 30000);
  assert.equal(aggregate.headline.revenueHigh, 90000);
  assert.equal(aggregate.headline.confidence, "MEDIUM");

  assert.deepEqual(aggregate.potentialMaximum.revenue, {
    low: 55000,
    high: 165000,
    currency: "BRL",
  });
  assert.deepEqual(aggregate.potentialMaximum.traffic, { low: 5500, high: 16500 });

  assert.equal(aggregate.overlapIndex, 0.5);
  assert.equal(aggregate.overlapRisk, "medium");
  assert.ok(
    aggregate.explanation.assumptions.some((assumption) =>
      assumption.includes("aditivas"),
    ),
  );
  assert.equal(aggregate.modelVersion, "1.0-test");
  assert.equal(aggregate.evidence.level, "MEDIUM");

  assert.equal(
    aggregate.highestOpportunity.recommendationId,
    aggregate.headline.recommendationId,
  );
  assert.equal(aggregate.highestOpportunity.opportunityScore, 86);
});

test("aggregation: headline prioriza score, não receita", () => {
  const aggregator = new Aggregator();
  const items: AggregateItem[] = [
    {
      recommendationId: "op:alto-receita",
      title: "Receita alta, score baixo",
      impact: makeImpact({
        opportunity: { score: 40, coverage: 1, severity: 1, businessWeight: 1, reach: 100, normalizedReach: 1 },
        revenue: { low: 90000, high: 270000, currency: "BRL" },
        traffic: { perYear: { low: 9000, high: 27000 } },
      }),
      affectedProductIds: productIds(100),
    },
    {
      recommendationId: "op:alto-score",
      title: "Score alto, receita menor",
      impact: makeImpact({
        opportunity: { score: 90, coverage: 1, severity: 1, businessWeight: 1, reach: 100, normalizedReach: 1 },
        revenue: { low: 50000, high: 150000, currency: "BRL" },
        traffic: { perYear: { low: 5000, high: 15000 } },
      }),
      affectedProductIds: productIds(100),
    },
  ];

  const aggregate = aggregator.aggregate(items, baseConfig);
  assert.equal(aggregate.headline.recommendationId, "op:alto-score");
  assert.equal(aggregate.headline.revenueLow, 50000);
});

test("aggregation: sem recomendações produz zeros e risco none", () => {
  const aggregator = new Aggregator();
  const aggregate = aggregator.aggregate([], baseConfig);

  assert.equal(aggregate.headline.recommendationId, "");
  assert.equal(aggregate.headline.revenueLow, 0);
  assert.equal(aggregate.headline.revenueHigh, 0);
  assert.equal(aggregate.overlapRisk, "none");
  assert.equal(aggregate.overlapIndex, 0);
  assert.equal(aggregate.highestOpportunity.recommendationId, "");
});

test("overlap por recomendação: interseção com as demais", () => {
  assert.deepEqual(computeOverlap(productIds(50), productIds(30)), {
    index: 0.6,
    risk: "high",
  });
  assert.deepEqual(computeOverlap(productIds(10), undefined), {
    index: 0,
    risk: "none",
  });
  assert.deepEqual(computeOverlap(undefined, productIds(50)), {
    index: 0,
    risk: "none",
  });
  assert.equal(computeOverlap(productIds(10), productIds(5)).risk, "medium");
});

test("executive summary estruturado: decisão primeiro, avisos, premissas e texto", () => {
  const aggregator = new Aggregator();
  const aggregate = aggregator.aggregate(
    [
      {
        recommendationId: "op:schema-product",
        title: "Schema Product ausente",
        impact: makeImpact({
          opportunity: { score: 86, coverage: 0.5, severity: 1, businessWeight: 1, reach: 50, normalizedReach: 1 },
          businessImpactLevel: "critical",
          revenue: { low: 30000, high: 90000, currency: "BRL" },
          traffic: { perYear: { low: 3000, high: 9000 } },
          confidence: { label: "MEDIUM" },
        }),
        affectedProductIds: productIds(50),
      },
      {
        recommendationId: "op:produto-price",
        title: "Produtos sem preço",
        impact: makeImpact({
          opportunity: { score: 80, coverage: 0.5, severity: 1, businessWeight: 0.5, reach: 50, normalizedReach: 1 },
          revenue: { low: 25000, high: 75000, currency: "BRL" },
          traffic: { perYear: { low: 2500, high: 7500 } },
        }),
        affectedProductIds: productIds(50),
      },
    ],
    baseConfig,
  );

  const builder = new ExecutiveSummaryBuilder();
  const summary = builder.build(
    {
      siteName: "Loja Teste",
      healthScore: 62,
      totalOpportunities: 2,
      estimatedScoreGain: 26,
      automaticActions: 2,
      manualActions: 0,
      aggregate,
    },
    baseConfig,
  );

  assert.ok(summary.highlights.length > 0);
  assert.ok(summary.assumptions.length >= 5);
  assert.ok(
    summary.warnings.some((warning) => warning.includes("sobreposição")),
  );
  assert.ok(summary.headline.includes("R$"));
  assert.ok(summary.text.includes("Loja Teste"));
  assert.ok(summary.text.includes("projeção financeira"));
  assert.ok(summary.text.includes("média"));
  assert.equal(
    summary.highestOpportunity.recommendationId,
    aggregate.highestOpportunity.recommendationId,
  );
  assert.ok(summary.highlights.some((h) => h.includes("Opportunity Score")));
});

test("business impact engine: pipeline completo preenche impactos e agregado", () => {
  const knowledge = makeKnowledge(100);
  const opportunities = [
    makeOpportunity({
      id: "op:schema-product",
      title: "Schema Product ausente",
      affectedProducts: 50,
      affectedProductIds: productIds(50),
    }),
    makeOpportunity({
      id: "op:produto-price",
      title: "Produtos sem preço",
      category: "Produto",
      confidence: 90,
      affectedProducts: 30,
      affectedProductIds: productIds(30),
    }),
  ];
  const scored = toScoredOpportunities(opportunities);
  const engine = new BusinessImpactEngine(baseConfig);
  const model = engine.run(knowledge, scored, {
    siteName: knowledge.site.title ?? knowledge.site.host,
    healthScore: 62,
    estimatedScoreGain: 26,
  });

  const schema = model.impacts["op:schema-product"];
  assert.ok(schema);
  assert.equal(schema.opportunity.score, 87);
  assert.equal(schema.opportunity.coverage, 0.5);
  assert.equal(schema.businessImpactLevel, "critical");
  assert.equal(schema.revenue.low, 30000);
  assert.equal(schema.revenue.high, 90000);
  assert.equal(schema.revenue.currency, "BRL");
  assert.equal(schema.traffic.perYear.low, 3000);
  assert.equal(schema.traffic.perYear.high, 9000);
  assert.equal(schema.confidence.label, "MEDIUM");
  assert.ok(schema.evidence.sources.includes("CRAWLER"));
  assert.deepEqual(schema.evidence.missingSources, [
    "SEARCH_CONSOLE",
    "GA4",
    "MERCHANT_CENTER",
  ]);

  const price = model.impacts["op:produto-price"];
  assert.equal(price.opportunity.score, 63);
  assert.equal(price.businessImpactLevel, "high");
  assert.equal(price.revenue.low, 10800);
  assert.equal(price.revenue.high, 36000);
  assert.ok(
    price.traffic.explanation.inputs.some(
      (entry) => entry.key === "ctrLiftMin" && entry.value === 0.03,
    ),
  );
  assert.equal(price.overlap.risk, "high");

  assert.equal(model.aggregate.headline.recommendationId, "op:schema-product");
  assert.deepEqual(model.aggregate.potentialMaximum.revenue, {
    low: 40800,
    high: 126000,
    currency: "BRL",
  });
  assert.equal(model.aggregate.overlapRisk, "medium");

  assert.ok(model.summary.text.includes("Loja Teste"));
  assert.ok(model.summary.text.includes("projeção financeira"));
  assert.equal(model.config.version, "1.0-test");
});

test("engine: opportunity score explica composição com pesos e contribuições", () => {
  const knowledge = makeKnowledge(100);
  const opportunities = [
    makeOpportunity({
      id: "op:schema-product",
      affectedProducts: 50,
      affectedProductIds: productIds(50),
    }),
  ];
  const scored = toScoredOpportunities(opportunities);
  const engine = new BusinessImpactEngine(baseConfig);
  const model = engine.run(knowledge, scored, {
    siteName: "Loja Teste",
    healthScore: 80,
    estimatedScoreGain: 10,
  });

  const explanation = model.impacts["op:schema-product"].opportunity.explanation;
  assert.equal(explanation.metric, "opportunityScore");
  assert.equal(explanation.inputs.length, 5);

  const byKey = new Map(
    explanation.inputs.map((entry) => [entry.key, entry]),
  );
  assert.equal(byKey.get("coverage")?.weight, 0.2);
  assert.equal(byKey.get("reach")?.weight, 0.25);
  assert.equal(byKey.get("confidence")?.weight, 0.15);

  const contributions = explanation.inputs
    .filter((entry) => entry.contribution !== undefined)
    .reduce((sum, entry) => sum + (entry.contribution ?? 0), 0);
  assert.ok(Math.abs(contributions - model.impacts["op:schema-product"].opportunity.score / 100) < 0.05);
});

test("engine: zero values sem oportunidades e sem produtos", () => {
  const knowledge = makeKnowledge(0);
  const engine = new BusinessImpactEngine(baseConfig);

  const vazio = engine.run(knowledge, [], {
    siteName: "Loja Teste",
    healthScore: 100,
    estimatedScoreGain: 0,
  });
  assert.equal(vazio.aggregate.headline.revenueLow, 0);
  assert.equal(vazio.aggregate.overlapRisk, "none");

  const scored = toScoredOpportunities([
    makeOpportunity({
      id: "op:sem-produtos",
      affectedProducts: 5,
      affectedProductIds: productIds(5),
    }),
  ]);
  const semProdutos = engine.run(knowledge, scored, {
    siteName: "Loja Teste",
    healthScore: 80,
    estimatedScoreGain: 10,
  });
  const impact = semProdutos.impacts["op:sem-produtos"];
  assert.deepEqual(impact.traffic.perYear, { low: 0, high: 0 });
  assert.equal(impact.revenue.low, 0);
  assert.equal(impact.revenue.high, 0);
});

test("coverage quality usa catalogCount quando disponível", () => {
  const knowledge = makeKnowledge(100, 200);
  const opportunities = [
    makeOpportunity({
      id: "op:a",
      affectedProducts: 10,
      affectedProductIds: productIds(10),
    }),
  ];
  const scored = toScoredOpportunities(opportunities);
  const engine = new BusinessImpactEngine(baseConfig);
  const model = engine.run(knowledge, scored, {
    siteName: "Loja Teste",
    healthScore: 80,
    estimatedScoreGain: 10,
  });

  assert.equal(
    model.impacts["op:a"].confidence.quality.coverageQuality,
    0.5,
  );
});

test("configuração: overrides explícitos e variáveis de ambiente", () => {
  const ticketMaior = resolveConfig({
    assumptions: { avgTicket: 1000 },
  });
  assert.equal(ticketMaior.assumptions.avgTicket, 1000);

  const estimator = new RevenueEstimator();
  const revenue = estimator.estimate(ticketMaior, { low: 3000, high: 9000 });
  assert.equal(revenue.low, 60000);
  assert.equal(revenue.high, 180000);
  assert.equal(revenue.currency, "BRL");

  const fromEnv = loadConfigFromEnv({
    AVG_TICKET: "750",
    ORGANIC_CONVERSION_RATE: "0.03",
    CURRENCY: "usd",
    CTR_LIFT_MIN: "0.08",
    CTR_LIFT_MAX: "0.20",
  } as NodeJS.ProcessEnv);
  assert.equal(fromEnv.assumptions.avgTicket, 750);
  assert.equal(fromEnv.assumptions.organicConversionRate, 0.03);
  assert.equal(fromEnv.assumptions.currency, "USD");
  assert.equal(fromEnv.assumptions.ctrLiftMin, 0.08);
  assert.equal(fromEnv.assumptions.ctrLiftMax, 0.2);

  assert.equal(DEFAULT_IMPACT_CONFIG.version, "1.1");
  assert.equal(fromEnv.version, "1.1");
});

test("engine mantém pesos de business e severity configuráveis", () => {
  const config = resolveConfig({
    weights: {
      business: { "op:schema-product": 0.9 },
      severity: { muito_alto: 1, alto: 0.7, medio: 0.5, baixo: 0.2 },
      score: { coverage: 0.2, severity: 0.2, business: 0.2, reach: 0.25, confidence: 0.15 },
    },
  });
  const knowledge = makeKnowledge(100);
  const opportunities = [
    makeOpportunity({
      id: "op:schema-product",
      affectedProducts: 50,
      affectedProductIds: productIds(50),
    }),
  ];
  const scored = toScoredOpportunities(opportunities);
  const engine = new BusinessImpactEngine(config);
  const model = engine.run(knowledge, scored, {
    siteName: "Loja Teste",
    healthScore: 62,
    estimatedScoreGain: 26,
  });
  const impact = model.impacts["op:schema-product"];
  assert.equal(impact.opportunity.businessWeight, 0.9);
  assert.equal(impact.opportunity.severity, 1);
});

test("health: nota A-F contextualiza o score (zero vira Crítico, não falha)", () => {
  assert.equal(healthGrade(0, baseConfig).grade, "F");
  assert.equal(healthGrade(0, baseConfig).label, "Crítico");
  assert.equal(healthGrade(90, baseConfig).grade, "A");
  assert.equal(healthGrade(90, baseConfig).label, "Excelente");
  assert.equal(healthGrade(62, baseConfig).grade, "C");
  assert.equal(healthGrade(62, baseConfig).label, "Regular");
});

test("traffic: sessões orgânicas mensais do cliente ancoram a estimativa", () => {
  const config = resolveConfig({
    assumptions: { monthlyOrganicSessions: 10000 },
  });
  const estimator = new TrafficEstimator();
  const result = estimator.estimate(config, 50, 100);

  assert.deepEqual(result.perYear, { low: 3000, high: 9000 });
  assert.ok(result.explanation.summary.includes("ancorada"));
  assert.ok(
    result.explanation.inputs.some((entry) => entry.key === "monthlySessions"),
  );
  assert.ok(
    result.explanation.inputs.some(
      (entry) => entry.key === "monthlySessions" && entry.value === 10000,
    ),
  );

  const fallback = estimator.estimate(baseConfig, 50, 100);
  assert.deepEqual(fallback.perYear, { low: 3000, high: 9000 });
  assert.ok(
    fallback.explanation.assumptions.some((assumption) =>
      assumption.includes("Fallback"),
    ),
  );
});

test("traffic: aplica hipótese de ganho específica por recomendação", () => {
  const config = resolveConfig({
    assumptions: { monthlyOrganicSessions: 10000 },
  });
  const estimator = new TrafficEstimator();

  const schema = estimator.estimate(config, 50, 100, "op:schema-product");
  const canonical = estimator.estimate(config, 50, 100, "op:seo-canonical");
  const content = estimator.estimate(
    config,
    50,
    100,
    "op:conteudo-description",
  );

  assert.deepEqual(schema.perYear, { low: 3000, high: 9000 });
  assert.deepEqual(canonical.perYear, { low: 600, high: 3000 });
  assert.deepEqual(content.perYear, { low: 3000, high: 12000 });
  assert.ok(
    canonical.explanation.assumptions.some((assumption) =>
      assumption.includes("hipótese específica"),
    ),
  );
});

test("costAvoided: mão de obra anualizada só para ações automatizáveis", () => {
  const estimator = new CostEstimator();

  const auto = estimator.estimate(
    baseConfig,
    makeOpportunity({ id: "op:auto", affectedProducts: 100 }),
  );
  assert.equal(auto.low, 14400);
  assert.equal(auto.high, 21600);
  assert.equal(auto.currency, "BRL");
  assert.equal(auto.explanation.metric, "costAvoided");
  assert.equal(auto.explanation.inputs.length, 4);

  const manual = estimator.estimate(
    baseConfig,
    makeOpportunity({
      id: "op:manual",
      affectedProducts: 100,
      automatable: false,
    }),
  );
  assert.equal(manual.low, 0);
  assert.equal(manual.high, 0);

  const noneAffected = estimator.estimate(
    baseConfig,
    makeOpportunity({ id: "op:none", affectedProducts: 0 }),
  );
  assert.equal(noneAffected.low, 0);
  assert.equal(noneAffected.high, 0);

  const maisCaro = resolveConfig({ assumptions: { laborCostPerHour: 120 } });
  const caro = estimator.estimate(
    maisCaro,
    makeOpportunity({ id: "op:caro", affectedProducts: 100 }),
  );
  assert.equal(caro.low, 28800);
  assert.equal(caro.high, 43200);
});

test("buildBusinessConfig: converte dados da operação em assumptions", () => {
  const config = buildBusinessConfig({
    avgTicket: 1000,
    organicConversionRate: 0.03,
    monthlyOrganicSessions: 50000,
    laborCostPerHour: 80,
  });
  assert.equal(config.assumptions.avgTicket, 1000);
  assert.equal(config.assumptions.organicConversionRate, 0.03);
  assert.equal(config.assumptions.monthlyOrganicSessions, 50000);
  assert.equal(config.assumptions.laborCostPerHour, 80);

  const defaults = buildBusinessConfig({});
  assert.equal(defaults.assumptions.monthlyOrganicSessions, undefined);
  assert.equal(defaults.assumptions.hoursPerTask, 0.25);
  assert.equal(defaults.assumptions.avgTicket, 500);
});

test("engine: dados do cliente escalam tráfego/receita e preenchem custo evitado", () => {
  const config = buildBusinessConfig({
    monthlyOrganicSessions: 100000,
    avgTicket: 800,
    organicConversionRate: 0.03,
  });
  const knowledge = makeKnowledge(100);
  const scored = toScoredOpportunities([
    makeOpportunity({
      id: "op:auto",
      affectedProducts: 50,
      affectedProductIds: productIds(50),
    }),
  ]);
  const model = new BusinessImpactEngine(config).run(knowledge, scored, {
    siteName: "Loja Teste",
    healthScore: 62,
    estimatedScoreGain: 26,
  });
  const impact = model.impacts["op:auto"];

  assert.deepEqual(impact.traffic.perYear, { low: 30000, high: 90000 });
  assert.equal(impact.revenue.low, 720000);
  assert.equal(impact.revenue.high, 2160000);
  assert.ok(impact.costAvoided.high > 0);
  assert.equal(
    model.aggregate.potentialMaximum.costAvoided.low,
    impact.costAvoided.low,
  );
  assert.deepEqual(model.aggregate.potentialMaximum.costAvoided, {
    low: impact.costAvoided.low,
    high: impact.costAvoided.high,
    currency: "BRL",
  });
});

test("engine: custo evitado é zero para ações manuais e agregado soma corretamente", () => {
  const knowledge = makeKnowledge(100);
  const scored = toScoredOpportunities([
    makeOpportunity({
      id: "op:auto",
      affectedProducts: 50,
      affectedProductIds: productIds(50),
      automatable: true,
    }),
    makeOpportunity({
      id: "op:manual",
      affectedProducts: 30,
      affectedProductIds: productIds(30),
      automatable: false,
    }),
  ]);
  const model = new BusinessImpactEngine(baseConfig).run(knowledge, scored, {
    siteName: "Loja Teste",
    healthScore: 62,
    estimatedScoreGain: 26,
  });

  assert.ok(model.impacts["op:auto"].costAvoided.low > 0);
  assert.equal(model.impacts["op:manual"].costAvoided.low, 0);
  assert.equal(model.impacts["op:manual"].costAvoided.high, 0);
  assert.equal(
    model.aggregate.potentialMaximum.costAvoided.low,
    model.impacts["op:auto"].costAvoided.low,
  );
});
