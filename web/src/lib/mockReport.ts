import type {
  GeoReport,
  ProductSample,
  Recommendation,
  RecommendationReport,
  RoadmapPhase,
} from "./report";

const r = (data: Omit<Recommendation, "id"> & { id: string }): Recommendation => data;

const recommendation = (
  opportunityId: string,
  title: string,
  description: string,
  category: Recommendation["category"],
  priority: Recommendation["priority"],
  impact: Recommendation["impact"],
  confidence: number,
  effort: Recommendation["effort"],
  automatable: boolean,
  score: number,
  expectedImpact: string,
  reason: string,
  affectedProducts: number | undefined,
  action: Recommendation["action"],
  affectedItems?: string[],
): Recommendation =>
  r({
    id: `rec:${opportunityId}`,
    opportunityId,
    title,
    description,
    category,
    priority,
    impact,
    confidence,
    effort,
    automatable,
    score,
    expectedImpact,
    reason,
    affectedProducts,
    affectedItems,
    action,
  });

const recommendations: Recommendation[] = [
  recommendation(
    "op:geo-attributes",
    "Atributos GEO ausentes no catálogo",
    "Agentes de IA e mecanismos de busca generativa não conseguem responder perguntas de compra porque faltam atributos estruturados em 96 produtos.",
    "GEO",
    "critica",
    "muito_alto",
    95,
    "medio",
    false,
    90,
    "Impacto esperado Muito Alto. Abrange 96 produto(s) na categoria GEO.",
    "Sem atributos estruturados, buscas generativas (ChatGPT, Google AI Overviews) não conseguem recomendar os produtos, perdendo tráfego qualificado.",
    96,
    {
      title: "Melhorar prontidão para busca generativa",
      description:
        "Garantir que agentes de IA e mecanismos de busca consigam responder perguntas sobre o catálogo.",
      steps: [
        "Validar atributos estruturados em 96 produto(s)",
        "Publicar FAQ estruturado",
      ],
    },
    [
      "Fone Gamer XYZ Pro",
      "Teclado Mecânico RGB",
      "Mousepad Speed XL",
      "Headset 7.1 Surround",
      "+92 outro(s)",
    ],
  ),
  recommendation(
    "op:schema-incomplete",
    "Schema Product incompleto",
    "O JSON-LD de Product das páginas não inclui brand, offers, aggregateRating e review.",
    "Schema",
    "critica",
    "muito_alto",
    92,
    "baixo",
    true,
    88,
    "Impacto esperado Muito Alto. Abrange 84 produto(s) na categoria Schema.",
    "Mecanismos de busca e IA interpretam parcialmente o produto, reduzindo rich snippets e a precisão das respostas.",
    84,
    {
      title: "Completar schema de produto",
      description:
        "Enriquecer o JSON-LD de Product com as propriedades ausentes para melhorar a interpretação por mecanismos de busca e IA.",
      steps: [
        "Adicionar propriedade brand",
        "Adicionar propriedade offers (preço e disponibilidade)",
        "Adicionar propriedade aggregateRating",
        "Adicionar propriedade review",
      ],
    },
    [
      "Fone Gamer XYZ Pro",
      "Teclado Mecânico RGB",
      "Cadeira Gamer Turbo",
      "+81 outro(s)",
    ],
  ),
  recommendation(
    "op:seo-title",
    "Title e meta description ausentes",
    "Páginas de categoria e produto sem title e meta description otimizados.",
    "SEO",
    "critica",
    "alto",
    88,
    "muito_baixo",
    true,
    84,
    "Impacto esperado Alto. Abrange 210 produto(s) na categoria SEO.",
    "Title e meta description são o primeiro contato do cliente nos resultados de busca; a ausência reduz CTR de forma significativa.",
    210,
    {
      title: "Corrigir elementos de SEO",
      description:
        "Ajustar metadados e marcação para melhorar visibilidade orgânica.",
      steps: [
        "Corrigir title e meta description",
        "Adicionar Open Graph e canonical",
        "Revisar headings e texto alternativo das imagens",
      ],
    },
  ),
  recommendation(
    "op:faq",
    "Produtos sem FAQ estruturado",
    "Não existe FAQ com schema FAQPage para responder dúvidas frequentes de compra.",
    "Conteudo",
    "critica",
    "muito_alto",
    78,
    "baixo",
    true,
    78,
    "Impacto esperado Muito Alto. Abrange 45 produto(s) na categoria Conteudo.",
    "FAQs estruturadas capturam featured snippets e são fonte direta de resposta para assistentes de compra.",
    45,
    {
      title: "Gerar FAQ estruturado",
      description:
        "Produzir perguntas e respostas com base nas dúvidas frequentes e no catálogo, publicadas com schema FAQPage.",
      steps: [
        "Coletar dúvidas recorrentes a partir do catálogo e conteúdo existente",
        "Gerar conteúdo para as 3 FAQs atuais com IA",
        "Marcar as perguntas com schema FAQPage",
        "Publicar e validar a estrutura",
      ],
    },
  ),
  recommendation(
    "op:geo-price",
    "Preço e disponibilidade inconsistentes",
    "Entre a página, o schema e o feed de anúncios, os preços divergem em itens-chave.",
    "GEO",
    "alta",
    "alto",
    81,
    "medio",
    false,
    74,
    "Impacto esperado Alto. Abrange 97 produto(s) na categoria GEO.",
    "Inconsistência entre fontes confunde agentes de compra e degrada a confiança do sistema.",
    97,
    {
      title: "Sincronizar preço e disponibilidade",
      description:
        "Unificar a fonte de verdade de preço e estoque entre página, schema e feeds.",
      steps: [
        "Auditar divergências entre página, schema e feed",
        "Definir fonte única de preço e disponibilidade",
        "Automatizar a sincronização entre os canais",
        "Monitorar novas divergências",
      ],
    },
  ),
  recommendation(
    "op:produto-attributes",
    "Produtos sem atributos técnicos",
    "Faltam atributos como peso, dimensões, material e capacidade para a categoria de maior receita.",
    "Produto",
    "alta",
    "alto",
    85,
    "medio",
    false,
    72,
    "Impacto esperado Alto. Abrange 120 produto(s) na categoria Produto.",
    "Perguntas de compra específicas ficam sem resposta quando os atributos técnicos não existem no cadastro.",
    120,
    {
      title: "Enriquecer atributos técnicos",
      description:
        "Padronizar e preencher atributos técnicos dos produtos para permitir perguntas de compra específicas.",
      steps: [
        "Adicionar peso",
        "Adicionar dimensões",
        "Adicionar material",
        "Adicionar capacidade",
        "Padronizar nomenclatura dos atributos",
      ],
    },
  ),
  recommendation(
    "op:descricoes",
    "Descrições genéricas de produto",
    "Grande parte das descrições é curta e genérica, sem diferenciais e palavras-chave de cauda longa.",
    "Produto",
    "alta",
    "alto",
    70,
    "medio",
    false,
    68,
    "Impacto esperado Alto. Abrange 132 produto(s) na categoria Produto.",
    "Descrições ricas melhoram o ranqueamento por cauda longa e alimentam conteúdo para IAs.",
    132,
    {
      title: "Gerar descrições com IA",
      description:
        "Criar descrições ricas e orientadas à conversão para o catálogo.",
      steps: [
        "Definir template de descrição por categoria",
        "Gerar descrições com IA para 132 produto(s)",
        "Revisar por especialistas de produto",
        "Publicar e monitorar conversão",
      ],
    },
  ),
  recommendation(
    "op:schema-breadcrumb",
    "Breadcrumb não estruturado",
    "Breadcrumbs visíveis não possuem marcação schema.org BreadcrumbList.",
    "Schema",
    "alta",
    "medio",
    74,
    "baixo",
    true,
    63,
    "Impacto esperado Médio. Abrange 60 produto(s) na categoria Schema.",
    "A marcação de breadcrumb melhora os breadcrumbs nos resultados de busca e a compreensão hierárquica.",
    60,
    {
      title: "Estruturar breadcrumbs com schema",
      description:
        "Adicionar BreadcrumbList em categorias e produtos.",
      steps: [
        "Mapear hierarquia de categorias",
        "Gerar marcação BreadcrumbList",
        "Validar com o Rich Results Test",
      ],
    },
  ),
  recommendation(
    "op:seo-og",
    "Open Graph ausente em produtos",
    "Páginas de produto não possuem og:title, og:image e og:type.",
    "SEO",
    "media",
    "medio",
    66,
    "muito_baixo",
    true,
    55,
    "Impacto esperado Médio. Abrange 150 produto(s) na categoria SEO.",
    "Compartilhamentos em redes sociais e apps exibem cards sem imagem e título, reduzindo o engajamento.",
    150,
    {
      title: "Adicionar Open Graph",
      description:
        "Preencher as tags Open Graph das páginas de produto.",
      steps: [
        "Adicionar og:title e og:description",
        "Adicionar og:image por produto",
        "Adicionar og:type e og:url",
      ],
    },
  ),
  recommendation(
    "op:sitemap",
    "Sitemap desatualizado",
    "O sitemap.xml não inclui os novos produtos e categorias das últimas semanas.",
    "SEO",
    "media",
    "medio",
    69,
    "medio",
    true,
    50,
    "Impacto esperado Médio. Abrange 72 produto(s) na categoria SEO.",
    "Sitemap desatualizado atrasa a indexação de páginas novas e importantes.",
    72,
    {
      title: "Regenerar sitemap",
      description:
        "Reconstruir o sitemap.xml com todas as URLs vigentes.",
      steps: [
        "Coletar todas as URLs ativas",
        "Gerar sitemap.xml e sitemap de imagens",
        "Enviar para o Search Console",
      ],
    },
  ),
  recommendation(
    "op:schema-review",
    "Review ausente no schema",
    "O schema de produto não inclui review nem aggregateRating.",
    "Schema",
    "media",
    "baixo",
    62,
    "muito_baixo",
    true,
    45,
    "Impacto esperado Baixo. Abrange 38 produto(s) na categoria Schema.",
    "Avaliações estruturadas podem gerar estrelas nos resultados e aumentar a confiança.",
    38,
    {
      title: "Adicionar reviews ao schema",
      description:
        "Marcar avaliações existentes com schema Review e aggregateRating.",
      steps: [
        "Mapear avaliações disponíveis",
        "Adicionar propriedades review e aggregateRating",
        "Validar a marcação",
      ],
    },
  ),
  recommendation(
    "op:seo-alt",
    "Imagens sem texto alternativo",
    "Grande volume de imagens de produto sem atributo alt descritivo.",
    "SEO",
    "baixa",
    "baixo",
    58,
    "muito_baixo",
    true,
    38,
    "Impacto esperado Baixo. Abrange 240 produto(s) na categoria SEO.",
    "Alt text melhora acessibilidade e o ranqueamento de imagens na busca.",
    240,
    {
      title: "Preencher alt text das imagens",
      description:
        "Adicionar texto alternativo descritivo às imagens de produto.",
      steps: [
        "Gerar alt text com IA por produto",
        "Revisar itens de maior tráfego",
        "Validar em lote",
      ],
    },
  ),
  recommendation(
    "op:institucional",
    "Páginas institucionais sem conteúdo rico",
    "Páginas de FAQ, política de troca e sobre não possuem conteúdo estruturado.",
    "Conteudo",
    "baixa",
    "medio",
    54,
    "alto",
    false,
    42,
    "Impacto esperado Médio. Abrange 6 página(s) na categoria Conteudo.",
    "Páginas institucionais bem estruturadas respondem perguntas de pós-venda e geram confiança.",
    undefined,
    {
      title: "Enriquecer páginas institucionais",
      description:
        "Criar conteúdo estruturado para políticas e FAQs institucionais.",
      steps: [
        "Levantar dúvidas recorrentes de pós-venda",
        "Reescrever conteúdo das páginas",
        "Marcar com schema FAQPage e WebPage",
      ],
    },
  ),
];

