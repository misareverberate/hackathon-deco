import type { KnowledgeBase } from "../knowledge/knowledgeBuilder.js";

export interface ProductSample {
  id: string;
  name: string;
  price?: string;
  brand?: string;
  url: string;
  categoryId: string;
  categoryName: string;
  attributes: Record<string, string>;
  schema: Record<string, unknown> | null;
}

const MAX_SAMPLES = 6;

export function buildProductSamples(knowledge: KnowledgeBase): ProductSample[] {
  const samples: ProductSample[] = [];
  const seenProductIds = new Set<string>();

  for (const category of knowledge.categories) {
    if (samples.length >= MAX_SAMPLES) {
      break;
    }
    const ranked = category.productIds
      .map((productId) => knowledge.products.find((p) => p.id === productId))
      .filter((product): product is NonNullable<typeof product> => product !== undefined)
      .sort((a, b) => (b.schemaIds.length > 0 ? 1 : 0) - (a.schemaIds.length > 0 ? 1 : 0));

    const product = ranked[0];
    if (!product || seenProductIds.has(product.id)) {
      continue;
    }
    seenProductIds.add(product.id);

    const attributes: Record<string, string> = {};
    knowledge.attributes
      .filter((attribute) => attribute.productIds.includes(product.id))
      .forEach((attribute) => {
        attributes[attribute.name] = attribute.value;
      });

    const schemaId = product.schemaIds[0];
    const schemaEntity = schemaId
      ? knowledge.schemas.find((schema) => schema.id === schemaId)
      : undefined;

    samples.push({
      id: product.id,
      name: product.name,
      price: product.price,
      brand: product.brand,
      url: product.url,
      categoryId: product.categoryId ?? category.id,
      categoryName: product.category ?? category.name,
      attributes,
      schema: schemaEntity?.raw ?? null,
    });
  }

  return samples;
}
