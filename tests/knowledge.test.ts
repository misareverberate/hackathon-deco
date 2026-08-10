import test from "node:test";
import assert from "node:assert/strict";
import { KnowledgeBuilder } from "../src/knowledge/knowledgeBuilder.js";
import type { SiteSnapshot } from "../src/models.js";

const sampleSnapshot: SiteSnapshot = {
  site: {
    baseUrl: "https://example.com",
    host: "example.com",
    title: "Loja Demo",
    description: "Loja demo",
  },
  pages: [
    {
      url: "https://example.com/produto/ssd-kingston",
      type: "product",
      title: "SSD Kingston",
      description: "SSD Kingston",
      headings: ["SSD Kingston"],
      breadcrumbs: [{ label: "Home" }, { label: "Storage" }],
      metadata: {},
      images: [],
      schemas: [],
    },
    {
      url: "https://example.com/categoria/storage",
      type: "category",
      title: "Storage",
      description: "Storage",
      headings: ["Storage"],
      breadcrumbs: [{ label: "Home" }],
      metadata: {},
      images: [],
      schemas: [],
    },
  ],
  products: [
    {
      name: "SSD 1TB",
      url: "https://example.com/produto/ssd-kingston",
      price: "$100",
      description: "SSD",
      brand: "Kingston",
      sku: "SSD-001",
      availability: "in_stock",
      category: "Storage",
      images: [],
      attributes: {
        Capacidade: "1TB",
        Interface: "PCIe 4.0",
      },
      raw: {
        "@type": "Product",
      },
    },
    {
      name: "SSD 1000 GB",
      url: "https://example.com/produto/ssd-2",
      price: "$95",
      description: "SSD",
      images: [],
      attributes: {
        Capacidade: "1000 GB",
      },
    },
  ],
  categories: [
    { name: "Storage", url: "https://example.com/categoria/storage" },
  ],
  sitemap: { urls: [], source: "https://example.com/sitemap.xml" },
  robots: { allow: [], disallow: [], sitemapUrls: [] },
  schemas: [{ type: "Product", raw: { "@type": "Product" } }],
  errors: [],
};

test("constrói uma knowledge base estruturada com entidades e relacionamentos", () => {
  const builder = new KnowledgeBuilder();
  const knowledge = builder.build(sampleSnapshot);

  assert.equal(knowledge.products.length, 2);
  assert.ok(
    knowledge.products.some(
      (product) => product.normalizedName === "ssd 1000gb",
    ),
  );
  assert.ok(
    knowledge.attributes.some(
      (attribute) =>
        attribute.name === "Capacidade" &&
        attribute.normalizedValue === "1000gb",
    ),
  );
  assert.ok(knowledge.brands.some((brand) => brand.name === "Kingston"));
  assert.ok(
    knowledge.relationships.some(
      (relationship) => relationship.type === "BELONGS_TO",
    ),
  );
  assert.ok(
    knowledge.relationships.some(
      (relationship) => relationship.type === "HAS_ATTRIBUTE",
    ),
  );
  assert.ok(
    knowledge.indexes.productsByCategory["category:storage"]?.includes(
      "product:1",
    ),
  );
  assert.ok(
    knowledge.indexes.productsByBrand["brand:kingston"]?.includes("product:1"),
  );
  assert.ok(
    knowledge.indexes.productsByUrl[
      "https://example.com/produto/ssd-kingston"
    ]?.includes("product:1"),
  );
  assert.ok(knowledge.categories[0]?.productIds.includes("product:1"));
  assert.ok(knowledge.brands[0]?.productIds.includes("product:1"));
  assert.ok(
    knowledge.issues.some((issue) => issue.includes("Produto sem marca")),
  );
});

test("relaciona schema ao produto correto pela página", () => {
  const snapshot: SiteSnapshot = {
    ...sampleSnapshot,
    pages: [
      {
        url: "https://example.com/produto/ssd-kingston",
        type: "product",
        title: "SSD Kingston",
        description: "SSD Kingston",
        headings: [],
        breadcrumbs: [],
        metadata: {},
        images: [],
        schemas: [
          { type: "Product", raw: { "@type": "Product", name: "SSD 1TB" } },
        ],
      },
    ],
    schemas: [
      { type: "Product", raw: { "@type": "Product", name: "SSD 1TB" } },
    ],
  };

  const builder = new KnowledgeBuilder();
  const knowledge = builder.build(snapshot);

  const product = knowledge.products.find(
    (entry) => entry.id === "product:1",
  );
  assert.ok(product);
  assert.deepEqual(product.schemaIds, ["schema:1"]);
  assert.ok(knowledge.schemas[0]?.productIds.includes("product:1"));
});

test("ancora schema à página pela URL mesmo fora da ordem posicional", () => {
  const snapshot: SiteSnapshot = {
    ...sampleSnapshot,
    pages: [
      {
        url: "https://example.com/categoria/storage",
        type: "category",
        title: "Storage",
        description: "Storage",
        headings: [],
        breadcrumbs: [],
        metadata: {},
        images: [],
        schemas: [],
      },
      {
        url: "https://example.com/produto/ssd-kingston",
        type: "product",
        title: "SSD Kingston",
        description: "SSD Kingston",
        headings: [],
        breadcrumbs: [],
        metadata: {},
        images: [],
        schemas: [],
      },
    ],
    schemas: [
      {
        type: "Product",
        raw: { "@type": "Product", name: "SSD 1TB" },
        url: "https://example.com/produto/ssd-kingston",
      },
    ],
  };

  const builder = new KnowledgeBuilder();
  const knowledge = builder.build(snapshot);

  const product = knowledge.products.find(
    (entry) => entry.id === "product:1",
  );
  assert.ok(product);
  assert.deepEqual(product.schemaIds, ["schema:1"]);
  assert.ok(knowledge.schemas[0]?.productIds.includes("product:1"));
});

test("extrai FAQs de schemas FAQPage", () => {
  const snapshot: SiteSnapshot = {
    ...sampleSnapshot,
    schemas: [
      { type: "Product", raw: { "@type": "Product" } },
      {
        type: "FAQPage",
        raw: {
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Qual a garantia?",
              acceptedAnswer: { "@type": "Answer", text: "12 meses" },
            },
            {
              "@type": "Question",
              name: "Qual o prazo de entrega?",
              acceptedAnswer: { "@type": "Answer", text: "5 dias úteis" },
            },
          ],
        },
      },
    ],
  };

  const builder = new KnowledgeBuilder();
  const knowledge = builder.build(snapshot);

  assert.equal(knowledge.faqs.length, 2);
  assert.equal(knowledge.faqs[0]?.question, "Qual a garantia?");
  assert.equal(knowledge.faqs[0]?.answer, "12 meses");
  assert.equal(knowledge.faqs[1]?.question, "Qual o prazo de entrega?");
});

test("ignora schemas que não são FAQPage e mainEntity sem Question", () => {
  const snapshot: SiteSnapshot = {
    ...sampleSnapshot,
    schemas: [
      { type: "Product", raw: { "@type": "Product" } },
      {
        type: "FAQPage",
        raw: {
          "@type": "FAQPage",
          mainEntity: { "@type": "Thing", name: "Sem pergunta" },
        },
      },
    ],
  };

  const builder = new KnowledgeBuilder();
  const knowledge = builder.build(snapshot);

  assert.equal(knowledge.faqs.length, 0);
});
