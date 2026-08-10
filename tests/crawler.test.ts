import test from "node:test";
import assert from "node:assert/strict";
import { HtmlParser } from "../src/crawler/parser.js";
import { RobotsParser } from "../src/crawler/robots.js";
import { classifyUrl, normalizeUrl } from "../src/utils/url.js";

test("classifica e normaliza URLs corretamente", () => {
  const normalized = normalizeUrl(
    "https://example.com/catalog/product/1",
    "https://example.com",
  );
  assert.equal(normalized, "https://example.com/catalog/product/1");
  assert.equal(classifyUrl("https://example.com/produto/1"), "product");
  assert.equal(classifyUrl("https://example.com/categoria/1"), "category");
  assert.equal(classifyUrl("https://example.com/contato"), "institutional");
});

test("classifica slugs planos de produtos (padrão Pichau)", () => {
  const products = [
    "https://www.pichau.com.br/teclado-mecanico-logitech-g-pro-x-lightspeed-rgb-60-switch-optico-gx-tactile-tri-mode-branco-920-011921",
    "https://www.pichau.com.br/cadeira-gamer-dt3-elise-v3-preto-e-azul-13761-8",
    "https://www.pichau.com.br/mouse-microsoft-basic-optical-usb-preto-p58-00061",
    "https://www.pichau.com.br/ssd-crucial-bx500-120gb-2-5-sata-6gb-s-ct120bx500ssd1-1.html",
    "https://www.pichau.com.br/processador-amd-fx-6300-hexa-core-3-5ghz-3-8ghz-turbo-14-mb-cache-am3-fd6300wmhkbox",
    "https://www.pichau.com.br/hd-wd-blue-500gb-3-5-sata-iii-6gb-s-wd5000aakx",
    "https://www.pichau.com.br/perifericos/headset-gamer-logitech-g35-7-1-surround-preto-981-000116",
  ];
  for (const url of products) {
    assert.equal(classifyUrl(url), "product", url);
  }
});

test("classifica categorias planas e aninhadas (padrão Pichau)", () => {
  const categories = [
    "https://www.pichau.com.br/hardware",
    "https://www.pichau.com.br/cadeiras/gamer",
    "https://www.pichau.com.br/hardware/processadores",
    "https://www.pichau.com.br/perifericos/armazenamento",
    "https://www.pichau.com.br/categorias/acessorios/",
  ];
  for (const url of categories) {
    assert.equal(classifyUrl(url), "category", url);
  }
});

test("classifica páginas utilitárias e lixo do sitemap como unknown", () => {
  const unknown = [
    "https://www.pichau.com.br/fds5off",
    "https://www.pichau.com.br/master19",
    "https://www.pichau.com.br/prumo5off",
    "https://www.pichau.com.br/paginatesteproduto14",
    "https://www.pichau.com.br/todos-os-departamentos",
    "https://www.pichau.com.br/busca",
    "https://www.pichau.com.br/novidades",
    "https://www.pichau.com.br/sem-desconto",
    "https://www.pichau.com.br/docs/guia.pdf",
    "https://pichaugaming.com.br/jet-menu/mega-item-4/",
    "https://pichaugaming.com.br/jet-menu/mega-item-5/",
    "https://pichaugaming.com.br/elementor-mega-item-17/",
    "https://pichaugaming.com.br/mega-item-8/",
  ];
  for (const url of unknown) {
    assert.equal(classifyUrl(url), "unknown", url);
  }
});

test("classifica páginas institucionais por palavras", () => {
  const institutional = [
    "https://example.com/contato",
    "https://example.com/politica-de-privacidade",
    "https://example.com/sobre-nos",
    "https://www.pichau.com.br/frete-gratis-br",
    "https://example.com/carrinho",
  ];
  for (const url of institutional) {
    assert.equal(classifyUrl(url), "institutional", url);
  }
});

test("parseia HTML para um Page estruturado", () => {
  const parser = new HtmlParser();
  const html = `<!doctype html><html lang="pt-BR"><head><title>Loja Demo</title><meta name="description" content="Loja demo" /><link rel="canonical" href="https://example.com/" /></head><body><h1>Bem-vindo</h1><nav><a href="/categoria/1">Categoria</a></nav><script type="application/ld+json">{"@type":"Product","name":"Camiseta"}</script></body></html>`;

  const page = parser.parsePage(
    "https://example.com/",
    html,
    "https://example.com",
  );

  assert.equal(page.type, "homepage");
  assert.equal(page.title, "Loja Demo");
  assert.equal(page.description, "Loja demo");
  assert.equal(page.headings[0], "Bem-vindo");
  assert.equal(page.breadcrumbs[0]?.label, "Categoria");
  assert.equal(page.schemas[0]?.type, "Product");
});

