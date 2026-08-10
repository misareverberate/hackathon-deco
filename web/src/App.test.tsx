import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "@/App";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    getApiConfig: vi.fn().mockResolvedValue({ requiresApiKey: false }),
  };
});

vi.mock("recharts", () => {
  const Stub = ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="chart-stub">{children}</div>
  );
  return {
    BarChart: Stub,
    Bar: Stub,
    CartesianGrid: Stub,
    ResponsiveContainer: Stub,
    Tooltip: Stub,
    XAxis: Stub,
    YAxis: Stub,
  };
});

describe("App", () => {
  it("renderiza o dashboard com o relatório de exemplo", async () => {
    render(<App />);

    expect(
      await screen.findByText(/Commerce Intelligence · Agente de crescimento/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Pergunte ao agente"),
    ).toBeInTheDocument();
  });

  it("mantém o agente como única área principal", async () => {
    render(<App />);

    expect(await screen.findByText("Pergunte ao agente")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /antes × depois/i }),
    ).not.toBeInTheDocument();
  });
});
