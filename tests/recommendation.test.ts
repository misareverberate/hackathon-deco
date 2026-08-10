import test from "node:test";
import assert from "node:assert/strict";
import { ImpactCalculator } from "../src/recommendation/impactCalculator.js";
import { RecommendationEngine } from "../src/recommendation/recommendationEngine.js";
import {
  derivePriority,
  toScoredOpportunities,
} from "../src/recommendation/priorityCalculator.js";
import { buildBusinessConfig } from "../src/recommendation/config/impactConfig.js";
import type { KnowledgeBase } from "../src/knowledge/knowledgeBuilder.js";
import type { Opportunity, OpportunityReport } from "../src/recommendation/types.js";

const sampleKnowledge: KnowledgeBase = {
  site: {
    baseUrl: "https://example.com",
    host: "example.com",
    title: "Example Store",
  },
  products: [
    {
      id: "product:1",
      name: "SSD 1TB",
      normalizedName: "ssd 1tb",
      url: "https://example.com/produto/1",
      attributes: ["Capacidade"],
      pageIds: ["page:1"],
      schemaIds: ["schema:1"],
    },
  ],
  categories: [],
  brands: [],
  attributes: [],
  pages: [],
  schemas: [],
  faqs: [],
  relationships: [],
  indexes: {
    productsByCategory: {},
    productsByBrand: {},
    productsByAttribute: {},
    productsByUrl: {},
    categories: [],
    schemas: [],
    pages: [],
  },
  issues: [],
};

const opportunities: Opportunity[] = [
  {
    id: "op:seo",
    title: "Title e meta description ausentes",
    description: "Páginas sem title e meta description.",
    category: "SEO",
    priority: "media",
    impact: "alto",
    confidence: 100,
    effort: "muito_baixo",
    automatable: true,
    affectedProducts: 100,
  },
  {
    id: "op:schema",
    title: "Schema Product incompleto",
    description: "Faltam propriedades brand, offers e aggregateRating.",
    category: "Schema",
    priority: "alta",
    impact: "muito_alto",
    confidence: 90,
    effort: "baixo",
    automatable: true,
    affectedProducts: 60,
  },
  {
    id: "op:produto",
    title: "Produto sem atributos técnicos",
    description: "Faltam peso, dimensões, material e capacidade.",
    category: "Produto",
    priority: "alta",
    impact: "alto",
    confidence: 80,
    effort: "medio",
    automatable: false,
    affectedProducts: 80,
  },
  {
    id: "op:faq",
    title: "Produtos sem FAQ",
    description: "Não há FAQ estruturado para as dúvidas frequentes.",
    category: "Conteudo",
    priority: "media",
    impact: "muito_alto",
    confidence: 70,
    effort: "baixo",
    automatable: true,
    affectedProducts: 40,
  },
  {
    id: "op:geo",
    title: "Atributos GEO ausentes",
    description: "Busca generativa não consegue responder perguntas.",
    category: "GEO",
    priority: "critica",
    impact: "muito_alto",
    confidence: 95,
    effort: "medio",
    automatable: false,
    affectedProducts: 30,
  },
  {
    id: "op:schema-review",
    title: "Review ausente no schema",
    description: "Schema sem review e aggregateRating.",
    category: "Schema",
    priority: "baixa",
    impact: "baixo",
    confidence: 60,
    effort: "muito_baixo",
    automatable: true,
    affectedProducts: 20,
  },
  {
    id: "op:descricoes",
    title: "Descrições genéricas",
    description: "Descrições curtas e genéricas nos produtos.",
    category: "Produto",
    priority: "baixa",
    impact: "medio",
    confidence: 50,
    effort: "alto",
    automatable: false,
    affectedProducts: 10,
  },
];

const opportunityReport: OpportunityReport = {
  site: {
    baseUrl: "https://example.com",
    host: "example.com",
    title: "Loja Teste",
  },
  opportunities,
};

test("derivePriority deriva a prioridade dos thresholds do score", () => {
  assert.equal(derivePriority(80), "critica");
  assert.equal(derivePriority(75), "critica");
  assert.equal(derivePriority(74), "alta");
  assert.equal(derivePriority(60), "alta");
  assert.equal(derivePriority(59), "media");
  assert.equal(derivePriority(40), "media");
  assert.equal(derivePriority(39), "baixa");
});

