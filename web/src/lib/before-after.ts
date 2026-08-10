import type {
  OpportunityCategory,
  Recommendation,
  RecommendationReport,
  ProductSample,
  GeoEvaluation,
} from "./report.js";

export interface BeforeAfterScenario {
  id: string;
  category: OpportunityCategory;
  title: string;
  problem: string;
  before: string;
  after: string;
  expectedResult: string;
  actionSteps?: string[];
  realExample?: string;
}

function productName(title: string): string {
  const match = title.match(/["'](.+?)["']/);
  if (match) return match[1];
  return "Produto da loja";
}

const CATEGORY_ORDER: OpportunityCategory[] = [
  "Schema",
  "Produto",
  "GEO",
  "Conteudo",
  "SEO",
];

function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function expectedResult(rec: Recommendation): string {
  const revenue = rec.businessImpact?.revenue;
  if (
    revenue &&
    Number.isFinite(revenue.low) &&
    Number.isFinite(revenue.high)
  ) {
    const scope =
      rec.affectedProducts != null && rec.affectedProducts > 0
        ? ` ${rec.affectedProducts} produto(s) afetado(s).`
        : "";
    return `Receita estimada: ${formatBrl(revenue.low)}–${formatBrl(
      revenue.high,
    )} (${revenue.currency ?? "BRL"}).${scope}`;
  }
  return rec.expectedImpact;
}

function pickSample(
  samples: ProductSample[],
  rec: Recommendation,
): ProductSample | undefined {
  if (samples.length === 0) return undefined;
  const items = rec.affectedItems ?? [];
  return (
    samples.find((sample) =>
      items.some(
        (item) =>
          sample.name === item ||
          sample.name.includes(item) ||
          item.includes(sample.name),
      ),
    ) ?? samples[0]
  );
}

function missingForSample(
  evaluations: GeoEvaluation[],
  sample: ProductSample | undefined,
): string[] {
  if (evaluations.length === 0 || !sample) return [];
  const byCategory = evaluations.find(
    (evaluation) =>
      evaluation.categoryId === sample.categoryId &&
      evaluation.status !== "SUCCESS",
  );
  const fallback = evaluations.find(
    (evaluation) => evaluation.status !== "SUCCESS",
  );
  return (byCategory ?? fallback)?.missingAttributes ?? [];
}

function priceNumber(price?: string): string | null {
  if (!price) return null;
  const cleaned = price
    .replace(/[^\d.,]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) && parsed > 0 ? parsed.toFixed(2) : null;
}

function schemaBefore(sample: ProductSample | undefined): string {
  const raw = sample?.schema;
  if (!raw || Object.keys(raw).length === 0) {
    return `<!-- Nenhum JSON-LD detectado no produto. -->`;
  }
  return JSON.stringify(raw, null, 2);
}

function schemaAfter(
  sample: ProductSample | undefined,
  missing: string[],
): string {
  const price = priceNumber(sample?.price);
  const after: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: sample?.name ?? "Produto",
  };
  if (sample?.brand) {
    after["brand"] = { "@type": "Brand", name: sample.brand };
  }
  if (price) {
    after["offers"] = {
      "@type": "Offer",
      price,
      priceCurrency: "BRL",
      availability: "https://schema.org/InStock",
    };
  }
  const present: Record<string, string> = sample?.attributes ?? {};
  const propertyValues: [string, string][] = [
    ...Object.entries(present),
    ...missing.map((attribute) => [attribute, "ex: valor correto"] as [string, string]),
  ].slice(0, 8);
  if (propertyValues.length > 0) {
    after["additionalProperty"] = propertyValues.map(([key, value]) => ({
      "@type": "PropertyValue",
      name: key,
      value,
    }));
  }
  return JSON.stringify(after, null, 2);
}

const RECOMMENDED_SCHEMA_PROPS = ["brand", "offers", "aggregateRating", "review"];

function schemaScenario(
  rec: Recommendation,
  sample: ProductSample | undefined,
  missing: string[],
): BeforeAfterScenario {
  const name = sample?.name ?? productName(rec.title);
  const rawSchema = sample?.schema;
  const exposed = rawSchema
    ? Object.keys(rawSchema).filter((key) => !key.startsWith("@"))
    : [];
  const missingProps = rawSchema
    ? RECOMMENDED_SCHEMA_PROPS.filter((prop) => !(prop in rawSchema))
    : RECOMMENDED_SCHEMA_PROPS;
  const problem = rawSchema
    ? missingProps.length > 0
      ? `O JSON-LD real de "${name}" expõe ${
          exposed.length > 0 ? exposed.join(", ") : "dados mínimos"
        }. Faltam ${missingProps.join(", ")}${
          missing.length > 0 ? ` e os atributos ${missing.slice(0, 3).join(", ")}` : ""
        }.`
      : `O JSON-LD de "${name}" está completo, mas os atributos técnicos não respondem às perguntas dos compradores (${
          missing.slice(0, 3).join(", ") || "nenhum atributo adicional"
        }).`
    : `Nenhum JSON-LD detectado no produto "${name}". Mecanismos de busca e agentes de IA interpretam a página apenas pelo HTML.`;
  return {
    id: `dynamic-${rec.opportunityId}`,
    category: rec.category,
    title: rec.title,
    problem,
    before: schemaBefore(sample),
    after: schemaAfter(sample, missing),
    expectedResult: expectedResult(rec),
    actionSteps: rec.action.steps,
    realExample: name,
  };
}

function productScenario(
  rec: Recommendation,
  sample: ProductSample | undefined,
  missing: string[],
): BeforeAfterScenario {
  const name = sample?.name ?? productName(rec.title);
  const present = sample?.attributes ?? {};
  const before = {
    name,
    price: sample?.price ?? "R$ —",
    attributes: present,
  };
  const after = {
    name,
    price: sample?.price ?? "R$ —",
    attributes: {
      ...present,
      ...Object.fromEntries(
        missing.map((attribute) => [attribute, "ex: valor correto"]),
      ),
    },
  };
  const presentCount = Object.keys(present).length;
  return {
    id: `dynamic-${rec.opportunityId}`,
    category: rec.category,
    title: rec.title,
    problem:
      missing.length > 0
        ? `O cadastro de "${name}" expõe ${presentCount} atributo(s), mas os compradores perguntam por: ${missing.join(", ")}.`
        : `O cadastro de "${name}" expõe poucos atributos técnicos, limitando filtros e respostas de IA.`,
    before: JSON.stringify(before, null, 2),
    after: JSON.stringify(after, null, 2),
    expectedResult: expectedResult(rec),
    actionSteps: rec.action.steps,
    realExample: name,
  };
}

function geoScenario(
  rec: Recommendation,
  sample: ProductSample | undefined,
  missing: string[],
  evaluations: GeoEvaluation[],
): BeforeAfterScenario {
  const name = sample?.name ?? productName(rec.title);
  const evaluation =
    evaluations.find((item) => item.status !== "SUCCESS") ?? evaluations[0];
  const question =
    evaluation?.questionText ??
    "Qual produto atende ao meu orçamento e requisitos?";
  const currentAnswer =
    evaluation?.explanation ??
    "Não foi possível identificar produtos da loja a partir dos dados disponíveis.";
  const attributes = missing.slice(0, 3);
  const afterAnswer = [
    `"A loja possui o ${name}${sample?.price ? ` por ${sample.price}` : ""}${
      attributes.length > 0 ? `, com ${attributes.join(", ")}` : ""
    }."`,
  ].join(" ");
  return {
    id: `dynamic-${rec.opportunityId}`,
    category: rec.category,
    title: rec.title,
    problem:
      missing.length > 0
        ? `Busca generativa não encontra informações confiáveis sobre "${name}": faltam ${missing.join(", ")}.`
        : `Busca generativa não encontra informações confiáveis sobre o catálogo.`,
    before: `Pergunta do comprador: "${question}"
Resposta do agente de IA hoje:
${currentAnswer}`,
    after: `Pergunta do comprador: "${question}"
Resposta do agente de IA após a correção:
${afterAnswer}`,
    expectedResult: expectedResult(rec),
    actionSteps: rec.action.steps,
    realExample: name,
  };
}

function conteudoScenario(
  rec: Recommendation,
  sample: ProductSample | undefined,
): BeforeAfterScenario {
  const name = sample?.name ?? productName(rec.title);
  return {
    id: `dynamic-${rec.opportunityId}`,
    category: rec.category,
    title: rec.title,
    problem: `Dúvidas frequentes de compra (frete, garantia, troca) sobre "${name}" não estão estruturadas em FAQPage.`,
    before: `<!-- Sem marcação de FAQ -->
<section>
  <h3>Perguntas frequentes</h3>
  <p>Ver respostas na página...</p>
</section>`,
    after: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Qual o prazo de entrega do ${name}?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Entrega em até 2 dias úteis para capitais."
      }
    },
    {
      "@type": "Question",
      "name": "Posso trocar o ${name}?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Sim, em até 7 dias após o recebimento."
      }
    }
  ]
}
</script>`,
    expectedResult: expectedResult(rec),
    actionSteps: rec.action.steps,
    realExample: name,
  };
}

function seoScenario(
  rec: Recommendation,
  sample: ProductSample | undefined,
  siteTitle: string | undefined,
): BeforeAfterScenario {
  const name = sample?.name ?? productName(rec.title);
  const page = rec.affectedItems?.[0] ?? name;
  return {
    id: `dynamic-${rec.opportunityId}`,
    category: rec.category,
    title: rec.title,
    problem: `Páginas como "${page}" estão sem title e meta description otimizados.`,
    before: `<head>
  <title></title>
  <meta name="description" content="" />
