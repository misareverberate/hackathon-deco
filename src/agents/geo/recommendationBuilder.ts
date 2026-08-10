import type { GeoRecommendation, EvaluationResult } from "./types.js";

export class RecommendationBuilder {
  build(
    evaluations: EvaluationResult[],
    missingAttributes: Record<string, number>,
  ): GeoRecommendation[] {
    const recommendations: GeoRecommendation[] = [];
    const sortedAttributes = Object.entries(missingAttributes).sort(
      (a, b) => b[1] - a[1],
    );

    sortedAttributes.slice(0, 3).forEach(([attribute, count]) => {
      const affectedProductIds = new Set(
        evaluations
          .filter((evaluation) => evaluation.missingAttributes.includes(attribute))
          .flatMap((evaluation) => evaluation.productIds),
      );
      recommendations.push({
        title: `Adicionar atributo estruturado ${attribute} em produtos relevantes`,
        impact: "high",
        affectedProducts: affectedProductIds.size || count,
        reason: `O atributo ${attribute} apareceu como falta em ${count} perguntas de compra.`,
      });
    });

    if (evaluations.some((evaluation) => evaluation.status === "FAIL")) {
      const failed = evaluations.filter((evaluation) => evaluation.status === "FAIL");
      const failedProductIds = new Set(failed.flatMap((evaluation) => evaluation.productIds));
      recommendations.push({
        title: "Revisar dados estruturados em produtos com falha",
        impact: "medium",
        affectedProducts: failedProductIds.size || failed.length,
        reason:
          "Perguntas de compra falharam porque produtos não forneceram informações estruturadas suficientes.",
      });
    }

    return recommendations;
  }
}
