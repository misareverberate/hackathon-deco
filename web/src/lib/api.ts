import type {
  RecommendationReport,
  GeoReport,
  ClientBusinessInput,
} from "@/lib/report";

export interface CrawlStats {
  pages: number;
  products: number;
  catalogCount?: number;
  pagesByType?: Record<string, number>;
  categories?: { count: number; names?: string[] };
  sitemap?: {
    urls: string[];
    source: string;
    count?: number;
    truncated?: boolean;
  };
  crawlDurationMs?: number;
  timings?: {
    robotsMs?: number;
    sitemapMs?: number;
    pagesMs?: number;
    knowledgeMs?: number;
    opportunitiesMs?: number;
    recommendationsMs?: number;
    geoMs?: number;
    totalMs?: number;
  };
  errors: string[];
}

export interface AnalyzeResponse extends RecommendationReport {
  analysisAccessToken?: string;
  crawl?: CrawlStats;
  geo?: GeoReport;
}

export interface AssistantToolResult {
  tool: string;
  summary: string;
  evidence: string[];
  data?: unknown;
}

export interface AssistantResponse {
  answer: string;
  tool: AssistantToolResult;
  suggestions: string[];
}

let apiKeyMemory = "";
const analysisTokens = new Map<string, string>();

export function storedApiKey(): string {
  return apiKeyMemory;
}

export function storeApiKey(value: string): void {
  apiKeyMemory = value.trim();
}

function apiHeaders(overrideKey?: string, analysisId?: string): HeadersInit {
  const apiKey = overrideKey?.trim() || storedApiKey();
  const analysisToken = analysisId ? analysisTokens.get(analysisId) : undefined;
  return {
    "Content-Type": "application/json",
    ...(apiKey ? { "X-API-Key": apiKey } : {}),
    ...(analysisToken ? { "X-Analysis-Token": analysisToken } : {}),
  };
}

export async function getApiConfig(): Promise<{ requiresApiKey: boolean }> {
  const response = await fetch("/api/config");
  if (!response.ok) throw new Error("Não foi possível carregar a configuração da API.");
  return await response.json() as { requiresApiKey: boolean };
}

export async function verifyApiKey(value: string): Promise<boolean> {
  const response = await fetch("/api/auth/verify", {
    method: "POST",
    headers: apiHeaders(value),
  });
  return response.ok;
}

export async function askAssistant(
  analysisId: string,
  message: string,
  signal?: AbortSignal,
): Promise<AssistantResponse> {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: apiHeaders(undefined, analysisId),
    body: JSON.stringify({ analysisId, message }),
    signal,
  });
  const payload = (await response.json().catch(() => ({}))) as AssistantResponse & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Falha ao consultar o agente (${response.status}).`);
  }
  return payload;
}

export async function resetAssistant(analysisId: string): Promise<void> {
  const response = await fetch("/api/chat/reset", {
    method: "POST",
    headers: apiHeaders(undefined, analysisId),
    body: JSON.stringify({ analysisId }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? "Não foi possível limpar o contexto do agente.");
  }
}

export interface ValidationResponse {
  recommendationId: string;
  status: "resolved" | "still_present";
  checkedAt: string;
  pages: number;
  products: number;
  evidence: string;
}

export interface ApplyArtifact {
  kind: string;
  filename: string;
  content: string;
  title: string;
  objective: string;
  acceptanceCriteria: string[];
  expectedImpact: string;
}

export interface ApplyCounterfactual {
  simulatable: boolean;
  totalJourneys: number;
  beforeSuccess: number;
  afterSuccess: number;
  beforeSuccessRate: number;
  afterSuccessRate: number;
  resolvedJourneys: number;
  avgConfidenceDelta: number;
  projectedAttributes: string[];
}

export interface ApplyActionResponse extends AssistantToolResult {
  data: {
    recommendationId: string;
    recommendationTitle: string;
    artifact: ApplyArtifact;
    counterfactual: ApplyCounterfactual;
    decision: {
      recommendationId: string;
      status: string;
      note?: string;
      updatedAt: number;
    };
  };
}

export async function applyRecommendation(
  analysisId: string,
  recommendationId: string,
  signal?: AbortSignal,
): Promise<ApplyActionResponse> {
  const response = await fetch("/api/apply", {
    method: "POST",
    headers: apiHeaders(undefined, analysisId),
    body: JSON.stringify({ analysisId, recommendationId }),
    signal,
  });
  const payload = (await response.json().catch(() => ({}))) as ApplyActionResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? `Falha ao aplicar a correção (${response.status}).`);
  return payload;
}

export async function validateRecommendation(
  analysisId: string,
  recommendationId: string,
  signal?: AbortSignal,
): Promise<ValidationResponse> {
  const response = await fetch("/api/validate", {
    method: "POST",
    headers: apiHeaders(undefined, analysisId),
    body: JSON.stringify({ analysisId, recommendationId }),
    signal,
  });
  const payload = (await response.json().catch(() => ({}))) as ValidationResponse & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Não foi possível revalidar a correção.");
  return payload;
}

export interface AnalyzeOptions {
  maxProducts?: number;
  business?: ClientBusinessInput;
}

export type AnalysisStage =
  | "discovery"
  | "crawl"
  | "knowledge"
  | "opportunities"
  | "recommendations"
  | "geo";

export interface StageEvent {
  type: "stage";
  stage: AnalysisStage;
  label: string;
  at: number;
}

export interface CrawlProgressEvent {
  type: "crawl-progress";
  pages: number;
  products: number;
  discovered: number;
  total: number;
  at: number;
}

export type AnalysisEvent =
  | StageEvent
  | CrawlProgressEvent
  | { type: "done"; at: number; report: AnalyzeResponse }
  | { type: "error"; at: number; message: string };

export async function analyzeSiteStreaming(
  url: string,
  options: AnalyzeOptions,
  onEvent: (event: AnalysisEvent) => void,
  signal?: AbortSignal,
): Promise<AnalyzeResponse> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify({ url, ...options }),
    signal,
  });

  if (!response.ok || !response.body) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(payload.error ?? `Falha na análise (${response.status}).`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let report: AnalyzeResponse | undefined;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) {
          const event = JSON.parse(line) as AnalysisEvent;
          if (event.type === "done") {
            const token = event.report.analysisAccessToken;
            if (event.report.analysisId && token) {
              analysisTokens.set(event.report.analysisId, token);
            }
            const { analysisAccessToken: _token, ...safeReport } = event.report;
            report = safeReport as AnalyzeResponse;
          } else if (event.type === "error") {
            throw new Error(event.message);
          } else {
            onEvent(event);
          }
        }
        newlineIndex = buffer.indexOf("\n");
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }

  if (!report) {
    throw new Error("Análise terminou sem relatório.");
  }
  return report;
}
