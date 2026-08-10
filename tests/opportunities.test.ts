import test from "node:test";
import assert from "node:assert/strict";
import { OpportunityAnalyzer } from "../src/agents/opportunities/opportunityAnalyzer.js";
import { RecommendationEngine } from "../src/recommendation/recommendationEngine.js";
import type { KnowledgeBase } from "../src/knowledge/knowledgeBuilder.js";
import type { SearchIndexes } from "../src/knowledge/searchIndex.js";

const emptyIndexes: SearchIndexes = {
  productsByCategory: {},
  productsByBrand: {},
  productsByAttribute: {},
  productsByUrl: {},
  categories: [],
  schemas: [],
  pages: [],
};

const completeKnowledge: KnowledgeBase = {
  site: {
    baseUrl: "https://example.com",
    host: "example.com",
    title: "Loja Demo",
    description: "Loja demo",
  },
  products: [
    {
      id: "product:1",
      name: "SSD 1TB",
      normalizedName: "ssd 1tb",
      url: "https://example.com/produto/ssd-1tb",
      price: "$100",
      description: "SSD Kingston 1TB NVMe.",
      brand: "Kingston",
      category: "Storage",
      attributes: ["Capacidade"],
      pageIds: ["page:2"],
      schemaIds: ["schema:1"],
    },
    {
      id: "product:2",
      name: "SSD 500GB",
      normalizedName: "ssd 500gb",
      url: "https://example.com/produto/ssd-500gb",
      price: "$60",
      description: "SSD Kingston 500GB NVMe.",
      brand: "Kingston",
      category: "Storage",
      attributes: ["Capacidade"],
      pageIds: ["page:3"],
      schemaIds: ["schema:2"],
    },
  ],
  categories: [
    {
      id: "category:1",
      name: "Storage",
      normalizedName: "storage",
      url: "https://example.com/categoria/storage",
      productIds: ["product:1", "product:2"],
      pageIds: [],
    },
  ],
  brands: [
    {
      id: "brand:1",
      name: "Kingston",
      normalizedName: "kingston",
      productIds: ["product:1", "product:2"],
    },
  ],
  attributes: [
    {
      id: "attribute:1",
      name: "Capacidade",
      normalizedName: "capacidade",
      value: "1TB",
      normalizedValue: "1tb",
      productIds: ["product:1", "product:2"],
    },
  ],
  pages: [
    {
      id: "page:1",
      title: "Loja Demo",
      description: "Loja demo",
      canonical: "https://example.com/",
      url: "https://example.com/",
      type: "homepage",
      productIds: [],
      categoryIds: [],
    },
    {
      id: "page:2",
      title: "SSD 1TB",
      description: "SSD Kingston 1TB",
      canonical: "https://example.com/produto/ssd-1tb",
      url: "https://example.com/produto/ssd-1tb",
      type: "product",
      productIds: ["product:1"],
      categoryIds: [],
    },
    {
      id: "page:3",
      title: "SSD 500GB",
      description: "SSD Kingston 500GB",
      canonical: "https://example.com/produto/ssd-500gb",
      url: "https://example.com/produto/ssd-500gb",
      type: "product",
      productIds: ["product:2"],
      categoryIds: [],
    },
    {
      id: "page:4",
      title: "Sobre",
      description: "Sobre a loja",
      canonical: "https://example.com/sobre",
      url: "https://example.com/sobre",
      type: "institutional",
      productIds: [],
      categoryIds: [],
    },
  ],
  schemas: [
    {
      id: "schema:1",
      type: "Product",
      raw: {
        "@type": "Product",
        name: "SSD 1TB",
        offers: {},
        aggregateRating: {},
        brand: {},
      },
      productIds: ["product:1"],
    },
    {
      id: "schema:2",
      type: "Product",
      raw: {
        "@type": "Product",
        name: "SSD 500GB",
        offers: {},
        aggregateRating: {},
        brand: {},
      },
      productIds: ["product:2"],
    },
    {
      id: "schema:3",
      type: "Organization",
      raw: { "@type": "Organization" },
      productIds: [],
    },
  ],
  faqs: [{ id: "faq:1", question: "Qual a garantia?", answer: "12 meses" }],
  relationships: [],
  indexes: emptyIndexes,
  issues: [],
};

