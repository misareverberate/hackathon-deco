import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { createAppServer, validateProductionSecurity } from "../server.js";
import { CommerceAssistant } from "../src/agents/commerce/commerceAssistant.js";
import { GeoAgent } from "../src/agents/geo/geoAgent.js";
import type { LlmGateway } from "../src/llm/groq.js";

const offlineLlm: LlmGateway = {
  isConfigured: () => false,
  chatJson: async () => null,
};

interface StartedServer {
  server: http.Server;
  port: number;
  close: () => Promise<void>;
}

function listen(server: http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve((server.address() as AddressInfo).port);
    });
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function startAppServer(): Promise<StartedServer> {
  const server = createAppServer({
    geoAgent: new GeoAgent({ llm: offlineLlm }),
    commerceAssistant: new CommerceAssistant(offlineLlm),
  }, { allowPrivateNetworks: true });
  return listen(server).then((port) => ({
    server,
    port,
    close: () => closeServer(server),
  }));
}

function createFixtureSite() {
  const server = http.createServer((req, res) => {
    const base = `http://${req.headers.host}`;
    const path = new URL(req.url ?? "/", base).pathname;

    if (path === "/robots.txt") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(
        [
          "User-agent: *",
          "Allow: /",
          "",
          `Sitemap: ${base}/sitemap.xml`,
          "",
        ].join("\n"),
      );
      return;
    }

    if (path === "/sitemap.xml") {
      res.writeHead(200, { "Content-Type": "application/xml" });
      res.end(
        [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          `  <url><loc>${base}/</loc></url>`,
          `  <url><loc>${base}/produto/ssd-1tb</loc></url>`,
          "</urlset>",
        ].join("\n"),
      );
      return;
    }

    if (path === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        [
          "<!doctype html>",
          "<html lang='pt-BR'>",
          "<head><title>Loja Teste</title>",
          "<meta name='description' content='Loja de exemplo para testes.'>",
          "</head>",
          "<body>",
          "<h1>Loja Teste</h1>",
          "<a href='/produto/ssd-1tb'>SSD 1TB</a>",
          "</body>",
          "</html>",
        ].join("\n"),
      );
      return;
    }

    if (path === "/produto/ssd-1tb") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        [
          "<!doctype html>",
          "<html lang='pt-BR'>",
          "<head><title>SSD 1TB</title>",
          "<meta name='description' content='SSD 1TB de alta performance.'>",
          "</head>",
          "<body>",
          "<h1>SSD 1TB</h1>",
          "<p>R$ 499,90</p>",
          "<script type='application/ld+json'>",
          JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: "SSD 1TB",
            brand: { "@type": "Brand", name: "StoragePro" },
            offers: {
              "@type": "Offer",
              price: "499.90",
              priceCurrency: "BRL",
              availability: "https://schema.org/InStock",
            },
          }),
          "</script>",
          "</body>",
          "</html>",
        ].join("\n"),
      );
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  });

  return {
    server,
    start: () => listen(server),
    close: () => closeServer(server),
  };
}

interface NdjsonEvent {
  type: string;
  [key: string]: unknown;
}

function postAnalyze(
  port: number,
  body: unknown,
): Promise<{ status: number; events: NdjsonEvent[]; raw: string }> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/api/analyze",
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf-8");
          const events = raw
            .split("\n")
            .filter((line) => line.trim() !== "")
            .map((line) => JSON.parse(line) as NdjsonEvent);
          resolve({ status: response.statusCode ?? 0, events, raw });
        });
      },
    );
    request.on("error", reject);
    request.end(JSON.stringify(body));
  });
}

