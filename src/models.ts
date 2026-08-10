export interface Image {
  src: string;
  alt?: string;
}

export interface Metadata {
  title?: string;
  description?: string;
  canonical?: string;
  lang?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
}

export interface Breadcrumb {
  label: string;
  url?: string;
}

export interface Schema {
  type: string;
  raw: Record<string, unknown>;
  url?: string;
}

export interface Category {
  name: string;
  url: string;
  parent?: string;
  level?: number;
}

export interface Product {
  name?: string;
  url: string;
  price?: string;
  description?: string;
  brand?: string;
  sku?: string;
  availability?: string;
  category?: string;
  images: Image[];
  attributes: Record<string, string>;
  raw?: Record<string, unknown>;
}

export interface Page {
  url: string;
  type: "homepage" | "category" | "product" | "institutional" | "unknown";
  title?: string;
  description?: string;
  canonical?: string;
  headings: string[];
  breadcrumbs: Breadcrumb[];
  metadata: Metadata;
  images: Image[];
  schemas: Schema[];
  links?: string[];
  error?: string;
}

export interface RobotsInfo {
  allow: string[];
  disallow: string[];
  sitemapUrls: string[];
}

export interface SitemapInfo {
  urls: string[];
  source: string;
  truncated?: boolean;
}

export interface SiteSnapshot {
  site: {
    baseUrl: string;
    host: string;
    title?: string;
    description?: string;
  };
  pages: Page[];
  products: Product[];
  catalogCount?: number;
  categories: Category[];
  sitemap: SitemapInfo;
  robots: RobotsInfo;
  schemas: Schema[];
  errors: string[];
  timings?: {
    robotsMs: number;
    sitemapMs: number;
    pagesMs: number;
    totalMs: number;
  };
}
