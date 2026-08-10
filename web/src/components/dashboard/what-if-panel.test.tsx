import { describe, expect, it } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WhatIfPanel } from "@/components/dashboard/what-if-panel";
import { mockReport } from "@/lib/mockReport";
import type {
  BusinessImpact,
  ExplanationInput,
  MetricExplanation,
  Recommendation,
  RecommendationReport,
} from "@/lib/report";

function explanation(
  metric: string,
  inputs: ExplanationInput[],
): MetricExplanation {
  return {
    metric,
    summary: "s",
    formula: "f",
    inputs,
    rationale: [],
    assumptions: [],
    modelVersion: "1.1",
  };
}

function input(key: string, label: string, value: number): ExplanationInput {
  return { key, label, display: String(value), value };
}

const businessImpact: BusinessImpact = {
  opportunity: {
    score: 80,
    coverage: 0.5,
    severity: 0.5,
    businessWeight: 0.5,
    reach: 10,
    normalizedReach: 0.5,
    explanation: explanation("opportunityScore", []),
  },
  businessImpactLevel: "high",
  traffic: {
    perMonth: { low: 0, high: 0 },
    perYear: { low: 13500, high: 40500 },
    explanation: explanation("traffic", [
      input("monthlySessions", "Sessões/mês", 45000),
      input("denominator", "Denominador", 100),
      input("coverage", "Cobertura", 0.5),
      input("ctrLiftMin", "CTR lift min", 0.05),
      input("ctrLiftMax", "CTR lift max", 0.15),
      input("months", "Meses/ano", 12),
    ]),
  },
  revenue: {
    low: 135000,
    high: 405000,
    currency: "BRL",
    explanation: explanation("revenue", [
      input("conversion", "Conversão", 0.02),
      input("ticket", "Ticket", 500),
    ]),
  },
  costAvoided: {
    low: 1440,
    high: 2160,
    currency: "BRL",
    explanation: explanation("costAvoided", [
      input("affected", "Produtos", 10),
      input("hoursPerTask", "Horas/tarefa", 0.25),
      input("frequency", "Frequência", 12),
      input("laborCost", "Mão de obra/h", 60),
    ]),
  },
  confidence: {
    label: "MEDIUM",
    score: 70,
    quality: { coverageQuality: 1, freshness: 1, completeness: 1 },
    explanation: explanation("confidence", []),
  },
  evidence: {
    sources: ["CRAWLER"],
    missingSources: [],
    level: "MEDIUM",
    description: "d",
    explanation: explanation("evidence", []),
  },
  overlap: { index: 0, risk: "none" },
};

const recommendation: Recommendation = {
  id: "rec:a",
  opportunityId: "rec:a",
  title: "Atrativos GEO",
  description: "d",
  category: "GEO",
  priority: "alta",
  impact: "alto",
  confidence: 80,
  effort: "baixo",
  automatable: true,
  score: 80,
  expectedImpact: "Alto",
  action: { title: "t", description: "d", steps: [] },
  businessImpact,
};

function reportWithImpact(): RecommendationReport {
  return {
    ...mockReport,
    businessInput: {
      avgTicket: 500,
      organicConversionRate: 0.02,
      monthlyOrganicSessions: 45000,
      laborCostPerHour: 60,
    },
    recommendations: [recommendation],
  };
}

