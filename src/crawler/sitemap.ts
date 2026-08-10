import { XMLParser } from "fast-xml-parser";
import { SitemapInfo } from "../models.js";
import { fetchTextWithTimeout } from "../utils/http.js";
import { isSameHost } from "../utils/url.js";

export interface SitemapParserOptions {
  maxSitemaps: number;
  fetchTimeoutMs: number;
  maxAttempts: number;
  concurrency: number;
  discoveryBudgetMs: number;
  maxUrls: number;
}

const DEFAULT_OPTIONS: SitemapParserOptions = {
  maxSitemaps: 20,
  fetchTimeoutMs: 8000,
  maxAttempts: 2,
  concurrency: 4,
  discoveryBudgetMs: 30000,
  maxUrls: 50_000,
};

export interface ParsedSitemap {
  kind: "index" | "urlset";
  urls: string[];
}

export class SitemapParser {
  private readonly options: SitemapParserOptions;

  private parser = new XMLParser({
    ignoreAttributes: false,
    allowBooleanAttributes: true,
    trimValues: true,
  });

  constructor(options: Partial<SitemapParserOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  parseSitemap(text: string): ParsedSitemap {
    const parsed = this.parser.parse(text) as Record<string, unknown>;

    const index = parsed.sitemapindex as Record<string, unknown> | undefined;
    if (index) {
      return { kind: "index", urls: this.collectLocations(index.sitemap) };
    }

    const urlset = parsed.urlset as Record<string, unknown> | undefined;
    if (urlset) {
      return { kind: "urlset", urls: this.collectLocations(urlset.url) };
    }

    if (typeof parsed.loc === "string") {
      return { kind: "urlset", urls: [parsed.loc] };
    }

    return { kind: "urlset", urls: [] };
  }

  async fetchSitemaps(
    baseUrl: string,
    robotsSitemapUrls: string[],
    timeoutMs = 15000,
    signal?: AbortSignal,
    blockPrivateNetworks = false,
  ): Promise<SitemapInfo> {
    const candidates = this.collectCandidates(baseUrl, robotsSitemapUrls);
    const urls = new Set<string>();
    const visited = new Set<string>();
    const queue: string[] = candidates;
    const deadline = Date.now() + this.options.discoveryBudgetMs;
    let source = candidates[0] ?? new URL("/sitemap.xml", baseUrl).toString();
    let hasSource = false;

    while (
      queue.length > 0 &&
      visited.size < this.options.maxSitemaps &&
      urls.size < this.options.maxUrls &&
      Date.now() < deadline
    ) {
      const batch: string[] = [];
      while (
        queue.length > 0 &&
        batch.length < this.options.concurrency &&
        visited.size < this.options.maxSitemaps
      ) {
        const candidate = queue.shift()!;
        if (visited.has(candidate)) {
          continue;
        }
        visited.add(candidate);
        batch.push(candidate);
      }

      const results = await Promise.all(
        batch.map(async (candidate) => ({
          candidate,
          text: await this.fetchSitemapText(
            candidate,
            timeoutMs,
            deadline,
            signal,
            blockPrivateNetworks,
          ),
        })),
      );

      for (const { candidate, text } of results) {
        try {
          if (text === null) {
            continue;
          }

          const parsed = this.parseSitemap(text);
          if (parsed.urls.length > 0 && !hasSource) {
            source = candidate;
            hasSource = true;
          }
          if (parsed.kind === "index") {
            for (const child of parsed.urls) {
              if (isSameHost(child, baseUrl) && !visited.has(child)) {
                queue.push(child);
              }
            }
          } else {
            for (const entry of parsed.urls) {
              if (urls.size >= this.options.maxUrls) break;
              urls.add(entry);
            }
          }
        } catch {
          continue;
        }
      }
    }

    return {
      urls: Array.from(urls),
      source,
      truncated: urls.size >= this.options.maxUrls,
    };
  }

  private async fetchSitemapText(
    candidate: string,
    timeoutMs: number,
    deadline: number,
    signal?: AbortSignal,
    blockPrivateNetworks = false,
  ): Promise<string | null> {
    for (let attempt = 0; attempt < this.options.maxAttempts; attempt += 1) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        return null;
      }
      const timeout = Math.max(
        1,
        Math.min(timeoutMs, this.options.fetchTimeoutMs, remainingMs),
      );
      try {
        const response = await fetchTextWithTimeout(candidate, {
          timeoutMs: timeout,
          signal,
          blockPrivateNetworks,
          maxBytes: 10_000_000,
          headers: { "User-Agent": "CommerceReadinessAgent/1.0" },
        });
        if (!response.ok) {
          continue;
        }
        return response.text;
      } catch (error) {
        // A timeout already consumed this URL's allowance; retrying it can
        // multiply discovery time across large sitemap indexes.
        if (signal?.aborted) throw error;
        if (error instanceof Error && (error.name === "AbortError" || error.message.includes("Timeout"))) {
          return null;
        }
      }
    }
    return null;
  }

  private collectCandidates(
    baseUrl: string,
    robotsSitemapUrls: string[],
  ): string[] {
    const set = new Set<string>();
    const defaultSitemap = new URL("/sitemap.xml", baseUrl).toString();
    set.add(defaultSitemap);

    robotsSitemapUrls.forEach((url) => set.add(url));

    return Array.from(set);
  }

  private collectLocations(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((entry) => this.locOf(entry))
        .filter((loc): loc is string => Boolean(loc));
    }
    const loc = this.locOf(value);
    return loc ? [loc] : [];
  }

  private locOf(value: unknown): string | undefined {
    if (
      value &&
      typeof value === "object" &&
      typeof (value as Record<string, unknown>).loc === "string"
    ) {
      return (value as Record<string, unknown>).loc as string;
    }
    return undefined;
  }
}
