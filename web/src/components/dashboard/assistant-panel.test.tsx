import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AssistantPanel } from "@/components/dashboard/assistant-panel";
import type { AssistantResponse } from "@/lib/api";

const { askAssistantMock, resetAssistantMock } = vi.hoisted(() => ({
  askAssistantMock: vi.fn(),
  resetAssistantMock: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  askAssistant: askAssistantMock,
  resetAssistant: resetAssistantMock,
}));

const response: AssistantResponse = {
  answer: "Encontrei dois produtos.",
  tool: {
    tool: "search_products",
    summary: "Dois produtos",
    evidence: ["Produto A", "Produto B"],
  },
  suggestions: ["Compare os dois produtos."],
};

describe("AssistantPanel", () => {
  beforeEach(() => {
    askAssistantMock.mockReset();
    resetAssistantMock.mockReset();
    resetAssistantMock.mockResolvedValue(undefined);
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("limpa a conversa local e o contexto da sessão no servidor", async () => {
    const user = userEvent.setup();
    askAssistantMock.mockResolvedValue(response);
    render(<AssistantPanel analysisId="analysis:1" />);

    await user.type(screen.getByLabelText("Pergunta para o agente"), "Quais produtos existem?");
    await user.click(screen.getByRole("button", { name: "Enviar pergunta" }));
    expect(await screen.findByText("Encontrei dois produtos.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Limpar conversa" }));
    expect(resetAssistantMock).toHaveBeenCalledWith("analysis:1");
    expect(screen.queryByText("Encontrei dois produtos.")).not.toBeInTheDocument();
  });

  it("interrompe a requisição ativa pelo painel", async () => {
    const user = userEvent.setup();
    let signal: AbortSignal | undefined;
    askAssistantMock.mockImplementation(
      async (_analysisId: string, _message: string, activeSignal: AbortSignal) => {
        signal = activeSignal;
        return await new Promise<AssistantResponse>(() => {});
      },
    );
    render(<AssistantPanel analysisId="analysis:1" />);

    await user.click(screen.getByRole("button", { name: /simule um comprador técnico/i }));
    await user.click(screen.getByRole("button", { name: "Interromper agente" }));

    await waitFor(() => expect(signal?.aborted).toBe(true));
  });
});
