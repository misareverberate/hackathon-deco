import { HtmlParser } from "./parser.js";
import { RobotsParser } from "./robots.js";
import { SitemapParser } from "./sitemap.js";
import { Extractor } from "./extractor.js";
import { Page, Product, RobotsInfo, SiteSnapshot } from "../models.js";
import { classifyUrl, isSameHost, normalizeUrl } from "../utils/url.js";
import { fetchTextWithTimeout } from "../utils/http.js";

export interface CrawlProgress {
  pages: number;
  products: number;
  discovered: number;
  total: number;
}

export interface CrawlerOptions {
  timeoutMs?: number;
  concurrency?: number;
  maxPages?: number;
  maxProducts?: number;
  verbose?: boolean;
  onProgress?: (progress: CrawlProgress) => void;
  signal?: AbortSignal;
  blockPrivateNetworks?: boolean;
}

export type ResolvedCrawlerOptions = Omit<
  Required<CrawlerOptions>,
  "onProgress" | "signal"
> & {
  onProgress?: CrawlerOptions["onProgress"];
  signal?: AbortSignal;
};

export class CrawlerPipeline {
  private readonly options: Omit<Required<CrawlerOptions>, "onProgress" | "signal">;
  private readonly onProgress?: (progress: CrawlProgress) => void;
  private readonly signal?: AbortSignal;

  constructor(
    options: CrawlerOptions = {},
    private readonly htmlParser = new HtmlParser(),
    private readonly robotsParser = new RobotsParser(),
    private readonly sitemapParser = new SitemapParser(),
    private readonly extractor = new Extractor(),
  ) {
    const { onProgress, signal, ...rest } = options;
    this.options = {
      timeoutMs: 15000,
      concurrency: 5,
      maxPages: 2000,
      maxProducts: 1000,
      verbose: false,
      blockPrivateNetworks: false,
      ...rest,
    };
    this.onProgress = onProgress;
    this.signal = signal;
  }

  async crawl(
    baseUrl: string,
    overrides: Partial<CrawlerOptions> = {},
  ): Promise<SiteSnapshot> {
    const crawlStartedAt = Date.now();
    const {
      timeoutMs,
      concurrency,
      maxPages,
      maxProducts,
      verbose,
      onProgress,
      signal,
      blockPrivateNetworks,
    } = overrides;
    const options: ResolvedCrawlerOptions = {
      ...this.options,
      ...(this.onProgress !== undefined && { onProgress: this.onProgress }),
      ...(this.signal !== undefined && { signal: this.signal }),
      ...(timeoutMs !== undefined && { timeoutMs }),
      ...(concurrency !== undefined && { concurrency }),
      ...(maxPages !== undefined && { maxPages }),
      ...(maxProducts !== undefined && { maxProducts }),
      ...(verbose !== undefined && { verbose }),
      ...(onProgress !== undefined && { onProgress }),
      ...(signal !== undefined && { signal }),
      ...(blockPrivateNetworks !== undefined && { blockPrivateNetworks }),
    };
    const normalizedBaseUrl = normalizeUrl(baseUrl, baseUrl);
    const errors: string[] = [];

    const robotsStartedAt = Date.now();
    const robots = await this.robotsParser.fetchRobots(
      normalizedBaseUrl,
      options.timeoutMs,
      options.signal,
      options.blockPrivateNetworks,
    );
    const robotsMs = Date.now() - robotsStartedAt;
    if (options.verbose) {
      console.error(
        `[ROBOTS] ${
          robots.sitemapUrls.length > 0 ? "encontrado" : "sem robots.txt"
        } — sitemaps=${robots.sitemapUrls.length}`,
      );
    }

    const sitemapStartedAt = Date.now();
    const sitemap = await this.sitemapParser.fetchSitemaps(
      normalizedBaseUrl,
      robots.sitemapUrls,
      options.timeoutMs,
      options.signal,
      options.blockPrivateNetworks,
    );
    const sitemapMs = Date.now() - sitemapStartedAt;
    if (options.verbose) {
      console.error(
        `[SITEMAP] source=${sitemap.source} urls=${sitemap.urls.length}`,
      );
    }

    const candidates = this.collectCandidates(
      normalizedBaseUrl,
      sitemap.urls,
      robots,
    );
    const catalogCount = this.countCatalog(candidates);
    const pagesStartedAt = Date.now();
    const crawled = await this.crawlCandidates(
      candidates,
      errors,
      normalizedBaseUrl,
      robots,
      options,
    );
    const pagesMs = Date.now() - pagesStartedAt;

    const categories = this.extractor.extractCategories(
      crawled.pages,
      normalizedBaseUrl,
    );
    const snapshot = this.extractor.buildSnapshot(
      normalizedBaseUrl,
      crawled.pages,
      this.extractor.extractProducts(
        crawled.pages,
        crawled.products,
        normalizedBaseUrl,
      ),
      categories,
      sitemap,
      robots,
      crawled.schemas,
      errors,
    );
    snapshot.catalogCount = catalogCount;
    snapshot.timings = {
      robotsMs,
      sitemapMs,
      pagesMs,
      totalMs: Date.now() - crawlStartedAt,
    };

    return snapshot;
  }