const byId = (ids: string[]): Recommendation[] =>
  ids.map((id) => recommendations.find((item) => item.id === id)!);

const roadmap: RoadmapPhase[] = [
  {
    phase: 1,
    name: "Fase 1 — Correções rápidas",
    objective:
      "Ações de alto impacto e baixo esforço, priorizadas para execução imediata.",
    recommendations: byId([
      "rec:op:schema-incomplete",
      "rec:op:seo-title",
      "rec:op:faq",
      "rec:op:schema-breadcrumb",
      "rec:op:seo-og",
      "rec:op:seo-alt",
      "rec:op:sitemap",
      "rec:op:schema-review",
    ]),
  },
  {
    phase: 2,
    name: "Fase 2 — Correções estruturais",
    objective:
      "Ajustes estruturais de dados e marcação que exigem planejamento moderado.",
    recommendations: byId([
      "rec:op:geo-attributes",
      "rec:op:geo-price",
      "rec:op:produto-attributes",
      "rec:op:descricoes",
    ]),
  },
  {
    phase: 3,
    name: "Fase 3 — Otimizações avançadas",
    objective:
      "Otimizações de maior esforço ou menor retorno imediato, para execução contínua.",
    recommendations: byId(["rec:op:institucional"]),
  },
];

const automaticActions = recommendations.filter((item) => item.automatable);
const manualActions = recommendations.filter((item) => !item.automatable);

