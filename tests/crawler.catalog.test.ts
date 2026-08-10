import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { CrawlerPipeline } from "../src/crawler/crawler.js";

async function startFixture(productCount = 20): Promise<{
  baseUrl: string;
  requested: string[];
  close: () => void;
}> {
  const requested: string[] = [];
  const products = Array.from(
    { length: productCount },
    (_, index) => `/cadeira-gamer-dt3-elise-v3-preto-e-azul-${13000 + index}`,
  );

  const server = http.createServer((req, res) => {
    requested.push(req.url ?? "/");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    const path = (req.url ?? "").split("?")[0];

    if (path === "/robots.txt") {
      res.end("User-agent: *\nSitemap: /sitemap.xml\n");
      return;
    }
    if (path === "/sitemap.xml") {
      const urls = ["/", "/hardware", "/cadeiras", ...products, "/fds5off"]
        .map(
          (url) =>
            `<url><loc>http://127.0.0.1:${req.socket.localPort}${url}</loc></url>`,
        )
        .join("");
      res.end(`<urlset>${urls}</urlset>`);
      return;
    }
    if (path === "/") {
      res.end(
        `<html><body><a href="/hardware">Hardware</a><a href="/cadeiras">Cadeiras</a></body></html>`,
      );
      return;
    }
    if (path === "/hardware" || path === "/cadeiras") {
      res.end(
        `<html><head><title>${path}</title></head><body><a href="${products[0]}">Cadeira</a></body></html>`,
      );
      return;
    }
    res.end(
      `<html><head><title>Produto</title></head><body><h1>${path}</h1></body></html>`,
    );
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requested,
    close: () => server.close(),
  };
}

test("reporta catalogCount e limita produtos detalhados pelo maxProducts", async () => {
  const fixture = await startFixture();
  try {
    const crawler = new CrawlerPipeline({ maxProducts: 3 });
    const snapshot = await crawler.crawl(fixture.baseUrl);

    assert.equal(snapshot.catalogCount, 20);
    assert.equal(snapshot.products.length, 3);
    const urls = snapshot.products.map((product) => product.url);
    assert.equal(new Set(urls).size, urls.length, "produtos sem duplicata");
    assert.ok(
      snapshot.pages.some((page) => page.type === "category"),
      "categorias visitadas",
    );
  } finally {
    fixture.close();
  }
});

test("não visita URLs desconhecidas do sitemap (junk)", async () => {
  const fixture = await startFixture();
  try {
    const crawler = new CrawlerPipeline({ maxPages: 50 });
    await crawler.crawl(fixture.baseUrl);

    assert.ok(
      !fixture.requested.some((url) => url === "/fds5off"),
      "junk não deveria ser requisitado",
    );
  } finally {
    fixture.close();
  }
});

test("overrides com undefined mantêm o maxProducts padrão", async () => {
  const fixture = await startFixture();
  try {
    const crawler = new CrawlerPipeline({ maxProducts: 2 });
    const snapshot = await crawler.crawl(fixture.baseUrl, {
      maxProducts: undefined,
    });

    assert.equal(snapshot.products.length, 2);
  } finally {
    fixture.close();
  }
});

test("default detalha até 1000 produtos por análise", async () => {
  const fixture = await startFixture(1050);
  try {
    const crawler = new CrawlerPipeline();
    const snapshot = await crawler.crawl(fixture.baseUrl);

    assert.equal(snapshot.catalogCount, 1050);
    assert.equal(snapshot.products.length, 1000);
    const urls = snapshot.products.map((product) => product.url);
    assert.equal(new Set(urls).size, urls.length, "produtos sem duplicata");
  } finally {
    fixture.close();
  }
});
