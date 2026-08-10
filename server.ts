import http from "node:http";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { CrawlerPipeline, type CrawlProgress } from "./src/crawler/crawler.js";
import { KnowledgeBuilder } from "./src/knowledge/knowledgeBuilder.js";
import { OpportunityAnalyzer } from "./src/agents/opportunities/opportunityAnalyzer.js";
import { RecommendationEngine } from "./src/recommendation/recommendationEngine.js";
import { GeoAgent } from "./src/agents/geo/geoAgent.js";
import { buildProductSamples } from "./src/report/productSamples.js";
import type { RecommendationReport } from "./src/recommendation/types.js";
import type { ClientBusinessInput } from "./src/recommendation/types.js";
import type { ImpactConfig } from "./src/recommendation/config/impactConfig.js";
import { buildBusinessConfig } from "./src/recommendation/config/impactConfig.js";
import {
  CommerceAssistant,
  type AssistantSession,
} from "./src/agents/commerce/commerceAssistant.js";
import { assertPublicTargetUrl } from "./src/utils/http.js";
import { resolveSecret } from "./src/config/env.js";

export interface AppDeps {
  crawler?: CrawlerPipeline;
  knowledgeBuilder?: KnowledgeBuilder;
  opportunityAnalyzer?: OpportunityAnalyzer;
  recommendationEngine?: RecommendationEngine;
  geoAgent?: GeoAgent;
  commerceAssistant?: CommerceAssistant;
}

export interface AppServerOptions {
  maxConcurrentAnalyses?: number;
  maxConcurrentChats?: number;
  analysisTimeoutMs?: number;
  chatTimeoutMs?: number;
  allowPrivateNetworks?: boolean;
}

interface ResolvedDeps {
  crawler: CrawlerPipeline;
  knowledgeBuilder: KnowledgeBuilder;
  opportunityAnalyzer: OpportunityAnalyzer;
  recommendationEngine: RecommendationEngine;
  geoAgent: GeoAgent;
  commerceAssistant: CommerceAssistant;
}

function envInteger(name: string, fallback: number, min: number, max: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed)
    ? Math.min(max, Math.max(min, Math.floor(parsed)))
    : fallback;
}