const topRecommendations = [...recommendations]
  .sort((a, b) => b.score - a.score)
  .slice(0, 10);

const geo: GeoReport = {
  overallScore: 48,
  successRate: 0.42,
  llmEnabled: true,
  questionsTested: 42,
  categoryScores: [
    { categoryId: "category:1", categoryName: "Notebooks", total: 14, successRate: 0.5 },
    { categoryId: "category:2", categoryName: "Eletrônicos", total: 14, successRate: 0.36 },
    { categoryId: "category:3", categoryName: "Periféricos", total: 14, successRate: 0.43 },
  ],
  personaScores: [
    { persona: "price", label: "Comparador de preço", questions: 14, successRate: 0.14, avgConfidence: 42 },
    { persona: "spec", label: "Comprador técnico", questions: 14, successRate: 0.57, avgConfidence: 68 },
    { persona: "brand", label: "Comprador fiel à marca", questions: 14, successRate: 0.5, avgConfidence: 61 },
    { persona: "compare", label: "Comprador comparador", questions: 14, successRate: 0.5, avgConfidence: 58 },
  ],
  evaluations: [
    {
      questionId: "category:1:price:1",
      questionText: "Qual notebooks oferece o melhor custo-benefício por até R$ 3.200?",
      persona: "price",
      status: "PARTIAL",
      confidence: 55,
      explanation:
        "Encontrei um candidato dentro do orçamento, mas não há ficha técnica (processador, memória) para comparar o custo-benefício com segurança.",
      missingAttributes: ["processador", "memória", "tela"],
      answer: {
        text: "Identifiquei candidatos, mas não posso confirmar a recomendação: faltam dados estruturados de processador, memória e tela.",
        facts: [{ id: "p:notebook-gamer", name: "Notebook Gamer MarcaX RTX 4060", price: "R$ 5.999", brand: "MarcaX" }],
        blockingAttributes: ["processador", "memória", "tela"],
      },
    },
    {
      questionId: "category:2:spec:1",
      questionText: "Qual eletrônico possui bluetooth 5.0?",
      persona: "spec",
      status: "SUCCESS",
      confidence: 95,
      explanation:
        "O produto foi identificado corretamente usando atributos estruturados.",
      missingAttributes: [],
      answer: {
        text: "Recomendo o Fone Gamer XYZ Pro (R$ 300) — atende à pergunta com dados estruturados completos.",
        facts: [{ id: "p:fone-xyz", name: "Fone Gamer XYZ Pro", price: "R$ 300", brand: "XYZ Audio" }],
        blockingAttributes: [],
      },
    },
    {
      questionId: "category:3:brand:1",
      questionText: "Qual periférico da marca Logitech possui switch mecânico?",
      persona: "brand",
      status: "FAIL",
      confidence: 12,
      explanation:
        "Não consigo determinar qual periférico atende a pergunta porque não há produtos com o atributo switch mecânico.",
      missingAttributes: ["switch mecânico", "marca"],
      answer: {
        text: "Não encontrei um periférico que responda à pergunta: os dados estruturados não declaram switch mecânico e marca.",
        facts: [],
        blockingAttributes: ["switch mecânico", "marca"],
      },
    },
    {
      questionId: "category:1:compare:1",
      questionText: "Entre Notebook Acer Nitro 5 e Notebook Gamer MarcaX RTX 4060, qual possui 16GB de memória?",
      persona: "compare",
      status: "SUCCESS",
      confidence: 90,
      explanation:
        "O atributo memória foi identificado nos dois produtos e a comparação foi resolvida.",
      missingAttributes: [],
      answer: {
        text: "Recomendo o Notebook Gamer MarcaX RTX 4060 (R$ 5.999) — atende à pergunta com dados estruturados completos.",
        facts: [{ id: "p:notebook-gamer", name: "Notebook Gamer MarcaX RTX 4060", price: "R$ 5.999", brand: "MarcaX" }],
        blockingAttributes: [],
      },
    },
  ],
  recommendations: [
    {
      title: "Adicionar atributo estruturado processador em produtos relevantes",
      impact: "high",
      affectedProducts: 12,
      reason:
        "O atributo processador apareceu como falta em 12 perguntas de compra.",
    },
    {
      title: "Adicionar atributo estruturado memória em produtos relevantes",
      impact: "high",
      affectedProducts: 9,
      reason:
        "O atributo memória apareceu como falta em 9 perguntas de compra.",
    },
  ],
};

