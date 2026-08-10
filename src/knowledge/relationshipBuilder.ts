import type {
  ProductEntity,
  CategoryEntity,
  BrandEntity,
  AttributeEntity,
  PageEntity,
  SchemaEntity,
} from "./entityResolver.js";

export interface Relationship {
  id: string;
  from: string;
  to: string;
  type:
    | "BELONGS_TO"
    | "HAS_ATTRIBUTE"
    | "HAS_BRAND"
    | "REPRESENTS";
}

export class RelationshipBuilder {
  buildRelationships(
    products: ProductEntity[],
    categories: CategoryEntity[],
    brands: BrandEntity[],
    attributes: AttributeEntity[],
    pages: PageEntity[],
    schemas: SchemaEntity[],
  ): Relationship[] {
    const relationships: Relationship[] = [];
    const categoriesById = new Map(
      categories.map((category) => [category.id, category]),
    );
    const brandsById = new Map(brands.map((brand) => [brand.id, brand]));
    const attributesByProduct = new Map<string, AttributeEntity[]>();
    for (const attribute of attributes) {
      for (const productId of attribute.productIds) {
        const items = attributesByProduct.get(productId) ?? [];
        items.push(attribute);
        attributesByProduct.set(productId, items);
      }
    }

    products.forEach((product, index) => {
      const category = product.categoryId
        ? categoriesById.get(product.categoryId)
        : undefined;
      if (category) {
        relationships.push({
          id: `rel:${index + 1}`,
          from: product.id,
          to: category.id,
          type: "BELONGS_TO",
        });
      }

      const brand = product.brandId
        ? brandsById.get(product.brandId)
        : undefined;
      if (brand) {
        relationships.push({
          id: `rel:${index + 1}:brand`,
          from: product.id,
          to: brand.id,
          type: "HAS_BRAND",
        });
      }

      (attributesByProduct.get(product.id) ?? [])
        .forEach((attribute) => {
          relationships.push({
            id: `rel:${index + 1}:attr`,
            from: product.id,
            to: attribute.id,
            type: "HAS_ATTRIBUTE",
          });
        });
    });

    pages.forEach((page, index) => {
      if (page.type === "product") {
        page.productIds.forEach((productId) => {
          relationships.push({
            id: `rel:page:${index + 1}`,
            from: page.id,
            to: productId,
            type: "REPRESENTS",
          });
        });
      }

      if (page.type === "category") {
        page.categoryIds.forEach((categoryId) => {
          relationships.push({
            id: `rel:page:${index + 1}:cat`,
            from: page.id,
            to: categoryId,
            type: "REPRESENTS",
          });
        });
      }
    });

    schemas.forEach((schema, index) => {
      schema.productIds.forEach((productId) => {
        relationships.push({
          id: `rel:schema:${index + 1}`,
          from: schema.id,
          to: productId,
          type: "REPRESENTS",
        });
      });
    });

    return relationships;
  }
}
