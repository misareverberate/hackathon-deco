import { RoadmapPhase } from "./types.js";
import type { Recommendation } from "./types.js";

export class RoadmapBuilder {
  build(recommendations: Recommendation[]): RoadmapPhase[] {
    const phase1 = recommendations.filter(
      (recommendation) =>
        recommendation.score >= 60 &&
        (recommendation.effort === "muito_baixo" ||
          (recommendation.automatable && recommendation.effort === "baixo")),
    );
    const phase1Ids = new Set(phase1.map((recommendation) => recommendation.id));

    const phase2 = recommendations.filter(
      (recommendation) =>
        !phase1Ids.has(recommendation.id) &&
        (recommendation.effort === "baixo" ||
          recommendation.effort === "medio" ||
          (recommendation.category === "Schema" &&
            recommendation.effort !== "alto") ||
          (recommendation.category === "Produto" &&
            recommendation.effort !== "alto")),
    );
    const phase2Ids = new Set(phase2.map((recommendation) => recommendation.id));

    const phase3 = recommendations.filter(
      (recommendation) =>
        !phase1Ids.has(recommendation.id) && !phase2Ids.has(recommendation.id),
    );

    return [
      {
        phase: 1,
        name: "Fase 1 — Correções rápidas",
        objective:
          "Ações de alto impacto e baixo esforço, priorizadas para execução imediata.",
        recommendations: phase1,
      },
      {
        phase: 2,
        name: "Fase 2 — Correções estruturais",
        objective:
          "Ajustes estruturais de dados e marcação que exigem planejamento moderado.",
        recommendations: phase2,
      },
      {
        phase: 3,
        name: "Fase 3 — Otimizações avançadas",
        objective:
          "Otimizações de maior esforço ou menor retorno imediato, para execução contínua.",
        recommendations: phase3,
      },
    ];
  }
}
