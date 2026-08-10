import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BusinessInputFields } from "@/components/dashboard/business-input-fields";
import type { ClientBusinessInput } from "@/lib/report";

describe("BusinessInputFields", () => {
  it("renderiza os quatro campos de dados da operação", () => {
    render(
      <BusinessInputFields value={{}} onChange={() => {}} />,
    );

    expect(
      screen.getByLabelText("Ticket médio em reais"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Conversão orgânica em porcentagem"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Sessões orgânicas por mês"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Custo da mão de obra por hora"),
    ).toBeInTheDocument();
  });

  it("converte a conversão percentual para fração (2.5 → 0.025)", () => {
    const onChange = vi.fn();
    render(<BusinessInputFields value={{}} onChange={onChange} />);

    fireEvent.change(
      screen.getByLabelText("Conversão orgânica em porcentagem"),
      { target: { value: "2.5" } },
    );

    expect(onChange).toHaveBeenLastCalledWith({
      organicConversionRate: 0.025,
    });
  });

  it("preserva conversão orgânica igual a zero", () => {
    const onChange = vi.fn();
    render(<BusinessInputFields value={{}} onChange={onChange} />);

    fireEvent.change(
      screen.getByLabelText("Conversão orgânica em porcentagem"),
      { target: { value: "0" } },
    );

    expect(onChange).toHaveBeenLastCalledWith({
      organicConversionRate: 0,
    });
  });

  it("preenche ticket médio e sessões mensais como números", () => {
    const onChange = vi.fn();
    render(<BusinessInputFields value={{}} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText("Ticket médio em reais"), {
      target: { value: "500" },
    });
    expect(onChange).toHaveBeenLastCalledWith({ avgTicket: 500 });

    fireEvent.change(
      screen.getByLabelText("Sessões orgânicas por mês"),
      { target: { value: "30000" } },
    );
    expect(onChange).toHaveBeenLastCalledWith({
      monthlyOrganicSessions: 30000,
    });
  });

  it("reflete valores existentes no formulário", () => {
    const value: ClientBusinessInput = {
      avgTicket: 800,
      organicConversionRate: 0.03,
      monthlyOrganicSessions: 45000,
      laborCostPerHour: 60,
    };
    render(<BusinessInputFields value={value} onChange={() => {}} />);

    expect(screen.getByLabelText("Ticket médio em reais")).toHaveValue(800);
    expect(
      screen.getByLabelText("Conversão orgânica em porcentagem"),
    ).toHaveValue(3);
    expect(
      screen.getByLabelText("Sessões orgânicas por mês"),
    ).toHaveValue(45000);
    expect(
      screen.getByLabelText("Custo da mão de obra por hora"),
    ).toHaveValue(60);
  });
});
