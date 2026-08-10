import test from "node:test";
import assert from "node:assert/strict";
import { generateBeforeAfterScenarios } from "../web/src/lib/before-after.js";
import type { RecommendationReport } from "../web/src/lib/report.js";

function buildReport(): RecommendationReport {
  return {
    site: {
      baseUrl: "https://loja-teste.com.br",
      host: "loja-teste.com.br",
      title: "Loja Teste",
    },
    samples: [
      {
        id: "p:notebook",
        name: "Notebook Gamer MarcaX",
        price: "R$ 5.999,00",
        brand: "MarcaX",
        url: "https://loja-teste.com.br/p/notebook-gamer",
        categoryId: "category:1",
        categoryName: "Notebooks",
        attributes: { "Memória RAM": "16GB" },
        schema: {
          "@context": "https://schema.org",
          "@type": "Product",
          name: "Notebook Gamer MarcaX",
          price: "5999",
        },
      },
    ],
    geo: {
      overallScore: 60,
      successRate: 0.5,
      llmEnabled: true,
      categoryScores: [],
      personaScores: [],
      questionsTested: 1,
      recommendations: [],
      evaluations: [
        {
          questionId: "category:1:price:1",
          questionText:
            "Qual notebooks oferece o melhor custo-benefício por até R$ 6.000?",
          persona: "price",
          status: "PARTIAL",
          confidence: 50,
          explanation:
            "Encontrei um candidato, mas faltam dados estruturados sobre processador e GPU.",
          missingAttributes: ["processador", "GPU"],
          categoryId: "category:1",
          categoryName: "Notebooks",
        },
      ],
    },
    recommendations: [
      {
        id: "rec:op:geo-attributes",
        opportunityId: "op:geo-attributes",
        title: "Atributos GEO ausentes no catálogo",
        description: "",
        category: "GEO",
        priority: "critica",
        impact: "muito_alto",
        confidence: 95,
        effort: "medio",
        automatable: false,
        score: 90,
        expectedImpact: "Impacto esperado Alto.",
        action: {
          title: "Melhorar prontidão para busca generativa",
          description: "",
          steps: ["Validar atributos", "Publicar FAQ"],
        },
        affectedProducts: 96,
        affectedItems: ["Notebook Gamer MarcaX"],
        businessImpact: {
          opportunity: {
            score: 90,
            coverage: 1,
            severity: 1,
            businessWeight: 1,
            reach: 1,
            normalizedReach: 1,
            explanation: undefined as never,
          },
          businessImpactLevel: "high",
          traffic: {
            perMonth: { low: 100, high: 200 },
            perYear: { low: 1200, high: 2400 },
            explanation: undefined as never,
          },
          revenue: {
            low: 5000,
            high: 12000,
            currency: "BRL",
            explanation: undefined as never,
          },
          confidence: {
            label: "MEDIUM",
            score: 50,
            quality: { coverageQuality: 1, freshness: 1, completeness: 1 },
            explanation: undefined as never,
          },
          evidence: {
            sources: ["CRAWLER"],
            missingSources: [],
            level: "HIGH",
            description: "",
            explanation: undefined as never,
          },
          overlap: { index: 0, risk: "low" },
        },
      },
      {
        id: "rec:op:schema-incomplete",
        opportunityId: "op:schema-incomplete",
        title: "Schema Product incompleto",
        description: "",
        category: "Schema",
        priority: "critica",
        impact: "muito_alto",
        confidence: 92,
        effort: "baixo",
        automatable: true,
        score: 88,
        expectedImpact: "Impacto esperado Muito Alto.",
        action: {
          title: "Completar schema de produto",
          description: "",
          steps: ["Adicionar brand", "Adicionar offers", "Adicionar reviews"],
        },
        affectedProducts: 84,
        affectedItems: ["Notebook Gamer MarcaX"],
      },
    ],
  } as unknown as RecommendationReport;
}

test("generateBeforeAfterScenarios usa dados reais do report", () => {
  const scenarios = generateBeforeAfterScenarios(buildReport());

  assert.equal(scenarios.length, 2);
  assert.deepEqual(
    scenarios.map((scenario) => scenario.category).sort(),
    ["GEO", "Schema"],
  );
});

test("cenário GEO usa pergunta e explicação reais da simulação", () => {
  const scenario = generateBeforeAfterScenarios(buildReport()).find(
    (item) => item.category === "GEO",
  );
  assert.ok(scenario);
  assert.match(scenario.before, /custo-benefício por até R\$ 6\.000/);
  assert.match(scenario.before, /faltam dados estruturados sobre processador/);
  assert.match(scenario.after, /Notebook Gamer MarcaX/);
  assert.match(scenario.after, /processador/);
  assert.equal(scenario.realExample, "Notebook Gamer MarcaX");
  assert.deepEqual(scenario.actionSteps, ["Validar atributos", "Publicar FAQ"]);
});

test("cenário Schema mostra JSON-LD real no antes e atributos no depois", () => {
  const scenario = generateBeforeAfterScenarios(buildReport()).find(
    (item) => item.category === "Schema",
  );
  assert.ok(scenario);
  assert.match(scenario.before, /"Notebook Gamer MarcaX"/);
  assert.match(scenario.after, /"MarcaX"/);
  assert.match(scenario.after, /"processador"/);
  assert.deepEqual(scenario.actionSteps, [
    "Adicionar brand",
    "Adicionar offers",
    "Adicionar reviews",
  ]);
});

test("expectedResult usa a receita estimada quando disponível", () => {
  const scenario = generateBeforeAfterScenarios(buildReport()).find(
    (item) => item.category === "GEO",
  );
  assert.ok(scenario);
  assert.match(scenario.expectedResult, /R\$/);
  assert.match(scenario.expectedResult, /96 produto\(s\) afetado\(s\)/);
});
