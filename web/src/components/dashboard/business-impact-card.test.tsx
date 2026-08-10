import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BusinessImpactCard } from "@/components/dashboard/business-impact-card";
import { mockReport } from "@/lib/mockReport";
import type {
  AggregateImpact,
  MetricExplanation,
  RecommendationReport,
} from "@/lib/report";

function makeExplanation(metric: string): MetricExplanation {
  return {
    metric,
    summary: "resumo do modelo",
    formula: "fórmula",
    inputs: [],
    rationale: [],
    assumptions: [],
    modelVersion: "1.1",
  };
}

function reportWithAggregate(): RecommendationReport {
  const aggregate: AggregateImpact = {
    headline: {
      recommendationId: "op:schema",
      title: "Schema Product incompleto",
      revenueLow: 1000,
      revenueHigh: 3000,
      trafficLow: 100,
      trafficHigh: 300,
      confidence: "MEDIUM",
      opportunityScore: 85,
      businessImpactLevel: "high",
      explanation: makeExplanation("opportunityScore"),
    },
    potentialMaximum: {
      revenue: { low: 2000, high: 6000, currency: "BRL" },
      traffic: { low: 200, high: 600 },
      costAvoided: { low: 480, high: 720, currency: "BRL" },
    },
    overlapRisk: "low",
    overlapIndex: 0.2,
    evidence: {
      sources: ["CRAWLER"],
      missingSources: ["GA4"],
      level: "MEDIUM",
      description: "observações do crawler e suposições do setor",
      explanation: makeExplanation("evidence"),
    },
    highestOpportunity: {
      recommendationId: "op:schema",
      title: "Schema Product incompleto",
      opportunityScore: 85,
      businessImpactLevel: "high",
      confidence: "MEDIUM",
      explanation: makeExplanation("opportunityScore"),
    },
    explanation: makeExplanation("aggregate"),
    modelVersion: "1.1",
  };

  return {
    ...mockReport,
    businessInput: { avgTicket: 500, monthlyOrganicSessions: 45000 },
    impactEstimate: {
      ...mockReport.impactEstimate,
      aggregate,
    },
  };
}

describe("BusinessImpactCard", () => {
  it("exibe custo evitado e badge de ancoragem com dados do cliente", () => {
    render(<BusinessImpactCard report={reportWithAggregate()} />);

    expect(
      screen.getByLabelText("Impacto de negócio estimado"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Ancorado nos dados da operação/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Execução manual evitada/i)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*480\s*–\s*R\$\s*720/)).toBeInTheDocument();
  });

  it("não exibe badge de ancoragem sem dados do cliente", () => {
    const report: RecommendationReport = {
      ...reportWithAggregate(),
      businessInput: undefined,
    };
    render(<BusinessImpactCard report={report} />);

    expect(
      screen.queryByText(/Ancorado nos dados da operação/i),
    ).not.toBeInTheDocument();
  });

  it("retorna null quando não há agregado", () => {
    const report: RecommendationReport = {
      ...mockReport,
      impactEstimate: {
        ...mockReport.impactEstimate,
        aggregate: undefined,
      },
    };
    const { container } = render(<BusinessImpactCard report={report} />);

    expect(container.firstChild).toBeNull();
  });
});
