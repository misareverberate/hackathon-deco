import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { SitemapParser } from "../src/crawler/sitemap.js";

async function withServer(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => void,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port =
    address !== null && typeof address === "object" ? address.port : 0;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

test("parseSitemap reconhece sitemap index e extrai filhos", () => {
  const parser = new SitemapParser();
  const xml = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>https://example.com/sitemap-products.xml</loc></sitemap><sitemap><loc>https://example.com/sitemap-categories.xml</loc></sitemap></sitemapindex>`;

  const parsed = parser.parseSitemap(xml);
  assert.equal(parsed.kind, "index");
  assert.deepEqual(parsed.urls, [
    "https://example.com/sitemap-products.xml",
    "https://example.com/sitemap-categories.xml",
  ]);
});

test("parseSitemap extrai locs de um urlset com múltiplas URLs", () => {
  const parser = new SitemapParser();
  const xml = `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/produto/1</loc></url><url><loc>https://example.com/categoria/x</loc></url></urlset>`;

  const parsed = parser.parseSitemap(xml);
  assert.equal(parsed.kind, "urlset");
  assert.deepEqual(parsed.urls, [
    "https://example.com/produto/1",
    "https://example.com/categoria/x",
  ]);
});

test("parseSitemap extrai locs de um urlset com URL única", () => {
  const parser = new SitemapParser();
  const xml = `<urlset><url><loc>https://example.com/produto/1</loc></url></urlset>`;

  const parsed = parser.parseSitemap(xml);
  assert.equal(parsed.kind, "urlset");
  assert.deepEqual(parsed.urls, ["https://example.com/produto/1"]);
});

test("fetchSitemaps limita a quantidade total de URLs acumuladas", async () => {
  await withServer((req, res) => {
    const baseUrl = `http://127.0.0.1:${req.socket.localPort}`;
    res.setHeader("Content-Type", "application/xml");
    res.end(`<urlset>${[1, 2, 3, 4].map((id) => `<url><loc>${baseUrl}/p/${id}</loc></url>`).join("")}</urlset>`);
  }, async (baseUrl) => {
    const result = await new SitemapParser({ maxUrls: 2 }).fetchSitemaps(baseUrl, []);
    assert.equal(result.urls.length, 2);
    assert.equal(result.truncated, true);
  });
});

test("fetchSitemaps segue sitemap index e coleta URLs dos filhos", async () => {
  await withServer((req, res) => {
    res.setHeader("Content-Type", "application/xml");
    if (req.url === "/sitemap.xml") {
      res.end(
        `<sitemapindex><sitemap><loc>http://127.0.0.1:${req.socket.localPort}/sitemap-products.xml</loc></sitemap><sitemap><loc>http://127.0.0.1:${req.socket.localPort}/sitemap-categories.xml</loc></sitemap></sitemapindex>`,
      );
      return;
    }
    if (req.url === "/sitemap-products.xml") {
      res.end(
        `<urlset><url><loc>http://127.0.0.1:${req.socket.localPort}/produto/1</loc></url><url><loc>http://127.0.0.1:${req.socket.localPort}/produto/2</loc></url></urlset>`,
      );
      return;
    }
    if (req.url === "/sitemap-categories.xml") {
      res.end(
        `<urlset><url><loc>http://127.0.0.1:${req.socket.localPort}/categoria/x</loc></url></urlset>`,
      );
      return;
    }
    res.statusCode = 404;
    res.end();
  }, async (baseUrl) => {
    const parser = new SitemapParser();
    const info = await parser.fetchSitemaps(baseUrl, [`${baseUrl}/sitemap.xml`]);

    assert.deepEqual(info.urls, [
      `${baseUrl}/produto/1`,
      `${baseUrl}/produto/2`,
      `${baseUrl}/categoria/x`,
    ]);
    assert.equal(info.source, `${baseUrl}/sitemap.xml`);
  });
});

test("fetchSitemaps tenta novamente quando a primeira requisição falha", async () => {
  let attempts = 0;
  await withServer((req, res) => {
    res.setHeader("Content-Type", "application/xml");
    attempts += 1;
    if (attempts === 1) {
      res.statusCode = 500;
      res.end("erro temporário");
      return;
    }
    res.end(
      `<urlset><url><loc>http://127.0.0.1:${req.socket.localPort}/produto/1</loc></url></urlset>`,
    );
  }, async (baseUrl) => {
    const parser = new SitemapParser();
    const info = await parser.fetchSitemaps(baseUrl, [`${baseUrl}/sitemap.xml`]);
    assert.deepEqual(info.urls, [`${baseUrl}/produto/1`]);
    assert.equal(info.source, `${baseUrl}/sitemap.xml`);
  });
});

test("fetchSitemaps não repete timeout e respeita o limite de descoberta", async () => {
  let slowAttempts = 0;
  await withServer((req, res) => {
    res.setHeader("Content-Type", "application/xml");
    if (req.url === "/sitemap.xml") {
      res.end(
        `<sitemapindex><sitemap><loc>http://127.0.0.1:${req.socket.localPort}/slow.xml</loc></sitemap></sitemapindex>`,
      );
      return;
    }
    slowAttempts += 1;
    setTimeout(() => res.end("<urlset></urlset>"), 250);
  }, async (baseUrl) => {
    const parser = new SitemapParser({
      fetchTimeoutMs: 40,
      discoveryBudgetMs: 100,
    });
    const startedAt = Date.now();
    const info = await parser.fetchSitemaps(baseUrl, [`${baseUrl}/sitemap.xml`]);

    assert.deepEqual(info.urls, []);
    assert.equal(slowAttempts, 1);
    assert.ok(Date.now() - startedAt < 200);
  });
});

test("fetchSitemaps consulta sitemaps filhos em paralelo", async () => {
  let active = 0;
  let peakActive = 0;
  await withServer((req, res) => {
    res.setHeader("Content-Type", "application/xml");
    if (req.url === "/sitemap.xml") {
      const children = [1, 2, 3, 4]
        .map(
          (id) =>
            `<sitemap><loc>http://127.0.0.1:${req.socket.localPort}/child-${id}.xml</loc></sitemap>`,
        )
        .join("");
      res.end(`<sitemapindex>${children}</sitemapindex>`);
      return;
    }
    active += 1;
    peakActive = Math.max(peakActive, active);
    setTimeout(() => {
      active -= 1;
      res.end("<urlset></urlset>");
    }, 30);
  }, async (baseUrl) => {
    const parser = new SitemapParser({ concurrency: 4 });
    await parser.fetchSitemaps(baseUrl, [`${baseUrl}/sitemap.xml`]);
    assert.equal(peakActive, 4);
  });
});