const samples: ProductSample[] = [
  {
    id: "p:notebook-gamer",
    name: "Notebook Gamer MarcaX RTX 4060",
    price: "R$ 5.999,00",
    brand: "MarcaX",
    url: "https://www.teclab.com.br/p/notebook-gamer-marcax-rtx-4060",
    categoryId: "category:1",
    categoryName: "Notebooks",
    attributes: {
      "Tela": "15.6\" 144Hz",
      "Memória RAM": "16GB",
    },
    schema: {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "Notebook Gamer MarcaX RTX 4060",
      "price": "5999",
    },
  },
  {
    id: "p:fone-xyz",
    name: "Fone Gamer XYZ Pro",
    price: "R$ 299,90",
    brand: "XYZ Audio",
    url: "https://www.teclab.com.br/p/fone-gamer-xyz-pro",
    categoryId: "category:2",
    categoryName: "Eletrônicos",
    attributes: {
      "Conexão": "Bluetooth 5.0",
      "Bateria": "40 horas",
    },
    schema: null,
  },
  {
    id: "p:teclado-rgb",
    name: "Teclado Mecânico RGB",
    price: "R$ 449,90",
    brand: "Logitech",
    url: "https://www.teclab.com.br/p/teclado-mecanico-rgb",
    categoryId: "category:3",
    categoryName: "Periféricos",
    attributes: {
      "Switch": "Mecânico",
      "Iluminação": "RGB",
    },
    schema: {
      "@context": "https://schema.org",
      "@type": "Product",
      "name": "Teclado Mecânico RGB",
      "price": "449.90",
    },
  },
];