const MAX_SESSIONS = envInteger("MAX_SESSIONS", 20, 1, 1_000);
const MAX_SESSION_MEMORY_MB = envInteger("MAX_SESSION_MEMORY_MB", 256, 32, 4_096);
const SESSION_TTL_MS = envInteger("SESSION_TTL_MS", 60 * 60 * 1000, 60_000, 86_400_000);
const MAX_BODY_BYTES = envInteger("MAX_BODY_BYTES", 1_000_000, 1_024, 10_000_000);
const RATE_LIMIT_PER_MINUTE = envInteger("RATE_LIMIT_PER_MINUTE", 30, 1, 10_000);
const MAX_CONCURRENT_ANALYSES = envInteger("MAX_CONCURRENT_ANALYSES", 2, 1, 100);
const MAX_CONCURRENT_CHATS = envInteger("MAX_CONCURRENT_CHATS", 4, 1, 100);
const ANALYSIS_TIMEOUT_MS = envInteger("ANALYSIS_TIMEOUT_MS", 240_000, 10_000, 900_000);
const CHAT_TIMEOUT_MS = envInteger("CHAT_TIMEOUT_MS", 60_000, 5_000, 180_000);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const CORS_ORIGINS = new Set(
  (process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN ??
    (IS_PRODUCTION ? "" : "http://localhost:5173,http://127.0.0.1:5173"))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const API_KEY = process.env.API_KEY?.trim() || "";
const ALLOW_PRIVATE_NETWORKS =
  !IS_PRODUCTION && resolveSecret("ALLOW_PRIVATE_NETWORKS") === "true";
const TRUST_PROXY_HOPS = envInteger("TRUST_PROXY_HOPS", 0, 0, 10);

class HttpError extends Error {
  constructor(public readonly statusCode: number, message: string) {
    super(message);
  }
}

function sessionBytes(session: AssistantSession): number {
  return session.sizeBytes ?? Buffer.byteLength(JSON.stringify(session), "utf8");
}

function totalSessionBytes(sessions: Map<string, AssistantSession>): number {
  let total = 0;
  for (const session of sessions.values()) total += sessionBytes(session);
  return total;
}

function hashSecret(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function secretsEqual(left: string, right: string): boolean {
  const leftHash = Buffer.from(hashSecret(left), "hex");
  const rightHash = Buffer.from(hashSecret(right), "hex");
  return timingSafeEqual(leftHash, rightHash);
}

function secretMatchesHash(value: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashSecret(value), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function requestIdOf(res: http.ServerResponse): string {
  return String(res.getHeader("X-Request-Id") ?? "unknown");
}

function logInternalError(
  res: http.ServerResponse,
  context: string,
  error: unknown,
): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${requestIdOf(res)}] ${context}: ${message}`);
}

function applyCors(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-API-Key, X-Analysis-Token, X-Request-Id",
  );
  if (!origin) return true;
  if (!CORS_ORIGINS.has(origin)) return false;
  res.setHeader("Access-Control-Allow-Origin", origin);
  return true;
}

function clientAddress(req: http.IncomingMessage): string {
  if (TRUST_PROXY_HOPS > 0) {
    const forwarded = req.headers["x-forwarded-for"];
    const chain = (Array.isArray(forwarded) ? forwarded.join(",") : forwarded)
      ?.split(",")
      .map((address) => address.trim())
      .filter(Boolean);
    const trustedClient = chain?.at(-TRUST_PROXY_HOPS);
    if (trustedClient) return trustedClient.slice(0, 100);
  }
  return req.socket.remoteAddress ?? "unknown";
}

export function validateProductionSecurity(
  production: boolean,
  apiKey: string,
  corsOrigins: ReadonlySet<string>,
): void {
  if (!production) return;
  if (!apiKey) throw new Error("API_KEY é obrigatória em produção.");
  if (apiKey.length < 32) {
    throw new Error("API_KEY deve possuir ao menos 32 caracteres em produção.");
  }
  if (corsOrigins.size === 0) {
    throw new Error("CORS_ORIGINS é obrigatória em produção.");
  }
  if (corsOrigins.has("*")) {
    throw new Error("CORS_ORIGINS não pode conter wildcard em produção.");
  }
}

function resolveDeps(deps: AppDeps = {}): ResolvedDeps {
  return {
    crawler: deps.crawler ?? new CrawlerPipeline(),
    knowledgeBuilder: deps.knowledgeBuilder ?? new KnowledgeBuilder(),
    opportunityAnalyzer: deps.opportunityAnalyzer ?? new OpportunityAnalyzer(),
    recommendationEngine: deps.recommendationEngine ?? new RecommendationEngine(),
    geoAgent: deps.geoAgent ?? new GeoAgent(),
    commerceAssistant: deps.commerceAssistant ?? new CommerceAssistant(),
  };
}

function isMainModule(): boolean {
  return (
    process.argv[1] !== undefined &&
    fileURLToPath(import.meta.url) === process.argv[1]
  );
}

const PORT = Number(process.env.PORT ?? 8787);

function sendJson(
  res: http.ServerResponse,
  statusCode: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

function sendEvent(res: http.ServerResponse, event: unknown): void {
  if (!res.destroyed && !res.writableEnded) {
    res.write(`${JSON.stringify(event)}\n`);
  }
}

function startStream(res: http.ServerResponse): void {
  res.on("error", () => {});
  res.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
}

function isValidUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") {
    return false;
  }
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function readBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let rejected = false;
    req.on("data", (chunk: Buffer) => {
      if (rejected) return;
      totalBytes += chunk.length;
      if (totalBytes > MAX_BODY_BYTES) {
        rejected = true;
        reject(new HttpError(413, `Corpo excede o limite de ${MAX_BODY_BYTES} bytes.`));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (rejected) return;
      if (chunks.length === 0) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

async function assertSafeTargetUrl(rawUrl: string): Promise<void> {
  try {
    await assertPublicTargetUrl(rawUrl);
  } catch (error) {
    throw new HttpError(
      400,
      error instanceof Error ? error.message : "Destino de rede não permitido.",
    );
  }
}

function parsePositiveNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Campo '${field}' deve ser um número positivo.`);
  }
  return value;
}

function parseNonNegativeNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Campo '${field}' deve ser um número maior ou igual a zero.`);
  }
  return value;
}

function parseBusinessInput(raw: unknown): ClientBusinessInput {
  if (raw === null || raw === undefined) {
    return {};
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Campo 'business' deve ser um objeto.");
  }
  const source = raw as Record<string, unknown>;
  const input: ClientBusinessInput = {};

  if (source.avgTicket !== undefined) {
    input.avgTicket = parsePositiveNumber(source.avgTicket, "business.avgTicket");
  }
  if (source.organicConversionRate !== undefined) {
    const rate = parseNonNegativeNumber(
      source.organicConversionRate,
      "business.organicConversionRate",
    );
    if (rate > 1) {
      throw new Error(
        "Campo 'business.organicConversionRate' deve estar entre 0 e 1.",
      );
    }
    input.organicConversionRate = rate;
  }
  if (source.monthlyOrganicSessions !== undefined) {
    input.monthlyOrganicSessions = parsePositiveNumber(
      source.monthlyOrganicSessions,
      "business.monthlyOrganicSessions",
    );
  }
  if (source.laborCostPerHour !== undefined) {
    input.laborCostPerHour = parsePositiveNumber(
      source.laborCostPerHour,
      "business.laborCostPerHour",
    );
  }
  if (
    source.currency !== undefined &&
    typeof source.currency === "string" &&
    source.currency.trim() !== ""
  ) {
    input.currency = source.currency.trim().toUpperCase();
  }
  return input;
}

async function handleAnalyze(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  deps: ResolvedDeps,
  sessions: Map<string, AssistantSession>,
  blockPrivateNetworks: boolean,
  signal: AbortSignal,
): Promise<void> {
  let body: unknown;
  try {
    body = await readBody(req);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, error instanceof HttpError ? error.statusCode : 400, { error: message });
    return;
  }

  let business: ClientBusinessInput;
  try {
    business = parseBusinessInput(
      (body as { business?: unknown } | undefined)?.business,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, 400, { error: message });
    return;
  }

  const url = (body as { url?: unknown } | undefined)?.url;
  if (!isValidUrl(url)) {
    sendJson(res, 400, {
      error: "Informe uma URL válida (http/https) no campo 'url'.",
    });
    return;
  }
  try {
    if (blockPrivateNetworks) await assertSafeTargetUrl(url);
  } catch (error) {
    sendJson(res, error instanceof HttpError ? error.statusCode : 400, {
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  const rawMaxProducts = (body as { maxProducts?: unknown } | undefined)
    ?.maxProducts;
  const maxProducts =
    typeof rawMaxProducts === "number" && Number.isFinite(rawMaxProducts)
      ? Math.min(1_000, Math.max(1, Math.floor(rawMaxProducts)))
      : undefined;

  const config: ImpactConfig = buildBusinessConfig(business);

  const emitStage = (stage: string, label: string): void => {
    sendEvent(res, { type: "stage", stage, label, at: Date.now() });
  };

  startStream(res);

  try {
    const startedAt = Date.now();
    signal.throwIfAborted();

    let crawlStageSent = false;
    const emitCrawlStage = (): void => {
      if (crawlStageSent) {
        return;
      }
      crawlStageSent = true;
      emitStage("crawl", "Crawling e extração");
    };

    emitStage("discovery", "Coleta de robots.txt e sitemap");
    const snapshot = await deps.crawler.crawl(url, {
      maxProducts,
      onProgress: (progress: CrawlProgress) => {
        emitCrawlStage();
        sendEvent(res, {
          type: "crawl-progress",
          pages: progress.pages,
          products: progress.products,
          discovered: progress.discovered,
          total: progress.total,
          at: Date.now(),
        });
      },
      signal,
      blockPrivateNetworks,
    });
    emitCrawlStage();
    const crawlDurationMs = Date.now() - startedAt;

    const pagesByType = snapshot.pages.reduce<Record<string, number>>(
      (acc, page) => {
        acc[page.type] = (acc[page.type] ?? 0) + 1;
        return acc;
      },
      {},
    );

    emitStage("knowledge", "Montagem do Knowledge Graph");
    const knowledgeStartedAt = Date.now();
    const knowledge = deps.knowledgeBuilder.build(snapshot);
    const knowledgeMs = Date.now() - knowledgeStartedAt;

    emitStage("opportunities", "Análise de oportunidades (SEO · GEO · Schema)");
    const opportunitiesStartedAt = Date.now();
    const opportunityReport = deps.opportunityAnalyzer.analyze(knowledge);
    const opportunitiesMs = Date.now() - opportunitiesStartedAt;

    emitStage("recommendations", "Priorização e roadmap");
    const recommendationsStartedAt = Date.now();
    const report: RecommendationReport = deps.recommendationEngine.run(
      knowledge,
      opportunityReport,
      config,
    );
    const recommendationsMs = Date.now() - recommendationsStartedAt;

    emitStage("geo", "Simulação de compradores (GEO)");
    const geoReport = await deps.geoAgent.run(knowledge, signal);

    const analysisId = randomUUID();
    const analysisAccessToken = randomBytes(32).toString("base64url");
    const responseReport = {
      ...report,
      analyzedAt: new Date().toISOString(),
      businessInput:
        Object.keys(business).length > 0 ? business : undefined,
      geo: {
        overallScore: geoReport.overallScore,
        successRate: geoReport.successRate,
        llmEnabled: geoReport.llmEnabled,
        categoryScores: geoReport.categoryScores,
        personaScores: geoReport.personaScores,
        questionsTested: geoReport.questionsTested,
        evaluations: geoReport.details.evaluations,
        recommendations: geoReport.recommendations,
        journeys: geoReport.journeys,
        simulationErrors: geoReport.simulationErrors,
        simulationMeta: geoReport.simulationMeta,
      },
      samples: buildProductSamples(knowledge),
      crawl: {
        pages: snapshot.pages.length,
        products: snapshot.products.length,
        catalogCount: snapshot.catalogCount ?? 0,
        pagesByType,
        categories: {
          count: snapshot.categories.length,
          names: snapshot.categories.slice(0, 20).map((category) => category.name),
        },
        sitemap: {
          source: snapshot.sitemap.source,
          count: snapshot.sitemap.urls.length,
          urls: snapshot.sitemap.urls.slice(0, 100),
          truncated: snapshot.sitemap.truncated ?? false,
        },
        crawlDurationMs,
        timings: {
          ...snapshot.timings,
          knowledgeMs,
          opportunitiesMs,
          recommendationsMs,
          geoMs: geoReport.simulationMeta.durationMs,
          totalMs: Date.now() - startedAt,
        },
        errors: snapshot.errors,
      },
    };

    const assistantSession: AssistantSession = {
      id: analysisId,
      accessTokenHash: hashSecret(analysisAccessToken),
      knowledge,
      report,
      crawl: responseReport.crawl,
      geo: responseReport.geo,
      createdAt: Date.now(),
    };
    assistantSession.sizeBytes = sessionBytes(assistantSession);
    sessions.set(analysisId, assistantSession);
    const maxSessionBytes = MAX_SESSION_MEMORY_MB * 1024 * 1024;
    while (
      sessions.size > MAX_SESSIONS ||
      totalSessionBytes(sessions) > maxSessionBytes
    ) {
      const oldest = sessions.keys().next().value;
      if (oldest) sessions.delete(oldest);
      else break;
    }

    sendEvent(res, {
      type: "done",
      at: Date.now(),
      analysisId,
      report: { ...responseReport, analysisId, analysisAccessToken },
    });
  } catch (error) {
    if (signal.aborted && res.destroyed) return;
    logInternalError(res, "analysis failed", error);
    sendEvent(res, {
      type: "error",
      at: Date.now(),
      message: signal.aborted
        ? "A análise excedeu o tempo limite ou foi cancelada."
        : "A análise não pôde ser concluída. Consulte o identificador da requisição.",
    });
  } finally {
    res.end();
  }
}

async function handleChat(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  sessions: Map<string, AssistantSession>,
  assistant: CommerceAssistant,
  busySessions: Set<string>,
  signal: AbortSignal,
): Promise<void> {
  let body: unknown;
  try {
    body = await readBody(req);
  } catch (error) {
    sendJson(res, error instanceof HttpError ? error.statusCode : 400, { error: error instanceof Error ? error.message : String(error) });
    return;
  }
  const input = body as { analysisId?: unknown; message?: unknown } | undefined;
  if (typeof input?.analysisId !== "string" || typeof input.message !== "string" || input.message.trim() === "") {
    sendJson(res, 400, { error: "Informe 'analysisId' e uma mensagem não vazia." });
    return;
  }
  if (input.message.length > 4_000) {
    sendJson(res, 413, { error: "Mensagem excede o limite de 4.000 caracteres." });
    return;
  }
  const session = sessions.get(input.analysisId);
  if (!session || Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(input.analysisId);
    sendJson(res, 404, { error: "Análise não encontrada ou expirada. Execute uma nova análise." });
    return;
  }
  const providedToken = req.headers["x-analysis-token"];
  if (
    typeof providedToken !== "string" ||
    !session.accessTokenHash ||
    !secretMatchesHash(providedToken, session.accessTokenHash)
  ) {
    sendJson(res, 403, { error: "Token de acesso da análise ausente ou inválido." });
    return;
  }
  if (busySessions.has(input.analysisId)) {
    sendJson(res, 409, { error: "Esta análise já possui uma operação do agente em andamento." });
    return;
  }
  busySessions.add(input.analysisId);
  try {
    const response = await assistant.answer(session, input.message.trim(), signal);
    session.sizeBytes = Buffer.byteLength(JSON.stringify(session), "utf8");
    sendJson(res, 200, response);
  } catch (error) {
    if (signal.aborted && res.destroyed) return;
    logInternalError(res, "assistant failed", error);
    sendJson(res, signal.aborted ? 504 : 500, {
      error: signal.aborted
        ? "A interação com o agente excedeu o tempo limite."
        : "O agente não pôde concluir a operação.",
    });
  } finally {
    busySessions.delete(input.analysisId);
  }
}

async function handleResetChat(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  sessions: Map<string, AssistantSession>,
): Promise<void> {
  try {
    const body = await readBody(req) as { analysisId?: unknown } | undefined;
    if (typeof body?.analysisId !== "string") {
      sendJson(res, 400, { error: "Informe 'analysisId'." });
      return;
    }
    const session = sessions.get(body.analysisId);
    if (!session || Date.now() - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(body.analysisId);
      sendJson(res, 404, { error: "Análise não encontrada ou expirada." });
      return;
    }
    const providedToken = req.headers["x-analysis-token"];
    if (
      typeof providedToken !== "string" ||
      !session.accessTokenHash ||
      !secretMatchesHash(providedToken, session.accessTokenHash)
    ) {
      sendJson(res, 403, { error: "Token de acesso da análise ausente ou inválido." });
      return;
    }
    session.conversation = [];
    session.sizeBytes = Buffer.byteLength(JSON.stringify(session), "utf8");
    sendJson(res, 200, { ok: true });
  } catch (error) {
    sendJson(res, error instanceof HttpError ? error.statusCode : 400, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function handleApply(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  sessions: Map<string, AssistantSession>,
  assistant: CommerceAssistant,
  busySessions: Set<string>,
  signal: AbortSignal,
): Promise<void> {
  let body: unknown;
  try {
    body = await readBody(req);
  } catch (error) {
    sendJson(res, error instanceof HttpError ? error.statusCode : 400, { error: error instanceof Error ? error.message : String(error) });
    return;
  }
  const input = body as { analysisId?: unknown; recommendationId?: unknown } | undefined;
  if (typeof input?.analysisId !== "string" || typeof input.recommendationId !== "string" || input.recommendationId.trim() === "") {
    sendJson(res, 400, { error: "Informe 'analysisId' e 'recommendationId'." });
    return;
  }
  const session = sessions.get(input.analysisId);
  if (!session || Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(input.analysisId);
    sendJson(res, 404, { error: "Análise não encontrada ou expirada. Execute uma nova análise." });
    return;
  }
  const providedToken = req.headers["x-analysis-token"];
  if (
    typeof providedToken !== "string" ||
    !session.accessTokenHash ||
    !secretMatchesHash(providedToken, session.accessTokenHash)
  ) {
    sendJson(res, 403, { error: "Token de acesso da análise ausente ou inválido." });
    return;
  }
  if (busySessions.has(input.analysisId)) {
    sendJson(res, 409, { error: "Esta análise já possui uma operação do agente em andamento." });
    return;
  }
  busySessions.add(input.analysisId);
  try {
    const response = await assistant.applyAction(session, input.recommendationId, signal);
    session.sizeBytes = Buffer.byteLength(JSON.stringify(session), "utf8");
    sendJson(res, 200, response);
  } catch (error) {
    if (signal.aborted && res.destroyed) return;
    logInternalError(res, "apply failed", error);
    sendJson(res, signal.aborted ? 504 : 500, {
      error: signal.aborted
        ? "A aplicação excedeu o tempo limite."
        : "A aplicação não pôde ser concluída.",
    });
  } finally {
    busySessions.delete(input.analysisId);
  }
}

async function handleValidate(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  sessions: Map<string, AssistantSession>,
  deps: ResolvedDeps,
  blockPrivateNetworks: boolean,
  signal: AbortSignal,
): Promise<void> {
  try {
    const body = await readBody(req) as { analysisId?: unknown; recommendationId?: unknown } | undefined;
    if (typeof body?.analysisId !== "string" || typeof body.recommendationId !== "string") {
      sendJson(res, 400, { error: "Informe 'analysisId' e 'recommendationId'." });
      return;
    }
    const session = sessions.get(body.analysisId);
    if (!session || Date.now() - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(body.analysisId);
      sendJson(res, 404, { error: "Análise não encontrada ou expirada." });
      return;
    }
    const providedToken = req.headers["x-analysis-token"];
    if (
      typeof providedToken !== "string" ||
      !session.accessTokenHash ||
      !secretMatchesHash(providedToken, session.accessTokenHash)
    ) {
      sendJson(res, 403, { error: "Token de acesso da análise ausente ou inválido." });
      return;
    }
    const recommendation = session.report.recommendations.find((item) => item.id === body.recommendationId);
    if (!recommendation) {
      sendJson(res, 404, { error: "Recomendação não encontrada nesta análise." });
      return;
    }
    const snapshot = await deps.crawler.crawl(session.knowledge.site.baseUrl, {
      maxProducts: Math.min(50, Math.max(1, recommendation.affectedProducts ?? 10)),
      signal,
      blockPrivateNetworks,
    });
    const knowledge = deps.knowledgeBuilder.build(snapshot);
    const opportunityReport = deps.opportunityAnalyzer.analyze(knowledge);
    const remaining = opportunityReport.opportunities.find(
      (item) => item.id === recommendation.opportunityId,
    );
    sendJson(res, 200, {
      recommendationId: recommendation.id,
      status: remaining ? "still_present" : "resolved",
      checkedAt: new Date().toISOString(),
      pages: snapshot.pages.length,
      products: snapshot.products.length,
      evidence: remaining?.reason ?? `A oportunidade “${recommendation.title}” não foi detectada no novo crawl.`,
    });
  } catch (error) {
    if (signal.aborted && res.destroyed) return;
    logInternalError(res, "validation failed", error);
    sendJson(res, signal.aborted ? 504 : 500, {
      error: signal.aborted
        ? "A revalidação excedeu o tempo limite."
        : "A revalidação não pôde ser concluída.",
    });
  }
}

export function createAppServer(
  deps: AppDeps = {},
  options: AppServerOptions = {},
): http.Server {
  validateProductionSecurity(IS_PRODUCTION, API_KEY, CORS_ORIGINS);
  const resolved = resolveDeps(deps);
  const maxConcurrentAnalyses =
    options.maxConcurrentAnalyses ?? MAX_CONCURRENT_ANALYSES;
  const analysisTimeoutMs = options.analysisTimeoutMs ?? ANALYSIS_TIMEOUT_MS;
  const chatTimeoutMs = options.chatTimeoutMs ?? CHAT_TIMEOUT_MS;
  const maxConcurrentChats = options.maxConcurrentChats ?? MAX_CONCURRENT_CHATS;
  const allowPrivateNetworks = options.allowPrivateNetworks ?? ALLOW_PRIVATE_NETWORKS;
  const blockPrivateNetworks = IS_PRODUCTION || !allowPrivateNetworks;
  const sessions = new Map<string, AssistantSession>();
  const busySessions = new Set<string>();
  const rateLimits = new Map<string, { startedAt: number; count: number }>();
  let activeAnalyses = 0;
  let activeChats = 0;

  const server = http.createServer((req, res) => {
    const requestId =
      typeof req.headers["x-request-id"] === "string"
        ? req.headers["x-request-id"].slice(0, 100)
        : randomUUID();
    res.setHeader("X-Request-Id", requestId);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
    if (IS_PRODUCTION) {
      res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }
    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    );
    const path = url.pathname.replace(/\/+$/, "") || "/";

    const corsAllowed = applyCors(req, res);
    if (!corsAllowed) {
      sendJson(res, 403, { error: "Origem não permitida.", requestId });
      return;
    }

    if (req.method === "OPTIONS") {
      sendJson(res, 204, {});
      return;
    }

    if (req.method === "POST" && path.startsWith("/api/")) {
      const client = clientAddress(req);
      const now = Date.now();
      const current = rateLimits.get(client);
      const bucket = !current || now - current.startedAt >= 60_000
        ? { startedAt: now, count: 0 }
        : current;
      bucket.count += 1;
      rateLimits.set(client, bucket);
      if (bucket.count > RATE_LIMIT_PER_MINUTE) {
        res.setHeader("Retry-After", "60");
        sendJson(res, 429, { error: "Limite de requisições excedido.", requestId });
        return;
      }
    }

    if (
      API_KEY &&
      path.startsWith("/api/") &&
      path !== "/api/health" &&
      path !== "/api/config" &&
      path !== "/api/openapi.json" &&
      path !== "/api/docs"
    ) {
      const providedApiKey = req.headers["x-api-key"];
      if (typeof providedApiKey !== "string" || !secretsEqual(providedApiKey, API_KEY)) {
        sendJson(res, 401, { error: "Credencial de API ausente ou inválida.", requestId });
        return;
      }
    }

    if (req.method === "GET" && path === "/api/health") {
      sendJson(res, 200, { ok: true, service: "ai-commerce-readiness-agent" });
      return;
    }

    if (req.method === "GET" && path === "/api/config") {
      sendJson(res, 200, { requiresApiKey: API_KEY !== "" });
      return;
    }

    if (req.method === "GET" && path === "/api/openapi.json") {
      try {
        const spec = readFileSync(
          new URL("./openapi.json", import.meta.url),
          "utf-8",
        );
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "public, max-age=300",
        });
        res.end(spec);
      } catch {
        sendJson(res, 500, { error: "Especificação OpenAPI indisponível." });
      }
      return;
    }

    const SWAGGER_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AI Commerce Readiness Agent — API</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "/api/openapi.json",
        dom_id: "#swagger-ui",
        deepLinking: true,
        presets: [window.SwaggerUIBundle.presets.apis],
        theme: "minimal",
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`;

    if (req.method === "GET" && path === "/api/docs") {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      });
      res.end(SWAGGER_HTML);
      return;
    }

    if (req.method === "POST" && path === "/api/auth/verify") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && path === "/api/analyze") {
      if (activeAnalyses >= maxConcurrentAnalyses) {
        res.setHeader("Retry-After", "30");
        sendJson(res, 503, {
          error: "Capacidade de análise ocupada. Tente novamente em instantes.",
          requestId,
        });
        return;
      }
      activeAnalyses += 1;
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(new Error(`Análise excedeu ${analysisTimeoutMs}ms.`)),
        analysisTimeoutMs,
      );
      const abortDisconnected = (): void => {
        if (!res.writableEnded) {
          controller.abort(new Error("Cliente desconectado."));
        }
      };
      req.once("aborted", abortDisconnected);
      res.once("close", abortDisconnected);
      void handleAnalyze(req, res, resolved, sessions, blockPrivateNetworks, controller.signal).finally(() => {
        clearTimeout(timer);
        req.off("aborted", abortDisconnected);
        res.off("close", abortDisconnected);
        activeAnalyses -= 1;
      });
      return;
    }

    if (req.method === "POST" && path === "/api/chat/reset") {
      void handleResetChat(req, res, sessions);
      return;
    }

    if (req.method === "POST" && path === "/api/apply") {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(new Error(`Aplicação excedeu ${chatTimeoutMs}ms.`)),
        chatTimeoutMs,
      );
      const abortDisconnected = (): void => {
        if (!res.writableEnded) controller.abort(new Error("Cliente desconectado."));
      };
      req.once("aborted", abortDisconnected);
      res.once("close", abortDisconnected);
      void handleApply(
        req,
        res,
        sessions,
        resolved.commerceAssistant,
        busySessions,
        controller.signal,
      ).finally(() => {
        clearTimeout(timer);
        req.off("aborted", abortDisconnected);
        res.off("close", abortDisconnected);
      });
      return;
    }

    if (req.method === "POST" && path === "/api/validate") {
      if (activeAnalyses >= maxConcurrentAnalyses) {
        res.setHeader("Retry-After", "30");
        sendJson(res, 503, { error: "Capacidade de análise ocupada. Tente novamente em instantes." });
        return;
      }
      activeAnalyses += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error("Revalidação excedeu o tempo limite.")), analysisTimeoutMs);
      const abortDisconnected = (): void => {
        if (!res.writableEnded) controller.abort(new Error("Cliente desconectado."));
      };
      req.once("aborted", abortDisconnected);
      res.once("close", abortDisconnected);
      void handleValidate(req, res, sessions, resolved, blockPrivateNetworks, controller.signal).finally(() => {
        clearTimeout(timer);
        req.off("aborted", abortDisconnected);
        res.off("close", abortDisconnected);
        activeAnalyses -= 1;
      });
      return;
    }

    if (req.method === "POST" && path === "/api/chat") {
      if (activeChats >= maxConcurrentChats) {
        res.setHeader("Retry-After", "5");
        sendJson(res, 503, { error: "Capacidade do agente ocupada. Tente novamente em instantes." });
        return;
      }
      activeChats += 1;
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(new Error(`Chat excedeu ${chatTimeoutMs}ms.`)),
        chatTimeoutMs,
      );
      const abortDisconnected = (): void => {
        if (!res.writableEnded) controller.abort(new Error("Cliente desconectado."));
      };
      req.once("aborted", abortDisconnected);
      res.once("close", abortDisconnected);
      void handleChat(
        req,
        res,
        sessions,
        resolved.commerceAssistant,
        busySessions,
        controller.signal,
      ).finally(() => {
        clearTimeout(timer);
        req.off("aborted", abortDisconnected);
        res.off("close", abortDisconnected);
        activeChats -= 1;
      });
      return;
    }

    sendJson(res, 404, { error: "Rota não encontrada." });
  });

  server.requestTimeout = envInteger("REQUEST_TIMEOUT_MS", 300_000, 10_000, 900_000);
  server.headersTimeout = 15_000;
  server.keepAliveTimeout = 5_000;

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.createdAt > SESSION_TTL_MS) sessions.delete(id);
    }
    for (const [client, bucket] of rateLimits) {
      if (now - bucket.startedAt > 120_000) rateLimits.delete(client);
    }
  }, 60_000);
  cleanup.unref();
  server.on("close", () => clearInterval(cleanup));

  return server;
}

if (isMainModule()) {
  const server = createAppServer();
  server.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
}
