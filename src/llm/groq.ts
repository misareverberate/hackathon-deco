import { resolveSecret } from "../config/env.js";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqConfig {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  temperature?: number;
  env?: NodeJS.ProcessEnv;
  fetchFn?: typeof fetch;
}

export interface LlmGateway {
  isConfigured(): boolean;
  chatJson(
    messages: ChatMessage[],
    signal?: AbortSignal,
  ): Promise<Record<string, unknown> | null>;
  getMetrics?(): LlmMetrics;
}

export interface LlmMetrics {
  logicalCalls: number;
  httpRequests: number;
  retries: number;
  failures: number;
}

const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_BASE_URL = "https://api.groq.com/openai/v1";

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const timer = setTimeout(resolvePromise, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason ?? new Error("Operação cancelada."));
    }, { once: true });
  });
}

let configuredRatePerMinute: number | undefined;
let bucketTokens = 0;
let bucketLastRefillAt = 0;
let sharedRateLimitedUntil = 0;
let sharedLastWarnAt = 0;

function effectiveRatePerMinute(): number {
  if (configuredRatePerMinute === undefined) {
    const raw = Number(resolveSecret("GROQ_RATE_LIMIT"));
    configuredRatePerMinute = Number.isFinite(raw)
      ? Math.min(120, Math.max(1, Math.round(raw)))
      : 20;
  }
  return configuredRatePerMinute;
}

function tryConsumeToken(): boolean {
  const rate = effectiveRatePerMinute();
  const now = Date.now();
  if (bucketLastRefillAt === 0) {
    bucketTokens = rate;
  } else {
    bucketTokens = Math.min(
      rate,
      bucketTokens + ((now - bucketLastRefillAt) / 60_000) * rate,
    );
  }
  bucketLastRefillAt = now;
  if (bucketTokens >= 1) {
    bucketTokens -= 1;
    return true;
  }
  return false;
}

function shouldLogFailure(): boolean {
  const now = Date.now();
  if (now - sharedLastWarnAt < 10_000) return false;
  sharedLastWarnAt = now;
  return true;
}

export function configureLlmRateLimit(ratePerMinute?: number): void {
  configuredRatePerMinute = ratePerMinute;
  bucketTokens = 0;
  bucketLastRefillAt = 0;
  sharedRateLimitedUntil = 0;
  sharedLastWarnAt = 0;
}

export function extractJson(content: string): Record<string, unknown> | null {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : content;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export class GroqClient implements LlmGateway {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly temperature: number;
  private readonly fetchFn: typeof fetch;
  private readonly metrics: LlmMetrics = {
    logicalCalls: 0,
    httpRequests: 0,
    retries: 0,
    failures: 0,
  };

  constructor(config: GroqConfig = {}) {
    const env = config.env ?? process.env;
    this.apiKey =
      config.apiKey ?? resolveSecret("GROQ_API_KEY", env);
    this.model = config.model ?? env.GROQ_MODEL ?? DEFAULT_MODEL;
    this.baseUrl = config.baseUrl ?? env.GROQ_BASE_URL ?? DEFAULT_BASE_URL;
    this.timeoutMs = config.timeoutMs ?? 30_000;
    this.maxRetries = config.maxRetries ?? 2;
    this.temperature = config.temperature ?? 0.1;
    this.fetchFn = config.fetchFn ?? fetch;
  }

  isConfigured(): boolean {
    return this.apiKey.trim() !== "";
  }

  async chatJson(
    messages: ChatMessage[],
    signal?: AbortSignal,
  ): Promise<Record<string, unknown> | null> {
    if (!this.isConfigured()) {
      return null;
    }
    this.metrics.logicalCalls += 1;
    const content = await this.complete(messages, true, signal);
    return content ? extractJson(content) : null;
  }

  getMetrics(): LlmMetrics {
    return { ...this.metrics };
  }

  private async complete(
    messages: ChatMessage[],
    jsonMode: boolean,
    signal?: AbortSignal,
  ): Promise<string | null> {
    if (Date.now() < sharedRateLimitedUntil) {
      return null;
    }
    if (!tryConsumeToken()) {
      return null;
    }
    let lastError: unknown = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      signal?.throwIfAborted();
      this.metrics.httpRequests += 1;
      if (attempt > 0) this.metrics.retries += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const requestSignal = signal
        ? AbortSignal.any([signal, controller.signal])
        : controller.signal;
      try {
        const response = await this.fetchFn(
          `${this.baseUrl}/chat/completions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
              model: this.model,
              messages,
              temperature: this.temperature,
              max_tokens: jsonMode ? 1500 : 800,
              ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
            }),
            signal: requestSignal,
          },
        );

        if (response.status === 429 || response.status >= 500) {
          lastError = new Error(`Groq HTTP ${response.status}`);
          if (attempt < this.maxRetries) {
            const retryAfterSeconds = Number(response.headers.get("retry-after"));
            const retryAfterMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
              ? Math.min(retryAfterSeconds * 1000, 5_000)
              : 500 * (attempt + 1);
            if (response.status === 429) {
              sharedRateLimitedUntil = Date.now() + retryAfterMs;
            }
            await sleep(retryAfterMs, signal);
            continue;
          }
          break;
        }

        if (!response.ok) {
          const body = await response.text();
          lastError = new Error(
            `Groq HTTP ${response.status}: ${body.slice(0, 200)}`,
          );
          break;
        }

        const data = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = data.choices?.[0]?.message?.content?.trim();
        return content !== "" && content !== undefined ? content : null;
      } catch (error) {
        if (signal?.aborted) throw signal.reason ?? error;
        lastError = error;
        if (attempt < this.maxRetries) {
          await sleep(250 * (attempt + 1), signal);
        }
      } finally {
        clearTimeout(timer);
      }
    }

    const message =
      lastError instanceof Error ? lastError.message : String(lastError);
    if (shouldLogFailure()) {
      console.warn(`[groq] LLM call failed: ${message}`);
    }
    this.metrics.failures += 1;
    return null;
  }
}