test("GET /api/health responde 200 e rota desconhecida responde 404", async () => {
  const app = await startAppServer();
  try {
    const health = await fetch(`http://127.0.0.1:${app.port}/api/health`);
    assert.equal(health.status, 200);
    const body = (await health.json()) as { ok: boolean };
    assert.equal(body.ok, true);

    const config = await fetch(`http://127.0.0.1:${app.port}/api/config`);
    assert.equal(config.status, 200);
    assert.deepEqual(await config.json(), { requiresApiKey: false });

    const auth = await fetch(`http://127.0.0.1:${app.port}/api/auth/verify`, {
      method: "POST",
    });
    assert.equal(auth.status, 200);

    const allowedOrigin = await fetch(`http://127.0.0.1:${app.port}/api/health`, {
      headers: { Origin: "http://localhost:5173" },
    });
    assert.equal(allowedOrigin.status, 200);
    assert.equal(allowedOrigin.headers.get("access-control-allow-origin"), "http://localhost:5173");
    assert.equal(allowedOrigin.headers.get("x-frame-options"), "DENY");

    const deniedOrigin = await fetch(`http://127.0.0.1:${app.port}/api/health`, {
      headers: { Origin: "https://evil.example" },
    });
    assert.equal(deniedOrigin.status, 403);

    const unknown = await fetch(`http://127.0.0.1:${app.port}/api/nao-existe`);
    assert.equal(unknown.status, 404);
  } finally {
    await app.close();
  }
});

test("configuração de produção exige chave forte e CORS explícito", () => {
  assert.throws(
    () => validateProductionSecurity(true, "", new Set(["https://app.example"])),
    /API_KEY é obrigatória/,
  );
  assert.throws(
    () => validateProductionSecurity(true, "curta", new Set(["https://app.example"])),
    /32 caracteres/,
  );
  assert.throws(
    () => validateProductionSecurity(true, "x".repeat(32), new Set(["*"])),
    /wildcard/,
  );
  assert.doesNotThrow(() =>
    validateProductionSecurity(true, "x".repeat(32), new Set(["https://app.example"])),
  );
});

test("POST /api/analyze valida corpo e campos de negócio com 400", async () => {
  const app = await startAppServer();
  try {
    const missing = await postAnalyze(app.port, {});
    assert.equal(missing.status, 400);
    assert.equal(missing.events[0].error, "Informe uma URL válida (http/https) no campo 'url'.");

    const invalidUrl = await postAnalyze(app.port, { url: "ftp://example.com" });
    assert.equal(invalidUrl.status, 400);

    const badBusiness = await postAnalyze(app.port, {
      url: "http://example.com",
      business: { avgTicket: -10 },
    });
    assert.equal(badBusiness.status, 400);
    assert.equal(
      badBusiness.events[0].error,
      "Campo 'business.avgTicket' deve ser um número positivo.",
    );

    const invalidConversion = await postAnalyze(app.port, {
      url: "http://example.com",
      business: { organicConversionRate: 2 },
    });
    assert.equal(invalidConversion.status, 400);
    assert.equal(
      invalidConversion.events[0].error,
      "Campo 'business.organicConversionRate' deve estar entre 0 e 1.",
    );

    const nonObjectBusiness = await postAnalyze(app.port, {
      url: "http://example.com",
      business: [1, 2],
    });
    assert.equal(nonObjectBusiness.status, 400);
    assert.equal(nonObjectBusiness.events[0].error, "Campo 'business' deve ser um objeto.");

    const badJson = await postAnalyze(app.port, "{not-json");
    assert.equal(badJson.status, 400);
  } finally {
    await app.close();
  }
});

test("API bloqueia redes privadas com a proteção SSRF ativa", async () => {
  const server = createAppServer(
    { geoAgent: new GeoAgent({ llm: offlineLlm }) },
    { allowPrivateNetworks: false },
  );
  const port = await listen(server);
  try {
    const result = await postAnalyze(port, { url: "http://127.0.0.1:8787" });
    assert.equal(result.status, 400);
    assert.match(String(result.events[0]?.error), /rede privada|reservada/);
  } finally {
    await closeServer(server);
  }
});

