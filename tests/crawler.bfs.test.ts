import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { CrawlerPipeline } from "../src/crawler/crawler.js";

interface Fixture {
  baseUrl: string;
  requested: string[];
  close: () => void;
}

async function buildFixture(): Promise<Fixture> {
  const requested: string[] = [];

  const server = http.createServer((req, res) => {
    requested.push(req.url ?? "/");
    res.setHeader("Content-Type", "text/html; charset=utf-8");

    if (req.url === "/robots.txt") {
      res.end("User-agent: *\nDisallow: /admin\n");
      return;
    }
    if (req.url === "/sitemap.xml") {
      res.end(`<urlset></urlset>`);
      return;
    }
    if (req.url === "/") {
      res.end(`<!doctype html><html><body>
        <a href="/categorias/acessorios/">Acessórios</a>
        <a href="/sobre/">Sobre</a>
        <a href="/admin/config">Admin</a>
        <a href="https://external-site.com/produto/1">Fora do host</a>
      </body></html>`);
      return;
    }
    if (req.url === "/categorias/acessorios/") {
      res.end(`<!doctype html><html><head><title>Acessórios</title></head><body>
        <a href="/categorias/cadeiras/">Cadeiras</a>
      </body></html>`);
      return;
    }
    if (req.url === "/categorias/cadeiras/") {
      res.end(`<!doctype html><html><head><title>Cadeiras</title></head><body></body></html>`);
      return;
    }
    if (req.url === "/sobre/") {
      res.end(`<!doctype html><html><head><title>Sobre</title></head><body></body></html>`);
      return;
    }
    res.statusCode = 404;
    res.end("not found");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port =
    address !== null && typeof address === "object" ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    requested,
    close: () => server.close(),
  };
}

test("descobre categorias e páginas institucionais pelos links, respeitando robots e host", async () => {
  const fixture = await buildFixture();

  try {
    const crawler = new CrawlerPipeline({ maxPages: 20 });
    const snapshot = await crawler.crawl(fixture.baseUrl);

    const urls = snapshot.pages.map((page) => page.url);

    assert.ok(
      urls.includes(`${fixture.baseUrl}/categorias/acessorios/`),
      "categoria acessorios deveria ter sido visitada via link da homepage",
    );
    assert.ok(
      urls.includes(`${fixture.baseUrl}/categorias/cadeiras/`),
      "categoria cadeiras deveria ter sido visitada via link da categoria",
    );
    assert.ok(
      urls.includes(`${fixture.baseUrl}/sobre/`),
      "página institucional deveria ter sido visitada",
    );
    assert.ok(
      !urls.some((url) => url.includes("/admin")),
      "URLs bloqueadas pelo robots não deveriam ser visitadas",
    );
    assert.ok(
      !fixture.requested.includes("/admin/config"),
      "o servidor não deveria receber requisições a /admin/config",
    );

    const homepage = snapshot.pages.find((page) => page.type === "homepage");
    assert.ok(homepage);
    assert.ok(
      homepage.links?.includes(`${fixture.baseUrl}/categorias/acessorios/`),
      "links internos da homepage deveriam ser extraídos",
    );

    const categoryTitles = snapshot.categories.map((category) => category.name);
    assert.ok(categoryTitles.includes("Acessórios"));
    assert.ok(categoryTitles.includes("Cadeiras"));

    const categories = snapshot.pages.filter(
      (page) => page.type === "category",
    );
    assert.equal(categories.length, 2);
  } finally {
    fixture.close();
  }
});

test("limita o total de páginas visitadas pelo maxPages", async () => {
  const server = http.createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end("<!doctype html><html><body></body></html>");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const port =
    address !== null && typeof address === "object" ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const crawler = new CrawlerPipeline({ maxPages: 3 });
    const snapshot = await crawler.crawl(baseUrl);
    assert.ok(snapshot.pages.length <= 3);
  } finally {
    server.close();
  }
});

test("emite progresso incremental conforme cada página termina", async () => {
  const fixture = await buildFixture();
  const progress: Array<{ pages: number; discovered: number; total: number }> = [];
  try {
    const snapshot = await new CrawlerPipeline({ maxPages: 20 }).crawl(
      fixture.baseUrl,
      { onProgress: (event) => progress.push(event) },
    );

    assert.equal(progress.length, snapshot.pages.length);
    assert.deepEqual(progress.map((event) => event.pages), [1, 2, 3, 4]);
    assert.ok(progress.every((event) => event.discovered >= event.pages));
    assert.equal(progress.at(-1)?.total, 4);
  } finally {
    fixture.close();
  }
});

test("erro no consumidor de progresso não interrompe o crawl", async () => {
  const fixture = await buildFixture();
  try {
    const snapshot = await new CrawlerPipeline({ maxPages: 20 }).crawl(
      fixture.baseUrl,
      { onProgress: () => { throw new Error("painel desmontado"); } },
    );

    assert.equal(snapshot.pages.length, 4);
    assert.ok(snapshot.errors.some((error) => error.includes("Callback de progresso falhou")));
  } finally {
    fixture.close();
  }
});

test("onProgress e signal do construtor valem como padrão e o override do crawl vence", async () => {
  const fixture = await buildFixture();
  const fromConstructor: Array<{ pages: number; total: number }> = [];
  const fromCall: Array<{ pages: number; total: number }> = [];
  try {
    const crawler = new CrawlerPipeline({
      maxPages: 20,
      onProgress: (event) => fromConstructor.push(event),
    });
    const snapshot = await crawler.crawl(fixture.baseUrl);

    assert.equal(fromConstructor.length, snapshot.pages.length);
    assert.deepEqual(fromConstructor.map((event) => event.pages), [1, 2, 3, 4]);

    await crawler.crawl(fixture.baseUrl, {
      onProgress: (event) => fromCall.push(event),
    });
    assert.equal(fromCall.length, 4);
    assert.equal(fromConstructor.length, 4);
  } finally {
    fixture.close();
  }
});

test("signal do construtor aborta o crawl quando disparado", async () => {
  const fixture = await buildFixture();
  const controller = new AbortController();
  try {
    const crawler = new CrawlerPipeline({
      maxPages: 20,
      signal: controller.signal,
    });
    controller.abort(new Error("cancelado pelo operador"));
    await assert.rejects(crawler.crawl(fixture.baseUrl));
  } finally {
    fixture.close();
  }
});
