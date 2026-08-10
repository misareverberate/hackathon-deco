import type {
  ProductEntity,
  CategoryEntity,
  BrandEntity,
  AttributeEntity,
  PageEntity,
  SchemaEntity,
} from "./entityResolver.js";

export interface SearchIndexes {
  productsByCategory: Record<string, string[]>;
  productsByBrand: Record<string, string[]>;
  productsByAttribute: Record<string, string[]>;
  productsByUrl: Record<string, string[]>;
  categories: string[];
  schemas: string[];
  pages: string[];
}

export class SearchIndexBuilder {
  buildIndexes(
    products: ProductEntity[],
    categories: CategoryEntity[],
    brands: BrandEntity[],
    attributes: AttributeEntity[],
    pages: PageEntity[],
    schemas: SchemaEntity[],
  ): SearchIndexes {
    return {
      productsByCategory: categories.reduce<Record<string, string[]>>(
        (acc, category) => {
          acc[`category:${category.normalizedName}`] = category.productIds;
          return acc;
        },
        {},
      ),
      productsByBrand: brands.reduce<Record<string, string[]>>((acc, brand) => {
        acc[`brand:${brand.normalizedName}`] = brand.productIds;
        return acc;
      }, {}),
      productsByAttribute: attributes.reduce<Record<string, string[]>>(
        (acc, attribute) => {
          acc[`attribute:${attribute.normalizedName}`] = attribute.productIds;
          return acc;
        },
        {},
      ),
      productsByUrl: products.reduce<Record<string, string[]>>((acc, product) => {
        acc[product.url] = [product.id];
        return acc;
      }, {}),
      categories: categories.map((category) => category.normalizedName),
      schemas: schemas.map((schema) => schema.id),
      pages: pages.map((page) => page.id),
    };
  }
}