  private async crawlCandidates(
    candidates: string[],
    errors: string[],
    baseUrl: string,
    robots: RobotsInfo,
    options: ResolvedCrawlerOptions,
  ): Promise<{
    pages: Page[];
    products: Product[];
    schemas: SiteSnapshot["schemas"];
  }> {
    const pages: Page[] = [];
    const products: Product[] = [];
    const schemas: SiteSnapshot["schemas"] = [];
    const visited = new Set<string>();
    const queued = new Set<string>();
    const ignored = new Map<string, string>();

    const buckets: string[][] = [[], [], [], [], []];
    const MAX_PRIORITY = buckets.length - 1;

    const enqueue = (url: string): void => {
      if (visited.has(url) || queued.has(url)) {
        return;
      }
      if (!isSameHost(url, baseUrl)) {
        ignored.set(url, "fora do host");
        return;
      }
      try {
        if (
          !this.robotsParser.isPathAllowed(new URL(url).pathname, robots)
        ) {
          ignored.set(url, "bloqueado pelo robots.txt");
          return;
        }
      } catch {
        // allow when the URL cannot be parsed
      }
      const priority = this.priorityOf(url);
      if (
        priority === 3 &&
        buckets[priority].length >= options.maxProducts
      ) {
        ignored.set(url, "limite de produtos atingido");
        return;
      }
      queued.add(url);
      buckets[priority].push(url);
    };

    for (const candidate of candidates) {
      if (this.priorityOf(candidate) === 4) {
        continue;
      }
      enqueue(candidate);
    }

    const takeBatch = (budget: number): string[] => {
      const batch: string[] = [];
      let priority = 0;
      while (batch.length < budget && priority <= MAX_PRIORITY) {
        const bucket = buckets[priority];
        while (batch.length < budget && bucket.length > 0) {
          const url = bucket.shift()!;
          if (priority === 3 && products.length >= options.maxProducts) {
            ignored.set(url, "limite de produtos atingido");
            continue;
          }
          batch.push(url);
        }
        priority += 1;
      }
      return batch;
    };

    while (pages.length < options.maxPages) {
      const budget = options.maxPages - pages.length;
      const batch = takeBatch(budget);
      if (batch.length === 0) {
        break;
      }
      batch.forEach((url) => visited.add(url));

      await this.fetchBatch(
        batch,
        baseUrl,
        errors,
        options,
        (page, product) => {
          if (page) {
            pages.push(page);
            schemas.push(...page.schemas);
            if (product) products.push(product);
            for (const link of page.links ?? []) enqueue(link);
          }
          if (options.onProgress) {
            try {
              options.onProgress({
                pages: pages.length,
                products: products.length,
                discovered: queued.size,
                total: Math.min(options.maxPages, queued.size),
              });
            } catch (error) {
              errors.push(`Callback de progresso falhou: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        },
      );

      if (options.verbose) {
        this.logHomepage(pages, baseUrl);
      }
    }

    if (options.verbose) {
      console.error(
        `[QUEUE] descobertas=${
          queued.size + pages.length
        } visitadas=${pages.length} produtos=${products.length} ignoradas=${ignored.size}`,
      );
    }

    return { pages, products, schemas };
  }

  private async fetchBatch(
    urls: string[],
    baseUrl: string,
    errors: string[],
    options: ResolvedCrawlerOptions,
    onSettled: (page?: Page, product?: Product) => void,
  ): Promise<void> {
    let index = 0;

    const worker = async () => {
      while (index < urls.length) {
        const candidate = urls[index];
        index += 1;
        try {
          const response = await fetchTextWithTimeout(candidate, {
            timeoutMs: options.timeoutMs,
            signal: options.signal,
            blockPrivateNetworks: options.blockPrivateNetworks,
            maxBytes: 5_000_000,
            headers: { "User-Agent": "CommerceReadinessAgent/1.0" },
          });
          if (!response.ok) {
            errors.push(`Failed to fetch ${candidate}: ${response.status}`);
            onSettled();
            continue;
          }

          const parsed = this.htmlParser.parsePageWithProduct(
            candidate,
            response.text,
            baseUrl,
          );
          onSettled(parsed.page, parsed.product);
        } catch (error) {
          if (options.signal?.aborted) throw error;
          const message = error instanceof Error ? error.message : String(error);
          errors.push(`Error processing ${candidate}: ${message}`);
          onSettled();
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(options.concurrency, urls.length) },
      () => worker(),
    );
    await Promise.all(workers);

  }

  private priorityOf(url: string): number {
    switch (classifyUrl(url)) {
      case "homepage":
        return 0;
      case "category":
        return 1;
      case "institutional":
        return 2;
      case "product":
        return 3;
      default:
        return 4;
    }
  }

  private countCatalog(candidates: string[]): number {
    let count = 0;
    for (const url of candidates) {
      if (classifyUrl(url) === "product") {
        count += 1;
      }
    }
    return count;
  }

  private logHomepage(pages: Page[], baseUrl: string): void {
    const homepage = pages.find((page) => page.type === "homepage");
    if (!homepage?.links) {
      return;
    }
    let internal = 0;
    let external = 0;
    for (const link of homepage.links) {
      if (isSameHost(link, baseUrl)) {
        internal += 1;
      } else {
        external += 1;
      }
    }
    console.error(
      `[HOMEPAGE] ${homepage.url} — links internos=${internal} externos=${external}`,
    );
  }

  private collectCandidates(
    baseUrl: string,
    sitemapUrls: string[],
    robots: RobotsInfo,
  ): string[] {
    const candidates = new Set<string>();

    candidates.add(baseUrl);
    for (const sitemapUrl of sitemapUrls) {
      if (isSameHost(sitemapUrl, baseUrl)) {
        candidates.add(sitemapUrl);
      }
    }

    const homepage = new URL("/", baseUrl).toString();
    candidates.add(homepage);

    return Array.from(candidates).filter((url) => {
      try {
        return this.robotsParser.isPathAllowed(new URL(url).pathname, robots);
      } catch {
        return true;
      }
    });
  }
}
