import test from "node:test";
import assert from "node:assert/strict";
import {
  CommerceAssistant,
  type AssistantSession,
} from "../src/agents/commerce/commerceAssistant.js";
import type { KnowledgeBase } from "../src/knowledge/knowledgeBuilder.js";
import type { LlmGateway } from "../src/llm/groq.js";
import type { RecommendationReport } from "../src/recommendation/types.js";
import type { BuyerJourney } from "../src/agents/geo/types.js";
import { GeoAgent } from "../src/agents/geo/geoAgent.js";

const offlineLlm: LlmGateway = {
  isConfigured: () => false,
  chatJson: async () => null,
};

function sessionFixture(): AssistantSession {
  const products: KnowledgeBase["products"] = [
    {
      id: "product:1",
      name: "Notebook Alpha",
      normalizedName: "notebook alpha",
      url: "https://example.com/alpha",
      price: "5000",
      brand: "Marca A",
      category: "Notebooks",
      categoryId: "category:1",
      availability: "InStock",
      attributes: ["GPU: RTX 4060", "RAM: 16 GB"],
      pageIds: ["page:1"],
      schemaIds: ["schema:1"],
    },
    {
      id: "product:2",
      name: "Notebook Beta",
      normalizedName: "notebook beta",
      url: "https://example.com/beta",
      price: "4500",
      brand: "Marca B",
      category: "Notebooks",
      categoryId: "category:1",
      availability: "InStock",
      attributes: ["GPU: RTX 4050", "RAM: 16 GB"],
      pageIds: ["page:2"],
      schemaIds: ["schema:2"],
    },
  ];
  const knowledge: KnowledgeBase = {
    site: { baseUrl: "https://example.com", host: "example.com" },
    products,
    categories: [{
      id: "category:1",
      name: "Notebooks",
      normalizedName: "notebooks",
      url: "https://example.com/notebooks",
      productIds: products.map((product) => product.id),
      pageIds: [],
    }],
    brands: [],
    attributes: [
      { id: "attribute:1", name: "GPU", normalizedName: "gpu", value: "RTX 4060", normalizedValue: "rtx 4060", productIds: ["product:1"] },
      { id: "attribute:2", name: "GPU", normalizedName: "gpu", value: "RTX 4050", normalizedValue: "rtx 4050", productIds: ["product:2"] },
      { id: "attribute:3", name: "RAM", normalizedName: "ram", value: "16 GB", normalizedValue: "16 gb", productIds: ["product:1", "product:2"] },
    ],
    pages: [],
    schemas: [],
    faqs: [],
    relationships: [],
    indexes: {
      productsByCategory: {}, productsByBrand: {}, productsByAttribute: {},
      productsByUrl: {}, categories: [], schemas: [], pages: [],
    },
    issues: [],
  };
  return {
    id: "analysis:1",
    knowledge,
    report: {
      totalOpportunities: 1,
      health: { score: 100, grade: "A" },
      executiveSummary: "A loja precisa completar os dados estruturados dos produtos.",
      impactEstimate: {},
      recommendations: [{
        id: "rec:schema",
        opportunityId: "schema-product",
        title: "Completar schema Product",
        description: "Adicionar os campos comerciais ausentes ao JSON-LD.",
        category: "Schema",
        priority: "critica",
        impact: "muito_alto",
        confidence: 90,
        effort: "baixo",
        automatable: true,
        score: 92,
        expectedImpact: "Mais produtos elegíveis para busca generativa.",
        affectedItems: ["https://example.com/alpha"],
        action: {
          title: "Publicar schema Product completo",
          description: "Completar JSON-LD nas páginas de produto.",
          steps: ["Adicionar brand", "Adicionar offers", "Validar no Rich Results Test"],
        },
      }],
    } as unknown as RecommendationReport,
    crawl: { pages: 3, products: 2, crawlDurationMs: 1_000, errors: [] },
    createdAt: Date.now(),
  };
}

test("CommerceAssistant mantém contexto para comparar resultados anteriores", async () => {
  const session = sessionFixture();
  const assistant = new CommerceAssistant(offlineLlm);
  const search = await assistant.answer(session, "Quais notebooks existem?");
  const comparison = await assistant.answer(session, "Compare os dois");

  assert.equal(search.tool.tool, "search_products");
  assert.equal(comparison.tool.tool, "compare_products");
  assert.equal(comparison.tool.evidence.length, 2);
  assert.equal(session.conversation?.length, 2);
});

test("CommerceAssistant executa uma jornada nova em simulate_buyer", async () => {
  const response = await new CommerceAssistant(offlineLlm).answer(
    sessionFixture(),
    "Simule um comprador técnico buscando notebook",
  );
  const journey = response.tool.data as BuyerJourney;

  assert.equal(response.tool.tool, "simulate_buyer");
  assert.ok(journey.steps.length >= 2);
  assert.equal(journey.mission.persona, "spec");
  assert.match(response.answer, /jornada nova/i);
});

