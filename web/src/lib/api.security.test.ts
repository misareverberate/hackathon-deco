import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeSiteStreaming, askAssistant, storeApiKey } from "@/lib/api";
import { mockReport } from "@/lib/mockReport";

afterEach(() => {
  vi.unstubAllGlobals();
  storeApiKey("");
});

describe("credenciais da API", () => {
  it("retém o token da análise fora do relatório e o envia nas operações seguintes", async () => {
    const analysisId = "analysis-secure";
    const token = "analysis-secret";
    const calls: Array<{ url: string; headers: Headers }> = [];
    const encoder = new TextEncoder();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, headers: new Headers(init?.headers) });
      if (url === "/api/analyze") {
        const event = JSON.stringify({
          type: "done",
          at: Date.now(),
          report: { ...mockReport, analysisId, analysisAccessToken: token },
        });
        return new Response(new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`${event}\n`));
            controller.close();
          },
        }), { status: 200 });
      }
      return new Response(JSON.stringify({
        answer: "ok",
        tool: { tool: "inspect_opportunities", summary: "ok", evidence: [] },
        suggestions: [],
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const report = await analyzeSiteStreaming("https://example.com", {}, () => {});
    expect(report.analysisAccessToken).toBeUndefined();
    await askAssistant(analysisId, "priorize");
    expect(calls[1]?.headers.get("X-Analysis-Token")).toBe(token);
  });
});
