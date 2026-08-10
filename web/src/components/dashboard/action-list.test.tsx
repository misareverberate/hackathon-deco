import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionList } from "@/components/dashboard/action-list";
import type { ApplyActionResponse } from "@/lib/api";
import type { Recommendation } from "@/lib/report";

const recommendation: Recommendation = {
  id: "rec:schema",
  opportunityId: "op:schema-product",
  title: "Completar schema Product",
  description: "Adicionar os campos comerciais ausentes ao JSON-LD.",
  category: "Schema",
  priority: "critica",
  impact: "muito_alto",
  confidence: 90,
  effort: "baixo",
  automatable: true,
  score: 92,
  expectedImpact: "Mais produtos elegíveis para busca generativa.",
  action: {
    title: "Publicar schema Product completo",
    description: "Completar JSON-LD nas páginas de produto.",
    steps: ["Adicionar brand", "Adicionar offers"],
  },
};

const response: ApplyActionResponse = {
  tool: "apply_action",
  summary:
    "“Completar schema Product” aplicada: artefato gerado e efeito estimado por re-simulação (sucesso 42% → 83%, 5 jornada(s) resolvida(s)).",
  evidence: [],
  data: {
    recommendationId: "rec:schema",
    recommendationTitle: "Completar schema Product",
    artifact: {
      kind: "json-ld",
      filename: "product.schema.json",
      content: '{"@type":"Product"}',
      title: "",
      objective: "",
      acceptanceCriteria: [],
      expectedImpact: "",
    },
    counterfactual: {
      simulatable: true,
      totalJourneys: 12,
      beforeSuccess: 5,
      afterSuccess: 10,
      beforeSuccessRate: 0.4167,
      afterSuccessRate: 0.8333,
      resolvedJourneys: 5,
      avgConfidenceDelta: 12,
      projectedAttributes: ["Memória"],
    },
    decision: { recommendationId: "rec:schema", status: "accepted", updatedAt: 1 },
  },
};

describe("ActionList", () => {
  it("aplica ação automática, mostra o delta e oferece download do artefato", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn().mockResolvedValue(response);
    render(
      <ActionList
        title="Ações automáticas"
        description="Executáveis por automação"
        recommendations={[recommendation]}
        mode="automatic"
        onSelect={() => {}}
        onApply={onApply}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Aplicar/ }));

    expect(await screen.findByText(/re-simulação/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Sucesso 42% → 83%/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/5 jornada\(s\) resolvida\(s\)/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Baixar json-ld/ })).toBeInTheDocument();
    expect(onApply).toHaveBeenCalledWith(recommendation);
    expect(screen.getAllByText("Aplicada").length).toBeGreaterThan(0);
  });

  it("mantém o botão desabilitado enquanto a aplicação está em andamento", async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    const onApply = vi.fn().mockImplementation(
      () =>
        new Promise<ApplyActionResponse>((resolve) => {
          release = () => resolve(response);
        }),
    );
    render(
      <ActionList
        title="Ações automáticas"
        description="Executáveis por automação"
        recommendations={[recommendation]}
        mode="automatic"
        onSelect={() => {}}
        onApply={onApply}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Aplicar/ }));

    const pending = screen.getByRole("button", { name: /Aplicando…/ });
    expect(pending).toBeDisabled();
    release?.();
    expect((await screen.findAllByText("Aplicada")).length).toBeGreaterThan(0);
  });

  it("exibe o erro quando a aplicação falha", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn().mockRejectedValue(new Error("Falha ao aplicar a correção."));
    render(
      <ActionList
        title="Ações automáticas"
        description="Executáveis por automação"
        recommendations={[recommendation]}
        mode="automatic"
        onSelect={() => {}}
        onApply={onApply}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Aplicar/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falha ao aplicar a correção.",
    );
  });

  it("modo manual abre os detalhes em vez de aplicar", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ActionList
        title="Ações manuais"
        description="Exigem execução humana"
        recommendations={[recommendation]}
        mode="manual"
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Ver detalhes/ }));

    expect(onSelect).toHaveBeenCalledWith(recommendation);
  });
});