test("POST /api/analyze executa o pipeline completo com saída NDJSON", async () => {
  const fixture = createFixtureSite();
  const sitePort = await fixture.start();
  const app = await startAppServer();

  try {
    const result = await postAnalyze(app.port, {
      url: `http://127.0.0.1:${sitePort}`,
      business: {
        avgTicket: 500,
        organicConversionRate: 0.02,
        monthlyOrganicSessions: 30000,
        laborCostPerHour: 60,
      },
    });

    assert.equal(result.status, 200);

    const stages = result.events
      .filter((event) => event.type === "stage")
      .map((event) => event.stage);
    assert.deepEqual(stages, [
      "discovery",
      "crawl",
      "knowledge",
      "opportunities",
      "recommendations",
      "geo",
    ]);

    const progress = result.events.filter(
      (event) => event.type === "crawl-progress",
    );
    assert.ok(progress.length >= 1);

    const done = result.events.find((event) => event.type === "done");
    assert.ok(done, "evento 'done' deve ser emitido");
    assert.ok(done.at, "evento 'done' deve carregar timestamp");

    const report = done.report as Record<string, unknown>;
    const crawl = report.crawl as Record<string, unknown>;
    assert.ok((crawl.pages as number) >= 2, "deve rastrear ao menos 2 páginas");
    assert.ok((crawl.products as number) >= 1, "deve extrair ao menos 1 produto");
    const sitemap = crawl.sitemap as { count: number; urls: string[] };
    assert.equal(sitemap.count, 2);
    assert.ok(sitemap.urls.length <= 100);
    const timings = crawl.timings as Record<string, number>;
    assert.equal(typeof timings.robotsMs, "number");
    assert.equal(typeof timings.geoMs, "number");
    assert.equal(typeof timings.totalMs, "number");

    const recommendations = report.recommendations as unknown[];
    assert.ok(recommendations.length > 0, "deve gerar recomendações");

    assert.deepEqual(report.businessInput, {
      avgTicket: 500,
      organicConversionRate: 0.02,
      monthlyOrganicSessions: 30000,
      laborCostPerHour: 60,
    });

    const impact = report.impactEstimate as {
      aggregate?: {
        potentialMaximum?: {
          revenue?: { high: number };
          costAvoided?: { high: number };
        };
      };
    };
    assert.ok(
      (impact.aggregate?.potentialMaximum?.revenue?.high ?? 0) > 0,
      "conversão normalizada deve chegar ao estimador sem nova divisão",
    );
    assert.ok(
      (impact.aggregate?.potentialMaximum?.costAvoided?.high ?? 0) > 0,
      "custo evitado deve ser estimado com dados do cliente",
    );

    const geo = report.geo as { overallScore: number; llmEnabled: boolean };
    assert.equal(typeof geo.overallScore, "number");
    assert.equal(geo.llmEnabled, false);
    assert.ok((geo.overallScore >= 0) && (geo.overallScore <= 100));

    const zeroConversion = await postAnalyze(app.port, {
      url: `http://127.0.0.1:${sitePort}`,
      business: {
        avgTicket: 500,
        organicConversionRate: 0,
        monthlyOrganicSessions: 30000,
        laborCostPerHour: 60,
      },
    });
    assert.equal(zeroConversion.status, 200);
    const zeroDone = zeroConversion.events.find((event) => event.type === "done");
    assert.ok(zeroDone);
    const zeroReport = zeroDone.report as {
      businessInput: { organicConversionRate: number };
      impactEstimate: {
        aggregate?: { potentialMaximum?: { revenue?: { high: number } } };
      };
    };
    assert.equal(zeroReport.businessInput.organicConversionRate, 0);
    assert.equal(
      zeroReport.impactEstimate.aggregate?.potentialMaximum?.revenue?.high,
      0,
    );
  } finally {
    await app.close();
    await fixture.close();
  }
});

test("POST /api/analyze completa mesmo sem dados de negócio", async () => {
  const fixture = createFixtureSite();
  const sitePort = await fixture.start();
  const app = await startAppServer();

  try {
    const result = await postAnalyze(app.port, {
      url: `http://127.0.0.1:${sitePort}`,
    });

    assert.equal(result.status, 200);
    const done = result.events.find((event) => event.type === "done");
    assert.ok(done);
    const report = done.report as Record<string, unknown>;
    assert.equal(report.businessInput, undefined);
    assert.ok((report.recommendations as unknown[]).length > 0);
  } finally {
    await app.close();
    await fixture.close();
  }
});

