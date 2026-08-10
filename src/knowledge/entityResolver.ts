import type {
  Product as ProductModel,
  Category as CategoryModel,
  Page as PageModel,
  Schema as SchemaModel,
} from "../models.js";
import { Normalizer } from "./normalizer.js";

export interface ProductEntity {
  id: string;
  name: string;
  normalizedName: string;
  url: string;
  price?: string;
  description?: string;
  brand?: string;
  brandId?: string;
  category?: string;
  categoryId?: string;
  sku?: string;
  availability?: string;
  attributes: string[];
  pageIds: string[];
  schemaIds: string[];
}

export interface CategoryEntity {
  id: string;
  name: string;
  normalizedName: string;
  url: string;
  productIds: string[];
  pageIds: string[];
}

export interface BrandEntity {
  id: string;
  name: string;
  normalizedName: string;
  productIds: string[];
}

export interface AttributeEntity {
  id: string;
  name: string;
  normalizedName: string;
  value: string;
  normalizedValue: string;
  productIds: string[];
}

export interface PageEntity {
  id: string;
  title?: string;
  description?: string;
  canonical?: string;
  url: string;
  type: string;
  productIds: string[];
  categoryIds: string[];
}

export interface SchemaEntity {
  id: string;
  type: string;
  raw: Record<string, unknown>;
  productIds: string[];
}

export interface FAQEntity {
  id: string;
  question?: string;
  answer?: string;
}

export class EntityResolver {
  constructor(private readonly normalizer = new Normalizer()) {}

  resolveCategories(
    categories: CategoryModel[],
    pages: PageModel[],
  ): CategoryEntity[] {
    const pageIdsByUrl = this.idsByUrl(pages);
    return categories.map((category, index) => ({
      id: `category:${index + 1}`,
      name: category.name,
      normalizedName: this.normalizeCategoryName(category.name),
      url: category.url,
      productIds: [],
      pageIds: pageIdsByUrl.get(category.url) ?? [],
    }));
  }

  resolveBrands(products: ProductModel[]): BrandEntity[] {
    const brandMap = new Map<string, string>();
    const brandNames: string[] = [];

    products.forEach((product) => {
      if (!product.brand) {
        return;
      }

      const normalized = this.normalizeBrandName(product.brand);
      if (!brandMap.has(normalized)) {
        brandMap.set(normalized, `brand:${brandMap.size + 1}`);
        brandNames.push(product.brand);
      }
    });

    return Array.from(brandMap.entries()).map(
      ([normalizedName, id], index) => ({
        id,
        name: brandNames[index],
        normalizedName,
        productIds: [],
      }),
    );
  }

  resolveProducts(
    products: ProductModel[],
    categories: CategoryEntity[],
    brands: BrandEntity[],
    pages: PageModel[],
    schemas: SchemaModel[],
  ): ProductEntity[] {
    const categoryMap = new Map(
      categories.map((category) => [category.normalizedName, category.id]),
    );
    const brandMap = new Map(
      brands.map((brand) => [brand.normalizedName, brand.id]),
    );

    const schemaIdsByUrl = this.buildSchemaIdsByUrl(pages, schemas);
    const pageIdsByUrl = this.idsByUrl(pages);
    const categoriesById = new Map(categories.map((category) => [category.id, category]));
    const brandsById = new Map(brands.map((brand) => [brand.id, brand]));

    return products.map((product, index) => {
      const id = `product:${index + 1}`;
      const normalizedCategory = product.category
        ? this.normalizeCategoryName(product.category)
        : undefined;
      const normalizedBrand = product.brand
        ? this.normalizeBrandName(product.brand)
        : undefined;
      const categoryId = normalizedCategory
        ? categoryMap.get(normalizedCategory)
        : undefined;
      const brandId = normalizedBrand
        ? brandMap.get(normalizedBrand)
        : undefined;
      const pageIds = pageIdsByUrl.get(product.url) ?? [];
      const schemaIds = schemaIdsByUrl.get(product.url) ?? [];

      const categoryEntity = categoryId ? categoriesById.get(categoryId) : undefined;
      if (categoryEntity && !categoryEntity.productIds.includes(id)) {
        categoryEntity.productIds.push(id);
      }

      const brandEntity = brandId ? brandsById.get(brandId) : undefined;
      if (brandEntity && !brandEntity.productIds.includes(id)) {
        brandEntity.productIds.push(id);
      }

      return {
        id,
        name: product.name ?? "Sem nome",
        normalizedName: this.normalizeProductName(product.name ?? ""),
        url: product.url,
        price: product.price,
        description: product.description,
        brand: product.brand,
        brandId,
        category: product.category,
        categoryId,
        sku: product.sku,
        availability: product.availability,
        attributes: Object.keys(product.attributes ?? {}),
        pageIds,
        schemaIds,
      };
    });
  }

  resolveAttributes(products: ProductModel[]): AttributeEntity[] {
    const attributeMap = new Map<string, AttributeEntity>();

    products.forEach((product, productIndex) => {
      Object.entries(product.attributes ?? {}).forEach(([name, value]) => {
        const normalizedName = this.normalizeAttributeName(name);
        const normalizedValue = this.normalizeAttributeValue(value);
        const key = `${normalizedName}:${normalizedValue}`;
        const productId = `product:${productIndex + 1}`;

        if (attributeMap.has(key)) {
          const existing = attributeMap.get(key)!;
          if (!existing.productIds.includes(productId)) {
            existing.productIds.push(productId);
          }
          return;
        }

        attributeMap.set(key, {
          id: `attribute:${attributeMap.size + 1}`,
          name,
          normalizedName,
          value,
          normalizedValue,
          productIds: [productId],
        });
      });
    });

    return Array.from(attributeMap.values());
  }

