import type { EvaluationResult } from "./types.js";

export class GapAnalyzer {
  analyzeMissingAttributes(
    evaluations: EvaluationResult[],
  ): Record<string, number> {
    return evaluations.reduce<Record<string, number>>((acc, evaluation) => {
      evaluation.missingAttributes.forEach((attribute) => {
        acc[attribute] = (acc[attribute] ?? 0) + 1;
      });
      return acc;
    }, {});
  }

  analyzePageProblems(
    evaluations: EvaluationResult[],
    productPageMap: Record<string, string>,
    pageUrlMap: Record<string, string>,
  ): { pageProblems: { pageId: string; url: string; reason: string }[] } {
    const pageProblems: { pageId: string; url: string; reason: string }[] = [];

    evaluations
      .filter((evaluation) => evaluation.status !== "SUCCESS")
      .forEach((evaluation) => {
        evaluation.productIds.forEach((productId) => {
          const pageId = productPageMap[productId];
          if (pageId) {
            const reason =
              evaluation.status === "FAIL"
                ? `Falha no produto ${productId}: ${evaluation.explanation}`
                : `Resposta parcial no produto ${productId}: ${evaluation.explanation}`;
            pageProblems.push({
              pageId,
              url: pageUrlMap[pageId] ?? "",
              reason,
            });
          }
        });
      });

    return { pageProblems };
  }
}