</head>`,
    after: `<head>
  <title>${name}${siteTitle ? ` | ${siteTitle}` : ""}</title>
  <meta name="description"
    content="${name} com especificações completas, garantia e frete grátis. Compre agora." />
  <meta property="og:type" content="product" />
  <link rel="canonical" href="${sample?.url ?? ""}" />
</head>`,
    expectedResult: expectedResult(rec),
    actionSteps: rec.action.steps,
    realExample: page,
  };
}

export function generateBeforeAfterScenarios(
  report: RecommendationReport,
): BeforeAfterScenario[] {
  const samples = report.samples ?? [];
  const evaluations = report.geo?.evaluations ?? [];
  const recsByCategory = new Map<OpportunityCategory, Recommendation>();
  for (const rec of report.recommendations ?? []) {
    if (!recsByCategory.has(rec.category)) {
      recsByCategory.set(rec.category, rec);
    }
  }

  const scenarios: BeforeAfterScenario[] = [];
  for (const category of CATEGORY_ORDER) {
    const rec = recsByCategory.get(category);
    if (!rec) continue;
    const sample = pickSample(samples, rec);
    const missing = missingForSample(evaluations, sample);
    switch (category) {
      case "Schema":
        scenarios.push(schemaScenario(rec, sample, missing));
        break;
      case "Produto":
        scenarios.push(productScenario(rec, sample, missing));
        break;
      case "GEO":
        scenarios.push(geoScenario(rec, sample, missing, evaluations));
        break;
      case "Conteudo":
        scenarios.push(conteudoScenario(rec, sample));
        break;
      case "SEO":
        scenarios.push(seoScenario(rec, sample, report.site.title));
        break;
    }
  }
  return scenarios;
}

export const beforeAfterScenarios: BeforeAfterScenario[] = [
  {
    id: "schema",
    category: "Schema",
    title: "Schema Product incompleto",
    problem:
      "O JSON-LD das páginas de produto expõe apenas nome e preço, sem brand, offers, aggregateRating e review.",
    before: `{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "SSD Kingston 1TB NVMe",
  "price": "449,90"
}`,
    after: `{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "SSD Kingston 1TB NVMe",
  "brand": { "@type": "Brand", "name": "Kingston" },
  "offers": {
    "@type": "Offer",
    "price": "449.90",
    "priceCurrency": "BRL",
    "availability": "https://schema.org/InStock"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": 1320
  },
  "review": {
    "@type": "Review",
    "reviewRating": { "@type": "Rating", "ratingValue": "5" },
    "author": { "@type": "Person", "name": "Camila R." }
  }
}`,
    expectedResult:
      "Rich snippets com estrelas, preço e disponibilidade nos resultados de busca — maior CTR e precisão nas respostas de IA.",
  },
  {
    id: "produto",
    category: "Produto",
    title: "Produtos sem atributos técnicos",
    problem:
      "Cadastro com apenas nome e preço. Perguntas como “qual SSD tem 1TB?” ficam sem resposta.",
    before: `{
  "name": "SSD Kingston 1TB",
  "price": "R$ 449,90",
  "description": "SSD rápido e confiável."
}`,
    after: `{
  "name": "SSD Kingston 1TB NVMe",
  "price": "R$ 449,90",
  "attributes": {
    "capacidade": "1 TB",
    "interface": "PCIe 4.0",
    "peso": "8 g",
    "dimensões": "22 x 80 x 2 mm",
    "material": "Alumínio",
    "velocidade_leitura": "3.500 MB/s"
  }
}`,
    expectedResult:
      "Perguntas de compra específicas passam a ter resposta, permitindo filtros e recomendação por atributos.",
  },
  {
    id: "geo",
    category: "GEO",
    title: "Atributos GEO ausentes",
    problem:
      "Busca generativa não encontra informações confiáveis sobre os produtos e não os recomenda.",
    before: `Pergunta: "Qual notebook gamer até R$ 6.000?"