describe("WhatIfPanel", () => {
  it("exibe o potencial máximo base", () => {
    render(<WhatIfPanel report={reportWithImpact()} />);

    expect(screen.getByLabelText("What-if econômico")).toBeInTheDocument();
    expect(
      screen.getAllByText(/R\$\s*135\.000\s*–\s*R\$\s*405\.000/).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/R\$\s*120\s*–\s*R\$\s*180/).length,
    ).toBeGreaterThan(0);
  });

  it("recalcula receita ao mover o slider de ticket médio", () => {
    render(<WhatIfPanel report={reportWithImpact()} />);

    const slider = screen.getByLabelText("Ticket médio");
    fireEvent.change(slider, { target: { value: "1000" } });

    expect(
      screen.getAllByText(/R\$\s*270\.000\s*–\s*R\$\s*810\.000/).length,
    ).toBeGreaterThan(0);
  });

  it("recalcula custo evitado ao mover o slider de mão de obra", () => {
    render(<WhatIfPanel report={reportWithImpact()} />);

    const slider = screen.getByLabelText("Mão de obra (R$/h)");
    fireEvent.change(slider, { target: { value: "120" } });

    expect(
      screen.getAllByText(/R\$\s*240\s*–\s*R\$\s*360/).length,
    ).toBeGreaterThan(0);
  });

  it("restaura a base ao clicar em restaurar", () => {
    render(<WhatIfPanel report={reportWithImpact()} />);

    const reset = screen.getByRole("button", { name: /Restaurar base/i });
    expect(reset).toBeDisabled();

    const slider = screen.getByLabelText("Ticket médio");
    fireEvent.change(slider, { target: { value: "1000" } });
    expect(reset).toBeEnabled();

    fireEvent.click(reset);
    expect(
      screen.getAllByText(/R\$\s*135\.000\s*–\s*R\$\s*405\.000/).length,
    ).toBeGreaterThan(0);
  });

  it("carrega as premissas da nova análise ao trocar o relatório", async () => {
    const { rerender } = render(<WhatIfPanel report={reportWithImpact()} />);
    fireEvent.change(screen.getByLabelText("Conversão orgânica"), {
      target: { value: "4" },
    });

    const nextReport: RecommendationReport = {
      ...reportWithImpact(),
      analysisId: "analysis-with-zero-conversion",
      businessInput: {
        ...(reportWithImpact().businessInput ?? {}),
        organicConversionRate: 0,
      },
    };
    rerender(<WhatIfPanel report={nextReport} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Conversão orgânica")).toHaveValue("0");
    });
    expect(screen.getAllByText(/R\$\s*0\s*–\s*R\$\s*0/).length).toBeGreaterThan(0);
  });

  it("não apresenta crescimento percentual artificial sobre uma base zero", () => {
    const report: RecommendationReport = {
      ...reportWithImpact(),
      businessInput: {
        ...(reportWithImpact().businessInput ?? {}),
        organicConversionRate: 0,
      },
      impactEstimate: {
        ...reportWithImpact().impactEstimate,
        aggregate: undefined,
      },
    };
    render(<WhatIfPanel report={report} />);

    fireEvent.change(screen.getByLabelText("Conversão orgânica"), {
      target: { value: "2" },
    });

    expect(screen.getByTestId("delta-receita")).toHaveTextContent("novo cenário");
  });

  it("exibe a tabela por recomendação destacando a maior oportunidade", () => {
    render(<WhatIfPanel report={reportWithImpact()} />);

    expect(screen.getByText(/Maior oportunidade/i)).toBeInTheDocument();
    expect(screen.getAllByText("Atrativos GEO").length).toBeGreaterThan(0);
    expect(screen.getAllByText("destaque").length).toBeGreaterThan(0);
    expect(screen.getByText("Execução evitada")).toBeInTheDocument();
    expect(screen.getByText("Sessões/ano")).toBeInTheDocument();
    expect(screen.getAllByText("Hipótese").length).toBeGreaterThan(0);
    expect(screen.getByText("Dados observados")).toBeInTheDocument();
    expect(screen.getByText("Hipóteses do modelo")).toBeInTheDocument();
    expect(screen.getByText("Impacto estimado")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Evidência do mecanismo no Google/i }),
    ).toHaveAttribute(
      "href",
      "https://developers.google.com/search/docs/specialty/ecommerce/share-your-product-data-with-google",
    );
  });

  it("recalcula o cenário ao remover ações do portfólio", () => {
    render(<WhatIfPanel report={reportWithImpact()} />);

    fireEvent.click(screen.getByRole("button", { name: "Limpar" }));

    expect(screen.getByText("0 de 1 ações incluídas no cálculo")).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s*0\s*–\s*R\$\s*0/).length).toBeGreaterThan(0);
  });

  it("exibe o aviso de sobreposição quando o agregado está presente", () => {
    const report = reportWithImpact();
    const withAggregate: RecommendationReport = {
      ...report,
      impactEstimate: {
        ...report.impactEstimate,
        aggregate: {
          headline: {
            recommendationId: "rec:a",
            title: "Atrativos GEO",
            revenueLow: 135000,
            revenueHigh: 405000,
            trafficLow: 13500,
            trafficHigh: 40500,
            confidence: "MEDIUM",
            opportunityScore: 80,
            businessImpactLevel: "high",
            explanation: explanation("headline", []),
          },
          potentialMaximum: {
            revenue: { low: 135000, high: 405000, currency: "BRL" },
            traffic: { low: 13500, high: 40500 },
            costAvoided: { low: 1440, high: 2160, currency: "BRL" },
          },
          overlapRisk: "high",
          overlapIndex: 0.75,
          evidence: {
            sources: ["CRAWLER"],
            missingSources: [],
            level: "MEDIUM",
            description: "d",
            explanation: explanation("evidence", []),
          },
          highestOpportunity: {
            recommendationId: "rec:a",
            title: "Atrativos GEO",
            opportunityScore: 80,
            businessImpactLevel: "high",
            confidence: "MEDIUM",
            explanation: explanation("highestOpportunity", []),
          },
          explanation: explanation("aggregate", []),
          modelVersion: "1.1",
        },
      },
    };

    render(<WhatIfPanel report={withAggregate} />);

    expect(screen.getByText(/Alta sobreposição/)).toBeInTheDocument();
    expect(
      screen.getByText(/Tráfego e receita consolidados descontam/),
    ).toBeInTheDocument();
  });
});