test("ImpactCalculator deriva health score e estimativa do score de 5 fatores", () => {
  const calculator = new ImpactCalculator();
  const scored = calculator.scoreOpportunities(
    sampleKnowledge,
    toScoredOpportunities(opportunities),
  );

  const healthScore = calculator.calculateHealthScore(undefined, scored);
  assert.equal(healthScore, 36);

  const provided = calculator.calculateHealthScore(62, scored);
  assert.equal(provided, 62);

  const estimate = calculator.calculateEstimate(scored);
  assert.equal(estimate.automaticActions, 4);
  assert.equal(estimate.manualActions, 3);
  assert.equal(estimate.estimatedScoreGain, 64);
  assert.equal(estimate.topCategory, "Schema");
});

test("RoadmapBuilder agrupa em fases", () => {
  const engine = new RecommendationEngine();
  const report = engine.run(sampleKnowledge, opportunityReport);

  const phase1 = report.roadmap.find((phase) => phase.phase === 1);
  const phase2 = report.roadmap.find((phase) => phase.phase === 2);
  const phase3 = report.roadmap.find((phase) => phase.phase === 3);

  assert.ok(phase1);
  assert.ok(phase2);
  assert.ok(phase3);

  assert.deepEqual(
    phase1.recommendations.map((r) => r.opportunityId),
    ["op:seo", "op:schema", "op:faq"],
  );
  assert.deepEqual(
    phase2.recommendations.map((r) => r.opportunityId),
    ["op:produto", "op:geo", "op:schema-review"],
  );
  assert.deepEqual(
    phase3.recommendations.map((r) => r.opportunityId),
    ["op:descricoes"],
  );
});

test("ActionGenerator produz ações concretas por categoria", () => {
  const engine = new RecommendationEngine();
  const report = engine.run(sampleKnowledge, opportunityReport);

  const schema = report.recommendations.find(
    (r) => r.opportunityId === "op:schema",
  );
  const produto = report.recommendations.find(
    (r) => r.opportunityId === "op:produto",
  );
  const faq = report.recommendations.find((r) => r.opportunityId === "op:faq");

  assert.ok(schema);
  assert.ok(
    schema.action.steps.join(" ").toLowerCase().includes("aggregaterating"),
  );
  assert.ok(produto);
  assert.ok(produto.action.steps.join(" ").toLowerCase().includes("peso"));
  assert.ok(faq);
  assert.ok(faq.action.title.toLowerCase().includes("faq"));
});

test("RecommendationEngine monta o relatório completo", () => {
  const engine = new RecommendationEngine();
  const report = engine.run(sampleKnowledge, opportunityReport);

  assert.equal(report.totalOpportunities, 7);
  assert.equal(report.healthScore, 36);
  assert.equal(report.health.score, 36);
  assert.equal(report.health.grade, "E");
  assert.equal(report.health.label, "Muito Ruim");
  assert.equal(report.health.explanation.metric, "health");
  assert.equal(report.topRecommendations.length, 7);
  assert.equal(report.automaticActions.length, 4);
  assert.equal(report.manualActions.length, 3);
  assert.equal(report.roadmap.length, 3);
  assert.ok(report.executiveSummary.includes("Loja Teste"));
  assert.equal(report.impactEstimate.topCategory, "Schema");
  assert.equal(report.impactEstimate.estimatedScoreGain, 64);
  assert.ok(
    report.recommendations.every(
      (recommendation) =>
        recommendation.score ===
        recommendation.businessImpact?.opportunity.score,
    ),
  );

  const totalPerPhase = report.roadmap.reduce(
    (sum, phase) => sum + phase.recommendations.length,
    0,
  );
  assert.equal(totalPerPhase, 7);
  assert.ok(
    report.recommendations.every(
      (recommendation) => recommendation.score >= 0 && recommendation.score <= 100,
    ),
  );
});

test("RecommendationEngine propaga config de negócio para as estimativas", () => {
  const engine = new RecommendationEngine();
  const config = buildBusinessConfig({
    monthlyOrganicSessions: 100000,
    avgTicket: 800,
    organicConversionRate: 0.03,
  });
  const report = engine.run(sampleKnowledge, opportunityReport, config);

  const seo = report.recommendations.find((r) => r.opportunityId === "op:seo");
  assert.ok(seo);
  assert.ok(seo.businessImpact);
  assert.equal(seo.businessImpact.revenue.currency, "BRL");
  assert.ok(seo.businessImpact.revenue.low > 0);
  assert.ok(seo.businessImpact.costAvoided.high > 0);
  assert.ok(
    seo.businessImpact.traffic.explanation.inputs.some(
      (entry) => entry.key === "monthlySessions",
    ),
  );
  assert.ok(
    report.impactEstimate.aggregate?.potentialMaximum.costAvoided.high,
  );
});