Resposta da IA: "Não tenho informações suficientes
para recomendar produtos desta loja."`,
    after: `Pergunta: "Qual notebook gamer até R$ 6.000?"
Resposta da IA: "A TecLab possui o Notebook Gamer
MarcaX RTX 4060 por R$ 5.999, com 16GB de RAM,
garantia de 12 meses e frete grátis."`,
    expectedResult:
      "Produtos citados em respostas de IA com dados consistentes de preço, disponibilidade e atributos.",
  },
  {
    id: "conteudo",
    category: "Conteudo",
    title: "Produtos sem FAQ",
    problem:
      "Dúvidas frequentes de compra (frete, garantia, troca) não estão estruturadas em FAQPage.",
    before: `<!-- Sem marcação de FAQ -->
<section>
  <h3>Perguntas frequentes</h3>
  <p>Ver respostas na página...</p>
</section>`,
    after: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Qual o prazo de entrega?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Entrega em até 2 dias úteis para capitais."
      }
    },
    {
      "@type": "Question",
      "name": "Posso trocar o produto?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Sim, em até 7 dias após o recebimento."
      }
    }
  ]
}
</script>`,
    expectedResult:
      "Featured snippets e respostas diretas para dúvidas de compra, geradas e publicadas com apoio de IA.",
  },
  {
    id: "seo",
    category: "SEO",
    title: "Title e meta description ausentes",
    problem:
      "Páginas sem title, meta description e Open Graph — CTR baixo e compartilhamentos sem preview.",
    before: `<head>
  <title></title>
  <meta name="description" content="" />
</head>`,
    after: `<head>
  <title>SSD Kingston 1TB NVMe PCIe 4.0 | TecLab</title>
  <meta name="description"
    content="SSD Kingston 1TB NVMe com 3.500 MB/s, 5 anos de garantia e frete grátis. Compre na TecLab." />
  <meta property="og:type" content="product" />
  <meta property="og:image"
    content="https://www.teclab.com.br/ssd-kingston-1tb.jpg" />
  <link rel="canonical" href="https://www.teclab.com.br/p/ssd-kingston-1tb" />
</head>`,
    expectedResult:
      "CTR mais alto nos resultados de busca e cards ricos ao compartilhar em redes sociais e apps.",
  },
];
