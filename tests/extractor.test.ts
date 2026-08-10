import test from "node:test";
import assert from "node:assert/strict";
import { Extractor } from "../src/crawler/extractor.js";
import type { Page, Product } from "../src/models.js";

const baseUrl = "https://example.com";

function productPage(url: string, title?: string): Page {
  return {
    url,
    type: "product",
    title,
    headings: [],
    breadcrumbs: [],
    metadata: {},
    images: [],
    schemas: [],
    links: [],
  };
}

test("extractProducts não duplica produto visitado e enriquecido", () => {
  const extractor = new Extractor();
  const pages: Page[] = [productPage(`${baseUrl}/produto/1`, "Camiseta")];
  const products: Product[] = [
    {
      url: `${baseUrl}/produto/1`,
      name: "Camiseta Premium",
      images: [],
      attributes: {},
    },
  ];

  const result = extractor.extractProducts(pages, products, baseUrl);

  assert.equal(result.length, 1);
  assert.equal(result[0].name, "Camiseta Premium");
});

test("extractProducts inclui produto de página sem entrada enriquecida", () => {
  const extractor = new Extractor();
  const pages: Page[] = [productPage(`${baseUrl}/produto/2`, "Caneca")];

  const result = extractor.extractProducts(pages, [], baseUrl);

  assert.equal(result.length, 1);
  assert.equal(result[0].name, "Caneca");
  assert.equal(result[0].url, `${baseUrl}/produto/2`);
});

test("extractProducts ignora páginas que não são de produto", () => {
  const extractor = new Extractor();
  const pages: Page[] = [
    {
      ...productPage(`${baseUrl}/categoria/1`, "Cadeiras"),
      type: "category",
    },
  ];

  const result = extractor.extractProducts(pages, [], baseUrl);

  assert.equal(result.length, 0);
});