test("parseia página e produto em uma única passagem sem reter HTML", () => {
  const parser = new HtmlParser();
  const html = `<html><head><title>Produto</title></head><body><h1>Notebook</h1><script type="application/ld+json">{"@type":"Product","name":"Notebook","offers":{"price":"4999"}}</script></body></html>`;
  const parsed = parser.parsePageWithProduct(
    "https://example.com/produto/notebook",
    html,
    "https://example.com",
  );

  assert.equal(parsed.page.type, "product");
  assert.equal(parsed.product?.name, "Notebook");
  assert.equal(parsed.product?.price, "4999");
  assert.equal("rawHtml" in parsed.page, false);
});

test("extrai JSON-LD em arrays e @graph", () => {
  const parser = new HtmlParser();
  const html = `<script type="application/ld+json">[{"@type":"Product","name":"Camiseta"},{"@type":"BreadcrumbList","name":"Migalhas"}]</script><script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebSite","name":"Loja"},{"@type":"Organization","name":"Marca"}]}</script>`;

  const page = parser.parsePage(
    "https://example.com/produto/1",
    html,
    "https://example.com",
  );

  assert.deepEqual(
    page.schemas.map((schema) => schema.type).sort(),
    ["BreadcrumbList", "Organization", "Product", "WebSite"],
  );
});

test("extrai links internos e externos da página", () => {
  const parser = new HtmlParser();
  const html = `<!doctype html><html><body>
    <a href="/categorias/acessorios/">Acessórios</a>
    <a href="https://example.com/sobre/">Sobre</a>
    <a href="https://external.com/produto/1">Externo</a>
    <a href="mailto:x@y.com">mail</a>
  </body></html>`;

  const page = parser.parsePage(
    "https://example.com/",
    html,
    "https://example.com",
  );

  assert.deepEqual(page.links, [
    "https://example.com/categorias/acessorios/",
    "https://example.com/sobre/",
    "https://external.com/produto/1",
  ]);
});

test("isPathAllowed respeita allow, disallow e wildcards", () => {
  const parser = new RobotsParser();
  const robots = {
    allow: ["/categoria/"],
    disallow: ["/admin/", "/private", "/*.pdf$"],
    sitemapUrls: [],
  };

  assert.equal(parser.isPathAllowed("/categoria/1", robots), true);
  assert.equal(parser.isPathAllowed("/produto/1", robots), true);
  assert.equal(parser.isPathAllowed("/admin/config", robots), false);
  assert.equal(parser.isPathAllowed("/private-dados", robots), false);
  assert.equal(parser.isPathAllowed("/docs/guia.pdf", robots), false);
});

test("robots seleciona o grupo do agente e aplica a regra mais específica", () => {
  const parser = new RobotsParser();
  const robots = parser.parse([
    "User-agent: Googlebot",
    "Disallow: /google-only/",
    "",
    "User-agent: *",
    "Disallow: /catalogo/",
    "Allow: /catalogo/publico/",
    "",
    "User-agent: CommerceReadinessAgent",
    "Disallow: /privado/",
    "Allow: /privado/catalogo/",
    "Sitemap: https://example.com/sitemap.xml",
  ].join("\n"));

  assert.equal(parser.isPathAllowed("/google-only/item", robots), true);
  assert.equal(parser.isPathAllowed("/catalogo/item", robots), true);
  assert.equal(parser.isPathAllowed("/privado/item", robots), false);
  assert.equal(parser.isPathAllowed("/privado/catalogo/item", robots), true);
  assert.deepEqual(robots.sitemapUrls, ["https://example.com/sitemap.xml"]);
});

test("robots usa wildcard quando não existe grupo específico e Allow vence empate", () => {
  const parser = new RobotsParser();
  const robots = parser.parse([
    "User-agent: Googlebot",
    "Disallow: /",
    "User-agent: *",
    "Disallow: /checkout",
    "Allow: /checkout",
  ].join("\n"), "OutroCrawler");

  assert.equal(parser.isPathAllowed("/produto", robots), true);
  assert.equal(parser.isPathAllowed("/checkout", robots), true);
});

test("robots remove comentários inline mesmo sem espaço antes de #", () => {
  const robots = new RobotsParser().parse([
    "User-agent: *",
    "Disallow: /interno#comentario",
  ].join("\n"));
  assert.deepEqual(robots.disallow, ["/interno"]);
});
