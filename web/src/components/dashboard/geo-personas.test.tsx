import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { GeoPersonasSection } from "@/components/dashboard/geo-personas";
import { mockReport } from "@/lib/mockReport";
import type { GeoReport } from "@/lib/report";

const baseGeo: GeoReport = mockReport.geo!;

function geoWithQuestions(questionsTested: number): GeoReport {
  return {
    ...baseGeo,
    questionsTested,
    personaScores:
      questionsTested === 0
        ? baseGeo.personaScores.map((score) => ({
            ...score,
            questions: 0,
            successRate: 0,
            avgConfidence: 0,
          }))
        : baseGeo.personaScores,
    evaluations: questionsTested === 0 ? [] : baseGeo.evaluations,
  };
}

describe("GeoPersonasSection", () => {
  it("exibe aviso honesto quando nenhuma pergunta pôde ser simulada", () => {
    render(<GeoPersonasSection geo={geoWithQuestions(0)} />);

    expect(
      screen.getByText(/A loja não expôs produtos utilizáveis pela simulação/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Sem dados")).toHaveLength(4);
  });

  it("não exibe aviso quando há perguntas simuladas", () => {
    render(<GeoPersonasSection geo={geoWithQuestions(42)} />);

    expect(
      screen.queryByText(/A loja não expôs produtos utilizáveis/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/Loja não responde|Resposta parcial|Loja responde bem/i)
        .length,
    ).toBeGreaterThan(0);
  });
});
