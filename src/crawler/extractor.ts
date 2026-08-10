import { Category, Page, Product, SiteSnapshot } from "../models.js";
import { normalizeUrl } from "../utils/url.js";

export class Extractor {
  extractCategories(pages: Page[], baseUrl: string): Category[] {
    return pages
      .filter((page) => page.type === "category")
      .map((page) => ({
        name: page.title || page.url,
        url: normalizeUrl(page.url, baseUrl),
        level: 1,
      }));
  }

  extractProducts(
    pages: Page[],
    products: Product[],
    baseUrl: string,
  ): Product[] {
    const byUrl = new Map<string, Product>();

    for (const product of products) {
      byUrl.set(normalizeUrl(product.url, baseUrl), {
        ...product,
        url: normalizeUrl(product.url, baseUrl),
      });
    }

    for (const page of pages) {
      if (page.type !== "product") {
        continue;
      }
      const url = normalizeUrl(page.url, baseUrl);
      if (!byUrl.has(url)) {
        byUrl.set(url, {
          name: page.title,
          url,
          images: page.images,
          attributes: {},
          description: page.description,
        });
      }
    }

    return Array.from(byUrl.values());
  }

  buildSnapshot(
    baseUrl: string,
    pages: Page[],
    products: Product[],
    categories: Category[],
    sitemap: { urls: string[]; source: string },
    robots: { allow: string[]; disallow: string[]; sitemapUrls: string[] },
    schemas: { type: string; raw: Record<string, unknown> }[],
    errors: string[],
  ): SiteSnapshot {
    const host = new URL(baseUrl).host;

    return {
      site: {
        baseUrl,
        host,
        title: pages.find((page) => page.type === "homepage")?.title,
        description: pages.find((page) => page.type === "homepage")
          ?.description,
      },
      pages,
      products,
      categories,
      sitemap,
      robots,
      schemas,
      errors,
    };
  }
}