test("POST /api/chat consulta as ferramentas da sessão da análise", async () => {
  const fixture = createFixtureSite();
  const sitePort = await fixture.start();
  const app = await startAppServer();

  try {
    const analysis = await postAnalyze(app.port, { url: `http://127.0.0.1:${sitePort}` });
    const done = analysis.events.find((event) => event.type === "done");
    assert.ok(done);
    const report = done.report as Record<string, unknown>;
    assert.equal(typeof report.analysisId, "string");
    assert.equal(typeof report.analysisAccessToken, "string");

    const denied = await fetch(`http://127.0.0.1:${app.port}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysisId: report.analysisId,
        message: "Como está a performance da análise?",
      }),
    });
    assert.equal(denied.status, 403);

    const response = await fetch(`http://127.0.0.1:${app.port}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Analysis-Token": String(report.analysisAccessToken),
      },
      body: JSON.stringify({
        analysisId: report.analysisId,
        message: "Como está a performance da análise?",
      }),
    });
    const body = (await response.json()) as { answer: string; tool: { tool: string } };
    assert.equal(response.status, 200);
    assert.equal(body.tool.tool, "analyze_performance");
    assert.match(body.answer, /páginas/);

    const recommendationId = (report.recommendations as Array<{ id: string }>)[0]?.id;
    assert.ok(recommendationId);
    const validation = await fetch(`http://127.0.0.1:${app.port}/api/validate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Analysis-Token": String(report.analysisAccessToken),
      },
      body: JSON.stringify({
        analysisId: report.analysisId,
        recommendationId,
      }),
    });
    const validationBody = (await validation.json()) as {
      status: string;
      pages: number;
      evidence: string;
    };
    assert.equal(validation.status, 200);
    assert.ok(["resolved", "still_present"].includes(validationBody.status));
    assert.ok(validationBody.pages >= 1);
    assert.ok(validationBody.evidence.length > 0);

    const reset = await fetch(`http://127.0.0.1:${app.port}/api/chat/reset`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Analysis-Token": String(report.analysisAccessToken),
      },
      body: JSON.stringify({ analysisId: report.analysisId }),
    });
    assert.equal(reset.status, 200);
    assert.deepEqual(await reset.json(), { ok: true });
  } finally {
    await app.close();
    await fixture.close();
  }
});

test("POST /api/apply gera artefato resolvido, re-simula o efeito e registra a decisão", async () => {
  const fixture = createFixtureSite();
  const sitePort = await fixture.start();
  const app = await startAppServer();

  try {
    const analysis = await postAnalyze(app.port, { url: `http://127.0.0.1:${sitePort}` });
    const done = analysis.events.find((event) => event.type === "done");
    assert.ok(done);
    const report = done.report as Record<string, unknown>;
    const automatic = (report.automaticActions as Array<{ id: string }>) ?? [];
    const recommendation = automatic[0] ?? (report.recommendations as Array<{ id: string }>)[0];
    assert.ok(recommendation?.id);

    const denied = await fetch(`http://127.0.0.1:${app.port}/api/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysisId: report.analysisId,
        recommendationId: recommendation.id,
      }),
    });
    assert.equal(denied.status, 403);

    const response = await fetch(`http://127.0.0.1:${app.port}/api/apply`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Analysis-Token": String(report.analysisAccessToken),
      },
      body: JSON.stringify({
        analysisId: report.analysisId,
        recommendationId: recommendation.id,
      }),
    });
    const body = (await response.json()) as {
      tool: string;
      data: {
        artifact: { content: string; kind: string };
        counterfactual: { simulatable: boolean; afterSuccessRate: number };
        decision: { status: string };
      };
    };
    assert.equal(response.status, 200);
    assert.equal(body.tool, "apply_action");
    assert.equal(body.data.decision.status, "accepted");
    assert.doesNotMatch(body.data.artifact.content, /\{\{/);
    assert.ok(body.data.artifact.content.length > 0);
    assert.equal(body.data.counterfactual.simulatable, true);
    assert.ok(body.data.counterfactual.afterSuccessRate >= 0);
  } finally {
    await app.close();
    await fixture.close();
  }
});