test("CommerceAssistant permite que o LLM selecione uma ferramenta válida e redija a resposta final", async () => {
  let calls = 0;
  const llm: LlmGateway = {
    isConfigured: () => true,
    chatJson: async () => {
      calls += 1;
      if (calls === 1) return { tool: "analyze_performance", query: "crawl" };
      return { answer: "A análise processou a navegação sem erros críticos." };
    },
  };
  const response = await new CommerceAssistant(llm).answer(
    sessionFixture(),
    "Me dê seu diagnóstico",
  );

  assert.equal(response.tool.tool, "analyze_performance");
  assert.equal(response.answer, "A análise processou a navegação sem erros críticos.");
  assert.equal(calls, 2);
});

test("CommerceAssistant cai no template quando a síntese LLM falha", async () => {
  let calls = 0;
  const llm: LlmGateway = {
    isConfigured: () => true,
    chatJson: async () => {
      calls += 1;
      if (calls === 1) return { tool: "search_products", query: "notebook" };
      return null;
    },
  };
  const response = await new CommerceAssistant(llm).answer(
    sessionFixture(),
    "Quais notebooks existem?",
  );

  assert.equal(response.tool.tool, "search_products");
  assert.match(response.answer, /encontrado/i);
  assert.equal(calls, 2);
});

test("CommerceAssistant ignora síntese sem campo answer e usa o template", async () => {
  let calls = 0;
  const llm: LlmGateway = {
    isConfigured: () => true,
    chatJson: async () => {
      calls += 1;
      if (calls === 1) return { tool: "search_products", query: "notebook" };
      return { resposta: "sem o campo esperado" };
    },
  };
  const response = await new CommerceAssistant(llm).answer(
    sessionFixture(),
    "Quais notebooks existem?",
  );

  assert.equal(response.tool.tool, "search_products");
  assert.match(response.answer, /encontrado/i);
  assert.equal(calls, 2);
});

test("CommerceAssistant isola evidências da loja entre marcadores de dados não confiáveis na síntese", async () => {
  let synthesisPrompt = "";
  let calls = 0;
  const llm: LlmGateway = {
    isConfigured: () => true,
    chatJson: async (messages) => {
      calls += 1;
      if (calls === 2) {
        synthesisPrompt = messages.map((message) => message.content).join("\n");
        return { answer: "Resposta sintetizada." };
      }
      return { tool: "search_products", query: "notebook" };
    },
  };
  const response = await new CommerceAssistant(llm).answer(
    sessionFixture(),
    "Quais notebooks existem?",
  );

  assert.equal(response.answer, "Resposta sintetizada.");
  assert.match(synthesisPrompt, /DADOS_NAO_CONFIAVEIS_INICIO/);
  assert.match(synthesisPrompt, /DADOS_NAO_CONFIAVEIS_FIM/);
  assert.match(synthesisPrompt, /Resumo do resultado \(fonte confiável\)/);
});

test("CommerceAssistant planeja com restrições e respeita decisões persistidas", async () => {
  const session = sessionFixture();
  const assistant = new CommerceAssistant(offlineLlm);
  const decision = await assistant.answer(session, "Marque Completar schema Product como rejeitada");
  const plan = await assistant.answer(session, "Monte um plano de 7 dias para 2 pessoas");

  assert.equal(decision.tool.tool, "manage_decision");
  assert.equal(session.decisions?.["rec:schema"]?.status, "rejected");
  assert.equal(plan.tool.tool, "plan_actions");
  assert.deepEqual((plan.tool.data as { phases: unknown[] }).phases, []);
});

test("CommerceAssistant não chama a síntese quando o roteamento cai no fallback por falha do LLM", async () => {
  let calls = 0;
  const llm: LlmGateway = {
    isConfigured: () => true,
    chatJson: async () => {
      calls += 1;
      return null;
    },
  };
  const response = await new CommerceAssistant(llm).answer(
    sessionFixture(),
    "Quais notebooks existem?",
  );

  assert.equal(response.tool.tool, "search_products");
  assert.match(response.answer, /encontrado/i);
  assert.equal(calls, 1);
});

