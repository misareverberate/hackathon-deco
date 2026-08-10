import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewAnalysisDialog } from "@/components/dashboard/new-analysis-dialog";
import { mockReport } from "@/lib/mockReport";
import type { AnalyzeResponse, AnalysisEvent } from "@/lib/api";

const { analyzeSiteStreamingMock } = vi.hoisted(() => ({
  analyzeSiteStreamingMock: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  analyzeSiteStreaming: analyzeSiteStreamingMock,
}));

function setupDialog() {
  const onCompleted = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <NewAnalysisDialog
      open
      onOpenChange={onOpenChange}
      onCompleted={onCompleted}
      defaultUrl="https://example.com"
    />,
  );
  return { onCompleted, onOpenChange };
}

describe("NewAnalysisDialog", () => {
  beforeEach(() => {
    analyzeSiteStreamingMock.mockReset();
  });

  it("executa a análise e chama onCompleted com o relatório", async () => {
    const user = userEvent.setup();
    const { onCompleted } = setupDialog();

    analyzeSiteStreamingMock.mockImplementation(
      async (
        _url: string,
        _options: unknown,
        onEvent: (event: AnalysisEvent) => void,
      ) => {
        onEvent({
          type: "stage",
          stage: "discovery",
          label: "Coleta de robots.txt e sitemap",
          at: Date.now(),
        });
        onEvent({
          type: "crawl-progress",
          pages: 1,
          products: 1,
          discovered: 2,
          total: 2,
          at: Date.now(),
        });
        onEvent({
          type: "stage",
          stage: "geo",
          label: "Simulação de compradores (GEO)",
          at: Date.now(),
        });
        return mockReport as AnalyzeResponse;
      },
    );

    await user.click(screen.getByRole("button", { name: /executar análise/i }));

    expect(analyzeSiteStreamingMock).toHaveBeenCalledWith(
      "https://example.com",
      {},
      expect.any(Function),
      expect.any(AbortSignal),
    );

    await waitFor(() =>
      expect(onCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ totalOpportunities: mockReport.totalOpportunities }),
      ),
    );

    expect(
      screen.getByText(/análise concluída/i),
    ).toBeInTheDocument();
  });

  it("envia dados de negócio e maxProducts quando informados", async () => {
    const user = userEvent.setup();
    setupDialog();

    analyzeSiteStreamingMock.mockImplementation(
      async (_url: string, _options: unknown, _onEvent: unknown) =>
        mockReport as AnalyzeResponse,
    );

    await user.type(
      screen.getByLabelText("Máximo de produtos a detalhar"),
      "50",
    );
    await user.type(
      screen.getByLabelText("Ticket médio em reais"),
      "700",
    );
    await user.type(
      screen.getByLabelText("Conversão orgânica em porcentagem"),
      "2",
    );
    await user.click(screen.getByRole("button", { name: /executar análise/i }));

    await waitFor(() => expect(analyzeSiteStreamingMock).toHaveBeenCalled());

    const [, options] = analyzeSiteStreamingMock.mock.calls[0];
    expect(options).toEqual({
      maxProducts: 50,
      business: { avgTicket: 700, organicConversionRate: 0.02 },
    });
  });

  it("exibe mensagem de erro e permite tentar novamente", async () => {
    const user = userEvent.setup();
    setupDialog();

    analyzeSiteStreamingMock.mockRejectedValue(new Error("Falha de rede"));

    await user.click(screen.getByRole("button", { name: /executar análise/i }));

    expect(await screen.findByText("Falha de rede")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /tentar novamente/i }),
    ).toBeInTheDocument();
  });

  it("cancela a requisição ativa ao cancelar a análise", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = setupDialog();
    let signal: AbortSignal | undefined;
    analyzeSiteStreamingMock.mockImplementation(
      async (_url, _options, _onEvent, activeSignal: AbortSignal) => {
        signal = activeSignal;
        return await new Promise<AnalyzeResponse>(() => {});
      },
    );

    await user.click(screen.getByRole("button", { name: /executar análise/i }));
    await user.click(screen.getByRole("button", { name: /cancelar análise/i }));

    expect(signal?.aborted).toBe(true);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
