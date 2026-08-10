import * as cheerio from "cheerio";
import {
  Breadcrumb,
  Metadata,
  Page,
  Product,
  Schema,
  Image,
} from "../models.js";
import { classifyUrl, normalizeUrl } from "../utils/url.js";

export class HtmlParser {
  parsePage(url: string, html: string, baseUrl: string): Page {
    const $ = cheerio.load(html);
    return this.buildPage(url, baseUrl, $, this.extractSchemas($));
  }

  parsePageWithProduct(
    url: string,
    html: string,
    baseUrl: string,
  ): { page: Page; product?: Product } {
    const $ = cheerio.load(html);
    const schemas = this.extractSchemas($);
    const page = this.buildPage(url, baseUrl, $, schemas);
    return {
      page,
      product: page.type === "product"
        ? this.buildProduct(url, baseUrl, $, schemas)
        : undefined,
    };
  }

  private buildPage(
    url: string,
    baseUrl: string,
    $: cheerio.CheerioAPI,
    schemas: Schema[],
  ): Page {
    const pageUrl = normalizeUrl(url, baseUrl);
    const pageSchemas = schemas.map((schema) => ({
      ...schema,
      url: pageUrl,
    }));
    const title = $("title").first().text().trim() || undefined;
    const description =
      $('meta[name="description"]').attr("content")?.trim() || undefined;
    const canonical =
      $('link[rel="canonical"]').attr("href")?.trim() || undefined;
    const headings = $("h1, h2, h3")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean);
    const breadcrumbs = this.extractBreadcrumbs($);
    const images = this.extractImages($);
    const links = this.extractLinks($, baseUrl);

