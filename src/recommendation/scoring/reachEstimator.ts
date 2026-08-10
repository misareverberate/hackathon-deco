import type { KnowledgeBase } from "../../knowledge/knowledgeBuilder.js";
import type { ImpactConfig } from "../config/impactConfig.js";

export interface ReachEstimate {
  reach: number;
  averageCategoryWeight: number;
}

export class ReachEstimator {
  estimate(
    config: ImpactConfig,
    knowledge: KnowledgeBase,
    affectedProductIds: string[] | undefined,
    affectedProducts: number | undefined,
  ): ReachEstimate {
    const ids = affectedProductIds ?? [];
    const byId = new Map(knowledge.products.map((product) => [product.id, product]));
    const resolved = ids
      .map((id) => byId.get(id))
      .filter(
        (product): product is NonNullable<typeof product> =>
          product !== undefined,
      );

    let averageCategoryWeight = config.defaultCategoryWeight;
    if (resolved.length > 0) {
      const total = resolved.reduce(
        (sum, product) => sum + this.categoryWeight(config, product.category),
        0,
      );
      averageCategoryWeight = total / resolved.length;
    }

    const count = Math.max(1, affectedProducts ?? ids.length);
    return {
      reach: count * averageCategoryWeight,
      averageCategoryWeight,
    };
  }

  private categoryWeight(
    config: ImpactConfig,
    category: string | undefined,
  ): number {
    if (!category) {
      return config.defaultCategoryWeight;
    }
    return config.weights.category[category] ?? config.defaultCategoryWeight;
  }
}