  resolvePages(
    pages: PageModel[],
    products: ProductEntity[],
    categories: CategoryEntity[],
  ): PageEntity[] {
    const productIdsByUrl = new Map<string, string[]>();
    const categoryIdsByUrl = new Map<string, string[]>();
    for (const product of products) {
      const ids = productIdsByUrl.get(product.url) ?? [];
      ids.push(product.id);
      productIdsByUrl.set(product.url, ids);
    }
    for (const category of categories) {
      const ids = categoryIdsByUrl.get(category.url) ?? [];
      ids.push(category.id);
      categoryIdsByUrl.set(category.url, ids);
    }
    return pages.map((page, index) => ({
      id: `page:${index + 1}`,
      title: page.title,
      description: page.description,
      canonical: page.canonical,
      url: page.url,
      type: page.type,
      productIds: productIdsByUrl.get(page.url) ?? [],
      categoryIds: categoryIdsByUrl.get(page.url) ?? [],
    }));
  }

  resolveSchemas(
    schemas: SchemaModel[],
    products: ProductEntity[],
  ): SchemaEntity[] {
    const productIdsBySchema = new Map<string, string[]>();
    for (const product of products) {
      for (const schemaId of product.schemaIds) {
        const ids = productIdsBySchema.get(schemaId) ?? [];
        ids.push(product.id);
        productIdsBySchema.set(schemaId, ids);
      }
    }
    return schemas.map((schema, index) => ({
      id: `schema:${index + 1}`,
      type: schema.type,
      raw: schema.raw,
      productIds: productIdsBySchema.get(`schema:${index + 1}`) ?? [],
    }));
  }

  resolveFAQs(schemas: SchemaEntity[]): FAQEntity[] {
    const faqs: FAQEntity[] = [];
    schemas.forEach((schema) => {
      if (schema.type.toLowerCase() !== "faqpage") {
        return;
      }
      const mainEntity = schema.raw["mainEntity"];
      const items = Array.isArray(mainEntity)
        ? mainEntity
        : mainEntity && typeof mainEntity === "object"
          ? [mainEntity]
          : [];
      items.forEach((item) => {
        if (typeof item !== "object" || item === null || Array.isArray(item)) {
          return;
        }
        const record = item as Record<string, unknown>;
        const type = record["@type"];
        const isQuestion =
          type === "Question" ||
          (Array.isArray(type) && type.includes("Question"));
        if (!isQuestion) {
          return;
        }
        const acceptedAnswer = record["acceptedAnswer"];
        const answerText =
          acceptedAnswer &&
          typeof acceptedAnswer === "object" &&
          !Array.isArray(acceptedAnswer)
            ? (acceptedAnswer as Record<string, unknown>)["text"]
            : undefined;
        const question =
          typeof record["name"] === "string" ? record["name"] : undefined;
        const answer =
          typeof answerText === "string"
            ? answerText
            : typeof record["text"] === "string"
              ? record["text"]
              : undefined;
        if (!question && !answer) {
          return;
        }
        faqs.push({
          id: `faq:${faqs.length + 1}`,
          question,
          answer,
        });
      });
    });
    return faqs;
  }

  private idsByUrl(items: Array<{ url: string }>): Map<string, string[]> {
    const ids = new Map<string, string[]>();
    items.forEach((item, index) => {
      const values = ids.get(item.url) ?? [];
      values.push(`page:${index + 1}`);
      ids.set(item.url, values);
    });
    return ids;
  }

  private buildSchemaIdsByUrl(
    pages: PageModel[],
    schemas: SchemaModel[],
  ): Map<string, string[]> {
    const schemaIdsByUrl = new Map<string, string[]>();
    const schemaByRawUrl = new Map<string, string>();

    schemas.forEach((schema, schemaIndex) => {
      const rawUrl =
        typeof schema.raw?.["url"] === "string"
          ? schema.raw["url"]
          : typeof schema.raw?.["@id"] === "string"
            ? schema.raw["@id"]
            : typeof schema.url === "string"
              ? schema.url
              : undefined;
      if (rawUrl) {
        schemaByRawUrl.set(rawUrl, `schema:${schemaIndex + 1}`);
      }
    });

    let schemaIndex = 0;
    pages.forEach((page) => {
      const ids: string[] = [];
      for (let index = 0; index < page.schemas.length; index += 1) {
        const id = `schema:${schemaIndex + 1}`;
        if (!ids.includes(id)) {
          ids.push(id);
        }
        schemaIndex += 1;
      }
      const rawId = schemaByRawUrl.get(page.url);
      if (rawId && !ids.includes(rawId)) {
        ids.push(rawId);
      }
      if (ids.length > 0) {
        schemaIdsByUrl.set(page.url, ids);
      }
    });

    return schemaIdsByUrl;
  }

  private normalizeProductName(name: string): string {
    return this.normalizer.normalizeProductName(name);
  }

  private normalizeCategoryName(name: string): string {
    return this.normalizer.normalizeCategoryName(name);
  }

  private normalizeBrandName(name: string): string {
    return this.normalizer.normalizeBrandName(name);
  }

  private normalizeAttributeName(name: string): string {
    return this.normalizer.normalizeAttributeName(name);
  }

  private normalizeAttributeValue(value: string): string {
    return this.normalizer.normalizeAttributeValue(value);
  }
}