const degradedKnowledge: KnowledgeBase = {
  site: {
    baseUrl: "https://example.com",
    host: "example.com",
    title: "Loja Demo",
  },
  products: [
    {
      id: "product:1",
      name: "SSD 1TB",
      normalizedName: "ssd 1tb",
      url: "https://example.com/produto/ssd-1tb",
      price: "$100",
      description: "SSD Kingston 1TB NVMe.",
      brand: "Kingston",
      category: "Storage",
      attributes: ["Capacidade"],
      pageIds: ["page:2"],
      schemaIds: ["schema:1"],
    },
    {
      id: "product:2",
      name: "Mouse Gamer",
      normalizedName: "mouse gamer",
      url: "https://example.com/produto/mouse-gamer",
      price: undefined,
      description: undefined,
      brand: undefined,
      category: undefined,
      attributes: [],
      pageIds: ["page:3"],
      schemaIds: [],
    },
    {
      id: "product:3",
      name: "Teclado",
      normalizedName: "teclado",
      url: "https://example.com/produto/teclado",
      price: "$80",
      description: undefined,
      brand: "Logitech",
      category: "Perifericos",
      attributes: ["Cor"],
      pageIds: ["page:4"],
      schemaIds: ["schema:2"],
    },
  ],
  categories: [
    {
      id: "category:1",
      name: "Storage",
      normalizedName: "storage",
      url: "https://example.com/categoria/storage",
      productIds: ["product:1"],
      pageIds: [],
    },
    {
      id: "category:2",
      name: "Perifericos",
      normalizedName: "perifericos",
      url: "https://example.com/categoria/perifericos",
      productIds: ["product:3"],
      pageIds: [],
    },
  ],
  brands: [
    {
      id: "brand:1",
      name: "Kingston",
      normalizedName: "kingston",
      productIds: ["product:1"],
    },
    {
      id: "brand:2",
      name: "Logitech",
      normalizedName: "logitech",
      productIds: ["product:3"],
    },
  ],
  attributes: [
    {
      id: "attribute:1",
      name: "Capacidade",
      normalizedName: "capacidade",
      value: "1TB",
      normalizedValue: "1tb",
      productIds: ["product:1"],
    },
    {
      id: "attribute:2",
      name: "Cor",
      normalizedName: "cor",
      value: "Preto",
      normalizedValue: "preto",
      productIds: ["product:3"],
    },
  ],
  pages: [
    {
      id: "page:1",
      title: "Loja Demo",
      description: "Loja demo",
      canonical: undefined,
      url: "https://example.com/",
      type: "homepage",
      productIds: [],
      categoryIds: [],
    },
    {
      id: "page:2",
      title: "SSD 1TB",
      description: "SSD Kingston 1TB",
      canonical: "https://example.com/produto/ssd-1tb",
      url: "https://example.com/produto/ssd-1tb",
      type: "product",
      productIds: ["product:1"],
      categoryIds: [],
    },
    {
      id: "page:3",
      title: "Mouse Gamer",
      description: "Mouse Gamer RGB",
      canonical: "https://example.com/produto/mouse-gamer",
      url: "https://example.com/produto/mouse-gamer",
      type: "product",
      productIds: ["product:2"],
      categoryIds: [],
    },
    {
      id: "page:4",
      title: undefined,
      description: undefined,
      canonical: undefined,
      url: "https://example.com/produto/teclado",
      type: "product",
      productIds: ["product:3"],
      categoryIds: [],
    },
  ],
  schemas: [
    {
      id: "schema:1",
      type: "Product",
      raw: {
        "@type": "Product",
        name: "SSD 1TB",
        offers: {},
        aggregateRating: {},
        brand: {},
      },
      productIds: ["product:1"],
    },
    {
      id: "schema:2",
      type: "Product",
      raw: { "@type": "Product", name: "Teclado" },
      productIds: ["product:3"],
    },
  ],
  faqs: [],
  relationships: [],
  indexes: emptyIndexes,
  issues: [],
};

