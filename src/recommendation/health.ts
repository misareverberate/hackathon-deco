import type { ImpactConfig } from "./config/impactConfig.js";
import { explanation, input } from "./explanation/explanationBuilder.js";
import type { HealthGrade, HealthResult } from "./types.js";

export interface HealthGradeInfo {
  grade: HealthGrade;
  label: string;
}

export function healthGrade(
  score: number,
  config: ImpactConfig,
): HealthGradeInfo {
  const t = config.healthGradeThresholds;
  if (score >= t.a) {
    return { grade: "A", label: "Excelente" };
  }
  if (score >= t.b) {
    return { grade: "B", label: "Bom" };
  }
  if (score >= t.c) {
    return { grade: "C", label: "Regular" };
  }
  if (score >= t.d) {
    return { grade: "D", label: "Ruim" };
  }
  if (score >= t.e) {
    return { grade: "E", label: "Muito Ruim" };
  }
  return { grade: "F", label: "Crítico" };
}

export function healthResult(score: number, config: ImpactConfig): HealthResult {
  const { grade, label } = healthGrade(score, config);
  return {
    score,
    grade,
    label,
    explanation: explanation(
      {
        metric: "health",
        summary: `Health Score ${score}/100 — nível "${label}" (nota ${grade}).`,
        formula:
          "health = 100 − score médio das oportunidades detectadas (ou valor fornecido)",
        inputs: [
          input("healthScore", "Health Score", `${score}/100`, score),
          input("grade", "Nota", grade),
          input("label", "Classificação", label),
        ],
        assumptions: [
          "A nota (A–F) contextualiza o número e evita leituras literalistas de 0/100.",
          "Valores baixos indicam problemas severos, não falha da ferramenta.",
        ],
      },
      config,
    ),
  };
}