    return {
      url: pageUrl,
      type: classifyUrl(url),
      title,
      description,
      canonical: canonical ? normalizeUrl(canonical, baseUrl) : undefined,
      headings,
      breadcrumbs,
      metadata: this.extractMetadata($),
      images,
      schemas: pageSchemas,
      links,
    };
  }

  parseProduct(url: string, html: string, baseUrl: string): Product {
    const $ = cheerio.load(html);
    return this.buildProduct(url, baseUrl, $, this.extractSchemas($));
  }

  private buildProduct(
    url: string,
    baseUrl: string,
    $: cheerio.CheerioAPI,
    schemas: Schema[],
  ): Product {
    const attributes: Record<string, string> = {};

    $('meta[property^="product:"]').each((_, el) => {
      const property = $(el).attr("property");
      const content = $(el).attr("content");
      if (property && content) {
        attributes[property] = content;
      }
    });

    const productSchema =
      schemas.find((schema) => schema.type === "Product") ?? schemas[0];
    this.extractSchemaAttributes(productSchema, attributes);

    return {
      name:
        this.extractTextFromSchema(productSchema, "name") ||
        $('meta[property="og:title"]').attr("content")?.trim() ||
        $("h1").first().text().trim() ||
        undefined,
      url: normalizeUrl(url, baseUrl),
      price: this.extractTextFromSchema(productSchema, "price") || undefined,
      description:
        this.extractTextFromSchema(productSchema, "description") ||
        $('meta[name="description"]').attr("content")?.trim() ||
        undefined,
      brand: this.extractTextFromSchema(productSchema, "brand") || undefined,
      sku: this.extractTextFromSchema(productSchema, "sku") || undefined,
      availability:
        this.extractTextFromSchema(productSchema, "availability") || undefined,
      category:
        this.extractTextFromSchema(productSchema, "category") ||
        this.extractCategoryFromBreadcrumb(schemas) ||
        undefined,
      images: this.extractImages($),
      attributes,
      raw: productSchema?.raw ? productSchema.raw : undefined,
    };
  }

  private extractMetadata($: cheerio.CheerioAPI): Metadata {
    return {
      title: $("title").first().text().trim() || undefined,
      description:
        $('meta[name="description"]').attr("content")?.trim() || undefined,
      canonical: $('link[rel="canonical"]').attr("href")?.trim() || undefined,
      lang: $("html").attr("lang") || undefined,
      ogTitle:
        $('meta[property="og:title"]').attr("content")?.trim() || undefined,
      ogDescription:
        $('meta[property="og:description"]').attr("content")?.trim() ||
        undefined,
      ogImage:
        $('meta[property="og:image"]').attr("content")?.trim() || undefined,
      ogType:
        $('meta[property="og:type"]').attr("content")?.trim() || undefined,
    };
  }

  private extractBreadcrumbs($: cheerio.CheerioAPI): Breadcrumb[] {
    const items: Breadcrumb[] = [];
    $("nav, .breadcrumb, .breadcrumbs").each((_, element) => {
      $(element)
        .find("a")
        .each((__, link) => {
          const label = $(link).text().trim();
          const href = $(link).attr("href");
          if (label) {
            items.push({ label, url: href || undefined });
          }
        });
    });

    return items;
  }

  private extractImages($: cheerio.CheerioAPI): Image[] {
    const images: Image[] = [];
    $("img").each((_, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src");
      if (src) {
        images.push({ src, alt: $(el).attr("alt") || undefined });
      }
    });

    return images;
  }

  private extractLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
    const links: string[] = [];
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) {
        return;
      }
      const withoutFragment = href.split("#")[0];
      if (!withoutFragment) {
        return;
      }
      const normalized = normalizeUrl(withoutFragment, baseUrl);
      try {
        const parsed = new URL(normalized);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          return;
        }
      } catch {
        return;
      }
      if (!links.includes(normalized)) {
        links.push(normalized);
      }
    });

    return links;
  }

  private extractSchemas($: cheerio.CheerioAPI): Schema[] {
    const schemas: Schema[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      const rawText = $(el).html() || "";
      try {
        const data = JSON.parse(rawText);
        schemas.push(...this.collectSchemas(data));
      } catch {
        // ignore malformed JSON-LD and continue
      }
    });

    return schemas;
  }

  private collectSchemas(data: unknown): Schema[] {
    if (Array.isArray(data)) {
      return data.flatMap((item) => this.collectSchemas(item));
    }

    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const graph = record["@graph"];
      if (Array.isArray(graph)) {
        return graph.flatMap((item) => this.collectSchemas(item));
      }

      const type =
        typeof record["@type"] === "string"
          ? record["@type"]
          : Array.isArray(record["@type"])
            ? record["@type"].find((entry) => typeof entry === "string")
            : "Unknown";
      if (typeof type === "string") {
        return [{ type, raw: record }];
      }
    }

    return [];
  }

  private extractTextFromSchema(
    schema: Schema | undefined,
    key: string,
  ): string | undefined {
    if (!schema?.raw) {
      return undefined;
    }

    const value = schema.raw[key];
    if (typeof value === "string") {
      return value;
    }

    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record["name"] === "string") {
        return record["name"];
      }
      if (typeof record["value"] === "string") {
        return record["value"];
      }
      if (key === "price" && typeof record["price"] === "string") {
        return record["price"];
      }
    }

    const offers = schema.raw["offers"];
    if (offers) {
      const offerList = Array.isArray(offers) ? offers : [offers];
      for (const offer of offerList) {
        if (offer && typeof offer === "object") {
          const record = offer as Record<string, unknown>;
          const nested = record[key];
          if (typeof nested === "string") {
            return nested;
          }
          if (
            key === "price" &&
            nested &&
            typeof nested === "object" &&
            typeof (nested as Record<string, unknown>)["price"] === "string"
          ) {
            return (nested as Record<string, unknown>)["price"] as string;
          }
        }
      }
    }

    return undefined;
  }

  private extractSchemaAttributes(
    schema: Schema | undefined,
    attributes: Record<string, string>,
  ): void {
    const raw = schema?.raw;
    if (!raw) {
      return;
    }
    const properties = raw["additionalProperty"];
    const list = Array.isArray(properties)
      ? properties
      : properties
        ? [properties]
        : [];
    list.forEach((property) => {
      if (!property || typeof property !== "object") {
        return;
      }
      const record = property as Record<string, unknown>;
      if (typeof record["name"] !== "string") {
        return;
      }
      const value = record["value"];
      attributes[record["name"]] =
        typeof value === "string"
          ? value
          : value === null || value === undefined
            ? ""
            : String(value);
    });
  }

  private extractCategoryFromBreadcrumb(schemas: Schema[]): string | undefined {
    const breadcrumb = schemas.find(
      (schema) =>
        schema.type === "BreadcrumbList" || schema.type === "breadcrumb",
    );
    const items = breadcrumb?.raw?.["itemListElement"];
    if (!Array.isArray(items)) {
      return undefined;
    }
    const labels = items
      .map((item) => {
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          return typeof record["name"] === "string" ? record["name"] : undefined;
        }
        return undefined;
      })
      .filter((label): label is string => label !== undefined);
    if (labels.length >= 2) {
      return labels[labels.length - 2];
    }
    return labels.length === 1 ? labels[0] : undefined;
  }
}