export const mockReport: RecommendationReport = {
  site: {
    baseUrl: "https://www.teclab.com.br",
    host: "teclab.com.br",
    title: "TecLab — Eletrônicos & Informática",
  },
  analyzedAt: "2026-08-04T09:30:00.000Z",
  samples,
  businessInput: {
    avgTicket: 500,
    organicConversionRate: 0.02,
    monthlyOrganicSessions: 45000,
    laborCostPerHour: 60,
  },
  healthScore: 62,
  health: {
    score: 62,
    grade: "C",
    label: "Regular",
    explanation: {
      metric: "health",
      summary: "Health Score 62/100 — nível \"Regular\" (nota C).",
      formula: "health = 100 − score médio das oportunidades detectadas",
      inputs: [
        { key: "healthScore", label: "Health Score", display: "62/100", value: 62 },
        { key: "grade", label: "Nota", display: "C" },
        { key: "label", label: "Classificação", display: "Regular" },
      ],
      rationale: [],
      assumptions: ["A nota (A–F) contextualiza o número e evita leituras literalistas de 0/100."],
      modelVersion: "1.1",
    },
  },
  totalOpportunities: recommendations.length,
  executiveSummary:
    "A TecLab apresenta 13 oportunidades distribuídas entre SEO, GEO, Schema, Conteúdo e Produto — 8 delas automatizáveis. O ponto de maior urgência é a prontidão para busca generativa: agentes de IA hoje não conseguem responder perguntas sobre 96 produtos. Executando as correções rápidas da Fase 1 (schema completo, SEO on-page e FAQ estruturada), estima-se recuperar 20 pontos no Health Score em poucas semanas.",
  recommendations,
  topRecommendations,
  automaticActions,
  manualActions,
  roadmap,
  geo,
  impactEstimate: {
    automaticActions: automaticActions.length,
    manualActions: manualActions.length,
    estimatedScoreGain: 20,
    topCategory: "SEO",
  },
};
