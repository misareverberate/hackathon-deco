import type {
  EvaluationResult,
  GeoReadinessReport,
  CategoryScore,
  BuyerPersona,
  PersonaScore,
} from "./types.js";
import { BUYER_PERSONAS } from "./personas.js";

export class Scoring {
  calculate(
    evaluations: EvaluationResult[],
    schemaCoverage: number,
  ): GeoReadinessReport["overallScore"] {
    const total = evaluations.length;
    if (total === 0) return 0;

    const avgConfidence =
      evaluations.reduce(
        (sum, evaluation) =>
          sum + (evaluation.productIds.length > 0 ? evaluation.confidence : 0),
        0,
      ) / total;
    const successCount = evaluations.filter(
      (evaluation) =>
        evaluation.status === "SUCCESS" &&
        evaluation.productIds.length > 0 &&
        evaluation.missingAttributes.length === 0,
    ).length;
    const successRate = successCount / total;
    const totalMissing = evaluations.reduce(
      (sum, evaluation) => sum + evaluation.missingAttributes.length,
      0,
    );
    const attributeCoverage =
      total === 0 ? 0 : Math.max(0, 1 - totalMissing / Math.max(total * 3, 1));

    const score = Math.round(
      avgConfidence * 0.25 + successRate * 55 + attributeCoverage * 15 + schemaCoverage * 5,
    );
    return Math.min(Math.max(score, 0), 100);
  }

  buildCategoryScores(evaluations: EvaluationResult[]): CategoryScore[] {
    const grouped = evaluations.reduce<
      Record<string, { name: string; total: number; success: number }>
    >((acc, evaluation) => {
      const group = acc[evaluation.categoryId] ?? {
        name: evaluation.categoryName,
        total: 0,
        success: 0,
      };
      group.total += 1;
      if (
        evaluation.status === "SUCCESS" &&
        evaluation.productIds.length > 0 &&
        evaluation.missingAttributes.length === 0
      ) {
        group.success += 1;
      }
      acc[evaluation.categoryId] = group;
      return acc;
    }, {});

    return Object.entries(grouped).map(([categoryId, value]) => ({
      categoryId,
      categoryName: value.name,
      total: value.total,
      successRate: value.total === 0 ? 0 : value.success / value.total,
    }));
  }

  buildPersonaScores(evaluations: EvaluationResult[]): PersonaScore[] {
    const grouped = evaluations.reduce<
      Record<BuyerPersona, { total: number; success: number; confidence: number }>
    >(
      (acc, evaluation) => {
        const group = acc[evaluation.persona] ?? {
          total: 0,
          success: 0,
          confidence: 0,
        };
        group.total += 1;
        group.confidence += evaluation.confidence;
        if (
          evaluation.status === "SUCCESS" &&
          evaluation.productIds.length > 0 &&
          evaluation.missingAttributes.length === 0
        ) {
          group.success += 1;
        }
        acc[evaluation.persona] = group;
        return acc;
      },
      { price: { total: 0, success: 0, confidence: 0 }, spec: { total: 0, success: 0, confidence: 0 }, brand: { total: 0, success: 0, confidence: 0 }, compare: { total: 0, success: 0, confidence: 0 } },
    );

    return BUYER_PERSONAS.map((persona) => {
      const group = grouped[persona.id];
      return {
        persona: persona.id,
        label: persona.label,
        questions: group.total,
        successRate: group.total === 0 ? 0 : group.success / group.total,
        avgConfidence:
          group.total === 0 ? 0 : Math.round(group.confidence / group.total),
      };
    });
  }
}