test("API recusa mensagem de chat excessiva e expõe request id", async () => {
  const app = await startAppServer();
  try {
    const health = await fetch(`http://127.0.0.1:${app.port}/api/health`, {
      headers: { "X-Request-Id": "test-request-id" },
    });
    assert.equal(health.headers.get("x-request-id"), "test-request-id");

    const response = await fetch(`http://127.0.0.1:${app.port}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysisId: "missing", message: "x".repeat(4_001) }),
    });
    assert.equal(response.status, 413);
  } finally {
    await app.close();
  }
});

test("POST /api/analyze é resiliente a falha de rede (completa com done)", async () => {
  const app = await startAppServer();
  try {
    const result = await postAnalyze(app.port, {
      url: "http://127.0.0.1:1",
      maxProducts: 1,
    });
    assert.equal(result.status, 200);
    const done = result.events.find((event) => event.type === "done");
    assert.ok(done, "o pipeline deve completar mesmo com site inacessível");
    const report = done.report as Record<string, unknown>;
    const crawl = report.crawl as { errors: unknown[] };
    assert.ok(crawl.errors.length > 0, "erros de rede devem ser registrados");
  } finally {
    await app.close();
  }
});

test("POST /api/analyze emite evento de erro quando um estágio falha", async () => {
  const failingCrawler = {
    crawl: async () => {
      throw new Error("boom interno");
    },
  };
  const server = createAppServer({
    crawler: failingCrawler as unknown as import("../src/crawler/crawler.js").CrawlerPipeline,
    geoAgent: new GeoAgent({ llm: offlineLlm }),
  }, { allowPrivateNetworks: true });
  const port = await listen(server);
  try {
    const result = await postAnalyze(port, { url: "http://example.com" });
    assert.equal(result.status, 200);
    const error = result.events.find((event) => event.type === "error");
    assert.ok(error, "evento de erro deve ser emitido");
    assert.equal(error.message, "A análise não pôde ser concluída. Consulte o identificador da requisição.");
  } finally {
    await closeServer(server);
  }
});

test("API limita análises simultâneas e libera a vaga ao finalizar", async () => {
  let release: ((error: Error) => void) | undefined;
  const blockingCrawler = {
    crawl: async () => await new Promise<never>((_resolve, reject) => {
      release = reject;
    }),
  };
  const server = createAppServer(
    {
      crawler: blockingCrawler as unknown as import("../src/crawler/crawler.js").CrawlerPipeline,
      geoAgent: new GeoAgent({ llm: offlineLlm }),
    },
    { maxConcurrentAnalyses: 1, allowPrivateNetworks: true },
  );
  const port = await listen(server);
  try {
    const first = await fetch(`http://127.0.0.1:${port}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "http://example.com" }),
    });
    const second = await fetch(`http://127.0.0.1:${port}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "http://example.com" }),
    });

    assert.equal(first.status, 200);
    assert.equal(second.status, 503);
    assert.equal(second.headers.get("retry-after"), "30");
    release?.(new Error("fim do teste"));
    await first.text();
  } finally {
    await closeServer(server);
  }
});

test("deadline da análise aborta o pipeline em andamento", async () => {
  const blockingCrawler = {
    crawl: async (
      _url: string,
      options: { signal?: AbortSignal },
    ) => await new Promise<never>((_resolve, reject) => {
      options.signal?.addEventListener(
        "abort",
        () => reject(options.signal?.reason),
        { once: true },
      );
    }),
  };
  const server = createAppServer(
    {
      crawler: blockingCrawler as unknown as import("../src/crawler/crawler.js").CrawlerPipeline,
      geoAgent: new GeoAgent({ llm: offlineLlm }),
    },
    { analysisTimeoutMs: 25, allowPrivateNetworks: true },
  );
  const port = await listen(server);
  try {
    const result = await postAnalyze(port, { url: "http://example.com" });
    const error = result.events.find((event) => event.type === "error");
    assert.ok(error);
     assert.equal(error.message, "A análise excedeu o tempo limite ou foi cancelada.");
   } finally {
     await closeServer(server);
   }
 });

test("GET /api/docs e /api/openai.json são públicos e servem a documentação", async () => {
   const app = await startAppServer();
   try {
     const docs = await fetch(`http://127.0.0.1:${app.port}/api/docs`);
     assert.equal(docs.status, 200);
     assert.equal(docs.headers.get("content-type"), "text/html; charset=utf-8");
     const html = await docs.text();
     assert.match(html, /swagger-ui/i);
     assert.match(html, /openapi\.json/);

     const spec = await fetch(`http://127.0.0.1:${app.port}/api/openapi.json`);
     assert.equal(spec.status, 200);
     assert.equal(spec.headers.get("content-type"), "application/json; charset=utf-8");
     const parsed = (await spec.json()) as { openapi: string; paths: Record<string, unknown> };
     assert.equal(parsed.openapi, "3.0.3");
     assert.ok(parsed.paths["/api/analyze"], "especificação deve incluir o endpoint de análise");
     assert.ok(parsed.paths["/api/chat"], "especificação deve incluir o endpoint de chat");
   } finally {
     await app.close();
   }
 });