test("CommerceAssistant desabilita a síntese com ASSISTANT_SYNTHESIS=off", async () => {
  const previous = process.env.ASSISTANT_SYNTHESIS;
  process.env.ASSISTANT_SYNTHESIS = "off";
  try {
    let calls = 0;
    const llm: LlmGateway = {
      isConfigured: () => true,
      chatJson: async () => {
        calls += 1;
        if (calls === 1) return { tool: "search_products", query: "notebook" };
        return { answer: "resposta sintetizada não deve ser usada" };
      },
    };
    const response = await new CommerceAssistant(llm).answer(
      sessionFixture(),
      "Quais notebooks existem?",
    );

    assert.equal(response.tool.tool, "search_products");
    assert.match(response.answer, /encontrado/i);
    assert.equal(calls, 1);
  } finally {
    if (previous === undefined) {
      delete process.env.ASSISTANT_SYNTHESIS;
    } else {
      process.env.ASSISTANT_SYNTHESIS = previous;
    }
  }
});

test("CommerceAssistant gera artefato e checklist de validação para uma recomendação", async () => {
  const assistant = new CommerceAssistant(offlineLlm);
  const artifact = await assistant.answer(sessionFixture(), "Gere JSON-LD para Completar schema Product");
  const validation = await assistant.answer(sessionFixture(), "Valide Completar schema Product");

  assert.equal(artifact.tool.tool, "generate_artifact");
  assert.match((artifact.tool.data as { artifact: { content: string } }).artifact.content, /schema.org/);
  assert.equal(validation.tool.tool, "validate_action");
  assert.equal((validation.tool.data as { requiresNewAnalysis: boolean }).requiresNewAnalysis, true);
});

test("CommerceAssistant executa simulação contrafactual e produz narrativa executiva", async () => {
  const assistant = new CommerceAssistant(offlineLlm);
  const counterfactual = await assistant.answer(
    sessionFixture(),
    "Simule antes e depois da correção Completar schema Product para um comprador técnico",
  );
  const brief = await assistant.answer(sessionFixture(), "Prepare um pitch executivo");

  assert.equal(counterfactual.tool.tool, "simulate_counterfactual");
  const data = counterfactual.tool.data as { before: BuyerJourney; after: BuyerJourney; projectedAttributes: string[] };
  assert.ok(data.before.steps.length > 0);
  assert.ok(data.after.steps.length > 0);
  assert.ok(data.projectedAttributes.length > 0);
  assert.equal(brief.tool.tool, "build_brief");
});

test("CommerceAssistant aplica recomendação: artefato resolvido, decisão aceita e re-simulação", async () => {
  const session = sessionFixture();
  const assistant = new CommerceAssistant(offlineLlm);
  const result = await assistant.applyAction(session, "rec:schema");

  assert.equal(result.tool, "apply_action");
  const data = result.data as {
    artifact: { content: string; kind: string };
    counterfactual: { simulatable: boolean };
    decision: { status: string };
  };
  assert.equal(data.decision.status, "accepted");
  assert.equal(session.decisions?.["rec:schema"]?.status, "accepted");
  assert.equal(data.artifact.kind, "json-ld");
  assert.doesNotMatch(data.artifact.content, /\{\{/);
  assert.match(data.artifact.content, /Notebook Alpha/);
  assert.match(data.artifact.content, /priceCurrency/);
  assert.equal(data.counterfactual.simulatable, false);
});

test("CommerceAssistant aplica recomendação e estima o efeito quando a análise tem jornadas", async () => {
  const session = sessionFixture();
  const geo = await new GeoAgent({ llm: undefined }).run(session.knowledge);
  session.geo = {
    overallScore: geo.overallScore,
    successRate: geo.successRate,
    questionsTested: geo.questionsTested,
    recommendations: geo.recommendations,
    journeys: geo.journeys,
  };
  const result = await new CommerceAssistant(offlineLlm).applyAction(session, "rec:schema");
  const data = result.data as {
    counterfactual: {
      simulatable: boolean;
      beforeSuccessRate: number;
      afterSuccessRate: number;
      totalJourneys: number;
      projectedAttributes: string[];
    };
  };
  assert.equal(data.counterfactual.simulatable, true);
  assert.ok(data.counterfactual.totalJourneys > 0);
  assert.ok(
    data.counterfactual.afterSuccessRate >= data.counterfactual.beforeSuccessRate,
    "adicionar dados estruturados não deve piorar o sucesso",
  );
  assert.match(result.summary, /re-simulação/i);
});

test("CommerceAssistant informa quando a recomendação a aplicar não existe", async () => {
  const session = sessionFixture();
  const result = await new CommerceAssistant(offlineLlm).applyAction(session, "rec:inexistente");
  assert.equal(result.tool, "apply_action");
  assert.match(result.summary, /Nenhuma recomendação/i);
  assert.equal(session.decisions, undefined);
});

test("CommerceAssistant aplica uma recomendação pelo chat", async () => {
  const session = sessionFixture();
  const response = await new CommerceAssistant(offlineLlm).answer(
    session,
    "Aplique a recomendação rec:schema",
  );
  assert.equal(response.tool.tool, "apply_action");
  assert.equal(session.decisions?.["rec:schema"]?.status, "accepted");
});
