import type { SiteSnapshot } from "../models.js";
import {
  EntityResolver,
  type ProductEntity,
  type CategoryEntity,
  type BrandEntity,
  type AttributeEntity,
  type PageEntity,
  type SchemaEntity,
  type FAQEntity,
} from "./entityResolver.js";
import { Normalizer } from "./normalizer.js";
import {
  RelationshipBuilder,
  type Relationship,
} from "./relationshipBuilder.js";
import { SearchIndexBuilder, type SearchIndexes } from "./searchIndex.js";

export interface KnowledgeBase {
  site: {
    baseUrl: string;
    host: string;
    title?: string;
    description?: string;
  };
  products: ProductEntity[];
  categories: CategoryEntity[];
  brands: BrandEntity[];
  attributes: AttributeEntity[];
  pages: PageEntity[];
  schemas: SchemaEntity[];
  faqs: FAQEntity[];
  relationships: Relationship[];
  indexes: SearchIndexes;
  issues: string[];
  catalogCount?: number;
}

export class KnowledgeBuilder {
  constructor(
    private readonly normalizer = new Normalizer(),
    private readonly entityResolver = new EntityResolver(),
    private readonly relationshipBuilder = new RelationshipBuilder(),
    private readonly searchIndexBuilder = new SearchIndexBuilder(),
  ) {}

  build(snapshot: SiteSnapshot): KnowledgeBase {
    const categories = this.entityResolver.resolveCategories(
      snapshot.categories,
      snapshot.pages,
    );
    const brands = this.entityResolver.resolveBrands(snapshot.products);
    const products = this.entityResolver.resolveProducts(
      snapshot.products,
      categories,
      brands,
      snapshot.pages,
      snapshot.schemas,
    );
    const attributes = this.entityResolver.resolveAttributes(snapshot.products);
    const pages = this.entityResolver.resolvePages(
      snapshot.pages,
      products,
      categories,
    );
    const schemas = this.entityResolver.resolveSchemas(
      snapshot.schemas,
      products,
    );
    const faqs = this.entityResolver.resolveFAQs(schemas);

    const relationships = this.relationshipBuilder.buildRelationships(
      products,
      categories,
      brands,
      attributes,
      pages,
      schemas,
    );

    const indexes = this.searchIndexBuilder.buildIndexes(
      products,
      categories,
      brands,
      attributes,
      pages,
      schemas,
    );

    const issues = this.detectIssues(
      snapshot,
      products,
      categories,
      brands,
      attributes,
    );

    return {
      site: {
        baseUrl: snapshot.site.baseUrl,
        host: snapshot.site.host,
        title: snapshot.site.title,
        description: snapshot.site.description,
      },
      products,
      categories,
      brands,
      attributes,
      pages,
      schemas,
      faqs,
      relationships,
      indexes,
      issues,
      catalogCount: snapshot.catalogCount,
    };
  }

  private detectIssues(
    snapshot: SiteSnapshot,
    products: ProductEntity[],
    categories: CategoryEntity[],
    brands: BrandEntity[],
    attributes: AttributeEntity[],
  ): string[] {
    const issues: string[] = [];
    const productsWithAttributes = new Set(
      attributes.flatMap((attribute) => attribute.productIds),
    );

    products.forEach((product) => {
      if (!product.category) {
        issues.push(`Produto sem categoria: ${product.name}`);
      }
      if (!product.brand) {
        issues.push(`Produto sem marca: ${product.name}`);
      }
      if (!productsWithAttributes.has(product.id)) {
        issues.push(`Produto sem atributos: ${product.name}`);
      }
    });

    if (categories.length === 0) {
      issues.push("Categoria vazia");
    }

    if (brands.length === 0) {
      issues.push("Marca vazia");
    }

    if (snapshot.schemas.length > 0 && products.length === 0) {
      issues.push("Schema sem Product correspondente");
    }

    return issues;
  }
}