test("base saudável não gera oportunidades e mantém health score 100", () => {
  const analyzer = new OpportunityAnalyzer();
  const report = analyzer.analyze(completeKnowledge);

  assert.equal(report.opportunities.length, 0);
  assert.equal(report.healthScore, 100);
  assert.equal(report.site.host, "example.com");
});

test("detecta oportunidades por regra com abrangência correta", () => {
  const analyzer = new OpportunityAnalyzer();
  const report = analyzer.analyze(degradedKnowledge);

  const affectedBy = (id: string) =>
    report.opportunities.find((opportunity) => opportunity.id === id)
      ?.affectedProducts;

  assert.equal(report.opportunities.length, 13);
  assert.equal(affectedBy("op:seo-title"), 1);
  assert.equal(affectedBy("op:seo-description"), 1);
  assert.equal(affectedBy("op:seo-canonical"), 2);
  assert.equal(affectedBy("op:schema-product"), 1);
  assert.equal(affectedBy("op:schema-incomplete"), 1);
  const schemaEntity = report.opportunities.find(
    (o) => o.id === "op:schema-entity",
  );
  assert.deepEqual(schemaEntity?.affectedProductIds, [
    "product:1",
    "product:2",
    "product:3",
  ]);
  assert.equal(affectedBy("op:geo-attributes"), 1);
  assert.equal(affectedBy("op:conteudo-description"), 2);
  assert.equal(affectedBy("op:schema-entity"), 3);
  assert.equal(affectedBy("op:conteudo-faq"), 3);
  assert.equal(affectedBy("op:conteudo-institutional"), 3);
  assert.ok(report.opportunities.some((o) => o.id === "op:conteudo-faq"));
  assert.ok(
    report.opportunities.some((o) => o.id === "op:conteudo-institutional"),
  );
  assert.equal(affectedBy("op:produto-price"), 1);
  assert.equal(affectedBy("op:produto-brand"), 1);
  assert.equal(affectedBy("op:produto-category"), 1);
});

test("toda oportunidade detectada traz motivo e abrangência", () => {
  const analyzer = new OpportunityAnalyzer();
  const report = analyzer.analyze(degradedKnowledge);

  for (const opportunity of report.opportunities) {
    assert.ok(opportunity.reason, `oportunidade ${opportunity.id} sem reason`);
    assert.ok(
      opportunity.affectedProducts !== undefined,
      `oportunidade ${opportunity.id} sem affectedProducts`,
    );
    assert.ok(
      opportunity.affectedProducts! > 0,
      `oportunidade ${opportunity.id} com abrangência zero`,
    );
  }
});

test("health score degradado é menor que o de uma base saudável", () => {
  const analyzer = new OpportunityAnalyzer();
  const healthy = analyzer.analyze(completeKnowledge).healthScore;
  const degraded = analyzer.analyze(degradedKnowledge).healthScore;

  assert.ok(healthy === 100);
  assert.ok(
    degraded !== undefined && degraded >= 0 && degraded < 100,
  );
});

test("engine propaga reason e affectedProducts no relatório", () => {
  const analyzer = new OpportunityAnalyzer();
  const opportunityReport = analyzer.analyze(degradedKnowledge);
  const engine = new RecommendationEngine();
  const report = engine.run(degradedKnowledge, opportunityReport);

  assert.equal(report.healthScore, opportunityReport.healthScore);
  assert.equal(report.totalOpportunities, opportunityReport.opportunities.length);

  for (const recommendation of report.recommendations) {
    assert.ok(recommendation.reason, "recomendação sem reason");
    assert.ok(
      recommendation.affectedProducts !== undefined,
      "recomendação sem affectedProducts",
    );
  }

  const schemaProduct = report.recommendations.find(
    (recommendation) => recommendation.opportunityId === "op:schema-product",
  );
  assert.ok(schemaProduct);
  assert.equal(schemaProduct.affectedProducts, 1);
  assert.ok(schemaProduct.expectedImpact.includes("1 produto"));
});
